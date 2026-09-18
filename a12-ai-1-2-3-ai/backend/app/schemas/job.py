from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class JobRead(BaseModel):
    id: int
    task_id: int | None
    job_type: str
    status: str
    progress: str | None = None
    payload: dict[str, Any] | None = None
    result: dict[str, Any] | None = None
    error: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
