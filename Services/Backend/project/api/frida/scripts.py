"""Script monitor/persist/kill, hooks, and JS bridge-file endpoints."""

from project.api.frida._shared import *  # noqa: F401,F403  (shared surface)
from project.api.frida.helpers import *  # noqa: F401,F403  (helper functions)


@frida_namespace.route("/bridges/<string:bridge_name>")
class FridaBridgeFile(Resource):
    def get(self, bridge_name):
        """
        Serve bridge JavaScript files from frida_tools for Monaco IntelliSense
        """
        try:
            # Validate bridge name
            valid_bridges = ["java.js", "objc.js", "swift.js"]
            if bridge_name not in valid_bridges:
                return {
                    "status": "error",
                    "message": f"Invalid bridge name. Must be one of: {valid_bridges}",
                }, 400

            # Find frida_tools path
            frida_tools_path = find_frida_tools_path()
            if not frida_tools_path:
                return {"status": "error", "message": "frida_tools not found"}, 404

            # Read bridge file
            bridge_path = os.path.join(frida_tools_path, "bridges", bridge_name)
            if not os.path.exists(bridge_path):
                return {
                    "status": "error",
                    "message": f"Bridge file not found: {bridge_path}",
                }, 404

            with open(bridge_path, "r", encoding="utf-8") as f:
                bridge_content = f.read()

            logger.info(
                f"[Bridges] Serving {bridge_name} ({len(bridge_content)} bytes)"
            )

            return {
                "status": "success",
                "bridge_name": bridge_name,
                "content": bridge_content,
                "size": len(bridge_content),
            }

        except Exception as e:
            logger.exception(f"Error serving bridge file: {e}")
            return {"status": "error", "message": str(e)}, 500


