from pydantic import BaseModel, Field, ConfigDict, AliasChoices
from typing import List, Optional, Dict, Any
from datetime import datetime,date

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

class FeedbackCreate(BaseModel):
    """Request to create feedback for a question."""
    model_config = ConfigDict(populate_by_name=True)

    session_id: str
    question_id: int
    feedback_text: str = Field(default="", validation_alias=AliasChoices("feedback_text", "feedback"))

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
    assessment_id: Optional[str] = None
    assessment_title: Optional[str] = None
    assessment_description: Optional[str] = None
    job_title: Optional[str] = None
    total_questions: int
    correct_answers: int
    score_percentage: Optional[float] = None
    completed_at: Optional[datetime] = None
    time_taken_seconds: Optional[int] = None
    detailed_results: List[QuestionResultDetailed]
    overall_feedback: Optional[str] = None
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
    password: str
    phone: Optional[str] = None
    current_role: Optional[str] = None
    team: Optional[str] = None
    location: Optional[str] = None
    education: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    experience_years: Optional[str] = None  # e.g., "5 years"
    experience_level: str
    skills: dict = {}  # {skill_name: proficiency_level}
    availability_percentage: int = 100
    source: str = "manual"  # "manual" or "onboarding"

class CandidateUpdate(BaseModel):
    """Request to update candidate profile."""
    full_name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    phone: Optional[str] = None
    current_role: Optional[str] = None
    team: Optional[str] = None
    location: Optional[str] = None
    education: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    experience_years: Optional[str] = None
    experience_level: Optional[str] = None
    skills: Optional[dict] = None
    availability_percentage: Optional[int] = None
    created_at: Optional[datetime] = None

class CandidateResponse(BaseModel):
    """Response with candidate details."""
    id: int
    candidate_id: str
    full_name: str
    email: str
    password: Optional[str]=None
    phone: Optional[str]=None

    current_role: Optional[str]=None
    team: Optional[str]=None
    location: Optional[str]=None
    education: Optional[str]=None
    linkedin_url: Optional[str]=None
    github_url: Optional[str]=None
    portfolio_url: Optional[str]=None
    experience_years: Optional[str]=None

    experience_level: str
    skills: dict
    availability_percentage: int

    jd_file_id: Optional[str]=None
    cv_file_id: Optional[str]=None
    portfolio_file_id: Optional[str]=None

    is_active: bool
    created_at: datetime
    updated_at: datetime
    source: str = "manual"


class PendingOnboardingEmailResponse(BaseModel):
    """Candidate who has not yet received the onboarding credentials email."""
    email: str
    username: str
    password: Optional[str] = None


class PendingOnboardingCompletionEmailResponse(BaseModel):
    """Candidate who completed onboarding but has not yet received the completion email."""
    email: str


class OnboardingEmailSentRequest(BaseModel):
    """Request to mark onboarding credentials email as sent."""
    email: str


class OnboardingEmailSentResponse(BaseModel):
    """Response after marking onboarding email as sent."""
    email: str
    onboarding_email_sent: bool


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
    skill_configuration: Optional[Dict[str, Any]] = None
    skill_priorities: Optional[Dict[str, str]] = None  # ✅ NEW: must-have/good-to-have
    required_roles: list = []
    question_set_id: Optional[str] = None
    parent_assessment_id: Optional[int] = None
    duration_minutes: int = 30
    is_questionnaire_enabled: bool = True
    is_interview_enabled: bool = False
    is_draft: bool = False  # ✅ NEW: Draft support
    expires_at: Optional[datetime] = None
    candidate_info: Optional[CandidateInfoSchema] = None
    questionnaire_config: Optional[Dict[str, Any]] = None
    screening_questions: Optional[List[str]] = None
    manual_questions: Optional[List[Dict[str, Any]]] = None  # ✅ Manual questions
    
    # Question configuration. Difficulty is driven by required_skills per-skill proficiency.
    total_questions: int = 15
    question_type_mix: Optional[Dict[str, float]] = None  # {"mcq": 0.5, "coding": 0.3, "architecture": 0.2}
    
    # Scoring configuration
    passing_score_threshold: int = 70  # percentage
    auto_adjust_by_experience: bool = False
    difficulty_distribution: Optional[Dict[str, float]] = None  # Derived from required_skills for compatibility.
    generation_policy: Optional[Dict[str, Any]] = None



