"""Scan result + vulnerability read/CRUD endpoints."""

from project.api.engine._shared import (
    json, request, jsonify, Resource, logger, joinedload, db, engine_namespace, engine_service, save_scan_results, find_android_info, parse_appshark_detail, AndroidInfo, AppsharkScan, AppsharkSecurityIssue, AppsharkVulnerability, ScanTask,
)
from sqlalchemy.orm import selectinload


@engine_namespace.route('/vulnerability-details/<string:app_name>/<path:vulnerability_id>')
class VulnerabilityDetails(Resource):
    def get(self, app_name, vulnerability_id):
        try:
            file_path = engine_service.get_vulnerability_details_path(app_name, vulnerability_id)

            if not engine_service.file_exists(file_path):
                return {"error": "Vulnerability details file not found"}, 404

            html = engine_service.get_file_content(file_path)
            parsed = parse_appshark_detail(html)
            return parsed
        except Exception as e:
            logger.exception(f"Error fetching vulnerability details: {str(e)}")
            return {"error": str(e)}, 500


@engine_namespace.route('/vulnerability/<int:vuln_id>/suppress')
class VulnerabilitySuppress(Resource):
    def patch(self, vuln_id):
        try:
            data = request.get_json() or {}
            suppressed = data.get('suppressed', True)
            note = data.get('note', '')

            vuln = AppsharkVulnerability.query.get(vuln_id)
            if not vuln:
                return {'error': 'Vulnerability not found'}, 404

            vuln.suppressed = bool(suppressed)
            vuln.suppression_note = str(note) if note else None
            db.session.commit()

            return {'id': vuln_id, 'suppressed': vuln.suppressed, 'suppression_note': vuln.suppression_note}, 200
        except Exception as e:
            logger.exception(f"Error updating suppression for vulnerability {vuln_id}: {e}")
            return {'error': str(e)}, 500


