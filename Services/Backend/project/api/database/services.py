from project import db
from project.api.database.models import (
    AndroidInfo, iOSInfo, AndroidActivity, AndroidSourceCode, iOSSourceCode,
    ActivityCategory, ActivityAction, ActivityScheme, ActivityIntentFilter,
    AndroidService, ServiceAction, ServiceCategory, ServiceScheme,
    AndroidReceiver, ReceiverAction, ReceiverCategory, ReceiverScheme,
    AndroidProvider, ProviderAction, ProviderCategory, ProviderScheme,
    Task, User, AppsharkScan, AppsharkSecurityIssue, AppsharkVulnerability, AppSecret
)
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import joinedload
from sqlalchemy import text

from datetime import datetime


def parse_exported_attr(xml_value):
    """Tri-state interpretation of the android:exported manifest attribute.

    Returns:
        True  - attribute explicitly "true"
        False - attribute explicitly anything else (typically "false")
        None  - attribute absent (caller applies implicit-export heuristic)
    """
    if xml_value is None:
        return None
    return xml_value == "true"


def is_component_accessible(exported, has_intent_filters):
    """Whether an activity/service/receiver is reachable from a 3rd-party app.

    Honors explicit android:exported="false" as an opt-out regardless of
    intent-filter presence (the bug that previously caused false positives:
    receivers like com.android.packageinstaller.common.InstallEventReceiver
    declare exported=false + intent-filter and are NOT 3rd-party reachable).

    Implicit export (pre-targetSdk-31): activities/services/receivers with at
    least one intent-filter and no explicit exported attribute were considered
    exported by Android. We preserve that fallback only when `exported` is None.
    """
    if exported is True:
        return True
    if exported is False:
        return False
    return has_intent_filters


# Error handling decorator for database operations
def handle_db_error(func):
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except SQLAlchemyError as e:
            db.session.rollback()
            print(f"Database error: {e}")
            return None, str(e)
    return wrapper

# Function to execute stored procedures
def execute_stored_procedure(procedure_name, *args):
    try:
        arg_placeholders = ', '.join([':arg{}'.format(i) for i in range(len(args))])
        params = {f'arg{i}': arg for i, arg in enumerate(args)}
        result = db.session.execute(text(f"CALL {procedure_name}({arg_placeholders})"), params)
        db.session.commit()
        return result.fetchall() if result.returns_rows else None
    except SQLAlchemyError as e:
        db.session.rollback()
        print(f"Stored procedure execution error: {e}")
        return None, str(e)

# Functions to call stored procedures
@handle_db_error
def add_android_info(app_name, package_name, version, sdk_version, developer=None, release_date=None):
    return execute_stored_procedure(
        'add_android_info',
        app_name,
        package_name,
        version,
        developer,
        release_date
    )

@handle_db_error
def add_android_activity(android_info_id, activity_name, activity_exported, activity_permission):
    existing_activity = AndroidActivity.query.filter_by(
        android_info_id=android_info_id,
        activity_name=activity_name
    ).first()

    if not existing_activity:
        return execute_stored_procedure(
            'add_android_activity',
            android_info_id,
            activity_name,
            activity_exported,
            activity_permission
        )
    else:
        return {"message": "Activity already exists."}, 200

@handle_db_error
def add_activity_action(activity_id, action):
    return execute_stored_procedure(
        'add_activity_action',
        activity_id,
        action
    )

@handle_db_error
def add_activity_category(activity_id, category):
    return execute_stored_procedure(
        'add_activity_category',
        activity_id,
        category
    )

@handle_db_error
def add_activity_scheme(activity_id, scheme):
    return execute_stored_procedure(
        'add_activity_scheme',
        activity_id,
        scheme
    )

@handle_db_error
def add_activity_intent_filter(activity_id, intent_action, intent_category=None, intent_data_scheme=None):
    return execute_stored_procedure(
        'add_activity_intent_filter',
        activity_id,
        intent_action,
        intent_category,
        intent_data_scheme
    )

# Example usage for adding new AndroidInfo
@handle_db_error
def add_android_info_entry(app_name, package_name, version, developer=None, release_date=None):
    return execute_stored_procedure(
        'add_android_info',
        app_name,
        package_name,
        version,
        developer,
        release_date
    )

