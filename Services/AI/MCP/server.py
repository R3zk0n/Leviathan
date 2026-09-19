# MCP Server for Leviathan
#
# This server exposes Leviathan's scan data as MCP tools so Claude can
# read vulnerability findings, taint traces, and decompiled source code,
# then write audit verdicts back to the database.
#
# Focus:
#   - Validate Appshark findings, reduce false positives
#   - Low operational cost (read-heavy, one write tool)
#   - Robust logging and error handling throughout
#
# Transport: stdio (Claude Code / Claude Desktop)
#            SSE on MCP_SSE_PORT (agentic pipelines via Claude API)
# ---

import asyncio
import json
import logging
import os
import urllib.request
import urllib.error
from datetime import datetime

import psycopg2
import psycopg2.extras
from mcp.server import Server
from mcp.server.stdio import stdio_server
import mcp.types as types

# detail_parser lives one level up (Services/AI/detail_parser.py)
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from detail_parser import parse_appshark_detail

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger("leviathan-mcp")


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

def get_db():
    """
    Open a new psycopg2 connection using DATABASE_URL from the environment.
    Each tool call opens and closes its own connection — keeps things simple
    and avoids stale connection issues across long-running sessions.
    """
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL environment variable is not set")
    return psycopg2.connect(url, cursor_factory=psycopg2.extras.RealDictCursor)


# ---------------------------------------------------------------------------
# MCP server instance
# ---------------------------------------------------------------------------

server = Server("leviathan")


# ---------------------------------------------------------------------------
# Tool: list_apps
#
# What it does:
#   Returns every Android app that has been uploaded to Leviathan, with a
#   count of how many Appshark scans exist for each one and the date of the
#   most recent scan.  This is the entry point — Claude calls this first to
#   know what apps are available to audit.
#
# Why it's simple:
#   One LEFT JOIN, GROUP BY, no JSONB columns, no file I/O.
#   The perfect first tool to verify the MCP ↔ DB connection works.
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Tool Handlers
# ---------------------------------------------------------------------------

