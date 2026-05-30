# backend/tests/test_admin_quotas.py
"""Quota enforcement, code-gated registration and the admin API (PH15, D-10).

Everything goes through HTTP so the app's event loop owns all DB access.
"""

from services.orchestrator_service import OrchestratorService
from tests.conftest import TEST_REGISTRATION_CODE

_PROVIDER_RESPONSE = {
    "response": "hello",
    "model": "m",
    "execution_time": 1.0,
    "provider": "groq",
    "success": True,
}


async def _fake_process_chat(**kwargs):
    return {
        "best_response": "hello",
        "selected_model": "groq",
        "selected_model_data": _PROVIDER_RESPONSE,
        "all_responses": {"groq": _PROVIDER_RESPONSE},
        "failed_providers": [],
        "execution_metadata": [],
        "execution_summary": {},
        "compare_mode": kwargs.get("compare_mode", False),
        "selector_enabled": kwargs.get("selector_enabled", False),
        "selector_scores": {},
        "selector_metadata": {},
        "selector_reason": None,
        "compare_summary": {},
        "total_tokens": 42,
    }


def _register(client, username, password="password123", code=TEST_REGISTRATION_CODE):
    return client.post(
        "/auth/register",
        json={"username": username, "password": password, "registration_code": code},
    )


def _csrf(resp):
    return {"X-CSRF-Token": resp.json()["csrf_token"]}


def _make_admin(client):
    """Register + authenticate the configured admin (ADMIN_USERNAME='admin')."""
    resp = _register(client, "admin")
    assert resp.status_code == 200, resp.text
    return _csrf(resp)


def _login(client, username, password="password123"):
    return client.post("/auth/login", json={"username": username, "password": password})


def _chat(client, headers, compare=False):
    return client.post(
        "/chat",
        json={"message": "hi", "provider": "groq", "compare_mode": compare},
        headers=headers,
    )


# --- Registration code (D-10) ---------------------------------------------


def test_registration_requires_valid_code(client):
    assert _register(client, "noco", code="").status_code == 403
    wrong = _register(client, "wrong", code="nope")
    assert wrong.status_code == 403
    assert wrong.json()["error"]["code"] == "invalid_registration_code"
    assert _register(client, "good").status_code == 200


def test_admin_username_becomes_unlimited_admin(client):
    _make_admin(client)
    me = client.get("/auth/me").json()
    assert me["is_admin"] is True
    assert me["max_requests_per_minute"] is None
    assert me["max_requests_per_day"] is None
    assert me["remaining_today"] is None


def test_regular_user_gets_default_limits(client):
    _register(client, "emp")
    client.post("/auth/login", json={"username": "emp", "password": "password123"})
    me = client.get("/auth/me").json()
    assert me["is_admin"] is False
    # conftest sets generous defaults; the point is they're set (not unlimited).
    assert me["max_requests_per_day"] is not None
    assert me["remaining_today"] is not None


# --- Admin API isolation ----------------------------------------------------


def test_admin_endpoints_require_admin(client):
    # Unauthenticated → 401.
    assert client.get("/admin/users").status_code == 401

    # Authenticated non-admin → 403.
    reg = _register(client, "regular")
    client.post("/auth/login", json={"username": "regular", "password": "password123"})
    assert client.get("/admin/users").status_code == 403
    # Mutation without CSRF is rejected before the body matters.
    assert (
        client.post("/admin/users", json={"username": "x", "password": "y"}).status_code
        == 403
    )
    del reg