@frida_namespace.route("/monitor_script")
class FridaMonitorScript(Resource):
    def post(self):
        try:
            data = request.get_json()
            device_id = data.get("device_id")
            session_id = data.get("session_id")
            pid = data.get("pid")
            script_content = data.get("script")

            print(f"Device ID: {device_id}, Session ID: {session_id}, PID: {pid}")

            if not all([device_id, session_id, pid, script_content]):
                return {
                    "status": "error",
                    "message": "Missing required parameters",
                }, 400

            try:
                device = frida.get_device_manager().get_device(device_id)
            except frida.InvalidArgumentError:
                if device_id.startswith("socket@"):
                    host, port = device_id.split("@")[1].split(":")
                    device = frida.get_device_manager().add_remote_device(
                        f"{host}:{port}"
                    )
                else:
                    return {
                        "status": "error",
                        "message": "Device not found and unable to reconnect",
                    }, 404

            session = device.attach(int(pid))

            def on_message(message, data):
                if session_id in hook_queues:
                    if message["type"] == "send":
                        payload = message["payload"]
                        if isinstance(payload, dict) and "type" in payload:
                            if payload["type"] == "log":
                                hook_queues[session_id].put(
                                    f"Log: {payload['payload']}"
                                )
                            else:
                                hook_queues[session_id].put(f"Message: {payload}")
                        else:
                            hook_queues[session_id].put(f"Script output: {payload}")
                    elif message["type"] == "error":
                        hook_queues[session_id].put(
                            f"Script error: {message['description']}"
                        )
                        print(f"Script error: {message}")  # Debug print
                else:
                    print(f"No queue for session {session_id}")

            wrapped_script = f"""
                (function() {{
                    var originalConsoleLog = console.log;
                    console.log = function() {{
                        var args = Array.prototype.slice.call(arguments);
                        send({{type: 'log', payload: args.join(' ')}});
                        originalConsoleLog.apply(this, arguments);
                    }};

                    {script_content}
                }})();
            """

            script = session.create_script(wrapped_script)
            script.on("message", on_message)
            script.load()

            # Consistent storage format - check if session already has an entry
            if session_id in active_scripts:
                # If agent is already loaded, we might have a dict
                if isinstance(active_scripts[session_id], dict):
                    active_scripts[session_id]["monitor_script"] = script
                else:
                    # Convert to dict format for consistency
                    old_script = active_scripts[session_id]
                    active_scripts[session_id] = {
                        "agent_script": old_script,
                        "monitor_script": script,
                        "session": session,
                        "device_id": device_id,
                        "pid": pid,
                    }
            else:
                # New entry
                active_scripts[session_id] = {
                    "monitor_script": script,
                    "session": session,
                    "device_id": device_id,
                    "pid": pid,
                }

            print(f"Script monitoring started for session {session_id}")
            return {"status": "success", "message": "Script monitoring started"}
        except Exception as e:
            logger.exception(f"Error in script monitoring: {e}")
            return {"status": "error", "message": str(e)}, 500

    def delete(self):
        try:
            data = request.get_json()
            session_id = data.get("session_id")

            if not session_id:
                return {"status": "error", "message": "Missing session_id"}, 400

            if session_id in active_scripts:
                script_info = active_scripts[session_id]

                # Handle both dict and direct script storage
                if isinstance(script_info, dict):
                    # Unload monitor script if it exists
                    if "monitor_script" in script_info:
                        try:
                            script_info["monitor_script"].unload()
                            print(f"Monitor script unloaded for session {session_id}")
                        except Exception as e:
                            print(f"Error unloading monitor script: {e}")
                        del script_info["monitor_script"]

                    # If only agent script remains, keep the session
                    if "agent_script" in script_info:
                        print(f"Keeping agent script for session {session_id}")
                        return {
                            "status": "success",
                            "message": "Script monitoring stopped, agent still active",
                        }
                    else:
                        # No scripts left, remove the session
                        del active_scripts[session_id]
                else:
                    # Old format - direct script object
                    try:
                        script_info.unload()
                        print(f"Script unloaded for session {session_id}")
                    except Exception as e:
                        print(f"Error unloading script: {e}")
                    del active_scripts[session_id]

                return {"status": "success", "message": "Script monitoring stopped"}
            else:
                return {
                    "status": "error",
                    "message": "No active script found for this session",
                }, 404

        except Exception as e:
            logger.exception(f"Error stopping script monitoring: {e}")
            return {"status": "error", "message": str(e)}, 500