async def handle_list_tools(ctx, params) -> types.ListToolsResult:
    """Advertise available tools to the MCP client."""
    return types.ListToolsResult(tools=[
        types.Tool(
            name="list_apps",
            description="List all Android applications that have been uploaded to Leviathan.",
            inputSchema={"type": "object", "properties": {}, "required": []},
        ),
        types.Tool(
            name="get_scan_summary",
            description="Get a high-level summary of an Appshark scan for a given android_info_id.",
            inputSchema={
                "type": "object",
                "properties": {"android_info_id": {"type": "integer"}},
                "required": ["android_info_id"],
            },
        ),
        types.Tool(
            name="triage_findings",
            description="Firmware-wide triage in ONE call.",
            inputSchema={
                "type": "object",
                "properties": {
                    "exported_only": {"type": "boolean"},
                    "min_score": {"type": "integer"},
                    "categories": {"type": "array", "items": {"type": "string"}},
                    "skip_reviewed": {"type": "boolean"},
                    "limit": {"type": "integer"},
                },
                "required": [],
            },
        ),
        types.Tool(
            name="get_source_code",
            description="Fetch JADX-decompiled Java source for every class involved in a taint trace.",
            inputSchema={
                "type": "object",
                "properties": {
                    "security_issue_id": {"type": "integer"},
                    "extra_classes": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["security_issue_id"],
            },
        ),
        types.Tool(
            name="get_taint_trace",
            description="Get the full taint trace for a security issue.",
            inputSchema={
                "type": "object",
                "properties": {"security_issue_id": {"type": "integer"}},
                "required": ["security_issue_id"],
            },
        ),
        types.Tool(
            name="validate_vulnerability",
            description="Persist an AI audit verdict for a single vulnerability.",
            inputSchema={
                "type": "object",
                "properties": {
                    "vuln_id": {"type": "integer"},
                    "verdict": {"type": "string", "enum": ["TRUE_POSITIVE", "FALSE_POSITIVE", "NEEDS_REVIEW"]},
                    "confidence": {"type": "string", "enum": ["HIGH", "MEDIUM", "LOW"]},
                    "reasoning": {"type": "string"},
                },
                "required": ["vuln_id", "verdict", "confidence", "reasoning"],
            },
        ),
        types.Tool(
            name="bulk_validate",
            description="Persist the same AI verdict for multiple vulnerabilities.",
            inputSchema={
                "type": "object",
                "properties": {
                    "vuln_ids": {"type": "array", "items": {"type": "integer"}},
                    "verdict": {"type": "string", "enum": ["TRUE_POSITIVE", "FALSE_POSITIVE", "NEEDS_REVIEW"]},
                    "confidence": {"type": "string", "enum": ["HIGH", "MEDIUM", "LOW"]},
                    "reasoning": {"type": "string"},
                },
                "required": ["vuln_ids", "verdict", "confidence", "reasoning"],
            },
        ),
        types.Tool(
            name="get_manifest_context",
            description="Get the full attack surface for an app in one call.",
            inputSchema={
                "type": "object",
                "properties": {
                    "android_info_id": {"type": "integer"},
                    "exported_only": {"type": "boolean"},
                },
                "required": ["android_info_id"],
            },
        ),
    ])


async def _dispatch_tool(name: str, arguments: dict) -> list[types.TextContent]:
    """Route a validated tool call to its implementation."""
    logger.info("Tool called: %s  args=%s", name, arguments)

    if name == "list_apps":
        return await _list_apps()
    elif name == "get_scan_summary":
        return await _get_scan_summary(arguments.get("android_info_id"))
    elif name == "triage_findings":
        return await _triage_findings(
            exported_only=arguments.get("exported_only", True),
            min_score=arguments.get("min_score", 4),
            categories=arguments.get("categories"),
            skip_reviewed=arguments.get("skip_reviewed", True),
            limit=arguments.get("limit", 25),
        )
    elif name == "get_source_code":
        return await _get_source_code(arguments.get("security_issue_id"), arguments.get("extra_classes", []))
    elif name == "get_taint_trace":
        return await _get_taint_trace(arguments.get("security_issue_id"))
    elif name == "validate_vulnerability":
        return await _validate_vulnerability(
            arguments.get("vuln_id"),
            arguments.get("verdict"),
            arguments.get("confidence"),
            arguments.get("reasoning", ""),
        )
    elif name == "bulk_validate":
        return await _bulk_validate(
            arguments.get("vuln_ids", []),
            arguments.get("verdict"),
            arguments.get("confidence"),
            arguments.get("reasoning", ""),
        )
    elif name == "get_manifest_context":
        return await _get_manifest_context(
            arguments.get("android_info_id"),
            exported_only=arguments.get("exported_only", True),
        )
    else:
        logger.warning("Unknown tool: %s", name)
        return [types.TextContent(type="text", text=json.dumps({"error": f"Unknown tool: {name}"}))]


async def handle_call_tool(ctx, params: types.CallToolRequestParams) -> types.CallToolResult:
    """Adapt the SDK request into _dispatch_tool and box the content blocks."""
    content = await _dispatch_tool(params.name, params.arguments or {})
    return types.CallToolResult(content=content)


# Register handlers for this MCP SDK variant. Handlers are keyed by METHOD
# STRING and wrapped in a HandlerEntry(params_type, handler); the runner
# validates incoming params against params_type, then calls handler(ctx, params):
#   tools/list -> PaginatedRequestParams | None -> ListToolsResult
#   tools/call -> CallToolRequestParams         -> CallToolResult
# The previous code assigned raw functions under the request *class*
# (types.ListToolsRequest) into server._request_handlers, which this dispatcher
# keys by string and never looks up — so the client connected but saw zero tools.
server.add_request_handler("tools/list", types.PaginatedRequestParams, handle_list_tools)
server.add_request_handler("tools/call", types.CallToolRequestParams, handle_call_tool)

# ---------------------------------------------------------------------------
# get_scan_summary implementation
#
# Mirrors the backend EngineScanHighLevelResults logic exactly:
#   android_info (by id)
#     → appshark_scans (latest by scan_date)
#       → appshark_security_issues (all for that scan)
#         → appshark_vulnerabilities (first entry_method per issue)
#
# app_info and manifest_risks come from JSONB columns on appshark_scans,
# not from separate tables — that's why a plain aggregate won't work.
# ---------------------------------------------------------------------------

async def _get_scan_summary(android_info_id: int) -> list[types.TextContent]:
    # Step 1: get the app row
    app_query = """
        SELECT id, app_name, package_name, version, developer
        FROM android_info
        WHERE id = %s
    """

    # Step 2: get the latest scan for this app (same ordering the backend uses)
    scan_query = """
        SELECT id, scan_date, app_info, manifest_risks, is_partial
        FROM appshark_scans
        WHERE android_info_id = %s
        ORDER BY scan_date DESC
        LIMIT 1
    """

    # Step 3: get all security issues for the scan
    issues_query = """
        SELECT id, category, name, detail, possibility, wiki
        FROM appshark_security_issues
        WHERE appshark_scan_id = %s
        ORDER BY category, name
    """

    # Step 4: for each issue, get the first vuln's entry_method, total count,
    # and AI verdict breakdown (mirrors get_security_issues_summary in the backend)
    vulns_query = """
        SELECT
            security_issue_id,
            COUNT(*)                                             AS vuln_count,
            (ARRAY_AGG(entry_method ORDER BY id))[1]             AS first_entry_method,
            SUM(CASE WHEN component_exported   THEN 1 ELSE 0 END) AS exported_count,
            SUM(CASE WHEN component_accessible THEN 1 ELSE 0 END) AS accessible_count,
            SUM(CASE WHEN suppressed           THEN 1 ELSE 0 END) AS suppressed_count,
            SUM(CASE WHEN ai_verdict IS NOT NULL THEN 1 ELSE 0 END) AS ai_reviewed_count,
            SUM(CASE WHEN ai_verdict = 'TRUE_POSITIVE'  THEN 1 ELSE 0 END) AS ai_true_positive_count,
            SUM(CASE WHEN ai_verdict = 'FALSE_POSITIVE' THEN 1 ELSE 0 END) AS ai_false_positive_count,
            SUM(CASE WHEN ai_verdict = 'NEEDS_REVIEW'   THEN 1 ELSE 0 END) AS ai_needs_review_count
        FROM appshark_vulnerabilities
        WHERE security_issue_id = ANY(%s)
        GROUP BY security_issue_id
    """

    try:
        conn = get_db()
        try:
            with conn.cursor() as cur:
                # 1. App
                cur.execute(app_query, (android_info_id,))
                app = cur.fetchone()
                if not app:
                    return [types.TextContent(type="text", text=json.dumps(
                        {"error": f"No app found with android_info_id={android_info_id}"}
                    ))]

                # 2. Latest scan
                cur.execute(scan_query, (android_info_id,))
                scan = cur.fetchone()
                if not scan:
                    return [types.TextContent(type="text", text=json.dumps(
                        {"error": f"No scans found for android_info_id={android_info_id}"}
                    ))]

                # 3. Security issues
                cur.execute(issues_query, (scan["id"],))
                issues = cur.fetchall()

                # 4. Vuln stats per issue (one query for all issues)
                issue_ids = [i["id"] for i in issues]
                vuln_stats = {}
                if issue_ids:
                    cur.execute(vulns_query, (issue_ids,))
                    for row in cur.fetchall():
                        vuln_stats[row["security_issue_id"]] = row

        finally:
            conn.close()

        # Build per-category summary — same structure as backend
        category_summary = {}
        for issue in issues:
            cat = issue["category"] or "Unknown"
            stats = vuln_stats.get(issue["id"], {})

            category_summary.setdefault(cat, {"count": 0, "issues": []})
            category_summary[cat]["count"] += 1
            category_summary[cat]["issues"].append({
                "id":                   issue["id"],
                "name":                 issue["name"],
                "detail":               issue["detail"],
                "possibility":          issue["possibility"],
                "wiki":                 issue["wiki"],
                "vuln_count":           int(stats.get("vuln_count") or 0),
                "first_entry_method":   stats.get("first_entry_method"),
                "exported_count":       int(stats.get("exported_count") or 0),
                "accessible_count":     int(stats.get("accessible_count") or 0),
                "suppressed_count":     int(stats.get("suppressed_count") or 0),
                "ai_reviewed_count":    int(stats.get("ai_reviewed_count") or 0),
                "ai_true_positive_count":  int(stats.get("ai_true_positive_count") or 0),
                "ai_false_positive_count": int(stats.get("ai_false_positive_count") or 0),
                "ai_needs_review_count":   int(stats.get("ai_needs_review_count") or 0),
            })

        result = {
            "android_info_id": android_info_id,
            "scan_id":         scan["id"],
            "scan_date":       scan["scan_date"].isoformat() if scan["scan_date"] else None,
            "is_partial":      scan["is_partial"],
            "app_info": {
                **(scan["app_info"] or {}),
                "app_name":     app["app_name"],
                "package_name": app["package_name"],
                "version":      app["version"],
                "developer":    app["developer"],
            },
            "manifest_risks":          scan["manifest_risks"] or {},
            "security_issues_summary": category_summary,
            "total_issues":            len(issues),
            "total_vulns":             sum(v.get("vuln_count", 0) or 0 for v in vuln_stats.values()),
        }

        logger.info(
            "get_scan_summary: android_info_id=%d scan_id=%d issues=%d",
            android_info_id, scan["id"], len(issues),
        )
        return [types.TextContent(type="text", text=json.dumps(result, indent=2))]

    except Exception as exc:
        logger.exception("get_scan_summary failed for android_info_id=%d", android_info_id)
        return [types.TextContent(type="text", text=json.dumps({"error": str(exc)}))]


# ---------------------------------------------------------------------------
# list_apps implementation
# ---------------------------------------------------------------------------

async def _list_apps() -> list[types.TextContent]:
    """
    Query android_info LEFT JOINed with appshark_scans so we get:
      - Every app, even ones that have never been scanned
      - Scan count and latest scan date for apps that have been scanned

    Returns JSON so Claude gets a structured list it can reason about.
    """
    query = """
        SELECT
            ai.id                       AS android_info_id,
            ai.app_name,
            ai.package_name,
            ai.version,
            COUNT(s.id)                 AS scan_count,
            MAX(s.id)                   AS latest_scan_id,
            MAX(s.scan_date)            AS latest_scan_date
        FROM android_info ai
        LEFT JOIN appshark_scans s ON s.android_info_id = ai.id
        GROUP BY ai.id, ai.app_name, ai.package_name, ai.version
        ORDER BY MAX(s.scan_date) DESC NULLS LAST, ai.app_name ASC
    """

    try:
        conn = get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(query)
                rows = cur.fetchall()
        finally:
            conn.close()

        # psycopg2 RealDictCursor gives us dict rows but datetime objects
        # aren't JSON-serialisable, so we convert them to ISO strings.
        apps = []
        for row in rows:
            apps.append({
                "android_info_id": row["android_info_id"],
                "app_name":        row["app_name"],
                "package_name":    row["package_name"],
                "version":         row["version"],
                "scan_count":      row["scan_count"],
                "latest_scan_id":  row["latest_scan_id"],
                "latest_scan_date": (
                    row["latest_scan_date"].isoformat()
                    if isinstance(row["latest_scan_date"], datetime)
                    else None
                ),
            })

        logger.info("list_apps returned %d apps", len(apps))

        return [types.TextContent(
            type="text",
            text=json.dumps(apps, indent=2),
        )]

    except Exception as exc:
        logger.exception("list_apps failed")
        return [types.TextContent(
            type="text",
            text=json.dumps({"error": str(exc)}),
        )]


# ---------------------------------------------------------------------------
# get_taint_trace implementation
#
# Primary source: results.json at {SCANS_PATH}/{app_name}/results.json
#   - SecurityInfo → category → issue_name → vulners[]
#   - Each vuln has: Source[], Sink[], target[], entryMethod, position,
#     Manifest (exported + trace + intent-filters), url, hash
#
# Secondary source: detail_parser on HTML file from vuln["details"]["url"]
#   - Adds: callStack, per-method Jimple IR blocks with Source/Sink markers
#
# Enrichment source: DB appshark_vulnerabilities, joined by url
#   - Adds: component_exported/accessible/has_intent_filters (pre-computed),
#     suppressed, suppression_note
#
# No positional matching. url is the authoritative key between all three.
# ---------------------------------------------------------------------------

async def _get_taint_trace(security_issue_id: int) -> list[types.TextContent]:
    issue_query = """
        SELECT
            si.id, si.category, si.name, si.detail, si.possibility, si.wiki,
            ai.app_name, ai.package_name,
            s.id AS scan_id,
            -- APK filename from scan_tasks (strip extension → Appshark scan dir name)
            COALESCE(
                regexp_replace(st.filename, '\\.apk$', '', 'i'),
                ai.package_name
            ) AS scan_dir
        FROM appshark_security_issues si
        JOIN appshark_scans s   ON s.id  = si.appshark_scan_id
        JOIN android_info   ai  ON ai.id = s.android_info_id
        LEFT JOIN scan_tasks st ON st.guid = s.scan_task_guid
        WHERE si.id = %s
    """

    # Fetch all DB vulns for this issue — keyed by url for O(1) lookup
    db_vulns_query = """
        SELECT
            id, url,
            component_name, component_type,
            component_exported, component_accessible, component_has_intent_filters,
            suppressed, suppression_note
        FROM appshark_vulnerabilities
        WHERE security_issue_id = %s
    """

    try:
        conn = get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(issue_query, (security_issue_id,))
                issue = cur.fetchone()
                if not issue:
                    return [types.TextContent(type="text", text=json.dumps(
                        {"error": f"No security issue found with id={security_issue_id}"}
                    ))]

                cur.execute(db_vulns_query, (security_issue_id,))
                # Build url → db_row map for fast lookup
                db_vulns_by_url = {row["url"]: row for row in cur.fetchall() if row["url"]}
        finally:
            conn.close()

        # --- Load results.json (canonical Appshark output) ---
        scans_root   = os.environ.get("SCANS_PATH", "/appshark_engine/appshark/Scans")
        app_name     = issue["app_name"]
        # Appshark names the scan dir after the APK filename (without .apk extension)
        # resolved via scan_tasks.filename; falls back to package_name if no task row
        scan_dir     = issue["scan_dir"]
        results_path = os.path.join(scans_root, scan_dir, "results.json")

        if not os.path.isfile(results_path):
            return [types.TextContent(type="text", text=json.dumps(
                {"error": f"results.json not found: {results_path}"}
            ))]

        with open(results_path, "r", encoding="utf-8") as fh:
            results = json.load(fh)

        # Navigate: SecurityInfo → category_group → issue_name → vulners[]
        # results.json groups issues by category first, then by issue name.
        # We search all categories for our issue name.
        issue_name = issue["name"]
        raw_vulners = None
        security_info = results.get("SecurityInfo", {})
        for _category_group in security_info.values():
            if issue_name in _category_group:
                raw_vulners = _category_group[issue_name].get("vulners", [])
                break

        if raw_vulners is None:
            return [types.TextContent(type="text", text=json.dumps(
                {"error": f"Issue '{issue_name}' not found in results.json SecurityInfo"}
            ))]

        logger.info(
            "get_taint_trace: issue=%s vulners_in_json=%d db_vulns=%d",
            issue_name, len(raw_vulners), len(db_vulns_by_url),
        )

        # --- Build one trace per vuln from results.json ---
        traces = []
        for raw in raw_vulners:
            details = raw.get("details", {})
            url     = details.get("url", "")

            # Parse the Jimple IR + call stack from the HTML file
            parsed_html = {"callStack": [], "blocks": []}
            if url:
                html_path = url  # url is already the absolute path on the scans volume
                if os.path.isfile(html_path):
                    try:
                        with open(html_path, "r", encoding="utf-8", errors="replace") as fh:
                            parsed_html = parse_appshark_detail(fh.read())
                    except Exception as exc:
                        logger.warning("Failed to parse HTML %s: %s", html_path, exc)
                        parsed_html["error"] = str(exc)
                else:
                    logger.warning("HTML file not found: %s", html_path)
                    parsed_html["error"] = f"File not found: {html_path}"

            # Enrich with DB component/suppression data keyed by url
            db = db_vulns_by_url.get(url, {})

            # Manifest block from results.json — contains exported flag + intent-filter trace
            manifest = details.get("Manifest", {})

            # A degenerate trace is one where source == sink == target (same variable).
            # Appshark emits these when it can't resolve the actual data-flow path —
            # they are almost always false positives and should not drive exploit attempts.
            raw_source = details.get("Source", [])
            raw_sink   = details.get("Sink", [])
            raw_target = details.get("target", [])
            is_degenerate = bool(
                raw_source and raw_sink and raw_target
                and set(raw_source) == set(raw_sink) == set(raw_target)
            )

            trace = {
                "url":          url,
                "vuln_id":      db.get("id"),
                "hash":         raw.get("hash"),
                "old_hash":     raw.get("old_hash"),
                "possibility":  raw.get("possibility"),
                "entry_method": details.get("entryMethod"),
                "position":     details.get("position"),
                "degenerate":   is_degenerate,   # source == sink == target — likely FP
                # Raw taint data from results.json
                "source":       raw_source,
                "sink":         raw_sink,
                "target":       raw_target,
                # Manifest context: exported status, intent-filter trace, component decl
                "manifest": {
                    "exported":       manifest.get("exported"),
                    "entry_trace":    manifest.get("trace", []),
                    # Everything else is component declaration blocks (intent-filters etc.)
                    "component_decls": {
                        k: v for k, v in manifest.items()
                        if k not in ("exported", "trace")
                    },
                },
                # Pre-computed accessibility from DB (enriched at scan time)
                "component": {
                    "name":               db.get("component_name"),
                    "type":               db.get("component_type"),
                    "exported":           db.get("component_exported"),
                    "accessible":         db.get("component_accessible"),
                    "has_intent_filters": db.get("component_has_intent_filters"),
                },
                "suppressed":       db.get("suppressed"),
                "suppression_note": db.get("suppression_note"),
                # Jimple IR + call stack parsed from the HTML detail file
                "call_stack": parsed_html.get("callStack", []),
                "blocks":     parsed_html.get("blocks", []),
            }
            if "error" in parsed_html:
                trace["html_parse_error"] = parsed_html["error"]

            traces.append(trace)

        result = {
            "security_issue_id": security_issue_id,
            "issue_name":        issue_name,
            "category":          issue["category"],
            "detail":            issue["detail"],
            "possibility":       issue["possibility"],
            "wiki":              issue["wiki"],
            "app_name":          app_name,
            "package_name":      issue["package_name"],
            "trace_count":       len(traces),
            "traces":            traces,
        }

        return [types.TextContent(type="text", text=json.dumps(result, indent=2))]

    except Exception as exc:
        logger.exception("get_taint_trace failed for security_issue_id=%d", security_issue_id)
        return [types.TextContent(type="text", text=json.dumps({"error": str(exc)}))]


# ---------------------------------------------------------------------------
# get_source_code implementation
#
# Flow:
#   1. Load results.json for the issue's app (same as get_taint_trace)
#   2. Extract every class name from: entryMethod, Source[], Sink[], target[],
#      Manifest.trace[], and entry_trace fields across all vulners
#   3. Call backend /engine/decompile/check/{apk} — trigger JADX if not done
#   4. For each unique class, call backend /engine/decompiled/{apk}/{class}
#   5. Return source map: { "com.foo.Bar": "public class Bar { ... }" }
#
# Why via backend API:
#   JADX runs in the engine container; output lives at /tmp/decompiled/{apk}/
#   in the backend container. The AI container only has volumes for uploads
#   and scans — it cannot reach /tmp/decompiled directly. The backend REST
#   API is the clean bridge.
# ---------------------------------------------------------------------------

import re as _re

def _extract_class_names(text: str) -> set[str]:
    """Extract fully-qualified Android class names from Jimple/method signatures."""
    # Jimple sig: <com.foo.Bar: void method()>
    jimple = set(_re.findall(r'<([\w\.$]+):', text))
    # dotted class refs: com.foo.Bar (at least 2 components, starts with lowercase package)
    dotted = set(_re.findall(r'\b([a-z][\w]*(?:\.[A-Za-z][\w\$]*){1,})\b', text))
    # filter noise — must have at least one uppercase segment (class name convention)
    dotted = {c for c in dotted if any(s[0].isupper() for s in c.split('.'))}
    return jimple | dotted


def _backend_get(path: str) -> tuple[int, dict]:
    """HTTP GET to the backend service. Returns (status_code, json_body)."""
    backend = os.environ.get("BACKEND_SERVICE_URL", "http://backend:5000")
    url = f"{backend}{path}"
    try:
        headers = {}
        internal_token = os.environ.get("INTERNAL_SERVICE_TOKEN")
        if internal_token:
            headers["X-Internal-Token"] = internal_token
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read().decode())
        except Exception:
            body = {"message": str(e)}
        return e.code, body
    except Exception as exc:
        return 0, {"message": str(exc)}


