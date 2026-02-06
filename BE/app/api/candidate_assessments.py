"""Additional candidate endpoints for assessments and learning paths."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.dependencies import get_db, get_current_user
from app.db.models import User, Assessment, TestSession

router = APIRouter(prefix="/api/v1/candidates", tags=["candidates"])


@router.get("/my-assessments")
async def get_my_assessments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all assessments assigned to or completed by the current user.
    Filters by candidate_email to show only assessments created for this user.
    
    Returns:
    - List of assessments with their test sessions
    - Includes assessment details and completion status
    - Shows learning path availability for completed assessments
    """
    # Get all test sessions for this user filtered by both user_id AND candidate_email
    sessions_result = await db.execute(
        select(TestSession)
        .where(
            (TestSession.user_id == current_user.id) |
            (TestSession.candidate_email == current_user.email)
        )
        .order_by(TestSession.created_at.desc())
    )
    sessions = sessions_result.scalars().all()
    
    # Get unique question_set_ids from sessions
    question_set_ids = list(set([s.question_set_id for s in sessions if s.question_set_id]))
    
    if not question_set_ids:
        return []
    
    # Get assessments linked to these question sets
    assessments_result = await db.execute(
        select(Assessment)
        .where(Assessment.question_set_id.in_(question_set_ids))
        .where(Assessment.is_active == True)
    )
    assessments = assessments_result.scalars().all()
    
    # Build response with session info
    result = []
    for assessment in assessments:
        # Find all sessions for this assessment that belong to this candidate
        assessment_sessions = [
            s for s in sessions 
            if s.question_set_id == assessment.question_set_id
        ]
        
        # Get the latest/best session
        latest_session = max(assessment_sessions, key=lambda s: s.created_at) if assessment_sessions else None
        
        result.append({
            "assessment_id": assessment.assessment_id,
            "title": assessment.title,
            "description": assessment.description,
            "job_title": assessment.job_title,
            "duration_minutes": assessment.duration_minutes,
            "total_questions": assessment.total_questions,
            "is_published": assessment.is_published,
            "is_expired": assessment.is_expired,
            "expires_at": assessment.expires_at.isoformat() if assessment.expires_at else None,
            "created_at": assessment.created_at.isoformat(),
            # Session info
            "session_id": latest_session.session_id if latest_session else None,
            "is_completed": latest_session.is_completed if latest_session else False,
            "score_percentage": latest_session.score_percentage if latest_session else None,
            "completed_at": latest_session.completed_at.isoformat() if latest_session and latest_session.completed_at else None,
            "attempts_count": len(assessment_sessions),
        })
    
    return result
