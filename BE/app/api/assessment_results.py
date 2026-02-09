"""Assessment results API endpoints for admin review and sharing."""
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import and_, or_, desc
from pydantic import BaseModel, EmailStr

from app.core.dependencies import get_db, get_current_user, admin_required
from app.db.models import (
    User, Assessment, TestSession, Answer, Question, 
    AssessmentApplication, Candidate
)
from config import get_settings

settings = get_settings()
router = APIRouter(prefix="/api/v1/admin/assessment-results", tags=["assessment-results"])


class DetailedQuestionResult(BaseModel):
    """Detailed result for a single question."""
    question_id: int
    question_text: str
    topic: Optional[str] = None
    difficulty: Optional[str] = None
    candidate_answer: str
    correct_answer: str
    is_correct: bool
    options: Optional[dict] = None
    time_taken_seconds: Optional[int] = None


class CandidateResultDetail(BaseModel):
    """Complete candidate assessment result."""
    session_id: str
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None
    assessment_id: str
    assessment_title: str
    job_title: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    total_questions: int
    answered_questions: int
    correct_answers: int
    score_percentage: Optional[float] = None
    is_completed: bool
    is_scored: bool
    questions: List[DetailedQuestionResult]
    application_status: Optional[str] = None


class ShareResultRequest(BaseModel):
    """Request to share assessment results."""
    recipient_emails: List[EmailStr]
    include_answers: bool = True
    message: Optional[str] = None


class ShareResultResponse(BaseModel):
    """Response after sharing results."""
    success: bool
    message: str
    share_link: Optional[str] = None


@router.get("/{assessment_id}/results", response_model=List[CandidateResultDetail])
async def get_assessment_detailed_results(
    assessment_id: str,
    include_incomplete: bool = Query(False, description="Include incomplete test sessions"),
    current_user: User = Depends(admin_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed results for all candidates who took an assessment.
    
    Admin only. Returns comprehensive results including:
    - Candidate information
    - Test session details
    - Question-by-question breakdown with answers
    - Performance metrics
    """
    # Verify assessment exists
    assess_result = await db.execute(
        select(Assessment).where(Assessment.assessment_id == assessment_id)
    )
    assessment = assess_result.scalar_one_or_none()
    
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found"
        )
    
    # Get all test sessions for this assessment
    query = select(TestSession).options(
        selectinload(TestSession.answers).selectinload(Answer.question),
        selectinload(TestSession.user)
    ).where(TestSession.question_set_id == assessment.question_set_id)
    
    if not include_incomplete:
        query = query.where(TestSession.is_completed == True)
    
    query = query.order_by(desc(TestSession.created_at))
    
    sessions_result = await db.execute(query)
    sessions = sessions_result.scalars().all()
    
    results = []
    
    for session in sessions:
        # Get application status if exists
        app_status = None
        if session.candidate_email:
            app_result = await db.execute(
                select(AssessmentApplication)
                .join(Candidate)
                .where(
                    and_(
                        Candidate.email == session.candidate_email,
                        AssessmentApplication.assessment_id == assessment.id
                    )
                )
            )
            application = app_result.scalar_one_or_none()
            app_status = application.status if application else None
        
        # Build question-by-question results
        question_results = []
        for answer in session.answers:
            question = answer.question
            question_results.append(DetailedQuestionResult(
                question_id=question.id,
                question_text=question.question_text,
                topic=question.topic,
                difficulty=question.difficulty,
                candidate_answer=answer.selected_answer,
                correct_answer=question.correct_answer,
                is_correct=answer.is_correct or False,
                options=question.options,
                time_taken_seconds=answer.time_taken_seconds
            ))
        
        # Calculate duration
        duration_seconds = None
        if session.completed_at and session.started_at:
            duration_seconds = int((session.completed_at - session.started_at).total_seconds())
        
        results.append(CandidateResultDetail(
            session_id=session.session_id,
            candidate_name=session.candidate_name,
            candidate_email=session.candidate_email,
            assessment_id=assessment.assessment_id,
            assessment_title=assessment.title,
            job_title=assessment.job_title,
            started_at=session.started_at,
            completed_at=session.completed_at,
            duration_seconds=duration_seconds,
            total_questions=session.total_questions,
            answered_questions=len(session.answers),
            correct_answers=session.correct_answers or 0,
            score_percentage=session.score_percentage,
            is_completed=session.is_completed,
            is_scored=session.is_scored,
            questions=question_results,
            application_status=app_status
        ))
    
    return results


@router.get("/session/{session_id}", response_model=CandidateResultDetail)
async def get_session_detailed_result(
    session_id: str,
    current_user: User = Depends(admin_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Get detailed results for a specific test session.
    
    Admin only. Returns complete breakdown including all questions and answers.
    """
    # Get session with relationships
    session_result = await db.execute(
        select(TestSession)
        .options(
            selectinload(TestSession.answers).selectinload(Answer.question),
            selectinload(TestSession.user)
        )
        .where(TestSession.session_id == session_id)
    )
    session = session_result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test session not found"
        )
    
    # Get associated assessment
    assess_result = await db.execute(
        select(Assessment).where(Assessment.question_set_id == session.question_set_id)
    )
    assessment = assess_result.scalar_one_or_none()
    
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated assessment not found"
        )
    
    # Get application status
    app_status = None
    if session.candidate_email:
        app_result = await db.execute(
            select(AssessmentApplication)
            .join(Candidate)
            .where(
                and_(
                    Candidate.email == session.candidate_email,
                    AssessmentApplication.assessment_id == assessment.id
                )
            )
        )
        application = app_result.scalar_one_or_none()
        app_status = application.status if application else None
    
    # Build question results
    question_results = []
    for answer in session.answers:
        question = answer.question
        question_results.append(DetailedQuestionResult(
            question_id=question.id,
            question_text=question.question_text,
            topic=question.topic,
            difficulty=question.difficulty,
            candidate_answer=answer.selected_answer,
            correct_answer=question.correct_answer,
            is_correct=answer.is_correct or False,
            options=question.options,
            time_taken_seconds=answer.time_taken_seconds
        ))
    
    # Calculate duration
    duration_seconds = None
    if session.completed_at and session.started_at:
        duration_seconds = int((session.completed_at - session.started_at).total_seconds())
    
    return CandidateResultDetail(
        session_id=session.session_id,
        candidate_name=session.candidate_name,
        candidate_email=session.candidate_email,
        assessment_id=assessment.assessment_id,
        assessment_title=assessment.title,
        job_title=assessment.job_title,
        started_at=session.started_at,
        completed_at=session.completed_at,
        duration_seconds=duration_seconds,
        total_questions=session.total_questions,
        answered_questions=len(session.answers),
        correct_answers=session.correct_answers or 0,
        score_percentage=session.score_percentage,
        is_completed=session.is_completed,
        is_scored=session.is_scored,
        questions=question_results,
        application_status=app_status
    )


