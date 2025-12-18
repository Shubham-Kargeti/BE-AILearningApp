"""QuestionSet Test API - Immediate feedback flow."""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.db.session import get_db
from app.db.models import User, TestSession, Question, Answer, QuestionSet
from app.core.dependencies import get_current_user, optional_user
from app.utils.streak_manager import check_and_update_quiz_completion
from app.models.schemas import (
    StartQuestionSetTestRequest,
    StartQuestionSetTestResponse,
    SubmitAllAnswersRequest,
    TestResultResponse,
    MCQQuestion,
    MCQOption,
    QuestionResultDetailed
)

router = APIRouter()

# ------------------------------------------------------------
# Question Serialization Helpers (ADMIN + MIXED TYPES SUPPORT)
# ------------------------------------------------------------

def resolve_question_type(question: Question) -> str:
    """
    Detect question type from options JSON.

    Supported:
    - mcq (default)
    - coding
    - architecture
    """
    if isinstance(question.options, dict):
        qtype = question.options.get("type")
        if qtype in ("coding", "architecture"):
            return qtype
    return "mcq"


def serialize_question_for_test(question: Question) -> dict:
    """
    Serialize Question model into FE-safe payload
    WITHOUT exposing correct answers.

    This supports mixed question types while remaining
    backward compatible with MCQ flow.
    """
    qtype = resolve_question_type(question)

    payload = {
        "id": question.id,              # internal safety
        "question_id": question.id,     # FE expects this
        "question_text": question.question_text,
        "question_type": qtype,
    }

    if qtype == "mcq":
        payload["options"] = question.options
    else:
        payload["meta"] = {
            k: v for k, v in question.options.items()
            if k != "type"
        }

    return payload
@router.post("/questionset-tests/start")
async def start_questionset_test(
    request: StartQuestionSetTestRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    🚀 Start a Test Session from a QuestionSet

    Creates a new test session and returns all questions for the user to answer.
    """
    # --------------------------------------------------
    # Get QuestionSet
    # --------------------------------------------------
    result = await db.execute(
        select(QuestionSet).where(
            QuestionSet.question_set_id == request.question_set_id
        )
    )
    question_set = result.scalar_one_or_none()

    if not question_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"QuestionSet '{request.question_set_id}' not found"
        )

    # --------------------------------------------------
    # Get all questions for this set
    # --------------------------------------------------
    questions_result = await db.execute(
        select(Question)
        .where(Question.question_set_id == request.question_set_id)
        .order_by(Question.id)
    )
    questions = questions_result.scalars().all()

    if not questions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No questions found for QuestionSet '{request.question_set_id}'"
        )

    # --------------------------------------------------
    # Create test session
    # --------------------------------------------------
    started_at = datetime.now(timezone.utc)
    test_session = TestSession(
        question_set_id=request.question_set_id,
        user_id=current_user.id,
        candidate_name=current_user.full_name,
        candidate_email=current_user.email,
        started_at=started_at,
        total_questions=len(questions),
        is_completed=False,
        is_scored=False
    )

    db.add(test_session)
    await db.commit()
    await db.refresh(test_session)

    # --------------------------------------------------
    # Serialize questions (MIXED TYPES SUPPORTED)
    # --------------------------------------------------
    question_list = [
        serialize_question_for_test(q)
        for q in questions
    ]

    return {
        "session_id": test_session.session_id,
        "question_set_id": question_set.question_set_id,
        "skill": question_set.skill,
        "level": question_set.level,
        "total_questions": question_set.total_questions,
        "started_at": started_at,
        "questions": question_list,
    }
class StartQuestionSetTestCandidateRequest(StartQuestionSetTestRequest):
    candidate_name: Optional[str] = None
    candidate_email: Optional[str] = None


@router.post("/questionset-tests/start/anonymous")
async def start_questionset_test_anonymous(
    request: StartQuestionSetTestCandidateRequest,
    current_user: Optional[User] = Depends(optional_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Start a QuestionSet test for anonymous/guest candidates.
    """
    # --------------------------------------------------
    # Get QuestionSet
    # --------------------------------------------------
    result = await db.execute(
        select(QuestionSet).where(
            QuestionSet.question_set_id == request.question_set_id
        )
    )
    question_set = result.scalar_one_or_none()

    if not question_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"QuestionSet '{request.question_set_id}' not found"
        )

    # --------------------------------------------------
    # Get all questions for this set
    # --------------------------------------------------
    questions_result = await db.execute(
        select(Question)
        .where(Question.question_set_id == request.question_set_id)
        .order_by(Question.id)
    )
    questions = questions_result.scalars().all()

    if not questions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No questions found for QuestionSet '{request.question_set_id}'"
        )

    # --------------------------------------------------
    # Create test session (anonymous / optional user)
    # --------------------------------------------------
    started_at = datetime.now(timezone.utc)
    test_session = TestSession(
        question_set_id=request.question_set_id,
        user_id=current_user.id if current_user else None,
        candidate_name=(
            current_user.full_name if current_user else request.candidate_name
        ),
        candidate_email=(
            current_user.email if current_user else request.candidate_email
        ),
        started_at=started_at,
        total_questions=len(questions),
        is_completed=False,
        is_scored=False
    )

    db.add(test_session)
    await db.commit()
    await db.refresh(test_session)

    # --------------------------------------------------
    # Serialize questions (MIXED TYPES SUPPORTED)
    # --------------------------------------------------
    question_list = [
        serialize_question_for_test(q)
        for q in questions
    ]

    return {
        "session_id": test_session.session_id,
        "question_set_id": question_set.question_set_id,
        "skill": question_set.skill,
        "level": question_set.level,
        "total_questions": question_set.total_questions,
        "started_at": started_at,
        "questions": question_list,
    }