async def _get_source_code(
    security_issue_id: int,
    extra_classes: list[str] | None = None,
) -> list[types.TextContent]:

    # --- Step 1: resolve issue → app → scan_dir (same logic as get_taint_trace) ---
    issue_query = """
        SELECT
            si.id, si.name, si.category,
            ai.app_name, ai.package_name,
            COALESCE(
                regexp_replace(st.filename, '\\.apk$', '', 'i'),
                ai.package_name
            ) AS scan_dir,
            st.filename AS apk_filename
        FROM appshark_security_issues si
        JOIN appshark_scans s   ON s.id  = si.appshark_scan_id
        JOIN android_info   ai  ON ai.id = s.android_info_id
        LEFT JOIN scan_tasks st ON st.guid = s.scan_task_guid
        WHERE si.id = %s
    """

    try:
        conn = get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(issue_query, (security_issue_id,))
                issue = cur.fetchone()
        finally:
            conn.close()
    except Exception as exc:
        return [types.TextContent(type="text", text=json.dumps({"error": str(exc)}))]

    if not issue:
        return [types.TextContent(type="text", text=json.dumps(
            {"error": f"No security issue found with id={security_issue_id}"}
        ))]

    apk_filename = issue["apk_filename"]
    if not apk_filename:
        return [types.TextContent(type="text", text=json.dumps(
            {"error": "No APK filename found for this scan — cannot locate decompiled source"}
        ))]

    # --- Step 2: collect all class names from results.json for this issue ---
    scans_root  = os.environ.get("SCANS_PATH", "/appshark_engine/appshark/Scans")
    scan_dir    = issue["scan_dir"]
    results_path = os.path.join(scans_root, scan_dir, "results.json")

    all_classes: set[str] = set()

    if os.path.isfile(results_path):
        try:
            with open(results_path, "r", encoding="utf-8") as fh:
                results = json.load(fh)

            issue_name = issue["name"]
            for _cat_group in results.get("SecurityInfo", {}).values():
                if issue_name not in _cat_group:
                    continue
                for raw in _cat_group[issue_name].get("vulners", []):
                    details = raw.get("details", {})
                    manifest = details.get("Manifest", {})

                    # everything in one blob for regex extraction
                    blob = json.dumps({
                        "entryMethod": details.get("entryMethod", ""),
                        "Source":      details.get("Source", []),
                        "Sink":        details.get("Sink", []),
                        "target":      details.get("target", []),
                        "trace":       manifest.get("trace", []),
                        "decls":       {k: v for k, v in manifest.items()
                                        if k not in ("exported", "trace")},
                    })
                    all_classes |= _extract_class_names(blob)
        except Exception as exc:
            logger.warning("Failed to parse results.json for source extraction: %s", exc)

    # add any manually requested classes
    for cls in (extra_classes or []):
        all_classes.add(cls.strip())

    # filter out Android framework / java stdlib classes — we want app classes only
    # Remove obvious non-app / framework classes
    SKIP_PREFIXES = (
        "android.", "java.", "javax.", "kotlin.", "dalvik.",
        "sun.", "org.apache.", "com.google.android.gms.",
    )
    app_classes = {
        c for c in all_classes
        if not any(c.startswith(p) for p in SKIP_PREFIXES)
        and "." in c  # must be fully qualified
    }

    if not app_classes:
        return [types.TextContent(type="text", text=json.dumps({
            "error": "No app class names could be extracted from the taint trace",
            "raw_extracted": list(all_classes)[:20],
        }))]

    logger.info("get_source_code: apk=%s classes=%d", apk_filename, len(app_classes))

    # --- Step 3: ensure JADX has run ---
    _, check_body = _backend_get(f"/engine/decompile/check/{apk_filename}")
    decompiled = check_body.get("decompiled", False)

    if not decompiled:
        # trigger decompilation and wait briefly — it's async via Celery
        trig_status, trig_body = _backend_get(f"/engine/decompile/{apk_filename}")
        logger.info("Triggered decompile for %s: %s %s", apk_filename, trig_status, trig_body)
        # Return immediately with a message — caller should retry after ~30s
        return [types.TextContent(type="text", text=json.dumps({
            "status": "decompilation_triggered",
            "message": f"JADX decompilation started for {apk_filename}. "
                       f"Call get_source_code again in ~30 seconds.",
            "task": trig_body,
            "classes_queued": sorted(app_classes),
        }))]

    # --- Step 4: fetch source for each class ---
    sources = {}
    errors  = {}

    for cls in sorted(app_classes):
        status, body = _backend_get(f"/engine/decompiled/{apk_filename}/{cls}")
        if status == 200 and "java_code" in body:
            sources[cls] = body["java_code"]
        else:
            errors[cls] = body.get("message", f"HTTP {status}")

    result = {
        "security_issue_id": security_issue_id,
        "issue_name":        issue["name"],
        "apk_filename":      apk_filename,
        "classes_found":     len(sources),
        "classes_missing":   len(errors),
        "sources":           sources,   # { "com.foo.Bar": "public class Bar {...}" }
        "errors":            errors,    # { "com.foo.Baz": "not found" }
    }

    return [types.TextContent(type="text", text=json.dumps(result, indent=2))]


