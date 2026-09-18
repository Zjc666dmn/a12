from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TaskCreate(BaseModel):
    title: str
    subject: str | None = None
    audience: str | None = None
    duration_minutes: int | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    subject: str | None = None
    audience: str | None = None
    duration_minutes: int | None = None
    status: str | None = None
    requirement_summary: str | None = None
    teaching_topic: str | None = None
    knowledge_points: str | None = None
    key_difficulties: str | None = None
    interaction_design: str | None = None
    intent_status: str | None = None
    intent_confidence: str | None = None


class TaskIterationRequest(BaseModel):
    feedback: str
    regenerate_docx: bool = True
    regenerate_pptx: bool = True


class TaskRead(BaseModel):
    id: int
    title: str
    subject: str | None
    audience: str | None
    duration_minutes: int | None
    status: str
    requirement_summary: str | None
    teaching_topic: str | None
    knowledge_points: str | None
    key_difficulties: str | None
    interaction_design: str | None
    intent_status: str
    intent_confidence: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
