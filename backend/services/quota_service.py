# backend/services/quota_service.py
"""Per-user request quota enforcement (PH15, D-10; windows refined in PH17).

Limits are request counts read from the append-only ``usage_events`` table. A
Compare request counts as one request, same as a Single request. Admins and
accounts with NULL limits are unlimited and bypass enforcement entirely (which
also suppresses the FE "limited" banner).

Two windows:
- **Minute** — a **fixed** 60s window that opens with the first request and
  resets *fully* at the 60s mark (PH18/6, D-13): the remaining count jumps back
  to the full limit at once, not slot-by-slot. The window is reconstructed from
  raw event timestamps so enforcement and the FE countdown read the same window.
- **Day** — the calendar day in Europe/Warsaw, resetting at 00:00 Polish time
  (DST-aware via ``zoneinfo``), not a rolling 24h (NQ3).
"""

import math
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from core.errors import RateLimitError
from db.models import User
from memory.usage_repository import UsageRepository

QUOTA_EXCEEDED_CODE = "quota_exceeded"

# The per-minute window length (NQ2).
MINUTE_WINDOW_SECONDS = 60

# Day boundary timezone (NQ3): the daily quota resets at 00:00 Polish time.
WARSAW = ZoneInfo("Europe/Warsaw")


def _ensure_utc(value: datetime) -> datetime:
    """Normalize a (possibly naive) stored timestamp to aware UTC.

    SQLite returns naive datetimes; our writes are UTC, so attach UTC when the
    tzinfo is missing to make arithmetic with ``datetime.now(UTC)`` safe."""
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _day_start_utc(now: datetime) -> datetime:
    """UTC instant of the most recent 00:00 Europe/Warsaw on or before ``now``."""
    start_warsaw = now.astimezone(WARSAW).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return start_warsaw.astimezone(UTC)


def _next_day_reset_utc(now: datetime) -> datetime:
    """UTC instant of the next 00:00 Europe/Warsaw after ``now``."""
    start_warsaw = now.astimezone(WARSAW).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return (start_warsaw + timedelta(days=1)).astimezone(UTC)


async def _minute_window(
    repo: UsageRepository, now: datetime
) -> tuple[int, datetime | None]:
    """Reconstruct the current **fixed** per-minute window (PH18/6, D-13).

    Returns ``(used, window_end)`` for the active window, or ``(0, None)`` when
    no window is currently open. A window opens with its first request and lasts
    ``MINUTE_WINDOW_SECONDS``; requests within it count, and at ``window_end`` the
    count resets fully to the limit (not slot-by-slot).

    A 2x-window lookback is sufficient: enforcement blocks once the limit is hit,
    so the next *recorded* request only lands after the prior window elapsed —
    successful events never chain windows past one boundary.
    """
    window = timedelta(seconds=MINUTE_WINDOW_SECONDS)
    timestamps = await repo.timestamps_since(now - 2 * window)

    window_end: datetime | None = None
    used = 0
    for raw in timestamps:
        ts = _ensure_utc(raw)
        if window_end is None or ts >= window_end:
            window_end = ts + window
            used = 1
        else:
            used += 1

    if window_end is not None and now < window_end:
        return used, window_end
    return 0, None


class QuotaService:
    @staticmethod
    async def check(user: User) -> None:
        """Raise ``429 quota_exceeded`` when the user is over a limit window."""
        per_minute = user.max_requests_per_minute
        per_day = user.max_requests_per_day

        # Admins and unlimited accounts (NULL limits) are not enforced (D-10).
        if user.is_admin or (per_minute is None and per_day is None):
            return

        repo = UsageRepository(user.id)
        now = datetime.now(UTC)

        if per_minute is not None:
            used, _ = await _minute_window(repo, now)
            if used >= per_minute:
                raise RateLimitError(
                    f"Per-minute request quota exceeded ({per_minute}/min)",
                    code=QUOTA_EXCEEDED_CODE,
                )

        if per_day is not None:
            # Calendar day in Europe/Warsaw — same window the FE displays (NQ3).
            used = await repo.count_since(_day_start_utc(now))
            if used >= per_day:
                raise RateLimitError(
                    f"Daily request quota exceeded ({per_day}/day)",
                    code=QUOTA_EXCEEDED_CODE,
                )

    @staticmethod
    async def usage_snapshot(user: User) -> dict:
        """Current usage for the FE banner / admin view (D-10, PH17).

        Windows match enforcement exactly. ``*_today``/``*_minute`` remaining and
        reset fields are None for the corresponding unlimited dimension (admins /
        NULL limit), so the FE simply omits that row.
        """
        repo = UsageRepository(user.id)
        now = datetime.now(UTC)

        per_minute = user.max_requests_per_minute
        per_day = user.max_requests_per_day
        minute_unlimited = user.is_admin or per_minute is None
        day_unlimited = user.is_admin or per_day is None

        # Fixed window (D-13): used + the instant it resets fully to the limit.
        used_this_minute, minute_window_end = await _minute_window(repo, now)

        day_start = _day_start_utc(now)
        used_today = await repo.count_since(day_start)

        remaining_today = None if day_unlimited else max(0, per_day - used_today)
        remaining_this_minute = (
            None if minute_unlimited else max(0, per_minute - used_this_minute)
        )

        # Countdown until the window resets fully (D-13); shown only when the
        # minute is limited and a window is currently open.
        minute_resets_in_seconds: int | None = None
        if not minute_unlimited and minute_window_end is not None:
            remaining_seconds = (minute_window_end - now).total_seconds()
            minute_resets_in_seconds = max(0, math.ceil(remaining_seconds))

        day_resets_at = None if day_unlimited else _next_day_reset_utc(now).isoformat()

        return {
            "used_this_minute": used_this_minute,
            "used_today": used_today,
            "remaining_today": remaining_today,
            "remaining_this_minute": remaining_this_minute,
            "minute_resets_in_seconds": minute_resets_in_seconds,
            "day_resets_at": day_resets_at,
        }
