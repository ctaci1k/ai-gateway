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
    """/auth/me payload: identity + admin flag + quota state (PH15, D-10).

    Limits are NULL for unlimited accounts (admins). ``remaining_today`` is null
    when unlimited; the FE shows the "limited account" banner only when limits
    are set."""

    id: int
    username: str
    is_admin: bool
    max_requests_per_minute: int | None
    max_requests_per_day: int | None
    used_this_minute: int
    used_today: int
    remaining_today: int | None


class AuthResponse(BaseModel):
    user: UserResponse
    csrf_token: str
