from flask import request, g
from flask_restx import Namespace, Resource
from project.token_revoke import RevocationUnavailable

from project.api.users.services import (
    get_user_by_id,
    update_user_profile,
    change_user_password,
)

users_namespace = Namespace("users", description="User Operations")


def _profile_payload(user):
    return {
        "username": user.username,
        "email": user.email,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


@users_namespace.route("/profile")
class UserProfile(Resource):
    def get(self):
        user = get_user_by_id(g.user_id)
        if not user:
            return {"message": "User not found"}, 404
        return _profile_payload(user)

    def put(self):
        data = request.get_json() or {}
        try:
            user = update_user_profile(
                g.user_id,
                data.get("username"),
                data.get("email"),
            )
            return _profile_payload(user)
        except ValueError as e:
            return {"message": str(e)}, 400


@users_namespace.route("/profile/password")
class UserPassword(Resource):
    def put(self):
        data = request.get_json() or {}
        try:
            change_user_password(
                g.user_id,
                data.get("current_password"),
                data.get("new_password"),
            )
            return {"message": "Password changed"}
        except RevocationUnavailable:
            return {"message": "Password was not changed: session service unavailable. Please retry."}, 503
        except ValueError as e:
            return {"message": str(e)}, 400
