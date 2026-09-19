"""Access to engine-container state, without the Docker socket.

Previously every operation here shelled into the engine container via
``docker exec`` over a mounted /var/run/docker.sock. That made the backend
root-equivalent on the host while it ingests untrusted APKs, and it round-tripped
megabyte JSON blobs through a shell.

Three kinds of path, three mechanisms:

``Scans/``   Shared volume, mounted at the SAME absolute path in both containers
             (/appshark_engine/appshark/Scans). Direct filesystem I/O, no
             translation needed. This is the bulk of the traffic.

``uploads/`` Shared volume, mounted at DIFFERENT paths (backend
             /usr/src/app/uploads, engine /appshark_engine/appshark/uploads).
             Direct I/O after translating the prefix.

``config/``  NOT a volume — baked into the engine image by COPY. The backend has
             no mount for it, so these must be delegated to the engine worker
             (engine.read_config_file / engine.write_config_file).
             Note this also means UI edits to rules and EngineConfig.json5 land
             in the container's writable layer and are lost on rebuild. That is
             pre-existing behaviour; fixing it needs a config volume.

There is no ``exec()`` here any more, and no Docker client: the socket mount has
been removed from docker-compose. Anything that needs to *run* something in the
engine container must go through a named task in Services/Engine/worker/ — add
a specific task rather than a general "run this command" one, since the Redis
broker is not authenticated.
"""

import logging
import os
import shutil
from pathlib import Path

logger = logging.getLogger(__name__)

# Same path in both containers — the scans volume is mounted identically.
SCANS_ROOT = "/appshark_engine/appshark/Scans"

# Same volume, different mount points.
ENGINE_UPLOADS = "/appshark_engine/appshark/uploads"
LOCAL_UPLOADS = os.getenv("UPLOAD_FOLDER", "/usr/src/app/uploads")

# Engine-container-local paths. NOT volumes — config/ is baked into the image by
# COPY, /tmp/decompiled is container scratch. The backend cannot see either, so
# access has to go through the engine worker.
ENGINE_CONFIG_ROOT = "/appshark_engine/appshark/config"
ENGINE_DECOMPILED_ROOT = "/tmp/decompiled"

ENGINE_READ_TASK = "engine.read_file"
ENGINE_WRITE_TASK = "engine.write_file"
ENGINE_EXISTS_TASK = "engine.path_exists"
ENGINE_BATCH_EXISTS_TASK = "engine.batch_path_exists"
ENGINE_LIST_TASK = "engine.list_dir"
ENGINE_REMOVE_TASK = "engine.remove_path"


def _under(path: str, root: str) -> bool:
    return path == root or path.startswith(root.rstrip("/") + "/")


def is_local_path(path: str) -> bool:
    """True if the backend can reach this path on a shared volume.

    An ALLOWLIST, deliberately. Only Scans/ and uploads/ are shared. Anything
    else — config/, /tmp/decompiled, /tmp/anything — exists only in the engine
    container. Treating this as a blocklist was a real bug: unlisted engine
    paths resolved against the backend's own empty filesystem, so reads returned
    "not found" instead of raising, and the failure looked like missing data
    rather than a wiring error.
    """
    normalised = os.path.normpath(path)
    return (
        _under(normalised, SCANS_ROOT)
        or _under(normalised, ENGINE_UPLOADS)
        or _under(normalised, os.path.normpath(LOCAL_UPLOADS))
    )


def to_local(path: str) -> str:
    """Translate an engine-container path to its backend-visible equivalent.

    Scans paths are returned unchanged (identical mount point in both
    containers). Uploads paths are re-prefixed. Engine-local paths raise —
    callers must route those through the worker.
    """
    normalised = os.path.normpath(path)
    if not is_local_path(normalised):
        raise ValueError(
            f"{path} is engine-container-local (not a shared volume); "
            f"route it through the engine worker tasks instead"
        )
    if _under(normalised, ENGINE_UPLOADS):
        return os.path.join(LOCAL_UPLOADS, os.path.relpath(normalised, ENGINE_UPLOADS))
    return normalised


def to_engine(path: str) -> str:
    """Inverse of to_local: backend-visible path -> engine-container path."""
    normalised = os.path.normpath(path)
    local_uploads = os.path.normpath(LOCAL_UPLOADS)
    if normalised == local_uploads or normalised.startswith(local_uploads + "/"):
        return os.path.join(ENGINE_UPLOADS, os.path.relpath(normalised, local_uploads))
    return normalised


