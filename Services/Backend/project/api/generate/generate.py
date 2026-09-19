"""
Report Generation API

This module provides endpoints for generating comprehensive security analysis reports
from the Leviathan database, including:

Endpoints:
- POST /generate-report: Generate HTML report with full security analysis
- GET /export-json/<identifier>: Export report data as JSON
- GET /app-summary/<identifier>: Get quick summary of app analysis
- GET /vulnerability-html/<path>: Serve vulnerability documentation HTML files

The reports include:
- Component analysis (activities, services, receivers, providers)
- Security issue detection with vulnerability details
- Permission analysis
- Risk scoring
- Detailed vulnerability documentation viewer
"""

import os
import json
import socket
import tempfile
import time
import logging
import threading
import io
import asyncio
from datetime import datetime
from queue import Queue
from threading import Thread
from concurrent.futures import ThreadPoolExecutor

from flask import request, jsonify, Response, stream_with_context
from flask_restx import Namespace, Resource
from werkzeug.utils import secure_filename
from sqlalchemy.orm import joinedload
from sqlalchemy import or_, inspect, func, and_, case
from androguard.core.apk import APK
from jinja2 import Environment, FileSystemLoader, select_autoescape
from project.report_html import sanitize_report_html
from rich.console import Console
from rich import inspect as rich_inspect
import matplotlib.pyplot as plt
from weasyprint import HTML, CSS
from playwright.async_api import async_playwright

from project.api.database.services import (
    handle_db_error,
    add_android_info, add_ios_info, get_all_android_info,
    get_all_ios_info,
    add_android_activities,
    add_android_activity, add_activity_action,
    add_activity_category, add_activity_scheme, add_activity_intent_filter,
    add_android_receiver, add_receiver_action, add_receiver_category, add_receiver_scheme,
    add_android_provider, add_provider_metadata
)
from project.api.database.models import (
    AndroidInfo, AndroidActivity, AndroidService, AndroidReceiver, AndroidProvider,
    ActivityAction, ActivityCategory, ActivityScheme, ActivityIntentFilter,
    ServiceAction, ServiceCategory, ServiceScheme,
    ReceiverAction, ReceiverCategory, ApkDetails, AndroidSourceCode,
    AppsharkScan, AppsharkSecurityIssue, AppsharkVulnerability,
    db
)

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
console = Console()

logger = logging.getLogger(__name__)

generate_namespace = Namespace("generate", description="Report Generation API")
current_dir = os.path.dirname(os.path.abspath(__file__))
template_dir = os.path.join(current_dir, 'templates')
env = Environment(loader=FileSystemLoader(template_dir), autoescape=select_autoescape(["html", "xml"]))


def load_embedded_resources():
    """Load embedded JavaScript and CSS resources for offline HTML reports"""
    resources = {}

    # Load Chart.js
    chart_js_path = os.path.join(template_dir, 'chart.js')
    if os.path.exists(chart_js_path):
        with open(chart_js_path, 'r', encoding='utf-8') as f:
            resources['chart_js'] = f.read()
    else:
        logger.warning(f"Chart.js not found at {chart_js_path}")
        resources['chart_js'] = ''

    # Load Font Awesome CSS with embedded fonts
    font_css_path = os.path.join(template_dir, 'fontawesome_embedded.css')
    if os.path.exists(font_css_path):
        with open(font_css_path, 'r', encoding='utf-8') as f:
            resources['fontawesome_css'] = f.read()
    else:
        logger.warning(f"Font Awesome CSS not found at {font_css_path}")
        resources['fontawesome_css'] = ''

    return resources


def map_severity_level(model, possibility=None):
    """Map the model/possibility field to severity levels"""
    if model:
        model = str(model).lower()
        if model == "high":
            return "High"
        elif model == "middle":
            return "Medium"

    if possibility:
        possibility = str(possibility)
        if possibility == "2":
            return "High"
        elif possibility == "4":
            return "Medium"

    return "Low"


