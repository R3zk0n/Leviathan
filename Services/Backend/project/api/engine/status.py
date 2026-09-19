"""Scan queue status, control, task listing, and backfill endpoints."""

from project.api.engine._shared import (
    request, Resource, logger, datetime, os, db, engine_namespace, engine_service, run_scan_task, start_next_queued_scan, get_waiting_scan_position, AndroidInfo, AppsharkScan, AppsharkSecurityIssue, AppsharkVulnerability, ScanTask,
)


@engine_namespace.route('/scan/status/<string:task_id>')
class EngineScanStatus(Resource):
    def get(self, task_id):
        try:
            # If the frontend passes a ScanTask GUID here (common when queued scans are tracked by GUID),
            # Celery will report it as PENDING forever. Detect that and return DB-backed status instead.
            scan_task_by_guid = ScanTask.query.filter_by(guid=task_id).first()
            if scan_task_by_guid:
                response = {
                    'guid': scan_task_by_guid.guid,
                    'status': scan_task_by_guid.status,
                    'filename': scan_task_by_guid.filename,
                    'created_at': scan_task_by_guid.created_at.isoformat() if scan_task_by_guid.created_at else None,
                }

                if scan_task_by_guid.celery_task_id:
                    response['task_id'] = scan_task_by_guid.celery_task_id

                if scan_task_by_guid.status == 'WAITING':
                    response['state'] = 'QUEUED'
                    response['message'] = 'Scan is queued, waiting for other scans to complete'
                    queue_position = get_waiting_scan_position(scan_task_by_guid.guid)
                    if queue_position is not None:
                        response['queue_position'] = queue_position
                elif scan_task_by_guid.status == 'PROCESSING':
                    response['state'] = 'STARTED'
                    response['message'] = 'Scan is in progress'
                elif scan_task_by_guid.status == 'FINISHED':
                    response['state'] = 'SUCCESS'
                    response['message'] = 'Scan completed successfully'
                elif scan_task_by_guid.status == 'ERROR':
                    response['state'] = 'FAILURE'
                    response['message'] = scan_task_by_guid.error_message or 'Scan failed'
                    response['error'] = scan_task_by_guid.error_message

                logger.info(f"Status requested via /scan/status for GUID {task_id}: {response}")
                return response, 200

            task = run_scan_task.AsyncResult(task_id)
            logger.info(f"Task state for {task_id}: {task.state}")

            # Update ScanTask status in database for completed/failed tasks
            if task.state in ['SUCCESS', 'FAILURE', 'REVOKED']:
                scan_task = ScanTask.query.filter_by(celery_task_id=task_id).first()
                if scan_task and scan_task.status == 'PROCESSING':
                    if task.state == 'SUCCESS':
                        scan_task.status = 'FINISHED'
                    elif task.state == 'FAILURE':
                        scan_task.status = 'ERROR'
                        scan_task.error_message = str(task.result) if task.result else 'Unknown error'
                    elif task.state == 'REVOKED':
                        scan_task.status = 'ERROR'
                        scan_task.error_message = 'Scan was stopped by user'
                    scan_task.scan_completed_at = datetime.utcnow()
                    db.session.commit()
                    logger.info(f"Updated ScanTask {scan_task.guid} status to {scan_task.status}")

                    # Safety measure: trigger next scan in case Celery task didn't
                    start_next_queued_scan()

            if task.state == 'PENDING':
                response = {
                    'state': task.state,
                    'status': 'Scan is pending...'
                }
            elif task.state == 'STARTED':
                response = {
                    'state': task.state,
                    'status': 'Scan is in progress...'
                }
            elif task.state == 'SUCCESS':
                if isinstance(task.result, dict) and 'status' in task.result:
                    if task.result['status'] == 'success':
                        response = {
                            'state': task.state,
                            'status': 'Scan completed successfully',
                            'result': task.result['result'],
                            'app_name': os.path.basename(task.result['result']['output_dir'])
                        }
                    else:
                        response = {
                            'state': task.state,
                            'status': 'Scan completed with errors',
                            'error': task.result['result']['message']
                        }
                else:
                    response = {
                        'state': task.state,
                        'status': 'Scan completed',
                        'result': str(task.result)
                    }
            elif task.state == 'REVOKED':
                response = {
                    'state': task.state,
                    'status': 'Scan was stopped by user',
                    'error': 'Scan cancelled'
                }
            elif task.state == 'FAILURE':
                response = {
                    'state': task.state,
                    'status': 'Scan failed',
                    'error': str(task.result) if task.result else 'Unknown error'
                }
            else:
                response = {
                    'state': task.state,
                    'status': 'Unknown state'
                }

            logger.info(f"Response for task {task_id}: {response}")
            return response, 200
        except Exception as e:
            logger.exception(f"Error processing scan status for task {task_id}: {str(e)}")
            return {'error': 'Internal server error'}, 500


