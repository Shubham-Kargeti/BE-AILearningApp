"""Database models for the application."""
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    String, Integer, Boolean, DateTime, Text, JSON, 
    Float, ForeignKey, Index, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, TimestampMixin
import uuid


class User(Base, TimestampMixin):
    """User model for authentication."""
    
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Streak tracking
    login_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    login_streak_last_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    login_streak_max: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    quiz_streak: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    quiz_streak_last_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    quiz_streak_max: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # Relationships
    test_sessions: Mapped[list["TestSession"]] = relationship(
        "TestSession", back_populates="user", cascade="all, delete-orphan"
    )
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        return f"<User(id={self.id}, email='{self.email}')>"


class RefreshToken(Base, TimestampMixin):
    """Refresh token model for JWT authentication."""
    
    __tablename__ = "refresh_tokens"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    token: Mapped[str] = mapped_column(String(500), unique=True, index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="refresh_tokens")
    
    __table_args__ = (
        Index("ix_refresh_tokens_user_id_expires_at", "user_id", "expires_at"),
    )
    
    def __repr__(self) -> str:
        return f"<RefreshToken(id={self.id}, user_id={self.user_id})>"


class JobDescription(Base, TimestampMixin):
    """Job description model for storing uploaded JDs."""
    
    __tablename__ = "job_descriptions"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    jd_id: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False,
        default=lambda: f"jd_{uuid.uuid4().hex[:12]}"
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    extracted_text: Mapped[str] = mapped_column(Text, nullable=False)
    
    # S3 storage info
    s3_key: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)
    
    # Uploaded by
    uploaded_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # Relationships
    questions: Mapped[list["Question"]] = relationship(
        "Question", back_populates="job_description", cascade="all, delete-orphan"
    )
    test_sessions: Mapped[list["TestSession"]] = relationship(
        "TestSession", back_populates="job_description", cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        return f"<JobDescription(id={self.id}, jd_id='{self.jd_id}', title='{self.title}')>"


class QuestionSet(Base, TimestampMixin):
    """Question set model for storing generated question sets."""
    
    __tablename__ = "question_sets"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    question_set_id: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False,
        default=lambda: f"qs_{uuid.uuid4().hex[:12]}"
    )
    skill: Mapped[str] = mapped_column(String(255), nullable=False, index=True)  # Topic/skill name
    level: Mapped[str] = mapped_column(String(20), nullable=False, index=True)  # beginner, intermediate, expert
    
    # Metadata
    total_questions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    generation_model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    # Relationships
    questions: Mapped[list["Question"]] = relationship(
        "Question", back_populates="question_set", cascade="all, delete-orphan"
    )
    
    __table_args__ = (
        Index("ix_question_sets_skill_level", "skill", "level"),
    )
    
    def __repr__(self) -> str:
        return f"<QuestionSet(id={self.id}, question_set_id='{self.question_set_id}', skill='{self.skill}', level='{self.level}')>"


class Question(Base, TimestampMixin):
    """MCQ question model."""
    
    __tablename__ = "questions"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    
    # Link to either QuestionSet OR JobDescription
    question_set_id: Mapped[Optional[str]] = mapped_column(
        String(100), ForeignKey("question_sets.question_set_id"), nullable=True, index=True
    )
    jd_id: Mapped[Optional[str]] = mapped_column(
        String(100), ForeignKey("job_descriptions.jd_id"), nullable=True, index=True
    )
    
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[dict] = mapped_column(JSON, nullable=False)  # {"A": "text", "B": "text", ...}
    correct_answer: Mapped[str] = mapped_column(String(10), nullable=False)  # "A", "B", "C", "D"
    difficulty: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # easy, medium, hard
    topic: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Generation metadata
    generation_model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    generation_time: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Relationships
    question_set: Mapped[Optional["QuestionSet"]] = relationship("QuestionSet", back_populates="questions")
    job_description: Mapped[Optional["JobDescription"]] = relationship("JobDescription", back_populates="questions")
    answers: Mapped[list["Answer"]] = relationship(
        "Answer", back_populates="question", cascade="all, delete-orphan"
    )
    
    __table_args__ = (
        Index("ix_questions_jd_id_created_at", "jd_id", "created_at"),
        Index("ix_questions_question_set_id", "question_set_id", "created_at"),
    )
    
    def __repr__(self) -> str:
        return f"<Question(id={self.id}, question_set_id='{self.question_set_id}', jd_id='{self.jd_id}')>"


