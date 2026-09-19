from project.celery_manager import celery, get_flask_app
from celery.signals import worker_ready


@worker_ready.connect
def on_worker_ready(sender, **kwargs):
    """On startup, immediately recover any scans left in PROCESSING from a previous crash."""
    try:
        from project.api.tasks.tasks import _recover_stale_scans
        with get_flask_app().app_context():
            _recover_stale_scans(all_processing=True)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Startup scan recovery failed: {e}")