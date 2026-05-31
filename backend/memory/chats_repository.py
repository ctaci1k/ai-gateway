# backend/memory/chats_repository.py
"""SQL-backed, per-user repository for saved Compare chats (PH9).

Every chat (and its messages) is isolated to a single ``user_id``; cross-user
access raises ``NotFoundError`` (never leaks existence). A per-user limit
(``settings.saved_chats_limit``) is enforced on creation.
"""

from typing import Any

from sqlalchemy import delete, func, select

from core.config import get_settings
from core.db import session_scope
from core.errors import ConflictError, NotFoundError, ValidationError
from db.models import Chat, ChatMessage, _utcnow

DEFAULT_CHAT_TITLE = "New Chat"
_MAX_TITLE_LEN = 255


def _clean_title(title: str | None) -> str:
    title = (title or "").strip()
    if not title:
        return DEFAULT_CHAT_TITLE
    return title[:_MAX_TITLE_LEN]


def _summary(chat: Chat, message_count: int) -> dict[str, Any]:
    return {
        "id": chat.id,
        "title": chat.title,
        "created_at": chat.created_at,
        "updated_at": chat.updated_at,
        "message_count": message_count,
    }


async def purge_orphan_chat_messages() -> int:
    """Remove ``chat_messages`` whose parent ``Chat`` no longer exists (PH17/A).

    Earlier ``delete_chat`` used a Core bulk-DELETE that skipped the ORM
    ``delete-orphan`` cascade and, on SQLite (FK cascade off by default), left
    orphaned messages behind; SQLite's chat-id reuse then mixed them into a new
    chat. This one-time, idempotent cleanup runs at startup. Returns the number
    of rows removed.
    """
    async with session_scope() as session:
        result = await session.execute(
            delete(ChatMessage).where(ChatMessage.chat_id.not_in(select(Chat.id)))
        )
        return result.rowcount or 0


class SavedChatRepository:
    def __init__(self, user_id: int):
        self._user_id = user_id

    async def _get_owned(self, session, chat_id: int) -> Chat:
        chat = await session.get(Chat, chat_id)
        if chat is None or chat.user_id != self._user_id:
            raise NotFoundError("Chat not found")
        return chat

    async def list_chats(self) -> list[dict[str, Any]]:
        async with session_scope() as session:
            chats = (
                (
                    await session.execute(
                        select(Chat)
                        .where(Chat.user_id == self._user_id)
                        .order_by(Chat.updated_at.desc(), Chat.id.desc())
                    )
                )
                .scalars()
                .all()
            )
            counts = dict(
                (
                    await session.execute(
                        select(ChatMessage.chat_id, func.count(ChatMessage.id))
                        .join(Chat, Chat.id == ChatMessage.chat_id)
                        .where(Chat.user_id == self._user_id)
                        .group_by(ChatMessage.chat_id)
                    )
                ).all()
            )
            return [_summary(c, counts.get(c.id, 0)) for c in chats]

    async def create_chat(self, title: str | None = None) -> dict[str, Any]:
        limit = get_settings().saved_chats_limit
        async with session_scope() as session:
            count = await session.scalar(
                select(func.count(Chat.id)).where(Chat.user_id == self._user_id)
            )
            if count is not None and count >= limit:
                raise ConflictError(f"Saved-chat limit reached (max {limit})")

            chat = Chat(user_id=self._user_id, title=_clean_title(title))
            session.add(chat)
            await session.flush()
            return {**_summary(chat, 0), "messages": []}

    async def get_chat(self, chat_id: int) -> dict[str, Any]:
        async with session_scope() as session:
            chat = await self._get_owned(session, chat_id)
            messages = (
                (
                    await session.execute(
                        select(ChatMessage)
                        .where(ChatMessage.chat_id == chat_id)
                        .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
                    )
                )
                .scalars()
                .all()
            )
            return {
                **_summary(chat, len(messages)),
                "messages": [
                    {
                        "id": m.id,
                        "created_at": m.created_at,
                        "payload": m.payload,
                    }
                    for m in messages
                ],
            }

    async def rename_chat(self, chat_id: int, title: str) -> dict[str, Any]:
        if not (title or "").strip():
            raise ValidationError("Title must not be empty")
        async with session_scope() as session:
            chat = await self._get_owned(session, chat_id)
            chat.title = _clean_title(title)
            await session.flush()
            count = await session.scalar(
                select(func.count(ChatMessage.id)).where(ChatMessage.chat_id == chat_id)
            )
            return _summary(chat, count or 0)

    async def delete_chat(self, chat_id: int) -> None:
        async with session_scope() as session:
            # Confirm ownership first so foreign chats can't be deleted.
            await self._get_owned(session, chat_id)
            # Delete the chat's messages explicitly before the chat itself.
            # A Core bulk-DELETE on Chat does not trigger the ORM
            # ``delete-orphan`` cascade, and SQLite has FK cascade disabled by
            # default, so without this the messages were orphaned — and since
            # SQLite reuses the freed chat id, a brand-new chat would "inherit"
            # them. Deleting children first is robust regardless of cascade.
            await session.execute(
                delete(ChatMessage).where(ChatMessage.chat_id == chat_id)
            )
            await session.execute(delete(Chat).where(Chat.id == chat_id))

    async def add_message(
        self, chat_id: int, payload: dict[str, Any]
    ) -> dict[str, Any]:
        """Append one Compare turn to a chat and bump its updated_at."""
        async with session_scope() as session:
            chat = await self._get_owned(session, chat_id)
            now = _utcnow()
            message = ChatMessage(chat_id=chat.id, payload=payload, created_at=now)
            session.add(message)
            chat.updated_at = now  # bump so the chat sorts to the top of the list
            await session.flush()
            return {
                "id": message.id,
                "created_at": message.created_at,
                "payload": message.payload,
            }
