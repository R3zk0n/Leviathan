from datetime import datetime, timezone

from project.api.users.models import User
from project import db, bcrypt
from project.token_revoke import revoke_user_tokens

def register_user(username, password, email=None):
    user = User.query.filter_by(username=username).first()
    if not user:
        new_user = User(
            username=username,
            email=email,
            password=password,
        )
        db.session.add(new_user)
        db.session.commit()
        return new_user
    else:
        raise ValueError("User already exists. Please log in.")




def get_current_user(user_id):
    user = User.query.get(user_id)
    if user:
        return {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'created_at': user.created_at.isoformat() if user.created_at else None,
            'updated_at': user.updated_at.isoformat() if user.updated_at else None,
            'is_authenticated': True
        }
    return {'is_authenticated': False}


def login_user(username, password):
    user = User.query.filter_by(username=username).first()
    if user:
        if user.check_password(password):
            auth_token = user.encode_auth_token(user.id)
            return auth_token, user
        else:
            raise ValueError("Invalid credentials. Please try again.")
    else:
        raise ValueError("Invalid credentials. Please try again.")


def update_user_profile(user_id, username, email):
    user = User.query.get(user_id)
    if not user:
        raise ValueError("User not found.")

    username = (username or "").strip()
    if not username:
        raise ValueError("Username is required.")

    taken = User.query.filter(User.username == username, User.id != user_id).first()
    if taken:
        raise ValueError("Username already taken.")

    email = (email or "").strip() or None
    if email:
        taken_email = User.query.filter(User.email == email, User.id != user_id).first()
        if taken_email:
            raise ValueError("Email already taken.")

    user.username = username
    user.email = email
    user.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return user


def change_user_password(user_id, current_password, new_password):
    user = User.query.get(user_id)
    if not user:
        raise ValueError("User not found.")
    if not current_password or not new_password:
        raise ValueError("Current and new password are required.")
    if not user.check_password(current_password):
        raise ValueError("Current password is incorrect.")
    if len(new_password) < 8:
        raise ValueError("New password must be at least 8 characters.")

    password_hash = bcrypt.generate_password_hash(new_password).decode("utf-8")
    # Refuse the change if existing sessions cannot be invalidated. Revocation
    # precedes the DB commit so a Redis outage cannot leave a false success.
    revoke_user_tokens(user_id)
    user.password = password_hash
    user.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return user

def get_user_by_email(email):
    return User.query.filter_by(email=email).first()

def get_user_by_id(user_id):
    return User.query.get(user_id)