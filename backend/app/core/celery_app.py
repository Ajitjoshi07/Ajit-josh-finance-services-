from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "ajit_finance",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.tasks.ocr_tasks", "app.tasks.report_tasks", "app.tasks.notification_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=True,
    task_routes={
        "app.tasks.ocr_tasks.*": {"queue": "ocr"},
        "app.tasks.report_tasks.*": {"queue": "reports"},
        "app.tasks.notification_tasks.*": {"queue": "notifications"},
    },
    beat_schedule={
        "check-filing-deadlines-daily": {
            "task": "app.tasks.notification_tasks.check_deadlines",
            "schedule": 86400.0,
        },
    },
)