# ---------------------------------------------------------------------------
# triage_findings implementation
#
# Threat model: 3rd-party app (or browser) attacking exported components.
#
# Scoring (additive):
#   +5  browsable deep-link (ACTION_VIEW + BROWSABLE + http/https) — no app needed
#   +4  content:// scheme on exported component — any app can trigger
#   +3  component exported=true
#   +3  setResult passthrough — caller inherits URI permissions of privileged component
#   +3  Appshark possibility == "4"
#   +2  component accessible=true (pre-computed by Leviathan)
#   +2  IntentRedirection or WebView category — sink is startActivity/loadUrl
#   +2  has intent-filters (triggerable without knowing component name)
#   +1  possibility == "3"
#   +1  Crypto / FileRisk / IPC / Provider category
#   -10 suppressed
#   - 5 already has ai_verdict (skip_reviewed)
# ---------------------------------------------------------------------------

def _extract_intent_filters(component_decls: dict) -> list[dict]:
    """Flatten all <intent-filter> blocks out of a component_decls dict."""
    filters = []
    for _comp_key, filter_list in component_decls.items():
        if isinstance(filter_list, list):
            for block in filter_list:
                if isinstance(block, dict):
                    for k, v in block.items():
                        if "intent-filter" in k:
                            filters.append({"key": k, "items": v})
    return filters