def read_vulnerability_html_content(html_path):
    """Read and return the content of a vulnerability HTML file from shared volume"""
    if not html_path:
        return None

    try:
        # Sanitize the file path to prevent directory traversal
        safe_path = os.path.normpath(html_path)

        # Ensure the path is within allowed directories
        if '..' in safe_path:
            logger.warning(f"Invalid file path with '..' detected: {html_path}")
            return None

        # If the path doesn't start with /, add it
        if not safe_path.startswith('/'):
            safe_path = '/' + safe_path

        # Check if file exists in shared volume
        if os.path.exists(safe_path) and safe_path.endswith('.html'):
            with open(safe_path, 'r', encoding='utf-8') as f:
                content = sanitize_report_html(f.read())

            # Add custom CSS to make the HTML look better when embedded
            custom_css = """
            <style>
                body {
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    padding: 20px;
                    margin: 0;
                    background: white;
                }
                h1, h2, h3 { color: #1a202c; margin-top: 1.5rem; }
                code {
                    background: #f3f4f6;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 0.9em;
                }
                pre {
                    background: #1f2937;
                    color: #f3f4f6;
                    padding: 1rem;
                    border-radius: 8px;
                    overflow-x: auto;
                }
                pre code {
                    background: transparent;
                    color: inherit;
                    padding: 0;
                }
                table {
                    border-collapse: collapse;
                    width: 100%;
                    margin: 1rem 0;
                }
                th, td {
                    border: 1px solid #e5e7eb;
                    padding: 8px 12px;
                    text-align: left;
                }
                th {
                    background: #f9fafb;
                    font-weight: 600;
                }
                .highlight {
                    background: #fef3c7;
                    padding: 2px 4px;
                    border-radius: 3px;
                }
            </style>
            """

            # Inject CSS before </head> or at the beginning if no head tag
            if '</head>' in content:
                content = content.replace('</head>', custom_css + '</head>')
            elif '<body' in content:
                # Insert before body tag
                content = content.replace('<body', custom_css + '<body', 1)
            else:
                content = custom_css + content

            logger.info(f"Successfully embedded vulnerability HTML: {safe_path}")
            return content
        else:
            logger.warning(f"Vulnerability HTML file not found: {safe_path}")
            return None

    except Exception as e:
        logger.error(f"Error reading vulnerability HTML file {html_path}: {str(e)}")
        return None


def calculate_risk_score(android_info, components_data, security_data, permissions_data):
    """Calculate overall risk score based on various factors"""
    score = 0
    max_score = 100

    # Component exposure risk (30 points max)
    if components_data['total_components'] > 0:
        exposure_ratio = components_data['exported_components'] / components_data['total_components']
        score += exposure_ratio * 30

    # Security issues risk (40 points max)
    if security_data['total_issues'] > 0:
        high_weight = security_data['high_issues'] * 3
        medium_weight = security_data['medium_issues'] * 2
        low_weight = security_data['low_issues'] * 1

        weighted_issues = high_weight + medium_weight + low_weight
        max_weighted = security_data['total_issues'] * 3

        if max_weighted > 0:
            score += (weighted_issues / max_weighted) * 40

    # Permissions risk (20 points max)
    if permissions_data['total_permissions'] > 0:
        dangerous_ratio = permissions_data['dangerous_permissions'] / permissions_data['total_permissions']
        score += dangerous_ratio * 20

    # Network exposure risk (10 points max)
    if components_data['network_exposed'] > 0:
        network_ratio = min(components_data['network_exposed'] / 10, 1)  # Cap at 10 exposed components
        score += network_ratio * 10

    return min(int(score), max_score)


def analyze_components(android_info_id):
    """Analyze all Android components (activities, services, receivers, providers)"""
    # Activities
    activities = AndroidActivity.query.filter_by(android_info_id=android_info_id).options(
        joinedload(AndroidActivity.intent_filters)
    ).all()

    # Services
    services = AndroidService.query.filter_by(android_info_id=android_info_id).options(
        joinedload(AndroidService.actions)
    ).all()

    # Receivers
    receivers = AndroidReceiver.query.filter_by(android_info_id=android_info_id).options(
        joinedload(AndroidReceiver.actions)
    ).all()

    # Providers
    providers = AndroidProvider.query.filter_by(android_info_id=android_info_id).all()

    # Calculate statistics
    total_components = len(activities) + len(services) + len(receivers) + len(providers)
    exported_components = (
            sum(1 for a in activities if a.activity_exported) +
            sum(1 for s in services if s.service_exported) +
            sum(1 for r in receivers if r.receiver_exported) +
            sum(1 for p in providers if p.provider_exported)
    )

    # Check for network-related intent filters
    network_exposed = 0
    for activity in activities:
        if activity.activity_exported and activity.intent_filters:
            for filter in activity.intent_filters:
                if filter.intent_data_scheme in ['http', 'https']:
                    network_exposed += 1
                    break

    return {
        'activities': activities,
        'services': services,
        'receivers': receivers,
        'providers': providers,
        'total_components': total_components,
        'exported_components': exported_components,
        'network_exposed': network_exposed,
        'component_breakdown': {
            'activities': {
                'total': len(activities),
                'exported': sum(1 for a in activities if a.activity_exported)
            },
            'services': {
                'total': len(services),
                'exported': sum(1 for s in services if s.service_exported)
            },
            'receivers': {
                'total': len(receivers),
                'exported': sum(1 for r in receivers if r.receiver_exported)
            },
            'providers': {
                'total': len(providers),
                'exported': sum(1 for p in providers if p.provider_exported)
            }
        }
    }


