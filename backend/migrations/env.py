# backend/migrations/env.py
"""Alembic environment.

Uses a *synchronous* engine derived from the app's DATABASE_URL (the async
driver is swapped for a sync one) and the shared ``Base.metadata`` so the
schema source of truth is the ORM models.
"""

from alembic import context
from sqlalchemy import create_engine, pool

# Import models so they register on Base.metadata.
import db.models  # noqa: F401
from core.config import get_settings
from core.db import Base

target_metadata = Base.metadata


def _sync_url() -> str:
    url = get_settings().database_url
    return url.replace("+aiosqlite", "").replace("+asyncpg", "+psycopg2")


def run_migrations_offline() -> None:
    context.configure(
        url=_sync_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(_sync_url(), poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
        )
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
