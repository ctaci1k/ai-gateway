# backend/tests/test_byok.py
"""BYOK (bring-your-own-key) transit providers, key validation and quota
semantics (PH17, D-12).

A turn running on the user's own keys must not be charged against the account
quota: Single is free when the chosen model is BYOK; Compare is free only when
every participant (responders + judge) is BYOK. Keys are transit-only.
"""

from services.orchestrator_service import OrchestratorService
from services.provider_service import ProviderService, TransientProvider
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
        "total_tokens": 10,
    }


async def _fake_stream(message, provider_name="groq", provider=None):
    yield {"type": "token", "content": "hi", "provider": provider_name, "model": "m"}


def _register(client, username, password="password123", code=TEST_REGISTRATION_CODE):
    return client.post(
        "/auth/register",
        json={"username": username, "password": password, "registration_code": code},
    )


def _csrf(resp):
    return {"X-CSRF-Token": resp.json()["csrf_token"]}


def _make_limited_user(client, username, per_minute=50, per_day=50):
    """Admin creates a limited user; returns that user's CSRF headers."""
    admin_csrf = _csrf(_register(client, "admin"))
    client.post(
        "/admin/users",
        json={
            "username": username,
            "password": "password123",
            "max_requests_per_minute": per_minute,
            "max_requests_per_day": per_day,
        },
        headers=admin_csrf,
    )
    return _csrf(
        client.post(
            "/auth/login", json={"username": username, "password": "password123"}
        )
    )


_GROQ_BYOK = {"slot": "groq", "api_key": "user-key", "model_id": "my-llama"}
_CEREBRAS_BYOK = {"slot": "cerebras", "api_key": "user-key", "model_id": "my-glm"}
_SAMBANOVA_BYOK = {"slot": "sambanova", "api_key": "user-key", "model_id": "my-ds"}
_JUDGE_BYOK = {"api_key": "user-key", "model_id": "my-qwen"}


# --- Transient provider resolution -----------------------------------------


def test_resolve_responders_mixes_byok_and_defaults():
    resolved = ProviderService.resolve_responders(
        ["groq", "cerebras", "sambanova"],
        [_GROQ_BYOK],
    )
    # groq runs on the user's transient key; the rest on built-in singletons.
    assert isinstance(resolved["groq"], TransientProvider)
    assert resolved["groq"].model_name == "my-llama"
    assert not isinstance(resolved["cerebras"], TransientProvider)
    assert not isinstance(resolved["sambanova"], TransientProvider)


def test_custom_slot_without_base_url_is_rejected():
    import pytest

    with pytest.raises(ValueError):
        ProviderService.build_transient_responder(
            {"slot": "custom-1", "api_key": "k", "model_id": "m"}
        )


# --- Key validation ---------------------------------------------------------


