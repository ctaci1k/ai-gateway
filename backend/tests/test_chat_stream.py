# backend/tests/test_chat_stream.py
"""Single-mode streaming (PH13): rolling-history persistence (B3) and the
Single+RAG path with a terminal sources event (C3). Providers and embeddings
are faked so tests stay hermetic."""

import json

from services import rag_service
from services.provider_service import ProviderService
from tests.test_rag import FakeEmbeddingClient


def _fake_stream_factory(chunks):
    async def _fake_generate_stream(
        message, provider_name="groq", provider=None, history=None
    ):
        for chunk in chunks:
            yield {
                "type": "token",
                "content": chunk,
                "provider": provider_name,
                "model": "fake-model",
            }

    return _fake_generate_stream


def _read_events(resp):
    return [json.loads(line) for line in resp.text.splitlines() if line.strip()]


def test_single_stream_persists_to_rolling_history(auth_client, monkeypatch):
    client, headers = auth_client
    monkeypatch.setattr(
        ProviderService,
        "generate_stream",
        staticmethod(_fake_stream_factory(["Hello ", "world"])),
    )

    resp = client.post(
        "/chat/stream",
        json={"message": "hi", "provider": "mistral"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    tokens = [e["content"] for e in _read_events(resp) if e["type"] == "token"]
    assert "".join(tokens) == "Hello world"

    # The turn is now in rolling history...
    memory = client.get("/memory").json()["memory"]
    assert len(memory) == 1
    record = memory[0]
    assert record["user_message"] == "hi"
    assert record["best_response"] == "Hello world"
    assert record["selected_model"] == "mistral"
    assert record["selector_used"] is False
    assert record["compare_mode"] is False

    # ...but Single never creates a saved (Compare) chat.
    assert client.get("/chats").json()["chats"] == []


def test_single_stream_empty_output_not_persisted(auth_client, monkeypatch):
    client, headers = auth_client
    monkeypatch.setattr(
        ProviderService,
        "generate_stream",
        staticmethod(_fake_stream_factory([])),
    )
    resp = client.post(
        "/chat/stream", json={"message": "hi", "provider": "groq"}, headers=headers
    )
    assert resp.status_code == 200
    assert client.get("/memory").json()["memory"] == []


def test_single_stream_error_carries_reason(auth_client, monkeypatch):
    """A provider failure mid-stream is surfaced as a classified error event so
    the UI can show a BYOK-specific message (PH18/8, D-13)."""
    client, headers = auth_client

    async def _failing_stream(
        message, provider_name="groq", provider=None, history=None
    ):
        raise RuntimeError("429 Too Many Requests: rate limit exceeded")
        yield  # pragma: no cover  (makes this an async generator)

    monkeypatch.setattr(
        ProviderService, "generate_stream", staticmethod(_failing_stream)
    )

    resp = client.post(
        "/chat/stream", json={"message": "hi", "provider": "groq"}, headers=headers
    )
    assert resp.status_code == 200, resp.text
    errors = [e for e in _read_events(resp) if e["type"] == "error"]
    assert len(errors) == 1
    assert errors[0]["reason"] == "rate_limited"
    # Nothing persisted on a failed turn.
    assert client.get("/memory").json()["memory"] == []


def test_single_stream_rag_emits_sources(auth_client, monkeypatch):
    client, headers = auth_client
    monkeypatch.setattr(rag_service, "embedding_client", lambda: FakeEmbeddingClient())
    captured = {}

    async def _fake_generate_stream(
        message, provider_name="groq", provider=None, history=None
    ):
        captured["message"] = message
        yield {
            "type": "token",
            "content": "grounded answer",
            "provider": provider_name,
            "model": "fake-model",
        }

    monkeypatch.setattr(
        ProviderService, "generate_stream", staticmethod(_fake_generate_stream)
    )

    client.post(
        "/documents",
        files={
            "file": (
                "p.txt",
                __import__("io").BytesIO(b"penguins live in antarctica and cannot fly"),
                "text/plain",
            )
        },
        headers=headers,
    )

    resp = client.post(
        "/chat/stream",
        json={"message": "penguins", "provider": "groq", "rag_enabled": True},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    events = _read_events(resp)
    sources_events = [e for e in events if e["type"] == "sources"]
    assert len(sources_events) == 1
    assert sources_events[0]["sources"], "expected retrieved sources"
    assert sources_events[0]["sources"][0]["snippet"]
    # Grounding context was injected into the streamed prompt.
    assert "penguins" in captured["message"]
    assert "antarctica" in captured["message"]


def test_clamp_history_keeps_last_turns_and_truncates():
    """_clamp_history keeps only the last N turns and truncates each message to
    the per-message length (P3/PH40)."""
    from core.config import get_settings
    from routes.chat import _HISTORY_MAX_TURNS, _clamp_history
    from schemas.chat_schema import ChatTurn

    assert _clamp_history([]) == []

    max_len = get_settings().max_message_length
    # Build more turns than the cap; each content over the length limit.
    turns = []
    for _ in range(_HISTORY_MAX_TURNS + 5):
        turns.append(ChatTurn(role="user", content="q" * (max_len + 10)))
        turns.append(ChatTurn(role="assistant", content="a" * (max_len + 10)))

    clamped = _clamp_history(turns)

    # Only the last N turns (≈ 2 messages each) survive.
    assert len(clamped) == _HISTORY_MAX_TURNS * 2
    # Every surviving message is truncated to the per-message length.
    assert all(len(m["content"]) == max_len for m in clamped)
    # Order/roles preserved, ending on the most recent assistant turn.
    assert clamped[0]["role"] == "user"
    assert clamped[-1]["role"] == "assistant"
