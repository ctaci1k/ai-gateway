# backend/tests/conftest.py
"""Shared pytest fixtures and hermetic environment setup.

Dummy provider keys and an isolated SQLite database are configured before any
application module is imported, so tests never depend on a real .env, make
network calls, or touch the dev database.
"""

import os
import tempfile

_TEST_DB = os.path.join(tempfile.gettempdir(), "ai_gateway_test.db")

os.environ.setdefault("GROQ_API_KEY", "test-groq")
os.environ.setdefault("MISTRAL_API_KEY", "test-mistral")
# Slot 3 (scout) runs on Groq (GROQ_API_KEY above). Gemini now backs only RAG
# embeddings (PH36/D-26).
os.environ.setdefault("GEMINI_API_KEY", "test-gemini")
os.environ.setdefault("DATABASE_URL", f"sqlite+aiosqlite:///{_TEST_DB}")
# Ephemeral (in-process) vector store so RAG tests never touch disk or network.
os.environ.setdefault("CHROMA_PATH", ":memory:")
# Registration is code-gated (D-10); HTTP tests use a known code. Default quotas
# are set high so non-quota tests never hit enforcement — quota tests set low
# limits on their user explicitly.
TEST_REGISTRATION_CODE = "test-reg-code"
os.environ.setdefault("REGISTRATION_CODE", TEST_REGISTRATION_CODE)
os.environ.setdefault("DEFAULT_MAX_REQUESTS_PER_DAY", "100000")
# BYOK envelope KEK (PH30, D-20): a fixed base64 of 32 bytes so BYOK storage
# tests can encrypt/decrypt without a real secret.
os.environ.setdefault(
    "BYOK_ENCRYPTION_KEY", "dGVzdC1ieW9rLWtlay0zMi1ieXRlcy1leGFjdGx5ISE="
)

import pytest  # noqa: E402

from core.config import get_settings  # noqa: E402

# Ensure settings reflect the injected environment, not a cached/.env value.
get_settings.cache_clear()


async def _fresh_schema():
    import db.models  # noqa: F401  (register models on metadata)
    from core.db import Base, get_engine, reset_engine_for_tests
    from core.rag.store import reset_vector_store_for_tests

    reset_engine_for_tests()
    reset_vector_store_for_tests()
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)


@pytest.fixture
async def repo():
    """A SqlChatRepository for a freshly-created user."""
    from core.db import dispose_engine
    from memory.sql_repository import SqlChatRepository
    from services.auth_service import AuthService

    await _fresh_schema()
    user = await AuthService.register("tester", "password123")
    repository = SqlChatRepository(user.id)
    yield repository
    await dispose_engine()


@pytest.fixture
def client():
    """A TestClient bound to a freshly built app (schema created via lifespan)."""
    from fastapi.testclient import TestClient

    from core.db import reset_engine_for_tests
    from core.rag.store import reset_vector_store_for_tests

    reset_engine_for_tests()
    reset_vector_store_for_tests()
    if os.path.exists(_TEST_DB):
        os.remove(_TEST_DB)

    from main import create_app

    with TestClient(create_app()) as test_client:
        yield test_client


@pytest.fixture
def auth_client(client):
    """A TestClient with a registered + logged-in user.

    Returns (client, csrf_headers). Cookies persist on the client; CSRF header
    must be sent on mutating requests.
    """
    resp = client.post(
        "/auth/register",
        json={
            "username": "alice",
            "password": "password123",
            "registration_code": TEST_REGISTRATION_CODE,
        },
    )
    assert resp.status_code == 200, resp.text
    csrf = resp.json()["csrf_token"]
    return client, {"X-CSRF-Token": csrf}
