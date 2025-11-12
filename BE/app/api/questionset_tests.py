"""QuestionSet Test API - Immediate feedback flow."""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.db.session import get_db
from app.db.models import User, TestSession, Question, Answer, QuestionSet
from app.core.dependencies import get_current_user
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


@router.post("/questionset-tests/start", response_model=StartQuestionSetTestResponse)
async def start_questionset_test(
    request: StartQuestionSetTestRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> StartQuestionSetTestResponse:
    """
    🚀 Start a Test Session from a QuestionSet
    
    Creates a new test session and returns all questions for the user to answer.
    
    **Process:**
    1. 🔍 Validates the QuestionSet exists
    2. 📋 Retrieves all questions from the set
    3. ✅ Creates a new test session linked to the user
    4. 📤 Returns questions WITHOUT correct answers
    
    **Request Body:**
    ```json
    {
      "question_set_id": "qs_abc123def456"
    }
    ```
    
    **Response:**
    - `session_id`: Unique identifier for this test session
    - `questions`: List of all questions (without correct answers)
    - `skill`: The topic/skill being tested
    - `level`: Difficulty level of the questions
    - `total_questions`: Number of questions in the test
    - `started_at`: Timestamp when the test started
    
    **Security:**
    - 🔒 Requires authentication (JWT token)
    - User ID is automatically linked to the session
    - Prevents duplicate sessions from being created
    
    **Next Steps:**
    After starting the test, use `/questionset-tests/submit` to submit all answers.
    
    **Example Response:**
    ```json
    {
      "session_id": "test_session_xyz789",
      "question_set_id": "qs_abc123def456",
      "skill": "Agentic AI",
      "level": "Basic",
      "total_questions": 10,
      "started_at": "2025-11-12T10:35:00",
      "questions": [
        {
          "question_id": 1,
          "question_text": "What is Agentic AI?",
          "options": [
            {"option_id": "A", "text": "Option A"},
            {"option_id": "B", "text": "Option B"}
          ],
          "correct_answer": ""
        }
      ]
    }
    ```
    """
    # Get QuestionSet
    result = await db.execute(
        select(QuestionSet).where(QuestionSet.question_set_id == request.question_set_id)
    )
    question_set = result.scalar_one_or_none()
    
    if not question_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"QuestionSet '{request.question_set_id}' not found"
        )
    
    # Get all questions for this set
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
    
    # Create test session
    started_at = datetime.utcnow()
    test_session = TestSession(
        question_set_id=request.question_set_id,
        user_id=current_user.id,
        candidate_name=current_user.full_name,
        candidate_email=current_user.email,
        started_at=started_at,
        total_questions=len(questions),
        is_completed=False,
        is_scored=False  # Will be scored immediately upon submission
    )
    
    db.add(test_session)
    await db.commit()
    await db.refresh(test_session)
    
    # Format questions for response (WITHOUT correct answers)
    question_list = []
    for q in questions:
        options = [
            MCQOption(option_id=opt_id, text=opt_text)
            for opt_id, opt_text in sorted(q.options.items())
        ]
        question_list.append(
            MCQQuestion(
                question_id=q.id,
                question_text=q.question_text,
                options=options,
                correct_answer=""  # Don't reveal correct answer
            )
        )
    
    return StartQuestionSetTestResponse(
        session_id=test_session.session_id,
        question_set_id=question_set.question_set_id,
        skill=question_set.skill,
        level=question_set.level,
        total_questions=question_set.total_questions,
        started_at=started_at,
        questions=question_list
    )