@router.post("/session/{session_id}/share", response_model=ShareResultResponse)
async def share_session_result(
    session_id: str,
    request: ShareResultRequest,
    current_user: User = Depends(admin_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Share detailed assessment results via email.
    
    Creates a shareable link and optionally sends email notifications.
    Admin only.
    """
    # Verify session exists
    session_result = await db.execute(
        select(TestSession).where(TestSession.session_id == session_id)
    )
    session = session_result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test session not found"
        )
    
    if not session.is_completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot share results for incomplete assessment"
        )
    
    # Create share link directly (no token system needed for admin sharing)
    share_link = f"{settings.APP_URL}/admin/assessment-results/{session_id}"
    
    # TODO: Send email notifications using Brevo/email service
    # For now, return success with share link
    # In production, integrate with app.services.email_service
    
    try:
        # Import email service if available
        from app.services.email_service import send_result_share_email
        
        for email in request.recipient_emails:
            await send_result_share_email(
                recipient_email=email,
                candidate_name=session.candidate_name or "Candidate",
                assessment_title=session.question_set_id,  # TODO: Get actual title
                score_percentage=session.score_percentage,
                share_link=share_link,
                custom_message=request.message,
                include_detailed_answers=request.include_answers
            )
        
        message = f"Results shared successfully with {len(request.recipient_emails)} recipient(s)"
    except ImportError:
        # Email service not configured, just return link
        message = f"Share link generated. Email service not configured. Share this link: {share_link}"
    except Exception as e:
        # Email failed but link still works
        message = f"Share link generated, but email failed: {str(e)}"
    
    return ShareResultResponse(
        success=True,
        message=message,
        share_link=share_link
    )


@router.patch("/session/{session_id}/status")
async def update_candidate_status(
    session_id: str,
    new_status: str = Query(..., description="New status: pending, shortlisted, rejected"),
    current_user: User = Depends(admin_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Update candidate application status based on assessment results.
    
    Admin only.
    """
    valid_statuses = ["pending", "in_progress", "completed", "shortlisted", "rejected"]
    if new_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )
    
    # Get session
    session_result = await db.execute(
        select(TestSession).where(TestSession.session_id == session_id)
    )
    session = session_result.scalar_one_or_none()
    
    if not session or not session.candidate_email:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test session not found or no associated candidate"
        )
    
    # Find and update application
    app_result = await db.execute(
        select(AssessmentApplication)
        .join(Candidate)
        .join(Assessment)
        .where(
            and_(
                Candidate.email == session.candidate_email,
                Assessment.question_set_id == session.question_set_id
            )
        )
    )
    application = app_result.scalar_one_or_none()
    
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No application found for this candidate and assessment"
        )
    
    application.status = new_status
    application.updated_at = datetime.utcnow()
    
    await db.commit()
    
    return {
        "success": True,
        "message": f"Candidate status updated to: {new_status}",
        "application_id": application.application_id,
        "new_status": new_status
    }
