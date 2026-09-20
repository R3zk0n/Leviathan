from flask import request
from flask_restx import Resource, fields, Namespace
from flask import jsonify
from flask_restx import Resource
from project.api.database.services import (
    handle_db_error,
    get_android_info_by_package,
    get_all_ios_info
)

from project.api.database.models import AndroidInfo, AndroidActivity
from project.api.database.services import get_appshark_issues, get_activity_status, get_app_secrets_by_package, bulk_add_app_secrets
from project.api.database.services import AndroidService
database_namespace = Namespace("database", description="Levaithan Database Operations")

@database_namespace.route("/appshark-issues/<string:package_name>")
class AppSharkIssues(Resource):
    def get(self, package_name):
        issues = get_appshark_issues(package_name)
        if issues is None:
            return {"message": "No scan results found or an error occurred"}, 404
        return jsonify(issues)


@database_namespace.route("/activity-status/<string:package_name>/<string:activity_name>")
class ActivityStatus(Resource):
    def get(self, package_name, activity_name):
        result, error = get_activity_status(package_name, activity_name)
        if error:
            return jsonify({'error': error}), 404 if 'not found' in error else 500
        return jsonify(result)


@database_namespace.route("/app-secrets/<string:package_name>")
# First, define your resource class without the route decorator
class AppSecrets(Resource):
    def get(self, package_name):
        """
        Get all saved secrets for a specific app package
        """
        secrets, error = get_app_secrets_by_package(package_name)
        if error:
            return {'error': error}, 404 if 'not found' in error else 500
        return secrets

    def post(self, package_name):
        """
        Save discovered secrets for an app
        """
        data = request.get_json()
        if not data or 'secrets' not in data:
            return {'error': 'Invalid request. Must provide secrets data.'}, 400

        # Get the Android app info
        android_info = get_android_info_by_package(package_name)
        if not android_info:
            return {'error': 'Android app not found'}, 404

        # Transform the data into the expected format
        secrets_to_add = []
        for secret in data['secrets']:
            secrets_to_add.append({
                'file_path': secret.get('file', ''),
                'secret_type': secret.get('type', 'Unknown'),
                'description': secret.get('description', ''),
                'redacted_value': secret.get('redacted_value', secret.get('value', '')),
                'raw_value': secret.get('raw_value', ''),
                'secret_line': secret.get('line'),
                'source_name': secret.get('source_name', ''),
                'source_type': secret.get('source_type', ''),
                'detector_type': str(secret.get('detector_type', '')),
                'decoder_name': secret.get('decoder_name', ''),
                'is_verified': secret.get('verified', False),
                'verification_error': secret.get('verification_error', ''),
                'verification_cached': secret.get('verification_cached', False)
            })

        try:
            # Save all secrets in bulk
            bulk_add_app_secrets(android_info.id, secrets_to_add)
            return {'message': f'Successfully saved {len(secrets_to_add)} secrets for {package_name}'}, 201
        except Exception as e:
            return {'error': f'Failed to save secrets: {str(e)}'}, 500

# Then, explicitly register the resource with the namespace
database_namespace.add_resource(AppSecrets, "/app-secrets/<string:package_name>")