def analyze_security_data(android_info_id, embed_html=False):
    """
    Analyze security issues from AppShark scans

    Args:
        android_info_id: The Android app ID
        embed_html: Whether to embed vulnerability HTML content (default: False for performance)
    """
    # Get latest scan
    latest_scan = AppsharkScan.query.filter_by(
        android_info_id=android_info_id
    ).order_by(AppsharkScan.scan_date.desc()).first()

    if not latest_scan:
        return {
            'issues': [],
            'total_issues': 0,
            'high_issues': 0,
            'medium_issues': 0,
            'low_issues': 0,
            'categories': {},
            'scan_date': None,
            'total_vulnerabilities': 0
        }

    # Get all security issues for this scan with vulnerabilities
    issues = AppsharkSecurityIssue.query.filter_by(
        appshark_scan_id=latest_scan.id
    ).options(
        joinedload(AppsharkSecurityIssue.vulnerabilities)
    ).all()

    # Categorize issues
    high_issues = []
    medium_issues = []
    low_issues = []
    categories = {}

    for issue in issues:
        severity = map_severity_level(issue.model, issue.possibility)
        category = issue.category or 'Uncategorized'

        categories[category] = categories.get(category, 0) + 1

        # Process vulnerabilities and extract HTML paths
        vulnerabilities = []
        for vuln in issue.vulnerabilities:
            # Extract HTML file path from source array
            html_file = None
            if vuln.source:
                for source in vuln.source:
                    if isinstance(source, str) and '.html' in source:
                        # Extract just the path part if it contains additional info
                        if ' ' in source:
                            # Handle cases like "$r1 = virtualinvoke $r0.<android.content.Intent: /path/to/file.html"
                            parts = source.split(' ')
                            for part in parts:
                                if '.html' in part:
                                    html_file = part
                                    break
                        else:
                            html_file = source
                        break

            # Also check URL field for HTML files
            url_html = None
            if vuln.url and isinstance(vuln.url, str) and '.html' in vuln.url:
                url_html = vuln.url

            # Only embed HTML content if explicitly requested and for small reports
            final_html_file = html_file or url_html
            html_content = None
            if embed_html and final_html_file:
                html_content = read_vulnerability_html_content(final_html_file)

            vulnerabilities.append({
                'id': vuln.id,
                'entry_method': vuln.entry_method,
                'source': vuln.source,
                'sink': vuln.sink,
                'target': vuln.target,
                'position': vuln.position,
                'url': vuln.url,
                'html_file': final_html_file,
                'html_content': html_content,
                'ai_verdict': vuln.ai_verdict,
                'ai_confidence': vuln.ai_confidence,
                'ai_reasoning': vuln.ai_reasoning,
                'component_type': vuln.component_type,
                'component_exported': vuln.component_exported,
                'component_accessible': vuln.component_accessible,
                'component_has_intent_filters': vuln.component_has_intent_filters,
                'hash': vuln.hash,
                'old_hash': vuln.old_hash,
                'suppressed': vuln.suppressed,
                'suppression_note': vuln.suppression_note,
                'possibility': vuln.possibility
            })

        issue_data = {
            'id': issue.id,
            'name': issue.name,
            'detail': issue.detail,
            'category': category,
            'severity': severity,
            'model': issue.model,
            'possibility': issue.possibility,
            'wiki': issue.wiki,
            'vulnerabilities': vulnerabilities,
            'vulnerability_count': len(vulnerabilities)
        }

        if severity == 'High':
            high_issues.append(issue_data)
        elif severity == 'Medium':
            medium_issues.append(issue_data)
        else:
            low_issues.append(issue_data)

    # Sort each severity group by vulnerability count (descending)
    high_issues.sort(key=lambda x: x['vulnerability_count'], reverse=True)
    medium_issues.sort(key=lambda x: x['vulnerability_count'], reverse=True)
    low_issues.sort(key=lambda x: x['vulnerability_count'], reverse=True)

    # Calculate total vulnerabilities across all issues
    total_vulnerabilities = sum(issue['vulnerability_count'] for issue in (high_issues + medium_issues + low_issues))

    return {
        'issues': high_issues + medium_issues + low_issues,  # Sorted by severity and count
        'total_issues': len(issues),
        'total_vulnerabilities': total_vulnerabilities,
        'high_issues': len(high_issues),
        'medium_issues': len(medium_issues),
        'low_issues': len(low_issues),
        'categories': categories,
        'scan_date': latest_scan.scan_date
    }