def test_admin_can_list_create_and_update_users(client):
    admin_csrf = _make_admin(client)

    # Missing CSRF on a mutation → 403 even for the admin.
    assert (
        client.post(
            "/admin/users", json={"username": "ann", "password": "password123"}
        ).status_code
        == 403
    )

    created = client.post(
        "/admin/users",
        json={
            "username": "ann",
            "password": "password123",
            "max_requests_per_minute": 7,
            "max_requests_per_day": 9,
        },
        headers=admin_csrf,
    )
    assert created.status_code == 200, created.text
    user = created.json()
    assert user["max_requests_per_minute"] == 7
    assert user["max_requests_per_day"] == 9
    assert user["is_admin"] is False

    listed = client.get("/admin/users").json()["users"]
    usernames = {u["username"] for u in listed}
    assert {"admin", "ann"} <= usernames

    # PATCH limits (a sent null means unlimited).
    patched = client.patch(
        f"/admin/users/{user['id']}",
        json={"max_requests_per_minute": None, "max_requests_per_day": 3},
        headers=admin_csrf,
    )
    assert patched.status_code == 200
    assert patched.json()["max_requests_per_minute"] is None
    assert patched.json()["max_requests_per_day"] == 3


# --- Quota enforcement (D-10) ----------------------------------------------


def test_per_minute_quota_enforced(client, monkeypatch):
    monkeypatch.setattr(
        OrchestratorService, "process_chat", staticmethod(_fake_process_chat)
    )
    admin_csrf = _make_admin(client)
    client.post(
        "/admin/users",
        json={
            "username": "lim",
            "password": "password123",
            "max_requests_per_minute": 2,
            "max_requests_per_day": 1000,
        },
        headers=admin_csrf,
    )
    emp_csrf = _csrf(_login(client, "lim"))

    assert _chat(client, emp_csrf).status_code == 200
    assert _chat(client, emp_csrf).status_code == 200
    third = _chat(client, emp_csrf)
    assert third.status_code == 429
    assert third.json()["error"]["code"] == "quota_exceeded"


def test_per_day_quota_and_compare_counts_as_one(client, monkeypatch):
    monkeypatch.setattr(
        OrchestratorService, "process_chat", staticmethod(_fake_process_chat)
    )
    admin_csrf = _make_admin(client)
    client.post(
        "/admin/users",
        json={
            "username": "day",
            "password": "password123",
            "max_requests_per_minute": 1000,
            "max_requests_per_day": 2,
        },
        headers=admin_csrf,
    )
    emp_csrf = _csrf(_login(client, "day"))

    # Two Compare requests count as one event each → both allowed, third over.
    assert _chat(client, emp_csrf, compare=True).status_code == 200
    assert _chat(client, emp_csrf, compare=True).status_code == 200
    over = _chat(client, emp_csrf, compare=True)
    assert over.status_code == 429
    assert over.json()["error"]["code"] == "quota_exceeded"

    me = client.get("/auth/me").json()
    assert me["used_today"] == 2  # two recorded; the rejected one wrote nothing
    assert me["remaining_today"] == 0


def test_admin_is_not_quota_limited(client, monkeypatch):
    monkeypatch.setattr(
        OrchestratorService, "process_chat", staticmethod(_fake_process_chat)
    )
    admin_csrf = _make_admin(client)
    # Many requests, no enforcement for the admin.
    for _ in range(5):
        assert _chat(client, admin_csrf).status_code == 200
    me = client.get("/auth/me").json()
    assert me["remaining_today"] is None


# --- Usage / token audit ----------------------------------------------------


def test_usage_events_record_tokens_for_admin_audit(client, monkeypatch):
    monkeypatch.setattr(
        OrchestratorService, "process_chat", staticmethod(_fake_process_chat)
    )
    admin_csrf = _make_admin(client)
    created = client.post(
        "/admin/users",
        json={"username": "audited", "password": "password123"},
        headers=admin_csrf,
    )
    audited_id = created.json()["id"]

    # The audited user makes two requests.
    emp_csrf = _csrf(_login(client, "audited"))
    assert _chat(client, emp_csrf).status_code == 200
    assert _chat(client, emp_csrf, compare=True).status_code == 200

    # Back to admin to inspect the audit.
    client.post("/auth/login", json={"username": "admin", "password": "password123"})
    usage = client.get(f"/admin/users/{audited_id}/usage").json()
    assert usage["total_requests"] == 2
    assert usage["total_tokens"] == 84  # 42 per request (mocked)
    assert {e["mode"] for e in usage["events"]} == {"single", "compare"}
    assert all(e["total_tokens"] == 42 for e in usage["events"])
