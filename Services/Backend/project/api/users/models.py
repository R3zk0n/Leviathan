import uuid
from datetime import datetime, timedelta, timezone
import jwt
from flask import current_app

from project import db, bcrypt

SESSION_TTL = timedelta(hours=6)

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(255), nullable=False, unique=True)
    # Optional: registration is username+password only. Kept (nullable, unique)
    # for existing accounts and admin bootstrap; Postgres allows multiple NULLs.
    email = db.Column(db.String(255), nullable=True, unique=True)
    password = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def __init__(self, username, password, email=None):
        self.username = username
        self.email = email
        self.password = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password):

        data = bcrypt.check_password_hash(self.password, password)
        print(f"Check Password Data: {data}")
        return bcrypt.check_password_hash(self.password, password)

    def encode_auth_token(self, user_id, expires_at=None, issued_at=None):
        try:
            now = datetime.now(timezone.utc)
            exp = expires_at or (now + SESSION_TTL)
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            payload = {
                'exp': exp,
                # Refresh retains the original session issuance time so a
                # concurrent logout also invalidates the refreshed token.
                # A numeric timestamp also preserves subsecond precision:
                # datetime claims are truncated by PyJWT, rejecting an
                # immediate re-login in the same second as a logout.
                'iat': now.timestamp() if issued_at is None else issued_at,
                # `sub` must be a string: PyJWT >= 2.10 raises InvalidSubjectError
                # on decode if the subject claim is not a string.
                'sub': str(user_id),
                'jti': uuid.uuid4().hex,
            }
            return jwt.encode(
                payload,
                current_app.config.get('SECRET_KEY'),
                algorithm='HS256'
            )
        except Exception as e:
            return e

    @staticmethod
    def decode_auth_payload(auth_token):
        try:
            return jwt.decode(
                auth_token,
                current_app.config.get('SECRET_KEY'),
                algorithms=['HS256'],
            )
        except jwt.ExpiredSignatureError:
            return 'Signature expired. Please log in again.'
        except jwt.InvalidTokenError:
            return 'Invalid token. Please log in again.'

    @staticmethod
    def decode_auth_token(auth_token):
        payload = User.decode_auth_payload(auth_token)
        if isinstance(payload, str):
            return payload
        try:
            return int(payload['sub'])
        except (ValueError, KeyError, TypeError):
            return 'Invalid token. Please log in again.'

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
