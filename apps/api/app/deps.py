from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.config import Settings, settings
from app.retrieval.store import Store


def get_settings() -> Settings:
    return settings


_store: Store | None = None


def get_store() -> Store:
    global _store
    if _store is None:
        _store = Store(settings=settings)
    return _store


def set_store(new_store: Store) -> None:
    global _store
    _store = new_store


SettingsDep = Annotated[Settings, Depends(get_settings)]
StoreDep = Annotated[Store, Depends(get_store)]
