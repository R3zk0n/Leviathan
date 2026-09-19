"""Named engine operations, executed inside the engine container.

Every task here is *named and parameterised*. There is deliberately no generic
"run this command" task: the Redis broker is currently unauthenticated, so a
generic exec task would re-create the remote-code-execution hole this refactor
exists to close. Adding one later would undo that — add a specific task instead.

All subprocess calls use argv lists with ``shell=False``. Nothing is
interpolated into a shell string.
"""

import json
import logging
import os
import re
import shutil
import subprocess
import tempfile
from uuid import uuid4

from worker import process_control

from celery.exceptions import SoftTimeLimitExceeded

from worker.celery_app import celery, SCAN_TIME_LIMIT, SCAN_SOFT_TIME_LIMIT, \
    TOOL_TIME_LIMIT, TOOL_SOFT_TIME_LIMIT

logger = logging.getLogger(__name__)

APPSHARK_HOME = "/appshark_engine/appshark"
SCANS_ROOT = os.path.join(APPSHARK_HOME, "Scans")
UPLOADS_ROOT = os.path.join(APPSHARK_HOME, "uploads")
CONFIG_ROOT = os.path.join(APPSHARK_HOME, "config")
RUN_CONFIG_ROOT = "/tmp/engine-runs"

# Decompiler output. Like config/, this is NOT a shared volume — it exists only
# inside this container, so the backend cannot read it directly and every access
# has to come through these tasks.
DECOMPILED_ROOT = "/tmp/decompiled"

# Engine settings written by the backend (EngineService.settings_file). Also
# container-local, so it survives only until the container is recreated.
SETTINGS_ROOT = "/tmp/config"

APPSHARK_JAR = os.path.join(APPSHARK_HOME, "build/libs/AppShark-0.1.2-all.jar")

# Reads/writes dispatched from the broker are confined to these roots. Without
# this, anyone able to publish to Redis could read or overwrite arbitrary paths
# in the engine container.
READABLE_ROOTS = (SCANS_ROOT, UPLOADS_ROOT, CONFIG_ROOT, DECOMPILED_ROOT, SETTINGS_ROOT)
WRITABLE_ROOTS = (CONFIG_ROOT, RUN_CONFIG_ROOT, SCANS_ROOT, DECOMPILED_ROOT, SETTINGS_ROOT)

# Tail size for stdout returned to the caller. Full logs live on the scans
# volume; the broker must not carry multi-MB payloads.
OUTPUT_TAIL_CHARS = 8000

TRUFFLEHOG_ALLOWED_ARGS = frozenset({
    "--only-verified",
    "--no-verification",
    "--include-detectors",
    "--concurrency=1",
})


_OOM_SIGNATURES = (
    "OutOfMemoryError",
    "Terminating due to java.lang.OutOfMemoryError",
    "GC overhead limit exceeded",
    "unable to create new native thread",
    "Java heap space",
)


def _looks_like_oom(text: str) -> bool:
    """True if the JVM output shows it died of memory pressure. -XX:+ExitOnOut
    OfMemoryError prints 'Terminating due to java.lang.OutOfMemoryError' right
    before exit, so the signature lands in the captured output tail. The backend
    uses this to retry the scan once at a larger heap ceiling."""
    t = text or ""
    return any(sig in t for sig in _OOM_SIGNATURES)


def _confine(path: str, roots) -> str:
    """Resolve path and assert it sits inside one of roots. Raises ValueError."""
    resolved = os.path.realpath(path)
    for root in roots:
        root = os.path.realpath(root)
        if resolved == root or resolved.startswith(root + os.sep):
            return resolved
    raise ValueError(f"path outside permitted roots: {path}")


def _run(argv, timeout=None, cwd=APPSHARK_HOME):
    """Run argv with no shell. Returns (exit_code, combined output tail)."""
    proc = subprocess.run(
        argv,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=timeout,
        text=True,
        errors="replace",
    )
    return proc.returncode, (proc.stdout or "")[-OUTPUT_TAIL_CHARS:]


