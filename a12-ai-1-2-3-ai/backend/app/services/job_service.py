"""In-process background job queue for long-running asset generation.

Generation jobs (LLM calls, subprocess-based PPT rendering) are blocking and
slow, so they must not run inside a request handler. Each job is persisted to
the ``jobs`` table and executed on a small dedicated thread pool; clients poll
``GET /api/jobs/{id}`` for status and result.
"""

from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.task import CourseTask, Job
from app.services.task_asset_service import (
    generate_all_assets,
    generate_docx_asset,
    generate_pptx_asset,
    iterate_assets,
    revise_ppt,
)

MAX_WORKERS = 2
_executor = ThreadPoolExecutor(max_workers=MAX_WORKERS, thread_name_prefix="teachnova-job")


def _json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def _json_loads(value: str | None) -> Any:
    if not value:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None


def enqueue_job(
    db: Session,
    task_id: int | None,
    job_type: str,
    payload: dict[str, Any] | None = None,
) -> Job:
    job = Job(
        task_id=task_id,
        job_type=job_type,
        status="pending",
        payload=_json_dumps(payload or {}),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    _executor.submit(_run_job, job.id, job_type, task_id, payload or {})
    return job


def job_to_read(job: Job) -> dict[str, Any]:
    return {
        "id": job.id,
        "task_id": job.task_id,
        "job_type": job.job_type,
        "status": job.status,
        "progress": job.progress,
        "payload": _json_loads(job.payload),
        "result": _json_loads(job.result),
        "error": job.error,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
    }


def _run_job(job_id: int, job_type: str, task_id: int | None, payload: dict[str, Any]) -> None:
    db = SessionLocal()
    try:
        job = db.get(Job, job_id)
        if job is None:
            return
        job.status = "running"
        job.progress = "正在处理…"
        db.commit()

        task = db.get(CourseTask, task_id) if task_id else None
        result = _dispatch(job_type, db, task, payload)

        job = db.get(Job, job_id)
        if job is None:
            return
        job.status = "succeeded"
        job.progress = "完成"
        job.result = _json_dumps(result)
        db.commit()
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        job = db.get(Job, job_id)
        if job is not None:
            job.status = "failed"
            job.progress = "失败"
            job.error = str(exc)
            db.commit()
    finally:
        db.close()


def _dispatch(job_type: str, db: Session, task: CourseTask | None, payload: dict[str, Any]) -> dict[str, Any]:
    if task is None:
        raise ValueError("任务不存在，无法执行生成任务")

    if job_type == "generate_all":
        return generate_all_assets(db, task)
    if job_type == "generate_docx":
        return generate_docx_asset(db, task)
    if job_type == "generate_pptx":
        return generate_pptx_asset(db, task)
    if job_type == "iterate":
        return iterate_assets(
            db,
            task,
            str(payload.get("feedback", "")),
            bool(payload.get("regenerate_docx", True)),
            bool(payload.get("regenerate_pptx", True)),
        )
    if job_type == "revise_ppt":
        return revise_ppt(db, task, str(payload.get("instruction", "")))

    raise ValueError(f"未知任务类型：{job_type}")