@router.post("/questionset-tests/submit", response_model=TestResultResponse)
async def submit_questionset_answers(
    request: SubmitAllAnswersRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> TestResultResponse:
    """
    Submit all answers for a QuestionSet test (authenticated).
    Supports MCQ + Coding + Architecture.
    """

    # --------------------------------------------------
    # Get and validate session
    # --------------------------------------------------
    result = await db.execute(
        select(TestSession).where(
            and_(
                TestSession.session_id == request.session_id,
                TestSession.user_id == current_user.id
            )
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test session not found"
        )

    if session.is_completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Test session already completed"
        )

    if not session.question_set_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This endpoint is only for QuestionSet-based tests"
        )

    # --------------------------------------------------
    # Load QuestionSet
    # --------------------------------------------------
    qs_result = await db.execute(
        select(QuestionSet).where(
            QuestionSet.question_set_id == session.question_set_id
        )
    )
    question_set = qs_result.scalar_one_or_none()

    if not question_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="QuestionSet not found"
        )

    # --------------------------------------------------
    # Load questions
    # --------------------------------------------------
    questions_result = await db.execute(
        select(Question).where(
            Question.question_set_id == session.question_set_id
        )
    )
    questions = {q.id: q for q in questions_result.scalars().all()}

    correct_count = 0
    answer_records = []

    # --------------------------------------------------
    # Process answers
    # --------------------------------------------------
    for answer_submit in request.answers:
        question = questions.get(answer_submit.question_id)

        if not question:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Question {answer_submit.question_id} not found"
            )

        qtype = resolve_question_type(question)

        # ---------- MCQ ----------
        if qtype == "mcq":
            if answer_submit.selected_answer not in question.options:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid answer '{answer_submit.selected_answer}'"
                )

            is_correct = (
                answer_submit.selected_answer == question.correct_answer
            )

        # ---------- CODING / ARCHITECTURE ----------
        else:
            if (
                not isinstance(answer_submit.selected_answer, str)
                or not answer_submit.selected_answer.strip()
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Answer cannot be empty"
                )

            is_correct = False  # demo-safe

        if is_correct:
            correct_count += 1

        answer_records.append(
            Answer(
                session_id=request.session_id,
                question_id=answer_submit.question_id,
                selected_answer=answer_submit.selected_answer,
                is_correct=is_correct
            )
        )

    db.add_all(answer_records)

    # --------------------------------------------------
    # Finalize session
    # --------------------------------------------------
    completed_at = datetime.now(timezone.utc)
    duration_seconds = int(
        (completed_at - session.started_at).total_seconds()
    )

    score_percentage = (
        (correct_count / session.total_questions) * 100
        if session.total_questions > 0 else 0
    )

    session.is_completed = True
    session.completed_at = completed_at
    session.duration_seconds = duration_seconds
    session.correct_answers = correct_count
    session.score_percentage = score_percentage
    session.is_scored = True
    session.score_released_at = completed_at

    await db.commit()

    await check_and_update_quiz_completion(
        current_user,
        db,
        test_completed=True
    )

    # --------------------------------------------------
    # Build detailed results (MCQ-safe)
    # --------------------------------------------------
    detailed_results = []
    for answer_submit in request.answers:
        question = questions[answer_submit.question_id]
        qtype = resolve_question_type(question)

        if qtype == "mcq":
            options = [
                MCQOption(option_id=k, text=v)
                for k, v in sorted(question.options.items())
            ]
            correct_answer = question.correct_answer
        else:
            options = []
            correct_answer = None

        detailed_results.append(
            QuestionResultDetailed(
                question_id=question.id,
                question_text=question.question_text,
                options=options,
                your_answer=answer_submit.selected_answer,
                correct_answer=correct_answer,
                is_correct=answer_submit.selected_answer == correct_answer
            )
        )

    return TestResultResponse(
        session_id=request.session_id,
        question_set_id=session.question_set_id,
        skill=question_set.skill,
        level=question_set.level,
        total_questions=session.total_questions,
        correct_answers=correct_count,
        score_percentage=score_percentage,
        completed_at=completed_at,
        time_taken_seconds=duration_seconds,
        detailed_results=detailed_results
    )