class ScanCancelled(Exception):
    pass


def _run_scan_process(argv, run_id, timeout):
    """Launch one owned process group; cancellation never searches by name."""
    proc = None
    registration = None
    try:
        with tempfile.TemporaryFile() as output:
            with process_control.locked_run(run_id) as prefix:
                if os.path.exists(prefix + ".cancelled"):
                    raise ScanCancelled()
                if os.path.exists(prefix + ".json"):
                    with open(prefix + ".json", encoding="utf-8") as fh:
                        previous = json.load(fh)
                    if process_control.process_identity(previous["pid"]) == previous["start_time"]:
                        raise RuntimeError("This scan already has an active process")
                proc = subprocess.Popen(
                    argv, cwd=APPSHARK_HOME, stdout=output,
                    stderr=subprocess.STDOUT, start_new_session=True,
                )
                registration = process_control.register_process(prefix, proc)
            proc.wait(timeout=timeout)
            output.seek(max(0, output.tell() - OUTPUT_TAIL_CHARS))
            tail = output.read().decode("utf-8", errors="replace")
            return proc.returncode, tail
    finally:
        process_control.kill_owned_process(proc)
        if registration is not None:
            process_control.unregister_process(run_id, registration)


def _resolve_scan_root(settings: dict) -> str:
    out = (settings or {}).get("out") or "Scans"
    if os.path.isabs(out):
        return out
    return os.path.join(APPSHARK_HOME, out.strip("/"))


def _scan_status(scan_root: str, app_identifier: str):
    """Read the engine's own scan_status.json, if it wrote one."""
    path = os.path.join(scan_root, app_identifier, "scan_status.json")
    try:
        with open(path) as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return None


