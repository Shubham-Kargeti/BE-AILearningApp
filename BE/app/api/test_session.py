from fastapi import APIRouter, HTTPException
from app.models.schemas import (
    TestSession, AnswerSubmission, TestResult, 
    QuestionResult, MCQQuestion, MCQOption
)
from datetime import datetime
import uuid
from typing import Optional

router = APIRouter()

# In-memory storage for test sessions
test_sessions = {}

# Import memory_store from upload_jd to access JD questions
from app.api.upload_jd import memory_store


@router.post("/start-test/")
async def start_test(jd_id: str, candidate_name: Optional[str] = None):
    """
    Start a new test session for a given JD.
    Returns session_id and the questions (without correct answers).
    """
    # Check if JD exists
    if jd_id not in memory_store:
        raise HTTPException(status_code=404, detail="JD not found. Please upload a JD first.")
    
    jd_data = memory_store[jd_id]
    if "questions" not in jd_data:
        raise HTTPException(status_code=400, detail="No questions found for this JD.")
    
    # Create new test session
    session_id = str(uuid.uuid4())
    session = TestSession(
        session_id=session_id,
        jd_id=jd_id,
        candidate_name=candidate_name,
        started_at=datetime.now(),
        answers={},
        is_completed=False
    )
    
    test_sessions[session_id] = session.model_dump()
    
    # Return questions without correct answers
    questions = jd_data["questions"]
    questions_for_candidate = []
    for q in questions:
        questions_for_candidate.append({
            "question_id": q["question_id"],
            "question_text": q["question_text"],
            "options": q["options"]
            # Don't include correct_answer
        })
    
    return {
        "session_id": session_id,
        "jd_id": jd_id,
        "candidate_name": candidate_name,
        "total_questions": len(questions),
        "questions": questions_for_candidate
    }


@router.post("/submit-answer/")
async def submit_answer(submission: AnswerSubmission):
    """
    Submit answer for a single question in real-time.
    Updates the session with the candidate's answer.
    """
    session_id = submission.session_id
    
    # Check if session exists
    if session_id not in test_sessions:
        raise HTTPException(status_code=404, detail="Test session not found.")
    
    session = test_sessions[session_id]
    
    # Check if test is already completed
    if session["is_completed"]:
        raise HTTPException(status_code=400, detail="Test is already completed.")
    
    # Validate question_id exists in the JD
    jd_id = session["jd_id"]
    jd_data = memory_store[jd_id]
    questions = jd_data["questions"]
    
    question_exists = any(q["question_id"] == submission.question_id for q in questions)
    if not question_exists:
        raise HTTPException(status_code=404, detail=f"Question {submission.question_id} not found.")
    
    # Validate answer option (A, B, C, or D)
    if submission.selected_answer not in ["A", "B", "C", "D"]:
        raise HTTPException(status_code=400, detail="Answer must be A, B, C, or D.")
    
    # Store the answer
    session["answers"][str(submission.question_id)] = submission.selected_answer
    test_sessions[session_id] = session
    
    return {
        "message": "Answer submitted successfully",
        "question_id": submission.question_id,
        "selected_answer": submission.selected_answer,
        "total_answered": len(session["answers"])
    }


@router.post("/complete-test/")
async def complete_test(session_id: str):
    """
    Mark the test as completed and calculate results.
    Returns detailed results with score.
    """
    # Check if session exists
    if session_id not in test_sessions:
        raise HTTPException(status_code=404, detail="Test session not found.")
    
    session = test_sessions[session_id]
    
    # Check if already completed
    if session["is_completed"]:
        raise HTTPException(status_code=400, detail="Test is already completed.")
    
    # Get JD questions
    jd_id = session["jd_id"]
    jd_data = memory_store[jd_id]
    questions = jd_data["questions"]
    
    # Calculate results
    detailed_results = []
    correct_count = 0
    
    for question in questions:
        q_id = question["question_id"]
        correct_answer = question["correct_answer"]
        selected_answer = session["answers"].get(str(q_id), "")
        
        is_correct = selected_answer == correct_answer
        if is_correct:
            correct_count += 1
        
        detailed_results.append(
            QuestionResult(
                question_id=q_id,
                question_text=question["question_text"],
                selected_answer=selected_answer if selected_answer else "Not Answered",
                correct_answer=correct_answer,
                is_correct=is_correct
            )
        )
    
    total_questions = len(questions)
    score_percentage = (correct_count / total_questions) * 100 if total_questions > 0 else 0
    
    # Mark session as completed
    session["is_completed"] = True
    test_sessions[session_id] = session
    
    # Create result
    result = TestResult(
        session_id=session_id,
        jd_id=jd_id,
        candidate_name=session.get("candidate_name"),
        total_questions=total_questions,
        correct_answers=correct_count,
        score_percentage=round(score_percentage, 2),
        detailed_results=detailed_results,
        completed_at=datetime.now()
    )
    
    return result


@router.get("/test-status/{session_id}")
async def get_test_status(session_id: str):
    """
    Get current status of a test session.
    Shows how many questions answered, etc.
    """
    if session_id not in test_sessions:
        raise HTTPException(status_code=404, detail="Test session not found.")
    
    session = test_sessions[session_id]
    jd_data = memory_store[session["jd_id"]]
    total_questions = len(jd_data["questions"])
    
    return {
        "session_id": session_id,
        "jd_id": session["jd_id"],
        "candidate_name": session.get("candidate_name"),
        "is_completed": session["is_completed"],
        "total_questions": total_questions,
        "answered_questions": len(session["answers"]),
        "started_at": session["started_at"]
    }
