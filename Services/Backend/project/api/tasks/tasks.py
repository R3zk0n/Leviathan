from celery import chain
from project.celery_manager import celery
from project.api.engine.services import EngineService
from project.api.database.services import is_component_accessible
from project.api.database.models import (
    AndroidInfo, AppsharkScan, AppsharkSecurityIssue, AppsharkVulnerability,
    AndroidActivity, AndroidService, AndroidReceiver, AndroidProvider, ScanTask
)
from datetime import datetime, timedelta
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func, text
from project import db
from project.celery_manager import get_flask_app
import os
import re
import zipfile
import logging
from rich.console import Console

console = Console()
logger = logging.getLogger(__name__)

# Queue tuning knobs (override via environment if needed).
SHORT_SCAN_SCORE_THRESHOLD = int(os.getenv('SCAN_SHORT_SCORE_THRESHOLD', '45'))
LONG_SCAN_EVERY = max(1, int(os.getenv('SCAN_LONG_EVERY', '4')))
LONG_SCAN_MAX_WAIT_MINUTES = int(os.getenv('SCAN_LONG_MAX_WAIT_MINUTES', '240'))

# --- Memory-budget scan admission -------------------------------------------
# The engine spawns one JVM per scan with a -Xmx ceiling sized to the APK (see
# _heap_spec_for_apk). We admit as many WAITING scans as keep the SUM of
# in-flight ceilings under SCAN_MEMORY_BUDGET_GB, capped at SCAN_MAX_PARALLEL
# concurrent JVMs. Consequences, both by construction:
#   * a large app (ceiling == budget) still runs ALONE — unchanged behaviour,
#     no OOM regression for the exact case that caused OOM before;
#   * several small apps (which never needed the big ceiling) run together.
# Host OOM is structurally impossible: sum(ceilings) <= budget, and each
# ceiling is a hard JVM cap (-XX:+ExitOnOutOfMemoryError) so a scan that blows
# its own ceiling dies cleanly instead of eating host RAM.
#
# Budget math (host ~23GB Docker, ~6GB for the other containers, ~1.5GB JVM
# off-heap overhead beyond -Xmx per process): worst case is 2x small (6+6=12g)
# or 1x large (14g); 14 + 2*1.5 overhead + 6 others ~= 21-22GB < 23GB. Raise
# SCAN_MAX_PARALLEL to 3 only after watching real memory headroom.
SCAN_MEMORY_BUDGET_GB = int(os.getenv('SCAN_MEMORY_BUDGET_GB', '14'))
SCAN_MAX_PARALLEL = max(1, int(os.getenv('SCAN_MAX_PARALLEL', '2')))
# Heap tier is chosen by uncompressed DEX bytes (code), NOT APK size: a 16MB
# APK can be 88% code or 0% code, and analysis memory tracks code, not assets.
# (SettingsIntelligence — 19MB APK — OOM'd at a file-size-derived 6g ceiling.)
# Small-code apps get a small ceiling so two share the budget; everything
# bigger, or whose dex can't be read, gets the full budget and runs solo. A
# scan that STILL OOMs at its ceiling is retried once at the max — see
# _escalate_heap / run_scan_task. So no upfront misprediction loses an app.
SCAN_HEAP_SMALL_MAX_DEX_MB = int(os.getenv('SCAN_HEAP_SMALL_MAX_DEX_MB', '6'))
SCAN_HEAP_SMALL_XMX_GB = int(os.getenv('SCAN_HEAP_SMALL_XMX_GB', '6'))
SCAN_HEAP_LARGE_XMX_GB = int(os.getenv('SCAN_HEAP_LARGE_XMX_GB', str(SCAN_MEMORY_BUDGET_GB)))
# Committed heap per JVM. Low so a small scan actually stays small instead of
# reserving the whole ceiling up front (the old -Xms6g was why scans couldn't
# share the host). Growth to -Xmx is on demand via G1GC.
SCAN_HEAP_XMS = os.getenv('SCAN_HEAP_XMS', '1g')
# Serialises admission across concurrent callers (two completions + an enqueue)
# so they can't each read the same free budget and double-admit past it.
_DISPATCH_ADVISORY_LOCK_KEY = 0x1EA75CA0  # "leviathan scan" dispatch lock


def _extract_rule_count(settings):
    rules = (settings or {}).get('rules')
    if not rules:
        return 0

    if isinstance(rules, list):
        return len([rule for rule in rules if rule])

    if isinstance(rules, str):
        return len([rule.strip() for rule in rules.split(',') if rule.strip()])

    return 0


def _prewarm_component_counts(waiting_scans, complexity_cache):
    """Fill complexity_cache with total component counts for every waiting scan's
    android_info in a fixed number of grouped queries.

    Replaces the per-app 4×COUNT(*) the estimator would otherwise fire: with N
    waiting scans (each polled ordering pass re-derives all N), that was an
    O(N^2) burst of single-row counts left as `idle in transaction` and was the
    dashboard/scan-status slowdown. Here it's 4 grouped queries total, once.
    """
    ids = {t.android_info_id for t in waiting_scans if getattr(t, 'android_info_id', None)}
    if not ids:
        return
    # Seed every id to 0 so the estimator finds a cache hit even for apps with no
    # rows in a given table and never falls back to the per-app count path.
    for aid in ids:
        complexity_cache.setdefault(aid, 0)
    for model in (AndroidActivity, AndroidService, AndroidReceiver, AndroidProvider):
        rows = (
            db.session.query(model.android_info_id, func.count(model.id))
            .filter(model.android_info_id.in_(ids))
            .group_by(model.android_info_id)
            .all()
        )
        for aid, cnt in rows:
            complexity_cache[aid] = complexity_cache.get(aid, 0) + (cnt or 0)


def _estimate_scan_complexity(scan_task, complexity_cache=None):
    """Estimate scan complexity from existing metadata to bias queue ordering toward short scans."""
    settings = scan_task.settings or {}
    score = 0

    # Rule set size is usually the biggest runtime driver.
    score += _extract_rule_count(settings) * 5

    if settings.get('wholeProcessMode'):
        score += 20
    if settings.get('callBackEnhance'):
        score += 8
    if settings.get('supportFragment'):
        score += 6

    def _to_int(value, default=0):
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    max_thread = _to_int(settings.get('maxThread'))
    if max_thread > 2:
        score += 4

    rule_max_analyzer = _to_int(settings.get('ruleMaxAnalyzer'))
    if rule_max_analyzer > 5000:
        score += 8

    max_path_length = _to_int(settings.get('maxPathLength'))
    if max_path_length > 50:
        score += 8

    android_info_id = scan_task.android_info_id
    if android_info_id and complexity_cache is not None and android_info_id in complexity_cache:
        component_count = complexity_cache[android_info_id]
    else:
        component_count = 0
        if android_info_id:
            activity_count = db.session.query(func.count(AndroidActivity.id)).filter(
                AndroidActivity.android_info_id == android_info_id
            ).scalar() or 0
            service_count = db.session.query(func.count(AndroidService.id)).filter(
                AndroidService.android_info_id == android_info_id
            ).scalar() or 0
            receiver_count = db.session.query(func.count(AndroidReceiver.id)).filter(
                AndroidReceiver.android_info_id == android_info_id
            ).scalar() or 0
            provider_count = db.session.query(func.count(AndroidProvider.id)).filter(
                AndroidProvider.android_info_id == android_info_id
            ).scalar() or 0
            component_count = activity_count + service_count + receiver_count + provider_count

        if complexity_cache is not None and android_info_id:
            complexity_cache[android_info_id] = component_count

    # Component-heavy apps tend to have bigger analysis graphs.
    score += component_count // 8

    try:
        uploads_root = os.path.abspath(
            os.path.join(os.path.dirname(__file__), '..', '..', '..', 'uploads')
        )
        apk_path = os.path.join(uploads_root, scan_task.filename)
        if os.path.exists(apk_path):
            apk_size_mb = os.path.getsize(apk_path) / (1024 * 1024)
            score += int(apk_size_mb // 8)
    except Exception:
        # Missing files should not break scheduling.
        pass

    return score


def _completed_dispatch_count():
    return ScanTask.query.filter(ScanTask.status.in_(['FINISHED', 'ERROR'])).count()


def _uploads_root():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'uploads'))


