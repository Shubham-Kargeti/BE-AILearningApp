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
from app.core.redis import init_redis, close_redis
from app.core.logging import configure_logging, get_logger
from app.core.sentry import init_sentry
from app.core.metrics import setup_metrics

# API routers
from app.api.mcq_generation import router as mcq_generation_router
from app.api.upload_jd import router as upload_router
from app.api import auth, users, admin, dashboard, test_sessions

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
    
    # Initialize Redis
    try:
        await init_redis()
        logger.info("redis_initialized")
    except Exception as e:
        logger.error("redis_initialization_failed", error=str(e))
    
    # Initialize database (in production, use Alembic migrations)
    try:
        await init_db()
        logger.info("database_initialized")
    except Exception as e:
        logger.error("database_initialization_failed", error=str(e))
    
    yield
    
    # Shutdown
    logger.info("shutting_down_application")
    
    await close_redis()
    await close_db()
    
    logger.info("application_shutdown_complete")


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-powered learning and assessment platform",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
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
app.include_router(upload_router, prefix=settings.API_V1_PREFIX, tags=["Job Descriptions"])
app.include_router(mcq_generation_router, prefix=settings.API_V1_PREFIX, tags=["Questions"])
app.include_router(admin.router, prefix=settings.API_V1_PREFIX, tags=["Admin"])


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