@celery.task(
    name="engine.run_appshark",
    bind=True,
    time_limit=SCAN_TIME_LIMIT,
    soft_time_limit=SCAN_SOFT_TIME_LIMIT,
)
def run_appshark(self, settings, scan_guid=None):
    """Run one AppShark scan. Returns a small status dict, never the findings.

    The caller reads results.json off the shared scans volume; putting a
    multi-MB payload through the result backend would bloat Redis.
    """
    settings = dict(settings or {})
    scan_root = _confine(_resolve_scan_root(settings), (SCANS_ROOT,))
    apk_path = settings.get("apkPath", "")
    app_identifier = os.path.splitext(os.path.basename(apk_path))[0]

    # Idempotency guard. task_acks_late means a worker crash re-delivers this
    # task; without the check a redelivery silently re-runs hours of analysis.
    existing = _scan_status(scan_root, app_identifier)
    if existing and existing.get("guid") and existing.get("guid") == scan_guid:
        state = (existing.get("status") or "").upper()
        if state in ("OK", "PARTIAL", "OOM", "FATAL"):
            logger.info("scan %s already terminal (%s); skipping re-run", scan_guid, state)
            return {
                "status": "already_complete",
                "engine_status": state,
                "scan_root": scan_root,
                "app_identifier": app_identifier,
                "results_path": os.path.join(scan_root, app_identifier, "results.json"),
                "exit_code": 0,
            }

    os.makedirs(scan_root, exist_ok=True)
    os.makedirs(RUN_CONFIG_ROOT, exist_ok=True)

    # Key the config by scan id. The previous fixed /tmp/config/scan_settings.json
    # was clobbered by any second scan, so correctness depended on strict
    # serialisation of the whole pipeline.
    run_id = scan_guid or self.request.id
    process_control.run_key(run_id)
    config_file = _confine(
        os.path.join(RUN_CONFIG_ROOT, f"scan_settings.{run_id}.json"), WRITABLE_ROOTS
    )

    settings["out"] = scan_root
    with open(config_file, "w") as fh:
        json.dump(settings, fh)

    # Per-scan heap: the backend sizes the -Xmx ceiling to the APK and passes it
    # in settings so several small scans share the host under a memory budget
    # while a large one runs alone. Env vars are the fallback for untagged runs.
    # Validate strictly (these go into an argv list, so no shell injection, but a
    # malformed value would crash the JVM).
    def _heap(value, fallback):
        value = value if isinstance(value, str) else None
        return value if value and re.fullmatch(r"\d+[mMgG]", value.strip()) else fallback

    xms = _heap(settings.get("javaXms"), os.environ.get("JAVA_XMS", "1g"))
    xmx = _heap(settings.get("javaXmx"), os.environ.get("JAVA_XMX", "12g"))
    argv = [
        "java",
        f"-Xms{xms}",
        f"-Xmx{xmx}",
        "-XX:+UseG1GC",
        "-XX:+ExitOnOutOfMemoryError",
        "-jar",
        APPSHARK_JAR,
        config_file,
    ]

    try:
        exit_code, output = _run_scan_process(argv, run_id, SCAN_TIME_LIMIT)
    except ScanCancelled:
        return {"status": "error", "reason": "cancelled", "exit_code": -1,
                "scan_root": scan_root, "app_identifier": app_identifier}
    except SoftTimeLimitExceeded:
        logger.error("scan %s exceeded soft time limit; killing AppShark", run_id)
        return {
            "status": "error",
            "reason": "soft_time_limit_exceeded",
            "scan_root": scan_root,
            "app_identifier": app_identifier,
            "exit_code": -1,
        }
    except subprocess.TimeoutExpired:
        return {
            "status": "error",
            "reason": "timeout",
            "scan_root": scan_root,
            "app_identifier": app_identifier,
            "exit_code": -1,
        }
    finally:
        try:
            os.remove(config_file)
        except OSError:
            pass

    # AppShark writes results either per-app or directly under the scan root.
    candidates = [
        os.path.join(scan_root, app_identifier, "results.json"),
        os.path.join(scan_root, "results.json"),
    ]
    results_path = next((c for c in candidates if os.path.isfile(c)), None)

    status_doc = _scan_status(scan_root, app_identifier)
    engine_status = (status_doc or {}).get("status")

    # A non-zero exit is a failure even if a stale results.json is lying around
    # from a previous run. The old code treated a truthy tuple as success and
    # ingested whatever it found.
    if exit_code != 0:
        oom = _looks_like_oom(output)
        if oom:
            logger.warning(
                "scan %s exited non-zero with OOM signature at -Xmx%s; "
                "backend may retry at a larger heap", run_id, xmx
            )
        return {
            "status": "error",
            "reason": "oom" if oom else "nonzero_exit",
            "oom": oom,
            "xmx": xmx,
            "exit_code": exit_code,
            "engine_status": engine_status,
            "scan_root": scan_root,
            "app_identifier": app_identifier,
            "results_path": results_path,
            "partial_results_path": os.path.join(
                scan_root, app_identifier, "results_partial.json"
            ),
            "output": output,
        }

    if not results_path:
        return {
            "status": "error",
            "reason": "results_not_found",
            "exit_code": exit_code,
            "engine_status": engine_status,
            "scan_root": scan_root,
            "app_identifier": app_identifier,
            "searched": candidates,
            "output": output,
        }

    return {
        "status": "ok",
        "exit_code": exit_code,
        "engine_status": engine_status,
        "scan_root": scan_root,
        "app_identifier": app_identifier,
        "results_path": results_path,
        "output": output,
    }


