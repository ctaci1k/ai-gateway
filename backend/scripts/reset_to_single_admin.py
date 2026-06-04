#!/usr/bin/env python
"""DESTRUCTIVE maintenance: wipe ALL users and create a single admin account.

Runs against whatever ``settings.database_url`` points at — locally the SQLite
file, in production the Postgres service. Deleting the users removes ALL of their
data via the ``users`` FK cascades (chats + messages, saved Single chats, rolling
history, the usage ledger, BYOK credentials, preferences, sessions, documents);
the matching RAG vectors are purged separately so no orphans remain.

Irreversible — guarded by an explicit ``--confirm WIPE``. The new admin's password
is taken from ``--password`` (hashed with the app's argon2 hasher; never printed,
never stored in plaintext).

Run inside the backend container on the server:

    docker compose -f docker-compose.prod.yml exec backend \
        python scripts/reset_to_single_admin.py --confirm WIPE \
        --username Stanislav --password 'stas123stas'
"""

import argparse
import asyncio
import os
import sys

# Make the app root importable regardless of the current working directory
# (the script lives in app-root/scripts/, the packages live in app-root/).
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import delete, select  # noqa: E402

from core.db import dispose_engine, session_scope  # noqa: E402
from core.security import hash_password  # noqa: E402
from db.models import User  # noqa: E402
from services.rag_service import RagService  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="DESTRUCTIVE: wipe ALL users and create one admin account."
    )
    parser.add_argument(
        "--confirm",
        required=True,
        help="Must be exactly 'WIPE' to proceed (safety guard).",
    )
    parser.add_argument(
        "--username",
        default="Stanislav",
        help="Username for the new admin (default: Stanislav).",
    )
    parser.add_argument(
        "--password",
        required=True,
        help="Password for the new admin (argon2-hashed, never stored plaintext).",
    )
    return parser.parse_args()


async def run(username: str, password: str) -> int:
    async with session_scope() as session:
        user_ids = list((await session.execute(select(User.id))).scalars().all())
        # Wipe every account; all per-user data cascades via ON DELETE CASCADE.
        await session.execute(delete(User))
        # Flush the deletes before the insert so a reused username can't collide.
        await session.flush()
        session.add(
            User(
                username=username,
                password_hash=hash_password(password),
                is_admin=True,
                max_requests_per_minute=None,
                max_requests_per_day=None,
            )
        )

    # Drop the removed users' RAG vectors (relational rows are already gone).
    for uid in user_ids:
        try:
            RagService.delete_user_vectors(uid)
        except Exception:  # noqa: BLE001 — best-effort cleanup, never block.
            pass

    print(
        f"OK: wiped {len(user_ids)} user(s); created admin '{username}' "
        "(is_admin=True, unlimited) — password set."
    )
    return 0


def main() -> None:
    args = parse_args()
    if args.confirm != "WIPE":
        print("Refusing to run: pass --confirm WIPE to proceed.", file=sys.stderr)
        sys.exit(2)
    if len(args.password) < 6:
        print("Password too short (minimum 6 characters).", file=sys.stderr)
        sys.exit(2)
    try:
        code = asyncio.run(run(args.username, args.password))
    finally:
        asyncio.run(dispose_engine())
    sys.exit(code)


if __name__ == "__main__":
    main()
