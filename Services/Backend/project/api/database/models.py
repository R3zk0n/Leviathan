import os
import datetime
import os
import uuid
from datetime import datetime

from sqlalchemy.dialects.postgresql import JSONB, ARRAY
import jwt
from flask import current_app
from sqlalchemy.sql import func
from project import db, bcrypt
from flask_restx import Namespace, Resource
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSONB, ARRAY, ENUM
database_namespace = Namespace("Database", description="Levaithan Database Operations")





class AndroidInfo(db.Model):
    __tablename__ = 'android_info'
    id = db.Column(db.Integer, primary_key=True)
    app_name = db.Column(db.String(255), nullable=False)
    package_name = db.Column(db.String(255), nullable=False)
    version = db.Column(db.String(50), nullable=False)
    developer = db.Column(db.String(255))
    release_date = db.Column(db.Date)
    manifest_xml = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    activities = db.relationship('AndroidActivity', backref='android_info', lazy=True, cascade="all, delete-orphan")
    services = db.relationship('AndroidService', backref='android_info', lazy=True, cascade="all, delete-orphan")
    receivers = db.relationship('AndroidReceiver', backref='android_info', lazy=True, cascade="all, delete-orphan")
    providers = db.relationship('AndroidProvider', backref='android_info', lazy=True, cascade="all, delete-orphan")
    source_code = db.relationship('AndroidSourceCode', backref='android_info', lazy=True, cascade="all, delete-orphan")
    appshark_scans = db.relationship('AppsharkScan', backref='android_info', lazy=True, cascade="all, delete-orphan")
    apk_details = db.relationship('ApkDetails', back_populates='android_info', uselist=False, cascade="all, delete-orphan")
    __table_args__ = (db.UniqueConstraint('package_name', 'version', name='uix_package_version'),)

    def __repr__(self):
        return f"<AndroidInfo(id={self.id}, app_name='{self.app_name}', package_name='{self.package_name}', version='{self.version}')>"


class ApkDetails(db.Model):
    __tablename__ = 'apk_details'
    id = db.Column(db.Integer, primary_key=True)
    android_info_id = db.Column(db.Integer, db.ForeignKey('android_info.id'), nullable=False, unique=True)
    app_version = db.Column(db.String(50))
    package_name = db.Column(db.String(255), nullable=False)
    sdk_version = db.Column(db.String(50))
    debuggable = db.Column(db.Boolean)
    main_activity = db.Column(db.String(255))
    android_user = db.Column(db.String(255))
    recon_data = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship with AndroidInfo
    android_info = db.relationship('AndroidInfo', back_populates='apk_details')

    def __repr__(self):
        return f"<ApkDetails(id={self.id}, package_name='{self.package_name}', app_version='{self.app_version}, android_user='{self.android_user}')>"


class iOSInfo(db.Model):
    __tablename__ = 'ios_info'
    id = db.Column(db.Integer, primary_key=True)
    app_name = db.Column(db.String(255), nullable=False)
    bundle_id = db.Column(db.String(255), nullable=False)
    version = db.Column(db.String(50), nullable=False)
    developer = db.Column(db.String(255))
    release_date = db.Column(db.Date)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    source_code = db.relationship('iOSSourceCode', backref='ios_info', lazy=True)
    __table_args__ = (db.UniqueConstraint('bundle_id', 'version', name='uix_bundle_version'),)


class AndroidActivity(db.Model):
    __tablename__ = 'android_activities'
    id = db.Column(db.Integer, primary_key=True)
    android_info_id = db.Column(db.Integer, db.ForeignKey('android_info.id'), nullable=False)
    activity_name = db.Column(db.String(255), nullable=False)
    activity_exported = db.Column(db.Boolean)  # tri-state: True/False explicit, NULL = attribute absent (implicit-export resolved via intent-filters)
    activity_permission = db.Column(db.String(255))
    manifest_snippet = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Changed lazy loading strategy to prevent massive JOINs
    # 'selectin' loads in separate query, avoiding Cartesian products
    actions = db.relationship('ActivityAction', backref='android_activity', lazy='selectin')
    categories = db.relationship('ActivityCategory', backref='android_activity', lazy='selectin')
    schemes = db.relationship('ActivityScheme', backref='android_activity', lazy='selectin')
    intent_filters = db.relationship('ActivityIntentFilter', backref='android_activity', lazy='selectin')


