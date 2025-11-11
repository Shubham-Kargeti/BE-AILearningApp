"""Celery application configuration."""
from celery import Celery
from config import get_settings

settings = get_settings()

# Create Celery app
celery_app = Celery(
    "ai_learning_app",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        'app.core.tasks.question_generation',
        'app.core.tasks.score_release',
        'app.core.tasks.email_tasks',
    ]
)

# Celery configuration
celery_app.conf.update(
    task_track_started=settings.CELERY_TASK_TRACK_STARTED,
    task_time_limit=settings.CELERY_TASK_TIME_LIMIT,
    task_soft_time_limit=settings.CELERY_TASK_SOFT_TIME_LIMIT,
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_routes={
        'app.core.tasks.question_generation.*': {'queue': 'questions'},
        'app.core.tasks.score_release.*': {'queue': 'scores'},
        'app.core.tasks.email_tasks.*': {'queue': 'emails'},
    },
    task_default_queue='default',
    task_default_exchange='default',
    task_default_routing_key='default',
    worker_prefetch_multiplier=4,
    worker_max_tasks_per_child=1000,
    worker_disable_rate_limits=False,
    result_expires=3600,  # 1 hour
    task_acks_late=True,
    task_reject_on_worker_lost=True,
)

if __name__ == '__main__':
    celery_app.start()
