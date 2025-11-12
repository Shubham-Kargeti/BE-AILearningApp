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
