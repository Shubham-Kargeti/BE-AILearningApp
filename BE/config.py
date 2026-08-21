from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import Optional
import os
from pydantic import field_validator
from pydantic import field_validator


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    model_config = SettingsConfigDict(
        env_file=".env",                
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    # Application
    APP_NAME: str = "AI Learning App"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 4
    RELOAD: bool = True
    
    # Database
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "ai_learning_db"
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "postgres"
    DATABASE_URL: Optional[str] = None
    DB_ECHO: bool = False
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 3600
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Build DATABASE_URL from components if not provided
        if not self.DATABASE_URL:
            self.DATABASE_URL = (
                f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}"
                f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
            )
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_MAX_CONNECTIONS: int = 50
    REDIS_DECODE_RESPONSES: bool = True
    
    # Redis Key Prefixes
    REDIS_OTP_PREFIX: str = "otp:"
    REDIS_SESSION_PREFIX: str = "session:"
    REDIS_RATELIMIT_PREFIX: str = "ratelimit:"
    REDIS_LOCK_PREFIX: str = "lock:"
    REDIS_CACHE_PREFIX: str = "cache:"
    
    # OTP Settings
    OTP_LENGTH: int = 6
    OTP_EXPIRY_SECONDS: int = 300  # 5 minutes
    OTP_MAX_ATTEMPTS: int = 3
    
    # S3/MinIO
    S3_ENDPOINT_URL: Optional[str] = "http://localhost:9000"
    S3_ACCESS_KEY_ID: str = "minioadmin"
    S3_ACCESS_KEY_SECRET: str = "minioadmin"
    S3_SESSION_TOKEN: Optional[str] = None
    S3_BUCKET_NAME: str = "learning-app-docs"
    S3_REGION: str = "us-east-1"
    S3_USE_SSL: bool = False
    
    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"
    CELERY_TASK_TRACK_STARTED: bool = True
    CELERY_TASK_TIME_LIMIT: int = 3600  # 1 hour
    CELERY_TASK_SOFT_TIME_LIMIT: int = 3000  # 50 minutes
    
    # JWT Authentication
    JWT_SECRET_KEY: str = "your-super-secret-jwt-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Azure AD SSO
    AZURE_CLIENT_ID: str = ""
    AZURE_CLIENT_SECRET: str = ""
    AZURE_TENANT_ID: str = ""
    AZURE_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/sso/azure/callback"
    
    # Email Configuration (Brevo - formerly Sendinblue)
    # Free tier: 300 emails/day
    # SMTP: smtp-relay.brevo.com:587
    # Get credentials: https://app.brevo.com/settings/keys/smtp
    SMTP_HOST: str = "smtp-relay.brevo.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""  # Your Brevo login email
    SMTP_PASSWORD: str = ""  # Your Brevo SMTP key (not account password)
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "AI Learning App"
    
    # Rate Limiting
    RATE_LIMIT_LOGIN: str = "5/minute"
    RATE_LIMIT_OTP: str = "3/minute"
    RATE_LIMIT_API: str = "100/minute"
    
    # Frontend/Application URLs
    FRONTEND_URL: str = "http://localhost:5173"
    APP_URL: str = "http://localhost:5173"  # Used for generating share links
    
    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: list[str] = ["*"]
    CORS_ALLOW_HEADERS: list[str] = ["*"]
    
    # API Key for public/admin-outofscope endpoints
    API_KEY: str = "b734e6e3e71654df4de57eaf1629c4b4b48e20f54e1f4b4ebbc256b316f91e22"
    
    # Sentry
    SENTRY_DSN: Optional[str] = None
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1
    SENTRY_PROFILES_SAMPLE_RATE: float = 0.1
    
    # AI/ML
    # GROQ_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    OPENAI_API_URL: str = "https://api.openai.com/v1/chat/completions"
    LLM_PROVIDER: str = "openai"
    LLM_MODEL: str = "gpt-4o"
    LLM_TEMPERATURE: float = 0.0
    LLM_MAX_TOKENS: Optional[int] = None
    
    @field_validator("LLM_MAX_TOKENS", mode="before")
    @classmethod
    def validate_llm_max_tokens(cls, value):
        if value in ("", None):
            return None
        return int(value)

    @field_validator("DEBUG", mode="before")
    @classmethod
    def validate_debug(cls, value):
        if isinstance(value, str) and value.strip().lower() in {"release", "prod", "production"}:
            return False
        return value
    
    MAX_QUESTIONS_PER_TEST: int = 20
    QUESTION_GENERATION_TIMEOUT: int = 300  # 5 minutes

    # SSL / RDS dev helper
    # When true, the app will create an SSL context that does not verify
    # certificates. This is intended for short-lived dev usage only
    # (e.g., when connecting to an RDS instance with a non-standard cert chain).
    SKIP_SSL_VERIFY: bool = False
    
    # Test Sessions
    TEST_DURATION_MINUTES: int = 30
    QUESTION_TIMEOUT_SECONDS: int = 30  # Auto-progress after 30 seconds
    SCORE_RELEASE_DELAY_HOURS: int = 24
    
    # MVP-1 Settings
    TOPIC_DEFAULT: str = "agentic_ai"
    DIFFICULTY_LEVELS: list[str] = ["basic", "intermediate", "advanced"]
    AUTO_PROGRESS_ENABLED: bool = True
    
    # File Upload
    MAX_UPLOAD_SIZE_MB: int = 10
    ALLOWED_EXTENSIONS: list[str] = [".pdf", ".docx", ".txt"]
    
    # Admin Users (email-based for MVP)
    ADMIN_EMAILS: list[str] = [
        "admin@nagarro.com", "monika.singh01@nagarro.com"
    ]
    ADMIN_PASSWORD: str = "Admin@123"

    # Onboarding Success Mail
    ONBOARDING_EMAILS: list[str] = [
        "monika.singh01@nagarro.com",
        "devinder.kumar@nagarro.com",
        "arpit.saxena01@nagarro.com",
    ]

    # Onboarding Videos
    # When False, video URLs are served from the static GitHub-hosted list
    # instead of fetching/generating presigned URLs from S3.
    FETCH_VIDEOS_FROM_S3: bool = False
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"  # json or console
    
    @property
    def database_url_sync(self) -> str:
        """Get synchronous database URL for Alembic."""
        if self.DATABASE_URL:
            return self.DATABASE_URL.replace("+asyncpg", "")
        return (
            f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Legacy support for existing code
settings = get_settings()
OPENAI_API_KEY = settings.OPENAI_API_KEY

