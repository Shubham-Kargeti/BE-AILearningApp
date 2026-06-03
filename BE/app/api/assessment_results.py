"""Assessment results API endpoints for admin review and sharing."""
import asyncio
from datetime import datetime, timedelta, timezone
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
    AssessmentApplication, Candidate, SessionFeedback
)
from app.utils.generate_questions import _get_llm
from config import get_settings

settings = get_settings()
router = APIRouter(prefix="/api/v1/admin/assessment-results", tags=["assessment-results"])


class DetailedQuestionResult(BaseModel):
    """Detailed result for a single question."""
    question_id: int
    question_text: str
    question_type: Optional[str] = None
    topic: Optional[str] = None
    difficulty: Optional[str] = None
    candidate_answer: str
    correct_answer: str
    is_correct: bool
    options: Optional[dict] = None
    time_taken_seconds: Optional[int] = None


def resolve_question_type(question: Question) -> str:
    if isinstance(question.options, dict):
        qtype = question.options.get("type")
        if isinstance(qtype, str) and qtype:
            return qtype
    return "mcq"


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
    session_feedback: Optional[str] = None
    session_feedback_status: Optional[str] = None
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


class UpdateAnswerRequest(BaseModel):
    """Request payload for updating an individual answer's correctness."""
    is_correct: bool


class SessionFeedbackRequest(BaseModel):
    """Admin-edited overall feedback for a session."""
    feedback_text: str
    publish: bool = True


class SessionFeedbackResponse(BaseModel):
    """Overall feedback for a candidate assessment session."""
    feedback_id: int
    session_id: str
    llm_feedback_text: str
    feedback_text: str
    status: str
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


def _serialize_session_feedback(session: TestSession, feedback: SessionFeedback) -> SessionFeedbackResponse:
    return SessionFeedbackResponse(
        feedback_id=feedback.id,
        session_id=session.session_id,
        llm_feedback_text=feedback.llm_feedback_text,
        feedback_text=feedback.feedback_text,
        status=feedback.status,
        published_at=feedback.published_at,
        created_at=feedback.created_at,
        updated_at=feedback.updated_at,
    )


def _fallback_session_feedback(session: TestSession, answers: List[Answer]) -> str:
    answered = len(answers)
    correct = session.correct_answers or sum(1 for answer in answers if answer.is_correct)
    score = session.score_percentage
    score_text = f"{score:.1f}%" if score is not None else "not available"

    missed_topics = []
    strong_topics = []
    for answer in answers:
        topic = answer.question.topic if answer.question else None
        if not topic:
            continue
        if answer.is_correct and topic not in strong_topics:
            strong_topics.append(topic)
        if not answer.is_correct and topic not in missed_topics:
            missed_topics.append(topic)

    strengths = ", ".join(strong_topics[:4]) or "areas where the candidate answered correctly"
    improvements = ", ".join(missed_topics[:4]) or "topics connected to incorrect or incomplete responses"

    return (
        f"The candidate completed {answered} of {session.total_questions} questions with "
        f"{correct} correct answers and a score of {score_text}. Strengths were visible in "
        f"{strengths}. The main improvement areas are {improvements}. Overall, review the "
        "answer quality, depth of reasoning, and consistency before making the final decision."
    )


