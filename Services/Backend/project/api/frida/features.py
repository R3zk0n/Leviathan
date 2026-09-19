"""Feature execute/start/stop and feature-stream endpoints."""
from project.api.frida._shared import *  # noqa: F401,F403  (shared surface)
from project.api.frida.helpers import *  # noqa: F401,F403  (helper functions)
from project.api.frida.stream_auth import StreamAuthorization


@frida_namespace.route('/execute-with-agent')
class FridaAgentExecute(Resource):
    def post(self):
        try:
            data = request.get_json()
            session_id = data.get("session_id")
            command = data.get("command")
            print(f"Session ID: {session_id}, Command: {command}")

            if not all([session_id, command]):
                return {"status": "error", "message": "Missing required parameters"}, 400

            if session_id not in active_scripts:
                return {"status": "error", "message": "No active agent for this session. Load agent first."}, 404

            script_info = active_scripts[session_id]

            # Handle both dict and direct script storage formats
            if isinstance(script_info, dict):
                script = script_info.get('script')
                if not script:
                    return {"status": "error", "message": "No script found in session info"}, 404
            else:
                script = script_info

            try:
                print(f"[*] Executing command via agent: {command}")

                # Use the evaluate export from your agent
                result = script.exports.evaluate("repl_command", command)
                print(f"[+] Agent execution result: {result}")

                # Unwrap the modular response for backward compatibility
                # Agent may return: { success, data: {...} } or { success, result: { success, data: {...} } }
                if isinstance(result, dict) and 'success' in result:
                    if result.get('success', False):
                        # Extract data from 'data' key, or 'result' key, or use the whole dict
                        unwrapped_data = result.get('data', result.get('result', result))

                        # If the extracted value itself has { success, data }, unwrap one more level
                        if isinstance(unwrapped_data, dict) and 'success' in unwrapped_data:
                            if 'data' in unwrapped_data:
                                unwrapped_data = unwrapped_data.get('data', unwrapped_data)
                            elif 'result' in unwrapped_data:
                                unwrapped_data = unwrapped_data.get('result', unwrapped_data)

                        return {
                            "status": "success",
                            "result": unwrapped_data
                        }
                    else:
                        # For errors, keep the error information
                        return {
                            "status": "error",
                            "message": result.get('message', 'Command execution failed'),
                            "error": result.get('error', 'Unknown error')
                        }, 400

                # For non-modular responses, return as-is
                return {"status": "success", "result": result}

            except Exception as e:
                print(f"[!] Agent execution error: {e}")
                return {"status": "error", "message": f"Execution error: {str(e)}"}, 500

        except Exception as e:
            logger.exception(f"Error executing command with agent: {e}")
            return {"status": "error", "message": str(e)}, 500


@frida_namespace.route('/execute-feature')
class FridaExecuteFeature(Resource):
    def post(self):
        try:
            data = request.get_json()
            session_id = data.get("session_id")
            device_id = data.get("device_id")
            pid = data.get("pid")
            platform = data.get("platform")
            category = data.get("category")
            feature = data.get("feature")

            print(f"Session ID: {session_id}, Device ID: {device_id}, PID: {pid}, Platform: {platform}, ")
            print(f"Category: {category}, Feature: {feature}")

            if not all([session_id, platform, category, feature]):
                return {"status": "error", "message": "Missing required parameters"}, 400

            if session_id not in active_scripts:
                return {"status": "error", "message": "No active agent for this session. Load agent first."}, 404

            script_info = active_scripts[session_id]
            script = script_info['script']
            print(f"Script info: {script}")

            try:
                print(f"[*] Executing feature: {platform}.{category}.{feature}")

                # Get the appropriate command for this feature
                command = get_feature_command(platform, category, feature)
                print(f"[*] Command to execute: {command}")

                # Use your existing agent evaluate function
                result = script.exports.evaluate(f"feature_{platform}_{category}_{feature}", command)
                print(f"[+] Feature execution result: {result}")

                # Handle nested response format (same as execute-with-agent)
                if isinstance(result, dict) and 'success' in result:
                    if not result.get('success', False):
                        return {
                            "status": "error",
                            "message": f"Feature {feature} execution failed",
                            "error": result.get('error', 'Unknown error')
                        }, 400

                    nested_data = result.get('data', {})
                    if isinstance(nested_data, dict) and 'success' in nested_data:
                        if not nested_data.get('success', False):
                            return {
                                "status": "error",
                                "message": f"Feature {feature} execution failed",
                                "error": nested_data.get('error', 'Unknown nested error')
                            }, 400

                        return {
                            "status": "success",
                            "result": nested_data.get('data', nested_data)
                        }

                    return {
                        "status": "success",
                        "result": nested_data
                    }

                # For simple results, wrap in success response
                return {"status": "success", "result": result}

            except Exception as e:
                print(f"[!] Feature execution error: {e}")
                return {"status": "error", "message": f"Feature execution error: {str(e)}"}, 500

        except Exception as e:
            logger.exception(f"Error executing feature: {e}")
            return {"status": "error", "message": str(e)}, 500


