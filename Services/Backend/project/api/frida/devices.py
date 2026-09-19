"""Device, process, spawn/attach/detach, and application endpoints."""

from project.api.frida._shared import *  # noqa: F401,F403  (shared surface)
from project.api.frida.helpers import *  # noqa: F401,F403  (helper functions)


@frida_namespace.route("/process-info/<string:device_id>/<int:pid>")
class FridaProcessInfo(Resource):
    def get(self, device_id, pid):
        try:
            device = require_mobile_device(frida.get_device_manager().get_device(device_id))

            # Get all processes and find the one matching the PID
            processes = device.enumerate_processes(scope="metadata")
            process = next((p for p in processes if p.pid == pid), None)

            if process is None:
                return {
                    "status": "error",
                    "message": f"Process with PID {pid} not found",
                }, 404

            # Get the process parameters
            params = process.parameters if hasattr(process, "parameters") else {}

            # Print the process parameters
            print(f"Process Parameters: {params}")

            app_info = {
                "name": process.name,
                "pid": process.pid,
                "user": params.get("user", "Unknown"),
                "path": params.get("path", "Unknown"),
                "small_icon": params.get("small_icon", None),
                "large_icon": params.get("large_icon", None),
                "applications": params.get("applications", []),
            }

            # print(f"App Info: {app_info}")
            return {"status": "success", "app_info": app_info}
        except frida.InvalidArgumentError:
            return {
                "status": "error",
                "message": f"Invalid device ID: {device_id}",
            }, 400
        except Exception as e:
            logger.exception(f"Error getting process info: {e}")
            return {"status": "error", "message": str(e)}, 500


@frida_namespace.route("/spawn")
class FridaSpawn(Resource):
    def post(self):
        try:
            data = request.get_json()
            print("Received data:", data)  # Log received data

            device_id = data.get("device_id")
            package_name = data.get("package_name")
            spawn_script = data.get("spawn_script")
            no_pause = data.get("no_pause", True)
            keep_script_running = data.get("keep_script_running", False)
            session_id = data.get("session_id", "default")

            if not device_id:
                return {"status": "error", "message": "Missing device_id"}, 400
            if not package_name:
                return {"status": "error", "message": "Missing package_name"}, 400

            # Get the device (reconnects a remote socket@ device on this worker and
            # fast-fails an unreachable remote via resolve_device's connect probe).
            try:
                device = resolve_device(device_id)
            except Exception as e:
                return {
                    "status": "error",
                    "message": f"Device not found and unable to reconnect: {e}",
                }, 404

            # Spawn the process (starts SUSPENDED).
            pid = device.spawn([package_name])
            print(f"Spawned {package_name} with PID: {pid}")

            # The target is now suspended: any failure below must kill it, or the app
            # is left frozen on the device forever (appears hung / ANR).
            try:
                session = device.attach(pid)

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
                    print(f"Sending message to queue: {message}")  # Debug print

                # Create the output queue up front so spawn-script/paused output isn't
                # dropped (the paused path previously created no queue).
                if session_id not in hook_queues:
                    hook_queues[session_id] = Queue()

                if spawn_script:
                    wrapped_script = f"""
                        (function() {{
                            var originalConsoleLog = console.log;
                            console.log = function() {{
                                var args = Array.prototype.slice.call(arguments);
                                send({{type: 'log', payload: args.join(' ')}});
                                originalConsoleLog.apply(this, arguments);
                            }};

                            {spawn_script}
                        }})();
                    """

                    script = session.create_script(wrapped_script)
                    script.on("message", on_message)
                    script.load()

                    # Store the script object for later use
                    active_scripts[session_id] = script

                if not no_pause:
                    # Spawn-gated: leave suspended for the REPL's "Resume app" control.
                    return {
                        "status": "success",
                        "pid": pid,
                        "session_id": session_id,
                        "message": "Process spawned and paused",
                    }

                # Resume the spawned process
                device.resume(pid)

                if keep_script_running:
                    # Start a new thread to keep the script running
                    def keep_alive():
                        import sys

                        sys.stdin.read()

                    thread = threading.Thread(target=keep_alive)
                    thread.start()

                return {
                    "status": "success",
                    "pid": pid,
                    "session_id": session_id,
                    "message": "Process spawned and monitoring started",
                }
            except Exception as e:
                # Never leave the app frozen on the device if anything after spawn fails.
                try:
                    device.kill(pid)
                except Exception:
                    pass
                logger.exception(f"Spawn post-launch failed; killed pid {pid}: {e}")
                return {
                    "status": "error",
                    "message": f"Spawn failed after launch (target killed): {e}",
                }, 500
        except frida.InvalidArgumentError as e:
            print(f"Invalid argument error: {e}")
            return {"status": "error", "message": f"Invalid argument: {str(e)}"}, 400
        except frida.ProcessNotFoundError as e:
            print(f"Process not found error: {e}")
            return {
                "status": "error",
                "message": f"Process {package_name} not found",
            }, 404
        except Exception as e:
            print(f"Unexpected error: {e}")
            return {"status": "error", "message": str(e)}, 500


