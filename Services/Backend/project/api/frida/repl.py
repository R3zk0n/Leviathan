"""Frida REPL init / execute / close endpoints."""

from project.api.frida._shared import *  # noqa: F401,F403 (shared surface)
from project.api.frida.helpers import *  # noqa: F401,F403 (helper functions)


@frida_namespace.route("/repl/init")
class FridaREPLInit(Resource):
    def post(self):
        """
        Initialize REPL session with dynamically loaded bridges from frida_tools site-packages.
        Uses the packaging format () to bundle bridge and user scripts.
        """
        try:
            data = request.get_json()
            device_id = data.get("device_id")
            pid = data.get("pid")
            session_id = data.get("session_id", str(uuid4()))
            os_type = data.get("os_type")  # Optional: 'iOS' or 'Android'

            if not all([device_id, pid]):
                return {
                    "status": "error",
                    "message": "Missing required parameters",
                }, 400

            logger.info(
                f"[REPL Init] Starting REPL initialization for session {session_id}"
            )

            # Idempotent re-init: if this session already has a REPL script loaded,
            # unload + detach it before creating a new one, so re-initializing (e.g.
            # the "Reload bridges" button) can't orphan the previous script on the
            # target or leak an attached session.
            existing = repl_sessions.pop(session_id, None)
            if existing:
                try:
                    if existing.get("script"):
                        existing["script"].unload()
                    if existing.get("session"):
                        existing["session"].detach()
                    logger.info(
                        f"[REPL Init] Replaced existing REPL session {session_id}"
                    )
                except Exception as cleanup_err:
                    logger.warning(
                        f"[REPL Init] Old session cleanup failed for {session_id}: {cleanup_err}"
                    )

            device = resolve_device(device_id)
            session = device.attach(int(pid))

            # Surface an unexpected detach (process crash / device drop) instead of
            # letting the session wedge, and purge the dead handle so the next
            # attach/init starts clean. An app-requested detach is our own teardown
            # (Reload bridges / close), so don't alarm on it.
            def _on_repl_detached(reason, *args):
                logger.info(f"[REPL] Session {session_id} detached: {reason}")
                repl_sessions.pop(session_id, None)
                reason_s = str(reason).lower()
                if "requested" in reason_s or "replaced" in reason_s:
                    return
                q = hook_queues.get(session_id)
                if q is not None:
                    try:
                        q.put(
                            f"[session] lost: {reason} - the process may have crashed or the device dropped. Re-attach to continue."
                        )
                    except Exception:
                        pass

            try:
                session.on("detached", _on_repl_detached)
            except Exception as _e:
                logger.warning(f"[REPL] Could not register detached handler: {_e}")

            init_messages = []
            init_complete = threading.Event()
            runtime_info = {}

            # Detect device OS type (iOS or Android)
            if not os_type:
                os_type = detect_device_os_type(device)
                if not os_type:
                    return {
                        "status": "error",
                        "message": "Could not detect device OS type. Please specify os_type parameter.",
                    }, 400

            os_type_lower = os_type.lower()
            init_messages.append(f"Detected device type: {os_type}")
            logger.info(f"[REPL Init] Device OS type: {os_type}")

            # Determine bridge type
            if "android" in os_type_lower or "linux" in os_type_lower:
                bridge_type = "android"
            elif "ios" in os_type_lower or "darwin" in os_type_lower:
                bridge_type = "ios"
            else:
                return {
                    "status": "error",
                    "message": f"Unsupported OS type: {os_type}",
                }, 400

            # Load bridge script from frida_tools
            try:
                bridge_script = load_bridge_script(bridge_type)
                bridge_name = "Java" if bridge_type == "android" else "ObjC"
                init_messages.append(
                    f"{bridge_name} bridge loaded from frida_tools ({len(bridge_script)} bytes)"
                )
                logger.info(f"[REPL Init] {bridge_name} bridge loaded successfully")
            except (ValueError, FileNotFoundError) as e:
                logger.error(f"[REPL Init] Failed to load bridge: {e}")
                return {"status": "error", "message": str(e)}, 500

            # Create RPC interface script for command execution
            rpc_interface = """
// Capture the TRUE native console up front so REPL-eval output can be returned
// inline WITHOUT also streaming it (otherwise every console.log shows up twice:
// once in the command result and once via the SSE hook stream).
var __nativeConsole = { log: console.log, warn: console.warn, error: console.error, info: console.info };

// Setup permanent console streaming for async callbacks (Interceptors, etc.)
(function() {
    var originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info
    };

    // Permanently override console methods to stream to frontend
    ['log', 'warn', 'error', 'info'].forEach(function(method) {
        console[method] = function() {
            var args = Array.prototype.slice.call(arguments);
            var message = args.map(function(arg) {
                if (typeof arg === 'object' && arg !== null) {
                    try {
                        return JSON.stringify(arg, null, 2);
                    } catch(e) {
                        return String(arg);
                    }
                }
                return String(arg);
            }).join(' ');

            // Send to backend for streaming to frontend
            send({
                type: 'console_stream',
                level: method,
                message: message,
                timestamp: Date.now()
            });

            // Still call original for backend logs
            originalConsole[method].apply(console, args);
        };
    });

    console.log('[REPL] Console streaming enabled - async output will appear in REPL');
})();

// RPC interface for executing commands in the bridge context
rpc.exports = {
    eval: function(code) {
        var result;
        var logs = [];

        // Capture console output during eval
        var originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            info: console.info
        };

        try {
            // Temporarily override console methods to capture output
            ['log', 'warn', 'error', 'info'].forEach(function(method) {
                console[method] = function() {
                    var args = Array.prototype.slice.call(arguments);
                    var message = args.map(function(arg) {
                        if (typeof arg === 'object' && arg !== null) {
                            try {
                                return JSON.stringify(arg, null, 2);
                            } catch(e) {
                                return String(arg);
                            }
                        }
                        return String(arg);
                    }).join(' ');

                    logs.push({level: method, message: message});

                    // Route sync eval output to the TRUE native console only — NOT the
                    // streaming wrapper — so it is returned inline once and not also
                    // pushed to the SSE stream (the console.log-appears-twice bug).
                    __nativeConsole[method].apply(console, args);
                };
            });

            result = (1, eval)(code); // Indirect eval for global scope

            // Restore console
            console.log = originalConsole.log;
            console.warn = originalConsole.warn;
            console.error = originalConsole.error;
            console.info = originalConsole.info;

            // Handle undefined explicitly (convert to null for JSON transfer)
            if (result === undefined) {
                result = null;
            }

            // Handle Java objects specially
            if (typeof Java !== 'undefined' && Java.available) {
                if (result !== null && typeof result === 'object' && result.$className !== undefined) {
                    return {
                        type: 'java_object',
                        className: result.$className,
                        toString: result.toString(),
                        logs: logs
                    };
                }
            }

            // Handle ObjC objects specially
            if (typeof ObjC !== 'undefined' && ObjC.available) {
                if (result !== null && typeof result === 'object' && result.$className !== undefined) {
                    return {
                        type: 'objc_object',
                        className: result.$className,
                        description: result.toString(),
                        logs: logs
                    };
                }
            }

            // Handle functions
            if (typeof result === 'function') {
                return {
                    type: 'function',
                    name: result.name || 'anonymous',
                    string: result.toString().substring(0, 200), // Truncate for safety
                    logs: logs
                };
            }

            // Return result with captured logs
            return {
                type: 'result',
                value: result,
                logs: logs
            };
        } catch (e) {
            // Restore console on error
            console.log = originalConsole.log;
            console.warn = originalConsole.warn;
            console.error = originalConsole.error;
            console.info = originalConsole.info;

            return {
                type: 'error',
                message: e.message,
                stack: e.stack,
                logs: logs
            };
        }
    },
    checkRuntimes: function() {
        return {
            java: typeof Java !== 'undefined' && Java.available,
            objc: typeof ObjC !== 'undefined' && ObjC.available,
            platform: Process.platform,
            arch: Process.arch
        };
    }
};

// Send init complete message
send({type: 'init_complete', runtimes: rpc.exports.checkRuntimes()});
"""

            # Build final packaged script using the packaging format
            raw_fragments = [bridge_script, rpc_interface]
            final_script = build_final_script(raw_fragments)

            logger.info(
                f"[REPL Init] Final packaged script size: {len(final_script)} bytes"
            )
            init_messages.append(f"Packaged script created ({len(final_script)} bytes)")

            # Message handler for initialization and console streaming
            def on_message(message, data):
                if message["type"] == "send":
                    payload = message.get("payload", {})
                    if isinstance(payload, dict):
                        msg_type = payload.get("type")

                        if msg_type == "init_complete":
                            runtimes = payload.get("runtimes", {})
                            runtime_info.update(runtimes)

                            # Send messages based on what's available
                            if runtimes.get("java"):
                                init_messages.append("Java runtime available")
                                logger.info(
                                    "[REPL Init] Java runtime confirmed available"
                                )
                            if runtimes.get("objc"):
                                init_messages.append("ObjC runtime available")
                                logger.info(
                                    "[REPL Init] ObjC runtime confirmed available"
                                )
                            if not runtimes.get("java") and not runtimes.get("objc"):
                                init_messages.append("No platform runtimes detected")
                                logger.warning(
                                    "[REPL Init] No platform runtimes available"
                                )

                            init_complete.set()

                        elif msg_type == "console_stream":
                            # Handle streaming console output from Interceptors, timers, etc.
                            level = payload.get("level", "log")
                            console_msg = payload.get("message", "")
                            formatted_msg = f"[{level}] {console_msg}"

                            # Send to hook queue for streaming to frontend
                            if session_id in hook_queues:
                                hook_queues[session_id].put(formatted_msg)

                            # Log to backend
                            logger.info(f"[REPL Stream] {formatted_msg}")

                elif message["type"] == "error":
                    error_msg = message.get("description", "Unknown error")
                    init_messages.append(f"{error_msg}")
                    logger.error(f"[REPL Init] Script error: {error_msg}")

            # Create and load the script
            script = session.create_script(final_script)
            script.on("message", on_message)
            script.load()

            # Wait for initialization to complete
            if not init_complete.wait(timeout=10):
                logger.error("[REPL Init] Initialization timeout")
                return {
                    "status": "error",
                    "message": "REPL initialization timeout",
                }, 500

            runtime_info["bridge_type"] = bridge_type
            runtime_info["using_dynamic_bridge"] = True

            # Store the session with the persistent REPL script
            repl_sessions[session_id] = {
                "device": device,
                "session": session,
                "script": script,
                "device_id": device_id,
                "pid": pid,
                "runtime_info": runtime_info,
                "repl_initialized": True,
                "bridge_type": bridge_type,
            }

            # Initialize message queue
            if session_id not in hook_queues:
                hook_queues[session_id] = Queue()

            logger.info(
                f"[REPL Init] REPL session {session_id} initialized successfully"
            )

            return {
                "status": "success",
                "session_id": session_id,
                "runtime_info": runtime_info,
                "messages": init_messages,
            }

        except Exception as e:
            logger.exception(f"Error initializing REPL: {e}")
            return {"status": "error", "message": str(e)}, 500