def analyze_permissions(android_info_id):
    """Analyze app permissions from manifest risks"""
    # Get latest scan for manifest data
    latest_scan = AppsharkScan.query.filter_by(
        android_info_id=android_info_id
    ).order_by(AppsharkScan.scan_date.desc()).first()

    if not latest_scan or not latest_scan.manifest_risks:
        return {
            'total_permissions': 0,
            'dangerous_permissions': 0,
            'normal_permissions': 0,
            'permissions_list': []
        }

    manifest_risks = latest_scan.manifest_risks
    permissions = manifest_risks.get('permissions', [])

    dangerous_perms = []
    normal_perms = []

    # Common dangerous permissions
    dangerous_permission_keywords = [
        'CAMERA', 'LOCATION', 'MICROPHONE', 'CONTACTS', 'CALENDAR',
        'CALL_LOG', 'PHONE', 'SMS', 'STORAGE', 'SENSORS'
    ]

    for perm in permissions:
        is_dangerous = any(keyword in perm.upper() for keyword in dangerous_permission_keywords)
        if is_dangerous:
            dangerous_perms.append(perm)
        else:
            normal_perms.append(perm)

    return {
        'total_permissions': len(permissions),
        'dangerous_permissions': len(dangerous_perms),
        'normal_permissions': len(normal_perms),
        'permissions_list': permissions,
        'dangerous_list': dangerous_perms
    }


def get_apk_details(android_info_id):
    """Get APK details"""
    apk_details = ApkDetails.query.filter_by(
        android_info_id=android_info_id
    ).first()

    if apk_details:
        return {
            'package_name': apk_details.package_name,
            'version': apk_details.app_version,
            'sdk_version': apk_details.sdk_version,
            'debuggable': apk_details.debuggable,
            'main_activity': apk_details.main_activity
        }
    return None


def format_activity_data(activity):
    """Format activity data for display"""
    filters = []
    if activity.intent_filters:
        for filter in activity.intent_filters:
            filter_parts = []
            if filter.intent_action:
                filter_parts.append(f"Action: {filter.intent_action}")
            if filter.intent_category:
                filter_parts.append(f"Category: {filter.intent_category}")
            if filter.intent_data_scheme:
                filter_parts.append(f"Scheme: {filter.intent_data_scheme}")
            if filter_parts:
                filters.append("\n".join(filter_parts))

    # Categorize by package structure
    name_parts = activity.activity_name.split('.')
    category = name_parts[-2] if len(name_parts) > 2 else 'Other'

    return {
        'name': activity.activity_name,
        'exported': activity.activity_exported,
        'permission': activity.activity_permission,
        'intent_filters': "\n\n".join(filters) if filters else "No intent filters",
        'category': category,
        'has_filters': len(filters) > 0
    }


