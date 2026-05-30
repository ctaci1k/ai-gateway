# backend/tests/test_rag.py
"""RAG (PH10): chunking/parsing units, ingest+retrieve with per-user isolation,
document API, and the rag_enabled path on /chat. Embeddings are faked so tests
stay hermetic (no network, no model download)."""

import io

import pytest

from core.rag import chunking
from core.rag.parser import extract_text
from services import rag_service
from services.orchestrator_service import OrchestratorService

# --- A deterministic, dependency-free embedding (bag-of-tokens over buckets) ---

_DIM = 64


def _fake_embed(text: str) -> list[float]:
    vec = [0.0] * _DIM
    for token in text.lower().split():
        # Stable per-process bucket (sum of char codes — not hash(), which is salted).
        bucket = sum(ord(c) for c in token) % _DIM
        vec[bucket] += 1.0
    if not any(vec):
        vec[0] = 1.0
    return vec


class FakeEmbeddingClient:
    async def embed_documents(self, texts):
        return [_fake_embed(t) for t in texts]

    async def embed_query(self, text):
        return _fake_embed(text)


@pytest.fixture(autouse=True)
def _fake_embeddings(monkeypatch):
    monkeypatch.setattr(rag_service, "embedding_client", lambda: FakeEmbeddingClient())


# --- Pure units -------------------------------------------------------------


def test_chunk_text_splits_with_overlap():
    text = "abcdefghij " * 50  # ~550 chars
    chunks = chunking.chunk_text(text, chunk_size=100, overlap=20)
    assert len(chunks) > 1
    assert all(len(c) <= 120 for c in chunks)


def test_chunk_text_empty():
    assert chunking.chunk_text("", 100, 10) == []


def test_chunk_text_short_single():
    assert chunking.chunk_text("hello world", 1000, 100) == ["hello world"]


def test_parser_txt():
    text = extract_text("notes.txt", "text/plain", b"hello document world")
    assert "hello document world" in text


def test_parser_unsupported_type():
    from core.errors import ValidationError

    with pytest.raises(ValidationError):
        extract_text("image.png", "image/png", b"\x89PNG")


def test_parser_empty():
    from core.errors import ValidationError

    with pytest.raises(ValidationError):
        extract_text("empty.txt", "text/plain", b"")


# --- Service: ingest / retrieve / isolation ---------------------------------


async def test_ingest_and_retrieve(repo):
    user_id = repo._user_id
    summary = await rag_service.RagService.ingest(
        user_id, "fruit.txt", "text/plain", b"bananas are a yellow tropical fruit"
    )
    assert summary["chunk_count"] >= 1

    docs = await rag_service.RagService.list_documents(user_id)
    assert [d["filename"] for d in docs] == ["fruit.txt"]

    sources = await rag_service.RagService.retrieve(user_id, "bananas", top_k=3)
    assert sources
    assert sources[0]["filename"] == "fruit.txt"
    assert "banana" in sources[0]["text"].lower()


async def test_retrieve_ranks_relevant_document_first(repo):
    user_id = repo._user_id
    await rag_service.RagService.ingest(
        user_id, "fruit.txt", "text/plain", b"bananas are a yellow tropical fruit"
    )
    await rag_service.RagService.ingest(
        user_id, "space.txt", "text/plain", b"rockets launch satellites into orbit"
    )
    sources = await rag_service.RagService.retrieve(user_id, "rockets orbit", top_k=1)
    assert sources and sources[0]["filename"] == "space.txt"


async def test_documents_isolated_per_user(repo):
    from core.errors import NotFoundError
    from services.auth_service import AuthService

    user_id = repo._user_id
    doc = await rag_service.RagService.ingest(
        user_id, "secret.txt", "text/plain", b"alpha bravo charlie"
    )

    other = await AuthService.register("other", "password123")
    # Other user sees nothing and cannot retrieve this user's chunks.
    assert await rag_service.RagService.list_documents(other.id) == []
    assert await rag_service.RagService.retrieve(other.id, "alpha", top_k=3) == []

    # Other user cannot delete this user's document.
    with pytest.raises(NotFoundError):
        await rag_service.RagService.delete_document(other.id, doc["id"])


async def test_delete_document_removes_chunks(repo):
    user_id = repo._user_id
    doc = await rag_service.RagService.ingest(
        user_id, "d.txt", "text/plain", b"delta echo foxtrot"
    )
    await rag_service.RagService.delete_document(user_id, doc["id"])
    assert await rag_service.RagService.list_documents(user_id) == []
    assert await rag_service.RagService.retrieve(user_id, "delta", top_k=3) == []


# --- API --------------------------------------------------------------------


def _upload(client, headers, name="notes.txt", data=b"hello world", ctype="text/plain"):
    return client.post(
        "/documents",
        files={"file": (name, io.BytesIO(data), ctype)},
        headers=headers,
    )


def test_document_endpoints_require_auth(client):
    assert client.get("/documents").status_code == 401


def test_upload_requires_csrf(auth_client):
    client, _headers = auth_client
    resp = client.post(
        "/documents", files={"file": ("a.txt", io.BytesIO(b"hi there"), "text/plain")}
    )
    assert resp.status_code == 403


def test_upload_list_delete_flow(auth_client):
    client, headers = auth_client
    up = _upload(client, headers, data=b"the quick brown fox jumps")
    assert up.status_code == 200, up.text
    doc_id = up.json()["id"]
    assert up.json()["chunk_count"] >= 1

    listed = client.get("/documents")
    assert [d["id"] for d in listed.json()["documents"]] == [doc_id]

    deleted = client.delete(f"/documents/{doc_id}", headers=headers)
    assert deleted.status_code == 200
    assert client.get("/documents").json()["documents"] == []


def test_upload_unsupported_type_rejected(auth_client):
    client, headers = auth_client
    resp = _upload(client, headers, name="x.png", data=b"\x89PNG", ctype="image/png")
    assert resp.status_code == 400
    # PH13: distinct code so the UI can localize the exact reason.
    assert resp.json()["error"]["code"] == "unsupported_type"


def test_upload_empty_file_rejected(auth_client):
    client, headers = auth_client
    resp = _upload(client, headers, name="empty.txt", data=b"", ctype="text/plain")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "empty_file"


def test_chat_rag_enabled_returns_sources(auth_client, monkeypatch):
    client, headers = auth_client
    captured = {}

    async def _fake_process_chat(**kwargs):
        captured.update(kwargs)
        resp = {
            "response": "grounded",
            "model": "m",
            "execution_time": 1.0,
            "provider": "groq",
            "success": True,
        }
        return {
            "best_response": "grounded",
            "selected_model": "groq",
            "selected_model_data": resp,
            "all_responses": {"groq": resp},
            "failed_providers": [],
            "execution_metadata": [],
            "execution_summary": {},
            "compare_mode": False,
            "selector_enabled": False,
            "selector_scores": {},
            "selector_metadata": {},
            "selector_reason": None,
            "compare_summary": {},
        }

    monkeypatch.setattr(
        OrchestratorService, "process_chat", staticmethod(_fake_process_chat)
    )

    _upload(client, headers, data=b"penguins live in antarctica and cannot fly")

    resp = client.post(
        "/chat",
        json={"message": "penguins", "provider": "groq", "rag_enabled": True},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["rag_enabled"] is True
    assert body["rag_sources"], "expected retrieved sources"
    assert body["rag_sources"][0]["snippet"]
    # The orchestrator received the grounding context.
    assert captured.get("rag_context")
