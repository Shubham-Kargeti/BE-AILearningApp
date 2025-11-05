from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class MCQOption(BaseModel):
    option_id: str  # e.g., "A", "B", "C", "D"
    text: str

class MCQQuestion(BaseModel):
    question_id: int
    question_text: str
    options: List[MCQOption]
    correct_answer: str  # e.g., "A", "B", "C", "D"

class MCQResponse(BaseModel):
    jd_id: str
    message: str
    questions: List[MCQQuestion]

class AnswerSubmission(BaseModel):
    session_id: str
    question_id: int
    selected_answer: str  # e.g., "A", "B", "C", "D"

class TestSession(BaseModel):
    session_id: str
    jd_id: str
    candidate_name: Optional[str] = None
    started_at: datetime
    answers: dict  # {question_id: selected_answer}
    is_completed: bool = False

class QuestionResult(BaseModel):
    question_id: int
    question_text: str
    selected_answer: str
    correct_answer: str
    is_correct: bool

class TestResult(BaseModel):
    session_id: str
    jd_id: str
    candidate_name: Optional[str] = None
    total_questions: int
    correct_answers: int
    score_percentage: float
    detailed_results: List[QuestionResult]
    completed_at: datetime
