"""Trufflehog secret-scanning endpoints."""

from project.api.engine._shared import (
    ast, jsonify, Resource, logger, engine_namespace, engine_service, EngineService, scan_secrets_task, decompile_apk_task,
)


@engine_namespace.route('/trufflehog/scan/<filename>')
class EngineTrufflehogScan(Resource):
    def post(self, filename):
        try:
            # Start the Celery task
            task = scan_secrets_task.delay(filename)
            return jsonify({
                "message": "Trufflehog Scan Started",
                "output": {
                    "status": "success",
                    "task_id": task.id
                }
            })
        except Exception as e:
            return jsonify({
                "message": f"Error: {str(e)}",
                "output": {
                    "status": "error",
                    "error": str(e)
                }
            }), 500


@engine_namespace.route('/trufflehog/scan/status/<task_id>')
class EngineTrufflehogScanStatus(Resource):
    def get(self, task_id):
        try:
            from project.api.tasks.tasks import perform_secret_scan
            from celery.result import AsyncResult

            task = scan_secrets_task.AsyncResult(task_id)
            logger.info(f"Task status for {task_id}: {task.state}")

            # Check if the main task is done
            if task.ready():
                result = task.get()
                logger.info(f"Main task result: {result}")

                # Handle chain results - extract subtask ID
                if isinstance(result, list) and len(result) > 0 and isinstance(result[0], list) and len(result[0]) > 0:
                    subtask_id = result[0][0]
                    logger.info(f"Extracted subtask ID: {subtask_id}")

                    # Check subtask status
                    subtask = AsyncResult(subtask_id)
                    logger.info(f"Subtask state: {subtask.state}")

                    # If subtask is still running, report "in progress" instead of error
                    if not subtask.ready():
                        logger.info(f"Subtask {subtask_id} is still running")
                        return jsonify({
                            "message": "Trufflehog Scan In Progress",
                            "output": {
                                "status": "pending",
                                "task_id": subtask_id  # Return the subtask ID for future polling
                            }
                        })

                    # Subtask is ready, get its result
                    subtask_result = subtask.get()
                    logger.info(f"Subtask result: {subtask_result}")

                    # Extract findings from subtask result
                    if isinstance(subtask_result, dict) and subtask_result.get('status') == 'success':
                        findings = []

                        # Try to extract findings from different possible locations
                        if 'result' in subtask_result and isinstance(subtask_result['result'], dict) and 'findings' in \
                                subtask_result['result']:
                            findings = subtask_result['result']['findings']
                            logger.info(f"Found {len(findings)} findings in subtask result")

                        return jsonify({
                            "message": "Trufflehog Scan Complete",
                            "output": {
                                "status": "success",
                                "result": {
                                    "findings": findings
                                }
                            }
                        })

                    # Error in subtask
                    if isinstance(subtask_result, dict) and subtask_result.get('status') == 'error':
                        return jsonify({
                            "message": "Trufflehog Scan Failed",
                            "output": {
                                "status": "error",
                                "error": subtask_result.get('message', 'Unknown error in subtask')
                            }
                        })

                # Handle direct result (not a chain)
                if isinstance(result, dict):
                    if result.get('status') == 'success':
                        findings = []
                        if 'result' in result and isinstance(result['result'], dict) and 'findings' in result['result']:
                            findings = result['result']['findings']

                        return jsonify({
                            "message": "Trufflehog Scan Complete",
                            "output": {
                                "status": "success",
                                "result": {
                                    "findings": findings
                                }
                            }
                        })
                    elif result.get('status') == 'error':
                        return jsonify({
                            "message": "Trufflehog Scan Failed",
                            "output": {
                                "status": "error",
                                "error": result.get('message', 'Unknown error')
                            }
                        })

                # Unexpected result format
                logger.warning(f"Unexpected result format: {result}")
                return jsonify({
                    "message": "Trufflehog Scan Complete but result format unexpected",
                    "output": {
                        "status": "error",
                        "error": "Unexpected result format from scan task"
                    }
                })

            # Main task still running
            return jsonify({
                "message": "Trufflehog Scan In Progress",
                "output": {
                    "status": "pending",
                    "task_id": task_id
                }
            })

        except Exception as e:
            logger.exception(f"Error checking scan status: {str(e)}")
            return jsonify({
                "message": f"Error: {str(e)}",
                "output": {
                    "status": "error",
                    "error": str(e)
                }
            }), 500


