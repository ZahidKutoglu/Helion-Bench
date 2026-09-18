"""Database engine and session factory.

Supports PostgreSQL (asyncpg) and SQLite (aiosqlite). SQLite is the local
fallback when Docker/Postgres is not available. Relative SQLite paths are
resolved against the project root (the directory that contains backend/).
"""

from collections.abc import AsyncIterator
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.core.config import get_settings
from app.db.base import Base

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def project_root() -> Path:
    cwd = Path.cwd().resolve()
    if (cwd / "app").is_dir() and (cwd / "pyproject.toml").is_file():
        return cwd.parent
    if (cwd / "backend" / "app").is_dir():
        return cwd
    return cwd


def resolve_database_url(url: str) -> str:
    memory_markers = (":memory:", "mode=memory")
    if not url.startswith("sqlite+aiosqlite:///") or any(m in url for m in memory_markers):
        return url
    raw_path = url.removeprefix("sqlite+aiosqlite:///")
    path = Path(raw_path)
    if not path.is_absolute():
        path = (project_root() / raw_path).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite+aiosqlite:///{path}"


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        settings = get_settings()
        url = resolve_database_url(settings.database_url)
        kwargs: dict = {"echo": settings.db_echo}
        if url.startswith("sqlite"):
            kwargs["connect_args"] = {"check_same_thread": False}
            kwargs["poolclass"] = NullPool
        else:
            kwargs["pool_pre_ping"] = True
            kwargs["pool_size"] = settings.db_pool_size
        _engine = create_async_engine(url, **kwargs)
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _session_factory


async def get_db() -> AsyncIterator[AsyncSession]:
    factory = get_session_factory()
    async with factory() as session:
        yield session


async def ping_database() -> None:
    engine = get_engine()
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))


async def init_database() -> None:
    """Create tables if they do not exist (SQLite and first-run Postgres)."""
    from app.domain import models as _models  # noqa: F401

    engine = get_engine()
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)


async def dispose_engine() -> None:
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _session_factory = None
