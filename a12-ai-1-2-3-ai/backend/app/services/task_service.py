from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.task import CourseTask


def get_task_or_404(db: Session, task_id: int) -> CourseTask:
    task = db.get(CourseTask, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task
