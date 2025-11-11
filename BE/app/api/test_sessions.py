"""Test session API - Backend logic only (MVP-1)."""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.db.session import get_db
from app.db.models import User, TestSession, Question, Answer, JobDescription
from app.core.dependencies import get_current_user
from app.core.redis import RedisService, get_redis
from app.core.tasks.score_release import schedule_score_release
from app.core.metrics import test_sessions_total, active_test_sessions, test_scores
from config import get_settings

settings = get_settings()
router = APIRouter()


# Pydantic Models
class StartTestRequest(BaseModel):
    """Start test request."""
    topic: str
    difficulty_level: str  # basic, intermediate, expert
    num_questions: int = 20


class TestSessionResponse(BaseModel):
    """Test session response."""
    session_id: str
    jd_id: str
    total_questions: int
    duration_seconds: int
    started_at: str
    expires_at: str
    current_question_index: int = 0


class QuestionResponse(BaseModel):
    """Question response."""
    question_id: int
    question_number: int
    total_questions: int
    question_text: str
    options: dict
    difficulty: Optional[str] = None


class SubmitAnswerRequest(BaseModel):
    """Submit answer request."""
    question_id: int
    selected_answer: str  # A, B, C, D


class SessionStatusResponse(BaseModel):
    """Session status response."""
    session_id: str
    is_active: bool
    is_completed: bool
    time_started: str
    time_remaining_seconds: int
    questions_answered: int
    total_questions: int
    current_question_index: int


class CompleteTestResponse(BaseModel):
    """Complete test response."""
    session_id: str
    status: str
    total_questions: int
    answered_questions: int
    score_will_release_at: str


@router.post("/test/sessions", response_model=TestSessionResponse)
async def start_test_session(
    request: StartTestRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> TestSessionResponse:
    """
    Start a new test session.
    
    Backend creates session, initializes timer in Redis, returns session data.
    Frontend is responsible for displaying timer and navigation.
    """
    # Validate difficulty level
    if request.difficulty_level not in settings.DIFFICULTY_LEVELS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid difficulty level. Must be one of: {', '.join(settings.DIFFICULTY_LEVELS)}"
        )
    
    # Get or create topic-based job description
    topic_jd_id = f"topic_{request.topic}"
    result = await db.execute(
        select(JobDescription).where(JobDescription.jd_id == topic_jd_id)
    )
    jd = result.scalar_one_or_none()
    
    if not jd:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No content available for topic '{request.topic}'. Contact administrator."
        )
    
    # Verify questions exist
    questions_count = await db.execute(
        select(func.count(Question.id)).where(Question.jd_id == topic_jd_id)
    )
    if questions_count.scalar() < request.num_questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Not enough questions available. Requested: {request.num_questions}"
        )
    
    # Create test session
    started_at = datetime.utcnow()
    duration_seconds = settings.TEST_DURATION_MINUTES * 60
    expires_at = started_at + timedelta(seconds=duration_seconds)
    
    test_session = TestSession(
        jd_id=topic_jd_id,
        user_id=current_user.id,
        candidate_name=current_user.full_name,
        candidate_email=current_user.email,
        started_at=started_at,
        total_questions=request.num_questions,
        is_completed=False
    )
    
    db.add(test_session)
    await db.commit()
    await db.refresh(test_session)
    
    # Initialize session state in Redis
    redis_service = RedisService(get_redis())
    session_key = f"session:{test_session.session_id}"
    
    # Store session metadata
    await redis_service.cache_set(
        f"{session_key}:metadata",
        {
            "started_at": started_at.isoformat(),
            "expires_at": expires_at.isoformat(),
            "duration_seconds": duration_seconds,
            "current_question_index": 0,
            "difficulty_level": request.difficulty_level
        },
        expiry=duration_seconds + 300
    )
    
    # Set session expiry timer
    await redis_service.set_test_timer(test_session.session_id, duration_seconds)
    
    # Metrics
    test_sessions_total.labels(status="started").inc()
    active_test_sessions.inc()
    
    return TestSessionResponse(
        session_id=test_session.session_id,
        jd_id=topic_jd_id,
        total_questions=request.num_questions,
        duration_seconds=duration_seconds,
        started_at=started_at.isoformat(),
        expires_at=expires_at.isoformat(),
        current_question_index=0
    )


