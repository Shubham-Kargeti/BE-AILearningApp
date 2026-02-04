"""Endpoints for managing QuestionBank drafts (admin-only)."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import QuestionBank, User
from app.core.dependencies import optional_user
from app.core.security import is_admin_user
from app.models.schemas import GeneratedQuestion

router = APIRouter()


@router.get("/question-bank", response_model=List[GeneratedQuestion])
async def list_question_bank_drafts(
    review_state: str = "draft",
    current_user: Optional[User] = Depends(optional_user),
    db: AsyncSession = Depends(get_db),
) -> List[GeneratedQuestion]:
    if not current_user or not is_admin_user(current_user.email):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    result = await db.execute(select(QuestionBank).where(QuestionBank.review_state == review_state).order_by(QuestionBank.created_at.desc()))
    items = result.scalars().all()
    return [
        GeneratedQuestion(
            id=item.id,
            question_text=item.question_text,
            choices=item.choices,
            correct_answer=item.correct_answer,
            source_type=item.source_type,
            quality_score=item.quality_score,
            review_state=item.review_state,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        for item in items
    ]


@router.post("/question-bank/{id}/publish", response_model=GeneratedQuestion)
async def publish_question_bank_item(
    id: int,
    current_user: Optional[User] = Depends(optional_user),
    db: AsyncSession = Depends(get_db),
) -> GeneratedQuestion:
    if not current_user or not is_admin_user(current_user.email):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    result = await db.execute(select(QuestionBank).where(QuestionBank.id == id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found")

    item.review_state = "published"
    await db.commit()
    await db.refresh(item)

    return GeneratedQuestion(
        id=item.id,
        question_text=item.question_text,
        choices=item.choices,
        correct_answer=item.correct_answer,
        source_type=item.source_type,
        quality_score=item.quality_score,
        review_state=item.review_state,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )
