
from flask import request, jsonify
from flask_restx import Namespace, Resource
from werkzeug.utils import secure_filename
from strongarm.macho import MachoParser, MachoBinary, MachoAnalyzer, CPU_TYPE
import os
from pathlib import Path
import tempfile

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ios_namespace = Namespace("Scan", description="Leviathan Scan Operations")
