# backend/services/auth_service.py
"""User registration, authentication and server-side session management."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select

from core.config import get_settings
from core.errors import ConflictError, ValidationError
from core.security import generate_token, hash_password, verify_password
from db.models import Preference, Session, User
from memory import preferences_logic

MIN_USERNAME_LEN = 3
MIN_PASSWORD_LEN = 8


def _utcnow() -> datetime:
    # Naive UTC to match the TIMESTAMP WITHOUT TIME ZONE columns (sessions.
    # expires_at). asyncpg/Postgres rejects tz-aware values for them; SQLite
    # tolerated it, which hid the mismatch in tests.
    return datetime.now(UTC).replace(tzinfo=None)


class AuthService:
    @staticmethod
    async def create_account(
        username: str,
        password: str,
        *,
        is_admin: bool = False,
        max_requests_per_minute: int | None = None,
        max_requests_per_day: int | None = None,
    ) -> User:
        """Create a user with explicit admin flag and quotas (PH15, D-10).

        Used both by self-registration (``register``, which computes the flag /
        quotas from settings) and by admin account creation (explicit values).
        """
        username = (username or "").strip()
        if len(username) < MIN_USERNAME_LEN:
            raise ValidationError(
                f"Username must be at least {MIN_USERNAME_LEN} characters"
            )
        if len(password or "") < MIN_PASSWORD_LEN:
            raise ValidationError(
                f"Password must be at least {MIN_PASSWORD_LEN} characters"
            )

        from core.db import session_scope

        async with session_scope() as session:
            existing = await session.scalar(
                select(User).where(User.username == username)
            )
            if existing is not None:
                raise ConflictError("Username already taken")

            user = User(
                username=username,
                password_hash=hash_password(password),
                is_admin=is_admin,
                max_requests_per_minute=max_requests_per_minute,
                max_requests_per_day=max_requests_per_day,
            )
            session.add(user)
            await session.flush()
            session.add(
                Preference(
                    user_id=user.id, data=preferences_logic.default_preferences()
                )
            )
            await session.flush()
            # Detach-safe primitive snapshot is enough for callers.
            await session.refresh(user)
            return user

    @staticmethod
    async def register(username: str, password: str) -> User:
        settings = get_settings()
        # The configured admin account gets the admin flag and is unlimited
        # (NULL/NULL); everyone else gets the default per-user quotas (D-10).
        is_admin = (
            username or ""
        ).strip().lower() == settings.admin_username.strip().lower()
        return await AuthService.create_account(
            username,
            password,
            is_admin=is_admin,
            max_requests_per_minute=(
                None if is_admin else settings.default_max_requests_per_minute
            ),
            max_requests_per_day=(
                None if is_admin else settings.default_max_requests_per_day
            ),
        )

    @staticmethod
    async def authenticate(username: str, password: str) -> User | None:
        from core.db import session_scope

        async with session_scope() as session:
            user = await session.scalar(
                select(User).where(User.username == (username or "").strip())
            )
            if user is None or not verify_password(password, user.password_hash):
                return None
            await session.refresh(user)
            return user

    @staticmethod
    async def create_session(user_id: int) -> str:
        from core.db import session_scope

        token = generate_token()
        ttl = get_settings().session_ttl_hours
        async with session_scope() as session:
            session.add(
                Session(
                    id=token,
                    user_id=user_id,
                    expires_at=_utcnow() + timedelta(hours=ttl),
                )
            )
        return token

    @staticmethod
    async def get_user_for_session(token: str | None) -> User | None:
        if not token:
            return None

        from core.db import session_scope

        async with session_scope() as session:
            row = await session.get(Session, token)
            if row is None:
                return None
            expires = row.expires_at
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=UTC)
            if expires < _utcnow():
                await session.delete(row)
                return None
            user = await session.get(User, row.user_id)
            return user

    @staticmethod
    async def delete_session(token: str | None) -> None:
        if not token:
            return

        from core.db import session_scope

        async with session_scope() as session:
            await session.execute(delete(Session).where(Session.id == token))