def test_validate_keys_reports_per_slot(client, monkeypatch):
    async def fake_validate(self):
        if self.model_name == "bad-model":
            raise RuntimeError("Error 401 invalid api key user-key")

    monkeypatch.setattr(TransientProvider, "validate_credentials", fake_validate)

    headers = _csrf(_register(client, "val"))
    resp = client.post(
        "/keys/validate",
        json={
            "entries": [
                {"slot": "groq", "api_key": "good", "model_id": "ok-model"},
                {"slot": "cerebras", "api_key": "user-key", "model_id": "bad-model"},
                {
                    "slot": "byok-judge",
                    "api_key": "k",
                    "model_id": "ok-model",
                    "is_judge": True,
                },
            ]
        },
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    results = {r["slot"]: r for r in resp.json()["results"]}
    assert results["groq"]["ok"] is True
    assert results["cerebras"]["ok"] is False
    # The key must never be echoed back in the error (NQ5).
    assert "user-key" not in (results["cerebras"]["error"] or "")
    assert results["byok-judge"]["ok"] is True


def test_validate_requires_auth_and_csrf(client):
    # Unauthenticated → 401.
    assert client.post("/keys/validate", json={"entries": []}).status_code == 401
    # Authenticated but no CSRF header → 403.
    _register(client, "noco")
    assert client.post("/keys/validate", json={"entries": []}).status_code == 403


# --- Server-side storage (PH30, D-20) --------------------------------------

# Save entries carry a ``slot`` (the judge slot id is "byok-judge").
_GROQ_SAVE = {"slot": "groq", "api_key": "user-key-1234", "model_id": "my-llama"}
_CEREBRAS_SAVE = {"slot": "cerebras", "api_key": "user-key-5678", "model_id": "my-glm"}
_SAMBANOVA_SAVE = {"slot": "sambanova", "api_key": "user-key-9012", "model_id": "my-ds"}
_JUDGE_SAVE = {"slot": "byok-judge", "api_key": "user-key-3456", "model_id": "my-qwen"}


def _ok_validate(monkeypatch):
    """Make every transient validation succeed (no network)."""

    async def ok(self):
        return None

    monkeypatch.setattr(TransientProvider, "validate_credentials", ok)


def _store(client, headers, entries):
    return client.put("/keys", json={"entries": entries}, headers=headers)


def test_put_stores_encrypted_and_get_returns_write_only_metadata(client, monkeypatch):
    _ok_validate(monkeypatch)
    headers = _csrf(_register(client, "store"))

    resp = _store(client, headers, [_GROQ_SAVE, _JUDGE_SAVE])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert all(r["ok"] for r in body["results"])

    # GET returns metadata only — never the key, only last4.
    keys = {k["slot"]: k for k in client.get("/keys").json()["keys"]}
    assert keys["groq"]["model_id"] == "my-llama"
    assert keys["groq"]["last4"] == "1234"
    assert "api_key" not in keys["groq"]
    assert keys["byok-judge"]["last4"] == "3456"

    # The plaintext key is never in any response body.
    assert "user-key-1234" not in resp.text
    assert "user-key-1234" not in client.get("/keys").text

    # Stored ciphertext in the DB is NOT the plaintext key.
    import sqlite3

    from tests.conftest import _TEST_DB

    con = sqlite3.connect(_TEST_DB)
    rows = con.execute("select slot, key_ciphertext from byok_credentials").fetchall()
    con.close()
    assert rows
    for _slot, ciphertext in rows:
        assert b"user-key" not in bytes(ciphertext)


def test_put_failing_key_is_not_stored(client, monkeypatch):
    async def fail(self):
        raise RuntimeError("Error 401 invalid api key")

    monkeypatch.setattr(TransientProvider, "validate_credentials", fail)
    headers = _csrf(_register(client, "failsave"))

    resp = _store(client, headers, [_GROQ_SAVE])
    assert resp.json()["results"][0]["ok"] is False
    assert client.get("/keys").json()["keys"] == []


def test_delete_removes_slot(client, monkeypatch):
    _ok_validate(monkeypatch)
    headers = _csrf(_register(client, "del"))
    _store(client, headers, [_GROQ_SAVE, _CEREBRAS_SAVE])

    resp = client.delete("/keys/groq", headers=headers)
    assert resp.status_code == 200, resp.text
    slots = {k["slot"] for k in resp.json()["keys"]}
    assert slots == {"cerebras"}


def test_keys_are_isolated_per_account(client, monkeypatch):
    _ok_validate(monkeypatch)
    a_headers = _csrf(_register(client, "alice"))
    _store(client, a_headers, [_GROQ_SAVE])

    # Switch to a different account: it must see none of alice's keys.
    b_headers = _csrf(_register(client, "bob"))
    assert client.get("/keys").json()["keys"] == []
    # Bob storing his own slot doesn't leak alice's.
    _store(client, b_headers, [_CEREBRAS_SAVE])
    assert {k["slot"] for k in client.get("/keys").json()["keys"]} == {"cerebras"}


def test_put_reuses_stored_key_when_changing_model(client, monkeypatch):
    _ok_validate(monkeypatch)
    headers = _csrf(_register(client, "reuse"))
    _store(client, headers, [_GROQ_SAVE])

    # Change only the model_id (no api_key sent) → stored key is reused.
    resp = _store(
        client,
        headers,
        [{"slot": "groq", "model_id": "my-llama-v2"}],
    )
    assert resp.json()["results"][0]["ok"] is True
    keys = {k["slot"]: k for k in client.get("/keys").json()["keys"]}
    assert keys["groq"]["model_id"] == "my-llama-v2"
    assert keys["groq"]["last4"] == "1234"  # original key's last4 preserved


def test_keys_endpoints_require_auth_and_csrf(client):
    # Unauthenticated → 401.
    assert client.get("/keys").status_code == 401
    assert client.put("/keys", json={"entries": []}).status_code == 401
    # Authenticated but no CSRF header on a mutation → 403.
    _register(client, "noco2")
    assert client.put("/keys", json={"entries": []}).status_code == 403
    assert client.delete("/keys/groq").status_code == 403


# --- Model discovery (PH30, D) ---------------------------------------------


def test_models_discovery_tags_chat_models(client, monkeypatch):
    async def fake_list(self):
        return ["gpt-4o", "text-embedding-3-small", "whisper-1", "llama-3.3-70b"]

    monkeypatch.setattr(TransientProvider, "list_models", fake_list)
    headers = _csrf(_register(client, "disc"))

    resp = client.post(
        "/keys/models",
        json={"slot": "groq", "api_key": "k", "base_url": ""},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["error_reason"] is None
    chat = {m["id"]: m["is_chat"] for m in body["models"]}
    assert chat["gpt-4o"] is True
    assert chat["llama-3.3-70b"] is True
    assert chat["text-embedding-3-small"] is False
    assert chat["whisper-1"] is False


def test_models_discovery_falls_back_on_error(client, monkeypatch):
    async def boom(self):
        raise RuntimeError("404 not found /models")

    monkeypatch.setattr(TransientProvider, "list_models", boom)
    headers = _csrf(_register(client, "disc2"))

    resp = client.post(
        "/keys/models", json={"slot": "groq", "api_key": "k"}, headers=headers
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["models"] == []
    assert body["error_reason"] is not None


class _StatusError(Exception):
    def __init__(self, status_code):
        super().__init__(f"HTTP {status_code}")
        self.status_code = status_code


def test_models_discovery_404_is_no_models(client, monkeypatch):
    async def missing(self):
        raise _StatusError(404)

    monkeypatch.setattr(TransientProvider, "list_models", missing)
    headers = _csrf(_register(client, "disc404"))
    resp = client.post(
        "/keys/models", json={"slot": "groq", "api_key": "k"}, headers=headers
    )
    assert resp.json()["error_reason"] == "no_models"


def test_models_discovery_401_is_bad_key(client, monkeypatch):
    async def unauthorized(self):
        raise _StatusError(401)

    monkeypatch.setattr(TransientProvider, "list_models", unauthorized)
    headers = _csrf(_register(client, "disc401"))
    resp = client.post(
        "/keys/models", json={"slot": "groq", "api_key": "bad"}, headers=headers
    )
    assert resp.json()["error_reason"] == "bad_key"


def test_models_discovery_empty_list_has_no_error(client, monkeypatch):
    async def empty(self):
        return []

    monkeypatch.setattr(TransientProvider, "list_models", empty)
    headers = _csrf(_register(client, "discempty"))
    resp = client.post(
        "/keys/models", json={"slot": "groq", "api_key": "k"}, headers=headers
    )
    body = resp.json()
    assert body["models"] == []
    assert body["error_reason"] is None


def test_models_discovery_reuses_stored_key(client, monkeypatch):
    _ok_validate(monkeypatch)

    async def fake_list(self):
        return ["model-a", "model-b"]

    monkeypatch.setattr(TransientProvider, "list_models", fake_list)
    headers = _csrf(_register(client, "disc3"))
    _store(client, headers, [_GROQ_SAVE])

    # No api_key in the body → the stored key is reused (decrypted server-side).
    resp = client.post("/keys/models", json={"slot": "groq"}, headers=headers)
    assert resp.status_code == 200, resp.text
    assert [m["id"] for m in resp.json()["models"]] == ["model-a", "model-b"]


# --- Quota semantics with BYOK (keys loaded from server storage) ------------


def test_single_on_own_key_is_not_charged(client, monkeypatch):
    monkeypatch.setattr(ProviderService, "generate_stream", staticmethod(_fake_stream))
    _ok_validate(monkeypatch)
    headers = _make_limited_user(client, "single")

    # Default key → charged.
    client.post(
        "/chat/stream", json={"message": "hi", "provider": "groq"}, headers=headers
    )
    assert client.get("/auth/me").json()["used_today"] == 1

    # Store own groq key; Single on it now loads from the DB → free.
    assert _store(client, headers, [_GROQ_SAVE]).json()["results"][0]["ok"]
    client.post(
        "/chat/stream", json={"message": "hi", "provider": "groq"}, headers=headers
    )
    assert client.get("/auth/me").json()["used_today"] == 1


def test_compare_free_only_when_all_participants_byok(client, monkeypatch):
    monkeypatch.setattr(
        OrchestratorService, "process_chat", staticmethod(_fake_process_chat)
    )
    _ok_validate(monkeypatch)
    headers = _make_limited_user(client, "cmp")

    base = {
        "message": "hi",
        "providers": ["groq", "cerebras", "sambanova"],
        "compare_mode": True,
        "selector_enabled": True,
    }

    # No keys → charged.
    client.post("/chat", json=base, headers=headers)
    assert client.get("/auth/me").json()["used_today"] == 1

    # Partial (only one responder BYOK, no judge) → still charged.
    _store(client, headers, [_GROQ_SAVE])
    client.post("/chat", json=base, headers=headers)
    assert client.get("/auth/me").json()["used_today"] == 2

    # All participants BYOK (3 responders + judge) → free.
    _store(client, headers, [_CEREBRAS_SAVE, _SAMBANOVA_SAVE, _JUDGE_SAVE])
    client.post("/chat", json=base, headers=headers)
    assert client.get("/auth/me").json()["used_today"] == 2


def test_body_byok_is_ignored(client, monkeypatch):
    """A client can no longer inject keys via the request body (PH30 security)."""
    monkeypatch.setattr(ProviderService, "generate_stream", staticmethod(_fake_stream))
    headers = _make_limited_user(client, "ignorebody")

    # Body byok is ignored → the turn is charged like a built-in request.
    client.post(
        "/chat/stream",
        json={
            "message": "hi",
            "provider": "groq",
            "byok": {"responders": [_GROQ_BYOK]},
        },
        headers=headers,
    )
    assert client.get("/auth/me").json()["used_today"] == 1