@frida_namespace.route("/run_persistent_script")
class FridaRunPersistentScript(Resource):
    """
    Run a script from Monaco editor as a persistent, killable script.
    Unlike execute endpoint, this keeps the script loaded so it can be killed later.
    """

    def post(self):
        try:
            data = request.get_json()
            device_id = data.get("device_id")
            session_id = data.get("session_id")
            pid = data.get("pid")
            script_content = data.get("script")

            if not all([device_id, session_id, pid, script_content]):
                return {
                    "status": "error",
                    "message": "Missing required parameters",
                }, 400

            try:
                device = frida.get_device_manager().get_device(device_id)
            except frida.InvalidArgumentError:
                if device_id.startswith("socket@"):
                    host, port = device_id.split("@")[1].split(":")
                    device = frida.get_device_manager().add_remote_device(
                        f"{host}:{port}"
                    )
                else:
                    return {
                        "status": "error",
                        "message": "Device not found and unable to reconnect",
                    }, 404

            session = device.attach(int(pid))

            # Ensure hook queue exists for this session before loading script
            if session_id not in hook_queues:
                hook_queues[session_id] = Queue()
                logger.info(f"Created hook queue for session {session_id}")

            def on_message(message, data):
                if session_id in hook_queues:
                    if message["type"] == "send":
                        payload = message["payload"]
                        if isinstance(payload, dict):
                            if payload.get("type") == "log":
                                hook_queues[session_id].put(
                                    f"Log: {payload['payload']}"
                                )
                            else:
                                hook_queues[session_id].put(f"Message: {payload}")
                        else:
                            hook_queues[session_id].put(f"Script output: {payload}")
                    elif message["type"] == "error":
                        hook_queues[session_id].put(
                            f"Script error: {message['description']}"
                        )

            # Wrap script to capture console output AND return value
            wrapped_script = f"""
                (function() {{
                    var originalConsoleLog = console.log;
                    var logs = [];

                    console.log = function() {{
                        var args = Array.prototype.slice.call(arguments);
                        var message = args.join(' ');
                        send({{type: 'log', payload: message}});
                        logs.push(message);
                        originalConsoleLog.apply(this, arguments);
                    }};

                    var result;
                    try {{
                        result = eval({json.dumps(script_content)});

                        // Send initial result back for immediate feedback
                        if (result !== undefined) {{
                            var resultStr;
                            if (typeof result === 'function') {{
                                resultStr = '[Function: ' + (result.name || 'anonymous') + ']';
                            }} else if (typeof result === 'object' && result !== null) {{
                                try {{
                                    resultStr = JSON.stringify(result, null, 2);
                                }} catch(e) {{
                                    resultStr = '[Object: ' + Object.prototype.toString.call(result) + ']';
                                }}
                            }} else {{
                                resultStr = String(result);
                            }}
                            send({{type: 'result', value: resultStr, logs: logs}});
                        }} else if (logs.length > 0) {{
                            send({{type: 'result', value: 'undefined', logs: logs}});
                        }}
                    }} catch (e) {{
                        send({{type: 'error', message: e.name + ': ' + e.message, stack: e.stack}});
                    }}
                }})();
            """

            # Capture initial result
            initial_output = []
            result_received = threading.Event()

            def on_message_with_result(message, data):
                if message["type"] == "send":
                    payload = message["payload"]
                    if isinstance(payload, dict):
                        if payload.get("type") == "log":
                            log_msg = f"Log: {payload['payload']}"
                            initial_output.append(log_msg)
                            if session_id in hook_queues:
                                hook_queues[session_id].put(log_msg)
                        elif payload.get("type") == "result":
                            # Capture initial result for immediate feedback
                            for log in payload.get("logs", []):
                                if f"Log: {log}" not in initial_output:
                                    initial_output.append(log)
                            if (
                                payload.get("value")
                                and payload.get("value") != "undefined"
                            ):
                                initial_output.append(f"=> {payload['value']}")
                            result_received.set()
                        elif payload.get("type") == "error":
                            error_msg = f"Error: {payload.get('message')}"
                            initial_output.append(error_msg)
                            if session_id in hook_queues:
                                hook_queues[session_id].put(error_msg)
                            result_received.set()
                        else:
                            msg = f"Message: {payload}"
                            initial_output.append(msg)
                            if session_id in hook_queues:
                                hook_queues[session_id].put(msg)
                    else:
                        msg = f"Script output: {payload}"
                        initial_output.append(msg)
                        if session_id in hook_queues:
                            hook_queues[session_id].put(msg)
                elif message["type"] == "error":
                    error_msg = f"Script error: {message['description']}"
                    initial_output.append(error_msg)
                    if session_id in hook_queues:
                        hook_queues[session_id].put(error_msg)
                    result_received.set()

            script = session.create_script(wrapped_script)
            script.on("message", on_message_with_result)
            script.load()

            # Wait briefly for initial result (for quick expressions)
            result_received.wait(timeout=2)

            # Store as 'run_script' so it can be killed
            if session_id in active_scripts:
                if isinstance(active_scripts[session_id], dict):
                    # Kill existing run_script if present
                    if "run_script" in active_scripts[session_id]:
                        try:
                            active_scripts[session_id]["run_script"].unload()
                        except:
                            pass
                    active_scripts[session_id]["run_script"] = script
                else:
                    old_script = active_scripts[session_id]
                    active_scripts[session_id] = {
                        "agent_script": old_script,
                        "run_script": script,
                        "session": session,
                        "device_id": device_id,
                        "pid": pid,
                    }
            else:
                active_scripts[session_id] = {
                    "run_script": script,
                    "session": session,
                    "device_id": device_id,
                    "pid": pid,
                }

            # Note: We keep the on_message_with_result handler
            # It handles both initial results and ongoing output

            logger.info(f"Persistent script started for session {session_id}")

            # Return immediate output if any
            if initial_output:
                return {
                    "status": "success",
                    "message": "Persistent script started and can be killed",
                    "output": "\n".join(initial_output),
                }
            else:
                return {
                    "status": "success",
                    "message": "Persistent script started and can be killed (long-running, check terminal for output)",
                }

        except Exception as e:
            logger.exception(f"Error running persistent script: {e}")
            return {"status": "error", "message": str(e)}, 500


