import os
from celery import Celery
from flask import Flask
from datetime import timedelta

from project.config import CeleryConfig


def make_celery(app: Flask | None = None) -> Celery:
    if app is None:
        app = Flask(__name__)
        app.config.from_object("project.config.DevelopmentConfig")

    # Use Docker env vars as the source of truth (these names are fine)
    broker = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0")
    backend = os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/0")

    celery = Celery(app.import_name, broker=broker, backend=backend)

    # Load ONLY celery-specific config (new-style keys) to avoid mixing
    celery.config_from_object(CeleryConfig)

    # Optional: if you want beat timezone here (can also live in CeleryConfig)
    celery.conf.timezone = getattr(CeleryConfig, "timezone", "UTC")

    # Flask app context support for tasks. Uses the single fully-initialized app
    # (get_flask_app) so tasks run with SQLAlchemy/etc. bound WITHOUT each task
    # building its own app (which created a new DB engine/pool per invocation).
    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with get_flask_app().app_context():
                return self.run(*args, **kwargs)

    celery.Task = ContextTask
    return celery


# Single fully-initialized Flask app per worker process, built lazily and cached.
# Lazy import of create_app avoids the project -> celery_manager -> project
# circular import at module load; by the time a task runs, project is imported.
_real_app = None


def get_flask_app():
    global _real_app
    if _real_app is None:
        from project import create_app
        _real_app = create_app()
    return _real_app


# Build the Flask app config for anything else your app needs
flask_app = Flask(__name__)
flask_app.config.from_object("project.config.DevelopmentConfig")

celery = make_celery(flask_app)

# Autodiscover tasks
celery.autodiscover_tasks(["project.api.tasks"])

# Celery Beat Schedule - Periodic Tasks
celery.conf.beat_schedule = {
    "scan-watchdog-every-5-minutes": {
        "task": "project.api.tasks.tasks.scan_watchdog_task",
        "schedule": timedelta(minutes=5),
        "options": {"queue": "celery"},
    },
}


def configure_celery(app: Flask) -> Celery:
    """
    Keep this for compatibility with older imports.
    Celery itself is already configured by CeleryConfig + env vars.
    """
    return celery
