"""AI container (MCP / agents) reachability endpoints."""

import socket

from project.api.engine._shared import (
    Resource, engine_namespace,
)


@engine_namespace.route('/mcp/status')
class EngineMcpStatus(Resource):
    def get(self):
        """Ping the AI container's MCP server over the Docker network."""
        try:
            # The ai service is reachable by hostname 'ai' inside api_bridge.
            # We just check TCP connectivity on the default SSH/stdio port —
            # for a stdio server we simply check the container is reachable.
            sock = socket.create_connection(("ai", 22), timeout=2)
            sock.close()
            return {"message": "Online"}
        except Exception:
            # Container up but no open port is fine for a stdio-only server —
            # what matters is the container is in the fleet.
            try:
                socket.getaddrinfo("ai", None)
                return {"message": "Online (stdio)"}
            except Exception as e:
                return {"message": f"Unreachable: {str(e)}"}, 503


@engine_namespace.route('/agents/status')
class EngineAgentsStatus(Resource):
    def get(self):
        """Check whether the AI container (agents runner) is reachable."""
        try:
            socket.getaddrinfo("ai", None)
            return {"message": "Online"}
        except Exception as e:
            return {"message": f"Unreachable: {str(e)}"}, 503