class ActivityAction(db.Model):
    __tablename__ = 'activity_actions'
    id = db.Column(db.Integer, primary_key=True)
    activity_id = db.Column(db.Integer, db.ForeignKey('android_activities.id'), nullable=False)
    action = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ActivityCategory(db.Model):
    __tablename__ = 'activity_categories'
    id = db.Column(db.Integer, primary_key=True)
    activity_id = db.Column(db.Integer, db.ForeignKey('android_activities.id'), nullable=False)
    category = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ActivityScheme(db.Model):
    __tablename__ = 'activity_schemes'
    id = db.Column(db.Integer, primary_key=True)
    activity_id = db.Column(db.Integer, db.ForeignKey('android_activities.id'), nullable=False)
    scheme = db.Column(db.String(255))
    host = db.Column(db.String(255))
    path = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ActivityIntentFilter(db.Model):
    __tablename__ = 'activity_intent_filters'
    id = db.Column(db.Integer, primary_key=True)
    activity_id = db.Column(db.Integer, db.ForeignKey('android_activities.id'), nullable=False)
    intent_action = db.Column(db.String(255), nullable=False)
    intent_category = db.Column(db.String(255))
    intent_data_scheme = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AndroidService(db.Model):
    __tablename__ = 'android_services'
    id = db.Column(db.Integer, primary_key=True)
    android_info_id = db.Column(db.Integer, db.ForeignKey('android_info.id'), nullable=False)
    service_name = db.Column(db.String(255), nullable=False)
    service_exported = db.Column(db.Boolean)  # tri-state: True/False explicit, NULL = attribute absent (implicit-export resolved via intent-filters)
    service_permission = db.Column(db.String(255))
    manifest_snippet = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    actions = db.relationship('ServiceAction', backref='android_service', lazy='selectin')
    categories = db.relationship('ServiceCategory', backref='android_service', lazy='selectin')
    schemes = db.relationship('ServiceScheme', backref='android_service', lazy='selectin')


class ServiceAction(db.Model):
    __tablename__ = 'service_actions'
    id = db.Column(db.Integer, primary_key=True)
    service_id = db.Column(db.Integer, db.ForeignKey('android_services.id'), nullable=False)
    action = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ServiceCategory(db.Model):
    __tablename__ = 'service_categories'
    id = db.Column(db.Integer, primary_key=True)
    service_id = db.Column(db.Integer, db.ForeignKey('android_services.id'), nullable=False)
    category = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ServiceScheme(db.Model):
    __tablename__ = 'service_schemes'
    id = db.Column(db.Integer, primary_key=True)
    service_id = db.Column(db.Integer, db.ForeignKey('android_services.id'), nullable=False)
    scheme = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AndroidReceiver(db.Model):
    __tablename__ = 'android_receivers'
    id = db.Column(db.Integer, primary_key=True)
    android_info_id = db.Column(db.Integer, db.ForeignKey('android_info.id'), nullable=False)
    receiver_name = db.Column(db.String(255), nullable=False)
    receiver_exported = db.Column(db.Boolean)  # tri-state: True/False explicit, NULL = attribute absent (implicit-export resolved via intent-filters)
    receiver_permission = db.Column(db.String(255))
    manifest_snippet = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    actions = db.relationship('ReceiverAction', backref='android_receiver', lazy='selectin')
    categories = db.relationship('ReceiverCategory', backref='android_receiver', lazy='selectin')
    schemes = db.relationship('ReceiverScheme', backref='android_receiver', lazy='selectin')


class ReceiverAction(db.Model):
    __tablename__ = 'receiver_actions'
    id = db.Column(db.Integer, primary_key=True)
    receiver_id = db.Column(db.Integer, db.ForeignKey('android_receivers.id'), nullable=False)
    action = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ReceiverCategory(db.Model):
    __tablename__ = 'receiver_categories'
    id = db.Column(db.Integer, primary_key=True)
    receiver_id = db.Column(db.Integer, db.ForeignKey('android_receivers.id'), nullable=False)
    category = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ReceiverScheme(db.Model):
    __tablename__ = 'receiver_schemes'
    id = db.Column(db.Integer, primary_key=True)
    receiver_id = db.Column(db.Integer, db.ForeignKey('android_receivers.id'), nullable=False)
    scheme = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AndroidProvider(db.Model):
    __tablename__ = 'android_providers'
    id = db.Column(db.Integer, primary_key=True)
    android_info_id = db.Column(db.Integer, db.ForeignKey('android_info.id'), nullable=False)
    provider_name = db.Column(db.String(255), nullable=False)
    provider_exported = db.Column(db.Boolean)  # tri-state: True/False explicit, NULL = attribute absent (implicit-export resolved via intent-filters)
    provider_permission = db.Column(db.String(255))
    grant_uri_permissions = db.Column(db.Boolean, default=False)
    authorities = db.Column(db.Text)
    read_permission = db.Column(db.String(255))
    write_permission = db.Column(db.String(255))
    manifest_snippet = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    actions = db.relationship('ProviderAction', backref='android_provider', lazy='selectin')
    categories = db.relationship('ProviderCategory', backref='android_provider', lazy='selectin')
    schemes = db.relationship('ProviderScheme', backref='android_provider', lazy='selectin')