def format_security_issue_from_scan(issue, embed_html=False, android_info=None):
    """
    Format security issue from scan results to match template expectations

    Args:
        issue: Issue data from scan results
        embed_html: Whether to embed vulnerability HTML content (default: False)
        android_info: Resolved AndroidInfo, used to derive component reachability
            (exported / accessible / intent-filters) from the real manifest when
            the POSTed scan results don't already carry it. Without this, every
            finding would render "unreachable" with no exported badge regardless
            of the truth — which is misleading for surface mapping.
    """
    # Map model/possibility to severity
    severity = map_severity_level(issue.get('model'), issue.get('possibility'))

    # Lazy import to avoid import cycles with the tasks/celery module.
    try:
        from project.api.tasks.tasks import (
            extract_class_from_entry_method, lookup_component_info
        )
    except Exception:  # pragma: no cover - defensive
        extract_class_from_entry_method = None
        lookup_component_info = None

    # Process vulnerabilities if they exist
    vulnerabilities = []
    if 'vulnerabilities' in issue:
        for vuln in issue['vulnerabilities']:
            # Extract HTML file path from source array
            html_file = None
            if vuln.get('source'):
                for source in vuln['source']:
                    if isinstance(source, str) and '.html' in source:
                        # Extract just the path part if it contains additional info
                        if ' ' in source:
                            # Handle cases like "$r1 = virtualinvoke $r0.<android.content.Intent: /path/to/file.html"
                            parts = source.split(' ')
                            for part in parts:
                                if '.html' in part:
                                    html_file = part
                                    break
                        else:
                            html_file = source
                        break

            # Also check URL field for HTML files
            url_html = None
            if vuln.get('url') and isinstance(vuln.get('url'), str) and '.html' in vuln.get('url'):
                url_html = vuln.get('url')

            # Only embed HTML content if explicitly requested
            final_html_file = html_file or url_html
            html_content = None
            if embed_html and final_html_file:
                html_content = read_vulnerability_html_content(final_html_file)

            # Component reachability: prefer values already on the scan result;
            # otherwise derive from the resolved app's real manifest so the
            # exported / accessible / intent-filter badges reflect the truth.
            comp_type = vuln.get('component_type')
            comp_exported = vuln.get('component_exported')
            comp_accessible = vuln.get('component_accessible')
            comp_filters = vuln.get('component_has_intent_filters')
            if (comp_exported is None and android_info is not None
                    and extract_class_from_entry_method and lookup_component_info):
                class_name = extract_class_from_entry_method(vuln.get('entry_method'))
                info = lookup_component_info(android_info, class_name) if class_name else None
                if info:
                    comp_type = info.get('component_type')
                    comp_exported = info.get('component_exported')
                    comp_accessible = info.get('component_accessible')
                    comp_filters = info.get('component_has_intent_filters')

            vulnerabilities.append({
                'entry_method': vuln.get('entry_method', ''),
                'source': vuln.get('source', []),
                'sink': vuln.get('sink', []),
                'target': vuln.get('target', []),
                'position': vuln.get('position', ''),
                'url': vuln.get('url', ''),
                'html_file': final_html_file,
                'html_content': html_content,
                'ai_verdict': vuln.get('ai_verdict'),
                'ai_confidence': vuln.get('ai_confidence'),
                'ai_reasoning': vuln.get('ai_reasoning'),
                'component_type': comp_type,
                'component_exported': comp_exported,
                'component_accessible': comp_accessible,
                'component_has_intent_filters': comp_filters,
                'hash': vuln.get('hash'),
                'old_hash': vuln.get('old_hash'),
                'suppressed': vuln.get('suppressed'),
                'suppression_note': vuln.get('suppression_note'),
                'possibility': vuln.get('possibility', '')
            })

    return {
        'name': issue.get('name', 'Unknown Issue'),
        'detail': issue.get('detail', ''),
        'category': issue.get('category', 'Uncategorized'),
        'severity': severity,
        'model': issue.get('model'),
        'possibility': issue.get('possibility'),
        'wiki': issue.get('wiki', ''),
        'vulnerabilities': vulnerabilities,
        'vulnerability_count': len(vulnerabilities)
    }


