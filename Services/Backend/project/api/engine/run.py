"""Scan dispatch / orchestration endpoints (/run, /scan)."""

from project.api.engine._shared import (
    request, Resource, logger, uuid, datetime, os, db, engine_namespace, engine_service, EngineService, run_scan_task, save_scan_results, start_next_queued_scan, heap_spec_for_apk, AndroidInfo, ScanTask,
)


@engine_namespace.route('/run')
class EngineRun(Resource):
    engine_service = EngineService()

    @staticmethod
    def _list_uploaded_apk_files():
        """List APKs from backend uploads folder."""
        upload_dir = 'uploads'
        if not os.path.isdir(upload_dir):
            return []

        return sorted([
            filename for filename in os.listdir(upload_dir)
            if os.path.isfile(os.path.join(upload_dir, filename)) and filename.lower().endswith('.apk')
        ])

    @classmethod
    def _enqueue_scan_for_filename(cls, filename, request_overrides, defer_start=False):
        """Create a WAITING scan for one uploaded APK, tagged with a per-scan
        heap ceiling. Admission (which/how many actually start) is decided by
        the budget-aware dispatcher, which the caller invokes once for the whole
        batch — so this method never starts a scan itself. defer_start is kept
        for signature compatibility and is now a no-op."""
        # Skip if this APK already has an active scan.
        existing_scan = ScanTask.query.filter(
            ScanTask.filename == filename,
            ScanTask.status.in_(['WAITING', 'PROCESSING'])
        ).first()

        if existing_scan:
            return {
                "status": "already_running",
                "filename": filename,
                "message": "A scan is already active for this file",
                "task_id": existing_scan.celery_task_id,
                "scan_guid": existing_scan.guid,
            }

        current_settings = cls.engine_service.get_settings() or {}
        safe_overrides = {
            key: value
            for key, value in cls.engine_service.normalize_settings(request_overrides).items()
            if value is not None and key not in {'apkPath', 'out', 'outPath'}
        }
        current_settings.update(safe_overrides)

        app_output_dir = cls.engine_service.create_app_output_directory(filename)
        current_settings.update({
            'apkPath': f"/appshark_engine/appshark/uploads/{filename}",
            'out': app_output_dir
        })
        # Tag the per-scan JVM heap (sized to the APK); the engine reads these
        # and the dispatcher budgets against javaXmx.
        xms, xmx = heap_spec_for_apk(filename)
        current_settings['javaXms'] = xms
        current_settings['javaXmx'] = xmx

        app_name = filename.replace('.apk', '')
        android_info = AndroidInfo.query.filter(
            (AndroidInfo.app_name.ilike(f'%{app_name}%')) |
            (AndroidInfo.package_name.ilike(f'%{app_name}%'))
        ).first()

        scan_guid = str(uuid.uuid4())
        scan_task = ScanTask(
            guid=scan_guid,
            filename=filename,
            settings=current_settings,
            status='WAITING',
            android_info_id=android_info.id if android_info else None,
            scan_started_at=None
        )
        db.session.add(scan_task)
        db.session.commit()

        return {
            "status": "queued",
            "filename": filename,
            "message": "Scan queued",
            "scan_guid": scan_guid,
            "output_dir": app_output_dir,
        }

    def get(self):
        """Help endpoint for UI/debug usage to avoid noisy 405 responses."""
        uploaded_apks = self._list_uploaded_apk_files()
        return {
            "message": "Use POST /engine/run to queue scans for all uploaded APK files",
            "uploaded_apk_count": len(uploaded_apks),
        }, 200

    def post(self):
        try:
            data = request.get_json(silent=True) or {}
            logger.info(f"Received run request with data: {data}")

            uploaded_apks = self._list_uploaded_apk_files()
            if not uploaded_apks:
                return {"error": "No uploaded APK files found"}, 400

            scan_results = []
            for filename in uploaded_apks:
                result = self._enqueue_scan_for_filename(filename, data)
                scan_results.append(result)

            # Budget-aware admission: starts as many queued scans as the memory
            # budget allows (several small apps in parallel, a large one alone).
            dispatched_guids = set(start_next_queued_scan() or [])

            # Reconcile: any scan that actually started this pass becomes 'started'.
            for item in scan_results:
                if item.get('scan_guid') in dispatched_guids and item.get('status') == 'queued':
                    item['status'] = 'started'
                    item['message'] = 'Scan started'
                    item.pop('queue_position', None)
                    refreshed = ScanTask.query.filter_by(guid=item['scan_guid']).first()
                    if refreshed and refreshed.celery_task_id:
                        item['task_id'] = refreshed.celery_task_id

            started_count = len([item for item in scan_results if item.get('status') == 'started'])
            queued_count = len([item for item in scan_results if item.get('status') == 'queued'])
            already_running_count = len([item for item in scan_results if item.get('status') == 'already_running'])

            return {
                "status": "success",
                "message": "Bulk scan requests processed",
                "total_apks": len(uploaded_apks),
                "started": started_count,
                "queued": queued_count,
                "already_running": already_running_count,
                "scans": scan_results,
            }, 202

        except Exception as e:
            logger.error(f"Error processing run request: {str(e)}")
            return {"error": "Internal server error"}, 500

    @classmethod
    def get_apk_files(cls, directory):
        try:
            # uploads/ is a shared volume, so this is a plain listdir now. The
            # tuple/bytes/demux unwrapping below existed only to normalise what
            # docker exec returned.
            entries = cls.engine_service.containers.list_dir(str(directory))
            apk_files = [
                name for name in entries
                if name.strip().lower().endswith('.apk')
            ]

            if apk_files:
                logger.info("Found APK files:")
                for apk_file in apk_files:
                    logger.info(f"- {apk_file}")
            else:
                logger.warning(f"No APK files found in {directory}")

            return apk_files
        except Exception as e:
            logger.error(f"Error getting APK files: {str(e)}")
            return []

    @classmethod
    def process_apk(cls, apk_file, data):
        try:
            logger.info(f"Processing APK: {apk_file}")

            # Create a copy of the data dictionary for this specific APK
            apk_data = data.copy()

            # Set the full path to the APK file
            apk_filename = os.path.basename(apk_file)
            apk_data['apkPath'] = os.path.join(data['apkPath'], apk_filename)

            # Create app-specific output directory
            app_name = os.path.splitext(apk_filename)[0]  # Remove .apk extension
            app_output_dir = cls.engine_service.create_app_output_directory(app_name)
            apk_data['out'] = app_output_dir

            logger.info(f"Updated apkPath: {apk_data['apkPath']}")
            logger.info(f"Output directory: {apk_data['out']}")

            # Run the scan
            scan_result = cls.engine_service.run_scan(apk_data)

            if scan_result['status'] == 'success':
                # Parse the scan results
                parsed_results = cls.engine_service.parse_scan_results(app_name)

                if parsed_results:
                    # Save results to database
                    try:
                        save_scan_results(app_name, parsed_results)
                        db_save_status = "success"
                        db_save_message = f"Scan results for {app_name} saved successfully to database"
                    except Exception as db_error:
                        logger.error(f"Error saving scan results to database for {app_name}: {str(db_error)}")
                        db_save_status = "error"
                        db_save_message = f"Failed to save scan results to database: {str(db_error)}"

                    return {
                        "apk_name": app_name,
                        "status": "success",
                        "output_dir": app_output_dir,
                        "results": parsed_results,
                        "db_save_status": db_save_status,
                        "db_save_message": db_save_message
                    }
                else:
                    return {
                        "apk_name": app_name,
                        "status": "error",
                        "message": "Failed to parse scan results"
                    }
            else:
                return {
                    "apk_name": app_name,
                    "status": "error",
                    "message": scan_result['message']
                }

        except Exception as e:
            logger.error(f"Error processing APK {apk_file}: {str(e)}")
            return {
                "apk_name": os.path.basename(apk_file),
                "status": "error",
                "message": str(e)
            }


