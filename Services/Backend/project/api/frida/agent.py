"""Agent load / status / unload endpoints."""

from project.api.frida._shared import *  # noqa: F401,F403  (shared surface)
from project.api.frida.helpers import *  # noqa: F401,F403  (helper functions)


@frida_namespace.route("/load-agent")
class FridaLoadAgent(Resource):
    def post(self):
        try:
            print("In the Load Agent module")
            data = request.get_json()
            device_id = data.get("device_id")
            pid = int(data.get("pid"))
            session_id = data.get("session_id", str(uuid4()))

            if not all([device_id, pid]):
                return {
                    "status": "error",
                    "message": "Missing required parameters",
                }, 400

            print(f"Device ID: {device_id}, PID: {pid}, Session ID: {session_id}")

            # Get the device
            try:
                device = resolve_device(device_id)
                print(f"[+] Connected to device: {device_id}")
            except Exception as e:
                print(f"[!] Failed to connect to device: {e}")
                return {
                    "status": "error",
                    "message": f"Failed to connect to device: {str(e)}",
                }, 404

            # Attach to process
            try:
                session = device.attach(pid)
                print(f"[+] Attached to process {pid}")

                # Surface crash / device-drop and purge dead state (see repl.py).
                def _on_agent_detached(reason, *args):
                    logger.info(f"[Agent] Session {session_id} detached: {reason}")
                    active_scripts.pop(session_id, None)
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
                    session.on("detached", _on_agent_detached)
                except Exception as _e:
                    logger.warning(f"[Agent] Could not register detached handler: {_e}")

                # Enable JIT if available (helps with performance)
                try:
                    if hasattr(session, "enable_jit"):
                        session.enable_jit()
                        print("[+] JIT enabled")
                except:
                    pass

            except frida.ProcessNotFoundError:
                return {
                    "status": "error",
                    "message": f"Process with PID {pid} not found",
                }, 404
            except Exception as e:
                print(f"[!] Failed to attach to process: {e}")
                return {
                    "status": "error",
                    "message": f"Failed to attach to process: {str(e)}",
                }, 500

            # Read the _agent.js file directly
            agent_path = "/usr/src/app/_agent.js"

            try:
                with open(agent_path, "r") as f:
                    agent_code = f.read()
                print(f"Agent script loaded, length: {len(agent_code)} characters")
            except FileNotFoundError:
                return {
                    "status": "error",
                    "message": f"Agent file not found at {agent_path}",
                }, 404
            except Exception as e:
                return {
                    "status": "error",
                    "message": f"Error reading agent file: {str(e)}",
                }, 500

            # Create and load script with extended timeout
            print(f"Creating script for session {session_id} with PID {pid}")

            try:
                # Use extended timeout for large scripts and remote connections
                timeout = (
                    90 if ":" in device_id else 60
                )  # Longer timeout for network devices
                script = load_script_with_timeout(session, agent_code, timeout=timeout)

                # Set up enhanced message handler
                message_handler = setup_enhanced_message_handler(session_id, script)
                script.on("message", message_handler)

                print("[+] Script loaded, waiting for initialization...")

                # Wait longer for agent initialization on remote devices
                init_time = 5 if ":" in device_id else 3
                time.sleep(init_time)
                print("[+] Agent initialization complete")

                # Store the script for later use
                active_scripts[session_id] = {
                    "script": script,
                    "session": session,
                    "device_id": device_id,
                    "pid": pid,
                }

                # Initialize message queue if needed
                if session_id not in hook_queues:
                    hook_queues[session_id] = Queue()

            except TimeoutError as e:
                print(f"[!] Script loading timeout: {e}")
                try:
                    session.detach()
                except:
                    pass
                return {
                    "status": "error",
                    "message": "Script loading timed out - agent file may be too large or device connection is slow",
                }, 408

            except frida.InvalidArgumentError as e:
                print(f"[!] Frida script creation/loading error: {e}")
                try:
                    session.detach()
                except:
                    pass
                return {
                    "status": "error",
                    "message": f"Invalid Frida script: {str(e)}",
                }, 400

            except Exception as e:
                print(f"[!] Script loading error: {e}")
                try:
                    session.detach()
                except:
                    pass
                return {
                    "status": "error",
                    "message": f"Script loading failed: {str(e)}",
                }, 500

            # Try to get runtime status
            try:
                runtime_status = {}
                if hasattr(script.exports, "evaluate"):
                    print("[*] Getting runtime status...")
                    objc_available = script.exports.evaluate(
                        "runtime_check", "typeof ObjC !== 'undefined' && ObjC.available"
                    )
                    java_available = script.exports.evaluate(
                        "runtime_check", "typeof Java !== 'undefined' && Java.available"
                    )
                    process_info = script.exports.evaluate(
                        "runtime_check",
                        "Process.id + '|' + Process.arch + '|' + Process.platform",
                    )

                    if isinstance(process_info, str) and "|" in process_info:
                        parts = process_info.split("|")
                        runtime_status = {
                            "objc_available": objc_available,
                            "java_available": java_available,
                            "process_id": parts[0],
                            "process_arch": parts[1],
                            "process_platform": parts[2],
                        }
                    else:
                        runtime_status = {
                            "objc_available": objc_available,
                            "java_available": java_available,
                            "process_info": process_info,
                        }
                else:
                    # Fallback if exports.evaluate is not available
                    runtime_status = {
                        "status": "Agent loaded but exports not available"
                    }

            except Exception as e:
                print(f"[!] Could not get runtime status: {e}")
                runtime_status = {
                    "error": f"Could not determine runtime status: {str(e)}"
                }

            print(f"[+] Agent loaded successfully for session {session_id}")
            return {
                "status": "success",
                "message": "Agent loaded successfully",
                "session_id": session_id,
                "runtime_status": runtime_status,
                "agent_ready": True,
                "device_info": {
                    "device_id": device_id,
                    "pid": pid,
                    "script_size": len(agent_code),
                },
            }

        except frida.InvalidArgumentError as e:
            print(f"[!] Frida InvalidArgumentError: {e}")
            return {
                "status": "error",
                "message": f"Invalid Frida argument: {str(e)}",
            }, 400
        except frida.ProcessNotFoundError as e:
            print(f"[!] Process not found: {e}")
            return {
                "status": "error",
                "message": f"Process with PID {pid} not found",
            }, 404
        except frida.ServerNotRunningError as e:
            print(f"[!] Frida server not running: {e}")
            return {
                "status": "error",
                "message": "Frida server is not running on the target device",
            }, 503
        except Exception as e:
            logger.exception(f"Error loading agent: {e}")
            return {"status": "error", "message": f"Unexpected error: {str(e)}"}, 500


