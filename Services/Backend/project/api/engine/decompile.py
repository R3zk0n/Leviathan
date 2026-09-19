"""Engine decompilation + version endpoints."""

from project.api.engine._shared import (
    json, request, jsonify, Resource, logger, engine_namespace, engine_service, decompile_apk_task,
)
from project.api.engine.decompilers import DECOMPILERS, DEFAULT_DECOMPILER


@engine_namespace.route('/decompiled/<string:file_name>/batch-status')
class EngineDecompiledBatchStatus(Resource):
    def post(self, file_name):
        try:
            items = request.json.get('items', [])
            logger.info(f"Batch status check for {file_name} with {len(items)} items")

            # Resolve all items to actual decompiled paths
            file_paths = []
            item_to_path_map = {}
            results = {}
            for item in items:
                try:
                    resolved_path = engine_service.resolve_decompiled_java_path(file_name, item)
                    file_paths.append(resolved_path)
                    item_to_path_map[resolved_path] = item
                except FileNotFoundError:
                    results[item] = False

            if file_paths:
                existence_results = engine_service.batch_file_exists(file_paths)
                for file_path, exists in existence_results.items():
                    item = item_to_path_map[file_path]
                    results[item] = exists
                    logger.debug(f"Item: {item} -> Path: {file_path} -> Exists: {exists}")

            logger.info(f"Batch status check completed: {len(results)} items processed")
            return {"status": results}
        except Exception as e:
            logger.exception(f"Error checking batch status for {file_name}")
            return {"message": str(e)}, 500


@engine_namespace.route('/decompiled/<string:file_name>/<path:java_file>')
class EngineDecompiled(Resource):
    def get(self, file_name, java_file):
        file_path = None
        try:
            file_path = engine_service.resolve_decompiled_java_path(file_name, java_file)
            java_code = engine_service.get_file_content(file_path)
            return {"java_code": java_code}
        except Exception as e:
            logger.exception(f"Error processing {file_path or java_file}")
            return {"message": str(e)}, 500


@engine_namespace.route('/decompile/<string:file_name>')
class EngineDecompile(Resource):
    def get(self, file_name):
        engine = (request.args.get('engine', DEFAULT_DECOMPILER) or DEFAULT_DECOMPILER).strip().lower()
        if engine not in DECOMPILERS:
            return {"message": f"Unknown engine '{engine}'. Valid: {sorted(DECOMPILERS)}"}, 400

        force = str(request.args.get('force', 'false')).strip().lower() in ('true', '1', 'yes')
        resources = str(request.args.get('resources', 'false')).strip().lower() in ('true', '1', 'yes')

        try:
            task = decompile_apk_task.delay(file_name, engine, force, resources)
            return {
                "message": "Decompile started",
                "task_id": str(task.id),
                "engine": engine,
            }, 202
        except Exception as e:
            logger.error(f"Error starting decompilation for {file_name}: {str(e)}")
            return {
                "error": "Failed to start decompilation",
                "message": str(e)
            }, 500


@engine_namespace.route('/decompile/check/<string:file_name>')
class EngineDecompileCheck(Resource):
    def get(self, file_name):
        try:
            marker = engine_service.read_decompiler_marker(file_name)
            if marker and marker.get('engine'):
                # Confirm the sources tree is actually present, not just the marker.
                sources_path = f"/tmp/decompiled/{file_name}/sources"
                if engine_service.containers.is_dir(sources_path):
                    return {
                        "decompiled": True,
                        "engine": marker.get('engine'),
                        "resources": bool(marker.get('resources')),
                    }
            return {"decompiled": False, "engine": None, "resources": False}
        except Exception as e:
            logger.error(f"Error checking decompile status for {file_name}: {str(e)}")
            return {"decompiled": False, "engine": None, "resources": False}


@engine_namespace.route('/decompile/status/<string:task_id>')
class EngineDecompileStatus(Resource):
    def get(self, task_id):
        task = decompile_apk_task.AsyncResult(task_id)
        print("Task state: ", task.state)
        if task.state == 'PENDING':
            response = {
                'state': task.state,
                'status': 'Decompilation is pending...'
            }
        elif task.state != 'FAILURE':
            response = {
                'state': task.state,
                'status': task.info.get('message', '')
            }
        else:
            response = {
                'state': task.state,
                'status': 'Decompilation failed',
                'error': str(task.info),
            }
        return jsonify(response)


@engine_namespace.route('/version')
class EngineVersion(Resource):
    def get(self):
        try:
            return jsonify(engine_service.get_tool_versions())
        except Exception as e:
            # get_tool_versions is best-effort and shouldn't raise, but stay safe.
            return jsonify({
                "jadx": f"error: {str(e)}",
                "dex2jar": f"error: {str(e)}",
                "vineflower": f"error: {str(e)}",
            }), 500
