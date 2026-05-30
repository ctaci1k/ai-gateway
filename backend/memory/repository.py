# backend/memory/repository.py
"""Async repository seam for chat/personalization state.

Repositories are scoped to a single user (per-user isolation, PH8). Routers
resolve the current user and build a repository for that user's id.
"""

from abc import ABC, abstractmethod
from typing import Any


class ChatRepository(ABC):
    @abstractmethod
    async def add_message(self, **kwargs) -> None: ...

    @abstractmethod
    async def get_messages(self) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def track_manual_selection(
        self, selected_model: str, selector_model: str | None = None
    ) -> None: ...

    @abstractmethod
    async def get_personalization_profile(self) -> dict[str, Any]: ...

    @abstractmethod
    async def get_user_preferences(self) -> dict[str, Any]: ...

    @abstractmethod
    async def to_json(self) -> str: ...

    @abstractmethod
    async def clear(self) -> None: ...


def get_chat_repository(user_id: int) -> ChatRepository:
    """Build a repository scoped to ``user_id``."""
    from memory.sql_repository import SqlChatRepository

    return SqlChatRepository(user_id)
