from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.task import Job
from app.schemas.job import JobRead
from app.services.job_service import job_to_read

router = APIRouter()


@router.get("/tasks/{task_id}", response_model=list[JobRead])
def list_task_jobs(task_id: int, db: Session = Depends(get_db)) -> list[JobRead]:
    jobs = (
        db.query(Job)
        .filter(Job.task_id == task_id)
        .order_by(Job.created_at.desc())
        .limit(50)
        .all()
    )
    return [JobRead(**job_to_read(job)) for job in jobs]


@router.get("/{job_id}", response_model=JobRead)
def get_job(job_id: int, db: Session = Depends(get_db)) -> JobRead:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobRead(**job_to_read(job))