class TestSession(Base, TimestampMixin):
    """Test session model for tracking candidate tests."""
    
    __tablename__ = "test_sessions"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False,
        default=lambda: f"session_{uuid.uuid4().hex}"
    )
    
    # Link to either QuestionSet OR JobDescription
    question_set_id: Mapped[Optional[str]] = mapped_column(
        String(100), ForeignKey("question_sets.question_set_id"), nullable=True, index=True
    )
    jd_id: Mapped[Optional[str]] = mapped_column(
        String(100), ForeignKey("job_descriptions.jd_id"), nullable=True, index=True
    )
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Session details
    candidate_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    candidate_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Timing
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Status
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_scored: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    score_released_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Results
    total_questions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    correct_answers: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    score_percentage: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Metadata
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Relationships
    question_set: Mapped[Optional["QuestionSet"]] = relationship("QuestionSet")
    job_description: Mapped[Optional["JobDescription"]] = relationship("JobDescription", back_populates="test_sessions")
    user: Mapped[Optional["User"]] = relationship("User", back_populates="test_sessions")
    answers: Mapped[list["Answer"]] = relationship(
        "Answer", back_populates="test_session", cascade="all, delete-orphan"
    )
    
    __table_args__ = (
        Index("ix_test_sessions_jd_id_created_at", "jd_id", "created_at"),
        Index("ix_test_sessions_user_id_created_at", "user_id", "created_at"),
        Index("ix_test_sessions_question_set_id_created_at", "question_set_id", "created_at"),
    )
    
    def __repr__(self) -> str:
        return f"<TestSession(id={self.id}, session_id='{self.session_id}')>"


class Answer(Base, TimestampMixin):
    """Answer model for storing candidate responses."""
    
    __tablename__ = "answers"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[str] = mapped_column(
        String(100), ForeignKey("test_sessions.session_id"), nullable=False, index=True
    )
    question_id: Mapped[int] = mapped_column(Integer, ForeignKey("questions.id"), nullable=False)
    selected_answer: Mapped[str] = mapped_column(String(10), nullable=False)  # "A", "B", "C", "D"
    is_correct: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    time_taken_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Relationships
    test_session: Mapped["TestSession"] = relationship("TestSession", back_populates="answers")
    question: Mapped["Question"] = relationship("Question", back_populates="answers")
    
    __table_args__ = (
        UniqueConstraint("session_id", "question_id", name="uq_answer_session_question"),
        Index("ix_answers_session_id_created_at", "session_id", "created_at"),
    )
    
    def __repr__(self) -> str:
        return f"<Answer(id={self.id}, session_id='{self.session_id}', question_id={self.question_id})>"


class CeleryTask(Base, TimestampMixin):
    """Track Celery async tasks."""
    
    __tablename__ = "celery_tasks"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    task_id: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    task_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)  # PENDING, STARTED, SUCCESS, FAILURE
    result: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Related entity
    related_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # jd, session, etc.
    related_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    # User who triggered
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    
    __table_args__ = (
        Index("ix_celery_tasks_status_created_at", "status", "created_at"),
    )
    
    def __repr__(self) -> str:
        return f"<CeleryTask(id={self.id}, task_id='{self.task_id}', status='{self.status}')>"


