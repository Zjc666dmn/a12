from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.task import CourseTask, Job
from app.schemas.task import TaskCreate, TaskIterationRequest, TaskRead, TaskUpdate
from app.services.job_service import enqueue_job
from app.services.task_service import get_task_or_404

router = APIRouter()


def _enqueue_response(job: Job) -> dict[str, object]:
    return {"job_id": job.id, "status": job.status, "job_type": job.job_type}


@router.post("", response_model=TaskRead)
def create_task(payload: TaskCreate, db: Session = Depends(get_db)) -> TaskRead:
    task = CourseTask(
        title=payload.title,
        subject=payload.subject,
        audience=payload.audience,
        duration_minutes=payload.duration_minutes,
        status="draft",
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return TaskRead.model_validate(task)


@router.get("", response_model=list[TaskRead])
def list_tasks(db: Session = Depends(get_db)) -> list[TaskRead]:
    tasks = db.query(CourseTask).order_by(CourseTask.created_at.desc()).all()
    return [TaskRead.model_validate(task) for task in tasks]


@router.get("/{task_id}", response_model=TaskRead)
def get_task(task_id: int, db: Session = Depends(get_db)) -> TaskRead:
    return TaskRead.model_validate(get_task_or_404(db, task_id))


@router.patch("/{task_id}", response_model=TaskRead)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
) -> TaskRead:
    task = get_task_or_404(db, task_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, key, value)
    db.commit()
    db.refresh(task)
    return TaskRead.model_validate(task)


@router.post("/{task_id}/generate")
def generate_task_assets(task_id: int, db: Session = Depends(get_db)) -> dict[str, object]:
    get_task_or_404(db, task_id)
    return _enqueue_response(enqueue_job(db, task_id, "generate_all"))


@router.post("/{task_id}/generate-docx")
def generate_task_docx(task_id: int, db: Session = Depends(get_db)) -> dict[str, object]:
    get_task_or_404(db, task_id)
    return _enqueue_response(enqueue_job(db, task_id, "generate_docx"))


@router.post("/{task_id}/generate-pptx")
def generate_task_pptx(task_id: int, db: Session = Depends(get_db)) -> dict[str, object]:
    get_task_or_404(db, task_id)
    return _enqueue_response(enqueue_job(db, task_id, "generate_pptx"))


@router.post("/{task_id}/iterate")
def iterate_task_assets(
    task_id: int,
    payload: TaskIterationRequest,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    get_task_or_404(db, task_id)
    feedback = payload.feedback.strip()
    if not feedback:
        raise HTTPException(status_code=400, detail="请填写修改意见")
    return _enqueue_response(
        enqueue_job(
            db,
            task_id,
            "iterate",
            {
                "feedback": feedback,
                "regenerate_docx": payload.regenerate_docx,
                "regenerate_pptx": payload.regenerate_pptx,
            },
        )
    )
