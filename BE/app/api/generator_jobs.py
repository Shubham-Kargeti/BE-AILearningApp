"""API endpoints to start and monitor question generation jobs."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import insert, select

from app.db.session import get_db
from app.core.dependencies import optional_user
from app.core.security import is_admin_user
from app.core.celery_app import celery_app
from app.db.models import CeleryTask, User

router = APIRouter()


@router.post("/question-generation/start")
async def start_question_generation(
    topic: Optional[str] = Body(None),
    assessment_id: Optional[str] = Body(None),
    count: int = Body(5),
    mode: str = Body("rag"),  # 'rag' | 'llm' | 'mix'
    rag_pct: int = Body(100),
    min_hits: int = Body(1),
    current_user: Optional[User] = Depends(optional_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user or not is_admin_user(current_user.email):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    # Enqueue Celery task
    task = celery_app.send_task(
        "app.core.tasks.question_generation.run_question_generation",
        args=(topic, count, min_hits, assessment_id, mode, rag_pct),
    )

    # Record in CeleryTask table
    related_id = assessment_id if assessment_id else (topic or None)
    stmt = insert(CeleryTask).values(task_id=task.id, task_name="question_generation", status="PENDING", result=None, related_type="generation", related_id=related_id, user_id=current_user.id)
    await db.execute(stmt)
    await db.commit()

    return {"task_id": task.id, "status": "queued"}


@router.get("/question-generation/status/{task_id}")
async def get_generation_status(task_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CeleryTask).where(CeleryTask.task_id == task_id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return {"task_id": t.task_id, "status": t.status, "result": t.result, "error": t.error}