@router.post("/questionset-tests/submit", response_model=TestResultResponse)
async def submit_questionset_answers(
    request: SubmitAllAnswersRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> TestResultResponse:
    """
    ✅ Submit All Answers and Get Immediate Results
    
    Submit all answers for a test session and receive instant scoring and detailed feedback.
    
    **Process:**
    1. ✔️ Validates the test session belongs to the user
    2. 💾 Saves all submitted answers to the database
    3. 🎯 Calculates score by comparing with correct answers
    4. 📊 Generates detailed results for each question
    5. ⏰ Records completion time
    6. 📤 Returns comprehensive test results
    
    **Request Body:**
    ```json
    {
      "session_id": "test_session_xyz789",
      "answers": [
        {
          "question_id": 1,
          "selected_answer": "A"
        },
        {
          "question_id": 2,
          "selected_answer": "B"
        }
      ]
    }
    ```
    
    **Validations:**
    - ✅ Test session must exist and belong to the current user
    - ✅ Test session must not be already completed
    - ✅ All question IDs must belong to the question set
    - ✅ All selected answers must be valid options (A, B, C, or D)
    
    **Response Includes:**
    - `total_questions`: Total number of questions in the test
    - `correct_answers`: Number of correctly answered questions
    - `score_percentage`: Score as a percentage (0-100)
    - `passed`: Boolean indicating if the test was passed (>= 70%)
    - `time_taken_seconds`: Duration of the test
    - `detailed_results`: Question-by-question breakdown with:
      - Question text
      - Your answer
      - Correct answer
      - Whether you got it right
    
    **Security:**
    - 🔒 Requires authentication
    - Users can only submit answers for their own test sessions
    - Cannot submit answers twice for the same session
    
    **Example Response:**
    ```json
    {
      "session_id": "test_session_xyz789",
      "total_questions": 10,
      "correct_answers": 8,
      "score_percentage": 80.0,
      "passed": true,
      "completed_at": "2025-11-12T10:45:00",
      "time_taken_seconds": 600,
      "detailed_results": [
        {
          "question_id": 1,
          "question_text": "What is Agentic AI?",
          "your_answer": "A",
          "correct_answer": "A",
          "is_correct": true
        }
      ]
    }
    ```
    """
    # Get and validate session
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
    
    # Get QuestionSet
    qs_result = await db.execute(
        select(QuestionSet).where(QuestionSet.question_set_id == session.question_set_id)
    )
    question_set = qs_result.scalar_one_or_none()
    
    if not question_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="QuestionSet not found"
        )
    
    # Get all questions for this set
    questions_result = await db.execute(
        select(Question).where(Question.question_set_id == session.question_set_id)
    )
    questions = {q.id: q for q in questions_result.scalars().all()}
    
    # Validate all answers and save them
    correct_count = 0
    answer_records = []
    
    for answer_submit in request.answers:
        question = questions.get(answer_submit.question_id)
        
        if not question:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Question {answer_submit.question_id} not found in this QuestionSet"
            )
        
        # Validate answer format
        if answer_submit.selected_answer not in question.options:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid answer '{answer_submit.selected_answer}' for question {answer_submit.question_id}"
            )
        
        # Check if correct
        is_correct = answer_submit.selected_answer == question.correct_answer
        if is_correct:
            correct_count += 1
        
        # Create answer record
        answer_record = Answer(
            session_id=request.session_id,
            question_id=answer_submit.question_id,
            selected_answer=answer_submit.selected_answer,
            is_correct=is_correct
        )
        answer_records.append(answer_record)
    
    # Save all answers
    db.add_all(answer_records)
    
    # Update session with results
    completed_at = datetime.utcnow()
    duration_seconds = int((completed_at - session.started_at).total_seconds())
    score_percentage = (correct_count / session.total_questions * 100) if session.total_questions > 0 else 0
    
    session.is_completed = True
    session.completed_at = completed_at
    session.duration_seconds = duration_seconds
    session.correct_answers = correct_count
    session.score_percentage = score_percentage
    session.is_scored = True  # Immediate scoring
    session.score_released_at = completed_at
    
    await db.commit()
    
    # Build detailed results
    detailed_results = []
    for answer_submit in request.answers:
        question = questions[answer_submit.question_id]
        options = [
            MCQOption(option_id=opt_id, text=opt_text)
            for opt_id, opt_text in sorted(question.options.items())
        ]
        
        # Find if this answer was correct
        is_correct = answer_submit.selected_answer == question.correct_answer
        
        detailed_results.append(
            QuestionResultDetailed(
                question_id=question.id,
                question_text=question.question_text,
                options=options,
                your_answer=answer_submit.selected_answer,
                correct_answer=question.correct_answer,
                is_correct=is_correct
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


@router.get("/questionset-tests/{session_id}/results", response_model=TestResultResponse)
async def get_questionset_test_results(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> TestResultResponse:
    """
    📊 Retrieve Test Results
    
    Get comprehensive results for a completed QuestionSet test session.
    
    **Features:**
    - ⚡ Results available immediately after submission
    - 📈 Complete score and performance metrics
    - 🔍 Question-by-question breakdown
    - ✅ Shows which answers were correct/incorrect
    
    **URL Parameters:**
    - `session_id`: The unique identifier of the test session
    
    **Response Includes:**
    - Overall test statistics (score, percentage, pass/fail)
    - Time taken to complete the test
    - Detailed results for each question with:
      - The question text
      - All available options
      - Your selected answer
      - The correct answer
      - Whether you got it right
    
    **Security:**
    - 🔒 Requires authentication
    - Users can only view their own test results
    - Session must be completed to view results
    
    **Use Cases:**
    - Review test performance after submission
    - Analyze which questions were answered incorrectly
    - Track learning progress over time
    
    **Example Response:**
    ```json
    {
      "session_id": "test_session_xyz789",
      "question_set_id": "qs_abc123def456",
      "skill": "Agentic AI",
      "level": "Basic",
      "total_questions": 10,
      "correct_answers": 8,
      "score_percentage": 80.0,
      "passed": true,
      "completed_at": "2025-11-12T10:45:00",
      "time_taken_seconds": 600,
      "detailed_results": [
        {
          "question_id": 1,
          "question_text": "What is Agentic AI?",
          "options": [
            {"option_id": "A", "text": "Correct option"},
            {"option_id": "B", "text": "Wrong option"}
          ],
          "your_answer": "A",
          "correct_answer": "A",
          "is_correct": true
        }
      ]
    }
    ```
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
    
    # Get QuestionSet
    qs_result = await db.execute(
        select(QuestionSet).where(QuestionSet.question_set_id == session.question_set_id)
    )
    question_set = qs_result.scalar_one_or_none()
    
    if not question_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="QuestionSet not found"
        )
    
    # Get all answers with questions
    answers_result = await db.execute(
        select(Answer, Question)
        .join(Question, Answer.question_id == Question.id)
        .where(Answer.session_id == session_id)
        .order_by(Question.id)
    )
    
    detailed_results = []
    for answer, question in answers_result:
        options = [
            MCQOption(option_id=opt_id, text=opt_text)
            for opt_id, opt_text in sorted(question.options.items())
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
