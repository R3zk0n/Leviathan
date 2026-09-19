"""Global authentication guard.

The backend ingests attacker-controlled APKs/IPAs and exposes powerful routes
(Frida spawn/attach, engine scans, decompilation). Historically only two routes
carried an auth decorator; every other route was open. This module closes that
gap with a single ``before_request`` hook applied to the whole app.

It validates tokens the same way the rest of the app already does — via
``User.decode_auth_token`` (HS256 over ``SECRET_KEY``, ``sub`` = user id) — rather
than flask-jwt-extended, whose ``JWT_SECRET_KEY`` is unset and whose token format
does not match the tokens ``/auth/login`` actually issues.
"""

import hmac

from flask import current_app, g, request

from project.api.users.models import User
from project.token_revoke import RevocationUnavailable, is_token_revoked

# Shared secret for trusted service-to-service calls (e.g. the AI/MCP service
# hitting the three decompilation routes below). Match registered rules so a
# future route sharing a path prefix does not inherit service permissions.
_INTERNAL_GET_RULES = frozenset({
    "/engine/decompile/<string:file_name>",
    "/engine/decompile/check/<string:file_name>",
    "/engine/decompiled/<string:file_name>/<string:java_file>",
    "/engine/decompiled/<string:file_name>/<path:java_file>",
})

# Exact paths reachable without a valid token. Everything else is protected.
_PUBLIC_PATHS = frozenset(
    {
        "/auth/login",
        "/auth/register",
        "/auth/refresh",
    }
)

# Path prefixes always allowed: API docs and Flask static assets.
_PUBLIC_PREFIXES = (
    "/swagger",
    "/static/",
)


def _unauthorized(message):
    return {"message": message}, 401


def _is_public(path):
    if path in _PUBLIC_PATHS:
        return True
    return path.startswith(_PUBLIC_PREFIXES)


class InvalidSession(ValueError):
    """The bearer token is invalid, expired, or revoked."""


def validate_user_token(token):
    """Validate a bearer session; reusable by long-lived stream handlers."""
    payload = User.decode_auth_payload(token)
    if not isinstance(payload, dict):
        raise InvalidSession("Invalid or expired token")
    try:
        int(payload["sub"])
        if not payload.get("exp") or payload.get("iat") is None:
            raise ValueError("Missing session claims")
    except (ValueError, KeyError, TypeError):
        raise InvalidSession("Invalid or expired token")
    if is_token_revoked(int(payload["sub"]), payload["iat"]):
        raise InvalidSession("Session ended. Please log in again.")
    return payload


def init_auth_guard(app):
    """Register the global auth guard on ``app``."""

    @app.before_request
    def _require_auth():
        # CORS preflight requests never carry an Authorization header.
        if request.method == "OPTIONS":
            return None

        if _is_public(request.path or ""):
            return None

        # Trusted internal services authenticate with a shared token instead of
        # a user JWT. Constant-time comparison to avoid leaking it via timing.
        service_token = current_app.config.get("INTERNAL_SERVICE_TOKEN")
        if service_token is not None:
            internal = request.headers.get("X-Internal-Token", "")
            if internal and hmac.compare_digest(internal.encode(), service_token.encode()):
                if request.method != "GET" or not request.url_rule or request.url_rule.rule not in _INTERNAL_GET_RULES:
                    return {"message": "Internal service is not allowed to access this operation"}, 403
                g.internal_service = True
                return None

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return _unauthorized("Missing or malformed Authorization header")

        token = auth_header.split(" ", 1)[1].strip()
        try:
            payload = validate_user_token(token)
        except InvalidSession as exc:
            return _unauthorized(str(exc))
        except RevocationUnavailable:
            return {"message": "Session service unavailable. Please retry."}, 503

        g.user_id = int(payload["sub"])
        return None
