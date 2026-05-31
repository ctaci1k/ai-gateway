# backend/schemas/auth.py

from pydantic import BaseModel


class RegisterRequest(BaseModel):
    username: str
    password: str
    # Required gate: registration is refused without the configured code (D-10).
    registration_code: str = ""


class LoginRequest(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str


class MeResponse(BaseModel):
    """/auth/me payload: identity + admin flag + quota state (PH15, D-10; PH17).

    Limits are NULL for unlimited accounts (admins). Per-dimension ``remaining_*``
    and reset fields are null when that dimension is unlimited; the FE shows the
    minute/day banner row only when the corresponding limit is set. The minute
    window opens with the first request and ``minute_resets_in_seconds`` counts
    down to its reset; the day resets at 00:00 Europe/Warsaw (``day_resets_at``,
    ISO-8601 UTC)."""

    id: int
    username: str
    is_admin: bool
    max_requests_per_minute: int | None
    max_requests_per_day: int | None
    used_this_minute: int
    used_today: int
    remaining_today: int | None
    remaining_this_minute: int | None
    minute_resets_in_seconds: int | None
    day_resets_at: str | None


class AuthResponse(BaseModel):
    user: UserResponse
    csrf_token: str