@engine_namespace.route('/scan/status-by-guid/<string:scan_guid>')
class EngineScanStatusByGuid(Resource):
    """Get scan status by ScanTask GUID - used for polling queued scans"""
    def get(self, scan_guid):
        try:
            scan_task = ScanTask.query.filter_by(guid=scan_guid).first()

            if not scan_task:
                return {'error': 'Scan task not found'}, 404

            response = {
                'guid': scan_task.guid,
                'status': scan_task.status,
                'filename': scan_task.filename,
                'created_at': scan_task.created_at.isoformat() if scan_task.created_at else None,
            }

            # Include task_id if scan has started (so frontend can switch to task ID polling)
            if scan_task.celery_task_id:
                response['task_id'] = scan_task.celery_task_id

            # Add state mapping for frontend compatibility
            if scan_task.status == 'WAITING':
                response['state'] = 'QUEUED'
                response['message'] = 'Scan is queued, waiting for other scans to complete'
                queue_position = get_waiting_scan_position(scan_task.guid)
                if queue_position is not None:
                    response['queue_position'] = queue_position
            elif scan_task.status == 'PROCESSING':
                response['state'] = 'STARTED'
                response['message'] = 'Scan is in progress'
            elif scan_task.status == 'FINISHED':
                response['state'] = 'SUCCESS'
                response['message'] = 'Scan completed successfully'
            elif scan_task.status == 'ERROR':
                response['state'] = 'FAILURE'
                response['message'] = scan_task.error_message or 'Scan failed'
                response['error'] = scan_task.error_message

            logger.info(f"Status by GUID for {scan_guid}: {response}")
            return response, 200

        except Exception as e:
            logger.exception(f"Error getting scan status by GUID {scan_guid}: {str(e)}")
            return {'error': 'Internal server error'}, 500


@engine_namespace.route('/scan/stop/<string:task_id>')
class EngineScanStop(Resource):
    def post(self, task_id):
        try:
            body = request.get_json(silent=True) or {}
            identifier_type = body.get("identifier_type", "celery")
            if identifier_type not in ("guid", "celery"):
                return {"status": "error", "message": "Invalid scan identifier type"}, 400
            lookup = {"guid" if identifier_type == "guid" else "celery_task_id": task_id}
            scan_task = ScanTask.query.filter_by(**lookup).with_for_update().first()
            if scan_task is None:
                db.session.rollback()
                return {"status": "error", "message": "Scan task not found"}, 404
            if scan_task.status not in ("WAITING", "PROCESSING"):
                db.session.rollback()
                return {"status": "warning", "message": "Scan is not active"}, 409

            # A WAITING row is locked against scheduler admission. PROCESSING
            # also includes admitted jobs whose Celery dispatch has not finished:
            # the engine cancellation marker prevents a later JVM launch.
            killed_count = 0
            if scan_task.status == "PROCESSING":
                killed_count = engine_service.kill_appshark_processes(scan_task.guid)
            if scan_task.celery_task_id:
                from celery.result import AsyncResult
                AsyncResult(scan_task.celery_task_id).revoke(terminate=False)
            scan_task.status = "ERROR"
            scan_task.error_message = "Scan was stopped by user"
            scan_task.scan_completed_at = datetime.utcnow()
            filename_stopped = scan_task.filename
            scan_guid = scan_task.guid
            db.session.commit()
            start_next_queued_scan()
            return {
                "status": "success", "message": "Scan stopped successfully",
                "task_id": task_id, "scan_guid": scan_guid,
                "filename": filename_stopped, "processes_killed": killed_count,
            }, 200
        except Exception:
            db.session.rollback()
            logger.exception("Failed to cancel the selected scan")
            return {"status": "error", "message": "Could not confirm scan cancellation"}, 503


