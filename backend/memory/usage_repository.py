# backend/memory/usage_repository.py
"""Append-only repository for usage events (PH15, D-10).

Unlike the rolling ``interactions`` history (trimmed per user), ``usage_events``
is never trimmed: it is the source of truth for quota enforcement (request
counts per minute/day) and the admin audit view, and records spent tokens per
turn. Scoped to a single ``user_id`` (per-user isolation, PH8).
"""

from datetime import UTC, datetime

from sqlalchemy import func, select

from core.db import session_scope
from db.models import UsageEvent


def _naive_utc(value: datetime) -> datetime:
    """Normalize a query bound to naive UTC for the DB layer.

    The ``created_at`` column is TIMESTAMP WITHOUT TIME ZONE. asyncpg (Postgres)
    rejects a tz-aware bound compared against it ("can't subtract offset-naive
    and offset-aware datetimes"); callers in quota_service build tz-aware UTC
    instants (Warsaw day math needs tzinfo), so strip it at this boundary.
    SQLite tolerated the aware value, which hid the mismatch in tests.
    """
    return value.astimezone(UTC).replace(tzinfo=None) if value.tzinfo else value


class UsageRepository:
    def __init__(self, user_id: int):
        self._user_id = user_id

    async def count_since(self, since: datetime) -> int:
        """Number of usage events for this user with ``created_at >= since``.

        Used for window quota enforcement (per-minute / per-day, D-10/PH17).
        """
        since = _naive_utc(since)
        async with session_scope() as session:
            count = await session.scalar(
                select(func.count(UsageEvent.id)).where(
                    UsageEvent.user_id == self._user_id,
                    UsageEvent.created_at >= since,
                )
            )
            return count or 0

    async def timestamps_since(self, since: datetime) -> list[datetime]:
        """This user's event timestamps with ``created_at >= since``, ascending.

        Feeds the fixed per-minute window reconstruction (PH18/6, D-13): the
        window "opens" with the first request and resets *fully* at the 60s mark,
        so the reset point and count are derived by replaying the raw timestamps
        rather than a rolling trailing count.
        """
        since = _naive_utc(since)
        async with session_scope() as session:
            rows = await session.scalars(
                select(UsageEvent.created_at)
                .where(
                    UsageEvent.user_id == self._user_id,
                    UsageEvent.created_at >= since,
                )
                .order_by(UsageEvent.created_at.asc())
            )
            return list(rows)

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
