"""Frida helper functions (script building, bridges, feature commands)."""

from project.api.frida._shared import *  # noqa: F401,F403 (shared surface)


def wrap_user_script(name, script):
    """
    Wrap a user script for the packaging format.
    Scripts starting with 📦 are already packaged.
    """
    if script.startswith("📦\n"):
        return script
    return f"Script.evaluate({json.dumps(name)}, {json.dumps(script)});"


def build_final_script(raw_fragments):
    """
    Build final script with packaging format
    """
    fragments = []
    next_script_id = 1

    for raw_fragment in raw_fragments:
        if raw_fragment.startswith("📦\n"):
            # Already packaged, just strip the marker
            fragments.append(raw_fragment[2:])
        else:
            # Package this fragment
            script_id = next_script_id
            next_script_id += 1
            size = len(raw_fragment.encode("utf-8"))
            fragments.append(f"{size} /frida/repl-{script_id}.js\n✄\n{raw_fragment}")

    return "📦\n" + "\n✄\n".join(fragments)


def find_frida_tools_path():
    """
    Find the frida_tools package installation path

    Returns:
        str: Path to frida_tools package or None if not found
    """
    try:
        import frida_tools

        path = os.path.dirname(frida_tools.__file__)
        logger.info(f"Found frida_tools at: {path}")
        return path
    except ImportError:
        logger.warning("frida_tools import failed, searching in site-packages")
        # Fallback: search in site-packages
        for site_pkg in site.getsitepackages():
            frida_tools_path = os.path.join(site_pkg, "frida_tools")
            if os.path.exists(frida_tools_path):
                logger.info(f"Found frida_tools in site-packages: {frida_tools_path}")
                return frida_tools_path

        # Additional fallback for virtual environments
        if hasattr(site, "USER_SITE"):
            user_frida_path = os.path.join(site.USER_SITE, "frida_tools")
            if os.path.exists(user_frida_path):
                logger.info(f"Found frida_tools in USER_SITE: {user_frida_path}")
                return user_frida_path

    logger.error("Could not find frida_tools package")
    return None


def load_bridge_script(bridge_type):

    if bridge_type not in ["ios", "android"]:
        raise ValueError(
            f"Unknown bridge type: {bridge_type}. Must be 'ios' or 'android'"
        )

    # Find frida_tools installation path
    frida_tools_path = find_frida_tools_path()

    if not frida_tools_path:
        raise FileNotFoundError(
            "Could not find frida_tools package. "
            "Please install it with: pip install frida-tools"
        )

    # Determine bridge file name
    if bridge_type == "ios":
        bridge_filename = "objc.js"
        bridge_name = "ObjC"
    else:  # android
        bridge_filename = "java.js"
        bridge_name = "Java"

    logger.info(f"Loading {bridge_type} bridge script: {bridge_filename}")

    # Construct full path to bridge script
    bridge_path = os.path.join(frida_tools_path, "bridges", bridge_filename)

    # Check if bridge file exists
    if not os.path.exists(bridge_path):
        raise FileNotFoundError(
            f"Bridge script not found at: {bridge_path}\n"
            f"Expected location: {frida_tools_path}/bridges/{bridge_filename}"
        )

    # Read bridge script
    with open(bridge_path, "r", encoding="utf-8") as f:
        bridge_script = f.read()

    logger.info(f"Loaded {bridge_type} bridge ({len(bridge_script)} bytes)")

    # Add bridge to global object
    bridge_script += (
        f"\n\nObject.defineProperty(globalThis, '{bridge_name}', {{ value: bridge }});"
    )

    return bridge_script


def detect_device_os_type(device):
    """
    Detect whether the device is iOS or Android

    Args:
        device: Frida device object

    Returns:
        str: 'ios' or 'android' or None if cannot detect
    """
    try:
        # Try to get device properties
        params = device.query_system_parameters()
        device_type = params.get("os", {}).get("id", "").lower()

        logger.info(f"Device OS type detected: {device_type}")

        if "ios" in device_type or "darwin" in device_type:
            return "ios"
        elif "android" in device_type or "linux" in device_type:
            return "android"
        else:
            # Fallback: check device name
            device_name = device.name.lower()
            if "iphone" in device_name or "ipad" in device_name:
                return "ios"
            elif "android" in device_name:
                return "android"
    except Exception as e:
        logger.warning(f"Could not detect device type: {e}")

    return None


