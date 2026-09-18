from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

import aiosqlite  # ensure async sqlite dialect is available
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

_engine = None
_session_factory = None


class Base(DeclarativeBase):
    pass


def get_engine():
    global _engine
    if _engine is None:
        url = settings.database_url
        is_sqlite = url.startswith("sqlite")
        async_url = url.replace("sqlite:", "sqlite+aiosqlite:") if is_sqlite else url
        connect_args = {"check_same_thread": False} if is_sqlite else {}
        _engine = create_async_engine(async_url, echo=False, future=True, connect_args=connect_args)
    return _engine


def get_session_factory() -> async_sessionmaker:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(get_engine(), expire_on_commit=False)
    return _session_factory


async def create_session() -> AsyncIterator[AsyncSession]:
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    from app import models  # noqa: F401

    os.makedirs(settings.upload_dir, exist_ok=True)
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