@engine_namespace.route('/trufflehog/scan/chain-debug/<task_id>')
class EngineTrufflehogScanChainDebug(Resource):
    def get(self, task_id):
        try:
            from project.api.tasks.tasks import perform_secret_scan, decompile_apk_task
            from celery.result import AsyncResult

            # Get the main task
            result = {
                "main_task_id": task_id,
                "tasks": {}
            }

            main_task = scan_secrets_task.AsyncResult(task_id)
            result["tasks"]["main"] = {
                "id": task_id,
                "state": main_task.state,
                "ready": main_task.ready(),
                "successful": main_task.successful() if main_task.ready() else None,
                "failed": main_task.failed() if main_task.ready() else None
            }

            # Try to get the task result if available
            if main_task.ready():
                try:
                    main_result = main_task.get()
                    result["tasks"]["main"]["result"] = str(main_result)

                    # If it's a chain result, extract the subtask ID
                    if isinstance(main_result, list):
                        # Normal chain result structure
                        if len(main_result) > 0:
                            subtask_ids = []

                            if isinstance(main_result[0], list):
                                # Nested list structure
                                for item in main_result[0]:
                                    if item and isinstance(item, str):
                                        subtask_ids.append(item)
                            elif isinstance(main_result[0], str):
                                # Direct ID
                                subtask_ids.append(main_result[0])

                            # Process each potential subtask
                            for idx, subtask_id in enumerate(subtask_ids):
                                try:
                                    # Try with both task types
                                    perform_subtask = perform_secret_scan.AsyncResult(subtask_id)
                                    decompile_subtask = decompile_apk_task.AsyncResult(subtask_id)

                                    # See which one exists and is valid
                                    if perform_subtask.state != 'PENDING':
                                        subtask = perform_subtask
                                        task_type = "perform_secret_scan"
                                    elif decompile_subtask.state != 'PENDING':
                                        subtask = decompile_subtask
                                        task_type = "decompile_apk_task"
                                    else:
                                        # Try generic task
                                        subtask = AsyncResult(subtask_id)
                                        task_type = "unknown"

                                    subtask_info = {
                                        "id": subtask_id,
                                        "type": task_type,
                                        "state": subtask.state,
                                        "ready": subtask.ready(),
                                        "successful": subtask.successful() if subtask.ready() else None,
                                        "failed": subtask.failed() if subtask.ready() else None
                                    }

                                    if subtask.ready():
                                        try:
                                            subtask_result = subtask.get()
                                            subtask_info["result"] = subtask_result
                                        except Exception as subtask_result_error:
                                            subtask_info["result_error"] = str(subtask_result_error)

                                    result["tasks"][f"subtask_{idx}"] = subtask_info

                                except Exception as subtask_error:
                                    result["tasks"][f"subtask_{idx}_error"] = str(subtask_error)

                except Exception as result_error:
                    result["tasks"]["main"]["result_error"] = str(result_error)

            return jsonify(result)

        except Exception as e:
            logger.exception(f"Error in chain debug endpoint: {str(e)}")
            return jsonify({
                "error": str(e)
            }), 500


@engine_namespace.route('/trufflehog/scan/debug/<task_id>')
class EngineTrufflehogScanDebug(Resource):
    def get(self, task_id):
        try:
            task = scan_secrets_task.AsyncResult(task_id)

            # Get basic task info
            task_info = {
                "task_id": task_id,
                "state": task.state,
                "ready": task.ready(),
                "successful": task.successful() if task.ready() else None,
                "failed": task.failed() if task.ready() else None
            }

            # Try to get result if ready
            if task.ready():
                try:
                    raw_result = task.get()
                    task_info["raw_result"] = raw_result

                    # If the task has a result that's another task ID, try to get that result too
                    if isinstance(raw_result, list) and len(raw_result) > 0:
                        subtask_ids = [item for item in raw_result if isinstance(item, str)]
                        for subtask_id in subtask_ids:
                            try:
                                subtask = celery.AsyncResult(subtask_id)
                                if subtask.ready():
                                    task_info[f"subtask_{subtask_id}"] = subtask.get()
                            except Exception as subtask_error:
                                task_info[f"subtask_{subtask_id}_error"] = str(subtask_error)
                except Exception as result_error:
                    task_info["result_error"] = str(result_error)

            # Return all collected info
            return jsonify(task_info)

        except Exception as e:
            logger.exception(f"Error in debug endpoint: {str(e)}")
            return jsonify({
                "error": str(e)
            }), 500


@engine_namespace.route('/trufflehog/version')
class EngineTrufflehogVersion(Resource):
    def get(self):
        try:
            version_result = engine_service.get_trufflehog_version()

            exit_code = None
            version_text = None

            # EngineService.exec_command typically returns (exit_code, output)
            if isinstance(version_result, (tuple, list)) and len(version_result) >= 2:
                exit_code = version_result[0]
                version_text = version_result[1]
            elif isinstance(version_result, str):
                # Backwards compatibility: sometimes older code stored a stringified tuple
                try:
                    parsed = ast.literal_eval(version_result)
                    if isinstance(parsed, (tuple, list)) and len(parsed) >= 2:
                        exit_code = parsed[0]
                        version_text = parsed[1]
                    else:
                        version_text = version_result
                except Exception:
                    version_text = version_result
            else:
                version_text = str(version_result)

            version_text = "" if version_text is None else str(version_text)

            version_dict = {
                "exit_code": exit_code,
                "version": version_text.strip()
            }

            status = "success" if exit_code in (None, 0) else "error"
            return jsonify({"message": "Trufflehog Check", "status": status, "output": version_dict})
        except Exception as e:
            return jsonify({"message": f"Error: {str(e)}"}), 500