@engine_namespace.route('/scan/results/<string:app_identifier>')
class EngineScanResults(Resource):
    def get(self, app_identifier):
        try:
            # Remove .apk extension if present
            app_name = app_identifier.replace('.apk', '')

            # Try to find the AndroidInfo record - multiple strategies
            android_app = AndroidInfo.query.filter(
                (AndroidInfo.app_name == app_name) |
                (AndroidInfo.app_name == f"{app_name}.apk") |
                (AndroidInfo.package_name == app_name)
            ).order_by(AndroidInfo.id.desc()).first()

            # If not found, try partial match on package_name (e.g., com.android.settings_clean -> com.android.settings)
            if not android_app:
                # Extract base package name (remove _clean, _modified, etc. suffixes)
                base_name = app_name.rsplit('_', 1)[0] if '_' in app_name else app_name
                android_app = AndroidInfo.query.filter(
                    (AndroidInfo.package_name == base_name) |
                    (AndroidInfo.package_name.ilike(f'%{base_name}%')) |
                    (AndroidInfo.app_name.ilike(f'%{base_name.split(".")[-1]}%'))
                ).order_by(AndroidInfo.id.desc()).first()

            # Strategy 3: Find via ScanTask.filename -> AppsharkScan.scan_task_guid -> AndroidInfo
            # This handles the common case where the frontend sends the APK filename (e.g. "app-release.apk")
            # but the DB stores the app's display name (e.g. "MyApp") as app_name.
            if not android_app:
                scan_task_match = ScanTask.query.filter(
                    (ScanTask.filename == app_identifier) |
                    (ScanTask.filename == f"{app_name}.apk")
                ).order_by(ScanTask.id.desc()).first()

                if scan_task_match:
                    scan_via_task = AppsharkScan.query.filter_by(
                        scan_task_guid=scan_task_match.guid
                    ).first()
                    if scan_via_task:
                        android_app = AndroidInfo.query.get(scan_via_task.android_info_id)
                        logger.info(f"Found AndroidInfo (id={android_app.id if android_app else None}) via ScanTask guid={scan_task_match.guid} for filename={app_identifier}")

            # Strategy 4: APK analysis fallback — open the APK to read its package name, same as audit.py
            if not android_app:
                try:
                    android_app = find_android_info(app_identifier)
                    if android_app:
                        logger.info(f"Found AndroidInfo (id={android_app.id}) via APK analysis for filename={app_identifier}")
                except Exception as e:
                    logger.warning(f"APK analysis fallback failed for {app_identifier}: {e}")

            print("Android App: ", android_app)

            if not android_app:
                # Fallback: read results.json directly from the engine output folder.
                # This supports flows where the UI keys by uploaded filename (e.g. app-debug.apk)
                # but the DB stores package/app metadata instead.
                parsed = engine_service.parse_scan_results(app_name)
                if parsed:
                    return jsonify(parsed)
                return {"error": f"App not found: {app_identifier}"}, 404

            # Get the latest scan for this app
            latest_scan = AppsharkScan.query.filter_by(android_info_id=android_app.id).order_by(
                AppsharkScan.scan_date.desc()).first()

            print("Latest scan: ", latest_scan)
            if not latest_scan:
                # results.json may exist on disk but was never saved (e.g. backend crashed post-scan)
                app_name_clean = app_identifier.replace('.apk', '')
                parsed = engine_service.parse_scan_results(app_name_clean)
                if parsed:
                    logger.info(f"results.json found on disk for {app_identifier}, saving to DB")
                    from project.api.tasks.tasks import save_scan_results
                    # Find the most recent FINISHED ScanTask for this file to link the guid
                    scan_task = ScanTask.query.filter_by(filename=android_app.app_name + '.apk').order_by(ScanTask.id.desc()).first() \
                        or ScanTask.query.filter_by(filename=android_app.app_name).order_by(ScanTask.id.desc()).first()
                    save_scan_results(android_app.app_name, parsed, scan_task.guid if scan_task else None)
                    # Re-fetch the scan we just saved
                    latest_scan = AppsharkScan.query.filter_by(android_info_id=android_app.id).order_by(
                        AppsharkScan.scan_date.desc()).first()
                if not latest_scan:
                    return {'message': f'No scan results found for this app: {app_identifier}'}, 404

            security_issues = AppsharkSecurityIssue.query.filter_by(appshark_scan_id=latest_scan.id).options(
                joinedload(AppsharkSecurityIssue.vulnerabilities)).all()

            # Format the results
            results = {
                'app_info': {
                    **latest_scan.app_info,
                    'app_name': android_app.app_name,
                    'package_name': android_app.package_name,
                    'version': android_app.version,
                    'developer': android_app.developer,
                    'release_date': android_app.release_date.isoformat() if android_app.release_date else None
                },
                'manifest_risks': latest_scan.manifest_risks,
                'scan_date': latest_scan.scan_date.isoformat(),
                'security_issues': []
            }

            for issue in security_issues:
                formatted_issue = {
                    'category': issue.category,
                    'name': issue.name,
                    'detail': issue.detail,
                    'model': issue.model,
                    'possibility': issue.possibility,
                    'vulnerabilities': []
                }

                for vuln in issue.vulnerabilities:
                    formatted_vuln = {
                        'id': vuln.id,
                        'position': vuln.position,
                        'entry_method': vuln.entry_method,
                        'sink': vuln.sink,
                        'source': vuln.source,
                        'url': vuln.url,
                        'target': vuln.target,
                        'manifest': vuln.manifest,
                        'hash': vuln.hash,
                        'old_hash': vuln.old_hash,
                        'possibility': vuln.possibility,
                        'duplicate_count': getattr(vuln, 'duplicate_count', 1),
                        'exported_reachable': getattr(vuln, 'exported_reachable', False),
                        'exported_via': getattr(vuln, 'exported_via', None),
                        # Pre-computed component metadata from DB/manifest lookup during save
                        'component_name': getattr(vuln, 'component_name', None),
                        'component_type': getattr(vuln, 'component_type', None),
                        'exported': getattr(vuln, 'component_exported', None),
                        'accessible': getattr(vuln, 'component_accessible', None),
                        'has_intent_filters': getattr(vuln, 'component_has_intent_filters', None),
                        'suppressed': getattr(vuln, 'suppressed', False),
                        'suppression_note': getattr(vuln, 'suppression_note', None),
                    }
                    formatted_issue['vulnerabilities'].append(formatted_vuln)

                results['security_issues'].append(formatted_issue)

            print("Results: ", results)

            return jsonify(results)

        except Exception as e:
            logger.exception(f"Error retrieving scan results for {app_identifier}: {str(e)}")
            return {"error": str(e)}, 500



