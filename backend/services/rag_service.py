# backend/services/rag_service.py
"""RAG orchestration (PH10): ingest documents and retrieve grounding context.

Per-user isolation: document metadata lives in the ``documents`` table keyed by
``user_id``; chunk embeddings live in the vector store tagged with the same
``user_id`` and the document id. Embeddings go through an injectable client
(``embedding_client``) so tests stay hermetic.
"""

from typing import Any

from sqlalchemy import func, select

from core.config import get_settings
from core.db import session_scope
from core.errors import ConflictError, NotFoundError, ValidationError
from core.rag import chunking, parser, store
from core.rag.embeddings import EmbeddingClient, get_embedding_client
from db.models import Document


def embedding_client() -> EmbeddingClient:
    """Indirection point so tests can monkeypatch the embedding backend."""
    return get_embedding_client()


def _summary(doc: Document) -> dict[str, Any]:
    return {
        "id": doc.id,
        "filename": doc.filename,
        "content_type": doc.content_type,
        "chunk_count": doc.chunk_count,
        "created_at": doc.created_at,
    }


class RagService:
    @staticmethod
    async def list_documents(user_id: int) -> list[dict[str, Any]]:
        async with session_scope() as session:
            docs = (
                (
                    await session.execute(
                        select(Document)
                        .where(Document.user_id == user_id)
                        .order_by(Document.created_at.desc(), Document.id.desc())
                    )
                )
                .scalars()
                .all()
            )
            return [_summary(d) for d in docs]

    @staticmethod
    async def ingest(
        user_id: int, filename: str, content_type: str, data: bytes
    ) -> dict[str, Any]:
        settings = get_settings()

        if len(data) > settings.rag_max_file_bytes:
            raise ValidationError(
                f"File too large (max {settings.rag_max_file_bytes} bytes)",
                code="file_too_large",
            )

        # Parse + chunk before touching the DB / vector store.
        text = parser.extract_text(filename, content_type, data)
        chunks = chunking.chunk_text(
            text, settings.rag_chunk_size, settings.rag_chunk_overlap
        )
        if not chunks:
            raise ValidationError(
                "No extractable text found in the document", code="no_text"
            )

        embeddings = await embedding_client().embed_documents(chunks)

        async with session_scope() as session:
            count = await session.scalar(
                select(func.count(Document.id)).where(Document.user_id == user_id)
            )
            if count is not None and count >= settings.rag_max_documents:
                raise ConflictError(
                    f"Document limit reached (max {settings.rag_max_documents})"
                )

            doc = Document(
                user_id=user_id,
                filename=filename,
                content_type=content_type or "application/octet-stream",
                chunk_count=len(chunks),
            )
            session.add(doc)
            await session.flush()
            document_id = doc.id
            summary = _summary(doc)

        # Vector writes happen after the row is committed so a failed embed/store
        # never leaves an orphan document row.
        store.add_chunks(user_id, document_id, filename, chunks, embeddings)
        return summary

    @staticmethod
    async def delete_document(user_id: int, document_id: int) -> None:
        async with session_scope() as session:
            doc = await session.get(Document, document_id)
            if doc is None or doc.user_id != user_id:
                raise NotFoundError("Document not found")
            await session.delete(doc)
        store.delete_document(user_id, document_id)

    @staticmethod
    async def retrieve(
        user_id: int, query_text: str, top_k: int | None = None
    ) -> list[dict[str, Any]]:
        if not (query_text or "").strip():
            return []
        k = top_k or get_settings().rag_top_k
        embedding = await embedding_client().embed_query(query_text)
        return store.query(user_id, embedding, k)

    @staticmethod
    def build_context(sources: list[dict[str, Any]]) -> str:
        """Render retrieved chunks into a numbered context block."""
        blocks = []
        for i, source in enumerate(sources, start=1):
            filename = source.get("filename", "document")
            blocks.append(f"[{i}] ({filename})\n{source.get('text', '')}")
        return "\n\n".join(blocks)