@router.get("/test/sessions/{session_id}", response_model=SessionStatusResponse)
async def get_session_status(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> SessionStatusResponse:
    """
    Get current session status.
    
    Returns time remaining, question progress, etc.
    Frontend uses this to display timer and determine if session expired.
    """
    # Get session from database
    result = await db.execute(
        select(TestSession).where(
            and_(
                TestSession.session_id == session_id,
                TestSession.user_id == current_user.id
            )
        )
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    # Get time remaining from Redis
    redis_service = RedisService(get_redis())
    time_remaining = await redis_service.get_test_remaining_time(session_id)
    
    # Get current question index
    metadata = await redis_service.cache_get(f"session:{session_id}:metadata")
    current_index = metadata.get("current_question_index", 0) if metadata else 0
    
    # Count answered questions
    answers_result = await db.execute(
        select(func.count(Answer.id)).where(Answer.session_id == session_id)
    )
    answered_count = answers_result.scalar() or 0
    
    return SessionStatusResponse(
        session_id=session_id,
        is_active=not session.is_completed and (time_remaining or 0) > 0,
        is_completed=session.is_completed,
        time_started=session.started_at.isoformat(),
        time_remaining_seconds=time_remaining or 0,
        questions_answered=answered_count,
        total_questions=session.total_questions,
        current_question_index=current_index
    )


@router.get("/test/sessions/{session_id}/questions/{question_number}", response_model=QuestionResponse)
async def get_question(
    session_id: str,
    question_number: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> QuestionResponse:
    """
    Get specific question by number (1-indexed).
    
    Backend returns question data.
    Frontend handles display, timing, and navigation.
    """
    # Verify session ownership
    result = await db.execute(
        select(TestSession).where(
            and_(
                TestSession.session_id == session_id,
                TestSession.user_id == current_user.id
            )
        )
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    if session.is_completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session already completed"
        )
    
    # Validate question number
    if question_number < 1 or question_number > session.total_questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid question number. Must be between 1 and {session.total_questions}"
        )
    
    # Get questions for this session (ordered by ID)
    questions_result = await db.execute(
        select(Question)
        .where(Question.jd_id == session.jd_id)
        .order_by(Question.id)
        .limit(session.total_questions)
    )
    questions = questions_result.scalars().all()
    
    if len(questions) < question_number:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )
    
    # Get the specific question (convert to 0-indexed)
    question = questions[question_number - 1]
    
    # Update current question index in Redis
    redis_service = RedisService(get_redis())
    metadata = await redis_service.cache_get(f"session:{session_id}:metadata") or {}
    metadata["current_question_index"] = question_number - 1
    await redis_service.cache_set(
        f"session:{session_id}:metadata",
        metadata,
        expiry=settings.TEST_DURATION_MINUTES * 60 + 300
    )
    
    return QuestionResponse(
        question_id=question.id,
        question_number=question_number,
        total_questions=session.total_questions,
        question_text=question.question_text,
        options=question.options,
        difficulty=question.difficulty
    )


@router.post("/test/sessions/{session_id}/answers")
async def submit_answer(
    session_id: str,
    answer: SubmitAnswerRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Submit answer for a question.
    
    Backend validates and stores answer.
    Does NOT return if answer is correct (to prevent cheating).
    Frontend moves to next question after successful submission.
    """
    # Verify session
    result = await db.execute(
        select(TestSession).where(
            and_(
                TestSession.session_id == session_id,
                TestSession.user_id == current_user.id
            )
        )
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    if session.is_completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session already completed"
        )
    
    # Check if already answered
    existing = await db.execute(
        select(Answer).where(
            and_(
                Answer.session_id == session_id,
                Answer.question_id == answer.question_id
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question already answered"
        )
    
    # Get question to validate answer
    question_result = await db.execute(
        select(Question).where(Question.id == answer.question_id)
    )
    question = question_result.scalar_one_or_none()
    
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found"
        )
    
    # Validate answer format
    if answer.selected_answer not in question.options:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid answer. Must be one of: {', '.join(question.options.keys())}"
        )
    
    # Check correctness (don't return to frontend)
    is_correct = answer.selected_answer == question.correct_answer
    
    # Save answer
    answer_record = Answer(
        session_id=session_id,
        question_id=answer.question_id,
        selected_answer=answer.selected_answer,
        is_correct=is_correct
    )
    
    db.add(answer_record)
    await db.commit()
    
    # Return success WITHOUT revealing correctness
    return {
        "status": "success",
        "message": "Answer submitted successfully",
        "question_id": answer.question_id
    }


@router.post("/test/sessions/{session_id}/complete", response_model=CompleteTestResponse)
async def complete_test_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> CompleteTestResponse:
    """
    Complete test session.
    
    Backend calculates score (hidden), schedules release via Celery.
    Returns when score will be available.
    """
    # Get session
    result = await db.execute(
        select(TestSession).where(
            and_(
                TestSession.session_id == session_id,
                TestSession.user_id == current_user.id
            )
        )
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    if session.is_completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session already completed"
        )
    
    # Get all answers
    answers_result = await db.execute(
        select(Answer).where(Answer.session_id == session_id)
    )
    answers = answers_result.scalars().all()
    
    # Calculate score (store but don't reveal)
    correct_count = sum(1 for a in answers if a.is_correct)
    score_percentage = (correct_count / session.total_questions * 100) if session.total_questions > 0 else 0
    
    # Update session
    completed_at = datetime.utcnow()
    session.is_completed = True
    session.completed_at = completed_at
    session.duration_seconds = int((completed_at - session.started_at).total_seconds())
    session.correct_answers = correct_count
    session.score_percentage = score_percentage
    
    await db.commit()
    
    # Schedule score release (Celery task)
    score_release_time = completed_at + timedelta(hours=settings.SCORE_RELEASE_DELAY_HOURS)
    schedule_score_release.delay(
        session_id=session_id,
        delay_hours=settings.SCORE_RELEASE_DELAY_HOURS
    )
    
    # Clean up Redis
    redis_service = RedisService(get_redis())
    await redis_service.delete_session(session_id)
    
    # Metrics
    active_test_sessions.dec()
    test_sessions_total.labels(status="completed").inc()
    test_scores.observe(score_percentage)
    
    return CompleteTestResponse(
        session_id=session_id,
        status="completed",
        total_questions=session.total_questions,
        answered_questions=len(answers),
        score_will_release_at=score_release_time.isoformat()
    )


@router.get("/test/sessions/{session_id}/results")
async def get_test_results(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Get test results (only available after score release).
    
    Backend checks if score has been released.
    Returns full results with correct/incorrect answers.
    """
    # Get session
    result = await db.execute(
        select(TestSession).where(
            and_(
                TestSession.session_id == session_id,
                TestSession.user_id == current_user.id
            )
        )
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    if not session.is_completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Test not yet completed"
        )
    
    # Check if score has been released
    if not session.is_scored:
        # Calculate when it will be released
        estimated_release = session.completed_at + timedelta(hours=settings.SCORE_RELEASE_DELAY_HOURS)
        
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "message": "Results not yet available",
                "completed_at": session.completed_at.isoformat(),
                "estimated_release_at": estimated_release.isoformat(),
                "status": "processing"
            }
        )
    
    # Score has been released - return full results
    answers_result = await db.execute(
        select(Answer, Question)
        .join(Question, Answer.question_id == Question.id)
        .where(Answer.session_id == session_id)
    )
    
    detailed_results = []
    for answer, question in answers_result:
        detailed_results.append({
            "question_id": question.id,
            "question_text": question.question_text,
            "your_answer": answer.selected_answer,
            "correct_answer": question.correct_answer,
            "is_correct": answer.is_correct,
            "options": question.options
        })
    
    return {
        "session_id": session_id,
        "score_percentage": session.score_percentage,
        "correct_answers": session.correct_answers,
        "total_questions": session.total_questions,
        "completed_at": session.completed_at.isoformat(),
        "score_released_at": session.score_released_at.isoformat(),
        "detailed_results": detailed_results
    }
