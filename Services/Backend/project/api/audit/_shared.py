"""Shared imports, constants, and the audit namespace.

"""
import os
import json
import fnmatch
import hashlib
import tempfile
import zipfile
import logging
import xml.etree.ElementTree as ET
import xml.dom.minidom
from typing import Dict, List, Optional, Tuple

from lxml import etree
from flask import request, jsonify, send_from_directory, send_file
from flask_restx import Namespace, Resource
from werkzeug.utils import secure_filename
from sqlalchemy import inspect, or_
from sqlalchemy.sql import func
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy.exc import SQLAlchemyError, NoResultFound, ProgrammingError
from rich.console import Console

from androguard.core.axml import AXMLPrinter
from androguard.core.apk import APK
from androguard.core.analysis.analysis import Analysis
from androguard.misc import AnalyzeAPK
from pyaxmlparser import APK as pyAPK

from project import db, bcrypt
from project.api.database.services import (
    handle_db_error, add_android_info, add_ios_info, get_all_android_info,
    get_all_ios_info, add_android_activities, add_android_activity,
    add_activity_action, add_activity_category, add_activity_scheme,
    add_activity_intent_filter, add_android_receiver, add_receiver_action,
    add_receiver_category, add_receiver_scheme, add_android_provider,
    add_provider_metadata, parse_exported_attr, is_component_accessible,
)
from project.api.database.models import (
    AndroidInfo, AndroidActivity, AndroidService, AndroidReceiver, AndroidProvider,
    ActivityAction, ActivityCategory, ActivityScheme, ActivityIntentFilter,
    ServiceAction, ServiceCategory, ServiceScheme,
    ReceiverAction, ReceiverCategory, ReceiverScheme,
    ProviderAction, ProviderCategory, ProviderScheme, ProviderMetadata,
    ApkDetails, AndroidSourceCode, AppSecret, ScanTask,
    AppsharkScan, AppsharkSecurityIssue, AppsharkVulnerability,
)

console = Console()
logger = logging.getLogger("project.api.audit")

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

audit_namespace = Namespace("audit", description="Audit related operations")