@frida_namespace.route('/start-feature')
class FridaStartFeature(Resource):
    def post(self):
        try:
            data = request.get_json()
            session_id = data.get("session_id")
            device_id = data.get("device_id")
            pid = data.get("pid")
            platform = data.get("platform")
            category = data.get("category")
            feature = data.get("feature")

            if not all([session_id, platform, category, feature]):
                return {"status": "error", "message": "Missing required parameters"}, 400

            if session_id not in active_scripts:
                return {"status": "error", "message": "No active agent for this session. Load agent first."}, 404

            script_info = active_scripts[session_id]
            script = script_info['script']

            try:
                print(f"[*] Starting feature: {platform}.{category}.{feature}")

                # Get the appropriate command for this feature
                command = get_feature_command(platform, category, feature)
                print(f"[*] Command to execute: {command}")

                # Use your existing agent evaluate function
                result = script.exports.evaluate(f"start_{platform}_{category}_{feature}", command)
                print(f"[+] Feature start result: {result}")

                # Handle nested response format
                if isinstance(result, dict) and 'success' in result:
                    if not result.get('success', False):
                        return {
                            "status": "error",
                            "message": f"Feature {feature} start failed",
                            "error": result.get('error', 'Unknown error')
                        }, 400

                    return {
                        "status": "success",
                        "result": result.get('data', result)
                    }

                # For simple results, wrap in success response
                return {"status": "success", "result": result}

            except Exception as e:
                print(f"[!] Feature start error: {e}")
                return {"status": "error", "message": f"Feature start error: {str(e)}"}, 500

        except Exception as e:
            logger.exception(f"Error starting feature: {e}")
            return {"status": "error", "message": str(e)}, 500


@frida_namespace.route('/stop-feature')
class FridaStopFeature(Resource):
    def post(self):
        try:
            data = request.get_json()
            session_id = data.get("session_id")
            platform = data.get("platform")
            category = data.get("category")
            feature = data.get("feature")

            if not all([session_id, platform, category, feature]):
                return {"status": "error", "message": "Missing required parameters"}, 400

            if session_id not in active_scripts:
                return {"status": "error", "message": "No active agent for this session. Load agent first."}, 404

            script_info = active_scripts[session_id]
            script = script_info['script']

            try:
                print(f"[*] Stopping feature: {platform}.{category}.{feature}")

                # Get the appropriate stop command for this feature
                stop_command = get_stop_feature_command(platform, category, feature)
                print(f"[*] Stop command to execute: {stop_command}")

                result = script.exports.evaluate(f"stop_{platform}_{category}_{feature}", stop_command)
                print(f"[+] Feature stop result: {result}")

                # Handle nested response format
                if isinstance(result, dict) and 'success' in result:
                    if not result.get('success', False):
                        return {
                            "status": "error",
                            "message": f"Feature {feature} stop failed",
                            "error": result.get('error', 'Unknown error')
                        }, 400

                    return {
                        "status": "success",
                        "result": result.get('data', result)
                    }

                return {"status": "success", "result": result}

            except Exception as e:
                print(f"[!] Feature stop error: {e}")
                return {"status": "error", "message": f"Feature stop error: {str(e)}"}, 500

        except Exception as e:
            logger.exception(f"Error stopping feature: {e}")
            return {"status": "error", "message": str(e)}, 500


@frida_namespace.route('/feature-stream/<session_id>/<platform>/<category>/<feature>')
class FridaFeatureStream(Resource):
    def get(self, session_id, platform, category, feature):
        authorization = StreamAuthorization(request.headers.get("Authorization", ""))
        def event_stream():
            queue_key = f"{session_id}_{platform}_{category}_{feature}"
            queue = Queue()
            hook_queues[queue_key] = queue

            try:
                while authorization.valid():
                    # Use timeout so we can periodically check if the session is still alive
                    try:
                        message = queue.get(timeout=10)
                    except QueueEmpty:
                        if not authorization.valid():
                            return
                        # Queue.get timed out — check if session is still alive
                        if session_id not in active_scripts:
                            # Session gone (process crashed or unloaded)
                            crash_msg = {
                                "type": "error",
                                "reason": "process_crashed",
                                "message": "Process terminated or session lost"
                            }
                            yield f"data: {json.dumps(crash_msg)}\n\n"
                            return
                        continue

                    if not authorization.valid():
                        return
                    # Now message is a dict, so we JSON encode it here
                    yield f"data: {json.dumps(message)}\n\n"

            except Exception as e:
                logger.error(f"Feature stream error for {queue_key}: {e}")
                # Send crash notification before closing
                try:
                    crash_msg = {
                        "type": "error",
                        "reason": "process_crashed",
                        "message": str(e)
                    }
                    yield f"data: {json.dumps(crash_msg)}\n\n"
                except Exception:
                    pass
            finally:
                if queue_key in hook_queues:
                    del hook_queues[queue_key]

        response = Response(stream_with_context(event_stream()), content_type='text/event-stream')
        response.headers['Cache-Control'] = 'no-cache'
        response.headers['Connection'] = 'keep-alive'
        response.headers['X-Accel-Buffering'] = 'no'
        return response


# UPDATED LOAD AGENT WITH TIMEOUT FIXES