@router.post(
    "/questionset-tests/submit/anonymous",
    response_model=TestResultResponse
)
async def submit_questionset_answers_anonymous(
    request: SubmitAllAnswersRequest,
    current_user: Optional[User] = Depends(optional_user),
    db: AsyncSession = Depends(get_db)
) -> TestResultResponse:
    """
    Submit all answers for a QuestionSet test anonymously.
    Supports MCQ + Coding + Architecture (demo-safe).
    """

    # --------------------------------------------------
    # Get and validate session
    # --------------------------------------------------
    result = await db.execute(
        select(TestSession).where(
            TestSession.session_id == request.session_id
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test session not found"
        )

    if session.user_id is not None:
        if not current_user or current_user.id != session.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized submission"
            )

    if session.is_completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Test session already completed"
        )

    if not session.question_set_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This endpoint is only for QuestionSet-based tests"
        )

    # --------------------------------------------------
    # Load QuestionSet
    # --------------------------------------------------
    qs_result = await db.execute(
        select(QuestionSet).where(
            QuestionSet.question_set_id == session.question_set_id
        )
    )
    question_set = qs_result.scalar_one_or_none()

    if not question_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="QuestionSet not found"
        )

    # --------------------------------------------------
    # Load questions
    # --------------------------------------------------
    questions_result = await db.execute(
        select(Question).where(
            Question.question_set_id == session.question_set_id
        )
    )
    questions = {q.id: q for q in questions_result.scalars().all()}

    correct_count = 0
    answer_records = []

    # --------------------------------------------------
    # Process answers
    # --------------------------------------------------
    for answer_submit in request.answers:
        question = questions.get(answer_submit.question_id)

        if not question:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid question"
            )

        qtype = resolve_question_type(question)

        # ---------- MCQ ----------
        if qtype == "mcq":
            if answer_submit.selected_answer not in question.options:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid answer"
                )

            is_correct = (
                answer_submit.selected_answer == question.correct_answer
            )

        # ---------- CODING / ARCHITECTURE ----------
        else:
            if (
                not isinstance(answer_submit.selected_answer, str)
                or not answer_submit.selected_answer.strip()
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Answer cannot be empty"
                )

            is_correct = False  # demo-safe

        if is_correct:
            correct_count += 1

        answer_records.append(
            Answer(
                session_id=request.session_id,
                question_id=answer_submit.question_id,
                selected_answer=answer_submit.selected_answer,
                is_correct=is_correct
            )
        )

    db.add_all(answer_records)

    # --------------------------------------------------
    # Finalize session
    # --------------------------------------------------
    completed_at = datetime.now(timezone.utc)
    duration_seconds = int(
        (completed_at - session.started_at).total_seconds()
    )

    score_percentage = (
        (correct_count / session.total_questions) * 100
        if session.total_questions > 0 else 0
    )

    session.is_completed = True
    session.completed_at = completed_at
    session.duration_seconds = duration_seconds
    session.correct_answers = correct_count
    session.score_percentage = score_percentage
    session.is_scored = True
    session.score_released_at = completed_at

    await db.commit()

    # --------------------------------------------------
    # Build detailed results (MCQ-safe)
    # --------------------------------------------------
    detailed_results = []
    for answer_submit in request.answers:
        question = questions[answer_submit.question_id]
        qtype = resolve_question_type(question)

        if qtype == "mcq":
            options = [
                MCQOption(option_id=k, text=v)
                for k, v in sorted(question.options.items())
            ]
            correct_answer = question.correct_answer
        else:
            options = []
            correct_answer = None

        detailed_results.append(
            QuestionResultDetailed(
                question_id=question.id,
                question_text=question.question_text,
                options=options,
                your_answer=answer_submit.selected_answer,
                correct_answer=correct_answer,
                is_correct=answer_submit.selected_answer == correct_answer
            )
        )

    return TestResultResponse(
        session_id=request.session_id,
        question_set_id=session.question_set_id,
        skill=question_set.skill,
        level=question_set.level,
        total_questions=session.total_questions,
        correct_answers=correct_count,
        score_percentage=score_percentage,
        completed_at=completed_at,
        time_taken_seconds=duration_seconds,
        detailed_results=detailed_results
    )

