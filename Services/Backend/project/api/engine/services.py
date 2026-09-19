import json
import os
import re
import logging
import glob
import hashlib

from .container_client import ContainerClient, LOCAL_UPLOADS, SCANS_ROOT
from .safety import validate_apk_name, file_sha256, rule_path, load_secret_findings
# Only the name constants are used here now — the decompiler backends
# themselves live in the engine worker image (Services/Engine/worker/), reached
# via the engine.decompile task.
from .decompilers import DECOMPILERS, DEFAULT_DECOMPILER

try:
    import json5  # type: ignore
except Exception:  # pragma: no cover
    json5 = None

logger = logging.getLogger(__name__)


# App Shark Parsing Class.

class AppSharkParsing:
    def __init__(self, json_data):
        self.data = json_data

    def parse_app_info(self):
        app_info = self.data.get('AppInfo', {})
        return {
            'app_name': app_info.get('AppName'),
            'package_name': app_info.get('PackageName'),
            'min_sdk': app_info.get('min_sdk'),
            'target_sdk': app_info.get('target_sdk'),
            'version_code': app_info.get('versionCode'),
            'version_name': app_info.get('versionName'),
            'class_count': app_info.get('classCount'),
            'method_count': app_info.get('methodCount'),
            'scan_time': app_info.get('appsharkTakeTime')
        }

    def parse_manifest_risks(self):
        return self.data.get('ManifestRisk', {})

    def parse_security_issues(self):
        security_info = self.data.get('SecurityInfo', {})
        issues = []
        for category, category_issues in security_info.items():
            for issue_name, issue_data in category_issues.items():
                vulnerabilities = []
                for vuln in issue_data.get('vulners', []):
                    vulnerabilities.append({
                        'details': {
                            'Sink': vuln['details'].get('Sink', []),
                            'position': vuln['details'].get('position'),
                            'Manifest': vuln['details'].get('Manifest', {}),
                            'entryMethod': vuln['details'].get('entryMethod'),
                            'Source': vuln['details'].get('Source', []),
                            'url': vuln['details'].get('url'),
                            'target': vuln['details'].get('target', [])
                        },
                        'hash': vuln.get('hash'),
                        'old_hash': vuln.get('old_hash'),
                        'possibility': vuln.get('possibility')
                    })
                issues.append({
                    'category': category,
                    'name': issue_name,
                    'detail': issue_data.get('detail'),
                    'model': issue_data.get('model'),
                    'possibility': issue_data.get('possibility'),
                    'vulnerabilities': vulnerabilities,
                    'wiki': issue_data.get('wiki'),
                    'deobf_apk': issue_data.get('deobfApk')
                })
        return issues

    def parse_deep_link_info(self):
        return self.data.get('DeepLinkInfo', {})

    def parse_http_api(self):
        return self.data.get('HTTP_API', [])

    def parse_js_bridge_info(self):
        return self.data.get('JsBridgeInfo', [])

    def parse_basic_info(self):
        basic_info = self.data.get('BasicInfo', {})
        components_info = basic_info.get('ComponentsInfo', {})
        return {
            'exported_providers': components_info.get('exportedProviders', {}),
            'exported_receivers': components_info.get('exportedReceivers', {}),
            'unexported_activities': components_info.get('unExportedActivities', {}),
            'unexported_providers': components_info.get('unExportedProviders', {}),
            'exported_activities': components_info.get('exportedActivities', {}),
            'exported_services': components_info.get('exportedServices', {}),
            'js_native_interface': basic_info.get('JSNativeInterface', [])
        }

    def parse_permissions(self):
        return {
            'used': self.data.get('UsePermissions', []),
            'defined': self.data.get('DefinePermissions', {})
        }

    def parse_profile(self):
        return self.data.get('Profile')

    def parse_all(self):
        return {
            'app_info': self.parse_app_info(),
            'manifest_risks': self.parse_manifest_risks(),
            'security_issues': self.parse_security_issues(),
            'deep_link_info': self.parse_deep_link_info(),
            'http_api': self.parse_http_api(),
            'js_bridge_info': self.parse_js_bridge_info(),
            'basic_info': self.parse_basic_info(),
            'permissions': self.parse_permissions(),
            'profile': self.parse_profile()
        }


