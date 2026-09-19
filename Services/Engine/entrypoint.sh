#!/usr/bin/env bash
set -euo pipefail

WORKER_DIR="${WORKER_DIR:-/opt/engine}"
SCAN_CONCURRENCY="${ENGINE_SCAN_CONCURRENCY:-1}"
TOOLS_CONCURRENCY="${ENGINE_TOOLS_CONCURRENCY:-3}"
CONTROL_CONCURRENCY="${ENGINE_CONTROL_CONCURRENCY:-1}"
LOGLEVEL="${ENGINE_LOGLEVEL:-INFO}"

cd "$WORKER_DIR"

python - <<'PY'
import os, socket, sys, time
from urllib.parse import urlparse

url = urlparse(os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0"))
host, port = url.hostname or "redis", url.port or 6379
deadline = time.time() + 120
while time.time() < deadline:
    try:
        with socket.create_connection((host, port), timeout=2):
            sys.exit(0)
    except OSError:
        time.sleep(0.5)
sys.exit(1)
PY

pids=()

start_worker() {
  local queue="$1" concurrency="$2" name="$3"
  celery -A worker.celery_app.celery worker \
    --loglevel="$LOGLEVEL" \
    --queues="$queue" \
    --concurrency="$concurrency" \
    --hostname="${name}@%h" \
    --pool=prefork \
    --without-gossip \
    --without-mingle &
  pids+=("$!")
}

start_worker "engine.scan"    "$SCAN_CONCURRENCY"    "scan"
start_worker "engine.tools"   "$TOOLS_CONCURRENCY"   "tools"
start_worker "engine.control" "$CONTROL_CONCURRENCY" "control"

cleanup() {
  for pid in "${pids[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  for pid in "${pids[@]}"; do
    wait "$pid" 2>/dev/null || true
  done
}
trap cleanup INT TERM

wait -n "${pids[@]}"
cleanup
exit 1