### - New faster loading components - ###


@engine_namespace.route('/scan/results/<string:app_identifier>/high-level')
class EngineScanHighLevelResults(Resource):
    def get(self, app_identifier):
        try:
            # Remove .apk extension if present
            app_name = app_identifier.replace('.apk', '')

            android_app = AndroidInfo.query.filter(
                (AndroidInfo.app_name == app_name) |
                (AndroidInfo.app_name == f"{app_name}.apk") |
                (AndroidInfo.package_name == app_name)
            ).order_by(AndroidInfo.id.desc()).first()

            # If not found, try partial match on package_name
            if not android_app:
                base_name = app_name.rsplit('_', 1)[0] if '_' in app_name else app_name
                android_app = AndroidInfo.query.filter(
                    (AndroidInfo.package_name == base_name) |
                    (AndroidInfo.package_name.ilike(f'%{base_name}%')) |
                    (AndroidInfo.app_name.ilike(f'%{base_name.split(".")[-1]}%'))
                ).order_by(AndroidInfo.id.desc()).first()

            # Strategy 3: Find via ScanTask.filename -> AppsharkScan -> AndroidInfo
            if not android_app:
                scan_task_match = ScanTask.query.filter(
                    (ScanTask.filename == app_identifier) |
                    (ScanTask.filename == f"{app_name}.apk")
                ).order_by(ScanTask.id.desc()).first()

                if scan_task_match:
                    scan_via_task = AppsharkScan.query.filter_by(
                        scan_task_guid=scan_task_match.guid
                    ).first()
                    if scan_via_task:
                        android_app = AndroidInfo.query.get(scan_via_task.android_info_id)

            if not android_app:
                try:
                    android_app = find_android_info(app_identifier)
                except Exception:
                    android_app = None

            if not android_app:
                parsed = engine_service.parse_scan_results(app_name)
                if not parsed:
                    return {"error": f"App not found: {app_identifier}"}, 404

                # Build a light-weight summary compatible with the frontend.
                summary = {}
                for issue in parsed.get('security_issues', []) or []:
                    category = issue.get('category') or 'Unknown'
                    summary.setdefault(category, {'count': 0, 'issues': []})
                    summary[category]['count'] += 1

                    entry_method = None
                    vulns = issue.get('vulnerabilities') or []
                    if vulns:
                        entry_method = (vulns[0].get('details') or {}).get('entryMethod')

                    summary[category]['issues'].append({
                        'id': None,
                        'name': issue.get('name'),
                        'possibility': issue.get('possibility'),
                        'entry_method': entry_method,
                    })

                high_level_results = {
                    'app_info': parsed.get('app_info', {}),
                    'manifest_risks': parsed.get('manifest_risks', {}),
                    'scan_date': None,
                    'security_issues_summary': summary
                }
                return jsonify(high_level_results)

            latest_scan = AppsharkScan.query.filter_by(android_info_id=android_app.id).order_by(
                AppsharkScan.scan_date.desc()).first()

            if not latest_scan:
                app_name_clean = app_identifier.replace('.apk', '')
                parsed = engine_service.parse_scan_results(app_name_clean)
                if parsed:
                    logger.info(f"results.json found on disk for {app_identifier}, saving to DB")
                    from project.api.tasks.tasks import save_scan_results
                    scan_task = ScanTask.query.filter_by(filename=android_app.app_name + '.apk').order_by(ScanTask.id.desc()).first() \
                        or ScanTask.query.filter_by(filename=android_app.app_name).order_by(ScanTask.id.desc()).first()
                    save_scan_results(android_app.app_name, parsed, scan_task.guid if scan_task else None)
                    latest_scan = AppsharkScan.query.filter_by(android_info_id=android_app.id).order_by(
                        AppsharkScan.scan_date.desc()).first()
                if not latest_scan:
                    return {'message': f'No scan results found for this app: {app_identifier}'}, 404

            # Fetch only high-level information
            high_level_results = {
                'app_info': {
                    **latest_scan.app_info,
                    'app_name': android_app.app_name,
                    'package_name': android_app.package_name,
                    'version': android_app.version,
                    'developer': android_app.developer,
                    'release_date': android_app.release_date.isoformat() if android_app.release_date else None
                },
                'manifest_risks': latest_scan.manifest_risks,
                'scan_date': latest_scan.scan_date.isoformat(),
                'security_issues_summary': self.get_security_issues_summary(latest_scan.id)
            }

            return jsonify(high_level_results)

        except Exception as e:
            logger.exception(f"Error retrieving high-level scan results for {app_identifier}: {str(e)}")
            return {"error": str(e)}, 500

    def get_security_issues_summary(self, scan_id):
        # selectinload the vulnerabilities (accessed per-issue below) to avoid an
        # N+1: one extra query total instead of one query per security issue.
        security_issues = (
            AppsharkSecurityIssue.query
            .filter_by(appshark_scan_id=scan_id)
            .options(selectinload(AppsharkSecurityIssue.vulnerabilities))
            .all()
        )
        summary = {}
        for issue in security_issues:
            if issue.category not in summary:
                summary[issue.category] = {
                    'count': 0,
                    'issues': []
                }
            summary[issue.category]['count'] += 1

            # Get the first vulnerability's entry_method (if any)
            entry_method = None
            if issue.vulnerabilities:
                entry_method = issue.vulnerabilities[0].entry_method

            summary[issue.category]['issues'].append({
                'id': issue.id,
                'name': issue.name,
                'possibility': issue.possibility,
                'entry_method': entry_method  # Add this line
            })
        return summary


