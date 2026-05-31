# backend/core/db.py
"""Async database engine, session factory and lifecycle helpers.

The engine/session factory are created lazily from ``settings.database_url`` so
tests can point at an isolated database before anything connects.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from core.config import get_settings


class Base(DeclarativeBase):
    pass


_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        _engine = create_async_engine(get_settings().database_url, future=True)
        # Defense-in-depth: SQLite disables FK enforcement per connection by
        # default, so ON DELETE CASCADE never fires. Turn it on for every new
        # connection (no-op for Postgres, which we don't attach this to).
        if _engine.dialect.name == "sqlite":

            @event.listens_for(_engine.sync_engine, "connect")
            def _enable_sqlite_fk(dbapi_connection, _record):
                cursor = dbapi_connection.cursor()
                cursor.execute("PRAGMA foreign_keys=ON")
                cursor.close()

    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            bind=get_engine(),
            expire_on_commit=False,
        )
    return _session_factory


@asynccontextmanager
async def session_scope() -> AsyncIterator[AsyncSession]:
    """Provide a transactional session scope (commit on success, rollback on error)."""
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_models() -> None:
    """Create tables from metadata (dev/runtime convenience).

    Production schema is owned by Alembic migrations; both derive from the same
    ``Base.metadata`` so they stay consistent. Idempotent.
    """
    # Import models so they register on Base.metadata before create_all.
    import db.models  # noqa: F401

    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def dispose_engine() -> None:
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _session_factory = None


def reset_engine_for_tests() -> None:
    """Drop cached engine/session factory so a new database_url takes effect."""
    global _engine, _session_factory
    _engine = None
    _session_factory = None
