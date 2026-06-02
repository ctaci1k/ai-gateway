# backend/schemas/reports.py
"""Usage Reports API contracts (PH27, D-18).

Per-user, read-only aggregations over the ``usage_events`` ledger. Datetimes are
serialized as naive UTC ISO strings (no ``Z``), matching the rest of the API; the
FE appends ``Z`` when parsing (utils/relativeTime::parseUtc, PH25).
"""

from datetime import datetime

from pydantic import BaseModel


class ReportSummary(BaseModel):
    """Headline KPIs for the Overview tab."""

    total_requests: int
    total_tokens: int
    # True when any counted token figure in the window is an estimate (the UI
    # marks totals with "~" / an "estimate" badge).
    tokens_estimated: bool
    by_mode: dict[str, int]
    # {"billable": n, "own_key": n} — app-quota turns vs BYOK turns.
    billable_vs_own: dict[str, int]
    distinct_chats: int
    success_rate: float
    first_event: datetime | None
    last_event: datetime | None


class ModelUsage(BaseModel):
    model: str | None
    requests: int
    total_tokens: int
    successful: int


class ByModelResponse(BaseModel):
    models: list[ModelUsage]


class ChatUsage(BaseModel):
    # None = the deleted/ad-hoc bucket (chat removed → chat_id SET NULL, or no
    # chat was active for the turn).
    chat_id: int | None
    title: str | None
    mode: str | None
    model: str | None
    requests: int
    total_tokens: int
    last_event: datetime | None


class ByChatResponse(BaseModel):
    chats: list[ChatUsage]


class TimeseriesPoint(BaseModel):
    bucket: datetime
    requests: int
    tokens: int


class TimeseriesResponse(BaseModel):
    bucket: str  # "day" | "hour"
    points: list[TimeseriesPoint]


class UsageEventDetail(BaseModel):
    id: int
    created_at: datetime
    mode: str
    model: str | None
    total_tokens: int | None
    token_estimated: bool
    success: bool
    billable: bool
    message: str
    chat_id: int | None
    chat_title: str | None


class EventsResponse(BaseModel):
    events: list[UsageEventDetail]
    # Opaque keyset cursor ("<iso>|<id>") for the next page; null = last page.
    next_cursor: str | None