# Adding Android Activities and their intent filters
@handle_db_error
def add_android_activities(app_name, package_name, activities):
    android_info = AndroidInfo.query.filter_by(app_name=app_name, package_name=package_name).first()

    if not android_info:
        return {"error": "App not found."}, 404

    for activity in activities:
        add_android_activity(
            android_info.id,
            activity.get('activity_name'),
            activity.get('activity_exported', False),
            activity.get('activity_permission')
        )

        new_activity = AndroidActivity.query.filter_by(
            android_info_id=android_info.id,
            activity_name=activity.get('activity_name')
        ).first()

        if new_activity:
            for intent_filter in activity.get('intent_filters', []):
                for action in intent_filter.get('actions', []):
                    add_activity_action(new_activity.id, action)

                for category in intent_filter.get('categories', []):
                    add_activity_category(new_activity.id, category)

                for scheme in intent_filter.get('schemes', []):
                    add_activity_scheme(new_activity.id, scheme['scheme'])

                add_activity_intent_filter(
                    new_activity.id,
                    ",".join(intent_filter["actions"]),
                    ",".join(intent_filter["categories"]),
                    ",".join([scheme["scheme"] for scheme in intent_filter["schemes"]])
                )

    return {"message": "Activities added successfully."}, 201

# Generic functions
@handle_db_error
def delete_instance(model, instance_id):
    instance = model.query.get(instance_id)
    if instance:
        db.session.delete(instance)
        db.session.commit()
        return instance
    return None

@handle_db_error
def add_instance(model, **kwargs):
    instance = model(**kwargs)
    db.session.add(instance)
    db.session.commit()
    return instance

@handle_db_error
def get_instance_by_id(model, instance_id):
    return model.query.get(instance_id)

@handle_db_error
def get_all_instances(model):
    return model.query.all()

# AndroidInfo specific functions
@handle_db_error
def get_android_info_by_package(package_name):
    return AndroidInfo.query.filter_by(package_name=package_name).first()

# iOSInfo specific functions
@handle_db_error
def get_ios_info_by_bundle(bundle_id):
    return iOSInfo.query.filter_by(bundle_id=bundle_id).first()

# Task specific functions
@handle_db_error
def get_tasks_by_status(status):
    return Task.query.filter_by(status=status).all()

# Example usage for adding new IosInfo
@handle_db_error
def add_ios_info(app_name, bundle_id, version, developer=None, release_date=None):
    return add_instance(iOSInfo, app_name=app_name, bundle_id=bundle_id, version=version, developer=developer, release_date=release_date)

# Small user functions
@handle_db_error
def get_all_ios_info():
    return iOSInfo.query.all()

@handle_db_error
def get_all_android_info():
    return AndroidInfo.query.all()

# Additional functions for managing related entities
@handle_db_error
def add_activity_action(activity_id, action):
    return execute_stored_procedure(
        'add_activity_action',
        activity_id,
        action
    )

@handle_db_error
def add_activity_category(activity_id, category):
    return execute_stored_procedure(
        'add_activity_category',
        activity_id,
        category
    )

@handle_db_error
def add_activity_scheme(activity_id, scheme):
    return execute_stored_procedure(
        'add_activity_scheme',
        activity_id,
        scheme
    )

@handle_db_error
def add_activity_intent_filter(activity_id, intent_action, intent_category=None, intent_data_scheme=None):
    return execute_stored_procedure(
        'add_activity_intent_filter',
        activity_id,
        intent_action,
        intent_category,
        intent_data_scheme
    )

# AndroidService specific functions
@handle_db_error
def add_android_service(android_info_id, service_name, service_exported, service_permission):
    return execute_stored_procedure(
        'add_android_service',
        android_info_id,
        service_name,
        service_exported,
        service_permission
    )

# AndroidReceiver specific functions
@handle_db_error
def add_android_receiver(android_info_id, receiver_name, receiver_exported, receiver_permission):
    result = execute_stored_procedure(
        'add_android_receiver',
        android_info_id,
        receiver_name,
        receiver_exported,
        receiver_permission
    )
    return result[0] if result else None