class AssessmentUpdate(BaseModel):
    """Request to update assessment."""
    title: Optional[str] = None
    description: Optional[str] = None
    job_title: Optional[str] = None
    required_skills: Optional[dict] = None
    skill_configuration: Optional[Dict[str, Any]] = None
    required_roles: Optional[list] = None
    duration_minutes: Optional[int] = None
    is_questionnaire_enabled: Optional[bool] = None
    is_interview_enabled: Optional[bool] = None
    is_active: Optional[bool] = None
    is_published: Optional[bool] = None
    expires_at: Optional[datetime] = None
    screening_questions: Optional[List[str]] = None
    manual_questions: Optional[List[Dict[str, Any]]] = None
    
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
    parent_assessment_id: Optional[int] = None
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
    canonical_name: Optional[str] = None
    proficiency_level: str  # beginner, intermediate, advanced
    category: str  # e.g., "technical", "soft", "language"
    frequency: int = 1  # How many times mentioned in documents
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)  # Confidence score 0-1
    inferred: bool = False
    source: Optional[str] = None  # jd, resume, both, fallback
    evidence: Optional[str] = None
    priority: Optional[str] = None  # critical, high, medium, low
    matched_with_jd: bool = False


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

class OnboardingModuleResponse(BaseModel):
    id: int
    title: str
    description: str | None
    rank: int
    passing_criteria: float
    icon: str | None
    date: date | None

    class Config:
        from_attributes = True

class QuizChoiceResponse(BaseModel):
    id: str
    text: str


class OnboardingModuleQuizResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    question_text: str
    question_type: str
    choices: Optional[List[str]] = None
    correct_answer: Optional[str] = None
    display_order: int
    points: int
    priority: int = 0

class OnboardingModuleKeyConceptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    icon: Optional[str] = None
    link_url: Optional[str] = None
    display_order: int

class OnboardingModuleDetailResponse(BaseModel):
    """Response schema for onboarding module details."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str] = None
    rank: int
    passing_criteria: float
    icon: Optional[str] = None
    date: Optional[date] = None

    quizzes: List[OnboardingModuleQuizResponse]
    key_concepts: List[OnboardingModuleKeyConceptResponse]


# Employee Onboarding Module Tracking Schemas

class EmployeeModuleVideoProgressResponse(BaseModel):
    """Response schema for employee video progress."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    employee_progress_id: int
    video_url: str
    current_duration_seconds: int
    total_duration_seconds: Optional[int] = None
    completion_percentage: float
    is_completed: bool
    completed_date: Optional[datetime] = None


class EmployeeQuizResponseItemResponse(BaseModel):
    """Response schema for individual quiz response."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    question_id: int
    question_text: Optional[str] = None
    employee_answer: Optional[str] = None
    correct_answer: Optional[str] = None
    is_correct: Optional[bool] = None
    time_spent_seconds: Optional[int] = None


class EmployeeQuizAttemptResponse(BaseModel):
    """Response schema for employee quiz attempt."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    employee_progress_id: int
    quiz_id: Optional[int] = None
    score: Optional[float] = None
    passing_status: Optional[str] = None  # PASS / FAIL
    attempt_number: int
    time_spent_seconds: Optional[int] = None
    attempted_date: datetime
    responses: Optional[List[EmployeeQuizResponseItemResponse]] = []


class EmployeeModuleProgressResponse(BaseModel):
    """Response schema for employee module progress."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    candidate_id: int
    module_id: int
    status: str  # LOCKED, NOT_STARTED, VIDEO_IN_PROGRESS, VIDEO_COMPLETED, QUIZ_IN_PROGRESS, COMPLETED
    started_date: Optional[datetime] = None
    video_completed_date: Optional[datetime] = None
    completed_date: Optional[datetime] = None
    created_date: datetime


class EmployeeModuleProgressDetailResponse(BaseModel):
    """Detailed response schema for employee module with video and quiz data."""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    candidate_id: int
    module_id: int
    status: str
    started_date: Optional[datetime] = None
    video_completed_date: Optional[datetime] = None
    completed_date: Optional[datetime] = None
    
    module: OnboardingModuleResponse
    video_progress: Optional[EmployeeModuleVideoProgressResponse] = None
    quiz_attempts: List[EmployeeQuizAttemptResponse] = []


class EmployeeModuleProgressSummaryItem(BaseModel):
    """Lightweight module summary for onboarding dashboard."""
    model_config = ConfigDict(from_attributes=True)

    module_id: int
    title: str
    description: Optional[str] = None
    rank: int
    passing_criteria: float
    status: str
    is_unlocked: bool
    started_date: Optional[datetime] = None
    video_completed_date: Optional[datetime] = None
    completed_date: Optional[datetime] = None
    score: Optional[float] = None
    passing_status: Optional[str] = None


class ResourceLinkItem(BaseModel):
    """A resource link drawn from a module's key concepts."""
    module_id: int
    module_title: str
    title: str
    url: str