@celery.task(
    name="engine.decompile",
    time_limit=TOOL_TIME_LIMIT,
    soft_time_limit=TOOL_SOFT_TIME_LIMIT,
)
def decompile(file_name, engine=None, force=False, resources=False):
    """Decompile an APK with jadx or vineflower.

    The whole pipeline runs here rather than the backend building shell strings
    and shipping them over docker exec. Cache-reuse is decided engine-side too,
    since only this container can see /tmp/decompiled.

    Returns the marker dict on success so the caller doesn't need a second
    round-trip to read it.
    """
    from worker import decompilers as d

    resolved = (engine or d.DEFAULT_DECOMPILER).strip().lower()
    if resolved not in d.DECOMPILERS:
        return {"status": "error", "reason": "unknown_engine", "engine": engine}

    want_resources = bool(resources)
    backend = d.get_decompiler(resolved, file_name)
    # Validate both paths and the input before any recursive removal.
    output_dir = d.strict_child(DECOMPILED_ROOT, file_name)
    input_hash = d.file_sha256(backend.input_path)

    # Cache reuse: same engine, same resources flag, not forced, sources present.
    if not force:
        marker = d.read_marker(file_name)
        if (marker
                and marker.get("engine") == resolved
                and bool(marker.get("resources")) == want_resources
                and marker.get("input_sha256") == input_hash
                and backend._sources_nonempty()):
            logger.info("reusing existing %s decompilation for %s", resolved, file_name)
            return {
                "status": "ok",
                "reused": True,
                "engine": resolved,
                "output_dir": backend.output_dir,
                "sources_dir": backend.sources_dir,
                "marker": marker,
            }

    # Force (or engine switch) means the old tree must go first, or the two
    # engines' output would be interleaved in one sources/ dir.
    if os.path.isdir(output_dir):
        shutil.rmtree(output_dir)

    ok, output = backend.run(resources=want_resources, timeout=TOOL_TIME_LIMIT)
    if not ok:
        return {
            "status": "error",
            "reason": "decompile_failed",
            "engine": resolved,
            "output": output[-4000:],
        }

    version = _decompiler_version(resolved)
    if d.file_sha256(backend.input_path) != input_hash:
        return {"status": "error", "reason": "input_changed", "engine": resolved}
    d.write_marker(file_name, resolved, version=version, resources=want_resources,
                   input_sha256=input_hash)

    return {
        "status": "ok",
        "reused": False,
        "engine": resolved,
        "version": version,
        "output_dir": backend.output_dir,
        "sources_dir": backend.sources_dir,
        "marker": d.read_marker(file_name),
        "output": output[-4000:],
    }


def _decompiler_version(engine):
    """Best-effort version string for the marker. Never raises."""
    argv = {
        "jadx": ["/opt/jadx/bin/jadx", "--version"],
        "vineflower": ["java", "-jar", "/opt/vineflower/vineflower.jar", "--version"],
    }.get(engine)
    if not argv:
        return ""
    try:
        rc, out = _run(argv, timeout=30)
        return out.strip().splitlines()[0] if out.strip() else ""
    except (OSError, subprocess.TimeoutExpired):
        return ""


@celery.task(name="engine.class_index", time_limit=600)
def class_index(file_name):
    """Build the FQCN -> source-file index for a decompiled app.

    Best-effort: returns an empty row list on failure, because indexing must
    never fail an otherwise-successful decompile.
    """
    from worker import class_index as ci

    root = _confine(os.path.join(DECOMPILED_ROOT, file_name), READABLE_ROOTS)
    if not os.path.isdir(root):
        return {"status": "error", "reason": "not_decompiled", "rows": []}
    try:
        rows = ci.build_rows(root)
    except Exception as e:
        logger.warning("class-index build failed for %s: %s", file_name, e)
        return {"status": "error", "reason": "parse_failed", "rows": []}
    return {"status": "ok", "rows": rows, "count": len(rows)}


@celery.task(
    name="engine.kill_appshark",
    time_limit=60,
)
def kill_appshark(scan_guid):
    """Cancel only the process group registered to this scan GUID."""
    return {"status": "ok", "killed": process_control.cancel_scan(scan_guid)}