@engine_namespace.route('/backfill-component-status')
class BackfillComponentStatus(Resource):
    """Backfill component_exported/accessible for all existing vulnerabilities"""
    def post(self):
        from project.api.tasks.tasks import extract_class_from_entry_method, lookup_component_info
        from project import db

        try:
            # Get optional app_name filter from request
            data = request.get_json() or {}
            app_name_filter = data.get('app_name')

            # Query all vulnerabilities that need backfill
            query = db.session.query(AppsharkVulnerability).join(
                AppsharkSecurityIssue
            ).join(
                AppsharkScan
            ).join(
                AndroidInfo
            )

            if app_name_filter:
                query = query.filter(AndroidInfo.app_name.ilike(f'%{app_name_filter}%'))

            vulnerabilities = query.all()
            logger.info(f"Found {len(vulnerabilities)} vulnerabilities to backfill")

            updated = 0
            not_found = 0
            errors = 0

            for vuln in vulnerabilities:
                try:
                    # Get the android_info for this vulnerability
                    android_info = vuln.security_issue.appshark_scan.android_info

                    # Extract class name from entry_method
                    class_name = extract_class_from_entry_method(vuln.entry_method)

                    if not class_name:
                        not_found += 1
                        continue

                    # Look up component info
                    component_info = lookup_component_info(android_info, class_name)

                    if component_info:
                        vuln.component_name = class_name
                        vuln.component_type = component_info['component_type']
                        vuln.component_exported = component_info['component_exported']
                        vuln.component_accessible = component_info['component_accessible']
                        vuln.component_has_intent_filters = component_info['component_has_intent_filters']
                        updated += 1
                    else:
                        # Component not in manifest - mark as not accessible
                        vuln.component_name = class_name
                        vuln.component_type = None
                        vuln.component_exported = False
                        vuln.component_accessible = False
                        vuln.component_has_intent_filters = False
                        not_found += 1

                except Exception as e:
                    logger.error(f"Error processing vulnerability {vuln.id}: {e}")
                    errors += 1

            db.session.commit()
            logger.info(f"Backfill complete: {updated} updated, {not_found} not found, {errors} errors")

            return {
                'status': 'success',
                'total_processed': len(vulnerabilities),
                'updated': updated,
                'not_found_in_manifest': not_found,
                'errors': errors
            }, 200

        except Exception as e:
            logger.exception(f"Error in backfill: {e}")
            return {'status': 'error', 'message': str(e)}, 500


@engine_namespace.route('/backfill-component-status/<string:app_name>')
class BackfillComponentStatusForApp(Resource):
    """Backfill component status for a specific app"""
    def post(self, app_name):
        from project.api.tasks.tasks import extract_class_from_entry_method, lookup_component_info
        from project import db

        try:
            # Find the android_info for this app
            android_info = AndroidInfo.query.filter(
                (AndroidInfo.app_name.ilike(f'%{app_name}%')) |
                (AndroidInfo.package_name.ilike(f'%{app_name}%'))
            ).first()

            if not android_info:
                return {'status': 'error', 'message': f'App not found: {app_name}'}, 404

            # Get all vulnerabilities for this app
            vulnerabilities = db.session.query(AppsharkVulnerability).join(
                AppsharkSecurityIssue
            ).join(
                AppsharkScan
            ).filter(
                AppsharkScan.android_info_id == android_info.id
            ).all()

            logger.info(f"Found {len(vulnerabilities)} vulnerabilities for app {app_name}")

            updated = 0
            not_found = 0

            for vuln in vulnerabilities:
                class_name = extract_class_from_entry_method(vuln.entry_method)

                if not class_name:
                    not_found += 1
                    continue

                component_info = lookup_component_info(android_info, class_name)

                if component_info:
                    vuln.component_name = class_name
                    vuln.component_type = component_info['component_type']
                    vuln.component_exported = component_info['component_exported']
                    vuln.component_accessible = component_info['component_accessible']
                    vuln.component_has_intent_filters = component_info['component_has_intent_filters']
                    updated += 1
                    logger.debug(f"Updated {class_name}: exported={component_info['component_exported']}")
                else:
                    vuln.component_name = class_name
                    vuln.component_type = None
                    vuln.component_exported = False
                    vuln.component_accessible = False
                    vuln.component_has_intent_filters = False
                    not_found += 1

            db.session.commit()

            return {
                'status': 'success',
                'app_name': app_name,
                'android_info_id': android_info.id,
                'total_vulnerabilities': len(vulnerabilities),
                'updated': updated,
                'not_found_in_manifest': not_found
            }, 200

        except Exception as e:
            logger.exception(f"Error in backfill for {app_name}: {e}")
            return {'status': 'error', 'message': str(e)}, 500


