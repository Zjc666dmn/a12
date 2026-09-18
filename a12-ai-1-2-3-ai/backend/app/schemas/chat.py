from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.task import TaskRead


class ChatRequest(BaseModel):
    message: str
    context: dict[str, str] | None = None


class MessageRead(BaseModel):
    id: int
    task_id: int
    role: str
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatReference(BaseModel):
    source: str
    content: str
    score: float | None = None
    file_id: int | None = None
    chunk_index: int | None = None
    page: int | None = None
    section: str | None = None
    tags: list[str] = Field(default_factory=list)


class ChatResponse(BaseModel):
    task_id: int
    message: MessageRead
    references: list[ChatReference] = Field(default_factory=list)
    thinking: list[str] = Field(default_factory=list)
    task: TaskRead | None = None
    requirement: dict | None = None
    session: dict | None = None
    completeness: float | None = None
    missing_fields: list[str] = Field(default_factory=list)
    stage: str | None = None
    next_question: str | None = None
    transition: dict | None = None
    generated_asset_id: int | None = None


class ChatHistoryResponse(BaseModel):
    task_id: int
    messages: list[MessageRead] = Field(default_factory=list)
