import os

from androguard.core.axml import AXMLPrinter
import fnmatch
from flask import request, jsonify, send_from_directory
from flask_restx import Namespace, Resource
from flask import request, send_file
#from flask_restx import Namespace, Resource
#from androguard.core.bytecodes.apk import APK
from sqlalchemy.exc import SQLAlchemyError
import hashlib
import tempfile
import zipfile
from sqlalchemy import inspect
from androguard.core.apk import APK
from androguard.core.analysis.analysis import Analysis
from androguard.misc import AnalyzeAPK
from sqlalchemy.exc import NoResultFound, SQLAlchemyError
from sqlalchemy.exc import ProgrammingError, SQLAlchemyError
from sqlalchemy.orm.exc import NoResultFound
from werkzeug.utils import secure_filename
from sqlalchemy.orm import joinedload
from typing import Dict, List, Optional, Tuple
from project.api.database.services import (handle_db_error,
                                           add_android_info, add_ios_info, get_all_android_info,
                                           get_all_ios_info,
                                           add_android_activities,
                                           add_android_activity, add_activity_action,
                                           add_activity_category, add_activity_scheme, add_activity_intent_filter,     add_android_receiver, add_receiver_action, add_receiver_category, add_receiver_scheme, add_android_provider, add_provider_metadata)
from project.api.database.models import (
    AndroidInfo, AndroidActivity, AndroidService, AndroidReceiver, AndroidProvider,
    ActivityAction, ActivityCategory, ActivityScheme, ActivityIntentFilter,
    ServiceAction, ServiceCategory, ServiceScheme,
    ReceiverAction, ReceiverCategory, ApkDetails, AndroidSourceCode, AppsharkScan, AppsharkSecurityIssue, AppsharkVulnerability
)
import json
from rich.console import Console

from project.api.database.models import (AndroidInfo, AndroidActivity, ActivityAction, ActivityCategory,
                                         ActivityScheme, ActivityIntentFilter)
# SQLALCHEMY import
from sqlalchemy.sql import func
from project import db, bcrypt
import xml.dom.minidom
import logging

from pyaxmlparser import APK as pyAPK


from flask import jsonify
from flask_restx import Resource
from sqlalchemy import or_

console = Console()


UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

secfinder_namespace = Namespace("secret", description="Secrets finding related operations")

logger = logging.getLogger(__name__)



# Utility functions


def ignore_secrets(key):
    not_secret = ["@"
                  "label_" "android"]

## Class setup
class SecretFinder:
    def __init__(self):
        # No docker client here: it was never used (nothing in this class talks
        # to the engine container) but constructing it required the docker.sock
        # mount, which is exactly what this refactor removes.
        self.container_name = "leviathan-vue3-engine-1"
        self.settings_file = "/tmp/config/settings.json"

    def get_settings(self):
        try:
            with open(self.settings_file, "r") as f:
                settings = json.load(f)
        except FileNotFoundError:
            settings = {}
        return settings


@secfinder_namespace.route('/scan/<filename>')
class SecretScan(Resource):
    def post(self, filename):
        try:
            # Get JSON data from request
            data = request.get_json()
            print(data)

        except Exception as e:
            print(e)