def prepare_comprehensive_template_data(android_info, request_data):
    """Prepare comprehensive data for the template"""
    # Get basic info
    apk_details = get_apk_details(android_info.id)

    # Analyze components
    components_data = analyze_components(android_info.id)

    # First, check how many vulnerabilities exist
    security_data_preview = analyze_security_data(android_info.id, embed_html=False)
    total_vulns = security_data_preview.get('total_vulnerabilities', 0)

    # Only embed HTML for small reports to prevent browser freeze
    # Threshold: 200 vulnerabilities (roughly 2-10MB of embedded HTML)
    EMBED_HTML_THRESHOLD = 200
    should_embed = total_vulns <= EMBED_HTML_THRESHOLD

    logger.info(f"Report has {total_vulns} vulnerabilities. Embedding HTML: {should_embed}")

    # Analyze security with appropriate embedding strategy
    security_data = analyze_security_data(android_info.id, embed_html=True)

    # Analyze permissions
    permissions_data = analyze_permissions(android_info.id)

    # Calculate risk score
    risk_score = calculate_risk_score(
        android_info, components_data, security_data, permissions_data
    )

    # Format activities for display
    activities_data = [format_activity_data(a) for a in components_data['activities']]
    # Surface the security-relevant components first so they're never buried past
    # the template's display limit: exported-with-filters (most reachable) ->
    # exported -> has-filters -> the rest, then alphabetical for stability.
    activities_data.sort(key=lambda a: (
        not (a['exported'] and a['has_filters']),
        not a['exported'],
        not a['has_filters'],
        a['name'] or '',
    ))

    # Activity categories breakdown
    activity_categories = {}
    for activity in activities_data:
        category = activity['category']
        activity_categories[category] = activity_categories.get(category, 0) + 1

    # Get scan results if available
    scan_results = request_data.get('scanResults', {})

    # Security - use from scan results if provided, otherwise from DB
    if request_data.get('includeSecurityIssues'):
        if 'security_issues' in scan_results:
            # Format security issues from scan results with appropriate embedding
            formatted_issues = []
            for issue in scan_results['security_issues']:
                formatted_issues.append(format_security_issue_from_scan(issue, embed_html=True, android_info=android_info))

            # Sort by severity and vulnerability count
            high_issues = [i for i in formatted_issues if i['severity'] == 'High']
            medium_issues = [i for i in formatted_issues if i['severity'] == 'Medium']
            low_issues = [i for i in formatted_issues if i['severity'] == 'Low']

            high_issues.sort(key=lambda x: x['vulnerability_count'], reverse=True)
            medium_issues.sort(key=lambda x: x['vulnerability_count'], reverse=True)
            low_issues.sort(key=lambda x: x['vulnerability_count'], reverse=True)

            security_issues = high_issues + medium_issues + low_issues
            security_stats = {
                'high': len(high_issues),
                'medium': len(medium_issues),
                'low': len(low_issues),
                'total': len(formatted_issues)
            }
        else:
            # Use data from database
            security_issues = security_data['issues']
            security_stats = {
                'high': security_data['high_issues'],
                'medium': security_data['medium_issues'],
                'low': security_data['low_issues'],
                'total': security_data['total_issues']
            }
    else:
        security_issues = None
        security_stats = None

    return {
        # Basic info
        'manifest_xml': android_info.manifest_xml,
        'app_name': android_info.app_name,
        'package_name': android_info.package_name,
        'version': android_info.version,
        'generated_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),

        # APK Details - merge with scan results if available
        'app_info': {
            **(apk_details or {}),
            **(scan_results.get('app_info', {}) if request_data.get('includeAppInfo') else {})
        } if apk_details or request_data.get('includeAppInfo') else None,

        # Risk Assessment
        'risk_score': risk_score,
        'risk_level': 'High' if risk_score >= 70 else 'Medium' if risk_score >= 40 else 'Low',

        # Components
        'activities': activities_data,
        'services': components_data['services'],
        'receivers': components_data['receivers'],
        'providers': components_data['providers'],
        'total_activities': len(activities_data),
        'exported_activities': sum(1 for a in activities_data if a['exported']),
        'non_exported_activities': sum(1 for a in activities_data if not a['exported']),
        'total_intent_filters': sum(1 for a in activities_data if a['has_filters']),
        'exposed_intent_filters': sum(1 for a in activities_data if a['exported'] and a['has_filters']),
        'activity_categories': activity_categories,

        # Component statistics
        'component_stats': components_data['component_breakdown'],
        'total_components': components_data['total_components'],
        'exported_components': components_data['exported_components'],

        # Security
        'security_issues': security_issues,
        'security_stats': security_stats,
        'security_categories': security_data['categories'],

        # Permissions - merge scan results with DB data
        'permissions_data': {
            **permissions_data,
            **(scan_results.get('manifest_risks', {}) if request_data.get('includeManifestRisks') else {})
        } if request_data.get('includeManifestRisks') or permissions_data['total_permissions'] > 0 else None,

        # Export patterns
        'export_patterns': {
            'exported_with_filters': sum(1 for a in activities_data if a['exported'] and a['has_filters']),
            'exported_without_filters': sum(1 for a in activities_data if a['exported'] and not a['has_filters']),
            'protected_with_filters': sum(1 for a in activities_data if not a['exported'] and a['has_filters']),
            'protected_without_filters': sum(1 for a in activities_data if not a['exported'] and not a['has_filters'])
        }
    }