class ContainerClient:
    """Engine-container file and job access.

    Filesystem operations run directly against the shared volumes. Operations on
    the image-internal config tree, and anything that must execute a tool, are
    dispatched to the engine Celery workers by task name.
    """

    def __init__(self, container_name: str, client=None):
        # container_name is retained for logging/compatibility only — nothing
        # resolves a Docker container any more. `client` is accepted and ignored
        # so existing callers keep working.
        self.container_name = container_name
        self._celery = None

    # ── Job dispatch ────────────────────────────────────────────────────────
    def _send(self, task_name: str, args=None, timeout: int = 60):
        """Dispatch a named engine task and wait for its result.

        allow_join_result() is required because most callers run *inside* a
        Celery task (decompile_apk_task, run_scan_task, ...), and Celery raises
        ``RuntimeError: Never call result.get() within a task!`` otherwise. That
        guard exists to stop a worker deadlocking on a task its own pool must
        execute — impossible here, since engine.* tasks run in a different
        container with its own pool. Without this, the RuntimeError surfaced as
        a caught exception and the calling task "succeeded" in milliseconds
        while the engine work continued in the background.
        """
        from celery.result import allow_join_result

        if self._celery is None:
            from project.celery_worker import celery as celery_app
            self._celery = celery_app
        async_result = self._celery.send_task(task_name, args=args or [])
        with allow_join_result():
            return async_result.get(timeout=timeout)

    # ── Filesystem ──────────────────────────────────────────────────────────
    def mkdir(self, path: str) -> bool:
        """Create path (with parents); True on success."""
        if not is_local_path(path):
            # Engine-local dirs are created implicitly by write_file / the tools.
            return True
        try:
            os.makedirs(to_local(path), exist_ok=True)
            return True
        except OSError as e:
            logger.error("mkdir failed for %s: %s", path, e)
            return False

    def file_exists(self, path: str) -> bool:
        """True if the path exists and is a regular file."""
        if is_local_path(path):
            return os.path.isfile(to_local(path))
        try:
            result = self._send(ENGINE_EXISTS_TASK, [path])
            return bool(result.get("is_file"))
        except Exception as e:
            logger.error("path_exists dispatch failed for %s: %s", path, e)
            return False

    def read_file(self, path: str) -> str:
        """Return the file's text; raises FileNotFoundError if unreadable."""
        if is_local_path(path):
            try:
                return Path(to_local(path)).read_text(errors="replace")
            except OSError as e:
                raise FileNotFoundError(path) from e
        result = self._send(ENGINE_READ_TASK, [path])
        if result.get("status") != "ok":
            raise FileNotFoundError(f"{path}: {result.get('reason')}")
        return result["content"]

    def write_file(self, path: str, content: str) -> None:
        """Write text to a file (overwrites). Raises OSError on failure."""
        if is_local_path(path):
            local = to_local(path)
            parent = os.path.dirname(local)
            if parent:
                os.makedirs(parent, exist_ok=True)
            Path(local).write_text(content)
            return
        result = self._send(ENGINE_WRITE_TASK, [path, content])
        if result.get("status") != "ok":
            raise OSError(f"Failed to write {path}: {result}")

    def batch_file_exists(self, paths: list[str]) -> dict[str, bool]:
        """Check many paths; returns {path: exists}.

        Formerly a generated shell script executed in the container to dodge
        argv length limits. Local paths are now plain stat calls; engine-local
        paths go in one batched dispatch rather than one per file.
        """
        if not paths:
            return {}
        out = {}
        remote = []
        for path in paths:
            if is_local_path(path):
                out[path] = os.path.isfile(to_local(path))
            else:
                remote.append(path)
        if remote:
            try:
                result = self._send(ENGINE_BATCH_EXISTS_TASK, [remote], timeout=120)
                out.update(result.get("results", {}))
            except Exception as e:
                logger.error("batch_path_exists dispatch failed: %s", e)
                out.update({p: False for p in remote})
        return out

    def list_dir(self, path: str) -> list[str]:
        """Entry names in a directory; empty list if it isn't one."""
        if is_local_path(path):
            try:
                return sorted(os.listdir(to_local(path)))
            except OSError:
                return []
        try:
            result = self._send(ENGINE_LIST_TASK, [path])
            if result.get("status") != "ok":
                return []
            return [e["name"] for e in result.get("entries", [])]
        except Exception as e:
            logger.error("list_dir dispatch failed for %s: %s", path, e)
            return []

    def is_dir(self, path: str) -> bool:
        if is_local_path(path):
            return os.path.isdir(to_local(path))
        try:
            return bool(self._send(ENGINE_EXISTS_TASK, [path]).get("is_dir"))
        except Exception:
            return False

    def remove(self, path: str, recursive: bool = False) -> bool:
        """Delete a file, or a tree when recursive. True on success."""
        if not is_local_path(path):
            try:
                result = self._send(ENGINE_REMOVE_TASK, [path, recursive], timeout=300)
                return result.get("status") == "ok"
            except Exception as e:
                logger.error("remove_path dispatch failed for %s: %s", path, e)
                return False
        local = to_local(path)
        try:
            if os.path.isdir(local):
                if not recursive:
                    return False
                shutil.rmtree(local, ignore_errors=True)
            elif os.path.exists(local):
                os.remove(local)
            return True
        except OSError as e:
            logger.error("remove failed for %s: %s", path, e)
            return False

    def find_sources(self, root: str, stems: list[str], limit: int = 20) -> list[str]:
        """Find <stem>.java / <stem>.kt under root. Decompiled output is
        engine-local, so this always dispatches."""
        try:
            result = self._send("engine.find_sources", [root, stems, limit], timeout=300)
            return result.get("matches", []) if result.get("status") == "ok" else []
        except Exception as e:
            logger.error("find_sources dispatch failed under %s: %s", root, e)
            return []

    def pkill(self, pattern: str) -> int:
        """Kill matching processes in the engine container. Returns count killed."""
        try:
            result = self._send("engine.kill_appshark", [])
            return int(result.get("killed", 0))
        except Exception as e:
            logger.error("pkill dispatch failed for %r: %s", pattern, e)
            return 0
