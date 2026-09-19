#!/usr/bin/env bash
set -euo pipefail

until nc -z db 5432; do
  sleep 0.5
done

CELERY_LOG_DIR="/var/log/celery"
CELERY_IOS_WORKER_LOG="$CELERY_LOG_DIR/ios_worker.log"
mkdir -p "$CELERY_LOG_DIR"
touch "$CELERY_IOS_WORKER_LOG"

celery -A project.celery_worker.celery worker \
  --loglevel=INFO \
  --concurrency=1 \
  --queues=ios \
  --pool=prefork \
  --without-gossip \
  --without-mingle \
  --heartbeat-interval=10 \
  --logfile="$CELERY_IOS_WORKER_LOG" &
CELERY_IOS_WORKER_PID=$!

cleanup() {
  kill -TERM "$CELERY_IOS_WORKER_PID" 2>/dev/null || true
  wait "$CELERY_IOS_WORKER_PID" 2>/dev/null || true
}
trap cleanup INT TERM

python manage.py run -h 0.0.0.0

cleanup