class EmployeeOnboardingProgressSummaryResponse(BaseModel):
    """Aggregated onboarding progress summary for a candidate."""
    model_config = ConfigDict(from_attributes=True)

    total_modules: int
    completed_modules: int
    remaining_modules: int
    overall_progress_percentage: float
    certificate_email_sent: bool = False
    resources: List[ResourceLinkItem] = []
    modules: List[EmployeeModuleProgressSummaryItem]


class ModuleDetailResponse(BaseModel):
    """Full module detail for employee module view."""
    model_config = ConfigDict(from_attributes=True)

    module: OnboardingModuleResponse
    video_url: Optional[str] = None
    video_completed: bool = False
    key_concepts: List[OnboardingModuleKeyConceptResponse] = []
    quiz_questions: List[OnboardingModuleQuizResponse] = []
    quiz_attempts: List[EmployeeQuizAttemptResponse] = []


class QuizQuestionResultItem(BaseModel):
    """Question-level result for a submitted quiz."""
    model_config = ConfigDict(from_attributes=True)

    question_id: int
    question_text: Optional[str] = None
    employee_answer: Optional[str] = None
    correct_answer: Optional[str] = None
    is_correct: Optional[bool] = None
    llm_score: Optional[int] = None


class QuizSubmitResponse(BaseModel):
    """Response schema for submitted quiz."""
    model_config = ConfigDict(from_attributes=True)

    attempt_id: int
    module_id: int
    attempt_number: int
    total_questions: int
    correct_answers: int
    score: float
    passing_status: str
    passing_criteria: float
    responses: List[QuizQuestionResultItem]


class VideoProgressUpdateRequest(BaseModel):
    """Request schema for updating video progress."""
    current_duration_seconds: int
    total_duration_seconds: int
    completion_percentage: float
    is_completed: bool


class VideoProgressResponse(BaseModel):
    """Response schema for video progress."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_progress_id: int
    video_url: Optional[str] = None
    current_duration_seconds: int
    total_duration_seconds: Optional[int] = None
    completion_percentage: float
    is_completed: bool
    completed_date: Optional[datetime] = None
    created_date: Optional[datetime] = None
    modified_date: Optional[datetime] = None


class ActionChecklistItemResponse(BaseModel):
    """Action checklist item schema."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    module_id: int
    item_text: str
    display_order: int
    is_active: bool


class CandidateChecklistResponse(BaseModel):
    """Candidate checklist state schema."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    candidate_id: int
    module_id: int
    completed_item_ids: Optional[str] = None
    all_completed: bool = False
    certificate_generated: bool = False
    certificate_generated_date: Optional[datetime] = None
    completed_date: Optional[datetime] = None
    items: List[ActionChecklistItemResponse] = []


class CertificateResponse(BaseModel):
    """Certificate generation response schema."""
    model_config = ConfigDict(from_attributes=True)

    certificate_id: int
    candidate_id: int
    module_id: int
    generated_at: datetime
    completion_date: Optional[datetime] = None
    candidate_name: Optional[str] = None


class CertificateModuleItem(BaseModel):
    """Module score item for certificate."""
    model_config = ConfigDict(from_attributes=True)

    module_id: int
    title: str
    rank: int
    score: Optional[float] = None
    passing_status: Optional[str] = None
    status: str


class CertificateDataResponse(BaseModel):
    """Full certificate data for rendering."""
    model_config = ConfigDict(from_attributes=True)

    candidate_name: Optional[str] = None
    completed_date: Optional[datetime] = None
    generated_at: Optional[datetime] = None
    modules: List[CertificateModuleItem] = []