class Candidate(Base, TimestampMixin):
    """Candidate profile model for assessment applicants."""
    
    __tablename__ = "candidates"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    candidate_id: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False,
        default=lambda: f"cand_{uuid.uuid4().hex[:12]}"
    )
    
    # User link (optional - can be anonymous candidate)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Profile information
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    
    # Professional information
    current_role: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Current job title
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # City, Country
    education: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # Highest education
    
    # Social/Professional links
    linkedin_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    github_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    portfolio_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Experience and skills
    experience_years: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # e.g., "5 years"
    experience_level: Mapped[str] = mapped_column(String(50), nullable=False)  # junior, mid, senior, etc.
    skills: Mapped[dict] = mapped_column(JSON, nullable=False, default={})  # {skill_name: proficiency_level}
    availability_percentage: Mapped[int] = mapped_column(Integer, default=100, nullable=False)  # 0-100
    
    # File storage references
    jd_file_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Reference to uploaded JD
    cv_file_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Reference to uploaded CV
    portfolio_file_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Reference to portfolio
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # Relationships
    assessment_applications: Mapped[list["AssessmentApplication"]] = relationship(
        "AssessmentApplication", back_populates="candidate", cascade="all, delete-orphan"
    )
    
    __table_args__ = (
        Index("ix_candidates_email", "email"),
        Index("ix_candidates_user_id", "user_id"),
    )
    
    def __repr__(self) -> str:
        return f"<Candidate(id={self.id}, candidate_id='{self.candidate_id}', email='{self.email}')>"


class Assessment(Base, TimestampMixin):
    """Assessment configuration model for admin-created assessments."""
    
    __tablename__ = "assessments"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    assessment_id: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False,
        default=lambda: f"assess_{uuid.uuid4().hex[:12]}"
    )
    
    # Assessment metadata
    title: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    job_title: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Extracted from JD or admin-defined
    jd_id: Mapped[Optional[str]] = mapped_column(
        String(100), ForeignKey("job_descriptions.jd_id"), nullable=True
    )
    required_skills: Mapped[dict] = mapped_column(JSON, nullable=False, default={})  # {skill: min_proficiency}
    required_roles: Mapped[list] = mapped_column(JSON, nullable=False, default=[])
    
    # Question set link
    question_set_id: Mapped[Optional[str]] = mapped_column(
        String(100), ForeignKey("question_sets.question_set_id"), nullable=True
    )
    
    # Assessment settings
    assessment_method: Mapped[str] = mapped_column(String(50), nullable=False)  # questionnaire, interview
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    is_questionnaire_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_interview_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Question configuration (experience-based)
    total_questions: Mapped[int] = mapped_column(Integer, default=15, nullable=False)
    question_type_mix: Mapped[dict] = mapped_column(
        JSON, 
        nullable=False,
        default={"mcq": 0.5, "coding": 0.3, "architecture": 0.2}
    )  # Distribution of question types
    
    # Scoring configuration (experience-adjusted)
    passing_score_threshold: Mapped[int] = mapped_column(Integer, default=70, nullable=False)  # percentage
    auto_adjust_by_experience: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # Difficulty distribution (can be overridden per role/experience)
    difficulty_distribution: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        default={"easy": 0.2, "medium": 0.5, "hard": 0.3}
    )  # Default distribution: 20% easy, 50% medium, 30% hard
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    @property
    def is_expired(self) -> bool:
        """Check if assessment has expired."""
        if self.expires_at is None:
            return False
        from datetime import timezone
        now = datetime.now(timezone.utc)
        expires = self.expires_at if self.expires_at.tzinfo else self.expires_at.replace(tzinfo=timezone.utc)
        return expires < now
    
    # Admin who created
    created_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Relationships
    applications: Mapped[list["AssessmentApplication"]] = relationship(
        "AssessmentApplication", back_populates="assessment", cascade="all, delete-orphan"
    )
    
    __table_args__ = (
        Index("ix_assessments_title", "title"),
        Index("ix_assessments_is_published", "is_published"),
    )
    
    def __repr__(self) -> str:
        return f"<Assessment(id={self.id}, assessment_id='{self.assessment_id}', title='{self.title}')>"