@frida_namespace.route("/attach")
class FridaAttach(Resource):
    def post(self):
        try:
            data = request.get_json()
            device_id = data.get("device_id")
            pid = data.get("pid")
            print(f"Device ID: {device_id}, PID: {pid}")
            if not device_id:
                return {"status": "error", "message": "Missing device_id"}, 400
            if pid is None:
                return {"status": "error", "message": "Missing pid"}, 400

            device = require_mobile_device(frida.get_device_manager().get_device(device_id))
            session = device.attach(int(pid))
            if not session:
                return {
                    "status": "error",
                    "message": "Failed to attach to process",
                }, 500
            else:
                return {"status": "success"}
        except frida.ProcessNotFoundError:
            return {
                "status": "error",
                "message": f"Process with PID {pid} not found",
            }, 404
        except Exception as e:
            print(f"Error: {e}")
            return {"status": "error", "message": str(e)}, 500


@frida_namespace.route("/resume")
class FridaResume(Resource):
    def post(self):
        """Resume a spawn-gated (paused) process so it runs with instrumentation
        already in place. Used by the REPL's "Resume app" control after a paused
        spawn."""
        try:
            data = request.get_json()
            device_id = data.get("device_id")
            pid = data.get("pid")

            if not device_id:
                return {"status": "error", "message": "Missing device_id"}, 400
            if pid is None:
                return {"status": "error", "message": "Missing pid"}, 400

            # Resolve the device, reconnecting a remote (socket@host:port) one if this
            # worker hasn't seen it yet (mirrors the spawn/attach paths).
            try:
                device = require_mobile_device(frida.get_device(device_id))
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

            device.resume(int(pid))
            return {"status": "success", "pid": pid, "message": "Process resumed"}
        except frida.ProcessNotFoundError:
            return {
                "status": "error",
                "message": f"Process with PID {pid} not found",
            }, 404
        except Exception as e:
            logger.exception(f"Error resuming process: {e}")
            return {"status": "error", "message": str(e)}, 500


@frida_namespace.route("/list")
class FridaList(Resource):
    def get(self):
        try:
            device_manager = frida.get_device_manager()
            # Force refresh the device list
            device_manager.enumerate_devices()
            time.sleep(0.1)  # Give a moment for the list to update
            devices = device_manager.enumerate_devices()  # Get the updated list
            device_list = [
                {
                    "id": device.id,
                    "name": device.name,
                    "type": device.type,
                    "os": self.get_device_os(device),
                }
                for device in devices if device.type in ("usb", "remote")
            ]
            # print(f"Device List {device_list}")
            return {"status": "success", "devices": device_list}
        except Exception as e:
            print(f"Error: {e}")
            return {"status": "error", "message": str(e)}, 500

    def get_user(self, device):
        try:
            if device.type == "local":
                return "Unknown"  # Local devices might not have a specific user
            print(f"Device: {device}")
            return device.query_system_parameters().get("user", "Unknown")

        except Exception:
            return "Unknown"

    def get_device_os(self, device):
        try:
            if device.type == "local":
                return "Unknown"  # Local devices might not have a specific OS
            return device.query_system_parameters().get("os", {}).get("id", "Unknown")
        except Exception:
            return "Unknown"


@frida_namespace.route("/attach-remote")
class FridaRemoteAttach(Resource):
    def post(self):
        try:
            data = request.get_json()
            print(f"Data: {data}")
            host = data.get("host")
            port = data.get("port")
            print(f"Host: {host}, Port: {port}")
            if not host or not port:
                return {"status": "error", "message": "Missing host or port"}, 400

            logger.info(
                f"Attempting to connect to remote Frida server at {host}:{port}"
            )

            # Use host and port directly without resolving IP
            device = frida.get_device_manager().add_remote_device(f"{host}:{port}")
            print(f"Device: {device}")
            logger.info(f"Successfully connected to remote device: {device.name}")

            # Enumerate processes to verify connection
            processes = device.enumerate_processes()
            print(f"Number of processes: {len(processes)}")

            return {
                "status": "success",
                "message": f"Successfully attached to {host}:{port}",
                "device_name": device.name,
            }
        except frida.ServerNotRunningError:
            logger.error(f"Frida server is not running on {host}:{port}")
            return {
                "status": "error",
                "message": "Frida server is not running on the specified device",
            }, 503
        except Exception as e:
            logger.exception(f"Error attaching to remote device: {e}")
            return {"status": "error", "message": str(e)}, 500


