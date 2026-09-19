import os

class BaseConfig:
    TESTING = False
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    BCRYPT_HANDLE_LONG_PASSWORDS = True
    SECRET_KEY = os.environ.get("SECRET_KEY")
    BCRYPT_LOG_ROUNDS = 13
    ACCESS_TOKEN_EXPIRATION = 900  # 15 minutes
    REFRESH_TOKEN_EXPIRATION = 2592000  # 30 days

    # SQLAlchemy connection pool settings to prevent "too many clients" errors
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_size": 5,           # Number of connections to keep open
        "max_overflow": 10,       # Additional connections allowed beyond pool_size
        "pool_timeout": 30,       # Seconds to wait for a connection from pool
        "pool_recycle": 1800,     # Recycle connections after 30 minutes
        "pool_pre_ping": True,    # Check connection health before using
    }

class DevelopmentConfig(BaseConfig):
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL")
    BCRYPT_LOG_ROUNDS = 4
    broker_url = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0")
    result_backend = os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/0")

class TestingConfig(BaseConfig):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_TEST_URL")
    BCRYPT_LOG_ROUNDS = 4
    ACCESS_TOKEN_EXPIRATION = 3
    REFRESH_TOKEN_EXPIRATION = 3

class ProductionConfig(BaseConfig):
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL")

class CeleryConfig:
    broker_url = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0")
    result_backend = os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/0")

    # NEW style names (Celery 5+)
    accept_content = ["json"]
    task_serializer = "json"
    result_serializer = "json"   # strongly recommended

    # Separate queues let decompile jobs run even while scan jobs are busy.
    task_default_queue = "celery"
    task_routes = {
        "project.api.tasks.tasks.decompile_apk_task": {"queue": "decompile"},
        # Heavy strongarm whole-binary pass. strongarm-dataflow has no linux/arm64
        # wheel, so this MUST run on the amd64 ios-analysis worker (its own `ios`
        # queue), never the native-arm64 decompile worker where it would fail at
        # runtime the moment it calls into strongarm_dataflow.
        "project.api.tasks.tasks.build_ios_xref_index_task": {"queue": "ios"},

        # ── Engine container tasks ───────────────────────────────────────────
        # Executed by the Celery workers inside the engine container (see
        # Services/Engine/worker/). Dispatched by NAME via send_task — the
        # backend never imports engine code. Routing them here means callers
        # don't have to remember which queue each one belongs on.
        #
        # Split by contended resource: the AppShark JVM holds a 12 GB heap and
        # must serialise, while jadx/trufflehog should keep running *during* a
        # scan (docker exec gave that parallelism implicitly; a single shared
        # queue would silently take it away). Control stays separate so a
        # cancel never queues behind the scan it is cancelling.
        # These names MUST match Services/Engine/worker/celery_app.py exactly.
        # An unrouted engine.* task silently falls through to task_default_queue
        # ("celery"), where a backend worker consumes it and raises NotRegistered
        # — the failure surfaces as a confusing task error, not a routing error.
        "engine.run_appshark": {"queue": "engine.scan"},
        "engine.decompile": {"queue": "engine.tools"},
        "engine.trufflehog": {"queue": "engine.tools"},
        "engine.find_sources": {"queue": "engine.tools"},
        "engine.class_index": {"queue": "engine.tools"},
        "engine.kill_appshark": {"queue": "engine.control"},
        "engine.tool_versions": {"queue": "engine.control"},
        "engine.read_file": {"queue": "engine.control"},
        "engine.write_file": {"queue": "engine.control"},
        "engine.path_exists": {"queue": "engine.control"},
        "engine.batch_path_exists": {"queue": "engine.control"},
        "engine.list_dir": {"queue": "engine.control"},
        "engine.remove_path": {"queue": "engine.control"},
    }

    # Redis re-delivers any task not acked within visibility_timeout. The
    # default is 1 hour and scans routinely run longer, so without this Redis
    # hands a running scan to a second worker and two AppShark JVMs end up
    # fighting over one output directory. Must stay above SCAN_TASK_TIME_LIMIT.
    CELERY_VISIBILITY_TIMEOUT = int(os.getenv("CELERY_VISIBILITY_TIMEOUT", 6 * 60 * 60))
    broker_transport_options = {"visibility_timeout": CELERY_VISIBILITY_TIMEOUT}
    result_backend_transport_options = {"visibility_timeout": CELERY_VISIBILITY_TIMEOUT}

    SCAN_TASK_SOFT_TIME_LIMIT = int(os.getenv("SCAN_TASK_SOFT_TIME_LIMIT", 3600))
    SCAN_TASK_TIME_LIMIT = int(os.getenv("SCAN_TASK_TIME_LIMIT", 3900))

    # These are the names Celery 5 actually reads. The UPPERCASE constants above
    # were only ever consumed by tasks.py via getattr, so no global limit was in
    # force — a hung task held its worker slot indefinitely.
    #
    # The global ceiling is generous because run_scan_task blocks on the engine
    # worker's result for the duration of the scan; per-task decorators tighten
    # it where a shorter limit is correct.
    task_soft_time_limit = int(os.getenv("CELERY_SOFT_TIME_LIMIT", 6 * 60 * 60))
    task_time_limit = int(os.getenv("CELERY_TIME_LIMIT", 6 * 60 * 60 + 600))

    # How long run_scan_task waits on the engine worker before giving up. Kept
    # below the transport visibility timeout so a stuck scan surfaces as a task
    # failure rather than a silent Redis redelivery.
    ENGINE_TASK_TIMEOUT = int(os.getenv("ENGINE_TASK_TIMEOUT", 4 * 60 * 60))
    ENGINE_CONTROL_TIMEOUT = int(os.getenv("ENGINE_CONTROL_TIMEOUT", 60))

    WATCHDOG_INTERVAL = int(os.getenv("WATCHDOG_INTERVAL", 300))
    WATCHDOG_STUCK_THRESHOLD = int(os.getenv("WATCHDOG_STUCK_THRESHOLD", 3600))

