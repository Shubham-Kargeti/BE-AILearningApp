"""Prometheus metrics configuration."""
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_client import Counter, Histogram, Gauge
from config import get_settings

settings = get_settings()

# Custom metrics
questions_generated_total = Counter(
    "questions_generated_total",
    "Total number of questions generated",
    ["jd_id", "status"]
)

question_generation_duration = Histogram(
    "question_generation_duration_seconds",
    "Time spent generating questions",
    ["jd_id"]
)

test_sessions_total = Counter(
    "test_sessions_total",
    "Total number of test sessions",
    ["status"]
)

test_completion_duration = Histogram(
    "test_completion_duration_seconds",
    "Time spent completing tests",
    buckets=[60, 300, 600, 1800, 3600, 7200]
)

test_scores = Histogram(
    "test_scores_percentage",
    "Distribution of test scores",
    buckets=[0, 20, 40, 60, 80, 100]
)

active_test_sessions = Gauge(
    "active_test_sessions",
    "Number of currently active test sessions"
)

otp_requests_total = Counter(
    "otp_requests_total",
    "Total OTP requests",
    ["status"]
)

auth_attempts_total = Counter(
    "auth_attempts_total",
    "Total authentication attempts",
    ["status"]
)

s3_operations_total = Counter(
    "s3_operations_total",
    "Total S3 operations",
    ["operation", "status"]
)

celery_tasks_total = Counter(
    "celery_tasks_total",
    "Total Celery tasks",
    ["task_name", "status"]
)


def setup_metrics(app) -> Instrumentator:
    """Setup Prometheus metrics instrumentation."""
    instrumentator = Instrumentator(
        should_group_status_codes=False,
        should_ignore_untemplated=True,
        should_respect_env_var=True,
        should_instrument_requests_inprogress=True,
        excluded_handlers=["/metrics", "/health", "/docs", "/openapi.json"],
        env_var_name="ENABLE_METRICS",
        inprogress_name="http_requests_inprogress",
        inprogress_labels=True,
    )
    
    instrumentator.instrument(app)
    
    return instrumentator
