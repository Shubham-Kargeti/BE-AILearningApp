"""Main FastAPI application with production setup."""
import uuid
from contextlib import asynccontextmanager
from typing import Any
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import structlog

from config import get_settings
from app.db.session import init_db, close_db
# from app.core.redis import init_redis, close_redis  # DISABLED - Redis not in use
from app.core.logging import configure_logging, get_logger
from app.core.sentry import init_sentry
from app.core.metrics import setup_metrics

# API routers
from app.api.mcq_generation import router as mcq_generation_router
from app.api.upload_jd import router as upload_router
from app.api import auth, users, admin, dashboard, test_sessions
from app.api.questionset_tests import router as questionset_tests_router

# Import for recommended courses if it exists
try:
    from app.api.recommended_courses import router as recommended_courses_router
    has_recommended_courses = True
except ImportError:
    has_recommended_courses = False

settings = get_settings()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    logger.info("starting_application", environment=settings.ENVIRONMENT)
    
    # Initialize logging
    configure_logging()
    
    # Initialize Sentry
    init_sentry()
    
    # Initialize Redis - DISABLED
    # try:
    #     await init_redis()
    #     logger.info("redis_initialized")
    # except Exception as e:
    #     logger.error("redis_initialization_failed", error=str(e))
    
    # Initialize database (in production, use Alembic migrations)
    try:
        await init_db()
        logger.info("database_initialized")
    except Exception as e:
        logger.error("database_initialization_failed", error=str(e))
    
    yield
    
    # Shutdown
    logger.info("shutting_down_application")
    
    # await close_redis()  # DISABLED - Redis not in use
    await close_db()
    
    logger.info("application_shutdown_complete")


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
# AI-Powered Learning and Assessment Platform

A comprehensive platform for generating AI-powered assessments, conducting skill-based tests, and providing personalized course recommendations.

## Features

### 🎯 Question Generation
- **Generate MCQ Questions**: Create multiple-choice questions using AI for any topic and difficulty level
- **Automatic Storage**: All generated questions are saved to the database with metadata
- **Support for Multiple Levels**: Beginner, Intermediate, and Expert difficulty levels

### 📝 Test Management
- **QuestionSet Tests**: Start tests from pre-generated question sets
- **Immediate Feedback**: Get instant results upon test submission
- **Detailed Analytics**: View detailed performance metrics and answer analysis

### 🎓 Course Recommendations (NEW)
- **AI-Powered Search**: Vector-based semantic search using FAISS and HuggingFace embeddings
- **Personalized Learning Paths**: Get course recommendations based on skills and topics
- **Smart Matching**: Advanced similarity scoring for best course fit
- **Comprehensive Coverage**: Fallback search ensures you always get recommendations

### 👤 User Management
- **Authentication**: Secure JWT-based authentication
- **Role-based Access**: Support for Candidate, Recruiter, and Admin roles
- **Profile Management**: Complete user profile and dashboard features

### 📊 Analytics & Reporting
- **Test Results**: Comprehensive test result tracking
- **Performance Metrics**: Detailed scoring and question-level analytics
- **Dashboard**: User-specific dashboard with test history

## API Endpoints

All API endpoints are organized under `/api/v1/` prefix.

## Authentication

Most endpoints require JWT authentication. Use the `/api/v1/auth/login` endpoint to obtain a token.
    """,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
    openapi_tags=[
        {
            "name": "Authentication",
            "description": "User authentication and authorization endpoints"
        },
        {
            "name": "Users",
            "description": "User management and profile operations"
        },
        {
            "name": "Questions",
            "description": "AI-powered question generation endpoints"
        },
        {
            "name": "QuestionSet Tests",
            "description": "Test management for pre-generated question sets with immediate feedback"
        },
        {
            "name": "Test Sessions",
            "description": "General test session management and tracking"
        },
        {
            "name": "Job Descriptions",
            "description": "Upload and manage job descriptions for skill-based testing"
        },
        {
            "name": "Dashboard",
            "description": "User dashboard and analytics"
        },
        {
            "name": "Admin",
            "description": "Administrative operations (Admin role required)"
        },
        {
            "name": "Recommended Courses",
            "description": "AI-powered course recommendations using vector similarity search"
        },
        {
            "name": "Database Testing",
            "description": "Database testing endpoints (DEBUG mode only, not available in production)"
        },
        {
            "name": "Health",
            "description": "Health check and system status endpoints"
        },
        {
            "name": "Root",
            "description": "Root API information"
        },
        {
            "name": "Monitoring",
            "description": "Prometheus metrics and monitoring endpoints"
        }
    ],
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=settings.CORS_ALLOW_METHODS,
    allow_headers=settings.CORS_ALLOW_HEADERS,
)

# GZip compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Request ID middleware
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """Add request ID to all requests."""
    request_id = str(uuid.uuid4())
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(
        request_id=request_id,
        path=request.url.path,
        method=request.method,
    )
    
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    
    return response


# Logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests."""
    logger.info(
        "request_started",
        method=request.method,
        path=request.url.path,
        client_host=request.client.host if request.client else None,
    )
    
    response = await call_next(request)
    
    logger.info(
        "request_completed",
        status_code=response.status_code,
    )
    
    return response