def _check_remote_reachable(host, port, timeout=5):
    """Fast TCP reachability probe so an unreachable remote frida-server fails in
    ~a couple seconds with a clear message, instead of hanging a worker thread inside
    add_remote_device (which has no connect timeout of its own)."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError as e:
        raise RuntimeError(
            f"Could not reach frida-server at {host}:{port} within {timeout}s ({e})"
        )


def resolve_device(device_id, timeout=None):
    """Resolve a frida device by id, transparently (re)connecting a remote
    'socket@host:port' device if this worker's DeviceManager hasn't registered it
    yet. Centralizes the reconnect fallback that spawn/monitor/pull already do
    inline, so every attach path (repl/init, execute, load-agent, spawn) recovers
    remote devices the same way instead of 404-ing on the "wrong" worker.

    Raises the underlying frida error if a non-remote id can't be resolved, or a
    RuntimeError if a remote host is unreachable within the connect timeout.
    """
    try:
        if timeout is not None:
            return frida.get_device(device_id, timeout=timeout)
        return frida.get_device(device_id)
    except frida.InvalidArgumentError:
        if device_id and device_id.startswith("socket@"):
            host, port = device_id.split("@", 1)[1].split(":")
            _check_remote_reachable(host, int(port))
            return frida.get_device_manager().add_remote_device(f"{host}:{port}")
        raise


def get_icon_for_process(process):
    if hasattr(process, "parameters") and "icons" in process.parameters:
        icons = process.parameters["icons"]
        if icons and len(icons) > 0:
            icon = icons[0]  # Get the first icon
            if icon["format"] == "png":
                import base64

                base64_icon = base64.b64encode(icon["image"]).decode("utf-8")
                return f"data:image/png;base64,{base64_icon}"

    # If no icon is found, return a default Material Design icon name
    return get_default_icon_for_process(process.name)


def get_default_icon_for_process(process_name):
    icon_map = {
        "system": "mdi-cog",
        "zygote": "mdi-android",
        "com.android.phone": "mdi-phone",
        "com.android.systemui": "mdi-android",
        "com.android.settings": "mdi-cog",
        "com.google.android.gms": "mdi-google",
        "com.android.vending": "mdi-google-play",
    }
    return icon_map.get(process_name.lower(), "mdi-application")


# Enhanced message handler for system monitor updates
# Enhanced message handler for system monitor updates


def setup_enhanced_message_handler(session_id, script):
    """Enhanced message handler for Frida script messages with robust error handling and batch processing"""

    def on_message(message, data):
        try:
            if message["type"] == "send":
                payload = message["payload"]

                # print(f"Received payload: {json.dumps(payload, indent=2)}")
                # Use rich console the json output for better readability
                console.log(f"Received payload: {json.dumps(payload, indent=2)}")

                # Handle crypto operation BATCH updates - CRYPTO HANDLER
                if (
                    isinstance(payload, dict)
                    and payload.get("type") == "crypto_operation_batch"
                ):
                    queue_key = f"{session_id}_ios_crypto_cryptoMonitor"
                    if queue_key in hook_queues:
                        # Process batch of crypto events
                        events = payload.get("events", [])
                        stats = payload.get("stats", {})

                        print(
                            f"Processing crypto batch: {len(events)} events, rate: {stats.get('rate', 0)} ops/sec"
                        )

                        # Send each event separately to maintain compatibility
                        for event in events:
                            formatted_crypto_data = {
                                "type": "crypto_operation",
                                "id": event.get(
                                    "id",
                                    f"crypto_{int(time.time())}_{random.randint(1000, 9999)}",
                                ),
                                "timestamp": event.get(
                                    "timestamp", datetime.datetime.now().isoformat()
                                ),
                                "operation": event.get("operation", "unknown"),
                                "algorithm": event.get("algorithm"),
                                "keySize": event.get("keySize"),
                                "dataSize": event.get("dataSize", 0),
                                "success": event.get("success", True),
                                "error": event.get("error"),
                                "parameters": event.get("parameters", {}),
                                "stackTrace": event.get("stackTrace"),
                            }

                            # Don't JSON encode here - just put the dict directly
                            hook_queues[queue_key].put(formatted_crypto_data)

                        # Also send statistics update
                        stats_update = {
                            "type": "crypto_stats",
                            "totalProcessed": stats.get("totalProcessed", 0),
                            "dropped": stats.get("dropped", 0),
                            "rate": stats.get("rate", 0),
                            "timestamp": datetime.datetime.now().isoformat(),
                        }
                        hook_queues[queue_key].put(stats_update)

                        # Log summary to main queue
                        if session_id in hook_queues:
                            hook_queues[session_id].put(
                                f"Crypto Batch: {len(events)} operations, {stats.get('rate', 0)} ops/sec"
                            )

                # Handle Android network monitoring updates specifically - ANDROID NETWORK HANDLER
                elif (
                    isinstance(payload, dict)
                    and payload.get("eventType") == "network_request"
                ):
                    if payload.get("platform") == "android":
                        queue_key = f"{session_id}_android_network_networkMonitor"
                    else:
                        # Route to iOS if no platform specified or iOS platform
                        queue_key = f"{session_id}_ios_network_networkMonitor"

                    if queue_key in hook_queues:
                        # Format network request for the frontend
                        formatted_network_data = {
                            "type": "network_request",
                            "timestamp": payload.get("timestamp"),
                            "id": payload.get("id"),
                            "method": payload.get("method"),
                            "url": payload.get("url"),
                            "headers": payload.get("headers", {}),
                            "body": payload.get("body"),
                            "bodySize": payload.get("bodySize"),
                            "statusCode": payload.get("statusCode"),
                            "responseHeaders": payload.get("responseHeaders", {}),
                            "responseBody": payload.get("responseBody"),
                            "responseSize": payload.get("responseSize"),
                            "error": payload.get("error"),
                            "library": payload.get(
                                "library"
                            ),  # For Android HTTP library detection
                        }

                        # DON'T JSON encode here - just put the dict directly
                        hook_queues[queue_key].put(formatted_network_data)

                    # Also send to main session queue for debugging
                    if session_id in hook_queues:
                        platform_prefix = (
                            "Android" if payload.get("platform") == "android" else "iOS"
                        )
                        hook_queues[session_id].put(
                            f"{platform_prefix} Network: {payload.get('method', 'UNKNOWN')} {payload.get('url', 'unknown')}"
                        )

                # Handle iOS URL Scheme events - iOS URL SCHEME HANDLER (NEW!)
                elif (
                    isinstance(payload, dict)
                    and payload.get("type") == "ipc_event"
                    and payload.get("data", {}).get("type") == "url_scheme"
                ):
                    # Route to iOS URL scheme monitor queue
                    queue_key = f"{session_id}_ios_ipc_urlSchemeMonitor"
                    if queue_key in hook_queues:
                        # Format URL scheme event for the frontend
                        formatted_url_scheme_data = {
                            "type": "ipc_event",
                            "data": payload.get("data", {}),
                        }

                        # Put the dict directly in the queue (don't JSON encode)
                        hook_queues[queue_key].put(formatted_url_scheme_data)

                        print(
                            f"iOS URL scheme event queued: {payload.get('data', {}).get('url', 'unknown')}"
                        )

                    # Also send to main session queue for debugging
                    if session_id in hook_queues:
                        event_data = payload.get("data", {})
                        hook_queues[session_id].put(
                            f"iOS URL Scheme: {event_data.get('url', 'unknown')} via {event_data.get('callChain', ['unknown'])[0] if event_data.get('callChain') else 'unknown'}"
                        )

                # SSL EVENT HANDLERS - Comprehensive SSL/TLS Event Handling
                # Handle SSL/TLS events - SSL EVENT HANDLER
                elif isinstance(payload, dict) and payload.get("type") == "ssl_event":
                    # Route to SSL pinning manager queue (matching the EventSource URL pattern exactly)
                    queue_key = (
                        f"{session_id}_android_Network-Security_sslPinningManager"
                    )
                    if queue_key in hook_queues:
                        # Format SSL event for the frontend (following AndroidIPCMonitor pattern)
                        formatted_ssl_data = {
                            "type": "ssl_event",
                            "event": payload.get("event", {}),
                            "hitCount": payload.get("hitCount", 0),
                        }

                        # Put the dict directly in the queue (don't JSON encode)
                        hook_queues[queue_key].put(formatted_ssl_data)

                        event_data = payload.get("event", {})
                        print(
                            f"SSL event queued: {event_data.get('hookName', 'unknown')} | {event_data.get('action', 'unknown')} | {event_data.get('hostname', 'no-host')}"
                        )

                    # Also send to main session queue for debugging
                    if session_id in hook_queues:
                        event_data = payload.get("event", {})
                        hook_queues[session_id].put(
                            f"SSL: {event_data.get('hookName', 'UNKNOWN')} {event_data.get('action', 'unknown')} on {event_data.get('hostname', 'unknown')}"
                        )

                # Handle SSL hook status updates - SSL STATUS HANDLER
                elif (
                    isinstance(payload, dict)
                    and payload.get("type") == "ssl_hook_enabled"
                ):
                    queue_key = (
                        f"{session_id}_android_Network-Security_sslPinningManager"
                    )
                    if queue_key in hook_queues:
                        formatted_ssl_status = {
                            "type": "ssl_hook_enabled",
                            "hookId": payload.get("hookId"),
                            "enabled": payload.get("enabled", True),
                        }
                        hook_queues[queue_key].put(formatted_ssl_status)

                    if session_id in hook_queues:
                        hook_queues[session_id].put(
                            f"SSL Hook Enabled: {payload.get('hookId', 'unknown')}"
                        )

                elif (
                    isinstance(payload, dict)
                    and payload.get("type") == "ssl_hook_disabled"
                ):
                    queue_key = (
                        f"{session_id}_android_Network-Security_sslPinningManager"
                    )
                    if queue_key in hook_queues:
                        formatted_ssl_status = {
                            "type": "ssl_hook_disabled",
                            "hookId": payload.get("hookId"),
                            "enabled": False,
                        }
                        hook_queues[queue_key].put(formatted_ssl_status)

                    if session_id in hook_queues:
                        hook_queues[session_id].put(
                            f"SSL Hook Disabled: {payload.get('hookId', 'unknown')}"
                        )

                # Handle SSL discovery events - SSL DISCOVERY HANDLER
                elif (
                    isinstance(payload, dict)
                    and payload.get("type") == "ssl_discovery_complete"
                ):
                    queue_key = (
                        f"{session_id}_android_Network-Security_sslPinningManager"
                    )
                    if queue_key in hook_queues:
                        formatted_discovery = {
                            "type": "ssl_discovery_complete",
                            "availableHooks": payload.get("availableHooks", 0),
                            "totalHooks": payload.get("totalHooks", 0),
                            "hooks": payload.get("hooks", []),
                        }
                        hook_queues[queue_key].put(formatted_discovery)

                    if session_id in hook_queues:
                        hook_queues[session_id].put(
                            f"SSL Discovery: Found {payload.get('availableHooks', 0)} available hooks"
                        )

                # Handle SSL monitoring started/stopped events - SSL MONITORING HANDLER
                elif (
                    isinstance(payload, dict)
                    and payload.get("type") == "ssl_monitoring_started"
                ):
                    queue_key = (
                        f"{session_id}_android_Network-Security_sslPinningManager"
                    )
                    if queue_key in hook_queues:
                        formatted_monitoring = {
                            "type": "ssl_monitoring_started",
                            "hooksEnabled": payload.get("hooksEnabled", 0),
                            "totalAvailable": payload.get("totalAvailable", 0),
                        }
                        hook_queues[queue_key].put(formatted_monitoring)

                    if session_id in hook_queues:
                        hook_queues[session_id].put(
                            f"SSL Monitoring Started: {payload.get('hooksEnabled', 0)} hooks enabled"
                        )

                elif (
                    isinstance(payload, dict)
                    and payload.get("type") == "ssl_monitoring_stopped"
                ):
                    queue_key = (
                        f"{session_id}_android_Network-Security_sslPinningManager"
                    )
                    if queue_key in hook_queues:
                        formatted_monitoring = {
                            "type": "ssl_monitoring_stopped",
                            "hooksDisabled": payload.get("hooksDisabled", 0),
                        }
                        hook_queues[queue_key].put(formatted_monitoring)

                    if session_id in hook_queues:
                        hook_queues[session_id].put(
                            f"SSL Monitoring Stopped: {payload.get('hooksDisabled', 0)} hooks disabled"
                        )

                # Handle SSL statistics updates - SSL STATS HANDLER
                elif isinstance(payload, dict) and payload.get("type") == "ssl_stats":
                    queue_key = (
                        f"{session_id}_android_Network-Security_sslPinningManager"
                    )
                    if queue_key in hook_queues:
                        formatted_stats = {
                            "type": "ssl_stats",
                            "statistics": payload.get("statistics", {}),
                        }
                        hook_queues[queue_key].put(formatted_stats)

                    if session_id in hook_queues:
                        hook_queues[session_id].put(
                            f"SSL Stats: {payload.get('statistics', {})}"
                        )

                # Handle SSL bypass events - SSL BYPASS HANDLER
                elif isinstance(payload, dict) and payload.get("type") in [
                    "ssl_bypass_enabled",
                    "ssl_bypass_disabled",
                ]:
                    queue_key = (
                        f"{session_id}_android_Network-Security_sslPinningManager"
                    )
                    if queue_key in hook_queues:
                        formatted_bypass = {
                            "type": payload.get("type"),
                            "hookId": payload.get("hookId"),
                            "bypassActive": payload.get("type") == "ssl_bypass_enabled",
                        }
                        hook_queues[queue_key].put(formatted_bypass)

                    if session_id in hook_queues:
                        action = (
                            "enabled"
                            if payload.get("type") == "ssl_bypass_enabled"
                            else "disabled"
                        )
                        hook_queues[session_id].put(
                            f"SSL Bypass {action}: {payload.get('hookId', 'unknown')}"
                        )

                # Handle IPC events - route to correct platform queue based on event type
                elif isinstance(payload, dict) and payload.get("type") == "ipc_event":
                    event_data = payload.get("data", {})
                    event_subtype = event_data.get("type", "")

                    # iOS-specific IPC event types
                    ios_ipc_types = {
                        "pasteboard": f"{session_id}_ios_ipc_pasteboardMonitor",
                        "darwin_notification": f"{session_id}_ios_ipc_darwinNotificationMonitor",
                        "app_group": f"{session_id}_ios_ipc_appGroupMonitor",
                    }

                    if event_subtype in ios_ipc_types:
                        # Route to iOS-specific IPC monitor queue
                        queue_key = ios_ipc_types[event_subtype]
                        if queue_key in hook_queues:
                            formatted_ipc_data = {
                                "type": "ipc_event",
                                "data": event_data,
                            }
                            hook_queues[queue_key].put(formatted_ipc_data)

                            print(
                                f"iOS IPC event queued: {event_subtype} | {event_data.get('callChain', ['unknown'])[0] if event_data.get('callChain') else 'unknown'}"
                            )

                        # Also send to main session queue for debugging
                        if session_id in hook_queues:
                            hook_queues[session_id].put(
                                f"iOS IPC: {event_subtype} | {event_data.get('boardName', event_data.get('name', 'unknown'))}"
                            )
                    else:
                        # Route to Android IPC monitor queue
                        queue_key = f"{session_id}_android_ipc_ipcMonitor"
                        if queue_key in hook_queues:
                            formatted_ipc_data = {
                                "type": "ipc_event",
                                "data": event_data,
                            }
                            hook_queues[queue_key].put(formatted_ipc_data)

                            print(
                                f"Android IPC event queued: {event_data.get('type', 'unknown')} | {event_data.get('action', 'unknown')}"
                            )

                        # Also send to main session queue for debugging
                        if session_id in hook_queues:
                            hook_queues[session_id].put(
                                f"Android IPC: {event_data.get('type', 'UNKNOWN')} {event_data.get('action', event_data.get('operation', 'unknown'))}"
                            )

                # Handle filesystem operation updates specifically - FILESYSTEM HANDLER
                elif (
                    isinstance(payload, dict)
                    and payload.get("type") == "filesystem_operation"
                ):
                    # Route to filesystem monitor specific queue
                    queue_key = f"{session_id}_ios_filesystem_filesystemMonitor"
                    if queue_key in hook_queues:
                        # Format filesystem operation for the frontend
                        formatted_filesystem_data = {
                            "type": "filesystem_operation",
                            "id": payload.get(
                                "id",
                                f"fs_op_{int(time.time())}_{random.randint(1000, 9999)}",
                            ),
                            "timestamp": payload.get(
                                "timestamp", datetime.datetime.now().isoformat()
                            ),
                            "operation": payload.get("operation", "unknown"),
                            "path": payload.get("path", "unknown"),
                            "success": payload.get("success", True),
                            "error": payload.get("error"),
                            "size": payload.get("size", 0),
                            "content": payload.get("content"),
                            "permissions": payload.get("permissions"),
                            "isDirectory": payload.get("isDirectory", False),
                            "metadata": payload.get("metadata", {}),
                        }

                        # DON'T JSON encode here - just put the dict directly
                        hook_queues[queue_key].put(formatted_filesystem_data)

                        print(
                            f"Filesystem operation queued: {formatted_filesystem_data['operation']} | {formatted_filesystem_data['path']}"
                        )

                    # Also send to main session queue for debugging
                    if session_id in hook_queues:
                        hook_queues[session_id].put(
                            f"Filesystem: {payload.get('operation', 'UNKNOWN')} {payload.get('path', 'unknown')}"
                        )

                # Handle filesystem directory listing updates - DIRECTORY LISTING HANDLER
                elif (
                    isinstance(payload, dict)
                    and payload.get("type") == "directory_listing"
                ):
                    # Route to filesystem monitor specific queue
                    queue_key = f"{session_id}_ios_filesystem_filesystemMonitor"
                    if queue_key in hook_queues:
                        # Format directory listing for the frontend
                        formatted_listing_data = {
                            "type": "directory_listing",
                            "path": payload.get("path", "unknown"),
                            "items": payload.get("items", []),
                            "timestamp": payload.get(
                                "timestamp", datetime.datetime.now().isoformat()
                            ),
                            "totalSize": payload.get("totalSize", 0),
                            "itemCount": payload.get("itemCount", 0),
                        }

                        # DON'T JSON encode here - just put the dict directly
                        hook_queues[queue_key].put(formatted_listing_data)

                        print(
                            f"Directory listing queued: {formatted_listing_data['path']} | {formatted_listing_data['itemCount']} items"
                        )

                    # Also send to main session queue for debugging
                    if session_id in hook_queues:
                        hook_queues[session_id].put(
                            f"Directory: {payload.get('path', 'unknown')} ({payload.get('itemCount', 0)} items)"
                        )

                # Handle filesystem status updates - FILESYSTEM STATUS HANDLER
                elif (
                    isinstance(payload, dict)
                    and payload.get("type") == "filesystem_status"
                ):
                    # Route to filesystem monitor specific queue
                    queue_key = f"{session_id}_ios_filesystem_filesystemMonitor"
                    if queue_key in hook_queues:
                        formatted_status_data = {
                            "type": "filesystem_status",
                            "status": payload.get("status", "unknown"),
                            "message": payload.get("message", ""),
                            "timestamp": payload.get(
                                "timestamp", datetime.datetime.now().isoformat()
                            ),
                        }

                        hook_queues[queue_key].put(formatted_status_data)

                    # Also send to main session queue for debugging
                    if session_id in hook_queues:
                        hook_queues[session_id].put(
                            f"Filesystem Status: {payload.get('status')} - {payload.get('message')}"
                        )

                # Handle app paths updates - APP PATHS HANDLER
                elif isinstance(payload, dict) and payload.get("type") == "app_paths":
                    # Route to filesystem monitor specific queue
                    queue_key = f"{session_id}_ios_filesystem_filesystemMonitor"
                    if queue_key in hook_queues:
                        formatted_paths_data = {
                            "type": "app_paths",
                            "paths": payload.get("paths", {}),
                            "timestamp": payload.get(
                                "timestamp", datetime.datetime.now().isoformat()
                            ),
                        }

                        hook_queues[queue_key].put(formatted_paths_data)

                        print(
                            f"App paths received: {list(payload.get('paths', {}).keys())}"
                        )

                    # Also send to main session queue for debugging
                    if session_id in hook_queues:
                        hook_queues[session_id].put(
                            f"App Paths: {list(payload.get('paths', {}).keys())}"
                        )

                # Handle iOS network monitoring updates - iOS NETWORK HANDLER (for direct network_request type)
                elif (
                    isinstance(payload, dict)
                    and payload.get("type") == "network_request"
                ):
                    # Route to iOS network monitor queue by default
                    queue_key = f"{session_id}_ios_network_networkMonitor"
                    if queue_key in hook_queues:
                        # Format network request for the frontend
                        formatted_network_data = {
                            "type": "network_request",
                            "timestamp": payload.get("timestamp"),
                            "id": payload.get("id"),
                            "method": payload.get("method"),
                            "url": payload.get("url"),
                            "headers": payload.get("headers", {}),
                            "body": payload.get("body"),
                            "bodySize": payload.get("bodySize"),
                            "statusCode": payload.get("statusCode"),
                            "responseHeaders": payload.get("responseHeaders", {}),
                            "responseBody": payload.get("responseBody"),
                            "responseSize": payload.get("responseSize"),
                            "error": payload.get("error"),
                            "requestType": payload.get(
                                "requestType"
                            ),  # For iOS request type tracking
                        }

                        # Put the dict directly in the queue (don't JSON encode)
                        hook_queues[queue_key].put(formatted_network_data)

                        print(
                            f"iOS Network request queued: {formatted_network_data['method']} {formatted_network_data['url']}"
                        )

                    # Also send to main session queue for debugging
                    if session_id in hook_queues:
                        hook_queues[session_id].put(
                            f"iOS Network: {payload.get('method', 'UNKNOWN')} {payload.get('url', 'unknown')}"
                        )

                # Handle network status updates - NETWORK STATUS HANDLER
                elif (
                    isinstance(payload, dict)
                    and payload.get("type") == "network_status"
                ):
                    if session_id in hook_queues:
                        hook_queues[session_id].put(
                            f"Network Status: {payload.get('status')} - {payload.get('message')}"
                        )

                # Handle system monitor updates specifically - SYSTEM MONITOR HANDLER
                elif (
                    isinstance(payload, dict)
                    and payload.get("type") == "system-monitor-update"
                ):
                    # Route to system monitor specific queue
                    queue_key = f"{session_id}_ios_system_systemMonitor"
                    if queue_key in hook_queues:
                        formatted_update = {
                            "timestamp": payload.get("timestamp"),
                            "type": "system_update",
                            "data": payload.get("data", {}),
                        }
                        hook_queues[queue_key].put(json.dumps(formatted_update))

                    # Also send to main session queue
                    if session_id in hook_queues:
                        hook_queues[session_id].put(
                            f"System Monitor: {json.dumps(payload.get('data', {}))}"
                        )

                # Handle crypto operation updates specifically - INDIVIDUAL CRYPTO HANDLER (for non-batch)
                elif (
                    isinstance(payload, dict)
                    and payload.get("type") == "crypto_operation"
                ):
                    # Route to crypto monitor specific queue
                    queue_key = f"{session_id}_ios_crypto_cryptoMonitor"
                    if queue_key in hook_queues:
                        # Format crypto operation for the frontend
                        formatted_crypto_data = {
                            "type": "crypto_operation",
                            "id": payload.get(
                                "id",
                                f"crypto_{int(time.time())}_{random.randint(1000, 9999)}",
                            ),
                            "timestamp": payload.get(
                                "timestamp", datetime.datetime.now().isoformat()
                            ),
                            "operation": payload.get("operation", "unknown"),
                            "algorithm": payload.get("algorithm"),
                            "keySize": payload.get("keySize"),
                            "dataSize": payload.get("dataSize", 0),
                            "success": payload.get("success", True),
                            "error": payload.get("error"),
                            "parameters": payload.get("parameters", {}),
                            "stackTrace": payload.get("stackTrace"),
                        }

                        # DON'T JSON encode here - just put the dict directly
                        hook_queues[queue_key].put(formatted_crypto_data)

                        print(
                            f"Crypto operation queued: {formatted_crypto_data['operation']} | {formatted_crypto_data.get('algorithm', 'Unknown')}"
                        )

                    # Also send to main session queue for debugging
                    if session_id in hook_queues:
                        hook_queues[session_id].put(
                            f"Crypto: {payload.get('operation', 'UNKNOWN')} {payload.get('algorithm', '')}"
                        )

                # Handle raw crypto output (fallback for text-based output) - RAW CRYPTO HANDLER
                elif isinstance(payload, str) and (
                    "CCCrypt Called" in payload
                    or "CCCrypt Called" in payload
                    or "Crypto" in payload
                ):
                    # This handles the raw text output from your current crypto hooks
                    queue_key = f"{session_id}_ios_crypto_cryptoMonitor"
                    if queue_key in hook_queues:
                        # Parse the raw text to extract crypto information
                        try:
                            lines = payload.split("\n")
                            crypto_data = {
                                "type": "crypto_operation",
                                "id": f"crypto_raw_{int(time.time())}_{random.randint(1000, 9999)}",
                                "timestamp": datetime.datetime.now().isoformat(),
                                "operation": "unknown",
                                "algorithm": None,
                                "keySize": None,
                                "dataSize": None,
                                "success": True,
                                "parameters": {},
                            }

                            for line in lines:
                                line = line.strip()
                                if "Operation:" in line:
                                    crypto_data["operation"] = (
                                        line.split("Operation:")[1].strip().lower()
                                    )
                                elif "Key:" in line:
                                    key_hex = line.split("Key:")[1].strip()
                                    crypto_data["parameters"]["key"] = key_hex
                                    if (
                                        key_hex
                                        and key_hex != "null"
                                        and key_hex != "(null)"
                                    ):
                                        crypto_data["keySize"] = (
                                            len(key_hex) * 4
                                        )  # Hex chars to bits
                                elif "IV:" in line:
                                    crypto_data["parameters"]["iv"] = line.split("IV:")[
                                        1
                                    ].strip()
                                elif "Input:" in line:
                                    input_hex = line.split("Input:")[1].strip()
                                    crypto_data["parameters"]["input"] = input_hex
                                    if (
                                        input_hex
                                        and input_hex != "null"
                                        and input_hex != "(null)"
                                    ):
                                        crypto_data["dataSize"] = (
                                            len(input_hex) // 2
                                        )  # Hex chars to bytes
                                elif "Output:" in line:
                                    crypto_data["parameters"]["output"] = line.split(
                                        "Output:"
                                    )[1].strip()

                            # Determine algorithm (assume AES for now since it's most common)
                            if not crypto_data["algorithm"]:
                                crypto_data["algorithm"] = "AES"

                            hook_queues[queue_key].put(crypto_data)
                            print(
                                f"Parsed raw crypto data: {crypto_data['operation']} | {crypto_data.get('algorithm', 'Unknown')}"
                            )

                        except Exception as parse_error:
                            print(f"Failed to parse raw crypto data: {parse_error}")
                            # Send raw text as fallback
                            hook_queues[queue_key].put(
                                {
                                    "type": "crypto_raw",
                                    "data": payload,
                                    "timestamp": datetime.datetime.now().isoformat(),
                                }
                            )

                    # Also send to main session queue for debugging
                    if session_id in hook_queues:
                        hook_queues[session_id].put(f"Crypto Raw: {payload[:100]}...")

                # Handle different log message types with multiple fallbacks - LOG HANDLER
                elif isinstance(payload, dict) and payload.get("type") == "log":
                    # Try different possible keys for log content
                    log_content = (
                        payload.get("payload")
                        or payload.get("message")
                        or payload.get("data")
                        or payload.get("content")
                        or str(payload)
                    )
                    if session_id in hook_queues:
                        hook_queues[session_id].put(f"Log: {log_content}")

                # Handle other structured message types - STRUCTURED MESSAGE HANDLER
                elif isinstance(payload, dict) and "type" in payload:
                    message_type = payload.get("type", "unknown")
                    message_content = (
                        payload.get("message")
                        or payload.get("data")
                        or payload.get("content")
                        or str(payload)
                    )
                    if session_id in hook_queues:
                        hook_queues[session_id].put(
                            f"{message_type.title()}: {message_content}"
                        )

                # Handle simple string or unstructured messages - FALLBACK HANDLER
                else:
                    if session_id in hook_queues:
                        hook_queues[session_id].put(f"Script output: {payload}")

            elif message["type"] == "error":
                error_description = message.get("description", "Unknown error")
                error_stack = message.get("stack", "")

                error_msg = f"Script error: {error_description}"
                if error_stack:
                    error_msg += f" | Stack: {error_stack}"

                if session_id in hook_queues:
                    hook_queues[session_id].put(error_msg)

                print(f"[{session_id}] {error_msg}")

            # Handle other message types (like 'log' at top level) - TOP LEVEL LOG HANDLER
            elif message["type"] == "log":
                log_content = (
                    message.get("payload") or message.get("message") or str(message)
                )
                if session_id in hook_queues:
                    hook_queues[session_id].put(f"Log: {log_content}")

        except KeyError as e:
            error_msg = (
                f"Message handler KeyError: Missing key {e} in message structure"
            )
            print(f"[{session_id}] {error_msg}")
            print(f"[{session_id}] Message structure: {message}")
            if session_id in hook_queues:
                hook_queues[session_id].put(error_msg)

        except Exception as e:
            error_msg = f"Message handler error: {str(e)}"
            print(f"[{session_id}] {error_msg}")
            print(f"[{session_id}] Message: {message}")
            logger.error(f"Message handler error for session {session_id}: {e}")
            if session_id in hook_queues:
                hook_queues[session_id].put(error_msg)

    return on_message


def load_script_with_timeout(session, agent_code, timeout=60):
    """Load Frida script with custom timeout"""
    script_loaded = Event()
    script_error = None
    loaded_script = None

    def load_script():
        nonlocal script_error, loaded_script
        try:
            print("[*] Creating script...")
            script = session.create_script(agent_code)
            print("[*] Loading script...")
            script.load()
            loaded_script = script
            print("[+] Script loaded successfully")
            script_loaded.set()
        except Exception as e:
            script_error = e
            script_loaded.set()

    # Run script loading in a separate thread
    load_thread = threading.Thread(target=load_script)
    load_thread.daemon = True
    load_thread.start()

    print(f"[*] Waiting for script to load (timeout: {timeout}s)...")

    # Wait for completion or timeout
    if script_loaded.wait(timeout=timeout):
        if script_error:
            raise script_error
        return loaded_script
    else:
        raise TimeoutError(f"Script loading timed out after {timeout} seconds")


def rpc_eval_with_timeout(script, command, timeout=30):
    """Run a persistent-REPL rpc.exports.eval with a bounded wait so one blocking
    command (a busy loop, a stuck synchronous native call) can't hang a worker thread
    forever. The RPC is synchronous, so we run it on a daemon thread and bound the
    wait: the HTTP request returns even if the target never does. Returns the eval
    result, or raises TimeoutError if it doesn't complete in time."""
    done = Event()
    box = {}

    def _run():
        try:
            box["result"] = script.exports_sync.eval(command)
        except Exception as e:  # surfaced to the caller after the wait
            box["error"] = e
        finally:
            done.set()

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    if not done.wait(timeout=timeout):
        raise TimeoutError(f"command did not return within {timeout}s")
    if "error" in box:
        raise box["error"]
    return box.get("result")


