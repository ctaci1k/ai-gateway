# backend/schemas/documents.py
"""Response models for RAG document management (PH10)."""

from datetime import datetime

from pydantic import BaseModel


class DocumentSummary(BaseModel):
    id: int
    filename: str
    content_type: str
    chunk_count: int
    created_at: datetime


class DocumentListResponse(BaseModel):
    documents: list[DocumentSummary]
