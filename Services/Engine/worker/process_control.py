"""Per-scan process ownership and cancellation (Linux engine only)."""

from contextlib import contextmanager
import json
import os
import signal
from uuid import UUID

PROCESS_ROOT = "/tmp/engine-processes"


def run_key(scan_guid):
    return UUID(str(scan_guid)).hex


@contextmanager
def locked_run(scan_guid):
    import fcntl
    key = run_key(scan_guid)
    os.makedirs(PROCESS_ROOT, mode=0o700, exist_ok=True)
    with open(os.path.join(PROCESS_ROOT, key + ".lock"), "a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        yield os.path.join(PROCESS_ROOT, key)


def process_identity(pid):
    """Kernel start time prevents a stale record from targeting a reused PID."""
    try:
        with open(f"/proc/{int(pid)}/stat", encoding="ascii") as fh:
            fields = fh.read().rsplit(")", 1)[1].split()
        return fields[19]
    except (OSError, ValueError, IndexError):
        return None


def register_process(prefix, proc):
    identity = process_identity(proc.pid)
    if not identity:
        raise RuntimeError("Cannot establish scan process identity")
    record = {"pid": proc.pid, "start_time": identity}
    with open(prefix + ".json", "w", encoding="utf-8") as fh:
        json.dump(record, fh)
    return record


def kill_owned_process(proc):
    if proc is not None and proc.poll() is None:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        proc.wait()


def cancel_scan(scan_guid):
    """Remember cancellation even when the scan has not launched its JVM yet."""
    with locked_run(scan_guid) as prefix:
        with open(prefix + ".cancelled", "w", encoding="ascii"):
            pass
        try:
            with open(prefix + ".json", encoding="utf-8") as fh:
                record = json.load(fh)
        except FileNotFoundError:
            return 0
        pid = record["pid"]
        if (not isinstance(pid, int) or pid <= 1
                or process_identity(pid) != record.get("start_time")):
            return 0
        try:
            if os.getpgid(pid) != pid:
                return 0
            os.killpg(pid, signal.SIGKILL)
        except ProcessLookupError:
            return 0
        return 1


def unregister_process(scan_guid, expected_record):
    """Remove only this invocation's registration, never a replacement's."""
    with locked_run(scan_guid) as prefix:
        try:
            with open(prefix + ".json", encoding="utf-8") as fh:
                current = json.load(fh)
            if current != expected_record:
                return False
            os.remove(prefix + ".json")
            return True
        except (FileNotFoundError, ValueError):
            return False
