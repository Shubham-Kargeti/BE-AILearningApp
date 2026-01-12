"""Assessment progress API endpoints."""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from app.core.dependencies import get_db
from app.db.models import AssessmentProgress

router = APIRouter(prefix="/assessment-progress", tags=["assessment-progress"])


class ProgressSaveRequest(BaseModel):
    """Request model for saving assessment progress."""
    candidate_email: EmailStr
    candidate_name: Optional[str] = None
    session_id: Optional[str] = None
    question_set_id: Optional[str] = None
    assessment_title: Optional[str] = None
    skill: Optional[str] = None
    level: Optional[str] = None
    current_question_index: int
    answers: dict
    question_status: dict
    expired_questions: list
    remaining_time_seconds: Optional[int] = None
    initial_duration_seconds: Optional[int] = None
    total_questions: int
    is_completed: bool = False


class ProgressResponse(BaseModel):
    """Response model for assessment progress."""
    candidate_email: str
    candidate_name: Optional[str]
    session_id: Optional[str]
    question_set_id: Optional[str]
    assessment_title: Optional[str]
    skill: Optional[str]
    level: Optional[str]
    current_question_index: int
    answers: dict
    question_status: dict
    expired_questions: list
    remaining_time_seconds: Optional[int]
    initial_duration_seconds: Optional[int]
    total_questions: int
    is_completed: bool
    last_saved_at: datetime


@router.post("/save", response_model=ProgressResponse)
async def save_assessment_progress(
    progress: ProgressSaveRequest,
    db: Session = Depends(get_db)
):
    """Save or update assessment progress for a candidate."""
    try:
        # Check if progress already exists for this email
        existing_progress = db.query(AssessmentProgress).filter(
            AssessmentProgress.candidate_email == progress.candidate_email
        ).first()
        
        now = datetime.now(timezone.utc)
        
        if existing_progress:
            # Update existing progress
            existing_progress.candidate_name = progress.candidate_name
            existing_progress.session_id = progress.session_id
            existing_progress.question_set_id = progress.question_set_id
            existing_progress.assessment_title = progress.assessment_title
            existing_progress.skill = progress.skill
            existing_progress.level = progress.level
            existing_progress.current_question_index = progress.current_question_index
            existing_progress.answers = progress.answers
            existing_progress.question_status = progress.question_status
            existing_progress.expired_questions = progress.expired_questions
            existing_progress.remaining_time_seconds = progress.remaining_time_seconds
            existing_progress.initial_duration_seconds = progress.initial_duration_seconds
            existing_progress.total_questions = progress.total_questions
            existing_progress.is_completed = progress.is_completed
            existing_progress.last_saved_at = now
            
            db.commit()
            db.refresh(existing_progress)
            return existing_progress
        else:
            # Create new progress entry
            new_progress = AssessmentProgress(
                candidate_email=progress.candidate_email,
                candidate_name=progress.candidate_name,
                session_id=progress.session_id,
                question_set_id=progress.question_set_id,
                assessment_title=progress.assessment_title,
                skill=progress.skill,
                level=progress.level,
                current_question_index=progress.current_question_index,
                answers=progress.answers,
                question_status=progress.question_status,
                expired_questions=progress.expired_questions,
                remaining_time_seconds=progress.remaining_time_seconds,
                initial_duration_seconds=progress.initial_duration_seconds,
                total_questions=progress.total_questions,
                is_completed=progress.is_completed,
                last_saved_at=now
            )
            
            db.add(new_progress)
            db.commit()
            db.refresh(new_progress)
            return new_progress
            
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save progress: {str(e)}")


@router.get("/load/{email}", response_model=Optional[ProgressResponse])
async def load_assessment_progress(
    email: str,
    db: Session = Depends(get_db)
):
    """Load assessment progress for a candidate by email."""
    try:
        progress = db.query(AssessmentProgress).filter(
            AssessmentProgress.candidate_email == email,
            AssessmentProgress.is_completed == False
        ).first()
        
        return progress
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load progress: {str(e)}")


@router.delete("/delete/{email}")
async def delete_assessment_progress(
    email: str,
    db: Session = Depends(get_db)
):
    """Delete assessment progress for a candidate by email."""
    try:
        progress = db.query(AssessmentProgress).filter(
            AssessmentProgress.candidate_email == email
        ).first()
        
        if not progress:
            raise HTTPException(status_code=404, detail="Progress not found")
        
        db.delete(progress)
        db.commit()
        
        return {"message": "Progress deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete progress: {str(e)}")


@router.post("/complete/{email}")
async def mark_assessment_complete(
    email: str,
    db: Session = Depends(get_db)
):
    """Mark assessment as completed for cleanup."""
    try:
        progress = db.query(AssessmentProgress).filter(
            AssessmentProgress.candidate_email == email
        ).first()
        
        if not progress:
            raise HTTPException(status_code=404, detail="Progress not found")
        
        progress.is_completed = True
        progress.last_saved_at = datetime.now(timezone.utc)
        
        db.commit()
        db.refresh(progress)
        
        return {"message": "Assessment marked as complete", "progress": progress}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to mark complete: {str(e)}")