@celery.task(
    name="engine.trufflehog",
    time_limit=TOOL_TIME_LIMIT,
    soft_time_limit=TOOL_SOFT_TIME_LIMIT,
)
def trufflehog(target_path, extra_args=None):
    """Run trufflehog filesystem scan against a path on the shared volumes.

    extra_args is restricted to a fixed allowlist rather than validated
    heuristically — the broker is untrusted, and argument injection into a tool
    that can read arbitrary files is worth closing off explicitly.
    """
    target = _confine(target_path, READABLE_ROOTS)
    argv = ["trufflehog"]
    detectors = os.path.join(APPSHARK_HOME, "detectors.yaml")
    if os.path.isfile(detectors):
        argv += ["--config", detectors]
    argv += ["filesystem", target, "--json", "--no-update"]
    for arg in (extra_args or []):
        if arg not in TRUFFLEHOG_ALLOWED_ARGS:
            raise ValueError(f"rejected trufflehog arg: {arg!r}")
        argv.append(arg)
    # Findings are data, never diagnostic tails. Keep them off Redis and retain
    # every complete record on the shared scans volume.
    result_dir = _confine(os.path.join(SCANS_ROOT, ".secret-results"), (SCANS_ROOT,))
    os.makedirs(result_dir, mode=0o700, exist_ok=True)
    result_path = _confine(os.path.join(result_dir, uuid4().hex + ".jsonl"), (result_dir,))
    proc = None
    complete = False
    try:
        with open(result_path, "xb") as findings, tempfile.TemporaryFile() as diagnostics:
            os.chmod(result_path, 0o600)
            proc = subprocess.Popen(
                argv, cwd=APPSHARK_HOME, stdout=findings, stderr=diagnostics,
                start_new_session=True,
            )
            exit_code = proc.wait(timeout=TOOL_TIME_LIMIT)
        if exit_code != 0:
            return {"status": "error", "reason": "nonzero_exit", "exit_code": exit_code}
        count = 0
        with open(result_path, encoding="utf-8") as findings:
            for line in findings:
                if not line.strip():
                    continue
                record = json.loads(line)
                if not isinstance(record, dict):
                    raise ValueError("Invalid finding record")
                if "SourceMetadata" in record:
                    count += 1
                elif "level" not in record:
                    raise ValueError("Unexpected finding record")
        complete = True
        return {"status": "ok", "exit_code": 0, "complete": True,
                "findings_path": result_path, "finding_count": count}
    except (subprocess.TimeoutExpired, SoftTimeLimitExceeded):
        return {"status": "error", "reason": "timeout", "complete": False}
    except (ValueError, UnicodeError):
        return {"status": "error", "reason": "invalid_findings", "complete": False}
    finally:
        process_control.kill_owned_process(proc)
        if not complete:
            try:
                os.remove(result_path)
            except FileNotFoundError:
                pass


# ── Engine-local filesystem access ──────────────────────────────────────────
# For paths the backend cannot see: config/ (baked into the image) and
# /tmp/decompiled (container-local scratch). Scans/ and uploads/ are shared
# volumes and the backend reads those directly — it should not call these.

@celery.task(name="engine.read_file", time_limit=120)
def read_file(path):
    """Read a text file from an engine-local path."""
    resolved = _confine(path, READABLE_ROOTS)
    try:
        with open(resolved, "r", errors="replace") as fh:
            return {"status": "ok", "path": resolved, "content": fh.read()}
    except IsADirectoryError:
        return {"status": "error", "reason": "is_a_directory", "path": resolved}
    except OSError as e:
        return {"status": "error", "reason": "unreadable", "path": resolved, "detail": str(e)}


@celery.task(name="engine.write_file", time_limit=120)
def write_file(path, content, scope=None):
    """Write a text file to an engine-local path.

    NOTE: config/ is baked into the image (COPY in the Dockerfile), not a
    volume, so writes there land in the container's writable layer and are lost
    on rebuild. Pre-existing behaviour; fixing it needs a config volume.
    """
    roots = (os.path.join(CONFIG_ROOT, "rules"),) if scope == "rules" else WRITABLE_ROOTS
    resolved = _confine(path, roots)
    if scope == "rules" and resolved == os.path.realpath(roots[0]):
        raise ValueError("A rule file is required")
    os.makedirs(os.path.dirname(resolved), exist_ok=True)
    with open(resolved, "w") as fh:
        fh.write(content)
    return {"status": "ok", "path": resolved, "bytes": len(content)}


