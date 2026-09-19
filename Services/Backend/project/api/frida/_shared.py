"""Shared imports, in-memory state, and the Frida namespace.

The four dicts below are process-wide session state shared across the frida
route modules. They are imported by reference and mutated in place — never
rebind them (e.g. `repl_sessions = {}`), or the shared state would fork.
Phase 4.4: these are the candidates to move to Redis if the backend ever runs
with more than one worker.
"""
import base64
import os
import json
import socket
import tempfile
import time
import logging
import site
import random
import datetime
import threading
from queue import Queue, Empty as QueueEmpty
from threading import Event
from uuid import uuid4

import frida
from flask import (
    request, jsonify, after_this_request, send_file, Response, stream_with_context,
)
from flask_restx import Namespace, Resource
from rich.console import Console
from rich import inspect
from frida_tools.repl import REPLApplication

try:
    from blessed import Terminal
    HAS_BLESSED = True
except ImportError:
    HAS_BLESSED = False

console = Console()
logger = logging.getLogger("project.api.frida")

frida_namespace = Namespace("frida", description="Leviathan Frida Operations")

# Process-wide in-memory state shared across the frida route modules.
download_cache = {}
hook_queues = {}
active_scripts = {}
repl_sessions = {}
