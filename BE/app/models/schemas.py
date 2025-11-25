from pydantic import BaseModel, Field
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

class QuestionSetResponse(BaseModel):
    """Response schema for generated question sets."""
    question_set_id: str
    skill: str
    level: str
    total_questions: int
    created_at: datetime
    message: str
    questions: List[MCQQuestion]

# QuestionSet Test Schemas
class StartQuestionSetTestRequest(BaseModel):
    """Request to start a test from a question set."""
    question_set_id: str

class StartQuestionSetTestResponse(BaseModel):
    """Response when starting a QuestionSet test."""
    session_id: str
    question_set_id: str
    skill: str
    level: str
    total_questions: int
    started_at: datetime
    questions: List[MCQQuestion]  # Return questions without correct answers

class AnswerSubmit(BaseModel):
    """Single answer submission."""
    question_id: int
    selected_answer: str  # e.g., "A", "B", "C", "D"

class SubmitAllAnswersRequest(BaseModel):
    """Submit all answers at once."""
    session_id: str
    answers: List[AnswerSubmit]

class QuestionResultDetailed(BaseModel):
    """Detailed result for a single question."""
    question_id: int
    question_text: str
    options: List[MCQOption]
    your_answer: str
    correct_answer: str
    is_correct: bool

class TestResultResponse(BaseModel):
    """Complete test results."""
    session_id: str
    question_set_id: str
    skill: str
    level: str
    total_questions: int
    correct_answers: int
    score_percentage: float
    completed_at: datetime
    time_taken_seconds: int
    detailed_results: List[QuestionResultDetailed]

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

class CourseRecommendation(BaseModel):
    name: str = Field(..., description="Course pathway display name")
    topic: str = Field(..., description="Skill/Topic Pathways")
    collection: str = Field(..., description="Collection Name")
    category: str = Field(..., description="Category")
    description: str = Field(..., description="Description")
    url: str = Field(..., description="Pathway URL")
    score: Optional[float] = Field(None, description="Similarity score")
    course_level: Optional[str] = Field(None, description="Course Level")

class RecommendedCoursesResponse(BaseModel):
    topic: str
    recommended_courses: list[CourseRecommendation]