def _score_vuln(issue_name: str, category: str, possibility: str,
                manifest: dict, db_row: dict, component_decls: dict) -> tuple[int, list[str]]:
    """Return (score, list_of_reasons)."""
    score = 0
    reasons = []

    exported = manifest.get("exported", False)
    db_accessible = (db_row or {}).get("component_accessible", False)
    suppressed = (db_row or {}).get("suppressed", False)
    ai_verdict = (db_row or {}).get("ai_verdict")

    if suppressed:
        return -10, ["suppressed"]

    filters = _extract_intent_filters(component_decls)
    filter_json = json.dumps(filters)

    # --- browsable deep link ---
    # Triggerable from a browser/NFC/QR with no installed app required
    is_browsable = "BROWSABLE" in filter_json
    has_http = "scheme=http" in filter_json or "scheme=https" in filter_json
    if is_browsable or (has_http and exported):
        score += 5
        reasons.append("browsable-deep-link")

    # --- content:// scheme ---
    if "scheme=content" in filter_json and exported:
        score += 4
        reasons.append("content-scheme")

    # --- exported ---
    if exported:
        score += 3
        reasons.append("exported")

    # --- setResult passthrough (permission inheritance) ---
    issue_lower = (issue_name or "").lower()
    if "setresult" in issue_lower or "exploitablesetresult" in issue_lower:
        score += 3
        reasons.append("setresult-passthrough")

    # --- Appshark possibility ---
    try:
        poss = int(possibility or 0)
    except (ValueError, TypeError):
        poss = 0
    if poss >= 4:
        score += 3
        reasons.append("possibility-4")
    elif poss == 3:
        score += 1
        reasons.append("possibility-3")

    # --- DB accessibility ---
    if db_accessible:
        score += 2
        reasons.append("accessible")

    # --- category ---
    cat_lower = (category or "").lower()
    if cat_lower in ("intentredirection", "webview"):
        score += 2
        reasons.append(f"category-{category}")
    elif cat_lower in ("crypto", "filerisk", "ipc", "provider", "contentproviderexploit"):
        score += 1
        reasons.append(f"category-{category}")

    # --- intent-filters (no component name needed to trigger) ---
    if filters and exported:
        score += 2
        reasons.append("has-intent-filters")

    # --- ai_verdict already set ---
    if ai_verdict:
        score -= 5

    return score, reasons


