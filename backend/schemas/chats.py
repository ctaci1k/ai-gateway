# backend/schemas/chats.py
"""Request/response models for saved Compare chats (PH9)."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ChatCreateRequest(BaseModel):
    title: str | None = Field(default=None, max_length=255)


class ChatRenameRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)


class ChatMessageOut(BaseModel):
    id: int
    created_at: datetime
    payload: dict[str, Any]


class ChatSummary(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int


class ChatDetail(ChatSummary):
    messages: list[ChatMessageOut]


class ChatListResponse(BaseModel):
    chats: list[ChatSummary]
