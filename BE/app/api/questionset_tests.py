"""QuestionSet Test API - Immediate feedback flow."""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

from app.db.session import get_db
from app.db.models import User, TestSession, Question, Answer, QuestionSet
from app.core.dependencies import get_current_user, optional_user
from app.core.security import is_admin_user
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
    try:
        await db.commit()
    except Exception as e:
        # Catch DB errors such as data truncation and return a helpful message
        from sqlalchemy.exc import DBAPIError
        if isinstance(e, DBAPIError):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=("Database error while saving answers. "
                        "This may be caused by answer length exceeding the column size. "
                        "Please run the alter script to change answers.selected_answer to TEXT."),
            )
        raise
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
    try:
        await db.commit()
    except Exception as e:
        from sqlalchemy.exc import DBAPIError
        if isinstance(e, DBAPIError):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=("Database error while saving answers. "
                        "This may be caused by answer length exceeding the column size. "
                        "Please run the alter script to change answers.selected_answer to TEXT."),
            )
        raise
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
        print(f"⚠️ start_questionset_test: session not found when validating start/ownership: {request.session_id if hasattr(request, 'session_id') else 'n/a'}")
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
            # Accept NOT_ANSWERED sentinel as a valid 'no response' marker
            if answer_submit.selected_answer == "NOT_ANSWERED":
                is_correct = False
            elif answer_submit.selected_answer not in question.options:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid answer '{answer_submit.selected_answer}'"
                )
            else:
                is_correct = (
                    answer_submit.selected_answer == question.correct_answer
                )

        # ---------- CODING / ARCHITECTURE ----------
        else:
            # Allow NOT_ANSWERED sentinel for coding/architecture to represent unanswered
            if answer_submit.selected_answer == "NOT_ANSWERED":
                is_correct = False
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

        # Ensure selected_answer fits into DB column (truncate if excessively long)
        selected_value = answer_submit.selected_answer
        if selected_value is None:
            selected_value = ""
        if not isinstance(selected_value, str):
            selected_value = str(selected_value)
        selected_value = selected_value.strip()
        MAX_ANSWER_LEN = 10000
        if len(selected_value) > MAX_ANSWER_LEN:
            # Truncate long answers to prevent DB errors and log the truncation
            selected_value = selected_value[:MAX_ANSWER_LEN]

        answer_records.append(
            Answer(
                session_id=request.session_id,
                question_id=answer_submit.question_id,
                selected_answer=selected_value,
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
            options = []
            for k, v in sorted(question.options.items()):
                # Defensive: normalize option text to a string (some options may be lists)
                if isinstance(v, str):
                    opt_text = v
                elif isinstance(v, list):
                    opt_text = " | ".join(map(str, v))
                else:
                    opt_text = str(v)
                options.append(MCQOption(option_id=k, text=opt_text))
            # Defensive: ensure we return an explicit placeholder when no correct answer is set
            correct_answer = question.correct_answer or ""
        else:
            options = []
            # For non-mcq question types, return empty-string as placeholder for correct_answer
            correct_answer = ""

        # Compute points and suggestion
        is_correct_flag = (answer_submit.selected_answer == correct_answer)
        points = 1 if is_correct_flag else 0
        if is_correct_flag:
            suggestion_text = "Good work!"
        else:
            # Prefer explicit topic-based guidance when available
            topic = getattr(question, 'topic', None)
            if topic:
                suggestion_text = f"Review topic: {topic}. Consider revisiting the basics and example problems."
            elif qtype == 'coding':
                suggestion_text = "For coding questions, review algorithmic complexity, edge cases, and test-driven approaches."
            else:
                suggestion_text = "Review this topic and try related practice problems to improve understanding."

        detailed_results.append(
            QuestionResultDetailed(
                question_id=question.id,
                question_text=question.question_text,
                options=options,
                your_answer=answer_submit.selected_answer,
                correct_answer=correct_answer,
                is_correct=is_correct_flag,
                points=points,
                suggestion=suggestion_text
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
            # Accept NOT_ANSWERED sentinel for unanswered MCQs
            if answer_submit.selected_answer == "NOT_ANSWERED":
                is_correct = False
            elif answer_submit.selected_answer not in question.options:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid answer"
                )
            else:
                is_correct = (
                    answer_submit.selected_answer == question.correct_answer
                )

        # ---------- CODING / ARCHITECTURE ----------
        else:
            if answer_submit.selected_answer == "NOT_ANSWERED":
                is_correct = False
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
        # Ensure selected_answer is a string and normalize whitespace
        selected = answer_submit.selected_answer
        if selected is None:
            selected = ""
        if not isinstance(selected, str):
            selected = str(selected)
        selected = selected.strip()
        # Truncate very long answers to a safe limit
        MAX_ANSWER_LEN = 10000
        if len(selected) > MAX_ANSWER_LEN:
            selected = selected[:MAX_ANSWER_LEN]

        answer_records.append(
            Answer(
                session_id=request.session_id,
                question_id=answer_submit.question_id,
                selected_answer=selected,
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
            options = []
            for k, v in sorted(question.options.items()):
                if isinstance(v, str):
                    opt_text = v
                elif isinstance(v, list):
                    opt_text = " | ".join(map(str, v))
                else:
                    opt_text = str(v)
                options.append(MCQOption(option_id=k, text=opt_text))
            # Defensive: ensure we return an explicit placeholder when no correct answer is set
            correct_answer = question.correct_answer or ""
        else:
            options = []
            # For non-mcq question types, return empty-string as placeholder for correct_answer
            correct_answer = ""

        # Compute points and suggestion
        is_correct_flag = (answer_submit.selected_answer == correct_answer)
        points = 1 if is_correct_flag else 0
        if is_correct_flag:
            suggestion_text = "Good work!"
        else:
            topic = getattr(question, 'topic', None)
            if topic:
                suggestion_text = f"Review topic: {topic}. Consider revisiting the basics and example problems."
            elif qtype == 'coding':
                suggestion_text = "For coding questions, review algorithmic complexity, edge cases, and test-driven approaches."
            else:
                suggestion_text = "Review this topic and try related practice problems to improve understanding."

        detailed_results.append(
            QuestionResultDetailed(
                question_id=question.id,
                question_text=question.question_text,
                options=options,
                your_answer=answer_submit.selected_answer,
                correct_answer=correct_answer,
                is_correct=is_correct_flag,
                points=points,
                suggestion=suggestion_text
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
    current_user: Optional[User] = Depends(optional_user),
    db: AsyncSession = Depends(get_db)
) -> TestResultResponse:
    """
    📊 Retrieve Test Results
    """
    # Check if user is admin
    is_admin = current_user and is_admin_user(current_user.email)
    
    # --------------------------------------------------
    # Get session
    # --------------------------------------------------
    if is_admin:
        # Admins can view any session
        result = await db.execute(
            select(TestSession).where(TestSession.session_id == session_id)
        )
    elif current_user:
        # Authenticated users can view their own sessions or anonymous sessions
        result = await db.execute(
            select(TestSession).where(
                and_(
                    TestSession.session_id == session_id,
                    or_(
                        TestSession.user_id == current_user.id,
                        TestSession.user_id.is_(None)
                    )
                )
            )
        )
    else:
        # Unauthenticated users can only view anonymous sessions
        result = await db.execute(
            select(TestSession).where(
                and_(
                    TestSession.session_id == session_id,
                    TestSession.user_id.is_(None)
                )
            )
        )
    session = result.scalar_one_or_none()

    if not session:
        print(f"⚠️ get_questionset_test_results: session not found for id {session_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test session not found"
        )

    # Allow viewing results even for incomplete sessions (for admin review)
    # If incomplete, we'll show partial results with a flag
    is_partial = not session.is_completed

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
        options = []
        for k, v in sorted(question.options.items()):
            if isinstance(v, str):
                opt_text = v
            elif isinstance(v, list):
                opt_text = " | ".join(map(str, v))
            else:
                opt_text = str(v)
            options.append(MCQOption(option_id=k, text=opt_text))

        # Compute points and derive a suggestion
        is_correct_flag = bool(answer.is_correct)
        points = 1 if is_correct_flag else 0
        if is_correct_flag:
            suggestion_text = "Good work!"
        else:
            topic = getattr(question, 'topic', None)
            if topic:
                suggestion_text = f"Review topic: {topic}. Consider revisiting the basics and example problems."
            elif resolve_question_type(question) == 'coding':
                suggestion_text = "For coding questions, review algorithmic complexity, edge cases, and test-driven approaches."
            else:
                suggestion_text = "Review this topic and try related practice problems to improve understanding."

        detailed_results.append(
            QuestionResultDetailed(
                question_id=question.id,
                question_text=question.question_text,
                options=options,
                your_answer=answer.selected_answer,
                correct_answer=question.correct_answer,
                is_correct=is_correct_flag,
                points=points,
                suggestion=suggestion_text
            )
        )

    return TestResultResponse(
        session_id=session_id,
        question_set_id=session.question_set_id,
        skill=question_set.skill,
        level=question_set.level,
        total_questions=session.total_questions,
        correct_answers=session.correct_answers if session.is_completed else len(detailed_results),
        score_percentage=session.score_percentage if session.is_completed else None,
        completed_at=session.completed_at,
        time_taken_seconds=session.duration_seconds,
        detailed_results=detailed_results,
        is_partial=is_partial  # Add flag for incomplete sessions
    )


@router.get("/questionset-tests/my-sessions")
async def list_my_test_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 50
):
    """
    📋 List all test sessions for the current user
    """
    result = await db.execute(
        select(TestSession, QuestionSet)
        .outerjoin(QuestionSet, TestSession.question_set_id == QuestionSet.question_set_id)
        .where(TestSession.user_id == current_user.id)
        .order_by(TestSession.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    
    sessions_data = []
    for session, question_set in result:
        sessions_data.append({
            "session_id": session.session_id,
            "question_set_id": session.question_set_id,
            "skill": question_set.skill if question_set else None,
            "level": question_set.level if question_set else None,
            "total_questions": session.total_questions,
            "correct_answers": session.correct_answers,
            "score_percentage": session.score_percentage,
            "is_completed": session.is_completed,
            "started_at": session.started_at.isoformat() if session.started_at else None,
            "completed_at": session.completed_at.isoformat() if session.completed_at else None,
            "duration_seconds": session.duration_seconds,
        })
    
    return sessions_data


@router.get("/questionset-tests/assessment/{assessment_id}/sessions")
async def list_assessment_test_sessions(
    assessment_id: str,
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 50
):
    """
    📋 List all test sessions for a specific assessment (admin view)
    """
    from app.db.models import Assessment
    
    # First, get the assessment to find its question_set_id
    assessment_result = await db.execute(
        select(Assessment).where(Assessment.assessment_id == assessment_id)
    )
    assessment = assessment_result.scalar_one_or_none()
    
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found"
        )
    
    if not assessment.question_set_id:
        print(f"⚠️ Assessment {assessment_id} has no question_set_id linked")
        return []  # No question set linked yet
    
    print(f"📊 Fetching sessions for assessment {assessment_id} with question_set_id: {assessment.question_set_id}")
    
    # Get all test sessions for this question set
    result = await db.execute(
        select(TestSession)
        .where(TestSession.question_set_id == assessment.question_set_id)
        .order_by(TestSession.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    
    sessions = result.scalars().all()
    
    print(f"✅ Found {len(sessions)} sessions for question_set_id: {assessment.question_set_id}")
    
    sessions_data = []
    for session in sessions:
        # Count answered questions for incomplete sessions
        answered_count = session.total_questions  # Default to total if completed
        if not session.is_completed:
            # Count how many questions have answers
            answers_result = await db.execute(
                select(Answer).where(Answer.session_id == session.session_id)
            )
            answered_count = len(answers_result.scalars().all())
        
        sessions_data.append({
            "session_id": session.session_id,
            "candidate_name": session.candidate_name,
            "candidate_email": session.candidate_email,
            "total_questions": session.total_questions,
            "answered_questions": answered_count,
            "correct_answers": session.correct_answers,
            "score_percentage": session.score_percentage,
            "is_completed": session.is_completed,
            "started_at": session.started_at.isoformat() if session.started_at else None,
            "completed_at": session.completed_at.isoformat() if session.completed_at else None,
            "duration_seconds": session.duration_seconds,
        })
    
    return sessions_data
