#!/usr/bin/env bash
set -euo pipefail

until nc -z db 5432; do
  sleep 0.5
done

CELERY_LOG_DIR="/var/log/celery"
CELERY_WORKER_LOG="$CELERY_LOG_DIR/worker.log"
CELERY_DECOMPILE_WORKER_LOG="$CELERY_LOG_DIR/decompile_worker.log"
CELERY_BEAT_LOG="$CELERY_LOG_DIR/beat.log"

mkdir -p "$CELERY_LOG_DIR"
touch "$CELERY_WORKER_LOG"
touch "$CELERY_DECOMPILE_WORKER_LOG"
touch "$CELERY_BEAT_LOG"

celery -A project.celery_worker.celery worker \
  --loglevel="${CELERY_LOGLEVEL:-INFO}" \
  --concurrency="${CELERY_WORKER_CONCURRENCY:-4}" \
  --queues=celery \
  --hostname=default@%h \
  --pool=prefork \
  --without-gossip \
  --without-mingle \
  --heartbeat-interval=10 \
  --logfile="$CELERY_WORKER_LOG" &
CELERY_WORKER_PID=$!

celery -A project.celery_worker.celery worker \
  --loglevel=INFO \
  --concurrency=1 \
  --queues=decompile \
  --hostname=decompile@%h \
  --pool=prefork \
  --without-gossip \
  --without-mingle \
  --heartbeat-interval=10 \
  --logfile="$CELERY_DECOMPILE_WORKER_LOG" &
CELERY_DECOMPILE_WORKER_PID=$!

celery -A project.celery_worker.celery beat \
  --loglevel=INFO \
  --logfile="$CELERY_BEAT_LOG" \
  --pidfile=/tmp/celerybeat.pid \
  --schedule=/tmp/celerybeat-schedule &
CELERY_BEAT_PID=$!

cleanup() {
  kill -TERM "$CELERY_WORKER_PID" 2>/dev/null || true
  kill -TERM "$CELERY_DECOMPILE_WORKER_PID" 2>/dev/null || true
  kill -TERM "$CELERY_BEAT_PID" 2>/dev/null || true
  wait "$CELERY_WORKER_PID" 2>/dev/null || true
  wait "$CELERY_DECOMPILE_WORKER_PID" 2>/dev/null || true
  wait "$CELERY_BEAT_PID" 2>/dev/null || true
}
trap cleanup INT TERM

gunicorn "project:create_app()" \
  --bind 0.0.0.0:5000 \
  --workers "${GUNICORN_WORKERS:-3}" \
  --worker-class gthread \
  --threads "${GUNICORN_THREADS:-8}" \
  --timeout "${GUNICORN_TIMEOUT:-120}" \
  --graceful-timeout 30 \
  --keep-alive 5 \
  --access-logfile - --error-logfile -

cleanup
