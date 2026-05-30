# backend/core/rag/embeddings.py
"""Embedding client abstraction (PH10).

The interface is provider-agnostic so the backend (Gemini today) can be swapped
without touching ingest/retrieval. Blocking SDK calls run in worker threads to
keep the event loop free (true-async, PH2).
"""

import asyncio
from abc import ABC, abstractmethod
from functools import lru_cache

import google.generativeai as genai

from core.config import get_settings
from core.errors import ProviderError


class EmbeddingClient(ABC):
    @abstractmethod
    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of chunk texts for storage."""

    @abstractmethod
    async def embed_query(self, text: str) -> list[float]:
        """Embed a single query string for retrieval."""


class GeminiEmbeddingClient(EmbeddingClient):
    def __init__(self, model: str | None = None, api_key: str | None = None):
        settings = get_settings()
        self._model = model or settings.embedding_model
        self._api_key = api_key or settings.gemini_api_key

    def _embed_sync(self, content, task_type: str):
        genai.configure(api_key=self._api_key)
        try:
            result = genai.embed_content(
                model=self._model, content=content, task_type=task_type
            )
        except Exception as error:  # upstream embedding failure → typed 502
            raise ProviderError(f"Embedding request failed: {error}") from error
        return result["embedding"]

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        return await asyncio.to_thread(self._embed_sync, texts, "retrieval_document")

    async def embed_query(self, text: str) -> list[float]:
        return await asyncio.to_thread(self._embed_sync, text, "retrieval_query")


@lru_cache
def get_embedding_client() -> EmbeddingClient:
    return GeminiEmbeddingClient()