@engine_namespace.route('/scan/results/<string:app_identifier>/security-issue/<int:issue_id>')
class EngineScanSecurityIssueDetails(Resource):
    def get(self, app_identifier, issue_id):
        try:
            security_issue = AppsharkSecurityIssue.query.get(issue_id)
            if not security_issue:
                return {"error": f"Security issue not found: {issue_id}"}, 404

            issue_details = {
                'id': security_issue.id,
                'category': security_issue.category,
                'name': security_issue.name,
                'detail': security_issue.detail,
                'model': security_issue.model,
                'possibility': security_issue.possibility,
                'vulnerabilities': [
                    {
                        'position': vuln.position,
                        'entry_method': vuln.entry_method,
                        'sink': vuln.sink,
                        'source': vuln.source,
                        'url': vuln.url,
                        'target': vuln.target,
                        'manifest': vuln.manifest,
                        'hash': vuln.hash,
                        'old_hash': vuln.old_hash,
                        'possibility': vuln.possibility,
                        'duplicate_count': getattr(vuln, 'duplicate_count', 1),
                        'exported_reachable': getattr(vuln, 'exported_reachable', False),
                        'exported_via': getattr(vuln, 'exported_via', None),
                        # Pre-computed component accessibility from database
                        'component_name': vuln.component_name,
                        'component_type': vuln.component_type,
                        'exported': vuln.component_exported,
                        'accessible': vuln.component_accessible,
                        'has_intent_filters': vuln.component_has_intent_filters
                    } for vuln in security_issue.vulnerabilities
                ]
            }

            return jsonify(issue_details)

        except Exception as e:
            logger.exception(f"Error retrieving security issue details for {app_identifier}, issue {issue_id}: {str(e)}")
            return {"error": str(e)}, 500



######
