from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FileRead(BaseModel):
    id: int
    task_id: int
    file_name: str
    file_type: str
    file_path: str
    purpose: str = "content"
    focus: str | None = None
    parse_status: str
    parsed_content: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ParsedFileRead(BaseModel):
    file_id: int
    title: str
    file_type: str
    text: str
    markdown: str | None = None
    metadata: dict