# Exception handlers
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions."""
    logger.error(
        "http_exception",
        status_code=exc.status_code,
        detail=exc.detail,
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors."""
    logger.error("validation_error", errors=exc.errors())
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "Validation error",
            "details": exc.errors(),
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions."""
    logger.exception("unhandled_exception", exc_info=exc)
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal server error",
            "message": str(exc) if settings.DEBUG else "An error occurred",
        },
    )


# Setup Prometheus metrics
if settings.ENVIRONMENT != "testing":
    instrumentator = setup_metrics(app)


# Health check endpoints
@app.get("/health", tags=["Health"])
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }


@app.get("/", tags=["Root"])
async def read_root() -> dict[str, str]:
    """Root endpoint."""
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "version": settings.APP_VERSION,
        "docs": "/docs" if settings.DEBUG else "disabled",
    }


# Include API routers
app.include_router(auth.router, prefix=settings.API_V1_PREFIX, tags=["Authentication"])
app.include_router(users.router, prefix=settings.API_V1_PREFIX, tags=["Users"])
app.include_router(dashboard.router, prefix=settings.API_V1_PREFIX, tags=["Dashboard"])
app.include_router(test_sessions.router, prefix=settings.API_V1_PREFIX, tags=["Test Sessions"])
app.include_router(questionset_tests_router, prefix=settings.API_V1_PREFIX, tags=["QuestionSet Tests"])
app.include_router(upload_router, prefix=settings.API_V1_PREFIX, tags=["Job Descriptions"])
app.include_router(mcq_generation_router, prefix=settings.API_V1_PREFIX, tags=["Questions"])
app.include_router(admin.router, prefix=settings.API_V1_PREFIX, tags=["Admin"])

# Include recommended courses router if available
if has_recommended_courses:
    app.include_router(recommended_courses_router, prefix=settings.API_V1_PREFIX, tags=["Recommended Courses"])


# Metrics endpoint
if settings.ENVIRONMENT != "testing":
    @app.get("/metrics", tags=["Monitoring"])
    async def metrics():
        """Prometheus metrics endpoint."""
        from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
        from starlette.responses import Response
        
        return Response(
            content=generate_latest(),
            media_type=CONTENT_TYPE_LATEST,
        )


# Database testing endpoints (for development/testing only)
if settings.DEBUG:
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker
    
    # Create synchronous engine for test endpoints using settings
    test_engine = create_engine(settings.database_url_sync)
    TestSession = sessionmaker(bind=test_engine)
    
    @app.post("/test-db", tags=["Database Testing"])
    def test_db():
        """Create and populate test table (DEBUG only)."""
        with TestSession() as session:
            session.execute(text("CREATE TABLE IF NOT EXISTS test_table(id SERIAL PRIMARY KEY, name VARCHAR(50));"))
            session.execute(text("INSERT INTO test_table(name) VALUES ('Sample Entry');"))
            session.commit()
            result = session.execute(text("SELECT * FROM test_table;"))
            rows = [dict(row._mapping) for row in result]
        return {"rows": rows}
    
    @app.get("/view-test-table", tags=["Database Testing"])
    def view_test_table():
        """View test table contents (DEBUG only)."""
        with TestSession() as session:
            session.execute(text("CREATE TABLE IF NOT EXISTS test_table(id SERIAL PRIMARY KEY, name VARCHAR(50));"))
            result = session.execute(text("SELECT * FROM test_table;"))
            rows = [dict(row._mapping) for row in result]
        return {"rows": rows}
    
    @app.delete("/delete-test-table", tags=["Database Testing"])
    def delete_test_table():
        """Delete test table and all entries (DEBUG only)."""
        with TestSession() as session:
            # Delete all entries
            session.execute(text("DELETE FROM test_table;"))
            # Drop the table
            session.execute(text("DROP TABLE IF EXISTS test_table;"))
            session.commit()
        return {"message": "test_table deleted along with all entries."}