@engine_namespace.route('/scan/<string:filename>')
class EngineScan(Resource):
    def post(self, filename):
        try:
            # Check if there's already an active scan for this file in database
            existing_scan = ScanTask.query.filter(
                ScanTask.filename == filename,
                ScanTask.status.in_(['WAITING', 'PROCESSING'])
            ).first()

            if existing_scan:
                logger.warning(f"Scan already in progress for {filename} (guid: {existing_scan.guid})")
                return {
                    "status": "already_running",
                    "message": f"A scan is already running for {filename}",
                    "task_id": existing_scan.celery_task_id,
                    "scan_guid": existing_scan.guid
                }, 409  # HTTP 409 Conflict

            # Get the current settings
            current_settings = engine_service.get_settings()
            logger.info(f"Current settings for scan of {filename}: {current_settings}")

            # Create app-specific output directory
            app_output_dir = engine_service.create_app_output_directory(filename)

            # Update settings for this specific scan
            current_settings.update({
                'apkPath': f"/appshark_engine/appshark/uploads/{filename}",
                'out': app_output_dir
            })
            # Per-scan JVM heap ceiling sized to the APK (engine reads these;
            # the dispatcher budgets against javaXmx).
            xms, xmx = heap_spec_for_apk(filename)
            current_settings['javaXms'] = xms
            current_settings['javaXmx'] = xmx

            # Find the AndroidInfo for this file (if exists)
            app_name = filename.replace('.apk', '')
            android_info = AndroidInfo.query.filter(
                (AndroidInfo.app_name.ilike(f'%{app_name}%')) |
                (AndroidInfo.package_name.ilike(f'%{app_name}%'))
            ).first()

            # Always create WAITING; the budget-aware dispatcher decides whether
            # it can start now (fits the memory budget) or must queue.
            scan_guid = str(uuid.uuid4())
            scan_task = ScanTask(
                guid=scan_guid,
                filename=filename,
                settings=current_settings,
                status='WAITING',
                android_info_id=android_info.id if android_info else None,
                scan_started_at=None
            )
            db.session.add(scan_task)
            db.session.commit()
            logger.info(f"Created ScanTask {scan_guid} for {filename} (heap {xmx})")

            # Admit as many queued scans as the budget allows (this one included
            # if it fits). Then report whether this scan actually started.
            start_next_queued_scan()

            refreshed_scan = ScanTask.query.filter_by(guid=scan_guid).first()
            if refreshed_scan and refreshed_scan.status == 'PROCESSING':
                return {
                    "status": "success",
                    "message": "Scan started",
                    "task_id": refreshed_scan.celery_task_id,
                    "scan_guid": scan_guid,
                    "output_dir": app_output_dir
                }, 202

            return {
                "status": "queued",
                "message": "Scan queued - memory budget full, will start when a slot frees",
                "scan_guid": scan_guid,
                "output_dir": app_output_dir,
                "queue_position": ScanTask.query.filter(ScanTask.status == 'WAITING').count()
            }, 202

        except Exception as e:
            logger.exception(f"Unexpected error during scan process for {filename}: {str(e)}")
            error_response = {
                "status": "error",
                "message": "An unexpected error occurred during the scan process",
                "details": str(e)
            }
            return error_response, 500
