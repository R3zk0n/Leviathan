"""Shared objects for the engine API route modules.

Defines the engine_namespace plus the service, helpers, and imports that the
route modules (decompile, trufflehog, management, run, results, status, misc)
all draw from. Split out so those modules import from here without a circular
dependency on engine.py, which aggregates them and re-exports the namespace.
"""
import json
import ast
import os
import shlex
import uuid
import logging
from datetime import datetime

from flask import request, jsonify
from flask_restx import Namespace, Resource
from sqlalchemy.orm import joinedload
from rich.console import Console

from .services import EngineService
from .detail_parser import parse_appshark_detail
from project.api.tasks.tasks import (
    run_scan_task,
    save_scan_results,
    scan_secrets_task,
    start_next_queued_scan,
    get_waiting_scan_position,
    decompile_apk_task,
    heap_spec_for_apk,
)
from project.api.audit import find_android_info
from project.api.database.models import (
    AndroidInfo,
    AppsharkScan,
    AppsharkSecurityIssue,
    AppsharkVulnerability,
    ScanTask,
)
from project import db

logger = logging.getLogger("project.api.engine")

engine_namespace = Namespace("engine", description="Leviathan engine Operations")
engine_service = EngineService()
console = Console()
