"""Recheck long-lived stream credentials after the initial request guard."""

import time

from project.auth_guard import validate_user_token, InvalidSession, RevocationUnavailable


class StreamAuthorization:
    def __init__(self, authorization):
        self.token = authorization.removeprefix("Bearer ").strip()
        self.checked_at = None

    def valid(self):
        now = time.monotonic()
        if self.checked_at is not None and now - self.checked_at < 5:
            return True
        try:
            validate_user_token(self.token)
        except (InvalidSession, RevocationUnavailable):
            return False
        self.checked_at = now
        return True