class ProviderAction(db.Model):
    __tablename__ = 'provider_actions'
    id = db.Column(db.Integer, primary_key=True)
    provider_id = db.Column(db.Integer, db.ForeignKey('android_providers.id'), nullable=False)
    action = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ProviderCategory(db.Model):
    __tablename__ = 'provider_categories'
    id = db.Column(db.Integer, primary_key=True)
    provider_id = db.Column(db.Integer, db.ForeignKey('android_providers.id'), nullable=False)
    category = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ProviderScheme(db.Model):
    __tablename__ = 'provider_schemes'
    id = db.Column(db.Integer, primary_key=True)
    provider_id = db.Column(db.Integer, db.ForeignKey('android_providers.id'), nullable=False)
    scheme = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ProviderMetadata(db.Model):
    __tablename__ = 'provider_metadata'
    id = db.Column(db.Integer, primary_key=True)
    provider_id = db.Column(db.Integer, db.ForeignKey('android_providers.id'), nullable=False)
    meta_name = db.Column(db.String(255), nullable=False)
    meta_resource = db.Column(db.String(255))
    meta_content = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship back to provider
    provider = db.relationship('AndroidProvider', backref=db.backref('metadata', lazy='selectin'))

    __table_args__ = (db.UniqueConstraint('provider_id', 'meta_name', name='uix_provider_meta_name'),)

    def __repr__(self):
        return f"<ProviderMetadata(id={self.id}, provider_id={self.provider_id}, meta_name='{self.meta_name}')>"


class AndroidSourceCode(db.Model):
    __tablename__ = 'android_source_code'
    id = db.Column(db.Integer, primary_key=True)
    android_info_id = db.Column(db.Integer, db.ForeignKey('android_info.id'), nullable=False)
    source_code = db.Column(db.Text, nullable=False)
    repository_type = db.Column(db.String(50))
    branch = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class iOSSourceCode(db.Model):
    __tablename__ = 'ios_source_code'
    id = db.Column(db.Integer, primary_key=True)
    ios_info_id = db.Column(db.Integer, db.ForeignKey('ios_info.id'), nullable=False)
    source_code = db.Column(db.Text, nullable=False)
    repository_type = db.Column(db.String(50))
    branch = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AppsharkScan(db.Model):
    __tablename__ = 'appshark_scans'
    id = db.Column(db.Integer, primary_key=True)
    android_info_id = db.Column(db.Integer, db.ForeignKey('android_info.id'), nullable=False)
    scan_date = db.Column(db.DateTime, default=datetime.utcnow)
    app_info = db.Column(JSONB)
    manifest_risks = db.Column(JSONB)
    is_partial = db.Column(db.Boolean, default=False, nullable=False)
    scan_task_guid = db.Column(db.String(50), nullable=True)
    security_issues = db.relationship('AppsharkSecurityIssue', backref='appshark_scan', lazy=True, cascade="all, delete-orphan")

class AppsharkSecurityIssue(db.Model):
    __tablename__ = 'appshark_security_issues'
    id = db.Column(db.Integer, primary_key=True)
    appshark_scan_id = db.Column(db.Integer, db.ForeignKey('appshark_scans.id'), nullable=False)
    category = db.Column(db.String(255))
    name = db.Column(db.String(255))
    detail = db.Column(db.Text)
    model = db.Column(db.String(50))
    possibility = db.Column(db.String(50))
    wiki = db.Column(db.Text)
    deobf_apk = db.Column(db.Text)
    vulnerabilities = db.relationship('AppsharkVulnerability', backref='security_issue', lazy=True, cascade="all, delete-orphan")

