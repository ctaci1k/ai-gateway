# backend/tests/test_api.py

from fastapi import FastAPI
from fastapi.testclient import TestClient

from core.middleware import NoStoreMiddleware, RateLimitMiddleware
from services.orchestrator_service import OrchestratorService

PROVIDER_RESPONSE = {
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
        "selected_model_data": PROVIDER_RESPONSE,
        "all_responses": {"groq": PROVIDER_RESPONSE},
        "failed_providers": [],
        "execution_metadata": [
            {
                "provider": "groq",
                "success": True,
                "execution_time": 1.0,
                "model": "m",
                "error": None,
            }
        ],
        "execution_summary": {
            "total_models": 1,
            "successful_models": 1,
            "failed_models": 0,
            "average_execution_time": 1.0,
        },
        "compare_mode": False,
        "selector_enabled": False,
        "selector_scores": {},
        "selector_metadata": {},
        "selector_reason": None,
        "compare_summary": {},
    }


def test_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "AI Gateway Backend Running"}


def test_providers_list_is_public(client):
    response = client.get("/providers")
    assert response.status_code == 200
    assert set(response.json()["providers"]) == {"groq", "cerebras", "sambanova"}


def test_chat_requires_auth(client):
    response = client.post("/chat", json={"message": "hi"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthorized"


def test_chat_requires_csrf(auth_client):
    client, _headers = auth_client
    # Authenticated (cookie present) but no CSRF header → 403.
    response = client.post("/chat", json={"message": "hi", "provider": "groq"})
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"


def test_chat_validation_error_unified_format(auth_client):
    client, headers = auth_client
    response = client.post("/chat", json={"message": ""}, headers=headers)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_manual_selection_missing_field_returns_400(auth_client):
    client, headers = auth_client
    response = client.post("/preferences/manual-selection", json={}, headers=headers)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_error"


def test_chat_success_with_mocked_orchestrator(auth_client, monkeypatch):
    client, headers = auth_client
    monkeypatch.setattr(
        OrchestratorService, "process_chat", staticmethod(_fake_process_chat)
    )
    response = client.post(
        "/chat", json={"message": "hi", "provider": "groq"}, headers=headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["response"] == "hello"
    assert body["selected_model"] == "groq"


def test_rate_limit_returns_429():
    app = FastAPI()
    app.add_middleware(RateLimitMiddleware, max_requests=2, window_seconds=60)

    @app.post("/ping")
    def ping():
        return {"ok": True}

    test_client = TestClient(app)
    assert test_client.post("/ping").status_code == 200
    assert test_client.post("/ping").status_code == 200
    blocked = test_client.post("/ping")
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "rate_limited"


def test_no_store_header_on_responses():
    """Every API response is marked no-store so a fronting proxy can't cache it
    (a stale admin list after create/delete was the symptom)."""
    app = FastAPI()
    app.add_middleware(NoStoreMiddleware)

    @app.get("/thing")
    def thing():
        return {"ok": True}

    test_client = TestClient(app)
    resp = test_client.get("/thing")
    assert resp.status_code == 200
    assert resp.headers["cache-control"] == "no-store"