async def _triage_findings(
    exported_only: bool = True,
    min_score: int = 4,
    categories: list | None = None,
    skip_reviewed: bool = True,
    limit: int = 25,
) -> list[types.TextContent]:

    scans_root = os.environ.get("SCANS_PATH", "/appshark_engine/appshark/Scans")

    # --- collect all vulns from every results.json on disk ---
    candidates = []  # list of dicts
    all_urls = []

    if not os.path.isdir(scans_root):
        return [types.TextContent(type="text", text=json.dumps(
            {"error": f"SCANS_PATH not found: {scans_root}"}
        ))]

    for scan_dir in os.listdir(scans_root):
        results_path = os.path.join(scans_root, scan_dir, "results.json")
        if not os.path.isfile(results_path):
            continue
        try:
            with open(results_path, "r", encoding="utf-8") as fh:
                results = json.load(fh)
        except Exception as exc:
            logger.warning("Failed to read %s: %s", results_path, exc)
            continue

        app_info = results.get("AppInfo", {})
        package_name = app_info.get("PackageName", scan_dir)
        app_name = app_info.get("AppName", scan_dir)

        for _cat_group_name, cat_group in results.get("SecurityInfo", {}).items():
            for issue_name, issue_data in cat_group.items():
                category = issue_data.get("category", _cat_group_name)
                possibility = issue_data.get("possibility", "0")

                # category filter (early out)
                if categories and category not in categories and issue_name not in categories:
                    continue

                for raw in issue_data.get("vulners", []):
                    details = raw.get("details", {})
                    url = details.get("url", "")
                    manifest = details.get("Manifest", {})
                    component_decls = {
                        k: v for k, v in manifest.items()
                        if k not in ("exported", "trace")
                    }
                    exported = manifest.get("exported", False)

                    if exported_only and not exported:
                        continue

                    candidates.append({
                        "scan_dir":       scan_dir,
                        "app_name":       app_name,
                        "package_name":   package_name,
                        "issue_name":     issue_name,
                        "category":       category,
                        "possibility":    possibility,
                        "entry_method":   details.get("entryMethod"),
                        "url":            url,
                        "manifest":       manifest,
                        "component_decls": component_decls,
                        "entry_trace":    manifest.get("trace", []),
                        "hash":           raw.get("hash"),
                    })
                    if url:
                        all_urls.append(url)

    if not candidates:
        return [types.TextContent(type="text", text=json.dumps(
            {"message": "No exported findings found across scanned apps", "scans_root": scans_root}
        ))]

    # --- batch DB lookup by url ---
    db_by_url = {}
    try:
        conn = get_db()
        try:
            with conn.cursor() as cur:
                # also join back to security_issue and scan for IDs Claude needs
                cur.execute("""
                    SELECT
                        av.url,
                        av.id                           AS vuln_id,
                        av.component_exported,
                        av.component_accessible,
                        av.component_name,
                        av.component_type,
                        av.suppressed,
                        av.ai_verdict,
                        av.security_issue_id,
                        asi.name                        AS db_issue_name,
                        asi.appshark_scan_id            AS scan_id,
                        ai2.id                          AS android_info_id
                    FROM appshark_vulnerabilities av
                    JOIN appshark_security_issues asi ON asi.id = av.security_issue_id
                    JOIN appshark_scans           aps ON aps.id = asi.appshark_scan_id
                    JOIN android_info             ai2 ON ai2.id = aps.android_info_id
                    WHERE av.url = ANY(%s)
                """, (all_urls,))
                for row in cur.fetchall():
                    db_by_url[row["url"]] = row
        finally:
            conn.close()
    except Exception as exc:
        logger.warning("DB lookup failed in triage_findings: %s", exc)

    # --- score every candidate ---
    scored = []
    for c in candidates:
        db = db_by_url.get(c["url"], {})

        if skip_reviewed and db.get("ai_verdict"):
            continue

        score, reasons = _score_vuln(
            c["issue_name"], c["category"], c["possibility"],
            c["manifest"], db, c["component_decls"],
        )

        if score < min_score:
            continue

        scored.append({
            "score":              score,
            "reasons":            reasons,
            "app_name":           c["app_name"],
            "package_name":       c["package_name"],
            "android_info_id":    (db.get("android_info_id")),
            "scan_id":            (db.get("scan_id")),
            "security_issue_id":  (db.get("security_issue_id")),
            "vuln_id":            (db.get("vuln_id")),
            "category":           c["category"],
            "issue_name":         c["issue_name"],
            "possibility":        c["possibility"],
            "entry_method":       c["entry_method"],
            "entry_trace":        c["entry_trace"],
            "component_name":     db.get("component_name"),
            "component_type":     db.get("component_type"),
            "exported":           c["manifest"].get("exported"),
            "accessible":         db.get("component_accessible"),
            "ai_verdict":         db.get("ai_verdict"),
            "url":                c["url"],
        })

    # rank by score descending
    scored.sort(key=lambda x: x["score"], reverse=True)
    top = scored[:limit]

    logger.info(
        "triage_findings: scanned dirs=%d candidates=%d passing=%d returned=%d",
        len(os.listdir(scans_root)), len(candidates), len(scored), len(top),
    )

    result = {
        "total_passing": len(scored),
        "returned":      len(top),
        "filters": {
            "exported_only": exported_only,
            "min_score":     min_score,
            "categories":    categories,
            "skip_reviewed": skip_reviewed,
        },
        "findings": top,
    }
    return [types.TextContent(type="text", text=json.dumps(result, indent=2))]


