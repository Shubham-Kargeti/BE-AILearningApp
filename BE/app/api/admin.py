"""Admin API endpoints."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta

from app.db.session import get_db
from app.db.models import User, TestSession, JobDescription, Question
from app.core.dependencies import get_current_user

router = APIRouter()


# Response models
class StatsResponse(BaseModel):
    """System statistics."""
    total_users: int
    total_job_descriptions: int
    total_questions: int
    total_test_sessions: int
    completed_tests: int
    average_score: float


@router.get("/admin/stats", response_model=StatsResponse)
async def get_system_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> StatsResponse:
    """Get system statistics (admin only)."""
    # TODO: Add admin role check
    
    # Count users
    user_count = await db.execute(select(func.count(User.id)))
    total_users = user_count.scalar() or 0
    
    # Count job descriptions
    jd_count = await db.execute(select(func.count(JobDescription.id)))
    total_jds = jd_count.scalar() or 0
    
    # Count questions
    q_count = await db.execute(select(func.count(Question.id)))
    total_questions = q_count.scalar() or 0
    
    # Count test sessions
    ts_count = await db.execute(select(func.count(TestSession.id)))
    total_sessions = ts_count.scalar() or 0
    
    # Count completed tests
    completed_count = await db.execute(
        select(func.count(TestSession.id)).where(TestSession.is_completed == True)
    )
    completed_tests = completed_count.scalar() or 0
    
    # Calculate average score
    avg_score = await db.execute(
        select(func.avg(TestSession.score_percentage)).where(
            and_(
                TestSession.is_completed == True,
                TestSession.score_percentage.isnot(None)
            )
        )
    )
    average_score = avg_score.scalar() or 0.0
    
    return StatsResponse(
        total_users=total_users,
        total_job_descriptions=total_jds,
        total_questions=total_questions,
        total_test_sessions=total_sessions,
        completed_tests=completed_tests,
        average_score=float(average_score)
    )
