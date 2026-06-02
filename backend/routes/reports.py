# backend/routes/reports.py
"""Usage Reports API (PH27, D-18): per-user, read-only aggregations over the
``usage_events`` ledger plus a streamed CSV export.

Every endpoint depends on ``current_user`` and is strictly scoped to that user
(``UsageReportRepository(user.id)``) — a user only ever sees their own activity.
Not admin-gated (D-17/p.6: Reports are for everyone). The admin bonus (G) is a
separate admin-gated surface.

Time window: ``from``/``to`` are ISO datetimes (``Z`` tolerated). Omitting
``from`` defaults to the last 30 days; pass an epoch ``from`` (e.g.
``1970-01-01T00:00:00``) for the "all time" range. Omitting ``to`` means "up to
now".
"""

import csv
import io
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from core.auth import current_user
from core.errors import ValidationError
from db.models import User
from memory.usage_report_repository import (
    BUCKET_DAY,
    BUCKET_HOUR,
    DEFAULT_EVENTS_LIMIT,
    UsageReportRepository,
)
from schemas.reports import (
    BreakdownResponse,
    ByChatResponse,
    ByModelResponse,
    EventsResponse,
    ReportSummary,
    TimeseriesResponse,
)

router = APIRouter(prefix="/reports", tags=["reports"])

# Default lookback when no ``from`` is supplied (C2).
_DEFAULT_LOOKBACK = timedelta(days=30)


def _parse_dt(value: str | None) -> datetime | None:
    """Parse an ISO datetime to naive UTC, or None when absent/blank."""
    if not value:
        return None
    text = value.strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError as exc:
        raise ValidationError(f"Invalid datetime: {value!r}") from exc
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(UTC).replace(tzinfo=None)
    return parsed


def _window(from_: str | None, to: str | None) -> tuple[datetime | None, datetime]:
    """Resolve the [start, end) window. Default start = now - 30d; end = now."""
    now = datetime.now(UTC).replace(tzinfo=None)
    end = _parse_dt(to) or now
    start = _parse_dt(from_)
    if from_ is None:
        start = now - _DEFAULT_LOOKBACK
    return start, end


def _access_to_billable(access: str | None) -> bool | None:
    """Map the ``access`` query param to a billable filter (PH28): ``app`` =
    app-key (billable) turns, ``own`` = own-key (BYOK) turns, anything else =
    both."""
    if access == "app":
        return True
    if access == "own":
        return False
    return None


def _parse_cursor(cursor: str | None) -> tuple[datetime, int] | None:
    if not cursor:
        return None
    raw = cursor.rsplit("|", 1)
    if len(raw) != 2:
        raise ValidationError("Invalid cursor")
    ts = _parse_dt(raw[0])
    try:
        event_id = int(raw[1])
    except ValueError as exc:
        raise ValidationError("Invalid cursor") from exc
    if ts is None:
        raise ValidationError("Invalid cursor")
    return ts, event_id


@router.get("/summary", response_model=ReportSummary)
async def reports_summary(
    user: User = Depends(current_user),
    from_: str | None = Query(None, alias="from"),
    to: str | None = Query(None, alias="to"),
    access: str | None = Query(None),
):
    start, end = _window(from_, to)
    billable = _access_to_billable(access)
    return ReportSummary(
        **await UsageReportRepository(user.id).summary(start, end, billable)
    )


@router.get("/by-model", response_model=ByModelResponse)
async def reports_by_model(
    user: User = Depends(current_user),
    from_: str | None = Query(None, alias="from"),
    to: str | None = Query(None, alias="to"),
    access: str | None = Query(None),
):
    start, end = _window(from_, to)
    models = await UsageReportRepository(user.id).by_model(
        start, end, _access_to_billable(access)
    )
    return ByModelResponse(models=models)


@router.get("/by-chat", response_model=ByChatResponse)
async def reports_by_chat(
    user: User = Depends(current_user),
    from_: str | None = Query(None, alias="from"),
    to: str | None = Query(None, alias="to"),
    access: str | None = Query(None),
):
    start, end = _window(from_, to)
    chats = await UsageReportRepository(user.id).by_chat(
        start, end, _access_to_billable(access)
    )
    return ByChatResponse(chats=chats)


@router.get("/timeseries", response_model=TimeseriesResponse)
async def reports_timeseries(
    user: User = Depends(current_user),
    from_: str | None = Query(None, alias="from"),
    to: str | None = Query(None, alias="to"),
    bucket: str = Query(BUCKET_DAY),
    access: str | None = Query(None),
):
    if bucket not in (BUCKET_DAY, BUCKET_HOUR):
        bucket = BUCKET_DAY
    start, end = _window(from_, to)
    points = await UsageReportRepository(user.id).timeseries(
        start, end, bucket, _access_to_billable(access)
    )
    return TimeseriesResponse(bucket=bucket, points=points)


@router.get("/breakdown", response_model=BreakdownResponse)
async def reports_breakdown(
    user: User = Depends(current_user),
    from_: str | None = Query(None, alias="from"),
    to: str | None = Query(None, alias="to"),
    access: str | None = Query(None),
):
    """Nested access-key → model → chats tree for the Breakdown accordion (PH28)."""
    start, end = _window(from_, to)
    groups = await UsageReportRepository(user.id).breakdown(
        start, end, _access_to_billable(access)
    )
    return BreakdownResponse(groups=groups)


@router.get("/events", response_model=EventsResponse)
async def reports_events(
    user: User = Depends(current_user),
    from_: str | None = Query(None, alias="from"),
    to: str | None = Query(None, alias="to"),
    cursor: str | None = Query(None),
    limit: int = Query(DEFAULT_EVENTS_LIMIT, ge=1, le=200),
    access: str | None = Query(None),
):
    start, end = _window(from_, to)
    page = await UsageReportRepository(user.id).events(
        start,
        end,
        cursor=_parse_cursor(cursor),
        limit=limit,
        billable=_access_to_billable(access),
    )
    return EventsResponse(**page)


_CSV_HEADER = [
    "created_at",
    "mode",
    "model",
    "chat_title",
    "billable",
    "total_tokens",
    "token_estimated",
    "success",
    "message",
]


@router.get("/events.csv")
async def reports_events_csv(
    user: User = Depends(current_user),
    from_: str | None = Query(None, alias="from"),
    to: str | None = Query(None, alias="to"),
    access: str | None = Query(None),
):
    """Stream the activity log as CSV (same window + access filter as ``/events``).

    Rows are streamed straight from a keyset-paged DB scan so a large export
    never materializes in memory (C3). The csv module handles quoting/escaping.
    """
    start, end = _window(from_, to)
    billable = _access_to_billable(access)
    repo = UsageReportRepository(user.id)

    async def rows():
        buffer = io.StringIO()
        writer = csv.writer(buffer)

        def flush() -> str:
            value = buffer.getvalue()
            buffer.seek(0)
            buffer.truncate(0)
            return value

        writer.writerow(_CSV_HEADER)
        yield flush()

        async for r in repo.iter_events_for_csv(start, end, billable):
            writer.writerow(
                [
                    r.created_at.isoformat(),
                    r.mode,
                    r.selected_model or "",
                    r.title or "",
                    "true" if r.billable else "false",
                    "" if r.total_tokens is None else r.total_tokens,
                    "true" if r.token_estimated else "false",
                    "true" if r.success else "false",
                    r.message or "",
                ]
            )
            yield flush()

    headers = {"Content-Disposition": 'attachment; filename="usage-report.csv"'}
    return StreamingResponse(rows(), media_type="text/csv", headers=headers)