# Engine Service Class
class EngineService:
    def __init__(self):
        # No docker.from_env() here. Constructing a client at import time forced
        # every service that imports this module — including ios-analysis, which
        # never drives the engine — to mount /var/run/docker.sock. ContainerClient
        # creates one lazily if a still-unconverted exec() caller needs it.
        self.client = None
        self.container_name = os.getenv("ENGINE_CONTAINER_NAME", "leviathan-vue3-engine-1")
        self.containers = ContainerClient(self.container_name)
        self.settings_file = "/tmp/config/settings.json"
        self.engine_config_file = "/appshark_engine/appshark/config/EngineConfig.json5"

    @staticmethod
    def _sha256_text(text: str) -> str:
        return hashlib.sha256((text or '').encode('utf-8')).hexdigest()

    def get_engine_config(self) -> dict:
        """Return EngineConfig.json5 raw text, parsed (best-effort), and a hash for concurrency control."""
        content = self.get_file_content(self.engine_config_file)
        parsed = None
        parse_error = None

        if json5 is not None:
            try:
                parsed = json5.loads(content)
            except Exception as e:
                parse_error = str(e)
        else:
            # Backend doesn't have json5 installed; keep raw text only.
            parse_error = "json5 parser not installed on backend"

        return {
            "path": self.engine_config_file,
            "content": content,
            "hash": self._sha256_text(content),
            "parsed": parsed,
            "parseError": parse_error,
        }

    def save_engine_config(self, content: str, expected_hash: str = None) -> dict:
        """Save EngineConfig.json5 with optimistic concurrency and JSON5 validation.

        Does not reformat; writes raw `content`.
        """
        current = self.get_engine_config()
        current_hash = current.get('hash')
        if expected_hash and expected_hash != current_hash:
            return {
                "success": False,
                "status": 409,
                "message": "EngineConfig.json5 has changed since you loaded it. Reload and try again.",
                "currentHash": current_hash,
            }

        if json5 is None:
            return {
                "success": False,
                "status": 500,
                "message": "Server can't validate JSON5 because json5 parser isn't installed.",
            }

        # Parse to validate JSON5 syntax before writing.
        try:
            json5.loads(content)
        except Exception as e:
            return {
                "success": False,
                "status": 400,
                "message": f"Invalid JSON5: {str(e)}",
            }

        self.write_file_content(self.engine_config_file, content)
        saved = self.get_engine_config()
        return {
            "success": True,
            "status": 200,
            "message": "EngineConfig.json5 saved successfully",
            "hash": saved.get('hash'),
        }

    def _resolve_scan_root(self, settings: dict) -> str:
        """Return absolute scan output inside the engine container."""
        out = (settings or {}).get('out')
        if not out:
            return "/appshark_engine/appshark/Scans"

        out = str(out).strip()
        if out.startswith('/'):
            # Already absolute inside container.
            return out.rstrip('/')

        # settings['out'] is often "Scans" (relative). Make it absolute.
        return f"/appshark_engine/appshark/{out.strip('/')}"

    def get_scan_results(self, app_name):
        try:
            print(f"Getting scan results for {app_name}")  # Debugging line
            settings = self.get_settings()
            scan_root = self._resolve_scan_root(settings)

            # Remove the first directory from app_name if it contains a slash
            if '/' in app_name:
                app_name = app_name.split('/', 1)[1]

            app_name = app_name.strip('/')

            # Construct the results.json path
            results_file = os.path.join(scan_root, app_name, 'results.json')

            print(f"[========================]App Name: {app_name}")  # Debugging line
            logger.info(f"Attempting to read results from: {results_file}")

            if not self.file_exists(results_file):
                logger.error(f"Results file not found: {results_file}")
                return None

            content = self.get_file_content(results_file)
            return json.loads(content)
        except Exception as e:
            logger.error(f"Failed to retrieve or parse results for {app_name}: {e}")
            return None

    @staticmethod
    def _rule_from_partial_url(url):
        """Recover the rule name from a finding's details.url, which points at the
        per-finding HTML report (.../vulnerability/<N>-<RuleName>.html)."""
        if not url:
            return None
        m = re.search(r'/\d+-([A-Za-z0-9_]+)\.html', str(url))
        return m.group(1) if m else None

    def get_partial_scan_results(self, app_name):
        """Load Appshark's incremental results_partial.json (written when a scan is
        capped/interrupted before results.json) and reshape the flat finding list into
        the SecurityInfo structure AppSharkParsing expects. Findings are grouped by rule,
        recovered from each finding's details.url. Returns a results.json-shaped dict (with
        AppInfo empty — the caller supplies app metadata) or None if no partial file."""
        try:
            settings = self.get_settings()
            scan_root = self._resolve_scan_root(settings)
            if '/' in app_name:
                app_name = app_name.split('/', 1)[1]
            app_name = app_name.strip('/')
            partial_file = os.path.join(scan_root, app_name, 'results_partial.json')
            if not self.file_exists(partial_file):
                return None
            findings = json.loads(self.get_file_content(partial_file))
            if not isinstance(findings, list) or not findings:
                return None
            security_info = {}
            for f in findings:
                if not isinstance(f, dict):
                    continue
                details = f.get('details', {}) or {}
                rule = self._rule_from_partial_url(details.get('url')) or 'Unknown'
                category = security_info.setdefault(rule, {})
                entry = category.setdefault(rule, {
                    'name': rule, 'category': rule, 'detail': '', 'model': '',
                    'possibility': f.get('possibility', ''), 'wiki': '',
                    'deobfApk': {}, 'vulners': [],
                })
                entry['vulners'].append(f)
            logger.info(f"Loaded partial results for {app_name}: {len(findings)} findings across {len(security_info)} rules")
            return {'AppInfo': {}, 'SecurityInfo': security_info, 'partial': True}
        except Exception as e:
            logger.error(f"Failed to load partial results for {app_name}: {e}")
            return None

    def parse_scan_results(self, app_name, allow_partial=False):
        try:
            results = self.get_scan_results(app_name)
            if results:
                logger.info(f"Successfully retrieved results for {app_name}")
                return AppSharkParsing(results).parse_all()
            # No final results.json. If the caller opted into partial viewing, reshape
            # results_partial.json so it can be researched while the full scan re-runs.
            if allow_partial:
                partial = self.get_partial_scan_results(app_name)
                if partial:
                    parsed = AppSharkParsing(partial).parse_all()
                    parsed['partial'] = True
                    logger.info(f"Serving PARTIAL results for {app_name}")
                    return parsed
            logger.error(f"No results found for {app_name}")
            return None
        except Exception as e:
            logger.exception(f"Error parsing scan results for {app_name}: {str(e)}")
            return None

    def file_exists(self, file_path):
        """Check whether a file exists on the shared volumes or in the engine."""
        try:
            return self.containers.file_exists(file_path)
        except Exception as e:
            logger.error(f"Error checking file existence: {str(e)}")
            return False

    def get_file_content(self, file_path):
        """Read file content from the shared volumes or the engine container."""
        try:
            content = self.containers.read_file(file_path)
            if not content.strip():
                logger.warning(f"File is empty: {file_path}")
            return content
        except Exception as e:
            logger.error(f"Failed to read file {file_path}: {e}")
            raise

    @staticmethod
    def _normalize_java_request(java_file: str) -> str:
        """Normalize a requested Java file identifier to a relative path candidate."""
        if java_file is None:
            return ''
        s = str(java_file).strip()
        # remove leading '<' from findings like "<com.foo.Bar>"
        s = s.lstrip('<').rstrip('>')
        # Strip leading slashes to keep it relative
        s = s.lstrip('/')
        return s

    def build_and_store_class_index(self, file_name: str, engine: str) -> int:
        """Parse the decompiled sources and (re)populate decompiled_class_index.

        Runs the parser in the engine container, then DELETE+bulk-INSERT the rows
        for this file_name in one transaction (mirrors the ios_xref_index task).
        Returns the number of indexed types.
        """
        from project import db
        from sqlalchemy import text
        from psycopg2.extras import execute_values
        from project.api.engine.class_index import build_class_index_rows

        rows = build_class_index_rows(self.containers, file_name)

        db.session.execute(
            text("DELETE FROM decompiled_class_index WHERE file_name = :f"),
            {"f": file_name},
        )
        if rows:
            raw_conn = db.session.connection().connection
            cur = raw_conn.cursor()
            execute_values(
                cur,
                """INSERT INTO decompiled_class_index
                   (file_name, engine, fqcn, simple_name, package, rel_path)
                   VALUES %s""",
                [(file_name, engine, r["fqcn"], r["simple"], r.get("package"), r["rel_path"])
                 for r in rows],
            )
        db.session.commit()
        return len(rows)

    def clear_class_index(self, file_name: str):
        from project import db
        from sqlalchemy import text

        db.session.execute(
            text("DELETE FROM decompiled_class_index WHERE file_name = :f"),
            {"f": file_name},
        )
        db.session.commit()

    @staticmethod
    def _request_to_fqcn(requested: str):
        """Normalize a class/path/basename request to a dotted FQCN (no .java)."""
        s = (requested or "").strip().lstrip("<")
        if s.endswith(".java"):
            s = s[:-5]
        if "/" in s:
            s = s.replace("/", ".")
        s = s.strip(".")
        return s or None

    def _lookup_class_index(self, file_name: str, requested: str):
        """Return a rel_path from decompiled_class_index, or None. Exact FQCN
        first, then inner-class outer, then app-scoped simple-name (shortest path)."""
        from project import db
        from sqlalchemy import text

        fqcn = self._request_to_fqcn(requested)
        if not fqcn:
            return None
        outer = fqcn.split("$", 1)[0]  # Foo$Bar / Foo$1 live in the outer file

        candidates = [fqcn] + ([outer] if outer != fqcn else [])
        for cand in candidates:
            row = db.session.execute(
                text("SELECT rel_path FROM decompiled_class_index "
                     "WHERE file_name = :f AND fqcn = :c LIMIT 1"),
                {"f": file_name, "c": cand},
            ).fetchone()
            if row:
                return row[0]

        # Fall back to simple name, but scoped to THIS app (unlike a blind find).
        simple = outer.rsplit(".", 1)[-1]
        row = db.session.execute(
            text("SELECT rel_path FROM decompiled_class_index "
                 "WHERE file_name = :f AND simple_name = :s "
                 "ORDER BY length(rel_path) LIMIT 1"),
            {"f": file_name, "s": simple},
        ).fetchone()
        return row[0] if row else None

    def resolve_decompiled_java_path(self, file_name: str, java_file: str) -> str:
        """
        Resolve a requested Java file to an actual decompiled source file in the container.

        Accepts:
          - Fully qualified class: com.android.Foo
          - Relative path: com/android/Foo.java
          - Basename only: Foo.java

        Returns an absolute path like:
          /tmp/decompiled/<file_name>/sources/com/android/Foo.java

        Strategy: consult decompiled_class_index first (exact, decompiler-agnostic).
        Only if that misses do we fall back to the legacy path/basename heuristic.
        """
        decompiled_root = f"/tmp/decompiled/{file_name}/sources"
        requested = self._normalize_java_request(java_file)
        if not requested:
            raise ValueError("java_file is required")

        # Index lookup first (authoritative when populated).
        try:
            rel = self._lookup_class_index(file_name, requested)
            if rel:
                indexed_path = f"/tmp/decompiled/{file_name}/{rel.lstrip('/')}"
                if self.file_exists(indexed_path):
                    return indexed_path
                logger.warning(
                    f"class-index hit {rel} for {requested} but file missing; "
                    f"falling back to heuristic search"
                )
        except Exception as e:
            # Never let an index problem break resolution — fall through.
            logger.warning(f"class-index lookup failed for {requested} (non-fatal): {e}")

        # Legacy heuristic fallback (index empty / pre-index decompiles). Handles
        # BOTH .java and .kt, since JADX emits .java and Vineflower emits .kt for
        # Kotlin classes — the same class differs only by extension between engines.
        def _find_by_stem(stem):
            """Find <stem>.java OR <stem>.kt under sources/; return matches.

            Decompiled output lives at /tmp/decompiled inside the engine
            container — not a shared volume — so this walks the tree there.
            """
            return self.containers.find_sources(decompiled_root, [stem], limit=20)

        # Case 1: request already looks like a concrete path (has '/' or an ext).
        rel_candidate = None
        if '/' in requested or requested.endswith(('.java', '.kt')):
            rel_candidate = requested
        else:
            # Treat as a class name -> com/foo/Bar.java (may actually be .kt on disk).
            rel_candidate = EngineService.convert_android_to_path(requested)

        # Direct path: try the candidate as-is, and swap .java<->.kt.
        rel_norm = rel_candidate.lstrip('/')
        direct_candidates = [rel_norm]
        if rel_norm.endswith('.java'):
            direct_candidates.append(rel_norm[:-5] + '.kt')
        elif rel_norm.endswith('.kt'):
            direct_candidates.append(rel_norm[:-3] + '.java')
        for cand in direct_candidates:
            if '/' in cand:
                p = f"{decompiled_root}/{cand}"
                if self.file_exists(p):
                    return p

        # Fallback: search by basename stem (extension-agnostic).
        basename = os.path.basename(rel_candidate)
        stem = basename.rsplit('.java', 1)[0].rsplit('.kt', 1)[0]

        matches = _find_by_stem(stem)
        if not matches and '$' in stem:
            # Inner / anonymous classes (Foo$a, Foo$1) live in the outer file.
            matches = _find_by_stem(stem.split('$')[0])

        if not matches:
            raise FileNotFoundError(
                f"Source not found. Requested '{java_file}' (stem '{stem}') under {decompiled_root}"
            )

        # If there are multiple matches, choose the shortest path (usually the real package path).
        matches_sorted = sorted(matches, key=lambda p: (len(p), p))
        chosen = matches_sorted[0]
        if len(matches_sorted) > 1:
            logger.warning(
                f"Multiple matches for {basename}; choosing {chosen}. Candidates: {matches_sorted[:5]}"
            )
        return chosen

    def kill_appshark_processes(self, scan_guid):
        """Cancel the process owned by one validated scan."""
        return self.containers.cancel_scan(scan_guid)

    def create_app_output_directory(self, filename):
        settings = self.get_settings()
        base_output_path = settings.get('out', '/appshark_engine/appshark/Scans')
        app_name = os.path.splitext(filename)[0]  # Remove file extension
        app_output_dir = os.path.join(base_output_path, app_name)
        self.create_directory(app_output_dir)
        return app_output_dir

    def create_directory(self, path):
        try:
            return self.containers.mkdir(path)
        except Exception as e:
            logger.error(f"Failed to create directory: {e}")
            return False

    def write_file_content(self, file_path, content):
        self.containers.write_file(file_path, content)

    def get_settings(self):
        try:
            # Check if the settings file exists
            content = self.get_file_content(self.settings_file)
            settings = json.loads(content)
        except Exception:
            # If the file doesn't exist or can't be read, use default settings
            settings = {
                "apkPath": "/appshark_engine/appshark/uploads/",
                "out": "Scans",
                "rulePath": "/appshark_engine/appshark/config/rules",
                "rules": "",
                "debugRule": "",
                "logLevel": 0,
                "javaSource": True,
                "javaSourceHighlighting": False,
                "verboseRuleLogging": False,
                "maxPointerAnalyzeTime": 180,
                "maxThread": 2,
                "callBackEnhance": False,
                "supportFragment": False,
                "ruleMaxAnalyzer": 5000,
                "maxPathLength": 50,
                "wholeProcessMode": False,
                "skipAnalyzeNonRelatedMethods": False,
                "skipPointerPropagationForLibraryMethod": True,
                "checkPermission": False
            }

        return settings

    def run_scan(self, settings, scan_guid=None):
        """Dispatch one AppShark scan to the engine worker and wait for it.

        The JVM now runs inside the engine container as the ``engine.run_appshark``
        task rather than over ``docker exec``. The worker owns config-file
        placement (keyed per scan, so concurrent scans can't clobber a shared
        /tmp path), the results-file search, and the exit-code check.

        Blocking on .get() holds this Celery slot for the scan's duration — a
        deliberate trade to keep the existing control flow intact. Converting to
        a callback/chord is the follow-up, alongside the queue rework.
        """
        try:
            settings = settings or {}
            scan_root = self._resolve_scan_root(settings)
            apk_path = settings.get('apkPath', '')
            app_identifier = os.path.splitext(os.path.basename(apk_path))[0]

            # Ensure root output directory exists (shared scans volume).
            self.create_directory(scan_root)

            settings_for_scan = dict(settings)
            settings_for_scan['out'] = scan_root

            from project.celery_worker import celery as celery_app
            timeout = int(os.getenv("ENGINE_TASK_TIMEOUT", 4 * 60 * 60))

            logger.info(
                f"Dispatching engine.run_appshark for {app_identifier} "
                f"(guid={scan_guid}, timeout={timeout}s)"
            )
            async_result = celery_app.send_task(
                "engine.run_appshark",
                args=[settings_for_scan, scan_guid],
            )
            # Same reason as ContainerClient._send: this runs inside
            # run_scan_task, and Celery otherwise refuses .get() within a task.
            # The engine worker is a separate pool in another container, so
            # there is nothing to deadlock against.
            from celery.result import allow_join_result
            with allow_join_result():
                result = async_result.get(timeout=timeout)

            output = result.get("output", "")
            status = result.get("status")

            # A non-zero exit is a failure even when a stale results.json from an
            # earlier run is sitting on disk. The previous code assigned the
            # (exit_code, output) tuple to `output` and tested `if output:`,
            # which is always truthy — so crashed scans were reported as
            # successful and whatever stale file was found got ingested.
            if status == "error":
                return {
                    "status": "error",
                    "message": f"Scan failed: {result.get('reason', 'unknown')}",
                    "reason": result.get("reason"),
                    "oom": bool(result.get("oom")),
                    "xmx": result.get("xmx"),
                    "exit_code": result.get("exit_code"),
                    "engine_status": result.get("engine_status"),
                    "output": output,
                    "results_file": result.get("results_path"),
                    "partial_results_file": result.get("partial_results_path"),
                    "app_identifier": app_identifier,
                    "scan_root": scan_root,
                }

            logger.info(f"Results File: {result.get('results_path')}")
            return {
                "status": "success",
                "message": "Scan completed successfully",
                "output": output,
                "results_file": result.get("results_path"),
                "engine_status": result.get("engine_status"),
                "app_identifier": app_identifier,
                "scan_root": scan_root,
            }
        except Exception as e:
            logger.error(f"Failed to run scan: {e}")
            return {
                "status": "error",
                "message": f"Failed to run scan: {str(e)}"
            }

    def batch_file_exists(self, file_paths):
        """Check existence of many files in one round-trip; returns {path: exists}."""
        return self.containers.batch_file_exists(file_paths)

    def save_rule(self, rule_name, content):
        try:
            # Always use the base rules path for saving, not settings.rulePath
            # This prevents double nesting when settings.rulePath contains a subdirectory
            base_rule_path = '/appshark_engine/appshark/config/rules'
            full_path = rule_path(rule_name)

            # Ensure the parent directory of the file exists (handles subdirectories with spaces)
            parent_dir = os.path.dirname(full_path)
            self.create_directory(parent_dir)

            # Write the content to the file using the container
            result = self.containers._send("engine.write_file", [full_path, content, "rules"])
            if result.get("status") != "ok":
                raise RuntimeError("Engine rejected rule write")

            return {"success": True, "message": f"Rule '{rule_name}' saved successfully"}
        except Exception as e:
            logger.error(f"Failed to save rule: {e}")
            return {"success": False, "message": f"Failed to save rule: {str(e)}"}

    def create_rule_folder(self, folder_name):
        """Create a new folder in the rules directory."""
        try:
            # Always use the base rules path for creating folders, not settings.rulePath
            # This prevents double nesting when settings.rulePath contains a subdirectory
            base_rule_path = '/appshark_engine/appshark/config/rules'
            full_path = os.path.join(base_rule_path, folder_name)

            if self.create_directory(full_path):
                return {"success": True, "message": f"Folder '{folder_name}' created successfully"}
            else:
                return {"success": False, "message": f"Failed to create folder '{folder_name}'"}
        except Exception as e:
            logger.error(f"Failed to create rule folder: {e}")
            return {"success": False, "message": f"Failed to create folder: {str(e)}"}

    def save_settings(self, new_settings):
        try:
            # Get existing settings
            existing_settings = self.get_settings()
            print("Existing settings: ", existing_settings)  # Add this for debugging

            # Merge new settings with existing settings
            merged_settings = {**existing_settings, **new_settings}

            # write_file creates parent directories itself.
            settings_json = json.dumps(merged_settings)
            self.write_file_content(self.settings_file, settings_json)
            return {"message": "Settings saved successfully"}
        except Exception as e:
            logger.error(f"Failed to save settings: {e}")
            raise

    def read_decompiler_marker(self, file_name):
        """Return the parsed ``.decompiler`` marker dict for a decompiled app, or None."""
        validate_apk_name(file_name)
        path = f"/tmp/decompiled/{file_name}/.decompiler"
        try:
            marker = json.loads(self.containers.read_file(path))
            input_path = os.path.realpath(os.path.join(LOCAL_UPLOADS, file_name))
            if os.path.dirname(input_path) != os.path.realpath(LOCAL_UPLOADS):
                return None
            if marker.get("input_sha256") != file_sha256(input_path):
                return None
            return marker
        except OSError:
            return None
        except (ValueError, TypeError, AttributeError):
            logger.warning(f"Invalid decompiler marker JSON at {path}")
            return None

    def decompile_apk(self, file_name, engine=None, force=False, resources=False):
        """
        Decompile an APK with the selected engine (jadx | vineflower).

        Output always lands at /tmp/decompiled/<file>/sources/<pkg>/*.java regardless
        of engine. An engine-aware marker (/tmp/decompiled/<file>/.decompiler) records
        which engine produced the output and whether resources were extracted; a
        re-decompile is forced when the requested engine differs from the marker, when
        the requested resources flag differs from the marker, when force=True, or when
        no marker exists.

        ``resources`` only applies to the Vineflower engine (JADX always emits
        resources); it is ignored for JADX.

        Returns the decompiled root path (/tmp/decompiled/<file>) on success.
        """
        validate_apk_name(file_name)
        resolved_engine = (engine or DEFAULT_DECOMPILER).strip().lower()
        if resolved_engine not in DECOMPILERS:
            raise ValueError(
                f"Unknown decompiler engine: {engine!r}. Valid: {sorted(DECOMPILERS)}"
            )

        # resources is only meaningful for Vineflower; JADX always decodes resources.
        want_resources = bool(resources) and resolved_engine == 'vineflower'

        decompiled_path = f"/tmp/decompiled/{file_name}"

        try:
            # The whole pipeline — cache-reuse decision, stale-output cleanup,
            # tool invocation and marker write — runs inside the engine
            # container. Only that container can see /tmp/decompiled, so
            # deciding reuse from here previously meant a shell round-trip per
            # check. Runs on engine.tools, so it proceeds during a scan.
            logger.info(
                f"Dispatching engine.decompile for {file_name} with engine "
                f"'{resolved_engine}' (resources={want_resources}, force={force})"
            )
            result = self.containers._send(
                "engine.decompile",
                [file_name, resolved_engine, bool(force), want_resources],
                timeout=int(os.getenv("ENGINE_DECOMPILE_TIMEOUT", 1800)),
            )

            if result.get("status") != "ok":
                try:
                    self.clear_class_index(file_name)
                except Exception:
                    pass
                raise Exception(
                    f"Decompilation failed with engine '{resolved_engine}': "
                    f"{result.get('reason')}. Output tail: {str(result.get('output'))[-800:]}"
                )

            if result.get("reused"):
                logger.info(
                    f"Reusing existing {resolved_engine} decompilation for {file_name} "
                    f"(resources={want_resources})"
                )
                return decompiled_path

            # Build the FQCN -> source-file index (Option C). Best-effort: a
            # failure here must never fail an otherwise-successful decompile.
            try:
                n = self.build_and_store_class_index(file_name, resolved_engine)
                logger.info(f"class-index: stored {n} types for {file_name} ({resolved_engine})")
            except Exception as e:
                logger.warning(f"class-index: build failed for {file_name} (non-fatal): {e}")

            logger.info(
                f"Decompilation of {file_name} succeeded with '{resolved_engine}' at {decompiled_path}"
            )
            return decompiled_path

        except Exception as e:
            logger.error(f"Error in decompile_apk ({resolved_engine}): {str(e)}")
            raise

    def _tool_version_string(self, engine):
        """Best-effort single-line version string for a decompiler engine (for the marker)."""
        try:
            versions = self.get_tool_versions()
        except Exception:
            return ""
        key = 'jadx' if engine == 'jadx' else ('vineflower' if engine == 'vineflower' else engine)
        val = versions.get(key, '')
        return str(val).strip().splitlines()[0] if val else ""

    def _engine_tool_versions(self):
        """All tool versions in one dispatch; {} on failure."""
        try:
            result = self.containers._send("engine.tool_versions", [], timeout=120)
            return result.get("tools", {}) if result.get("status") == "ok" else {}
        except Exception as e:
            logger.error(f"tool_versions dispatch failed: {e}")
            return {}

    def get_trufflehog_version(self):
        tool = self._engine_tool_versions().get("trufflehog", {})
        return tool.get("exit_code", 1), tool.get("output", "")

    def get_jadx_version(self):
        tool = self._engine_tool_versions().get("jadx", {})
        return tool.get("exit_code", 1), tool.get("output", "")

    def _tool_version(self, tool_key):
        """Return a tool's trimmed version string, or a short error string."""
        try:
            tool = self._engine_tool_versions().get(tool_key)
            if not tool:
                return f"error: unknown tool {tool_key}"
            text = str(tool.get("output") or "").strip()
            exit_code = tool.get("exit_code", 1)
            return text or f"error (exit code {exit_code})"
        except Exception as e:
            return f"error: {str(e)}"

    def get_tool_versions(self):
        """Best-effort versions for all decompiler tools. Never raises.

        One dispatch for all three, rather than a shell-out per tool.
        """
        tools = self._engine_tool_versions()

        def _fmt(key):
            tool = tools.get(key)
            if not tool:
                return "error: unavailable"
            text = str(tool.get("output") or "").strip()
            return text or f"error (exit code {tool.get('exit_code', 1)})"

        return {
            "jadx": _fmt("jadx"),
            "dex2jar": _fmt("dex2jar"),
            "vineflower": _fmt("vineflower"),
        }

    def get_container_status(self):
        """Engine reachability, via a broker round-trip rather than the Docker API.

        'running' means the control worker answered; previously this reported
        the container's Docker status, which could say "running" while the
        engine was unable to do any work.
        """
        try:
            self.containers._send("engine.tool_versions", [], timeout=15)
            return "running"
        except Exception as e:
            logger.warning(f"engine control worker unreachable: {e}")
            return "unreachable"

    def generate_config(self, app_name):
        settings = self.get_settings()
        config_dict = {
            'apkPath': f"{settings.get('apkPath', '/appshark_engine/appshark/uploads/')}{app_name}.apk",
            'rules': settings.get('rules', []),
            'rulePath': settings.get('rulePath', ''),
            'maxPointerAnalyzeTime': settings.get('maxPointerAnalyzeTime', 180),
            'debugPath': settings.get('debugPath', ''),
            'javaSource': settings.get('javaSource', True),
            'javaSourceHighlighting': settings.get('javaSourceHighlighting', False),
            'verboseRuleLogging': settings.get('verboseRuleLogging', False),
            'maxThread': settings.get('maxThread', 2),
            'callBackEnhance': settings.get('callBackEnhance', False),
            'supportFragment': settings.get('supportFragment', False),
            'ruleMaxAnalyzer': settings.get('ruleMaxAnalyzer', 5000),
            'maxPathLength': settings.get('maxPathLength', 50),
            'wholeProcessMode': settings.get('wholeProcessMode', False),
            'skipAnalyzeNonRelatedMethods': settings.get('skipAnalyzeNonRelatedMethods', False),
            'skipPointerPropagationForLibraryMethod': settings.get('skipPointerPropagationForLibraryMethod', True),
            'checkPermission': settings.get('checkPermission', False)
        }

        config_dir = '/tmp/config'
        os.makedirs(config_dir, exist_ok=True)
        config_file = f'{config_dir}/{app_name}.json'
        with open(config_file, 'w') as f:
            json.dump(config_dict, f)

        return config_dict

    def get_rules(self, rule_path='/appshark_engine/appshark/config/rules'):
        """Get all directories in the rules folder."""
        try:
            # config/rules is baked into the engine image, so this goes through
            # the worker rather than the (nonexistent) local mount.
            entries = self.containers.list_dir(rule_path)
            output = "\n".join(n for n in entries if n.endswith(".json"))
            exit_code = 0

            # Split the output and filter out empty lines
            rules = [f.strip() for f in output.split('\n') if f.strip()]
            logger.info(f"Found rules: {rules}")
            return sorted(rules)
        except Exception as e:
            logger.error(f"Error in get_rules: {str(e)}")
            return []

    def scan_secrets(self, filename: str) -> dict:
        """Return all structured findings only after a complete successful scan."""
        try:
            validate_apk_name(filename)
            decompiled_path = f"/tmp/decompiled/{filename}"
            if not self.containers.is_dir(decompiled_path):
                return {"status": "error", "message": "Decompiled directory not found"}
            result = self.containers._send(
                "engine.trufflehog", [decompiled_path], timeout=2400
            )
            findings = load_secret_findings(result, decompiled_path, SCANS_ROOT)
            logger.info("Secret scan completed: %d findings", len(findings))
            return {"status": "success", "findings": findings}
        except Exception:
            # No raw tool output or secret values belong in application logs.
            logger.warning("Secret scan failed or produced incomplete results")
            return {"status": "error", "message": "Secret scan failed or produced incomplete results"}

    def get_directories(self, base_path='/appshark_engine/appshark/config/rules'):
        """Get all directories in the rules folder, including subdirectories."""
        try:
            # config/rules lives inside the engine image, so this is a worker
            # dispatch rather than a local walk.
            output = "\n".join(
                e for e in self.containers.list_dir(base_path)
                if self.containers.is_dir(os.path.join(base_path, e))
            )

            # If output is a tuple, extract
            if isinstance(output, tuple):
                output = output[1]

            print(output)
            directories = [d.strip() for d in output.split('\n') if d.strip()]
            logger.info(f"Found directories: {directories}")

            return sorted(directories)
        except Exception as e:
            logger.error(f"Error getting directories: {str(e)}")
            return []

    # Parse the results information from the output of the scan command

    @staticmethod
    def convert_android_to_path(android):
        # Remove any leading '<' character if present
        android = android.lstrip('<')
        return android.replace(".", "/") + ".java"

    def delete_rule(self, rule_name: str) -> dict:
        """Delete a rule JSON file (or file under a subdirectory) from the rules directory."""
        try:
            if not rule_name:
                return {"success": False, "message": "No rule name provided"}

            # Only allow deletes within the base rules directory.
            base_rule_path = '/appshark_engine/appshark/config/rules'

            # Normalize and prevent directory traversal
            normalized = os.path.normpath(rule_name).lstrip(os.sep)
            if normalized.startswith('..') or os.path.isabs(rule_name):
                return {"success": False, "message": "Invalid rule path"}

            full_path = os.path.join(base_rule_path, normalized)

            # Ensure target exists
            if not self.file_exists(full_path):
                return {"success": False, "message": f"Rule not found: {rule_name}"}

            exit_code = 0 if self.containers.remove(full_path) else 1
            output = ""
            if exit_code != 0:
                return {"success": False, "message": f"Failed to delete rule: {output}"}

            return {"success": True, "message": f"Rule '{rule_name}' deleted successfully"}
        except Exception as e:
            logger.error(f"Failed to delete rule: {e}")
            return {"success": False, "message": f"Failed to delete rule: {str(e)}"}

    def get_container_logs(self, tail: int = 300) -> str:
        """Return the last N lines from the most recently modified scan.log.

        The 'scans' Docker volume is mounted on both the engine container
        (/appshark_engine/appshark/Scans) and the backend container at the
        same path, so we can read the file directly — no exec needed.
        tee writes to it in real time while the scan is running.
        """
        try:
            settings = self.get_settings()
            scan_root = self._resolve_scan_root(settings)

            # Appshark writes its log to <scan_root>/<app_name>/log/main natively.
            pattern = os.path.join(scan_root, '*', 'log', 'main')
            candidates = glob.glob(pattern)
            if not candidates:
                return '(no scan log found yet — start a scan to see live output)'

            log_path = max(candidates, key=os.path.getmtime)

            last_lines = self._tail_file(log_path, tail)
            header = f"=== {log_path} (last {tail} lines) ===\n"
            return header + '\n'.join(last_lines) + ('\n' if last_lines else '')
        except Exception as e:
            logger.error(f"Failed to get scan log: {e}")
            raise

    def list_available_scans(self) -> list:
        """Return scan names that have a log/main file, newest first."""
        try:
            settings = self.get_settings()
            scan_root = self._resolve_scan_root(settings)
            pattern = os.path.join(scan_root, '*', 'log', 'main')
            candidates = glob.glob(pattern)
            scans = []
            for path in candidates:
                name = os.path.basename(os.path.dirname(os.path.dirname(path)))
                scans.append((os.path.getmtime(path), name))
            scans.sort(reverse=True)
            return [name for _, name in scans]
        except Exception as e:
            logger.error(f"Failed to list available scans: {e}")
            return []

    @staticmethod
    def _tail_file(path: str, tail: int, avg_line: int = 400, max_bytes: int = 1_000_000) -> list:
        """Return the last `tail` lines of a file by reading only its tail bytes.

        Reads at most ~min(tail*avg_line, max_bytes) from the end rather than the
        whole file — constant work no matter how large the (verbose, actively
        growing) AppShark log is. This is the fix for the scan-logs spinner: the
        old readlines() slurped the entire multi-hundred-MB log on every 4s poll.
        """
        want = min(max(int(tail), 1) * avg_line, max_bytes)
        with open(path, 'rb') as f:
            f.seek(0, os.SEEK_END)
            size = f.tell()
            start = max(0, size - want)
            f.seek(start)
            data = f.read()
        text = data.decode('utf-8', errors='replace')
        if start > 0:
            # drop the possibly-partial first line we sliced into
            nl = text.find('\n')
            if nl != -1:
                text = text[nl + 1:]
        lines = text.splitlines()
        return lines[-tail:] if len(lines) > tail else lines

    def get_scan_log_content(self, scan_name: str, tail: int = 500) -> dict:
        """Read log/main for a given scan directly from the shared scans volume."""
        try:
            settings = self.get_settings()
            scan_root = self._resolve_scan_root(settings)
            # os.path.basename prevents directory traversal
            clean = os.path.basename(str(scan_name or '').strip())
            log_path = os.path.join(scan_root, clean, 'log', 'main')

            if not os.path.isfile(log_path):
                raise FileNotFoundError(f"No log found for scan: {scan_name}")

            last_lines = self._tail_file(log_path, tail)
            return {'files': ['main'], 'content': '\n'.join(last_lines)}
        except Exception as e:
            logger.error(f"Failed to read scan log for {scan_name}: {e}")
            raise

    def get_vulnerability_details_path(self, app_name, vulnerability_id):
        """Resolve the full path of a vulnerability details file in the scan output folder.

        AppShark typically writes vulnerability details under:
          <scan_root>/<app_identifier>/vulnerability/<vuln_file>

        This helper:
          - normalizes app name (.apk suffix)
          - supports both exact filename matches and the historic "<prefix>-*" fallback
        """
        try:
            settings = self.get_settings()
            scan_root = self._resolve_scan_root(settings)

            # Normalize app folder name
            clean_app = str(app_name or '').strip()
            if clean_app.endswith('.apk'):
                clean_app = clean_app[:-4]
            clean_app = clean_app.split('.apk')[0]

            app_vulnerability_path = os.path.join(scan_root, clean_app, 'vulnerability')

            # Ensure directory exists
            if not self.containers.is_dir(app_vulnerability_path):
                raise FileNotFoundError(f"Vulnerability directory not found: {app_vulnerability_path}")

            all_files = self.containers.list_dir(app_vulnerability_path)
            if not all_files:
                raise FileNotFoundError(f"Failed to list vulnerability files in: {app_vulnerability_path}")

            # Exact match first
            if vulnerability_id in all_files:
                return os.path.join(app_vulnerability_path, vulnerability_id)

            # Legacy fallback: match by leading token before '-' (common for numeric-prefixed rules)
            prefix = str(vulnerability_id).split('-', 1)[0]
            matching_file = next((f for f in all_files if f.startswith(f"{prefix}-")), None)
            if not matching_file:
                raise FileNotFoundError(f"No matching vulnerability file found for ID: {vulnerability_id}")

            return os.path.join(app_vulnerability_path, matching_file)

        except Exception as e:
            logger.error(f"Error in get_vulnerability_details_path: {str(e)}")
            raise
