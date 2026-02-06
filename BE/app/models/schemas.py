from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime

# ============ VALIDATION ERROR SCHEMAS ============

class FieldError(BaseModel):
    """Validation error for a specific field."""
    field: str
    error_code: str
    message: str
    value: Optional[str] = None

class ValidationErrorResponse(BaseModel):
    """Standard validation error response for frontend."""
    success: bool = False
    error_type: str = "VALIDATION_ERROR"
    message: str
    field_errors: List[FieldError]
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class OperationResponse(BaseModel):
    """Generic operation response with status."""
    success: bool
    message: str
    data: Optional[dict] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

# ============ MCQ & TEST SCHEMAS ============

class MCQOption(BaseModel):
    option_id: str  # e.g., "A", "B", "C", "D"
    text: str

class MCQQuestion(BaseModel):
    question_id: int
    question_text: str
    options: List[MCQOption]
    correct_answer: Optional[str] = None  # e.g., "A", "B", "C", "D"

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
    correct_answer: Optional[str] = None
    is_correct: bool
    points: int = 0
    suggestion: Optional[str] = None
    explanation: Optional[str] = None  # Optional field for future use (LLM explanation)

class TestResultResponse(BaseModel):
    """Complete test results."""
    session_id: str
    question_set_id: str
    skill: str
    level: str
    total_questions: int
    correct_answers: int
    score_percentage: Optional[float] = None
    completed_at: Optional[datetime] = None
    time_taken_seconds: Optional[int] = None
    detailed_results: List[QuestionResultDetailed]
    is_partial: bool = False  # Flag for incomplete sessions

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
    correct_answer: Optional[str] = None
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
66

# ============ CANDIDATE & ASSESSMENT SCHEMAS ============

class CandidateInfoSchema(BaseModel):
    """Candidate information extracted from resume or entered manually."""
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    experience: Optional[str] = None  # e.g., "5 years"
    current_role: Optional[str] = None
    location: Optional[str] = None
    linkedin: Optional[str] = None
    github: Optional[str] = None
    portfolio: Optional[str] = None
    education: Optional[str] = None

class CandidateCreate(BaseModel):
    """Request to create a new candidate."""
    full_name: str
    email: str
    phone: Optional[str] = None
    current_role: Optional[str] = None
    location: Optional[str] = None
    education: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    experience_years: Optional[str] = None  # e.g., "5 years"
    experience_level: str  # junior, mid, senior, etc.
    skills: dict = {}  # {skill_name: proficiency_level}
    availability_percentage: int = 100

class CandidateUpdate(BaseModel):
    """Request to update candidate profile."""
    full_name: Optional[str] = None
    phone: Optional[str] = None
    current_role: Optional[str] = None
    location: Optional[str] = None
    education: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    experience_years: Optional[str] = None
    experience_level: Optional[str] = None
    skills: Optional[dict] = None
    availability_percentage: Optional[int] = None

class CandidateResponse(BaseModel):
    """Response with candidate details."""
    id: int
    candidate_id: str
    full_name: str
    email: str
    phone: Optional[str]
    current_role: Optional[str]
    location: Optional[str]
    education: Optional[str]
    linkedin_url: Optional[str]
    github_url: Optional[str]
    portfolio_url: Optional[str]
    experience_years: Optional[str]
    experience_level: str
    skills: dict
    availability_percentage: int
    jd_file_id: Optional[str]
    cv_file_id: Optional[str]
    portfolio_file_id: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime


class SkillResponse(BaseModel):
    """Response with skill details."""
    id: int
    skill_id: str
    name: str
    description: Optional[str]
    category: str
    is_active: bool


class RoleResponse(BaseModel):
    """Response with role details."""
    id: int
    role_id: str
    name: str
    description: Optional[str]
    department: Optional[str]
    required_skills: dict
    is_active: bool


class AssessmentCreate(BaseModel):
    """Request to create a new assessment."""
    title: str
    description: Optional[str] = None
    job_title: str
    jd_id: Optional[str] = None
    required_skills: dict = {}
    required_roles: list = []
    question_set_id: Optional[str] = None
    duration_minutes: int = 30
    is_questionnaire_enabled: bool = True
    is_interview_enabled: bool = False
    expires_at: Optional[datetime] = None
    candidate_info: Optional[CandidateInfoSchema] = None
    questionnaire_config: Optional[Dict[str, int]] = None
    screening_questions: Optional[List[str]] = None
    
    # Question configuration (experience-based)
    total_questions: int = 15
    question_type_mix: Optional[Dict[str, float]] = None  # {"mcq": 0.5, "coding": 0.3, "architecture": 0.2}
    
    # Scoring configuration
    passing_score_threshold: int = 70  # percentage
    auto_adjust_by_experience: bool = True
    difficulty_distribution: Optional[Dict[str, float]] = None  # {"easy": 0.2, "medium": 0.5, "hard": 0.3}
    generation_policy: Optional[Dict[str, Any]] = None