@frida_namespace.route("/applications/<string:device_id>")
class FridaApplications(Resource):
    def get(self, device_id):
        try:
            device_manager = frida.get_device_manager()
            device = require_mobile_device(device_manager.get_device(device_id))
            # We use the full scope so we can get all the objects in the structure that frida returns including the
            # Icons.
            processes = device.enumerate_processes(scope="full")
            process_list = []
            for process in processes:
                process_info = {
                    "name": process.name,
                    "pid": process.pid,
                    "user": process.parameters["user"],
                    "icon": get_icon_for_process(process),
                    "identifier": None,  # Default to None
                }

                # Extract full package name from parameters if available
                if (
                    hasattr(process, "parameters")
                    and "applications" in process.parameters
                ):
                    apps = process.parameters["applications"]
                    if apps and len(apps) > 0:
                        process_info["identifier"] = apps[0]

                process_list.append(process_info)

            # Sort processes by name
            process_list.sort(key=lambda x: x["name"].lower())

            logger.info(
                f"Enumerated {len(process_list)} processes on device {device.name}"
            )
            return {
                "status": "success",
                "processes": process_list,
                "device_name": device.name,
            }
        except frida.InvalidArgumentError:
            logger.error(f"Invalid device ID: {device_id}")
            return {"status": "error", "message": "Invalid device ID"}, 400
        except frida.ServerNotRunningError:
            logger.error(f"Frida server is not running on device: {device_id}")
            return {
                "status": "error",
                "message": "Frida server is not running on the device",
            }, 503
        except Exception as e:
            logger.exception(f"Error enumerating processes: {e}")
            return {"status": "error", "message": str(e)}, 500


@frida_namespace.route("/detach")
class FridaDetach(Resource):
    def post(self):
        try:
            data = request.get_json()
            device_id = data.get("device_id")
            host = data.get("host")
            port = data.get("port")
            print(f"Device ID: {device_id}, Host: {host}, Port: {port}")

            if not device_id and not (host and port):
                return {
                    "status": "error",
                    "message": "Missing device_id or host:port combination",
                }, 400

            device_manager = frida.get_device_manager()
            print(f"Device Manager: {device_manager}")

            try:
                if device_id:
                    device = require_mobile_device(device_manager.get_device(device_id))
                else:
                    # Find the device by host:port
                    device = next(
                        (
                            d
                            for d in device_manager.enumerate_devices()
                            if d.type == "remote" and d.id == f"socket@{host}:{port}"
                        ),
                        None,
                    )

                if not device:
                    return {"status": "error", "message": f"Device not found"}, 404

                if device.type == "remote":
                    try:
                        # Attempt to remove the remote device
                        device_manager.remove_remote_device(device.name)
                        print(f"Remote device {device.id} detached")

                        # Verify detachment
                        time.sleep(0.5)  # Give a moment for the change to take effect
                        remaining_devices = device_manager.enumerate_devices()
                        if any(d.id == device.id for d in remaining_devices):
                            print(
                                f"Warning: Device {device.id} still present after detachment attempt"
                            )
                            return {
                                "status": "warning",
                                "message": f"Device {device.id} may not have been fully detached",
                            }, 202
                        else:
                            return {
                                "status": "success",
                                "message": f"Successfully detached device {device.id}",
                            }, 200
                    except frida.InvalidArgumentError as f:
                        # Print the error
                        print(f"Error: {f}")
                        print(
                            f"Failed to detach device {device.id}, it may have already been detached"
                        )
                        return {
                            "status": "warning",
                            "message": f"Device {device.id} may have already been detached",
                        }, 202
                else:
                    print(f"Device {device.id} is not remote, cannot detach")
                    return {
                        "status": "error",
                        "message": f"Device {device.id} is not remote, cannot detach",
                    }, 400

            except frida.InvalidArgumentError as e:
                print(f"Invalid argument error: {e}")
                return {"status": "error", "message": str(e)}, 400
            except frida.InvalidOperationError as e:
                print(f"Invalid operation error: {e}")
                return {"status": "error", "message": str(e)}, 400
            except Exception as e:
                print(f"Error: {e}")
                return {"status": "error", "message": str(e)}, 500

        except Exception as e:
            print(f"Unexpected error: {e}")
            return {"status": "error", "message": "An unexpected error occurred"}, 500