class User(db.Model):
    __tablename__ = 'users'
    __table_args__ = {'extend_existing': True}
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(255), unique=True, nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Update the AppsharkVulnerability model
class AppsharkVulnerability(db.Model):
    __tablename__ = 'appshark_vulnerabilities'
    id = db.Column(db.Integer, primary_key=True)
    security_issue_id = db.Column(db.Integer, db.ForeignKey('appshark_security_issues.id'), nullable=False)
    position = db.Column(db.Text)
    entry_method = db.Column(db.Text)
    sink = db.Column(ARRAY(db.Text))
    source = db.Column(ARRAY(db.Text))
    url = db.Column(db.Text)
    target = db.Column(ARRAY(db.Text))
    manifest = db.Column(JSONB)
    hash = db.Column(db.String(255))
    old_hash = db.Column(db.String(255))
    possibility = db.Column(db.String(50))
    # How many raw Appshark flows collapsed into this row during ingestion dedup
    # (1 = unique). See save_scan_results() dedup pass. Generic across all apps.
    duplicate_count = db.Column(db.Integer, default=1)
    # SliceMode attribution recovery: this finding's sink class is reachable from an
    # exported component even though its position isn't itself a component. Review
    # signal (not a hard exported claim). exported_via names the reaching component.
    exported_reachable = db.Column(db.Boolean, default=False)
    exported_via = db.Column(db.Text, nullable=True)
    # Pre-computed component accessibility info (populated at scan time)
    component_name = db.Column(db.String(512))  # Extracted component name from entry_method
    component_type = db.Column(db.String(50))   # activity, service, receiver, provider
    component_exported = db.Column(db.Boolean, default=False)
    component_accessible = db.Column(db.Boolean, default=False)  # exported OR has_intent_filters
    component_has_intent_filters = db.Column(db.Boolean, default=False)
    suppressed = db.Column(db.Boolean, default=False, nullable=False)
    suppression_note = db.Column(db.Text, nullable=True)
    # AI audit verdict — populated by the MCP server (validate_vulnerability tool)
    ai_verdict = db.Column(db.String(50), nullable=True)    # TRUE_POSITIVE | FALSE_POSITIVE | NEEDS_REVIEW
    ai_confidence = db.Column(db.String(20), nullable=True)  # HIGH | MEDIUM | LOW
    ai_reasoning = db.Column(db.Text, nullable=True)
    ai_reviewed_at = db.Column(db.DateTime, nullable=True)


class Task(db.Model):
    __tablename__ = 'tasks'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_type = db.Column(db.String(255), nullable=False)
    payload = db.Column(JSONB, nullable=False)
    status = db.Column(db.String(50), nullable=False, default='PENDING')
    progress = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ScanTask(db.Model):
    """Track AppShark scan tasks with queue management"""
    __tablename__ = 'scan_tasks'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    guid = db.Column(db.String(50), unique=True, nullable=False)
    android_info_id = db.Column(db.Integer, db.ForeignKey('android_info.id', ondelete='CASCADE'), nullable=True)
    filename = db.Column(db.String(255), nullable=False)
    settings = db.Column(JSONB, nullable=False)
    status = db.Column(
        ENUM('WAITING', 'PROCESSING', 'FINISHED', 'ERROR', name='scan_status'),
        nullable=False,
        default='WAITING'
    )
    celery_task_id = db.Column(db.String(255), nullable=True)
    error_message = db.Column(db.Text, nullable=True)
    is_long_running = db.Column(db.Boolean, nullable=False, default=False)
    long_running_detected_at = db.Column(db.DateTime, nullable=True)
    scan_duration_seconds = db.Column(db.Integer, nullable=True)
    scan_started_at = db.Column(db.DateTime, nullable=True)
    scan_completed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationship to AndroidInfo - deleting APK cascades to delete scan tasks
    android_info = db.relationship('AndroidInfo', backref=db.backref('scan_tasks', lazy=True, passive_deletes=True))

    def __repr__(self):
        return f"<ScanTask(id={self.id}, guid='{self.guid}', status='{self.status}', filename='{self.filename}')>"


# In the AppSecret model
class AppSecret(db.Model):
    __tablename__ = 'app_secrets'
    id = db.Column(db.Integer, primary_key=True)
    android_info_id = db.Column(db.Integer, db.ForeignKey('android_info.id'), nullable=False)
    file_path = db.Column(db.String(500))
    secret_type = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    redacted_value = db.Column(db.Text, nullable=False)
    raw_value = db.Column(db.Text)
    secret_line = db.Column(db.Integer)
    source_name = db.Column(db.String(255))
    source_type = db.Column(db.String(255))
    detector_type = db.Column(db.String(255))
    decoder_name = db.Column(db.String(255))
    is_verified = db.Column(db.Boolean, default=False)
    verification_error = db.Column(db.Text)
    verification_cached = db.Column(db.Boolean, default=False)
    scan_date = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship with AndroidInfo - rename the backref to avoid conflict
    android_app = db.relationship('AndroidInfo', backref='app_secrets')

    def __repr__(self):
        return f"<AppSecret(id={self.id}, type='{self.secret_type}', verified={self.is_verified})>"