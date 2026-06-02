# backend/routes/chats.py
"""Saved Compare chats CRUD (PH9). All endpoints are per-user isolated;
mutations require CSRF. Single mode stays ephemeral (D-3)."""

from typing import Literal

from fastapi import APIRouter, Depends, Query

from core.auth import current_user, require_csrf
from core.logging import get_logger, log_event
from db.models import User
from memory.chats_repository import SavedChatRepository
from schemas.chats import (
    ChatCreateRequest,
    ChatDetail,
    ChatListResponse,
    ChatRenameRequest,
    ChatSummary,
)
from schemas.common import MessageResponse

router = APIRouter(prefix="/chats", tags=["chats"])

logger = get_logger("chats")


@router.get("", response_model=ChatListResponse)
async def list_chats(
    user: User = Depends(current_user),
    mode: Literal["single", "compare"] | None = Query(default=None),
):
    # PH24: the history lists are mode-aware (Single vs Compare); omitting `mode`
    # returns all chats (back-compatible).
    chats = await SavedChatRepository(user.id).list_chats(mode=mode)
    return ChatListResponse(chats=chats)


@router.post(
    "",
    response_model=ChatDetail,
    dependencies=[Depends(require_csrf)],
)
async def create_chat(payload: ChatCreateRequest, user: User = Depends(current_user)):
    chat = await SavedChatRepository(user.id).create_chat(
        payload.title, mode=payload.mode, model=payload.model
    )
    log_event(
        logger, "chat_created", user_id=user.id, chat_id=chat["id"], mode=payload.mode
    )
    return ChatDetail(**chat)


@router.get("/{chat_id}", response_model=ChatDetail)
async def get_chat(chat_id: int, user: User = Depends(current_user)):
    chat = await SavedChatRepository(user.id).get_chat(chat_id)
    return ChatDetail(**chat)


@router.patch(
    "/{chat_id}",
    response_model=ChatSummary,
    dependencies=[Depends(require_csrf)],
)
async def rename_chat(
    chat_id: int,
    payload: ChatRenameRequest,
    user: User = Depends(current_user),
):
    chat = await SavedChatRepository(user.id).rename_chat(chat_id, payload.title)
    return ChatSummary(**chat)


@router.delete(
    "/{chat_id}",
    response_model=MessageResponse,
    dependencies=[Depends(require_csrf)],
)
async def delete_chat(chat_id: int, user: User = Depends(current_user)):
    await SavedChatRepository(user.id).delete_chat(chat_id)
    log_event(logger, "chat_deleted", user_id=user.id, chat_id=chat_id)
    return MessageResponse(message="Chat deleted")