@frida_namespace.route("/kill_script")
class FridaKillScript(Resource):
    """
    Kill/unload running Frida scripts for a session.
    This allows users to stop running scripts before loading new ones.
    """

    def post(self):
        try:
            data = request.get_json()
            session_id = data.get("session_id")
            script_type = data.get(
                "script_type", "all"
            )  # 'all', 'monitor', 'agent', or 'run'

            if not session_id:
                return {"status": "error", "message": "Missing session_id"}, 400

            # Check if there's anything to kill (active_scripts OR repl_sessions)
            if session_id not in active_scripts and session_id not in repl_sessions:
                return {
                    "status": "error",
                    "message": "No active scripts found for this session",
                }, 404

            unloaded_scripts = []

            # Handle active_scripts (monitor, agent, run scripts)
            if session_id in active_scripts:
                script_info = active_scripts[session_id]

                # Handle both dict and direct script storage formats
                if isinstance(script_info, dict):
                    # Kill run script (from Monaco editor RUN button)
                    if script_type in ["all", "run"] and "run_script" in script_info:
                        try:
                            script_info["run_script"].unload()
                            del script_info["run_script"]
                            unloaded_scripts.append("run_script")
                            logger.info(f"Run script killed for session {session_id}")
                        except Exception as e:
                            logger.error(f"Error killing run script: {e}")

                    # Kill monitor script
                    if (
                        script_type in ["all", "monitor"]
                        and "monitor_script" in script_info
                    ):
                        try:
                            script_info["monitor_script"].unload()
                            del script_info["monitor_script"]
                            unloaded_scripts.append("monitor_script")
                            logger.info(
                                f"Monitor script killed for session {session_id}"
                            )
                        except Exception as e:
                            logger.error(f"Error killing monitor script: {e}")

                    # Kill agent script
                    if (
                        script_type in ["all", "agent"]
                        and "agent_script" in script_info
                    ):
                        try:
                            script_info["agent_script"].unload()
                            del script_info["agent_script"]
                            unloaded_scripts.append("agent_script")
                            logger.info(f"Agent script killed for session {session_id}")
                        except Exception as e:
                            logger.error(f"Error killing agent script: {e}")

                    # If no scripts remain, clean up the session
                    if not any(
                        key in script_info
                        for key in ["monitor_script", "agent_script", "run_script"]
                    ):
                        # Close the session if it exists
                        if "session" in script_info:
                            try:
                                script_info["session"].detach()
                                logger.info(f"Session detached for {session_id}")
                            except Exception as e:
                                logger.warning(f"Error detaching session: {e}")

                        del active_scripts[session_id]
                        logger.info(f"Session {session_id} removed from active_scripts")

                        # Clean up the hook queue as well
                        if session_id in hook_queues:
                            del hook_queues[session_id]
                            logger.info(f"Hook queue removed for {session_id}")

                else:
                    # Old format - direct script object
                    try:
                        script_info.unload()
                        unloaded_scripts.append("script")
                        logger.info(f"Script killed for session {session_id}")
                    except Exception as e:
                        logger.error(f"Error killing script: {e}")

                    del active_scripts[session_id]

                    # Clean up the hook queue as well
                    if session_id in hook_queues:
                        del hook_queues[session_id]
                        logger.info(f"Hook queue removed for {session_id}")

            # Also check if there's a REPL session that should be killed
            killed_repl = False
            if session_id in repl_sessions:
                try:
                    repl_data = repl_sessions[session_id]
                    if "script" in repl_data:
                        repl_data["script"].unload()
                        logger.info(f"REPL script unloaded for session {session_id}")
                    del repl_sessions[session_id]
                    unloaded_scripts.append("repl_session")
                    killed_repl = True
                    logger.info(f"REPL session killed for {session_id}")
                except Exception as e:
                    logger.error(f"Error killing REPL session: {e}")

            if unloaded_scripts:
                message_parts = []
                if killed_repl:
                    message_parts.append("REPL session (stops all REPL scripts)")
                    unloaded_scripts.remove("repl_session")  # Don't show in script list
                if unloaded_scripts:
                    message_parts.append(f"scripts: {', '.join(unloaded_scripts)}")

                return {
                    "status": "success",
                    "message": f"Successfully killed {' and '.join(message_parts) if message_parts else 'REPL session'}",
                    "unloaded_scripts": unloaded_scripts,
                    "killed_repl": killed_repl,
                }
            else:
                return {
                    "status": "warning",
                    "message": f"No {script_type} scripts found to kill for this session",
                }, 200

        except Exception as e:
            logger.exception(f"Error killing scripts: {e}")
            return {"status": "error", "message": str(e)}, 500