@frida_namespace.route("/agent-status/<string:session_id>")
class FridaAgentStatus(Resource):
    def get(self, session_id):
        try:
            if session_id not in active_scripts:
                return {
                    "status": "not_loaded",
                    "message": "No agent loaded for this session",
                }

            script_info = active_scripts[session_id]

            # Try to check if the script is still active
            try:
                script = script_info["script"]
                # Simple test to see if script is responsive
                test_result = (
                    script.exports.evaluate("test", 'typeof Process !== "undefined"')
                    if hasattr(script.exports, "evaluate")
                    else True
                )

                return {
                    "status": "active",
                    "session_id": session_id,
                    "device_id": script_info.get("device_id"),
                    "pid": script_info.get("pid"),
                    "test_result": test_result,
                }
            except Exception as e:
                # Script is no longer active, clean it up
                del active_scripts[session_id]
                return {
                    "status": "inactive",
                    "message": f"Agent script is no longer active: {str(e)}",
                }

        except Exception as e:
            logger.exception(f"Error checking agent status: {e}")
            return {"status": "error", "message": str(e)}, 500


@frida_namespace.route("/unload-agent")
class FridaUnloadAgent(Resource):
    def post(self):
        try:
            data = request.get_json()
            session_id = data.get("session_id")

            if not session_id:
                return {"status": "error", "message": "Missing session_id"}, 400

            if session_id not in active_scripts:
                return {
                    "status": "error",
                    "message": "No active agent for this session",
                }, 404

            script_info = active_scripts[session_id]

            try:
                # Unload the script
                script_info["script"].unload()

                # Detach from session if it exists
                if "session" in script_info:
                    script_info["session"].detach()

            except Exception as e:
                logger.warning(f"Error during agent cleanup: {e}")

            # Remove from active scripts
            del active_scripts[session_id]

            # Clean up message queue
            if session_id in hook_queues:
                del hook_queues[session_id]

            return {"status": "success", "message": "Agent unloaded successfully"}

        except Exception as e:
            logger.exception(f"Error unloading agent: {e}")
            return {"status": "error", "message": str(e)}, 500


# Core routes
