# backend/seed_accounts.py
"""Dev-only: seed a deterministic set of test accounts covering every account
perspective (admin / limited / unlimited-non-admin). Idempotent — upserts by
username (resets password, role and limits). NOT used in production."""

import asyncio

from sqlalchemy import select

from core.db import dispose_engine, init_models, session_scope
from core.security import hash_password
from db.models import Preference, User
from memory import preferences_logic

# username, password, is_admin, per_minute, per_day
ACCOUNTS = [
    ("admin", "admin12345", True, None, None),  # admin panel + unlimited
    ("worker", "worker12345", False, 5, 30),  # tightly limited (see banner/429)
    ("freeuser", "freeuser123", False, None, None),  # unlimited, non-admin (no panel)
    ("tester1", "tester12345", False, 10, 200),  # generously limited
    ("tester2", "tester12345", False, 10, 200),
    ("tester3", "tester12345", False, 10, 200),
]


async def _upsert(username, password, is_admin, per_minute, per_day):
    async with session_scope() as session:
        user = await session.scalar(select(User).where(User.username == username))
        if user is None:
            user = User(
                username=username,
                password_hash=hash_password(password),
                is_admin=is_admin,
                max_requests_per_minute=per_minute,
                max_requests_per_day=per_day,
            )
            session.add(user)
            await session.flush()
            session.add(
                Preference(
                    user_id=user.id, data=preferences_logic.default_preferences()
                )
            )
            return "created"
        user.password_hash = hash_password(password)
        user.is_admin = is_admin
        user.max_requests_per_minute = per_minute
        user.max_requests_per_day = per_day
        return "updated"


async def main():
    await init_models()
    for account in ACCOUNTS:
        action = await _upsert(*account)
        label = "admin" if account[2] else (f"{account[3]}/min,{account[4]}/day")
        print(f"  {action:8} {account[0]:10} pass={account[1]:13} [{label}]")
    await dispose_engine()


if __name__ == "__main__":
    asyncio.run(main())
