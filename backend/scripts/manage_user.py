#!/usr/bin/env python
"""Admin maintenance CLI: create a user or (re)set its password / role / limits.

Runs against whatever database ``settings.database_url`` points at — locally the
SQLite file, in production the Postgres service — using the app's own argon2
hasher, so the resulting login works exactly like a normal sign-in. Passwords are
only ever written as argon2 hashes (never printed, never stored in plaintext).

Examples (inside the backend container on the server):
    python scripts/manage_user.py --username admin --password 'S3cret!' --admin
    python scripts/manage_user.py --username worker --password 'pw' --create \
        --rpm 5 --rpd 30
"""

import argparse
import asyncio
import os
import sys

# Make the app root importable regardless of the current working directory
# (the script lives in app-root/scripts/, the packages live in app-root/).
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select  # noqa: E402

from core.db import dispose_engine, session_scope  # noqa: E402
from core.security import hash_password  # noqa: E402
from db.models import User  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create or update a user account.")
    parser.add_argument("--username", required=True, help="Account username.")
    parser.add_argument("--password", help="New password (sets an argon2 hash).")
    parser.add_argument(
        "--create",
        action="store_true",
        help="Create the account if it does not exist (requires --password).",
    )
    role = parser.add_mutually_exclusive_group()
    role.add_argument("--admin", dest="admin", action="store_true", help="Grant admin.")
    role.add_argument(
        "--no-admin", dest="admin", action="store_false", help="Revoke admin."
    )
    parser.set_defaults(admin=None)
    parser.add_argument(
        "--rpm",
        help="Max requests per minute (integer, or 'null' for unlimited).",
    )
    parser.add_argument(
        "--rpd",
        help="Max requests per day (integer, or 'null' for unlimited).",
    )
    return parser.parse_args()


def _parse_limit(value: str | None) -> tuple[bool, int | None]:
    """Return (provided, parsed). 'null'/'none'/'' → unlimited (None)."""
    if value is None:
        return False, None
    if value.strip().lower() in {"null", "none", ""}:
        return True, None
    return True, int(value)


async def run(args: argparse.Namespace) -> int:
    rpm_set, rpm = _parse_limit(args.rpm)
    rpd_set, rpd = _parse_limit(args.rpd)

    async with session_scope() as session:
        user = (
            await session.execute(select(User).where(User.username == args.username))
        ).scalar_one_or_none()

        if user is None:
            if not args.create:
                print(
                    f"User '{args.username}' not found. "
                    f"Pass --create (with --password) to create it.",
                    file=sys.stderr,
                )
                return 1
            if not args.password:
                print("--create requires --password.", file=sys.stderr)
                return 1
            user = User(
                username=args.username,
                password_hash=hash_password(args.password),
                is_admin=bool(args.admin) if args.admin is not None else False,
                max_requests_per_minute=rpm if rpm_set else None,
                max_requests_per_day=rpd if rpd_set else None,
            )
            session.add(user)
            action = "created"
        else:
            if args.password:
                user.password_hash = hash_password(args.password)
            if args.admin is not None:
                user.is_admin = args.admin
            if rpm_set:
                user.max_requests_per_minute = rpm
            if rpd_set:
                user.max_requests_per_day = rpd
            action = "updated"

    print(
        f"OK: {action} '{args.username}' "
        f"(admin={user.is_admin}, rpm={user.max_requests_per_minute}, "
        f"rpd={user.max_requests_per_day})"
        + (" — password set" if args.password else "")
    )
    return 0


def main() -> None:
    args = parse_args()
    try:
        code = asyncio.run(run(args))
    finally:
        asyncio.run(dispose_engine())
    sys.exit(code)


if __name__ == "__main__":
    main()