# Map feature calls to actual agent functions


def get_feature_command(platform, category, feature):
    """Map FridaClicks features to actual JavaScript commands"""

    feature_map = {
        # iOS App Info features
        ("ios", "appInfo", "basicInfo"): "basic_ios_info()",
        # iOS Device Info features
        ("ios", "deviceInfo", "fridaVersion"): "frida_version()",
        ("ios", "deviceInfo", "loadedBridges"): "frida_loaded_bridges()",
        ("ios", "deviceInfo", "runtimeTest"): "frida_runtime_test()",
        ("ios", "deviceInfo", "bridgeDetails"): "frida_bridge_details()",
        ("ios", "deviceInfo", "runtimeInfo"): "frida_runtime_info()",
        ("ios", "deviceInfo", "iosVersion"): "getIOSVersion()",
        ("ios", "deviceInfo", "healthCheck"): "healthCheck()",
        ("ios", "deviceInfo", "completeInfo"): "getCompleteDeviceInfo()",
        # System Monitor features
        ("ios", "deviceInfo", "getBatteryLevel"): "getBatteryLevel()",
        ("ios", "deviceInfo", "getBatteryState"): "getBatteryState()",
        ("ios", "deviceInfo", "getSystemInfo"): "getSystemInfo()",
        ("ios", "deviceInfo", "getDeviceName"): "getDeviceName()",
        ("ios", "deviceInfo", "getDeviceModel"): "getDeviceModel()",
        ("ios", "deviceInfo", "getDeviceUUID"): "getDeviceUUID()",
        ("ios", "deviceInfo", "getDeviceLocale"): "getDeviceLocale()",
        ("ios", "deviceInfo", "getDeviceTimezone"): "getDeviceTimezone()",
        (
            "ios",
            "deviceInfo",
            "getDeviceScreenResolution",
        ): "getDeviceScreenResolution()",
        ("ios", "deviceInfo", "getDeviceOrientation"): "getDeviceOrientation()",
        ("ios", "deviceInfo", "getCompleteDeviceInfo"): "getCompleteDeviceInfo()",
        # iOS Crypto features
        ("ios", "crypto", "decryptionInfo"): "getDecryptionInfo()",
        ("ios", "crypto", "fairPlayDecrypt"): "fairPlayDecrypt()",
        ("ios", "crypto", "decryptBinaryNow"): "decryptBinaryNow()",
        ("ios", "crypto", "keychainDump"): """
            // Keychain dump implementation
            if (ObjC.available) {
                try {
                    var SecItemCopyMatching = new NativeFunction(
                        Module.findExportByName('Security', 'SecItemCopyMatching'),
                        'int', ['pointer', 'pointer']
                    );

                    var query = ObjC.classes.NSMutableDictionary.alloc().init();
                    query.setObject_forKey_(ObjC.classes.NSString.stringWithString_('*'), 'kSecClass');
                    query.setObject_forKey_(ObjC.classes.NSNumber.numberWithBool_(true), 'kSecReturnAttributes');
                    query.setObject_forKey_(ObjC.classes.NSString.stringWithString_('kSecMatchLimitAll'), 'kSecMatchLimit');

                    "Keychain dump functionality - basic implementation";
                } catch(e) {
                    "Error accessing keychain: " + e.toString();
                }
            } else {
                "ObjC runtime not available";
            }
        """,
        # ADD THESE FILESYSTEM FEATURES - NEW SECTION
        ("ios", "filesystem", "getAppPaths"): "getAppDirectoryPaths()",
        (
            "ios",
            "filesystem",
            "listDirectory",
        ): "listDirectory",  # Called with parameters
        ("ios", "filesystem", "readFile"): "readFile",  # Called with parameters
        ("ios", "filesystem", "writeFile"): "writeFile",  # Called with parameters
        ("ios", "filesystem", "deleteItem"): "deleteItem",  # Called with parameters
        (
            "ios",
            "filesystem",
            "createDirectory",
        ): "createDirectory",  # Called with parameters
        ("ios", "filesystem", "filesystemMonitor"): "startFilesystemMonitoring()",
        # Logging features - these should start continuous monitoring
        ("ios", "deviceInfo", "systemMonitor"): "startSystemMonitoring()",
        (
            "ios",
            "appInfo",
            "methodTracing",
        ): 'console.log("Method tracing started for iOS");',
        ("ios", "network", "networkMonitor"): "startNetworkMonitoring()",
        ("ios", "crypto", "cryptoMonitor"): "startCryptoMonitoring()",
        ## Android Sections
        ("android", "deviceInfo", "androidVersion"): "getAndroidDeviceInfo()",
        ("android", "network", "networkMonitor"): "startAndroidNetworkMonitoring()",
    }

    return feature_map.get(
        (platform, category, feature),
        f'console.log("Feature {platform}.{category}.{feature} not implemented");',
    )