async def _generate_session_feedback_text(
    session: TestSession,
    assessment: Optional[Assessment],
    answers: List[Answer],
) -> str:
    fallback = _fallback_session_feedback(session, answers)
    try:
        question_lines = []
        for index, answer in enumerate(answers, start=1):
            question = answer.question
            question_lines.append(
                "\n".join(
                    [
                        f"{index}. Question: {question.question_text if question else answer.question_id}",
                        f"Topic: {question.topic if question else 'N/A'}",
                        f"Difficulty: {question.difficulty if question else 'N/A'}",
                        f"Candidate answer: {answer.selected_answer}",
                        f"Expected answer: {question.correct_answer if question else 'N/A'}",
                        f"Marked correct: {bool(answer.is_correct)}",
                    ]
                )
            )

        prompt = (
            "You are generating concise assessment feedback for an admin to review and edit before "
            "publishing to a candidate. Focus on overall performance across the whole assessment. "
            "Mention strengths, improvement areas, and an actionable next step. Do not include JSON.\n\n"
            f"Assessment: {assessment.title if assessment else session.question_set_id}\n"
            f"Job title: {assessment.job_title if assessment else 'N/A'}\n"
            f"Candidate: {session.candidate_name or session.candidate_email or 'Candidate'}\n"
            f"Score: {session.score_percentage if session.score_percentage is not None else 'N/A'}\n"
            f"Correct answers: {session.correct_answers}/{session.total_questions}\n\n"
            "Question results:\n"
            + "\n\n".join(question_lines)
        )
        llm = _get_llm()
        response = await asyncio.to_thread(
            llm.invoke,
            [
                {"role": "system", "content": "You write clear, fair candidate assessment feedback."},
                {"role": "user", "content": prompt},
            ],
        )
        content = response.content if hasattr(response, "content") else str(response)
        content = content.strip()
        return content or fallback
    except Exception:
        return fallback


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

        feedback_result = await db.execute(
            select(SessionFeedback).where(SessionFeedback.test_session_id == session.id)
        )
        session_feedback = feedback_result.scalar_one_or_none()
        
        # Build question-by-question results
        question_results = []
        for answer in session.answers:
            question = answer.question
            question_results.append(DetailedQuestionResult(
                question_id=question.id,
                question_text=question.question_text,
                question_type=resolve_question_type(question),
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
            session_feedback=session_feedback.feedback_text if session_feedback else None,
            session_feedback_status=session_feedback.status if session_feedback else None,
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

    feedback_result = await db.execute(
        select(SessionFeedback).where(SessionFeedback.test_session_id == session.id)
    )
    session_feedback = feedback_result.scalar_one_or_none()
    
    # Build question results
    question_results = []
    for answer in session.answers:
        question = answer.question
        question_results.append(DetailedQuestionResult(
            question_id=question.id,
            question_text=question.question_text,
            question_type=resolve_question_type(question),
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
        session_feedback=session_feedback.feedback_text if session_feedback else None,
        session_feedback_status=session_feedback.status if session_feedback else None,
        application_status=app_status
    )


@router.get("/session/{session_id}/feedback", response_model=Optional[SessionFeedbackResponse])
async def get_session_feedback(
    session_id: str,
    current_user: User = Depends(admin_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Get admin-editable overall feedback for a test session.

    Returns the current draft or published feedback. Use the generate endpoint
    first when no feedback exists yet.
    """
    session_result = await db.execute(
        select(TestSession).where(TestSession.session_id == session_id)
    )
    session = session_result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test session not found"
        )

    feedback_result = await db.execute(
        select(SessionFeedback).where(SessionFeedback.test_session_id == session.id)
    )
    feedback = feedback_result.scalar_one_or_none()
    if not feedback:
        return None

    return _serialize_session_feedback(session, feedback)


@router.post("/session/{session_id}/feedback/generate", response_model=SessionFeedbackResponse)
async def generate_session_feedback(
    session_id: str,
    current_user: User = Depends(admin_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Generate or regenerate LLM feedback for the whole assessment session.

    The generated text is saved as a draft so the admin can edit it before
    publishing it to the candidate.
    """
    session_result = await db.execute(
        select(TestSession)
        .options(selectinload(TestSession.answers).selectinload(Answer.question))
        .where(TestSession.session_id == session_id)
    )
    session = session_result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test session not found"
        )
    if not session.answers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot generate feedback because no answers exist for this session"
        )

    assessment_result = await db.execute(
        select(Assessment).where(Assessment.question_set_id == session.question_set_id)
    )
    assessment = assessment_result.scalar_one_or_none()

    generated_text = await _generate_session_feedback_text(session, assessment, list(session.answers))

    feedback_result = await db.execute(
        select(SessionFeedback).where(SessionFeedback.test_session_id == session.id)
    )
    feedback = feedback_result.scalar_one_or_none()

    if feedback:
        feedback.llm_feedback_text = generated_text
        feedback.feedback_text = generated_text
        feedback.status = "draft"
        feedback.published_at = None
        feedback.updated_by = current_user.id
    else:
        feedback = SessionFeedback(
            test_session_id=session.id,
            created_by=current_user.id,
            updated_by=current_user.id,
            llm_feedback_text=generated_text,
            feedback_text=generated_text,
            status="draft",
        )
        db.add(feedback)

    await db.commit()
    await db.refresh(feedback)

    return _serialize_session_feedback(session, feedback)


@router.put("/session/{session_id}/feedback", response_model=SessionFeedbackResponse)
async def submit_session_feedback(
    session_id: str,
    payload: SessionFeedbackRequest,
    current_user: User = Depends(admin_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Save the admin-edited session feedback.

    By default this publishes the feedback, making it visible to the candidate.
    Send publish=false to save it as an admin-only draft.
    """
    feedback_text = payload.feedback_text.strip()
    if not feedback_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="feedback_text cannot be empty"
        )

    session_result = await db.execute(
        select(TestSession).where(TestSession.session_id == session_id)
    )
    session = session_result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test session not found"
        )

    feedback_result = await db.execute(
        select(SessionFeedback).where(SessionFeedback.test_session_id == session.id)
    )
    feedback = feedback_result.scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if feedback:
        feedback.feedback_text = feedback_text
        feedback.status = "published" if payload.publish else "draft"
        feedback.published_at = now if payload.publish else None
        feedback.updated_by = current_user.id
    else:
        feedback = SessionFeedback(
            test_session_id=session.id,
            created_by=current_user.id,
            updated_by=current_user.id,
            llm_feedback_text=feedback_text,
            feedback_text=feedback_text,
            status="published" if payload.publish else "draft",
            published_at=now if payload.publish else None,
        )
        db.add(feedback)

    await db.commit()
    await db.refresh(feedback)

    return _serialize_session_feedback(session, feedback)


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


@router.patch("/session/{session_id}/answer/{question_id}")
async def update_answer_correctness(
    session_id: str,
    question_id: int,
    payload: UpdateAnswerRequest,
    current_user: User = Depends(admin_required),
    db: AsyncSession = Depends(get_db)
):
    """
    Manually mark a candidate's answer as correct or incorrect.

    This endpoint allows admins to override the automatic scoring for a
    specific question.  It updates the `Answer.is_correct` flag and then
    recalculates the parent `TestSession`'s correct_answers and
    score_percentage.  The session is marked as scored afterwards.
    """
    # fetch answer record
    ans_result = await db.execute(
        select(Answer)
        .join(TestSession)
        .where(
            and_(
                Answer.session_id == session_id,
                Answer.question_id == question_id
            )
        )
    )
    answer = ans_result.scalar_one_or_none()
    if not answer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Answer not found for given session/question"
        )

    # update correctness
    answer.is_correct = payload.is_correct

    # recalc session aggregates
    session_result = await db.execute(
        select(TestSession).options(selectinload(TestSession.answers))
        .where(TestSession.session_id == session_id)
    )
    session = session_result.scalar_one_or_none()
    if not session:
        # should not happen since answer joined session above,
        # but guard for safety
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test session not found"
        )
    completed_at = datetime.now(timezone.utc)
    session.is_scored = True
    session.completed_at = completed_at
    # compute totals
    correct_count = sum(1 for a in session.answers if a.is_correct)
    session.correct_answers = correct_count
    if session.total_questions and session.total_questions > 0:
        session.score_percentage = (correct_count / session.total_questions) * 100
    else:
        session.score_percentage = None
    session.is_scored = True

    await db.commit()

    return {
        "success": True,
        "session_id": session.session_id,
        "question_id": question_id,
        "is_correct": payload.is_correct,
        "correct_answers": session.correct_answers,
        "score_percentage": session.score_percentage,
    }