def _resolve_apk_package(identifier):
    """Read the real package name from the uploaded APK, if the file is present.

    The frontend posts the uploaded *filename* (e.g.
    "app-jobsdb-production-release.apk"), which has no reliable relationship to
    the app/package name. The APK itself is the authoritative source of truth,
    so we prefer it whenever the file still exists in the uploads volume.
    Returns the package string, or None.
    """
    base = identifier[:-4] if identifier.lower().endswith('.apk') else identifier
    candidates = [
        os.path.join(UPLOAD_FOLDER, secure_filename(identifier)),
        os.path.join(UPLOAD_FOLDER, secure_filename(base + '.apk')),
        os.path.join(UPLOAD_FOLDER, secure_filename(base)),
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                pkg = APK(path).get_package()
                if pkg:
                    logger.info("Report: APK %s -> package %r", path, pkg)
                    return pkg
            except Exception as e:
                logger.warning("Report: failed to parse APK %s: %s", path, e)
    return None


def find_android_info(identifier):
    """Resolve the AndroidInfo record for the report — STRICT, no fuzzy guessing.

    Surface mapping must never silently bind to the wrong app: a fuzzy match can
    turn one app's components into another app's "findings" (false positives) or
    hide real ones (false negatives). So this resolver only ever returns a record
    via an EXACT, authoritative key, in priority order:

      1. The uploaded APK's real package name (parsed from the file) -> exact
         ``package_name`` match. This is the source of truth.
      2. The identifier as an exact ``package_name``.
      3. The identifier as an exact ``app_name``.

    There is intentionally NO ``ILIKE '%token%'`` / ``split('-')[0]`` fallback
    (that is what previously mis-resolved "app-jobsdb-...apk" -> "app" ->
    com.example.leviathanvulnapp). If nothing matches exactly we return None and
    the endpoint reports "not found" rather than rendering a wrong-app report.

    NOTE: deliberately does NOT delegate to ``audit.find_android_info`` because
    that resolver ends in a greedy partial-package match, which is unsafe at the
    scale of many uploaded apps.
    """
    base = identifier[:-4] if identifier.lower().endswith('.apk') else identifier
    matched_by = None
    android_info = None

    # 1) Authoritative: real package from the uploaded APK file.
    pkg = _resolve_apk_package(identifier)
    if pkg:
        android_info = AndroidInfo.query.filter(
            AndroidInfo.package_name == pkg
        ).order_by(AndroidInfo.id.desc()).first()
        if android_info:
            matched_by = f"apk-package={pkg!r}"

    # 2) Exact package_name == identifier (handles callers that send the package).
    if android_info is None:
        android_info = AndroidInfo.query.filter(
            AndroidInfo.package_name == base
        ).order_by(AndroidInfo.id.desc()).first()
        if android_info:
            matched_by = "exact-package"

    # 3) Exact app_name == identifier (handles callers that send the app name).
    if android_info is None:
        android_info = AndroidInfo.query.filter(
            AndroidInfo.app_name == base
        ).order_by(AndroidInfo.id.desc()).first()
        if android_info:
            matched_by = "exact-app-name"

    if android_info:
        act = len(android_info.activities or [])
        svc = len(android_info.services or [])
        rcv = len(android_info.receivers or [])
        prv = len(android_info.providers or [])
        exp = sum(1 for a in (android_info.activities or []) if a.activity_exported)
        logger.info(
            "Report resolved identifier %r via %s -> AndroidInfo id=%s app_name=%r "
            "package=%r version=%r [activities=%d (exported=%d) services=%d receivers=%d providers=%d]",
            identifier, matched_by, android_info.id, android_info.app_name,
            android_info.package_name, android_info.version, act, exp, svc, rcv, prv,
        )
    else:
        logger.warning(
            "Report: NO exact AndroidInfo match for identifier %r (refusing fuzzy "
            "fallback to avoid binding to the wrong app)", identifier
        )

    return android_info


@generate_namespace.route("/generate-report")
class GenerateReport(Resource):
    def post(self):
        """Generate comprehensive HTML report with full database integration"""
        try:
            data = request.json
            print(f"Generating report with data: {data}")
            identifier = data['application']
            custom_filename = data.get('customFileName', 'report')

            logger.info(f"Generating HTML report for {identifier}")

            # Find application info
            android_info = find_android_info(identifier)
            if not android_info:
                return {'message': f'Application not found: {identifier}'}, 404

            # Prepare comprehensive report data
            request_data = data.copy()
            # Set defaults if not provided
            request_data.setdefault('includeSecurityIssues', True)
            request_data.setdefault('includeManifestRisks', True)
            request_data.setdefault('includeAppInfo', True)

            template_data = prepare_comprehensive_template_data(android_info, request_data)

            # Load embedded resources for offline use
            embedded_resources = load_embedded_resources()
            template_data.update(embedded_resources)

            # Generate HTML report
            template = env.get_template('downloadable_report.html')
            html_content = template.render(**template_data)

            # Create response
            response = Response(html_content)
            response.headers['Content-Type'] = 'text/html'
            response.headers['Content-Disposition'] = f'attachment; filename="{custom_filename}.html"'

            return response

        except Exception as e:
            logger.error(f"Error generating report: {str(e)}", exc_info=True)
            return {'message': f'Error generating report: {str(e)}'}, 500


@generate_namespace.route("/export-json/<string:identifier>")
class ExportJSON(Resource):
    def get(self, identifier):
        """Export report data as JSON"""
        try:
            android_info = find_android_info(identifier)
            if not android_info:
                return {'message': f'Application not found: {identifier}'}, 404

            # Get comprehensive data
            template_data = prepare_comprehensive_template_data(android_info, {
                'includeSecurityIssues': True,
                'includeManifestRisks': True
            })

            # Remove non-serializable data
            json_data = json.dumps(template_data, indent=2, default=str)

            response = Response(json_data)
            response.headers['Content-Type'] = 'application/json'
            response.headers['Content-Disposition'] = f'attachment; filename="{android_info.app_name}_report.json"'

            return response

        except Exception as e:
            logger.error(f"Error exporting JSON: {str(e)}", exc_info=True)
            return {'message': f'Error exporting JSON: {str(e)}'}, 500


@generate_namespace.route("/app-summary/<string:identifier>")
class AppSummary(Resource):
    def get(self, identifier):
        """Get quick summary of app analysis"""
        try:
            android_info = find_android_info(identifier)
            if not android_info:
                return {'message': f'Application not found: {identifier}'}, 404

            # Get summary data
            components = analyze_components(android_info.id)
            security = analyze_security_data(android_info.id)
            permissions = analyze_permissions(android_info.id)

            summary = {
                'app_name': android_info.app_name,
                'package_name': android_info.package_name,
                'version': android_info.version,
                'risk_score': calculate_risk_score(android_info, components, security, permissions),
                'components': {
                    'total': components['total_components'],
                    'exported': components['exported_components']
                },
                'security': {
                    'total_issues': security['total_issues'],
                    'high': security['high_issues'],
                    'medium': security['medium_issues'],
                    'low': security['low_issues']
                },
                'permissions': {
                    'total': permissions['total_permissions'],
                    'dangerous': permissions['dangerous_permissions']
                }
            }

            return jsonify(summary)

        except Exception as e:
            logger.error(f"Error getting app summary: {str(e)}", exc_info=True)
            return {'message': f'Error getting summary: {str(e)}'}, 500


@generate_namespace.route("/vulnerability-html/<path:file_path>")
class VulnerabilityHTML(Resource):
    def get(self, file_path):
        """Serve vulnerability HTML files"""
        try:
            # Sanitize the file path to prevent directory traversal
            safe_path = os.path.normpath(file_path)

            # Ensure the path is within allowed directories
            if '..' in safe_path:
                return {'message': 'Invalid file path'}, 400

            # If the path doesn't start with /, add it
            if not safe_path.startswith('/'):
                safe_path = '/' + safe_path

            # Check if file exists
            if os.path.exists(safe_path) and safe_path.endswith('.html'):
                try:
                    with open(safe_path, 'r', encoding='utf-8') as f:
                        content = sanitize_report_html(f.read())

                    # Inject custom CSS to make the HTML look better in the modal
                    custom_css = """
                    <style>
                        body {
                            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            padding: 20px;
                            margin: 0;
                            background: white;
                        }
                        h1, h2, h3 { color: #1a202c; margin-top: 1.5rem; }
                        code {
                            background: #f3f4f6;
                            padding: 2px 6px;
                            border-radius: 4px;
                            font-size: 0.9em;
                        }
                        pre {
                            background: #1f2937;
                            color: #f3f4f6;
                            padding: 1rem;
                            border-radius: 8px;
                            overflow-x: auto;
                        }
                        pre code {
                            background: transparent;
                            color: inherit;
                            padding: 0;
                        }
                        table {
                            border-collapse: collapse;
                            width: 100%;
                            margin: 1rem 0;
                        }
                        th, td {
                            border: 1px solid #e5e7eb;
                            padding: 8px 12px;
                            text-align: left;
                        }
                        th {
                            background: #f9fafb;
                            font-weight: 600;
                        }
                        .highlight {
                            background: #fef3c7;
                            padding: 2px 4px;
                            border-radius: 3px;
                        }
                    </style>
                    """

                    # Inject CSS before </head> or at the beginning if no head tag
                    if '</head>' in content:
                        content = content.replace('</head>', custom_css + '</head>')
                    else:
                        content = custom_css + content

                    response = Response(content)
                    response.headers['Content-Type'] = 'text/html; charset=utf-8'
                    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
                    return response
                except Exception as e:
                    logger.error(f"Error reading file: {str(e)}")
                    return {'message': 'Error reading file'}, 500
            else:
                return {'message': 'Vulnerability documentation not found'}, 404

        except Exception as e:
            logger.error(f"Error serving vulnerability HTML: {str(e)}", exc_info=True)
            return {'message': f'Error: {str(e)}'}, 500


# Register the resources
generate_namespace.add_resource(GenerateReport, "/generate-report")
generate_namespace.add_resource(ExportJSON, "/export-json/<string:identifier>")
generate_namespace.add_resource(AppSummary, "/app-summary/<string:identifier>")
generate_namespace.add_resource(VulnerabilityHTML, "/vulnerability-html/<path:file_path>")