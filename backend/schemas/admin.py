# backend/schemas/admin.py
"""Admin API contracts (PH15, D-10). All endpoints are admin-gated."""

from datetime import datetime

from pydantic import BaseModel


class AdminUserSummary(BaseModel):
    """A user row for the admin table: identity, quotas and current usage.

    Limits are null for unlimited accounts (admins); ``remaining_today`` is null
    when unlimited."""

    id: int
    username: str
    is_admin: bool
    max_requests_per_minute: int | None
    max_requests_per_day: int | None
    used_this_minute: int
    used_today: int
    remaining_today: int | None
    created_at: datetime


class AdminUserList(BaseModel):
    users: list[AdminUserSummary]


class UsageEventOut(BaseModel):
    id: int
    created_at: datetime
    mode: str
    message: str
    selected_model: str | None
    # PH32 (D-22): the REAL model that answered/won this turn (``selected_model``
    # stays the slot). NULL for legacy rows → the FE falls back to the slot label.
    model_name: str | None = None
    total_tokens: int | None
    success: bool


class AdminUserUsage(BaseModel):
    """One user's audit detail: limits/usage summary + recent events + totals."""

    user: AdminUserSummary
    events: list[UsageEventOut]
    total_requests: int
    total_tokens: int


class CreateUserRequest(BaseModel):
    username: str
    password: str
    is_admin: bool = False
    # Unset → config defaults for non-admins (admins are always unlimited).
    max_requests_per_minute: int | None = None
    max_requests_per_day: int | None = None


class UpdateUserRequest(BaseModel):
    """PATCH limits / admin flag. Only fields present in the request are applied
    (a sent ``null`` limit means unlimited; an absent field is left unchanged)."""

    is_admin: bool | None = None
    max_requests_per_minute: int | None = None
    max_requests_per_day: int | None = None