@handle_db_error
def add_app_secret(android_info_id, file_path, secret_type, description, redacted_value,
                   raw_value=None, secret_line=None, source_name=None, source_type=None,
                   detector_type=None, decoder_name=None, is_verified=False,
                   verification_error=None, verification_cached=False):
    """
    Adds a discovered secret to the database for a specific Android app.
    """
    return execute_stored_procedure(
        'add_app_secret',
        android_info_id,
        file_path,
        secret_type,
        description,
        redacted_value,
        raw_value,
        secret_line,
        source_name,
        source_type,
        detector_type,
        decoder_name,
        is_verified,
        verification_error,
        verification_cached
    )


@handle_db_error
def get_app_secrets_by_package(package_name):
    """
    Retrieves all secrets for a specific Android app by package name.
    """

    try:
        print("Package Name: ", package_name)
        android_info = AndroidInfo.query.filter_by(package_name=package_name).first()
        print("Android Info: ", android_info)
        if not android_info:
            return None, 'Android app not found'

        secrets = AppSecret.query.filter_by(android_info_id=android_info.id).all()
        print("Secrets: ", secrets)
        if not secrets:
            return [], None

        return [{
            'id': secret.id,
            'file_path': secret.file_path,
            'secret_type': secret.secret_type,
            'description': secret.description,
            'redacted_value': secret.redacted_value,
            'raw_value': secret.raw_value,
            'secret_line': secret.secret_line,
            'source_name': secret.source_name,
            'source_type': secret.source_type,
            'detector_type': secret.detector_type,
            'decoder_name': secret.decoder_name,
            'is_verified': secret.is_verified,
            'verification_error': secret.verification_error,
            'verification_cached': secret.verification_cached,
            'scan_date': secret.scan_date.isoformat() if secret.scan_date else None
        } for secret in secrets], None
    except Exception as e:
        return None, str(e)


@handle_db_error
def bulk_add_app_secrets(android_info_id, secrets):
    """
    Adds multiple secrets at once for efficiency.
    """
    for secret in secrets:
        add_app_secret(
            android_info_id=android_info_id,
            file_path=secret.get('file_path'),
            secret_type=secret.get('secret_type'),
            description=secret.get('description'),
            redacted_value=secret.get('redacted_value'),
            raw_value=secret.get('raw_value'),
            secret_line=secret.get('secret_line'),
            source_name=secret.get('source_name'),
            source_type=secret.get('source_type'),
            detector_type=secret.get('detector_type'),
            decoder_name=secret.get('decoder_name'),
            is_verified=secret.get('is_verified', False),
            verification_error=secret.get('verification_error'),
            verification_cached=secret.get('verification_cached', False)
        )
    return True

@handle_db_error
def add_android_provider(android_info_id, provider_name, provider_exported, provider_permission,
                         grant_uri_permissions, authorities, read_permission, write_permission):
    result = db.session.execute(
        "CALL add_android_provider(:android_info_id, :provider_name, :provider_exported, :provider_permission, "
        ":grant_uri_permissions, :authorities, :read_permission, :write_permission, :provider_id)",
        {
            'android_info_id': android_info_id,
            'provider_name': provider_name,
            'provider_exported': provider_exported,
            'provider_permission': provider_permission,
            'grant_uri_permissions': grant_uri_permissions,
            'authorities': authorities,
            'read_permission': read_permission,
            'write_permission': write_permission,
            'provider_id': None  # This will be populated by the procedure
        }
    )
    db.session.commit()
    return result.fetchone()[0]  # Return the provider_id

@handle_db_error
def add_provider_metadata(provider_id, meta_name, meta_resource, meta_content):
    execute_stored_procedure(
        'add_provider_metadata',
        provider_id,
        meta_name,
        meta_resource,
        meta_content
    )

# AndroidSourceCode specific functions
@handle_db_error
def add_android_source_code(android_info_id, source_code, repository_type, branch):
    return execute_stored_procedure(
        'add_android_source_code',
        android_info_id,
        source_code,
        repository_type,
        branch
    )

# iOSSourceCode specific functions
@handle_db_error
def add_ios_source_code(ios_info_id, source_code, repository_type, branch):
    return execute_stored_procedure(
        'add_ios_source_code',
        ios_info_id,
        source_code,
        repository_type,
        branch
    )