@frida_namespace.route("/execute")
class FridaExecute(Resource):
    def post(self):
        try:
            data = request.get_json()
            device_id = data.get("device_id")
            session_id = data.get("session_id")
            pid = data.get("pid")
            command = data.get("command")

            if not device_id:
                return {"status": "error", "message": "Missing device_id"}, 400
            if not pid:
                return {"status": "error", "message": "Missing pid"}, 400

            # A command must run inside an initialized REPL session so it has the
            # Java/ObjC bridges. If the session is missing (never initialized, or lost
            # to a crash/detach), return a clear re-init signal instead of silently
            # running a bridge-less one-off eval that yields different/wrong results.
            if session_id and session_id in repl_sessions:
                return self._execute_in_repl_session(session_id, command)
            # Return 200 (not 4xx) so the frontend's status-field handling surfaces
            # this guidance instead of axios throwing a generic "status code" error.
            return {
                "status": "error",
                "code": "repl_not_initialized",
                "message": "No initialized REPL session for this id. Load/Reload bridges (or re-attach) and try again.",
            }

        except Exception as e:
            logger.exception(f"Error executing Frida command: {e}")
            return {"status": "error", "message": str(e)}, 500

    def _execute_in_repl_session(self, session_id, command):
        """Execute command in persistent REPL session"""
        try:
            repl_data = repl_sessions[session_id]
            session = repl_data["session"]
            script = repl_data.get("script")

            # Check if this session has an initialized REPL with RPC exports
            if script is not None and repl_data.get("repl_initialized"):
                # Use RPC to execute in the persistent script context
                try:
                    result = rpc_eval_with_timeout(script, command, timeout=30)
                    logger.info(
                        f"[REPL Execute] RPC eval returned: {result} (type: {type(result)})"
                    )

                    # Extract logs if present
                    logs = []
                    if isinstance(result, dict):
                        logs = result.get("logs", [])

                    # Build console output from logs
                    console_output = []
                    for log in logs:
                        level = log.get("level", "log")
                        message = log.get("message", "")
                        console_output.append(f"[{level}] {message}")

                    # Handle error responses
                    if isinstance(result, dict) and result.get("type") == "error":
                        error_output = f"[error] {result.get('message', 'Unknown error')}\n{result.get('stack', '')}"
                        # Prepend console output if any
                        if console_output:
                            error_output = (
                                "\n".join(console_output) + "\n" + error_output
                            )
                        return {
                            "status": "success",
                            "result": error_output,
                            "output": error_output,
                        }

                    # Handle Java/ObjC object and function responses
                    if isinstance(result, dict):
                        formatted_result = None

                        if result.get("type") == "java_object":
                            formatted_result = (
                                f"<{result.get('className')}> {result.get('toString')}"
                            )
                        elif result.get("type") == "objc_object":
                            formatted_result = f"<{result.get('className')}> {result.get('description')}"
                        elif result.get("type") == "function":
                            formatted_result = f"[Function: {result.get('name')}]"
                        elif result.get("type") == "result":
                            # Handle the new result format with value and logs
                            value = result.get("value")

                            # Format the result value
                            if value is None:
                                # If there are console logs and result is undefined, don't show "undefined"
                                if console_output:
                                    formatted_result = (
                                        None  # Will only show console output
                                    )
                                else:
                                    formatted_result = "undefined"
                            elif isinstance(value, bool):
                                formatted_result = "true" if value else "false"
                            elif isinstance(value, (dict, list)):
                                formatted_result = json.dumps(value, indent=2)
                            elif isinstance(value, str):
                                formatted_result = value
                            else:
                                formatted_result = str(value)

                        if formatted_result is not None:
                            # Prepend console output if any
                            if console_output:
                                full_output = (
                                    "\n".join(console_output) + "\n" + formatted_result
                                )
                            else:
                                full_output = formatted_result
                            return {
                                "status": "success",
                                "result": full_output,
                                "output": full_output,
                            }
                        elif console_output:
                            # Only console output, no result to show
                            full_output = "\n".join(console_output)
                            return {
                                "status": "success",
                                "result": full_output,
                                "output": full_output,
                            }

                    # Fallback: handle raw result (shouldn't happen with new format)
                    if result is None:
                        result_str = "undefined"
                    elif isinstance(result, bool):
                        result_str = "true" if result else "false"
                    elif isinstance(result, (dict, list)):
                        result_str = json.dumps(result, indent=2)
                    elif isinstance(result, str):
                        result_str = result
                    else:
                        result_str = str(result)

                    # Prepend console output if any
                    if console_output:
                        result_str = "\n".join(console_output) + "\n" + result_str

                    logger.info(f"[REPL Execute] Returning result: {result_str}")
                    return {
                        "status": "success",
                        "result": result_str,
                        "output": result_str,
                    }
                except TimeoutError as e:
                    logger.warning(f"[REPL Execute] command timed out: {e}")
                    msg = "[Timeout] command did not return within 30s - it may be blocking (a busy loop or a synchronous native call). The REPL session is still alive; re-run in a non-blocking form."
                    return {"status": "success", "result": msg, "output": msg}
                except Exception as e:
                    logger.error(f"RPC eval error: {e}")
                    import traceback

                    logger.error(traceback.format_exc())
                    # Fall through to old method if RPC fails

            # Fallback to old execution method (creates new script each time)
            output = []
            result_ready = threading.Event()

            # Execute in the context where runtimes are already loaded
            exec_script = f"""
            (async function() {{
                var logs = [];
                var result;

                // Capture console output
                ['log', 'warn', 'error', 'info'].forEach(function(method) {{
                    var original = console[method];
                    console[method] = function() {{
                        var args = Array.prototype.slice.call(arguments);
                        var message = args.map(function(arg) {{
                            if (typeof arg === 'object' && arg !== null) {{
                                try {{ return JSON.stringify(arg, null, 2); }}
                                catch(e) {{ return String(arg); }}
                            }}
                            return String(arg);
                        }}).join(' ');
                        logs.push({{level: method, message: message}});
                        original.apply(console, args);
                    }};
                }});

                try {{
                    // For Java commands, wrap in Java.perform if needed
                    var commandStr = {json.dumps(command)};

                    if (typeof Java !== 'undefined' && Java.available && 
                        (commandStr.includes('Java.') || commandStr.includes('Java.'))) {{

                        await new Promise((resolve, reject) => {{
                            Java.perform(function() {{
                                try {{
                                    result = eval(commandStr);
                                    resolve();
                                }} catch (e) {{
                                    reject(e);
                                }}
                            }});
                        }});
                    }} else {{
                        result = await eval(commandStr);
                    }}

                    // Serialize result
                    if (result !== undefined) {{
                        if (typeof result === 'function') {{
                            result = '[Function: ' + (result.name || 'anonymous') + ']';
                        }} else if (typeof result === 'object' && result !== null) {{
                            try {{
                                result = JSON.stringify(result, null, 2);
                            }} catch(e) {{
                                result = '[Object: ' + Object.prototype.toString.call(result) + ']';
                            }}
                        }} else {{
                            result = String(result);
                        }}
                    }} else {{
                        result = 'undefined';
                    }}
                }} catch (e) {{
                    logs.push({{
                        level: 'error',
                        message: e.name + ': ' + e.message + '\\n' + (e.stack || '')
                    }});
                    result = null;
                }}

                send({{
                    type: 'result',
                    logs: logs,
                    result: result
                }});
            }})();
            """

            script = session.create_script(exec_script)

            def on_message(message, data):
                if message["type"] == "send":
                    payload = message.get("payload", {})
                    if isinstance(payload, dict) and payload.get("type") == "result":
                        for log in payload.get("logs", []):
                            log_line = f"[{log['level']}] {log['message']}"
                            output.append(log_line)
                            if session_id in hook_queues:
                                hook_queues[session_id].put(log_line)

                        result = payload.get("result")
                        if result:
                            output.append(result)
                            if session_id in hook_queues:
                                hook_queues[session_id].put(result)

                        result_ready.set()
                elif message["type"] == "error":
                    error_message = f"Error: {message.get('description', 'Unknown')}\n{message.get('stack', '')}"
                    output.append(error_message)
                    if session_id in hook_queues:
                        hook_queues[session_id].put(error_message)
                    result_ready.set()

            script.on("message", on_message)
            script.load()

            if not result_ready.wait(timeout=10):
                output.append("[Timeout: No response after 10 seconds]")

            # Clean up the execution script
            try:
                script.unload()
            except:
                pass

            return {"status": "success", "output": "\n".join(output)}

        except Exception as e:
            logger.exception(f"Error executing in REPL session: {e}")
            return {"status": "error", "message": str(e)}, 500


@frida_namespace.route("/repl/close")
class FridaREPLClose(Resource):
    def post(self):
        try:
            data = request.get_json()
            session_id = data.get("session_id")

            if not session_id or session_id not in repl_sessions:
                return {"status": "error", "message": "Invalid session_id"}, 400

            repl_data = repl_sessions[session_id]

            try:
                repl_data["script"].unload()
                repl_data["session"].detach()
            except:
                pass

            del repl_sessions[session_id]

            if session_id in hook_queues:
                del hook_queues[session_id]

            return {"status": "success", "message": "REPL session closed"}

        except Exception as e:
            logger.exception(f"Error closing REPL: {e}")
            return {"status": "error", "message": str(e)}, 500