# ---------------------------------------------------------------------------
# validate_vulnerability implementation
#
# Writes Claude's verdict for a single vulnerability back to the database.
# This is the only write tool — all others are read-only.
# ---------------------------------------------------------------------------

VALID_VERDICTS    = {"TRUE_POSITIVE", "FALSE_POSITIVE", "NEEDS_REVIEW"}
VALID_CONFIDENCES = {"HIGH", "MEDIUM", "LOW"}


async def _validate_vulnerability(
    vuln_id: int,
    verdict: str,
    confidence: str,
    reasoning: str,
) -> list[types.TextContent]:

    update_query = """
        UPDATE appshark_vulnerabilities
        SET
            ai_verdict      = %s,
            ai_confidence   = %s,
            ai_reasoning    = %s,
            ai_reviewed_at  = NOW()
        WHERE id = %s
        RETURNING id, ai_verdict, ai_confidence, ai_reviewed_at
    """

    try:
        conn = get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(update_query, (verdict, confidence, reasoning, vuln_id))
                row = cur.fetchone()
                conn.commit()
        finally:
            conn.close()

        if not row:
            return [types.TextContent(type="text", text=json.dumps(
                {"error": f"No vulnerability found with id={vuln_id}"}
            ))]

        logger.info("validate_vulnerability: vuln_id=%d verdict=%s confidence=%s",
                    vuln_id, verdict, confidence)

        return [types.TextContent(type="text", text=json.dumps({
            "success":      True,
            "vuln_id":      row["id"],
            "verdict":      row["ai_verdict"],
            "confidence":   confidence,
            "updated_at":   row["ai_reviewed_at"].isoformat() if row["ai_reviewed_at"] else None,
        }))]

    except Exception as exc:
        logger.exception("validate_vulnerability failed for vuln_id=%d", vuln_id)
        return [types.TextContent(type="text", text=json.dumps({"error": str(exc)}))]


# ---------------------------------------------------------------------------
# bulk_validate implementation
#
# Same as validate_vulnerability but for a batch of vuln_ids in one query.
# Used to efficiently close out a whole class of false positives.
# ---------------------------------------------------------------------------

async def _bulk_validate(
    vuln_ids: list[int],
    verdict: str,
    confidence: str,
    reasoning: str,
) -> list[types.TextContent]:

    update_query = """
        UPDATE appshark_vulnerabilities
        SET
            ai_verdict     = %s,
            ai_confidence  = %s,
            ai_reasoning   = %s,
            ai_reviewed_at = NOW()
        WHERE id = ANY(%s)
        RETURNING id, ai_verdict
    """

    try:
        conn = get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(update_query, (verdict, confidence, reasoning, vuln_ids))
                updated = cur.fetchall()
                conn.commit()
        finally:
            conn.close()

        updated_ids = [r["id"] for r in updated]
        missing     = [v for v in vuln_ids if v not in updated_ids]

        logger.info("bulk_validate: requested=%d updated=%d verdict=%s",
                    len(vuln_ids), len(updated_ids), verdict)

        return [types.TextContent(type="text", text=json.dumps({
            "success":      True,
            "updated_count": len(updated_ids),
            "updated_ids":  updated_ids,
            "missing_ids":  missing,   # IDs that weren't found in DB
            "verdict":      verdict,
            "confidence":   confidence,
        }))]

    except Exception as exc:
        logger.exception("bulk_validate failed")
        return [types.TextContent(type="text", text=json.dumps({"error": str(exc)}))]


# ---------------------------------------------------------------------------
# get_manifest_context implementation
#
# Returns the full exported attack surface for an app in one call:
#   - Exported activities with their intent filters (actions, schemes, categories)
#   - Exported services
#   - Exported receivers
#   - Exported providers (with authorities and URI permission flags)
#   - Raw manifest XML
#
# Queries the android_activities/services/receivers/providers tables directly —
# these are populated by the backend at upload time.
# ---------------------------------------------------------------------------

