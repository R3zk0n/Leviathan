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
import os

from flask import g, request

from project.api.users.models import User

# Shared secret for trusted service-to-service calls (e.g. the AI/MCP service
# hitting /engine/* to fetch decompiled sources). Requests presenting a matching
# X-Internal-Token bypass user-token validation. Unset => internal bypass off.
_INTERNAL_SERVICE_TOKEN = os.getenv("INTERNAL_SERVICE_TOKEN") or None

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
    # Frida SSE output streams. The browser's native EventSource cannot send an
    # Authorization header, so under the Bearer check below these 401 on connect and
    # NO hook/console/script output ever reaches the REPL (immediate command results
    # still return, since those go over axios — hence the "attaches but no output"
    # symptom). They only stream from an in-memory queue keyed by an unguessable
    # uuid4 session_id and expose no stored/DB data, so on this localhost research
    # tool they are safe to leave open. To add auth later without a header: accept a
    # short-lived "?token=" query param here (validate via User.decode_auth_token)
    # and append it to the EventSource URL client-side. Scoped to these exact
    # prefixes so POST control routes (/frida/execute, /frida/repl/init, ...) stay
    # protected. See Frida_REPL_Reliability_Findings.md #2.
    "/frida/hooks/",
    "/frida/feature-stream/",
)


def _unauthorized(message):
    return {"message": message}, 401


def _is_public(path):
    if path in _PUBLIC_PATHS:
        return True
    return path.startswith(_PUBLIC_PREFIXES)


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
        if _INTERNAL_SERVICE_TOKEN is not None:
            internal = request.headers.get("X-Internal-Token", "")
            if internal and hmac.compare_digest(internal, _INTERNAL_SERVICE_TOKEN):
                g.internal_service = True
                return None

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return _unauthorized("Missing or malformed Authorization header")

        token = auth_header.split(" ", 1)[1].strip()
        user_id = User.decode_auth_token(token)
        # decode_auth_token returns the int user id on success, or an error
        # string ("Signature expired…", "Invalid token…") on failure.
        if not isinstance(user_id, int):
            return _unauthorized("Invalid or expired token")

        g.user_id = user_id
        return None
