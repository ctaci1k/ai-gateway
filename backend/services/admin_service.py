# backend/services/admin_service.py
"""Admin operations over users and their usage audit (PH15, D-10).

Reads the append-only ``usage_events`` table for the per-user audit/usage view
and manages accounts (create with explicit quotas, update limits / admin flag).
"""

from typing import Any

from sqlalchemy import func, select

from core.config import get_settings
from core.db import session_scope
from core.errors import NotFoundError
from db.models import UsageEvent, User
from services.auth_service import AuthService
from services.quota_service import QuotaService

# Cap the per-user audit detail so a heavy account can't return an unbounded list.
_MAX_USAGE_EVENTS = 500


class AdminService:
    @staticmethod
    async def _summary(user: User) -> dict[str, Any]:
        snapshot = await QuotaService.usage_snapshot(user)
        return {
            "id": user.id,
            "username": user.username,
            "is_admin": user.is_admin,
            "max_requests_per_minute": user.max_requests_per_minute,
            "max_requests_per_day": user.max_requests_per_day,
            "created_at": user.created_at,
            **snapshot,
        }

    @staticmethod
    async def list_users() -> list[dict[str, Any]]:
        async with session_scope() as session:
            users = (
                (await session.execute(select(User).order_by(User.id.asc())))
                .scalars()
                .all()
            )
        return [await AdminService._summary(u) for u in users]

    @staticmethod
    async def _get_user(session, user_id: int) -> User:
        user = await session.get(User, user_id)
        if user is None:
            raise NotFoundError("User not found")
        return user

    @staticmethod
    async def user_usage(user_id: int) -> dict[str, Any]:
        async with session_scope() as session:
            user = await AdminService._get_user(session, user_id)
            rows = (
                (
                    await session.execute(
                        select(UsageEvent)
                        .where(UsageEvent.user_id == user_id)
                        .order_by(UsageEvent.created_at.desc(), UsageEvent.id.desc())
                        .limit(_MAX_USAGE_EVENTS)
                    )
                )
                .scalars()
                .all()
            )
            total_requests = (
                await session.scalar(
                    select(func.count(UsageEvent.id)).where(
                        UsageEvent.user_id == user_id
                    )
                )
                or 0
            )
            total_tokens = (
                await session.scalar(
                    select(func.coalesce(func.sum(UsageEvent.total_tokens), 0)).where(
                        UsageEvent.user_id == user_id
                    )
                )
                or 0
            )
            summary = await AdminService._summary(user)

        events = [
            {
                "id": r.id,
                "created_at": r.created_at,
                "mode": r.mode,
                "message": r.message,
                "selected_model": r.selected_model,
                "model_name": r.model_name,
                "total_tokens": r.total_tokens,
                "success": r.success,
            }
            for r in rows
        ]
        return {
            "user": summary,
            "events": events,
            "total_requests": total_requests,
            "total_tokens": total_tokens,
        }

    @staticmethod
    async def create_user(
        username: str,
        password: str,
        *,
        is_admin: bool,
        max_requests_per_minute: int | None,
        max_requests_per_day: int | None,
    ) -> dict[str, Any]:
        settings = get_settings()
        if is_admin:
            # Admins are always unlimited (D-10).
            per_minute = None
            per_day = None
        else:
            # Unset limits fall back to the configured defaults so an employee
            # account is never created accidentally unlimited.
            per_minute = (
                max_requests_per_minute
                if max_requests_per_minute is not None
                else settings.default_max_requests_per_minute
            )
            per_day = (
                max_requests_per_day
                if max_requests_per_day is not None
                else settings.default_max_requests_per_day
            )

        user = await AuthService.create_account(
            username,
            password,
            is_admin=is_admin,
            max_requests_per_minute=per_minute,
            max_requests_per_day=per_day,
        )
        return await AdminService._summary(user)

    @staticmethod
    async def update_user(user_id: int, changes: dict[str, Any]) -> dict[str, Any]:
        async with session_scope() as session:
            user = await AdminService._get_user(session, user_id)
            if changes.get("is_admin") is not None:
                user.is_admin = changes["is_admin"]
            # Limits use exclude_unset semantics: present (even null) → apply.
            if "max_requests_per_minute" in changes:
                user.max_requests_per_minute = changes["max_requests_per_minute"]
            if "max_requests_per_day" in changes:
                user.max_requests_per_day = changes["max_requests_per_day"]
            await session.flush()
            await session.refresh(user)
            summary = await AdminService._summary(user)
        return summary
