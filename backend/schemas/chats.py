# backend/schemas/chats.py
"""Request/response models for saved chats (PH9 / PH24).

PH24 (D-17): chats now carry a ``mode`` ("single"|"compare") and, for Single
chats, the ``model`` slot they are bound to (fixed at creation)."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

ChatMode = Literal["single", "compare"]


class ChatCreateRequest(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    # Defaults to "compare" so existing callers are unchanged (D-17).
    mode: ChatMode = "compare"
    # The responder slot for a Single chat (fixed at creation); ignored for Compare.
    model: str | None = Field(default=None, max_length=64)


class ChatRenameRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)


class ChatMessageOut(BaseModel):
    id: int
    created_at: datetime
    payload: dict[str, Any]


class ChatSummary(BaseModel):
    id: int
    title: str
    mode: ChatMode
    model: str | None
    created_at: datetime
    updated_at: datetime
    message_count: int


class ChatDetail(ChatSummary):
    messages: list[ChatMessageOut]


class ChatListResponse(BaseModel):
    chats: list[ChatSummary]