def _parse_gb(spec):
    """'8g'->8, '512m'->1 (rounded up), None/garbage->None."""
    if not spec or not isinstance(spec, str):
        return None
    m = re.fullmatch(r'\s*(\d+)\s*([mMgG])\s*', spec)
    if not m:
        return None
    val, unit = int(m.group(1)), m.group(2).lower()
    if unit == 'g':
        return val
    return max(1, -(-val // 1024))  # MB -> GB, ceil


def _apk_dex_mb(path):
    """Uncompressed bytes of all classes*.dex in the APK, in MB, or None if it
    can't be read. This is the code size that drives AppShark's analysis memory
    — assets/resources in the APK don't. Reading the zip central directory is
    cheap (no extraction)."""
    try:
        with zipfile.ZipFile(path) as z:
            dex = sum(i.file_size for i in z.infolist()
                      if i.filename.endswith('.dex'))
        return dex / (1024 * 1024)
    except Exception:
        return None


def _heap_spec_for_apk(filename):
    """(xms, xmx) JVM heap flags sized to the APK's DEX (code) size.

    Small-code apps get a small -Xmx so two share the memory budget; a big app,
    or one whose dex can't be read, gets the full budget and runs alone (fail
    safe: treat as heavy). If the ceiling still proves too small the scan is
    retried once at the max (run_scan_task), so this only needs to be a good
    first guess, not perfect.
    """
    xmx_gb = SCAN_HEAP_LARGE_XMX_GB
    try:
        path = os.path.join(_uploads_root(), filename)
        if os.path.isfile(path):
            dex_mb = _apk_dex_mb(path)
            if dex_mb is not None and dex_mb <= SCAN_HEAP_SMALL_MAX_DEX_MB:
                xmx_gb = SCAN_HEAP_SMALL_XMX_GB
            else:
                xmx_gb = SCAN_HEAP_LARGE_XMX_GB
    except Exception:
        pass
    return SCAN_HEAP_XMS, f"{xmx_gb}g"


# Public alias for the enqueue paths (run.py) to tag a scan's settings.
def heap_spec_for_apk(filename):
    return _heap_spec_for_apk(filename)


def _escalate_heap(settings):
    """Return a copy of settings with the JVM heap ceiling raised to the max
    tier, tagged so we never escalate the same scan twice. Returns None if the
    scan is already at/above the max ceiling (nothing left to try)."""
    settings = dict(settings or {})
    current = _parse_gb(settings.get('javaXmx')) or 0
    if settings.get('heapEscalated') or current >= SCAN_HEAP_LARGE_XMX_GB:
        return None
    settings['javaXmx'] = f"{SCAN_HEAP_LARGE_XMX_GB}g"
    settings['heapEscalated'] = True
    return settings


def _task_heap_gb(task):
    """Per-scan -Xmx ceiling in GB. Reads the tag the enqueue path wrote into
    settings; legacy tasks with no tag are sized from their APK now (fallback:
    the whole budget, so an untagged scan runs solo rather than over-committing)."""
    xmx = (getattr(task, 'settings', None) or {}).get('javaXmx')
    gb = _parse_gb(xmx)
    if gb:
        return min(gb, SCAN_MEMORY_BUDGET_GB)
    _, sized = _heap_spec_for_apk(getattr(task, 'filename', '') or '')
    return min(_parse_gb(sized) or SCAN_MEMORY_BUDGET_GB, SCAN_MEMORY_BUDGET_GB)


def _pick_next_waiting_scan(waiting_scans, dispatch_count, now=None, complexity_cache=None):
    if not waiting_scans:
        return None

    now = now or datetime.utcnow()
    if complexity_cache is None:
        # Single-call sites (start_next_queued_scan) get a one-shot prewarm.
        # get_waiting_scan_position passes a shared cache so its ordering loop
        # doesn't re-count the same apps on every iteration.
        complexity_cache = {}
        _prewarm_component_counts(waiting_scans, complexity_cache)
    evaluated = []

    for task in waiting_scans:
        score = _estimate_scan_complexity(task, complexity_cache=complexity_cache)
        wait_minutes = max(0, int((now - task.created_at).total_seconds() // 60)) if task.created_at else 0
        evaluated.append({
            'task': task,
            'score': score,
            'wait_minutes': wait_minutes,
            'is_short': score <= SHORT_SCAN_SCORE_THRESHOLD,
        })

    long_candidates = [item for item in evaluated if not item['is_short']]
    short_candidates = [item for item in evaluated if item['is_short']]

    starved_long = [item for item in long_candidates if item['wait_minutes'] >= LONG_SCAN_MAX_WAIT_MINUTES]
    if starved_long:
        return sorted(starved_long, key=lambda item: item['task'].created_at or now)[0]['task']

    should_force_long = bool(long_candidates) and ((dispatch_count + 1) % LONG_SCAN_EVERY == 0)
    if short_candidates and not should_force_long:
        return sorted(short_candidates, key=lambda item: item['task'].created_at or now)[0]['task']

    if long_candidates:
        return sorted(long_candidates, key=lambda item: item['task'].created_at or now)[0]['task']

    return sorted(evaluated, key=lambda item: item['task'].created_at or now)[0]['task']


def _order_waiting_scans(waiting_scans):
    """Order WAITING scans by the fair scheduler policy (short-first with
    long-scan anti-starvation). One shared, prewarmed complexity cache across
    the whole ordering pass — no per-iteration re-counting."""
    if not waiting_scans:
        return []

    dispatch_count = _completed_dispatch_count()
    complexity_cache = {}
    _prewarm_component_counts(waiting_scans, complexity_cache)
    ordered = []
    remaining = list(waiting_scans)

    while remaining:
        picked = _pick_next_waiting_scan(remaining, dispatch_count, complexity_cache=complexity_cache)
        if not picked:
            break
        ordered.append(picked)
        remaining = [task for task in remaining if task.id != picked.id]
        dispatch_count += 1

    return ordered


def get_waiting_scan_position(scan_guid):
    """Return 1-based position for a waiting scan using the same fair scheduler policy."""
    waiting_scans = ScanTask.query.filter(ScanTask.status == 'WAITING').order_by(ScanTask.created_at.asc()).all()
    if not waiting_scans:
        return None

    ordered_ids = [task.id for task in _order_waiting_scans(waiting_scans)]

    target_task = ScanTask.query.filter_by(guid=scan_guid).first()
    if not target_task or target_task.id not in ordered_ids:
        return None

    return ordered_ids.index(target_task.id) + 1


def _recover_stale_scans(all_processing=False):
    """
    Recover PROCESSING scans left over from a crashed/restarted worker.

    all_processing=True  → treat every PROCESSING scan as stale (used on worker startup)
    all_processing=False → only treat scans stale for >10 min (used in periodic watchdog)

    Strategy per scan:
      1. Try to parse an existing results.json from the engine container.
         If found → save to DB, mark FINISHED.
      2. If no results yet → reset to WAITING so Celery will re-run it.
    """
    stale_cutoff = datetime.utcnow() - timedelta(minutes=10)

    query = ScanTask.query.filter(ScanTask.status == 'PROCESSING')
    if not all_processing:
        query = query.filter(
            (ScanTask.scan_started_at == None) | (ScanTask.scan_started_at < stale_cutoff)
        )

    stale_scans = query.all()
    if not stale_scans:
        return

    logger.info(f"[watchdog] {len(stale_scans)} stale PROCESSING scan(s) found, attempting recovery")

    try:
        engine_service = EngineService()
    except Exception as e:
        logger.warning(f"[watchdog] Engine unavailable ({e}), will reset scans to WAITING")
        engine_service = None

    # Liveness guard: collect the Celery task ids currently executing on a live
    # worker. A scan whose task is still active is NOT stale, however long it has
    # been PROCESSING (scans legitimately run for hours). Without this a healthy
    # long scan gets reset mid-run and, under parallel admission, re-dispatched
    # into a SECOND JVM for the same APK — exactly the double-memory OOM we're
    # trying to prevent. Only genuinely orphaned rows (crashed/restarted worker,
    # task no longer active) are recovered.
    active_task_ids = set()
    try:
        active = celery.control.inspect(timeout=2).active() or {}
        for worker_tasks in active.values():
            for entry in worker_tasks:
                tid = entry.get('id')
                if tid:
                    active_task_ids.add(tid)
    except Exception as e:
        logger.warning(f"[watchdog] could not inspect active tasks ({e}); recovering by staleness only")

    needs_queue = False
    for scan_task in stale_scans:
        try:
            if scan_task.celery_task_id and scan_task.celery_task_id in active_task_ids:
                logger.info(f"[watchdog] {scan_task.guid} still executing on a worker; not stale, skipping")
                continue
            recovered = False
            if engine_service:
                settings = scan_task.settings or {}
                apk_path = settings.get('apkPath', scan_task.filename)
                app_identifier = os.path.splitext(os.path.basename(apk_path))[0]
                try:
                    parsed = engine_service.parse_scan_results(app_identifier)
                    if parsed:
                        logger.info(f"[watchdog] results.json found for {scan_task.guid}, saving")
                        save_scan_results(scan_task.filename, parsed, scan_task.guid)
                        scan_task.status = 'FINISHED'
                        scan_task.scan_completed_at = datetime.utcnow()
                        db.session.commit()
                        logger.info(f"[watchdog] Scan {scan_task.guid} recovered → FINISHED")
                        recovered = True
                except Exception as e:
                    logger.warning(f"[watchdog] parse_scan_results failed for {scan_task.guid}: {e}")

            if not recovered:
                logger.info(f"[watchdog] No results for {scan_task.guid}, resetting → WAITING")
                scan_task.status = 'WAITING'
                scan_task.scan_started_at = None
                scan_task.celery_task_id = None
                db.session.commit()
                needs_queue = True
        except Exception as e:
            logger.error(f"[watchdog] Error recovering scan {scan_task.guid}: {e}")

    if needs_queue:
        start_next_queued_scan()


@celery.task(bind=True)
def scan_watchdog_task(self):
    """Periodic task (every 5 min) that rescues scans stuck in PROCESSING."""
    app = get_flask_app()
    with app.app_context():
        _recover_stale_scans(all_processing=False)



@celery.task(bind=True)
def decompile_apk_task(self, file_name, engine=None, force=False, resources=False):
    app = get_flask_app()
    with app.app_context():
        engine_service = EngineService()
        try:
            output = engine_service.decompile_apk(
                file_name, engine=engine, force=force, resources=resources
            )
            return {
                "status": "success",
                "message": f"{file_name} was decompiled successfully",
                "output": output
            }
        except Exception as e:
            logger.error(f"Error decompiling {file_name}: {str(e)}", exc_info=True)
            return {
                "status": "error",
                "message": f"Error decompiling {file_name}: {str(e)}"
            }

@celery.task(bind=True)
def perform_secret_scan(self, decompile_result, filename):
    """
    Task to perform the actual secret scanning after decompilation
    """
    try:
        # Validate decompile_result structure
        if not isinstance(decompile_result, dict) or decompile_result.get('status') != 'success':
            logger.error(f"Invalid or unsuccessful decompilation result: {decompile_result}")
            return {
                "status": "error",
                "message": decompile_result.get('message', 'Decompilation failed or returned an invalid result')
            }

        app = get_flask_app()
        with app.app_context():
            engine_service = EngineService()
            logger.info(f"Starting secret scan for {filename}")

            # Check if the decompiled path exists
            decompiled_path = f"/tmp/decompiled/{filename}"
            if not engine_service.containers.file_exists(decompiled_path):
                error_msg = f"Decompiled directory not found in engine container: {decompiled_path}"
                logger.error(error_msg)
                return {
                    "status": "error",
                    "message": error_msg
                }

            # Perform the secret scan
            scan_result = engine_service.scan_secrets(filename)
            logger.info(f"Secret scan completed with status: {scan_result.get('status')}")

            if scan_result.get('status') == 'success':
                findings = scan_result.get('findings', [])
                logger.info(f"Processing {len(findings)} findings from secret scan")

                # Prepare findings for the frontend - keep same structure but standardize field names
                processed_findings = [
                    {
                        'type': finding.get('type'),
                        'description': finding.get('description'),
                        'redacted_value': finding.get('value'),  # Redacted for display
                        'raw_value': finding.get('raw_value'),
                        'file': finding.get('file'),
                        'line': finding.get('line'),
                        'source_name': finding.get('source_name'),
                        'source_type': finding.get('detector_type'),  # Map detector_type to source_type
                        'detector_type': finding.get('detector_type'),
                        'detector_name': finding.get('detector_name'),
                        'decoder_name': finding.get('decoder_name'),
                        'verified': finding.get('verified', False),
                        'verification_error': finding.get('verification_error'),
                        'verification_cached': finding.get('verification_cached', False)
                    }
                    for finding in findings
                ]

                # Return the structure exactly as expected by ReconDialog.vue
                return {
                    "status": "success",
                    "result": {
                        "findings": processed_findings
                    }
                }

            # Handle scan errors
            return {
                "status": "error",
                "message": scan_result.get('message', 'Unknown error during scan')
            }

    except Exception as e:
        logger.error(f"Error in perform_secret_scan: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "message": str(e)
        }


@celery.task(bind=True)
def scan_secrets_task(self, filename):
    """
    Direct implementation for scanning secrets without using chains
    """
    try:
        app = get_flask_app()
        with app.app_context():
            engine_service = EngineService()
            logger.info(f"Starting scan_secrets_task for {filename}")

            # Check if app is already decompiled
            decompiled_path = f"/tmp/decompiled/{filename}"
            # Decompile if needed
            if not engine_service.containers.file_exists(decompiled_path):
                logger.info(f"{filename} not decompiled, performing decompilation first...")
                try:
                    decompiled_path = engine_service.decompile_apk(filename)
                    logger.info(f"Decompilation completed: {decompiled_path}")
                except Exception as decompile_error:
                    logger.error(f"Decompilation failed: {str(decompile_error)}")
                    return {
                        "status": "error",
                        "message": f"Decompilation failed: {str(decompile_error)}"
                    }
            else:
                logger.info(f"{filename} already decompiled, proceeding to scan")

            # Perform the secret scan directly
            logger.info(f"Starting secret scan for {filename}")
            scan_result = engine_service.scan_secrets(filename)
            logger.info(f"Scan completed with status: {scan_result.get('status')}")

            # Format the result exactly as expected by frontend
            if scan_result.get('status') == 'success':
                findings = scan_result.get('findings', [])
                logger.info(f"Found {len(findings)} secrets in {filename}")

                # Return the findings directly - no need to process them further
                # The frontend will handle the formatting
                return {
                    "status": "success",
                    "result": {
                        "findings": findings
                    }
                }
            else:
                # Return error with same structure
                return {
                    "status": "error",
                    "message": scan_result.get('message', 'Unknown error during scan')
                }

    except Exception as e:
        logger.error(f"Error in scan_secrets_task: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "message": str(e)
        }

def start_next_queued_scan():
    """Admit as many WAITING scans as the per-scan memory budget allows.

    Formerly "start one scan iff none is PROCESSING". Now each scan carries a
    -Xmx ceiling sized to its APK and we admit WAITING scans (short-first)
    while sum(in-flight ceilings) stays under SCAN_MEMORY_BUDGET_GB and the JVM
    count stays under SCAN_MAX_PARALLEL. A large app (ceiling == budget) runs
    alone; small apps run together. Kept under the same name so every existing
    caller (enqueue, status poll, watchdog, scan-completion) drives it.

    Serialised across callers by a Postgres advisory xact lock so two
    completions/enqueues can't both read the same free budget and admit past
    it. Returns the list of newly dispatched scan guids.
    """
    selected = []
    try:
        # Serialise admission; auto-released on the commit/rollback below.
        db.session.execute(
            text('SELECT pg_advisory_xact_lock(:k)'),
            {'k': _DISPATCH_ADVISORY_LOCK_KEY},
        )

        processing = ScanTask.query.filter(ScanTask.status == 'PROCESSING').all()
        used_gb = sum(_task_heap_gb(t) for t in processing)
        slots_free = SCAN_MAX_PARALLEL - len(processing)
        remaining_gb = SCAN_MEMORY_BUDGET_GB - used_gb

        if slots_free > 0 and remaining_gb > 0:
            waiting_scans = ScanTask.query.filter(
                ScanTask.status == 'WAITING'
            ).order_by(ScanTask.created_at.asc()).all()

            for task in _order_waiting_scans(waiting_scans):
                if slots_free <= 0 or remaining_gb <= 0:
                    break
                heap = _task_heap_gb(task)
                if heap > remaining_gb:
                    # Too big for the free budget right now; a smaller WAITING
                    # scan further down may still fit, so keep scanning.
                    continue
                # Lock-and-verify just before admission to avoid double-start.
                locked = ScanTask.query.filter(
                    ScanTask.id == task.id,
                    ScanTask.status == 'WAITING'
                ).with_for_update(skip_locked=True).first()
                if not locked:
                    continue
                locked.status = 'PROCESSING'
                locked.scan_started_at = datetime.utcnow()
                selected.append(locked)
                remaining_gb -= heap
                slots_free -= 1

        # Durably mark the admitted scans PROCESSING and release the lock. Doing
        # this before .delay() means used_gb already reflects them for any other
        # dispatcher; a crash here leaves them PROCESSING-but-undispatched, which
        # the stale-scan watchdog recovers.
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Scan admission failed: {e}")
        return []

    dispatched = []
    for task in selected:
        try:
            celery_task = run_scan_task.delay(task.filename, task.settings, task.guid)
            task.celery_task_id = str(celery_task.id)
            db.session.commit()
            dispatched.append(task.guid)
            logger.info(
                f"Admitted scan {task.guid} ({task.filename}) "
                f"heap={_task_heap_gb(task)}g celery={celery_task.id}"
            )
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to dispatch admitted scan {task.guid}: {e}")

    if not dispatched:
        logger.info("Queue dispatch: nothing admitted (budget full or no waiting scans)")
    return dispatched


@celery.task(bind=True)
def run_scan_task(self, filename, settings, scan_guid=None):
    """Scan task implementation with database tracking"""
    app = get_flask_app()
    with app.app_context():
        engine_service = EngineService()

        # Helper to update ScanTask status
        def update_scan_task(status, error_message=None):
            if scan_guid:
                try:
                    scan_task = ScanTask.query.filter_by(guid=scan_guid).first()
                    if scan_task:
                        scan_task.status = status
                        if error_message:
                            scan_task.error_message = error_message
                        if status in ['FINISHED', 'ERROR']:
                            scan_task.scan_completed_at = datetime.utcnow()
                        db.session.commit()
                        logger.info(f"Updated ScanTask {scan_guid} to {status}")

                        # When a scan finishes or errors, start the next queued scan
                        if status in ['FINISHED', 'ERROR']:
                            start_next_queued_scan()
                except Exception as e:
                    logger.error(f"Failed to update ScanTask {scan_guid}: {e}")

        try:
            scan_result = engine_service.run_scan(settings)

            if scan_result['status'] != 'success':
                # OOM at the current ceiling -> re-queue once at the max heap
                # (runs solo) instead of losing the scan. Analysis blow-ups
                # aren't predictable from static code size, so this retry is the
                # real guarantee that a too-small ceiling never costs an app.
                if scan_result.get('oom') and scan_guid:
                    escalated = _escalate_heap(settings)
                    if escalated is not None:
                        st = ScanTask.query.filter_by(guid=scan_guid).first()
                        if st:
                            old = (settings or {}).get('javaXmx', '?')
                            st.settings = escalated
                            st.status = 'WAITING'
                            st.scan_started_at = None
                            st.celery_task_id = None
                            st.error_message = (
                                f"OOM at {old}; re-queued at {escalated['javaXmx']} (solo)"
                            )
                            db.session.commit()
                            logger.warning(
                                f"Scan {scan_guid} ({filename}) OOM at {old}; "
                                f"re-queued at {escalated['javaXmx']} solo"
                            )
                            start_next_queued_scan()
                            return {
                                "status": "retried",
                                "result": {"message": f"OOM at {old}; retrying at {escalated['javaXmx']}"},
                            }

                error_msg = f"Scan failed: {scan_result['message']}"
                logger.error(f"Scan failed for {filename}: {scan_result['message']}")
                update_scan_task('ERROR', error_msg)
                return {
                    "status": "error",
                    "result": {
                        "message": error_msg
                    }
                }

            results_file = scan_result['results_file']

            # IMPORTANT: parse_scan_results() expects the app identifier (scan folder name), not a file path.
            # Prefer the identifier computed by run_scan(); fall back to filename without extension.
            app_identifier = scan_result.get('app_identifier')
            if not app_identifier:
                app_identifier = os.path.splitext(os.path.basename(filename))[0]

            parsed_results = engine_service.parse_scan_results(app_identifier)

            if parsed_results is None:
                error_msg = f"Failed to parse scan results for {filename}"
                logger.error(error_msg)
                update_scan_task('ERROR', error_msg)
                return {
                    "status": "error",
                    "result": {
                        "message": error_msg,
                        "results_file": results_file,
                        "app_identifier": app_identifier,
                    }
                }

            save_scan_results(filename, parsed_results, scan_guid)

            # Mark scan as finished
            update_scan_task('FINISHED')

            return {
                "status": "success",
                "result": {
                    "message": "Scan completed successfully and results saved to database",
                    "output_dir": settings['out'],
                    "results_file": results_file
                }
            }
        except Exception as e:
            error_msg = f"Failed to run scan or save results: {str(e)}"
            logger.exception(f"Error in run_scan_task: {str(e)}")
            update_scan_task('ERROR', error_msg)
            return {
                "status": "error",
                "result": {
                    "message": error_msg
                }
            }


# Marker for a decoded Appshark synthetic entry-point stub. extract_class_from_entry_method
# tags the mangled component FQN with this prefix so lookup_component_info knows to resolve
# it against the manifest by re-mangling component names (robust to '_' inside class names)
# rather than treating it as a literal class.
_ENTRY_STUB_SENTINEL = 'MAIN_ENTRY::'


def extract_class_from_entry_method(entry_method):
    """
    Extract the class name from an Appshark entry_method string.

    Example inputs:
    - "<com.android.settings.ActivityPicker$PickAdapter$Item: android.content.Intent getIntent(...)>"
    - "com.example.MainActivity$1"
    - "<CustomClass: void Main_Entry_com_example_FooService()>"  (synthetic entry stub)

    Returns the outer class name (strips inner class $ notation). For Appshark's
    synthetic "Main_Entry_<mangled-FQN>" stubs — which name the *exported component*
    Appshark used as the taint entry point, with '.' mangled to '_' — returns the
    mangled FQN tagged with _ENTRY_STUB_SENTINEL so the component lookup can resolve
    the real exported component instead of the useless "CustomClass".
    """
    if not entry_method:
        return None

    # Appshark synthetic entry stub: the exported component FQN is dot->underscore
    # mangled after the "Main_Entry_" marker. Decode before the generic parsing,
    # because that would otherwise yield "CustomClass".
    stub = re.search(r'Main_Entry_([A-Za-z0-9_]+?)\s*\(', entry_method)
    if stub:
        return _ENTRY_STUB_SENTINEL + stub.group(1)

    # Remove leading < if present
    class_str = entry_method.lstrip('<')

    # Extract the class part (before the colon or space)
    if ':' in class_str:
        class_str = class_str.split(':')[0]
    elif ' ' in class_str:
        class_str = class_str.split(' ')[0]

    # Strip inner class notation (everything after first $)
    if '$' in class_str:
        class_str = class_str.split('$')[0]

    return class_str.strip() if class_str else None


def _resolve_entry_stub_component(android_info, mangled_fqn):
    """Resolve an Appshark Main_Entry stub's dot->underscore mangled FQN to the
    manifest component's *stored* name. Matches by re-mangling each component's
    fully-qualified name the same way ('.'->'_'), so it is unambiguous even when a
    class name legitimately contains underscores. Returns the stored component name
    (as it appears in the DB, possibly '.Relative') or None."""
    if not android_info or not mangled_fqn:
        return None
    package_name = android_info.package_name or ''

    def stored_names(comp_list, attr):
        for comp in comp_list:
            yield getattr(comp, attr)

    candidates = list(stored_names(android_info.activities, 'activity_name'))
    candidates += list(stored_names(android_info.services, 'service_name'))
    candidates += list(stored_names(android_info.receivers, 'receiver_name'))
    candidates += list(stored_names(android_info.providers, 'provider_name'))

    for stored in candidates:
        if not stored:
            continue
        fqn = (package_name + stored) if stored.startswith('.') else stored
        if fqn.replace('.', '_') == mangled_fqn:
            return stored
    return None


def _effective_exported(raw, has_intent_filters):
    """Android effective-export: an explicit android:exported (True/False) wins;
    when the attribute is absent (raw is None) a component with an intent-filter is
    implicitly exported (pre-targetSdk-31 behaviour). Keeps the 'Exported' chip
    truthful for implicitly-exported components instead of showing False."""
    if raw is not None:
        return raw
    return bool(has_intent_filters)


# Well-known framework permissions that only signature/system apps can hold.
# A third-party attacker cannot acquire these, so a component guarded by one is
# not part of the 3rd-party attack surface. Extend as needed (kept small on purpose).
_KNOWN_PRIVILEGED_PERMISSIONS = frozenset({
    'android.permission.INTERACT_ACROSS_USERS',
    'android.permission.INTERACT_ACROSS_USERS_FULL',
    'android.permission.MANAGE_USERS',
    'android.permission.WRITE_SECURE_SETTINGS',
    'android.permission.MODIFY_PHONE_STATE',
    'android.permission.BIND_DEVICE_ADMIN',
})


def _permission_levels(android_info):
    """Parse {permission_name: protectionLevel_raw} from the app's own manifest, memoized
    on the android_info instance. protectionLevel may be a hex string (e.g. "0x00000003")
    or a named form (e.g. "signature|privileged")."""
    cached = getattr(android_info, '_perm_levels_cache', None)
    if cached is not None:
        return cached
    levels = {}
    xml = getattr(android_info, 'manifest_xml', None) or ''
    for tag in re.findall(r'<permission\b[^>]*>', xml):
        name_m = re.search(r'android:name="([^"]+)"', tag)
        if not name_m:
            continue
        lvl_m = re.search(r'android:protectionLevel="([^"]+)"', tag)
        levels[name_m.group(1)] = lvl_m.group(1) if lvl_m else 'normal'
    try:
        android_info._perm_levels_cache = levels
    except Exception:
        pass
    return levels


def _protection_is_privileged(raw):
    """True when a protectionLevel means only signature/system/privileged apps can hold
    the permission (NOT third-party holdable). normal/dangerous -> False (any app can
    hold or request them). Handles both hex and named encodings."""
    if not raw:
        return False
    val = str(raw).strip().lower()
    if val.startswith('0x') or val.isdigit():
        try:
            num = int(val, 16) if val.startswith('0x') else int(val)
        except ValueError:
            return False
        base = num & 0x0f
        if base >= 2:  # signature(2) / signatureOrSystem(3) / internal(4)
            return True
        # privileged(0x10) / oem(0x40000) / vendorPrivileged(0x80000) flags on normal|dangerous
        return bool(num & 0x10 or num & 0x40000 or num & 0x80000)
    # Named form: any signature/system/privileged/internal token means not 3rd-party holdable.
    return any(tok in val for tok in ('signature', 'system', 'privileged', 'internal'))


def _permission_protects(perm_name, levels):
    """Whether a component guarded by `perm_name` is shielded from third-party apps."""
    if not perm_name:
        return False
    if perm_name in _KNOWN_PRIVILEGED_PERMISSIONS:
        return True
    return _protection_is_privileged(levels.get(perm_name))


def _accessible_with_permission(exported, has_intent_filters, perm_name, levels):
    """Third-party reachable = exported/implicitly-exported AND not gated by a
    signature/system-level permission. Data-flow-agnostic; pure manifest classification."""
    return is_component_accessible(exported, has_intent_filters) and not _permission_protects(perm_name, levels)


# --- Exported-reachability (SliceMode attribution recovery) -----------------
# A SliceMode finding's `position` is the source/sink LCA method, which is often an
# internal/obfuscated helper (e.g. InstallAgentCommonHelper.unzip, PickerActivity's
# d.o.w1) rather than the exported component that anchors the flow. Appshark's reverse
# call-graph (which would prove reachability) isn't emitted per-finding, so we
# approximate it here from the decompiled source: BFS over class references from every
# accessible exported component. This is a *review signal* (`exported_reachable`), NOT a
# hard exported claim — class-level refs over-approximate, so we keep it distinct from
# `component_exported` and record which component reached it (`exported_via`).

_FQN_TOKEN = re.compile(r'\b([a-z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+){2,})\b')
_REACHABILITY_MAX_DEPTH = int(os.getenv('REACHABILITY_MAX_DEPTH', '2'))

# Framework / standard-library / ubiquitous-SDK package prefixes. A referenced FQN
# that is NOT under one of these is treated as app/bundled code and kept in the
# reachability graph. Defining "app code" by exclusion (rather than by the app's own
# package root) keeps reachability app- AND OEM-independent: it captures multi-root
# vendor code (e.g. com.sec.* + com.samsung.*), obfuscated packages, and bundled libs
# without any per-app assumption.
_FRAMEWORK_PREFIXES = (
    'android.', 'androidx.', 'java.', 'javax.', 'kotlin.', 'kotlinx.', 'dalvik.',
    'sun.', 'org.w3c.', 'org.xml.', 'org.xmlpull.', 'org.json.', 'org.apache.http.',
    'junit.', 'org.junit.',
)


def _scan_java_dir(app_name):
    """Decompiled-source dir for a scan, derived from the APK filename. The backend
    mounts the engine Scans volume at /appshark_engine/appshark/Scans."""
    folder = app_name[:-4] if app_name.endswith('.apk') else app_name
    path = f"/appshark_engine/appshark/Scans/{folder}/java"
    return path if os.path.isdir(path) else None


def _fqn_from_java_path(path):
    p = path.replace('\\', '/')
    m = re.search(r'/java/(?:app/src/main/java/)?(.+)\.java$', p)
    return m.group(1).replace('/', '.') if m else None


def _accessible_exported_class_map(android_info):
    """{component FQN: component FQN} for components that are third-party accessible
    (exported/implicit AND not signature/system permission-gated). BFS seeds."""
    seeds = {}
    for comp_list, name_attr in (
        (android_info.activities, 'activity_name'),
        (android_info.services, 'service_name'),
        (android_info.receivers, 'receiver_name'),
        (android_info.providers, 'provider_name'),
    ):
        for comp in comp_list:
            stored = getattr(comp, name_attr)
            if not stored:
                continue
            info = lookup_component_info(android_info, stored)
            if info and info.get('component_accessible'):
                fqn = (android_info.package_name + stored) if stored.startswith('.') else stored
                seeds[fqn] = fqn
    return seeds


def build_exported_reachable_map(android_info, scan_java_dir, max_depth=_REACHABILITY_MAX_DEPTH):
    """Return {class_fqn: reaching_exported_component_fqn} for classes reachable within
    `max_depth` class-reference hops from any accessible exported component. Best-effort:
    returns {} on any failure so ingestion never breaks."""
    try:
        seeds = _accessible_exported_class_map(android_info)
        if not seeds or not scan_java_dir:
            return {}
        adj = {}
        for root, _dirs, files in os.walk(scan_java_dir):
            for fn in files:
                if not fn.endswith('.java'):
                    continue
                path = os.path.join(root, fn)
                cls = _fqn_from_java_path(path)
                if not cls:
                    continue
                try:
                    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                        src = f.read()
                except Exception:
                    continue
                # App/bundled code only: exclude framework & stdlib references. No
                # per-app package assumption -> works across OEMs and obfuscation.
                adj[cls] = set(
                    t for t in _FQN_TOKEN.findall(src)
                    if t != cls and not t.startswith(_FRAMEWORK_PREFIXES)
                )
        # BFS union, tracking the reaching seed
        reach = {}
        frontier = []
        for s in seeds:
            reach[s] = (0, s)
            frontier.append(s)
        idx = 0
        while idx < len(frontier):
            c = frontier[idx]; idx += 1
            depth, via = reach[c]
            if depth >= max_depth:
                continue
            for nxt in adj.get(c, ()):  # class-level references
                if nxt not in reach:
                    reach[nxt] = (depth + 1, via)
                    frontier.append(nxt)
        return {cls: via for cls, (d, via) in reach.items()}
    except Exception as e:
        logger.warning(f"reachability map build failed: {e}")
        return {}


def _reachable_via(position_class, reach_map):
    """If a finding's class (or an outer class of it) is reachable from an exported
    component, return that component FQN; else None."""
    if not position_class or not reach_map:
        return None
    probe = position_class
    while probe:
        if probe in reach_map:
            return reach_map[probe]
        if '$' in probe:
            probe = probe.rsplit('$', 1)[0]
        else:
            break
    return None


def _resolve_component_from_sig(android_info, sig):
    """From an Appshark method signature, return (class_name, component_info).

    component_info is the manifest-component dict when the extracted class is a
    DECLARED component (decoding Main_Entry stubs first), else None. class_name is
    the extracted class (or None). Name resolution happens at call time, so this
    may sit above lookup_component_info in the file."""
    cls = extract_class_from_entry_method(sig)
    if cls and cls.startswith(_ENTRY_STUB_SENTINEL):
        cls = _resolve_entry_stub_component(android_info, cls[len(_ENTRY_STUB_SENTINEL):])
    if not cls:
        return None, None
    return cls, lookup_component_info(android_info, cls)


def lookup_component_info(android_info, class_name):
    """
    Look up a component (activity, service, receiver, provider) by class name.
    Returns dict with component_type, component_exported, component_accessible, component_has_intent_filters.
    """
    if not android_info or not class_name:
        return None

    package_name = android_info.package_name

    # Calculate relative name (e.g., ".MainActivity" from "com.example.MainActivity")
    relative_name = None
    if class_name.startswith(package_name):
        relative_name = class_name[len(package_name):]

    def _name_matches(stored):
        """Match a manifest-declared component name against the fully-qualified
        class_name from the Appshark finding. Android allows the manifest
        android:name to be written three ways, and our parser stores it verbatim:
          - fully-qualified   "com.pkg.Foo"
          - '.'-relative      ".Foo"           -> pkg + name
          - bare relative     "Foo"            -> pkg + "." + name   (e.g. AOSP PartnerBookmarksProvider)
        The old logic only handled the first two, so bare names fell through to
        'not in manifest' -> mislabeled exported=False/PROTECTED (false negative)."""
        if not stored:
            return False
        if stored == class_name or stored == relative_name:
            return True
        if stored.startswith('.'):
            return package_name + stored == class_name
        if '.' not in stored:  # bare relative name (no leading dot, no package)
            return package_name + '.' + stored == class_name
        return False  # already fully-qualified but not equal to class_name

    # Check activities
    for activity in android_info.activities:
        if _name_matches(activity.activity_name):
            has_intent_filters = len(activity.intent_filters) > 0
            return {
                'component_type': 'activity',
                'component_exported': _effective_exported(activity.activity_exported, has_intent_filters),
                'component_accessible': _accessible_with_permission(activity.activity_exported, has_intent_filters, activity.activity_permission, _permission_levels(android_info)),
                'component_has_intent_filters': has_intent_filters
            }
        # Also check if DB has relative and we're looking for full
        if activity.activity_name.startswith('.') and package_name + activity.activity_name == class_name:
            has_intent_filters = len(activity.intent_filters) > 0
            return {
                'component_type': 'activity',
                'component_exported': _effective_exported(activity.activity_exported, has_intent_filters),
                'component_accessible': _accessible_with_permission(activity.activity_exported, has_intent_filters, activity.activity_permission, _permission_levels(android_info)),
                'component_has_intent_filters': has_intent_filters
            }

    # Check services
    for service in android_info.services:
        if _name_matches(service.service_name):
            has_intent_filters = (len(service.actions) > 0 or len(service.categories) > 0 or len(service.schemes) > 0)
            return {
                'component_type': 'service',
                'component_exported': _effective_exported(service.service_exported, has_intent_filters),
                'component_accessible': _accessible_with_permission(service.service_exported, has_intent_filters, service.service_permission, _permission_levels(android_info)),
                'component_has_intent_filters': has_intent_filters
            }
        if service.service_name.startswith('.') and package_name + service.service_name == class_name:
            has_intent_filters = (len(service.actions) > 0 or len(service.categories) > 0 or len(service.schemes) > 0)
            return {
                'component_type': 'service',
                'component_exported': _effective_exported(service.service_exported, has_intent_filters),
                'component_accessible': _accessible_with_permission(service.service_exported, has_intent_filters, service.service_permission, _permission_levels(android_info)),
                'component_has_intent_filters': has_intent_filters
            }

    # Check receivers
    for receiver in android_info.receivers:
        if _name_matches(receiver.receiver_name):
            has_intent_filters = (len(receiver.actions) > 0 or len(receiver.categories) > 0)
            return {
                'component_type': 'receiver',
                'component_exported': _effective_exported(receiver.receiver_exported, has_intent_filters),
                'component_accessible': _accessible_with_permission(receiver.receiver_exported, has_intent_filters, receiver.receiver_permission, _permission_levels(android_info)),
                'component_has_intent_filters': has_intent_filters
            }
        if receiver.receiver_name.startswith('.') and package_name + receiver.receiver_name == class_name:
            has_intent_filters = (len(receiver.actions) > 0 or len(receiver.categories) > 0)
            return {
                'component_type': 'receiver',
                'component_exported': _effective_exported(receiver.receiver_exported, has_intent_filters),
                'component_accessible': _accessible_with_permission(receiver.receiver_exported, has_intent_filters, receiver.receiver_permission, _permission_levels(android_info)),
                'component_has_intent_filters': has_intent_filters
            }

    # Check providers
    for provider in android_info.providers:
        if _name_matches(provider.provider_name):
            # Providers are only *practically* accessible to 3rd-party apps if exported AND not gated by permissions.
            # If any permission is declared at the provider level (permission/readPermission/writePermission),
            # we treat it as PROTECTED for external attack-surface filtering.
            permission_gated = bool(
                provider.provider_permission or provider.read_permission or provider.write_permission
            )
            return {
                'component_type': 'provider',
                'component_exported': provider.provider_exported,
                'component_accessible': bool(provider.provider_exported) and not permission_gated,
                'component_has_intent_filters': False
            }
        if provider.provider_name.startswith('.') and package_name + provider.provider_name == class_name:
            permission_gated = bool(
                provider.provider_permission or provider.read_permission or provider.write_permission
            )
            return {
                'component_type': 'provider',
                'component_exported': provider.provider_exported,
                'component_accessible': bool(provider.provider_exported) and not permission_gated,
                'component_has_intent_filters': False
            }

    return None


# --- Appshark finding dedup -------------------------------------------------
# Appshark emits one "vulner" per register-alias of the SAME logical data flow.
# A single source->sink flow gets reported once for every SSA temporary Soot
# assigns ($r3, $r4, $r2_3, ...), so one reportable bug can surface dozens of
# times (e.g. Samsung ThemeManager: 86 PackageManager_Destructive vulners that
# are really ~9 distinct method/sink flows). This noise — not false positives —
# is what buries the leverageable bugs.
#
# We collapse duplicates at ingestion on a *normalized* key that is register- and
# temporary-agnostic but preserves genuinely distinct flows. Everything here is
# generic Soot-string handling — nothing is tied to any specific app or rule.

# Soot local temporaries: $r3, $i0, $z1, r5, $r2_3, $u4_12, etc.
_SOOT_LOCAL_RE = re.compile(r'\$?[a-z]\d+(?:_\d+)*')
# A Soot method/field signature: <fully.qualified.Class: ret method(params)>
_SIGNATURE_RE = re.compile(r'<[^>]+>')


def _normalize_flow_endpoint(value):
    """Reduce a Soot Sink/Source string (or list of them) to a stable identity
    that ignores register/temporary names but keeps method signatures and string
    literals. Register-alias duplicates of one flow normalize to the same value;
    genuinely different sources or sinks do not."""
    if not value:
        return ''
    parts = value if isinstance(value, list) else [value]
    normed = []
    for part in parts:
        s = str(part)
        # Prefer the method/field signatures present in the string; these carry
        # the real identity of a sink call or a source getter.
        sigs = _SIGNATURE_RE.findall(s)
        # Keep any string literals too (e.g. getString("extra_package") keys) so
        # two different attacker-controlled inputs into the same sink stay apart.
        literals = re.findall(r'"[^"]*"', s)
        if sigs or literals:
            normed.append('|'.join(sigs) + '||' + '|'.join(literals))
        else:
            # No signature/literal (rare) — fall back to blanking out locals so
            # pure register-alias strings still collapse.
            normed.append(_SOOT_LOCAL_RE.sub('$V', s))
    return ' ;; '.join(sorted(normed))


def _normalize_target_path(target):
    """The set of method/field signatures the taint path traverses, ignoring the
    per-hop SSA temporaries (the `-><local>` suffix) and pointer-flow bookkeeping.

    Register-alias reports of ONE flow visit the same methods, so they collapse to
    the same set. But two different branches of one router method that happen to
    share a source getter and the same sink call — e.g. GmpDeepLinkUtil.d's
    "externalweb" branch (which hands off through utility.e.d/b to an external
    browser) vs its "gmp" branch (which targets the internal GmpWebActivity) —
    traverse different methods, so their sets differ and they stay distinct.
    Without this, (position, sink, source) alone is identical for both branches
    and the second one is silently folded into the first's duplicate_count."""
    if not target:
        return frozenset()
    parts = target if isinstance(target, list) else [target]
    sigs = set()
    for part in parts:
        sigs.update(_SIGNATURE_RE.findall(str(part)))
    return frozenset(sigs)


def _dedup_key(details):
    """Identity of a *reportable* flow: the containing method (position), the
    normalized sink call, the normalized source, and the set of methods the taint
    path traverses. Collapses register aliases while keeping distinct
    method/sink/source combinations — and distinct router branches that share a
    source/sink but reach different code — separate."""
    return (
        details.get('position') or '',
        _normalize_flow_endpoint(details.get('Sink')),
        _normalize_flow_endpoint(details.get('Source')),
        _normalize_target_path(details.get('target')),
    )


def save_scan_results(app_name, parsed_results, scan_guid=None):
    """Helper function to save scan results to database"""
    if parsed_results is None:
        logger.error(f"No parsed results to save for {app_name}")
        return

    try:
        app_info = parsed_results['app_info']
        package_name = app_info.get('package_name')
        version = app_info.get('version_name')

        android_info = None

        # Strategy 1: Try to find by exact app_name (filename)
        android_info = AndroidInfo.query.filter_by(app_name=app_name).first()

        # Strategy 2: Try by package_name/version from scan results
        if not android_info and package_name and version:
            android_info = AndroidInfo.query.filter_by(package_name=package_name, version=version).first()

        # Strategy 3: Extract package name from filename (e.g., "com.android.settings_15-35.apk" -> "com.android.settings")
        # Filename format is typically: {package_name}_{version}-{build}.apk
        if not android_info and '_' in app_name:
            potential_package = app_name.rsplit('_', 1)[0]  # Get part before last underscore
            if '.' in potential_package:  # Looks like a package name
                android_info = AndroidInfo.query.filter_by(package_name=potential_package).first()
                if android_info:
                    logger.info(f"Found AndroidInfo by extracted package name: {potential_package}")

        if android_info:
            logger.info(f"Found existing AndroidInfo (id={android_info.id}) for {app_name}")
        else:
            logger.info(f"Creating new AndroidInfo for {app_name}")
            android_info = AndroidInfo(
                app_name=app_name,
                package_name=package_name,
                version=version
            )
            db.session.add(android_info)

        db.session.flush()

        scan = AppsharkScan(
            android_info=android_info,
            app_info=parsed_results.get('app_info'),
            manifest_risks=parsed_results.get('manifest_risks'),
            scan_task_guid=scan_guid  # Link to ScanTask
        )
        db.session.add(scan)
        db.session.flush()

        # Build the exported-reachability map once per scan (SliceMode attribution
        # recovery). Best-effort; empty if the decompiled source is unavailable.
        reach_map = build_exported_reachable_map(android_info, _scan_java_dir(app_name))
        if reach_map:
            logger.info(f"Reachability map for {app_name}: {len(reach_map)} classes reachable from exported components")

        for issue in parsed_results.get('security_issues', []):
            security_issue = AppsharkSecurityIssue(
                appshark_scan=scan,
                category=issue['category'],
                name=issue['name'],
                detail=issue['detail'],
                model=issue['model'],
                possibility=issue['possibility'],
                wiki=issue['wiki'],
                deobf_apk=issue['deobf_apk']
            )
            db.session.add(security_issue)
            db.session.flush()

            # Collapse register-alias duplicates within this rule. Appshark reports
            # the same source->sink flow once per SSA temporary; we keep one row per
            # distinct (position, normalized-sink, normalized-source) and count the
            # rest into duplicate_count. First occurrence wins (kept verbatim so the
            # stored sink/source/hash remain a real, reproducible trace).
            issue_raw = 0
            deduped = {}  # dedup_key -> AppsharkVulnerability
            for vuln in issue.get('vulnerabilities', []):
                details = vuln.get('details', {})
                issue_raw += 1

                key = _dedup_key(details)
                existing = deduped.get(key)
                if existing is not None:
                    existing.duplicate_count += 1
                    continue

                entry_method = details.get('entryMethod')
                manifest_block = details.get('Manifest') or {}

                # Attribute the flow to the manifest component that anchors it, trying the
                # most authoritative signal first and keeping the first that resolves to a
                # DECLARED component so exported/accessible reflect the true attack surface:
                #   1. entryMethod — usually a synthetic "Main_Entry_<mangled-FQN>" stub
                #      naming the exported component that anchors the taint path.
                #   2. Manifest.trace[0] — the concrete entry frame Appshark recorded. For
                #      SliceMode/ExportedCompos rules the entryMethod/position is an internal
                #      helper (e.g. a *Router/*Util) and the exported component is named only
                #      here; Appshark already proved this frame roots the path (it emits
                #      Manifest.exported), so this is a hard attribution, not a guess.
                #   3. position — the class the sink physically lives in.
                # class_name keeps the best available label even when none is a declared
                # component (so the UI still shows where the sink lives).
                class_name, component_info = _resolve_component_from_sig(android_info, entry_method)
                if not component_info:
                    trace = manifest_block.get('trace') or []
                    entry_cls, entry_info = _resolve_component_from_sig(android_info, trace[0]) if trace else (None, None)
                    pos_cls, pos_info = _resolve_component_from_sig(android_info, details.get('position'))
                    if entry_info:
                        class_name, component_info = entry_cls, entry_info
                    elif pos_info:
                        class_name, component_info = pos_cls, pos_info
                    elif not class_name:
                        class_name = entry_cls or pos_cls

                is_accessible = component_info['component_accessible'] if component_info else False

                # SliceMode attribution recovery: if this finding isn't already
                # attributable to an accessible exported component, but its sink class
                # (position) is reachable from one, flag it for review with the
                # reaching component. Distinct from component_exported (a review
                # signal, not a hard exported claim).
                exported_via = None
                if not is_accessible:
                    position_class = extract_class_from_entry_method(details.get('position'))
                    exported_via = _reachable_via(position_class, reach_map)

                vulnerability = AppsharkVulnerability(
                    security_issue=security_issue,
                    position=details.get('position'),
                    entry_method=entry_method,
                    sink=details.get('Sink'),
                    source=details.get('Source'),
                    url=details.get('url'),
                    target=details.get('target'),
                    manifest=details.get('Manifest'),
                    hash=vuln.get('hash'),
                    old_hash=vuln.get('old_hash'),
                    possibility=vuln.get('possibility'),
                    duplicate_count=1,
                    # Pre-computed component info from manifest lookup
                    component_name=class_name,
                    component_type=component_info['component_type'] if component_info else None,
                    component_exported=component_info['component_exported'] if component_info else False,
                    component_accessible=is_accessible,
                    component_has_intent_filters=component_info['component_has_intent_filters'] if component_info else False,
                    exported_reachable=bool(exported_via),
                    exported_via=exported_via
                )
                deduped[key] = vulnerability
                db.session.add(vulnerability)

            if issue_raw != len(deduped):
                logger.info(
                    f"Dedup [{issue['category']}/{issue['name']}]: "
                    f"{issue_raw} raw flows -> {len(deduped)} distinct"
                )

        db.session.commit()
        logger.info(f"Scan results for {app_name} saved successfully")
    except IntegrityError as e:
        db.session.rollback()
        logger.error(f"IntegrityError saving scan results for {app_name}: {str(e)}")
        raise
    except Exception as e:
        db.session.rollback()
        logger.exception(f"Error saving scan results for {app_name}: {str(e)}")
        raise


@celery.task(bind=True)
def build_ios_xref_index_task(self, binary_hash, filename):
    """Build the Obj-C cross-reference index for one binary and cache it in Postgres.

    Heavy strongarm pass (~<1 min for a large binary). Routed to the `ios` queue,
    which is consumed only by the amd64 ios-analysis worker (strongarm-dataflow has
    no arm64 wheel). Idempotent: DELETE + bulk INSERT + status flip in one txn.
    """
    from sqlalchemy import text
    from project.api.disas import collect_ios_xrefs

    app = get_flask_app()
    with app.app_context():
        db.session.execute(text("""
            INSERT INTO ios_xref_status (binary_hash, filename, state, error)
            VALUES (:h, :f, 'BUILDING', NULL)
            ON CONFLICT (binary_hash)
            DO UPDATE SET state = 'BUILDING', error = NULL, filename = :f
        """), {'h': binary_hash, 'f': filename})
        db.session.commit()

        try:
            rows = collect_ios_xrefs(filename)

            # Transactional replace so a query never sees a half-built index.
            db.session.execute(
                text("DELETE FROM ios_xref_index WHERE binary_hash = :h"),
                {'h': binary_hash},
            )
            if rows:
                from psycopg2.extras import execute_values
                raw_conn = db.session.connection().connection
                cur = raw_conn.cursor()
                execute_values(
                    cur,
                    """INSERT INTO ios_xref_index
                       (binary_hash, kind, target, caller_addr,
                        caller_func_start, caller_func_name, receiver_class)
                       VALUES %s""",
                    [(binary_hash, r['kind'], r['target'], r['caller_addr'],
                      r['caller_func_start'], r['caller_func_name'], r['receiver_class'])
                     for r in rows],
                    page_size=1000,
                )

            db.session.execute(text("""
                UPDATE ios_xref_status
                SET state = 'READY', total_refs = :n, built_at = now(), error = NULL
                WHERE binary_hash = :h
            """), {'n': len(rows), 'h': binary_hash})
            db.session.commit()
            logger.info(f"xref index built for {filename} [{binary_hash[:12]}]: {len(rows)} refs")
            return {'status': 'success', 'total_refs': len(rows)}

        except Exception as e:
            db.session.rollback()
            try:
                db.session.execute(text("""
                    UPDATE ios_xref_status SET state = 'ERROR', error = :e WHERE binary_hash = :h
                """), {'e': str(e)[:1000], 'h': binary_hash})
                db.session.commit()
            except Exception:
                db.session.rollback()
            logger.error(f"xref index build failed for {filename}: {e}", exc_info=True)
            return {'status': 'error', 'message': str(e)}

