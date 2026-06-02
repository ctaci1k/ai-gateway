# backend/tests/test_chats.py
"""Saved-chat CRUD, ≤limit enforcement, per-user isolation, and the
Single-stays-ephemeral guarantee (PH9 / D-3)."""

import pytest

from core.config import get_settings
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
        "compare_mode": True,
        "selector_enabled": True,
        "selector_scores": {"groq": 90},
        "selector_metadata": {},
        "selector_reason": None,
        "compare_summary": {},
    }


def _new_chat(client, headers, title="My chat"):
    return client.post("/chats", json={"title": title}, headers=headers)


def test_create_list_get_rename_delete_flow(auth_client):
    client, headers = auth_client

    created = _new_chat(client, headers, "First")
    assert created.status_code == 200, created.text
    chat = created.json()
    chat_id = chat["id"]
    assert chat["title"] == "First"
    assert chat["message_count"] == 0
    assert chat["messages"] == []

    listed = client.get("/chats")
    assert listed.status_code == 200
    assert [c["id"] for c in listed.json()["chats"]] == [chat_id]

    got = client.get(f"/chats/{chat_id}")
    assert got.status_code == 200
    assert got.json()["title"] == "First"

    renamed = client.patch(
        f"/chats/{chat_id}", json={"title": "Renamed"}, headers=headers
    )
    assert renamed.status_code == 200
    assert renamed.json()["title"] == "Renamed"

    deleted = client.delete(f"/chats/{chat_id}", headers=headers)
    assert deleted.status_code == 200
    assert client.get(f"/chats/{chat_id}").status_code == 404
    assert client.get("/chats").json()["chats"] == []


