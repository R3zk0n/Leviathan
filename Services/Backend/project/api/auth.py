from datetime import datetime, timezone

from flask import request, g
from flask_restx import Namespace, Resource, fields
from project.api.users.services import register_user, login_user, get_user_by_id
from project.api.users.models import User
from project.token_revoke import RevocationUnavailable, revoke_user_tokens
from project.auth_guard import InvalidSession, validate_user_token


auth_namespace = Namespace("auth")

user = auth_namespace.model(
    "User",
    {
        "username": fields.String(required=True),
    }
)

register_input = auth_namespace.model(
    "Register",
    {
        "username": fields.String(required=True),
        "password": fields.String(required=True),
    }
)

login = auth_namespace.model(
    "Login",
    {
        "username": fields.String(required=True),
        "password": fields.String(required=True),
    }
)

refresh = auth_namespace.model(
    "Refresh",
    {
        "refresh_token": fields.String(required=True),
    }
)

tokens = auth_namespace.inherit(
    "Access and refresh tokens",
    refresh,
    {
        "access_token": fields.String(required=True),
    }
)

parser = auth_namespace.parser()
parser.add_argument("Authorization", location="headers")

class Register(Resource):
    @auth_namespace.marshal_with(user)
    @auth_namespace.expect(register_input, validate=True)
    @auth_namespace.response(201, "Success")
    @auth_namespace.response(400, "Sorry. That username already exists.")
    def post(self):
        post_data = request.get_json()
        username = post_data.get("username")
        password = post_data.get("password")

        try:
            new_user = register_user(username, password)
            return new_user.to_dict(), 201
        except ValueError as e:
            auth_namespace.abort(400, str(e))

class Login(Resource):
    @auth_namespace.marshal_with(tokens)
    @auth_namespace.expect(login, validate=True)
    @auth_namespace.response(200, "Success")
    @auth_namespace.response(404, "User does not exist")
    def post(self):
        post_data = request.get_json()
        username = post_data.get("username")
        password = post_data.get("password")

        try:
            auth_token, user = login_user(username, password)
            response_object = {
                "access_token": auth_token.decode() if isinstance(auth_token, bytes) else auth_token,
                "refresh_token": auth_token.decode() if isinstance(auth_token, bytes) else auth_token,
                "user": user.to_dict()
            }
            return response_object, 200
        except ValueError as e:
            print(e)
            auth_namespace.abort(404, str(e))

class Refresh(Resource):
    @auth_namespace.marshal_with(tokens)
    @auth_namespace.expect(refresh, validate=True)
    @auth_namespace.response(200, "Success")
    @auth_namespace.response(401, "Invalid token")
    def post(self):
        post_data = request.get_json()
        refresh_token = post_data.get("refresh_token")

        try:
            payload = validate_user_token(refresh_token)
        except InvalidSession as exc:
            auth_namespace.abort(401, str(exc))
        except RevocationUnavailable:
            auth_namespace.abort(503, "Session service unavailable. Please retry.")

        try:
            user_id = int(payload["sub"])
            expires_at = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        except (ValueError, KeyError, TypeError):
            auth_namespace.abort(401, "Invalid token")

        if expires_at <= datetime.now(timezone.utc):
            auth_namespace.abort(401, "Session expired. Please log in again.")
        user = get_user_by_id(user_id)
        if not user:
            auth_namespace.abort(401, "Invalid token")

        # Keep the original 6-hour expiry so refresh cannot extend the session.
        access_token = user.encode_auth_token(user.id, expires_at=expires_at, issued_at=payload["iat"])
        refresh_token = user.encode_auth_token(user.id, expires_at=expires_at, issued_at=payload["iat"])

        response_object = {
            "access_token": access_token.decode() if isinstance(access_token, bytes) else access_token,
            "refresh_token": refresh_token.decode() if isinstance(refresh_token, bytes) else refresh_token,
        }
        return response_object, 200


class Logout(Resource):
    def post(self):
        user_id = getattr(g, "user_id", None)
        if not user_id:
            auth_namespace.abort(401, "Token required")

        try:
            revoke_user_tokens(user_id)
        except RevocationUnavailable:
            auth_namespace.abort(503, "Logout could not be completed. Please retry.")
        return {"message": "Logged out"}, 200

class Status(Resource):
    @auth_namespace.marshal_with(user)
    @auth_namespace.response(200, "Success")
    @auth_namespace.response(401, "Invalid token")
    @auth_namespace.expect(parser)
    def get(self):
        auth_header = request.headers.get("Authorization")
        if auth_header:
            access_token = auth_header.split(" ")[1]
            resp = User.decode_auth_token(access_token)
            if not isinstance(resp, int):
                auth_namespace.abort(401, resp)

            user = get_user_by_id(resp)
            if not user:
                auth_namespace.abort(401, "Invalid token")
            return user.to_dict(), 200
        else:
            auth_namespace.abort(403, "Token required")

auth_namespace.add_resource(Register, "/register")
auth_namespace.add_resource(Login, "/login")
auth_namespace.add_resource(Refresh, "/refresh")
auth_namespace.add_resource(Logout, "/logout")
auth_namespace.add_resource(Status, "/status")
