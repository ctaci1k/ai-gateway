# backend/memory/usage_repository.py
"""Append-only repository for usage events (PH15, D-10).

Unlike the rolling ``interactions`` history (trimmed per user), ``usage_events``
is never trimmed: it is the source of truth for quota enforcement (request
counts per minute/day) and the admin audit view, and records spent tokens per
turn. Scoped to a single ``user_id`` (per-user isolation, PH8).
"""

from datetime import datetime

from sqlalchemy import func, select

from core.db import session_scope
from db.models import UsageEvent


class UsageRepository:
    def __init__(self, user_id: int):
        self._user_id = user_id

    async def count_since(self, since: datetime) -> int:
        """Number of usage events for this user with ``created_at >= since``.

        Used for rolling-window quota enforcement (per-minute / per-day, D-10).
        """
        async with session_scope() as session:
            count = await session.scalar(
                select(func.count(UsageEvent.id)).where(
                    UsageEvent.user_id == self._user_id,
                    UsageEvent.created_at >= since,
                )
            )
            return count or 0

    async def record(
        self,
        *,
        mode: str,
        message: str,
        selected_model: str | None,
        total_tokens: int | None,
        success: bool,
    ) -> None:
        """Append one usage event for the turn (one row per request; a Compare
        request is a single event — D-10)."""
        async with session_scope() as session:
            session.add(
                UsageEvent(
                    user_id=self._user_id,
                    mode=mode,
                    message=message or "",
                    selected_model=selected_model,
                    total_tokens=total_tokens,
                    success=success,
                )
            )
