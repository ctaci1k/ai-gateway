# backend/tests/test_chat_stream.py
"""Single-mode streaming (PH13): rolling-history persistence (B3) and the
Single+RAG path with a terminal sources event (C3). Providers and embeddings
are faked so tests stay hermetic."""

import json

from services import rag_service
from services.provider_service import ProviderService
from tests.test_rag import FakeEmbeddingClient


def _fake_stream_factory(chunks):
    async def _fake_generate_stream(message, provider_name="groq"):
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
        json={"message": "hi", "provider": "cerebras"},
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
    assert record["selected_model"] == "cerebras"
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


def test_single_stream_rag_emits_sources(auth_client, monkeypatch):
    client, headers = auth_client
    monkeypatch.setattr(rag_service, "embedding_client", lambda: FakeEmbeddingClient())
    captured = {}

    async def _fake_generate_stream(message, provider_name="groq"):
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
