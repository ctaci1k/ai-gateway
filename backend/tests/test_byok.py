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


# --- Quota semantics with BYOK ---------------------------------------------


def test_single_on_own_key_is_not_charged(client, monkeypatch):
    monkeypatch.setattr(ProviderService, "generate_stream", staticmethod(_fake_stream))
    headers = _make_limited_user(client, "single")

    # Default key → charged.
    client.post(
        "/chat/stream", json={"message": "hi", "provider": "groq"}, headers=headers
    )
    assert client.get("/auth/me").json()["used_today"] == 1

    # Own key → free.
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


def test_compare_free_only_when_all_participants_byok(client, monkeypatch):
    monkeypatch.setattr(
        OrchestratorService, "process_chat", staticmethod(_fake_process_chat)
    )
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
    client.post(
        "/chat",
        json={**base, "byok": {"responders": [_GROQ_BYOK]}},
        headers=headers,
    )
    assert client.get("/auth/me").json()["used_today"] == 2

    # All participants BYOK (3 responders + judge) → free.
    client.post(
        "/chat",
        json={
            **base,
            "byok": {
                "responders": [_GROQ_BYOK, _CEREBRAS_BYOK, _SAMBANOVA_BYOK],
                "judge": _JUDGE_BYOK,
            },
        },
        headers=headers,
    )
    assert client.get("/auth/me").json()["used_today"] == 2
