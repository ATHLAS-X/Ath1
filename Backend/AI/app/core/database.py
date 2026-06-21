"""SQLAlchemy 2.x async engine/session setup.

STANDALONE-BUILD NOTE (see RECONCILIATION_NOTES.md): the architecture doc mandates
that the compute service treat the shared DB as reflect-only and never own schema.
There is no shared DB in this standalone build, so we define real models and manage
them with Alembic against a LOCAL, ISOLATED Postgres. At integration time these
tables/migrations must be reconciled with whatever ORM owns the shared schema.

Models use portable column types (string UUIDs, generic JSON, tz-aware DateTime) so
the same metadata runs on Postgres (dev/prod, via Alembic) and on SQLite
(in-memory, for the no-services Tier-1/Tier-2 test suite).
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings


class Base(DeclarativeBase):
    """Declarative base for all owned models."""


_engine = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def get_engine():
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            get_settings().database_url,
            pool_pre_ping=True,
            future=True,
        )
    return _engine


def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    global _sessionmaker
    if _sessionmaker is None:
        _sessionmaker = async_sessionmaker(
            bind=get_engine(),
            expire_on_commit=False,
            class_=AsyncSession,
        )
    return _sessionmaker


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency yielding an async session with commit/rollback handling."""
    sessionmaker = get_sessionmaker()
    async with sessionmaker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