@frida_namespace.route("/hooks/<session_id>")
class FridaHooks(Resource):
    def get(self, session_id):
        def event_stream():
            # Shared per-session queue: the REPL/agent message callbacks put()
            # output here keyed by session_id, and this SSE stream drains it. Create
            # it if the stream connects before init so early output isn't dropped.
            if session_id not in hook_queues:
                hook_queues[session_id] = Queue()
                logger.info(f"Created new hook queue for SSE connection: {session_id}")
            else:
                logger.info(
                    f"Using existing hook queue for SSE connection: {session_id}"
                )

            queue = hook_queues[session_id]

            # Tell the browser how quickly to auto-reconnect if the stream drops.
            yield "retry: 3000\n\n"

            try:
                while True:
                    try:
                        # Bounded wait so the generator wakes periodically instead of
                        # blocking a worker thread forever on an idle session.
                        message = queue.get(timeout=15)
                    except QueueEmpty:
                        # SSE comment line (ignored by the client). The write keeps
                        # proxies/browsers from culling an idle stream AND lets the
                        # server notice a disconnected client (-> GeneratorExit ->
                        # the finally block reclaims the thread/queue).
                        yield ": keepalive\n\n"
                        continue

                    # Send exactly what we received - no processing, no JSON wrapping
                    yield f"data: {json.dumps(message)}\n\n"

            except Exception as e:
                # GeneratorExit (client disconnect) is a BaseException, so it skips
                # this handler and falls straight to finally — which is what we want.
                logger.error(f"SSE Error for session {session_id}: {e}")
            finally:
                # Reclaim the queue only if the session is truly gone. A live REPL/
                # agent session keeps its queue so a reconnecting stream (and the
                # producer that still puts by session_id) keep sharing one queue.
                if session_id not in repl_sessions and session_id not in active_scripts:
                    hook_queues.pop(session_id, None)
                    logger.info(
                        f"SSE closed; reclaimed hook queue for dead session {session_id}"
                    )
                else:
                    logger.info(
                        f"SSE closed for session {session_id} (queue kept — session still live)"
                    )

        response = Response(
            stream_with_context(event_stream()), content_type="text/event-stream"
        )
        response.headers["Cache-Control"] = "no-cache"
        response.headers["Connection"] = "keep-alive"
        response.headers["X-Accel-Buffering"] = (
            "no"  # Disable nginx buffering for real-time
        )
        return response
