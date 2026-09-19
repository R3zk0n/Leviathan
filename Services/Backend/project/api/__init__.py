# services/users/project/api/__init__.py

import os

from flask_restx import Api

from project.api.auth import auth_namespace
from project.api.audit import audit_namespace

from project.api.engine.engine import engine_namespace
from project.api.database.views import database_namespace
from project.api.generate.generate import generate_namespace
from project.api.users.views import users_namespace


def _flag(name: str, default: str = "true") -> bool:
    return os.getenv(name, default).strip().lower() not in ("0", "false", "no", "off")


# ── Platform-gated feature flags ─────────────────────────────────────────────
# strongarm-dataflow ships no linux/arm64 wheel, so `import strongarm.objc`
# (pulled in by ios.py / disas.py) crashes at import on native ARM. frida ships
# no runtime that survives Rosetta x86-on-ARM emulation, so `import frida`
# traps (SIGTRAP / syscall 284) under linux/amd64 on Apple Silicon.
#
# The two features therefore cannot coexist in one process on an M-series host.
# We run two copies of this image:
#   backend       (native arm64) → ENABLE_FRIDA=1, ENABLE_IOS_ANALYSIS=0
#   ios-analysis  (amd64/Rosetta) → ENABLE_FRIDA=0, ENABLE_IOS_ANALYSIS=1
# On native x86_64 hosts (Windows/Linux) both default to on and one image
# serves everything. The imports below are guarded because the *import itself*
# is what crashes — gating only add_namespace() would be too late.
ENABLE_FRIDA = _flag("ENABLE_FRIDA")
ENABLE_IOS_ANALYSIS = _flag("ENABLE_IOS_ANALYSIS")


api = Api(version="1.0", title="Users API", doc="/swagger")
api.add_namespace(auth_namespace, path="/auth")

api.add_namespace(users_namespace, path="/users")
api.add_namespace(audit_namespace, path="/audit")
api.add_namespace(engine_namespace, path="/engine")
api.add_namespace(database_namespace, path="/database")
api.add_namespace(generate_namespace, path="/generate")

if ENABLE_IOS_ANALYSIS:
    # Both modules do `from strongarm.objc import ...` at module scope.
    from project.api.iOS.ios import ios_namespace
    from project.api.disas import disas_namespace

    api.add_namespace(ios_namespace, path="/ios")
    api.add_namespace(disas_namespace, path="/disas")

if ENABLE_FRIDA:
    # frida.py → _shared.py → `import frida`. Gated so the amd64 ios-analysis
    # instance (ENABLE_FRIDA=0) never imports the native Frida bindings.
    from project.api.frida.frida import frida_namespace

    api.add_namespace(frida_namespace, path="/frida")
