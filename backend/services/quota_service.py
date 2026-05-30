# backend/services/quota_service.py
"""Per-user request quota enforcement (PH15, D-10).

Limits are request counts over rolling windows (per-minute / per-day) read from
the append-only ``usage_events`` table. A Compare request counts as one request,
same as a Single request. Admins and accounts with NULL limits are unlimited and
bypass enforcement entirely (which also suppresses the FE "limited" banner).
"""

from datetime import UTC, datetime, timedelta

from fastapi import Depends

from core.auth import current_user
from core.errors import RateLimitError
from db.models import User
from memory.usage_repository import UsageRepository

QUOTA_EXCEEDED_CODE = "quota_exceeded"


class QuotaService:
    @staticmethod
    async def check(user: User) -> None:
        """Raise ``429 quota_exceeded`` when the user is over a rolling limit."""
        per_minute = user.max_requests_per_minute
        per_day = user.max_requests_per_day

        # Admins and unlimited accounts (NULL limits) are not enforced (D-10).
        if user.is_admin or (per_minute is None and per_day is None):
            return

        repo = UsageRepository(user.id)
        now = datetime.now(UTC)

        if per_minute is not None:
            used = await repo.count_since(now - timedelta(minutes=1))
            if used >= per_minute:
                raise RateLimitError(
                    f"Per-minute request quota exceeded ({per_minute}/min)",
                    code=QUOTA_EXCEEDED_CODE,
                )

        if per_day is not None:
            used = await repo.count_since(now - timedelta(days=1))
            if used >= per_day:
                raise RateLimitError(
                    f"Daily request quota exceeded ({per_day}/day)",
                    code=QUOTA_EXCEEDED_CODE,
                )

    @staticmethod
    async def usage_snapshot(user: User) -> dict:
        """Current rolling-window usage for the FE banner / admin view (D-10).

        Windows match enforcement (last minute / last 24h). ``remaining_today``
        is None for unlimited accounts (admins / NULL day-limit)."""
        repo = UsageRepository(user.id)
        now = datetime.now(UTC)
        used_this_minute = await repo.count_since(now - timedelta(minutes=1))
        used_today = await repo.count_since(now - timedelta(days=1))

        per_day = user.max_requests_per_day
        remaining_today = (
            None if (user.is_admin or per_day is None) else max(0, per_day - used_today)
        )
        return {
            "used_this_minute": used_this_minute,
            "used_today": used_today,
            "remaining_today": remaining_today,
        }


async def enforce_quota(user: User = Depends(current_user)) -> None:
    """FastAPI dependency: gate a request on the caller's quota."""
    await QuotaService.check(user)
