import os
import gzip as _gzip
from flask import Flask, request
from flask_admin import Admin
from flask_admin.theme import Bootstrap4Theme
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_bcrypt import Bcrypt
from datetime import timedelta
from flask_jwt_extended import JWTManager
from project.celery_manager import celery as celery_app
from project.celery_manager import configure_celery


# instantiate the extensions
db = SQLAlchemy()
cors = CORS()
bcrypt = Bcrypt()
jwt = JWTManager()
admin = Admin(
    name="Admin",
    theme=Bootstrap4Theme(),
)


def create_app(script_info=None):
    # instantiate the app
    app = Flask(__name__)

    # set config
    app_settings = os.getenv("APP_SETTINGS")
    app.config.from_object(app_settings)

    # Tokens are signed with SECRET_KEY (see User.encode_auth_token). Refuse to
    # boot without one rather than silently issuing tokens signed with `None`.
    if not app.config.get("SECRET_KEY"):
        raise RuntimeError(
            "SECRET_KEY is not set. Refusing to start: tokens would be signed "
            "with an empty key. Set SECRET_KEY in the environment."
        )

    # JWT Configuration. The app mints/verifies tokens via User.encode/decode
    # (HS256 over SECRET_KEY), so JWT_SECRET_KEY defaults to SECRET_KEY to keep
    # any flask-jwt-extended usage consistent with the tokens actually issued.
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY') or app.config['SECRET_KEY']
    app.config['JWT_TOKEN_LOCATION'] = ['headers']
    app.config['JWT_HEADER_NAME'] = 'Authorization'
    app.config['JWT_HEADER_TYPE'] = 'Bearer'
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)

    # Allowed browser origins for CORS. Comma-separated CORS_ORIGINS env var,
    # defaulting to the local dev frontend. Never fall back to "*" on a
    # credentialed API.
    cors_origins = [
        o.strip()
        for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
        if o.strip()
    ]

    # set up extensions
    db.init_app(app)
    cors.init_app(
        app,
        resources={r"/*": {"origins": cors_origins}},
        supports_credentials=True,
    )
    bcrypt.init_app(app)
    jwt.init_app(app)  # Added JWT initialization
    if os.getenv("FLASK_ENV") == "development":
        admin.init_app(app)

    configure_celery(app)
    celery_app.conf.update(app.config)

    # Add JWT error handlers
    @jwt.expired_token_loader
    def expired_token_callback():
        return {"message": "Token has expired"}, 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return {"message": "Invalid token"}, 401

    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return {"message": "Request is missing an access token"}, 401

    # register api
    from project.api import api
    from project.api import audit
    from project.api import tasks

    api.init_app(app)

    # Global authentication guard: every route requires a valid token except an
    # explicit public allowlist (auth login/register/refresh, docs, static).
    # Registered after the API so all routes are covered.
    from project.auth_guard import init_auth_guard
    init_auth_guard(app)

    # gzip large JSON responses (scan results / vulnerability payloads can be
    # multi-MB). Dependency-free; skips small bodies and streamed responses.
    @app.after_request
    def _gzip_json(response):
        try:
            if "gzip" not in request.headers.get("Accept-Encoding", "").lower():
                return response
            if response.direct_passthrough or "Content-Encoding" in response.headers:
                return response
            if not (response.content_type or "").startswith("application/json"):
                return response
            data = response.get_data()
            if len(data) < 1024:
                return response
            compressed = _gzip.compress(data, compresslevel=6)
            response.set_data(compressed)
            response.headers["Content-Encoding"] = "gzip"
            response.headers["Content-Length"] = str(len(compressed))
            response.headers.add("Vary", "Accept-Encoding")
        except Exception:
            # Never let compression break a response.
            return response
        return response

    # shell context for flask cli
    @app.shell_context_processor
    def ctx():
        return {"app": app, "db": db}

    return app