@handle_db_error
def add_receiver_action(receiver_id, action):
    return execute_stored_procedure(
        'add_receiver_action',
        receiver_id,
        action
    )

@handle_db_error
def add_receiver_category(receiver_id, category):
    return execute_stored_procedure(
        'add_receiver_category',
        receiver_id,
        category
    )

@handle_db_error
def add_receiver_scheme(receiver_id, scheme):
    return execute_stored_procedure(
        'add_receiver_scheme',
        receiver_id,
        scheme
    )

@handle_db_error
def add_appshark_scan(android_info_id, app_info, manifest_risks):
    return execute_stored_procedure(
        'add_appshark_scan',
        android_info_id,
        app_info,
        manifest_risks
    )

@handle_db_error
def add_appshark_security_issue(appshark_scan_id, category, name, detail, model, possibility, wiki, deobf_apk):
    return execute_stored_procedure(
        'add_appshark_security_issue',
        appshark_scan_id,
        category,
        name,
        detail,
        model,
        possibility,
        wiki,
        deobf_apk
    )

@handle_db_error
def get_activity_status(package_name, activity_name):
    try:
        android_info = AndroidInfo.query.filter_by(package_name=package_name).first()
        print("Android Info: ", android_info)
        if not android_info:
            return None, 'Android app not found'

        activity = AndroidActivity.query.filter_by(
            android_info_id=android_info.id,
            activity_name=activity_name
        ).first()
        print("Activity: ", activity)

        if not activity:
            return None, 'Activity not found'

        return {'exported': activity.activity_exported}, None
    except Exception as e:
        return None, str(e)
@handle_db_error
def get_appshark_issues(package_name):
    latest_scan = None
    try:
        # Get the latest scan for the given package
        latest_scan = (
            AppsharkScan.query
            .join(AndroidInfo)
            .filter(AndroidInfo.package_name == package_name)
            .order_by(AppsharkScan.scan_date.desc())
            .first()
        )

        if not latest_scan:
            return [], None

        # Fetch security issues with their vulnerabilities
        issues = (
            AppsharkSecurityIssue.query
            .options(joinedload(AppsharkSecurityIssue.vulnerabilities))
            .filter(AppsharkSecurityIssue.appshark_scan_id == latest_scan.id)
            .all()
        )

        data = [{
            'id': issue.id,
            'category': issue.category,
            'name': issue.name,
            'detail': issue.detail,
            'model': issue.model,
            'possibility': issue.possibility,
            'vulnerabilities': [{
                'id': vuln.id,
                'position': vuln.position,
                'entry_method': vuln.entry_method,
                'sink': vuln.sink,
                'source': vuln.source,
                'url': vuln.url,
                'target': vuln.target,
                'manifest': vuln.manifest,
                'hash': vuln.hash,
                'old_hash': vuln.old_hash,
                'possibility': vuln.possibility
            } for vuln in issue.vulnerabilities]
        } for issue in issues]

        return data, None
    except Exception as e:
        scan_id = getattr(latest_scan, 'id', None)
        print(f"Error fetching AppShark issues for package={package_name} scan_id={scan_id}: {str(e)}")
        return None, str(e)
@handle_db_error
def add_appshark_vulnerability(security_issue_id, position, entry_method, sink, source, url, target, manifest, hash, old_hash, possibility):
    return execute_stored_procedure(
        'add_appshark_vulnerability',
        security_issue_id,
        position,
        entry_method,
        sink,
        source,
        url,
        target,
        manifest,
        hash,
        old_hash,
        possibility
    )

@handle_db_error
def add_task(task_type, payload):
    return execute_stored_procedure(
        'add_task',
        task_type,
        payload
    )

# Add these utility functions

@handle_db_error
def get_latest_android_scans():
    return db.session.execute("SELECT * FROM latest_android_scans").fetchall()

@handle_db_error
def get_app_vulnerability_summary():
    return db.session.execute("SELECT * FROM app_vulnerability_summary").fetchall()

@handle_db_error
def cleanup_old_data():
    return db.session.execute("SELECT cleanup_old_data()").scalar()