class AssessmentUpdate(BaseModel):
    """Request to update assessment."""
    title: Optional[str] = None
    description: Optional[str] = None
    job_title: Optional[str] = None
    required_skills: Optional[dict] = None
    required_roles: Optional[list] = None
    duration_minutes: Optional[int] = None
    is_questionnaire_enabled: Optional[bool] = None
    is_interview_enabled: Optional[bool] = None
    is_active: Optional[bool] = None
    is_published: Optional[bool] = None
    expires_at: Optional[datetime] = None
    screening_questions: Optional[List[str]] = None
    
    # Question configuration (experience-based)
    total_questions: Optional[int] = None
    question_type_mix: Optional[Dict[str, float]] = None
    
    # Scoring configuration
    passing_score_threshold: Optional[int] = None
    auto_adjust_by_experience: Optional[bool] = None
    difficulty_distribution: Optional[Dict[str, float]] = None
    generation_policy: Optional[Dict[str, Any]] = None


class AssessmentResponse(BaseModel):
    """Response with assessment details."""
    model_config = {"from_attributes": True}
    
    id: int
    assessment_id: str
    title: str
    description: Optional[str]
    job_title: str
    jd_id: Optional[str]
    required_skills: dict
    required_roles: list
    question_set_id: Optional[str]
    assessment_method: str
    duration_minutes: int
    is_questionnaire_enabled: bool
    is_interview_enabled: bool
    is_active: bool
    is_published: bool
    is_expired: bool = False
    expires_at: Optional[datetime] = None
    
    # Question configuration
    total_questions: int
    question_type_mix: dict
    passing_score_threshold: int
    auto_adjust_by_experience: bool
    difficulty_distribution: dict
    generation_policy: dict
    created_at: datetime
    updated_at: datetime
    
    # Session statistics (for admin dashboard)
    total_sessions: Optional[int] = 0
    completed_sessions: Optional[int] = 0
    in_progress_sessions: Optional[int] = 0


class AssessmentApplicationRequest(BaseModel):
    """Request to apply for an assessment."""
    candidate_availability: int  # 0-100
    submitted_skills: dict  # {skill_name: proficiency_level}
    role_applied_for: Optional[str] = None


class AssessmentApplicationResponse(BaseModel):
    """Response with application details."""
    id: int
    application_id: str
    candidate_id: int
    assessment_id: int
    status: str  # pending, in_progress, completed, shortlisted, rejected
    candidate_availability: int
    submitted_skills: dict
    role_applied_for: Optional[str]
    applied_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class ScreeningResponseCreate(BaseModel):
    """Request schema for submitting screening answers."""
    answers: List[str]
    candidate_session_id: Optional[str] = None


class ScreeningResponseResponse(BaseModel):
    id: int
    screening_id: str
    assessment_id: int
    candidate_session_id: Optional[str]
    candidate_id: Optional[int]
    answers: dict
    created_at: datetime
    updated_at: datetime


class UploadedDocumentResponse(BaseModel):
    """Response with uploaded document details."""
    id: int
    file_id: str
    original_filename: str
    file_type: str
    document_category: str
    file_size: int
    mime_type: str
    extraction_preview: Optional[str]
    is_encrypted: bool
    jd_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ============ ADMIN SKILL EXTRACTION SCHEMAS ============

class ExtractedSkill(BaseModel):
    """Extracted skill with proficiency level."""
    skill_name: str
    proficiency_level: str  # e.g., "beginner", "intermediate", "advanced", "expert"
    category: str  # e.g., "technical", "soft", "language"
    frequency: int = 1  # How many times mentioned in documents
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)  # Confidence score 0-1


class DocumentSkillExtractionResponse(BaseModel):
    """Skills extracted from a single document."""
    file_id: str
    original_filename: str
    document_category: str
    extracted_skills: List[ExtractedSkill]
    total_skills_found: int
    extraction_preview: str  # First 500 chars of extracted text


# ============ GENERATED QUESTION / ADMIN REVIEW SCHEMAS ============

class GeneratedQuestion(BaseModel):
    """Representation of a generated question draft stored in QuestionBank."""
    id: int
    question_text: str
    choices: dict
    correct_answer: str
    source_type: Optional[str] = None
    quality_score: Optional[float] = None
    review_state: str
    created_at: datetime
    updated_at: datetime


class AdminBulkSkillExtractionResponse(BaseModel):
    """Response for bulk skill extraction from multiple documents."""
    success: bool = True
    message: str
    documents_processed: int
    total_unique_skills: int
    extracted_skills: List[ExtractedSkill]  # Aggregated unique skills across all documents
    documents: List[DocumentSkillExtractionResponse]  # Skills per document
    extraction_summary: dict = Field(
        default_factory=dict,
        description="Summary stats: skills_by_category, proficiency_distribution"
    )
    timestamp: datetime = Field(default_factory=datetime.utcnow)

