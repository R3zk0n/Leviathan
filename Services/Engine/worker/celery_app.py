"""Celery application for the engine container.

"""

import os

from celery import Celery

BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0")
RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/0")

# A scan can legitimately run for hours. Redis re-delivers any task not acked
# within visibility_timeout, so a value below the worst-case scan duration means
# Redis hands the same scan to a second worker mid-run and two AppShark JVMs
# fight over one output directory. Keep this comfortably above SCAN_TIME_LIMIT.
VISIBILITY_TIMEOUT = int(os.getenv("CELERY_VISIBILITY_TIMEOUT", 6 * 60 * 60))

# Hard/soft ceilings for the JVM task. Soft raises SoftTimeLimitExceeded so the
# task can kill the child and report cleanly; hard is the backstop.
SCAN_SOFT_TIME_LIMIT = int(os.getenv("SCAN_TASK_SOFT_TIME_LIMIT", 3600))
SCAN_TIME_LIMIT = int(os.getenv("SCAN_TASK_TIME_LIMIT", 3900))
TOOL_SOFT_TIME_LIMIT = int(os.getenv("TOOL_TASK_SOFT_TIME_LIMIT", 1800))
TOOL_TIME_LIMIT = int(os.getenv("TOOL_TASK_TIME_LIMIT", 2100))

celery = Celery(
    "engine",
    broker=BROKER_URL,
    backend=RESULT_BACKEND,
    include=["worker.tasks"],
)

celery.conf.update(
    accept_content=["json"],
    task_serializer="json",
    result_serializer="json",

    broker_transport_options={"visibility_timeout": VISIBILITY_TIMEOUT},
    result_expires=24 * 60 * 60,

    # Route by name so the backend only needs to know the task name, and the
    # queue a task lands on is a property of the task rather than of the caller.
    task_routes={
        "engine.run_appshark": {"queue": "engine.scan"},
        "engine.decompile": {"queue": "engine.tools"},
        "engine.trufflehog": {"queue": "engine.tools"},
        "engine.kill_appshark": {"queue": "engine.control"},
        "engine.tool_versions": {"queue": "engine.control"},
        # Engine-local filesystem access (config/ and /tmp/decompiled, neither
        # of which is a shared volume). Cheap and latency-sensitive — they sit
        # on control so a running scan never delays a file read.
        "engine.read_file": {"queue": "engine.control"},
        "engine.write_file": {"queue": "engine.control"},
        "engine.path_exists": {"queue": "engine.control"},
        "engine.batch_path_exists": {"queue": "engine.control"},
        "engine.list_dir": {"queue": "engine.control"},
        "engine.remove_path": {"queue": "engine.control"},
        # Walks a decompiled source tree; can be slow, so it belongs with tools.
        "engine.find_sources": {"queue": "engine.tools"},
        "engine.class_index": {"queue": "engine.tools"},
    },

    # acks_late means a worker crash re-delivers the task rather than losing it.
    # Paired with the idempotency check in run_appshark (which returns early if
    # scan_status.json already shows this scan complete) so a redelivery does
    # not blindly re-run an hour of analysis.
    task_acks_late=True,
    worker_prefetch_multiplier=1,

    # Celery 6 stops honouring broker_connection_retry for startup; set the
    # successor explicitly so behaviour doesn't change on upgrade.
    broker_connection_retry_on_startup=True,
)