@router.get(
    "/questionset-tests/{session_id}/results",
    response_model=TestResultResponse
)
async def get_questionset_test_results(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> TestResultResponse:
    """
    📊 Retrieve Test Results
    """
    # --------------------------------------------------
    # Get session
    # --------------------------------------------------
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
            detail="Test session not found"
        )

    if not session.is_completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Test not yet completed"
        )

    if not session.question_set_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This endpoint is only for QuestionSet-based tests"
        )

    # --------------------------------------------------
    # Get QuestionSet
    # --------------------------------------------------
    qs_result = await db.execute(
        select(QuestionSet).where(
            QuestionSet.question_set_id == session.question_set_id
        )
    )
    question_set = qs_result.scalar_one_or_none()

    if not question_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="QuestionSet not found"
        )

    # --------------------------------------------------
    # Get all answers with questions
    # --------------------------------------------------
    answers_result = await db.execute(
        select(Answer, Question)
        .join(Question, Answer.question_id == Question.id)
        .where(Answer.session_id == session_id)
        .order_by(Question.id)
    )

    detailed_results = []
    for answer, question in answers_result:
        options = [
            MCQOption(option_id=k, text=v)
            for k, v in sorted(question.options.items())
        ]

        detailed_results.append(
            QuestionResultDetailed(
                question_id=question.id,
                question_text=question.question_text,
                options=options,
                your_answer=answer.selected_answer,
                correct_answer=question.correct_answer,
                is_correct=answer.is_correct
            )
        )

    return TestResultResponse(
        session_id=session_id,
        question_set_id=session.question_set_id,
        skill=question_set.skill,
        level=question_set.level,
        total_questions=session.total_questions,
        correct_answers=session.correct_answers,
        score_percentage=session.score_percentage,
        completed_at=session.completed_at,
        time_taken_seconds=session.duration_seconds,
        detailed_results=detailed_results
    )
