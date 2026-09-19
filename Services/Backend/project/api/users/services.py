from project.api.users.models import User
from project import db

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
    if user:
        user.username = username
        user.email = email
        db.session.commit()
        return user
    else:
        raise ValueError("User not found.")

def get_user_by_email(email):
    return User.query.filter_by(email=email).first()

def get_user_by_id(user_id):
    return User.query.get(user_id)