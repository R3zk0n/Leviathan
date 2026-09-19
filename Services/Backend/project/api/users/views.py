import jwt
from flask import request, g
from flask_restx import Namespace, Resource, fields
from project.api.users.models import User
from project.api.users.services import get_current_user


from flask import jsonify

users_namespace = Namespace("users", description="User Operations")

@users_namespace.route("/profile")
class UserProfile(Resource):
    def get(self):
        current_user_id = g.user_id
        try:
            user_data = get_current_user(current_user_id)
            if user_data:
                # Return the data directly, not wrapped in a Response object
                return {
                    "username": user_data.get('username'),
                    "email": user_data.get('email'),
                    "created_at": user_data.get('created_at'),
                    "updated_at": user_data.get('updated_at')
                }
            return {"message": "User not found"}, 404
        except Exception as e:
            return {"message": str(e)}, 500

    def put(self):
        current_user_id = g.user_id
        data = request.get_json()
        try:
            updated_user = update_user_profile(current_user_id, data)
            # Return the updated user data directly
            return {
                "username": updated_user.username,
                "email": updated_user.email,
                "updated_at": updated_user.updated_at
            }
        except ValueError as e:
            return {"message": str(e)}, 400