class AssessmentApplication(Base, TimestampMixin):
    """Track candidate applications to assessments."""
    
    __tablename__ = "assessment_applications"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    application_id: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False,
        default=lambda: f"app_{uuid.uuid4().hex[:12]}"
    )
    
    # Candidate and assessment link
    candidate_id: Mapped[int] = mapped_column(Integer, ForeignKey("candidates.id"), nullable=False)
    assessment_id: Mapped[int] = mapped_column(Integer, ForeignKey("assessments.id"), nullable=False)
    
    # Test session link (if started)
    test_session_id: Mapped[Optional[str]] = mapped_column(
        String(100), ForeignKey("test_sessions.session_id"), nullable=True
    )
    
    # Application status
    status: Mapped[str] = mapped_column(String(50), nullable=False)  # pending, in_progress, completed, shortlisted, rejected
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Submitted form data
    candidate_availability: Mapped[int] = mapped_column(Integer, nullable=False)  # 0-100
    submitted_skills: Mapped[dict] = mapped_column(JSON, nullable=False)  # candidate's self-assessed skills
    role_applied_for: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Relationships
    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="assessment_applications")
    assessment: Mapped["Assessment"] = relationship("Assessment", back_populates="applications")
    test_session: Mapped[Optional["TestSession"]] = relationship("TestSession")
    
    __table_args__ = (
        UniqueConstraint("candidate_id", "assessment_id", name="uq_candidate_assessment"),
        Index("ix_assessment_applications_status", "status"),
        Index("ix_assessment_applications_created_at", "created_at"),
    )
    
    def __repr__(self) -> str:
        return f"<AssessmentApplication(id={self.id}, application_id='{self.application_id}', status='{self.status}')>"


class ScreeningResponse(Base, TimestampMixin):
    """Store screening responses submitted by candidates for an assessment."""

    __tablename__ = "screening_responses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    screening_id: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False,
                                              default=lambda: f"sr_{uuid.uuid4().hex[:12]}")

    assessment_id: Mapped[int] = mapped_column(Integer, ForeignKey("assessments.id"), nullable=False)
    candidate_session_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    candidate_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("candidates.id"), nullable=True)

    # Answers stored as JSON: list or dict depending on question format
    answers: Mapped[dict] = mapped_column(JSON, nullable=False)

    assessment: Mapped[Assessment] = relationship("Assessment")

    __table_args__ = (
        Index("ix_screening_responses_assessment_id", "assessment_id"),
        Index("ix_screening_responses_candidate_session", "candidate_session_id"),
    )

    def __repr__(self) -> str:
        return f"<ScreeningResponse(id={self.id}, screening_id='{self.screening_id}', assessment_id={self.assessment_id})>"


class UploadedDocument(Base, TimestampMixin):
    """Track all uploaded documents from candidates."""
    
    __tablename__ = "uploaded_documents"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    file_id: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False,
        default=lambda: f"file_{uuid.uuid4().hex[:12]}"
    )
    
    # Uploader info
    candidate_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("candidates.id"), nullable=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    
    # File information
    original_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)  # jd, cv, portfolio, requirements, specifications
    document_category: Mapped[str] = mapped_column(String(50), nullable=False)  # jd, cv, portfolio, requirements, specifications
    
    # S3 storage
    s3_key: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    
    # Extracted content
    extracted_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    extraction_preview: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    
    # Metadata
    is_encrypted: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    encryption_method: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # AES-256, etc.
    
    # Relationships
    candidate: Mapped[Optional["Candidate"]] = relationship("Candidate")
    user: Mapped[Optional["User"]] = relationship("User")
    
    __table_args__ = (
        Index("ix_uploaded_documents_candidate_id", "candidate_id"),
        Index("ix_uploaded_documents_document_type", "document_category"),
    )
    
    def __repr__(self) -> str:
        return f"<UploadedDocument(id={self.id}, file_id='{self.file_id}', doc_type='{self.document_category}')>"


class Skill(Base, TimestampMixin):
    """Master list of available skills for the platform."""
    
    __tablename__ = "skills"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    skill_id: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False,
        default=lambda: f"skill_{uuid.uuid4().hex[:12]}"
    )
    
    # Skill info
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False)  # technical, soft, language, etc.
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    __table_args__ = (
        Index("ix_skills_category", "category"),
    )
    
    def __repr__(self) -> str:
        return f"<Skill(id={self.id}, name='{self.name}', category='{self.category}')>"


class Role(Base, TimestampMixin):
    """Master list of available job roles."""
    
    __tablename__ = "roles"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    role_id: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False,
        default=lambda: f"role_{uuid.uuid4().hex[:12]}"
    )
    
    # Role info
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    department: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    # Associated skills (as JSON for flexibility)
    required_skills: Mapped[dict] = mapped_column(JSON, nullable=False, default={})  # {skill_name: required_level}
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    def __repr__(self) -> str:
        return f"<Role(id={self.id}, name='{self.name}', department='{self.department}')>"