@celery.task(name="engine.path_exists", time_limit=60)
def path_exists(path):
    """Existence + type for an engine-local path."""
    resolved = _confine(path, READABLE_ROOTS)
    return {
        "status": "ok",
        "path": resolved,
        "exists": os.path.exists(resolved),
        "is_dir": os.path.isdir(resolved),
        "is_file": os.path.isfile(resolved),
    }


@celery.task(name="engine.batch_path_exists", time_limit=120)
def batch_path_exists(paths):
    """Existence for many engine-local paths in one round-trip.

    Replaces the generated shell script the old code wrote into the container
    to dodge argv length limits.
    """
    out = {}
    for path in paths or []:
        try:
            out[path] = os.path.isfile(_confine(path, READABLE_ROOTS))
        except ValueError:
            out[path] = False
    return {"status": "ok", "results": out}


@celery.task(name="engine.list_dir", time_limit=120)
def list_dir(base_path=None):
    """List entries in an engine-local directory."""
    root = _confine(base_path or os.path.join(CONFIG_ROOT, "rules"), READABLE_ROOTS)
    if not os.path.isdir(root):
        return {"status": "error", "reason": "not_a_directory", "path": root}
    entries = []
    for name in sorted(os.listdir(root)):
        full = os.path.join(root, name)
        entries.append({
            "name": name,
            "path": full,
            "is_dir": os.path.isdir(full),
            "size": os.path.getsize(full) if os.path.isfile(full) else None,
        })
    return {"status": "ok", "path": root, "entries": entries}


@celery.task(name="engine.remove_path", time_limit=300)
def remove_path(path, recursive=False):
    """Delete an engine-local file, or a tree when recursive."""
    resolved = _confine(path, WRITABLE_ROOTS)
    if os.path.isdir(resolved):
        if not recursive:
            return {"status": "error", "reason": "is_a_directory", "path": resolved}
        shutil.rmtree(resolved, ignore_errors=True)
    elif os.path.exists(resolved):
        os.remove(resolved)
    return {"status": "ok", "path": resolved}


@celery.task(name="engine.find_sources", time_limit=300)
def find_sources(root, stems, limit=20):
    """Find <stem>.java / <stem>.kt under root.

    Replaces a `find ... -o -name ... | head` shell pipeline. JADX emits .java
    and Vineflower emits .kt for the same Kotlin class, so both extensions are
    always searched.
    """
    resolved = _confine(root, READABLE_ROOTS)
    wanted = set()
    for stem in (stems or []):
        wanted.add(f"{stem}.java")
        wanted.add(f"{stem}.kt")

    matches = []
    for dirpath, _dirnames, filenames in os.walk(resolved):
        for name in filenames:
            if name in wanted:
                matches.append(os.path.join(dirpath, name))
                if len(matches) >= limit:
                    return {"status": "ok", "matches": matches, "truncated": True}
    return {"status": "ok", "matches": matches, "truncated": False}


@celery.task(name="engine.tool_versions", time_limit=120)
def tool_versions():
    """Report installed tool versions — used by the backend health/status view."""
    out = {}
    for key, argv in (
        ("jadx", ["/opt/jadx/bin/jadx", "--version"]),
        ("dex2jar", ["sh", "/opt/dex2jar/d2j-dex2jar.sh", "--version"]),
        ("vineflower", ["java", "-jar", "/opt/vineflower/vineflower.jar", "--version"]),
        ("trufflehog", ["trufflehog", "--version"]),
        ("java", ["java", "-version"]),
    ):
        try:
            rc, text = _run(argv, timeout=30)
            out[key] = {"exit_code": rc, "output": text.strip()}
        except (OSError, subprocess.TimeoutExpired) as e:
            out[key] = {"exit_code": -1, "output": str(e)}
    return {"status": "ok", "tools": out}
