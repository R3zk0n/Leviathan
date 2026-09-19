"""Revoke JWTs on logout so stolen tokens die immediately.

Redis key ``auth:revoked:{user_id}`` stores the logout time. Any token
issued at or before that time is rejected. TTL matches the 6-hour session
so the key expires with the last possible token.
"""

import os
import math
import time

_KEY = "auth:revoked:{user_id}"
_SESSION_SECONDS = 6 * 60 * 60

# Compare and write in one Redis operation: an earlier logout may arrive after a
# newer one. Preserve the winning timestamp's original string (Lua tostring can
# lose the subsecond precision needed by immediate re-login).
_REVOKE_LUA = """
local incoming = tonumber(ARGV[1])
local ttl_ms = tonumber(ARGV[2])
if not incoming or incoming ~= incoming or math.abs(incoming) == math.huge
    or not ttl_ms or ttl_ms < 1 then
    return redis.error_reply('Invalid revocation input')
end
local cutoff = ARGV[1]
local stored = redis.call('GET', KEYS[1])
local existing_ttl = redis.call('PTTL', KEYS[1])
if stored then
    local previous = tonumber(stored)
    if not previous or previous ~= previous or math.abs(previous) == math.huge then
        return redis.error_reply('Invalid stored revocation state')
    end
    if previous > incoming then cutoff = stored end
end
if stored and existing_ttl == -1 then
    redis.call('SET', KEYS[1], cutoff)
else
    redis.call('SET', KEYS[1], cutoff, 'PX', math.max(ttl_ms, existing_ttl))
end
return 1
"""


class RevocationUnavailable(RuntimeError):
    """Session state cannot be verified or persisted; callers must fail closed."""


def _client():
    try:
        import redis
    except ImportError as exc:
        raise RevocationUnavailable("Session service unavailable") from exc
    url = os.getenv("CELERY_BROKER_URL") or os.getenv("REDIS_URL") or "redis://redis:6379/0"
    try:
        return redis.Redis.from_url(
            url, decode_responses=True, socket_timeout=1, socket_connect_timeout=1
        )
    except Exception as exc:
        raise RevocationUnavailable("Session service unavailable") from exc


def revoke_user_tokens(user_id, ttl_seconds=None):
    client = _client()
    # This revokes every existing session for the user, including newer logins
    # whose expiry can be later than the token used to request logout.
    ttl = max(_SESSION_SECONDS + 1, math.ceil(ttl_seconds or 0))
    try:
        if client.eval(
            _REVOKE_LUA, 1, _KEY.format(user_id=int(user_id)), str(time.time()), ttl * 1000
        ) != 1:
            raise RevocationUnavailable("Session revocation was not persisted")
        return True
    except Exception as exc:
        raise RevocationUnavailable("Session service unavailable") from exc


def is_token_revoked(user_id, issued_at):
    if issued_at is None:
        return True
    try:
        issued_at = float(issued_at)
        if not math.isfinite(issued_at):
            return True
    except (TypeError, ValueError):
        return True
    client = _client()
    try:
        raw = client.get(_KEY.format(user_id=int(user_id)))
    except Exception as exc:
        raise RevocationUnavailable("Session service unavailable") from exc
    if not raw:
        return False
    try:
        revoked_at = float(raw)
        if not math.isfinite(revoked_at):
            raise ValueError("Invalid revocation timestamp")
        return issued_at <= revoked_at
    except (TypeError, ValueError):
        raise RevocationUnavailable("Session state is invalid")