def get_stop_feature_command(platform, category, feature):
    """Map FridaClicks stop features to actual JavaScript commands"""

    stop_feature_map = {
        # System monitoring stop commands
        ("ios", "deviceInfo", "systemMonitor"): "stopSystemMonitoring()",
        ("ios", "network", "networkMonitor"): "stopNetworkMonitoring()",
        ("ios", "appInfo", "methodTracing"): 'console.log("Method tracing stopped");',
        (
            "ios",
            "crypto",
            "cryptoHook",
        ): 'console.log("Crypto hook monitoring stopped");',
        ("ios", "network", "sslInspector"): 'console.log("SSL inspector stopped");',
        (
            "ios",
            "network",
            "websocketMonitor",
        ): 'console.log("WebSocket monitor stopped");',
        ("ios", "network", "networkMonitor"): "stopNetworkMonitoring()",
        ("ios", "crypto", "cryptoMonitor"): "stopCryptoMonitoring()",
        # ADD THESE FILESYSTEM STOP COMMANDS - NEW SECTION
        ("ios", "filesystem", "filesystemMonitor"): "stopFilesystemMonitoring()",
        # Android stop commands can be added here
        ("android", "network", "networkMonitor"): "stopAndroidNetworkMonitoring()",
        (
            "android",
            "filesystem",
            "filesystemMonitor",
        ): "stopAndroidFilesystemMonitoring()",  # Future
    }

    return stop_feature_map.get(
        (platform, category, feature),
        f'console.log("Stop feature {platform}.{category}.{feature} not implemented");',
    )