def test_default_title_when_blank(auth_client):
    client, headers = auth_client
    resp = client.post("/chats", json={}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["title"]  # non-empty default


def test_chat_limit_enforced(auth_client):
    client, headers = auth_client
    limit = get_settings().saved_chats_limit
    for i in range(limit):
        assert _new_chat(client, headers, f"chat {i}").status_code == 200
    over = _new_chat(client, headers, "too many")
    assert over.status_code == 409
    assert over.json()["error"]["code"] == "conflict"


def test_mutations_require_csrf(auth_client):
    client, headers = auth_client
    chat_id = _new_chat(client, headers).json()["id"]
    # No CSRF header -> 403.
    assert client.post("/chats", json={"title": "x"}).status_code == 403
    assert client.patch(f"/chats/{chat_id}", json={"title": "x"}).status_code == 403
    assert client.delete(f"/chats/{chat_id}").status_code == 403


def test_endpoints_require_auth(client):
    assert client.get("/chats").status_code == 401


def test_chats_isolated_per_user(client):
    a = client.post(
        "/auth/register",
        json={
            "username": "alice",
            "password": "password123",
            "registration_code": TEST_REGISTRATION_CODE,
        },
    )
    alice_csrf = {"X-CSRF-Token": a.json()["csrf_token"]}
    alice_chat = _new_chat(client, alice_csrf, "alice chat").json()["id"]

    # Switch to a second user (new session cookie overwrites the first).
    b = client.post(
        "/auth/register",
        json={
            "username": "bob",
            "password": "password123",
            "registration_code": TEST_REGISTRATION_CODE,
        },
    )
    bob_csrf = {"X-CSRF-Token": b.json()["csrf_token"]}

    # Bob cannot see or touch Alice's chat.
    assert client.get("/chats").json()["chats"] == []
    assert client.get(f"/chats/{alice_chat}").status_code == 404
    assert (
        client.patch(
            f"/chats/{alice_chat}", json={"title": "hijack"}, headers=bob_csrf
        ).status_code
        == 404
    )
    assert client.delete(f"/chats/{alice_chat}", headers=bob_csrf).status_code == 404


async def test_add_message_persists_and_isolates(repo):
    from core.errors import NotFoundError
    from memory.chats_repository import SavedChatRepository
    from services.auth_service import AuthService

    chats = SavedChatRepository(repo._user_id)
    chat = await chats.create_chat("turn chat")

    await chats.add_message(
        chat["id"],
        {"user_message": "hi", "best_response": "hello", "selected_model": "groq"},
    )
    detail = await chats.get_chat(chat["id"])
    assert detail["message_count"] == 1
    assert detail["messages"][0]["payload"]["user_message"] == "hi"

    # A different user cannot append to this chat.
    other = await AuthService.register("other", "password123")
    with pytest.raises(NotFoundError):
        await SavedChatRepository(other.id).add_message(chat["id"], {"x": 1})


def test_chat_with_chat_id_persists_turn(auth_client, monkeypatch):
    client, headers = auth_client
    monkeypatch.setattr(
        OrchestratorService, "process_chat", staticmethod(_fake_process_chat)
    )
    chat_id = _new_chat(client, headers, "compare chat").json()["id"]

    resp = client.post(
        "/chat",
        json={
            "message": "compare this",
            "providers": ["groq", "cerebras", "sambanova"],
            "compare_mode": True,
            "selector_enabled": True,
            "chat_id": chat_id,
        },
        headers=headers,
    )
    assert resp.status_code == 200, resp.text

    detail = client.get(f"/chats/{chat_id}").json()
    assert detail["message_count"] == 1
    assert detail["messages"][0]["payload"]["user_message"] == "compare this"


def test_chat_with_unknown_chat_id_returns_404(auth_client, monkeypatch):
    client, headers = auth_client
    monkeypatch.setattr(
        OrchestratorService, "process_chat", staticmethod(_fake_process_chat)
    )
    resp = client.post(
        "/chat",
        json={"message": "hi", "provider": "groq", "chat_id": 99999},
        headers=headers,
    )
    assert resp.status_code == 404


async def test_delete_chat_removes_messages_and_no_orphans(repo):
    """PH17/A: deleting a chat removes its messages; a brand-new chat (which
    reuses the freed id on SQLite) starts empty — no inherited messages."""
    from sqlalchemy import func, select

    from core.db import session_scope
    from db.models import ChatMessage
    from memory.chats_repository import SavedChatRepository

    chats = SavedChatRepository(repo._user_id)
    chat = await chats.create_chat("to delete")
    await chats.add_message(chat["id"], {"user_message": "old", "best_response": "x"})

    await chats.delete_chat(chat["id"])

    async with session_scope() as session:
        remaining = await session.scalar(select(func.count(ChatMessage.id)))
    assert remaining == 0, "messages must be deleted with their chat"

    # A new chat reuses the freed id on SQLite; it must not inherit messages.
    fresh = await chats.create_chat("fresh")
    detail = await chats.get_chat(fresh["id"])
    assert detail["message_count"] == 0
    assert detail["messages"] == []


async def test_purge_orphan_chat_messages(repo):
    """PH17/A: the startup cleanup removes messages whose parent chat is gone.

    Fabricate a real orphan the way legacy data got one — delete the parent
    chat row with FK enforcement off (AUTOCOMMIT, no active transaction) so the
    DB-level cascade we now enable can't fire — then verify the purge clears it.
    """
    from sqlalchemy import func, select

    from core.db import get_engine, session_scope
    from db.models import ChatMessage
    from memory.chats_repository import (
        SavedChatRepository,
        purge_orphan_chat_messages,
    )

    chats = SavedChatRepository(repo._user_id)
    chat = await chats.create_chat("orphan source")
    await chats.add_message(chat["id"], {"user_message": "hi", "best_response": "x"})

    engine = get_engine()
    async with engine.connect() as conn:
        autocommit = await conn.execution_options(isolation_level="AUTOCOMMIT")
        await autocommit.exec_driver_sql("PRAGMA foreign_keys=OFF")
        await autocommit.exec_driver_sql(
            "DELETE FROM chats WHERE id = ?", (chat["id"],)
        )

    # The message is now orphaned (parent chat gone, no cascade).
    async with session_scope() as session:
        before = await session.scalar(select(func.count(ChatMessage.id)))
    assert before == 1

    removed = await purge_orphan_chat_messages()
    assert removed == 1
    async with session_scope() as session:
        remaining = await session.scalar(select(func.count(ChatMessage.id)))
    assert remaining == 0


def test_single_stream_does_not_create_chats(auth_client):
    client, headers = auth_client
    client.post(
        "/chat/stream",
        json={"message": "hello", "provider": "groq"},
        headers=headers,
    )
    # Without a chat_id, Single mode never creates a saved chat (D-17 keeps this:
    # a saved Single chat is created explicitly via POST /chats first).
    assert client.get("/chats").json()["chats"] == []


def test_create_single_chat_carries_mode_and_model(auth_client):
    client, headers = auth_client
    resp = client.post(
        "/chats",
        json={"title": "ask groq", "mode": "single", "model": "groq"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["mode"] == "single"
    assert body["model"] == "groq"
    # A Compare chat keeps mode=compare and a null model by default.
    cmp = client.post("/chats", json={"title": "cmp"}, headers=headers).json()
    assert cmp["mode"] == "compare"
    assert cmp["model"] is None


def test_list_chats_mode_filter(auth_client):
    client, headers = auth_client
    client.post(
        "/chats",
        json={"title": "s1", "mode": "single", "model": "groq"},
        headers=headers,
    )
    client.post("/chats", json={"title": "c1", "mode": "compare"}, headers=headers)

    singles = client.get("/chats?mode=single").json()["chats"]
    assert [c["title"] for c in singles] == ["s1"]
    assert singles[0]["model"] == "groq"

    compares = client.get("/chats?mode=compare").json()["chats"]
    assert [c["title"] for c in compares] == ["c1"]

    # No filter → both chats.
    assert len(client.get("/chats").json()["chats"]) == 2


def test_single_stream_persists_into_named_chat(auth_client, monkeypatch):
    """D-17 (PH24): a Single turn is appended to the active saved Single chat,
    mirroring Compare's chat_id persistence."""
    from services.provider_service import ProviderService

    async def _fake_stream(message, provider_name, provider=None):
        yield {"type": "token", "content": "hello ", "model": "m", "provider": "groq"}
        yield {"type": "token", "content": "world", "model": "m", "provider": "groq"}

    monkeypatch.setattr(ProviderService, "generate_stream", staticmethod(_fake_stream))

    chat_id = client_single_chat(auth_client)
    client, headers = auth_client

    resp = client.post(
        "/chat/stream",
        json={"message": "hi there", "provider": "groq", "chat_id": chat_id},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    # Drain the streamed body so the generator's persistence tail runs.
    _ = resp.text

    detail = client.get(f"/chats/{chat_id}").json()
    assert detail["message_count"] == 1
    turn = detail["messages"][0]["payload"]
    assert turn["user_message"] == "hi there"
    assert turn["best_response"] == "hello world"
    assert turn["compare_mode"] is False


def client_single_chat(auth_client) -> int:
    client, headers = auth_client
    return client.post(
        "/chats",
        json={"title": "single", "mode": "single", "model": "groq"},
        headers=headers,
    ).json()["id"]
