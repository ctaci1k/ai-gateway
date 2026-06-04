# backend/core/rag/store.py
"""ChromaDB vector store wrapper (PH10).

Holds chunk texts + embeddings tagged with ``user_id`` / ``document_id`` for
per-user isolation. Embeddings are always supplied explicitly (we never invoke
Chroma's default embedding function), so no model download is required.

Set ``CHROMA_PATH=:memory:`` for an ephemeral (in-process) store — used by tests.
"""

from typing import Any

import chromadb

from core.config import get_settings

_COLLECTION = "rag_chunks"

_client: Any = None
_collection: Any = None


def _get_collection():
    global _client, _collection
    if _client is None:
        path = get_settings().chroma_path
        if path == ":memory:":
            _client = chromadb.EphemeralClient()
        else:
            _client = chromadb.PersistentClient(path=path)
    if _collection is None:
        _collection = _client.get_or_create_collection(
            name=_COLLECTION,
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def _chunk_id(user_id: int, document_id: int, index: int) -> str:
    return f"{user_id}:{document_id}:{index}"


def add_chunks(
    user_id: int,
    document_id: int,
    filename: str,
    chunks: list[str],
    embeddings: list[list[float]],
) -> None:
    if not chunks:
        return
    collection = _get_collection()
    collection.add(
        ids=[_chunk_id(user_id, document_id, i) for i in range(len(chunks))],
        embeddings=embeddings,
        documents=chunks,
        metadatas=[
            {
                "user_id": user_id,
                "document_id": document_id,
                "filename": filename,
                "chunk_index": i,
            }
            for i in range(len(chunks))
        ],
    )


def query(user_id: int, embedding: list[float], top_k: int) -> list[dict[str, Any]]:
    collection = _get_collection()
    result = collection.query(
        query_embeddings=[embedding],
        n_results=top_k,
        where={"user_id": user_id},
    )
    docs = (result.get("documents") or [[]])[0]
    metas = (result.get("metadatas") or [[]])[0]
    dists = (result.get("distances") or [[]])[0]

    sources: list[dict[str, Any]] = []
    for text, meta, dist in zip(docs, metas, dists, strict=False):
        sources.append(
            {
                "document_id": meta.get("document_id"),
                "filename": meta.get("filename"),
                "chunk_index": meta.get("chunk_index"),
                "text": text,
                # cosine distance → similarity in [0, 1] (clamped).
                "score": round(max(0.0, 1.0 - float(dist)), 4),
            }
        )
    return sources


def delete_document(user_id: int, document_id: int) -> None:
    collection = _get_collection()
    collection.delete(
        where={"$and": [{"user_id": user_id}, {"document_id": document_id}]}
    )


def delete_user(user_id: int) -> None:
    """Purge every chunk embedding belonging to a user (account deletion, PH34).

    The relational ``Document`` rows are removed by the user's FK cascade; this
    drops the matching vectors so the store doesn't keep orphaned embeddings."""
    collection = _get_collection()
    collection.delete(where={"user_id": user_id})


def reset_vector_store_for_tests() -> None:
    """Drop the collection so each test starts empty.

    Chroma caches a shared system per settings, so simply recreating the client
    would reuse stale in-memory data; deleting the collection by name guarantees
    a fresh, empty store.
    """
    global _collection
    if _client is not None:
        try:
            _client.delete_collection(_COLLECTION)
        except Exception:
            pass
    _collection = None