async def _get_manifest_context(
    android_info_id: int,
    exported_only: bool = True,
) -> list[types.TextContent]:

    # Fetch app + manifest
    app_query = """
        SELECT ai.app_name, ai.package_name, ai.version, ai.manifest_xml,
               apk.debuggable,
               (apk.recon_data->'androidInfo'->>'minSdk') AS min_sdk_version,
               COALESCE(apk.recon_data->'androidInfo'->>'targetSdk', apk.sdk_version) AS target_sdk_version,
               CASE
                   -- NOTE: wildcards below are doubled on purpose. psycopg2
                   -- runs its own percent-format pass over the SQL whenever
                   -- parameters are passed, so a single literal percent sign is
                   -- read as a placeholder and execute() dies with
                   -- "IndexError: tuple index out of range" before Postgres
                   -- ever sees the query. This applies to SQL COMMENTS too --
                   -- do not write a bare percent sign anywhere in this string.
                   WHEN ai.manifest_xml ILIKE '%%usesCleartextTraffic="true"%%' THEN TRUE
                   WHEN ai.manifest_xml ILIKE '%%usesCleartextTraffic="false"%%' THEN FALSE
                   ELSE NULL
               END AS uses_cleartext_traffic
        FROM android_info ai
        LEFT JOIN apk_details apk ON apk.android_info_id = ai.id
        WHERE ai.id = %s
    """

    # android:exported is TRI-STATE, not boolean:
    #   true    -> exported
    #   false   -> not exported
    #   absent  -> exported IFF the component declares an intent-filter
    #              (implicit export; mandatory attribute only from targetSdk 31)
    #
    # The column stores NULL for "absent", which is deliberate — see
    # parse_exported_attr in the backend. Filtering on `= TRUE` therefore drops
    # implicitly-exported components silently, because in SQL `NULL = TRUE` is
    # NULL, not false. That is a false NEGATIVE in the reported attack surface,
    # so resolve the implicit case here the same way the backend's
    # is_component_accessible() does.
    #
    # Services/receivers have no intent_filters table; a row in their
    # actions/categories/schemes tables is the evidence an intent-filter existed.
    ACT_ACCESSIBLE = ("COALESCE(a.activity_exported, "
                      "EXISTS (SELECT 1 FROM activity_intent_filters af WHERE af.activity_id = a.id))")
    SVC_ACCESSIBLE = ("COALESCE(s.service_exported, "
                      "EXISTS (SELECT 1 FROM service_actions sa WHERE sa.service_id = s.id) OR "
                      "EXISTS (SELECT 1 FROM service_categories sc WHERE sc.service_id = s.id) OR "
                      "EXISTS (SELECT 1 FROM service_schemes ss WHERE ss.service_id = s.id))")
    RCV_ACCESSIBLE = ("COALESCE(r.receiver_exported, "
                      "EXISTS (SELECT 1 FROM receiver_actions ra WHERE ra.receiver_id = r.id) OR "
                      "EXISTS (SELECT 1 FROM receiver_categories rc WHERE rc.receiver_id = r.id) OR "
                      "EXISTS (SELECT 1 FROM receiver_schemes rs WHERE rs.receiver_id = r.id))")

    activities_query = f"""
        SELECT a.id, a.activity_name, a.activity_exported, a.activity_permission,
               {ACT_ACCESSIBLE} AS accessible,
               COALESCE(
                   json_agg(
                       json_build_object(
                           'action',    f.intent_action,
                           'category',  f.intent_category,
                           'scheme',    f.intent_data_scheme
                       )
                   ) FILTER (WHERE f.id IS NOT NULL),
                   '[]'
               ) AS intent_filters
        FROM android_activities a
        LEFT JOIN activity_intent_filters f ON f.activity_id = a.id
        WHERE a.android_info_id = %s
        {{exported_clause}}
        GROUP BY a.id, a.activity_name, a.activity_exported, a.activity_permission
        ORDER BY a.activity_name
    """

    services_query = f"""
        SELECT s.service_name, s.service_exported, s.service_permission,
               {SVC_ACCESSIBLE} AS accessible
        FROM android_services s
        WHERE s.android_info_id = %s
        {{exported_clause}}
        ORDER BY s.service_name
    """

    receivers_query = f"""
        SELECT r.receiver_name, r.receiver_exported, r.receiver_permission,
               {RCV_ACCESSIBLE} AS accessible
        FROM android_receivers r
        WHERE r.android_info_id = %s
        {{exported_clause}}
        ORDER BY r.receiver_name
    """

    # Providers deliberately keep the strict `= TRUE` test: their implicit
    # default is targetSdk-based (true below 17, false from 17 on), NOT
    # intent-filter based, so the accessibility heuristic above does not apply.
    providers_query = """
        SELECT provider_name, provider_exported, provider_permission,
               grant_uri_permissions, authorities,
               read_permission, write_permission
        FROM android_providers
        WHERE android_info_id = %s
        {exported_clause}
        ORDER BY provider_name
    """

    exp     = f"AND {ACT_ACCESSIBLE} = TRUE" if exported_only else ""
    svc_exp = f"AND {SVC_ACCESSIBLE} = TRUE" if exported_only else ""
    rec_exp = f"AND {RCV_ACCESSIBLE} = TRUE" if exported_only else ""
    pro_exp = "AND provider_exported = TRUE" if exported_only else ""

    try:
        conn = get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(app_query, (android_info_id,))
                app = cur.fetchone()
                if not app:
                    return [types.TextContent(type="text", text=json.dumps(
                        {"error": f"No app found with android_info_id={android_info_id}"}
                    ))]

                cur.execute(
                    activities_query.format(exported_clause=exp),
                    (android_info_id,),
                )
                activities = cur.fetchall()

                cur.execute(
                    services_query.format(exported_clause=svc_exp),
                    (android_info_id,),
                )
                services = cur.fetchall()

                cur.execute(
                    receivers_query.format(exported_clause=rec_exp),
                    (android_info_id,),
                )
                receivers = cur.fetchall()

                cur.execute(
                    providers_query.format(exported_clause=pro_exp),
                    (android_info_id,),
                )
                providers = cur.fetchall()
        finally:
            conn.close()

        def _dedup_filters(raw_filters):
            """Remove duplicate intent filter entries (same action+scheme)."""
            seen, out = set(), []
            for f in (raw_filters or []):
                key = (f.get("action"), f.get("scheme"), f.get("category"))
                if key not in seen:
                    seen.add(key)
                    out.append({k: v for k, v in f.items() if v is not None})
            return out

        result = {
            "android_info_id": android_info_id,
            "app_name":        app["app_name"],
            "package_name":    app["package_name"],
            "version":         app["version"],
            "manifest_risks": {
                "debuggable":           app["debuggable"],
                "min_sdk_version":      app["min_sdk_version"],
                "target_sdk_version":   app["target_sdk_version"],
                "uses_cleartext_traffic": app["uses_cleartext_traffic"],
            },
            "exported_only": exported_only,
            # `exported` is what the manifest literally declared (null = absent);
            # `accessible` is the resolved answer to "can a 3rd-party app reach
            # this", which is what actually matters for triage. They differ
            # exactly where the attribute was omitted and an intent-filter is
            # present — the implicit-export case.
            "activities": [
                {
                    "name":       r["activity_name"],
                    "exported":   r["activity_exported"],
                    "accessible": r["accessible"],
                    "permission": r["activity_permission"],
                    "intent_filters": _dedup_filters(r["intent_filters"]),
                }
                for r in activities
            ],
            "services": [
                {
                    "name":       r["service_name"],
                    "exported":   r["service_exported"],
                    "accessible": r["accessible"],
                    "permission": r["service_permission"],
                }
                for r in services
            ],
            "receivers": [
                {
                    "name":       r["receiver_name"],
                    "exported":   r["receiver_exported"],
                    "accessible": r["accessible"],
                    "permission": r["receiver_permission"],
                }
                for r in receivers
            ],
            "providers": [
                {
                    "name":                r["provider_name"],
                    "exported":            r["provider_exported"],
                    "permission":          r["provider_permission"],
                    "read_permission":     r["read_permission"],
                    "write_permission":    r["write_permission"],
                    "authorities":         r["authorities"],
                    "grant_uri_permissions": r["grant_uri_permissions"],
                }
                for r in providers
            ],
            "counts": {
                "activities": len(activities),
                "services":   len(services),
                "receivers":  len(receivers),
                "providers":  len(providers),
            },
            "manifest_xml": app["manifest_xml"],
        }

        logger.info(
            "get_manifest_context: android_info_id=%d activities=%d services=%d receivers=%d providers=%d",
            android_info_id, len(activities), len(services), len(receivers), len(providers),
        )

        return [types.TextContent(type="text", text=json.dumps(result, indent=2))]

    except Exception as exc:
        logger.exception("get_manifest_context failed for android_info_id=%d", android_info_id)
        return [types.TextContent(type="text", text=json.dumps({"error": str(exc)}))]


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

async def main():
    """
    Start the MCP server over stdio.
    Claude Code / Claude Desktop launches this process and communicates
    over stdin/stdout using the MCP protocol.
    """
    logger.info("Leviathan MCP server starting (stdio transport)")
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options(),
        )


if __name__ == "__main__":
    asyncio.run(main())