@engine_namespace.route('/scan-tasks')
class EngineScanTasks(Resource):
    """Get all scan tasks from database"""
    def get(self):
        try:
            # Get query parameters for filtering
            status_filter = request.args.get('status')  # WAITING, PROCESSING, FINISHED, ERROR
            limit = request.args.get('limit', 50, type=int)

            query = ScanTask.query.order_by(ScanTask.created_at.desc())

            if status_filter:
                query = query.filter(ScanTask.status == status_filter)

            scan_tasks = query.limit(limit).all()

            return {
                'scan_tasks': [
                    {
                        'id': task.id,
                        'guid': task.guid,
                        'filename': task.filename,
                        'status': task.status,
                        'celery_task_id': task.celery_task_id,
                        'error_message': task.error_message,
                        'scan_started_at': task.scan_started_at.isoformat() if task.scan_started_at else None,
                        'scan_completed_at': task.scan_completed_at.isoformat() if task.scan_completed_at else None,
                        'created_at': task.created_at.isoformat() if task.created_at else None,
                        'android_info_id': task.android_info_id
                    }
                    for task in scan_tasks
                ],
                'active_count': ScanTask.query.filter(ScanTask.status.in_(['WAITING', 'PROCESSING'])).count(),
                'total_count': len(scan_tasks)
            }, 200

        except Exception as e:
            logger.exception(f"Error getting scan tasks: {e}")
            return {'error': str(e)}, 500


@engine_namespace.route('/scan-tasks/active')
class EngineActiveScanTasks(Resource):
    """Get only active (WAITING, PROCESSING) scan tasks"""
    def get(self):
        try:
            active_tasks = ScanTask.query.filter(
                ScanTask.status.in_(['WAITING', 'PROCESSING'])
            ).order_by(ScanTask.created_at.desc()).all()

            return {
                'active_scans': [
                    {
                        'id': task.id,
                        'guid': task.guid,
                        'filename': task.filename,
                        'status': task.status,
                        'celery_task_id': task.celery_task_id,
                        'scan_started_at': task.scan_started_at.isoformat() if task.scan_started_at else None,
                        'created_at': task.created_at.isoformat() if task.created_at else None
                    }
                    for task in active_tasks
                ],
                'count': len(active_tasks)
            }, 200

        except Exception as e:
            logger.exception(f"Error getting active scan tasks: {e}")
            return {'error': str(e)}, 500


@engine_namespace.route('/container-logs')
class EngineContainerLogs(Resource):
    def get(self):
        try:
            tail = request.args.get('tail', 300, type=int)
            tail = max(1, min(tail, 2000))
            content = engine_service.get_container_logs(tail=tail)
            return {'content': content, 'tail': tail}, 200
        except Exception as e:
            logger.exception(f"Error fetching container logs: {e}")
            return {'error': str(e)}, 500


@engine_namespace.route('/scan/list')
class EngineScanList(Resource):
    def get(self):
        try:
            scans = engine_service.list_available_scans()
            return {'scans': scans}, 200
        except Exception as e:
            logger.exception(f"Error listing scans: {e}")
            return {'error': str(e)}, 500


@engine_namespace.route('/scan/logs/<string:scan_name>')
class EngineScanLogs(Resource):
    def get(self, scan_name):
        try:
            tail = request.args.get('tail', 500, type=int)
            tail = max(1, min(tail, 5000))
            result = engine_service.get_scan_log_content(scan_name, tail=tail)
            return result, 200
        except FileNotFoundError as e:
            return {'error': str(e)}, 404
        except Exception as e:
            logger.exception(f"Error fetching scan logs for {scan_name}: {e}")
            return {'error': str(e)}, 500
