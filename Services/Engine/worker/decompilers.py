"""APK decompiler backends, running inside the engine container.
"""

import hashlib
import json
import logging
import os
import shutil
import subprocess
from datetime import datetime

logger = logging.getLogger(__name__)

DECOMPILERS = {"jadx", "vineflower"}
DEFAULT_DECOMPILER = "jadx"

UPLOADS_DIR = "/appshark_engine/appshark/uploads"
DECOMPILED_ROOT = "/tmp/decompiled"
MARKER_NAME = ".decompiler"

JADX_BIN = "/opt/jadx/bin/jadx"
DEX2JAR_SH = "/opt/dex2jar/d2j-dex2jar.sh"
VINEFLOWER_JAR = "/opt/vineflower/vineflower.jar"

# Resilient RE-oriented Vineflower flags for Android (dex2jar'd, often obfuscated) input.
#  - old-try-dedup / ignore-invalid-bytecode: survive obfuscated exception handlers and
#    dex2jar's malformed bytecode (fixes the FinallyProcessor IndexOutOfBounds crash class).
#  - verify-merges: fix strange variable-recompilation glitches.
#  - rename-parameters + variable-renaming=jad: readable locals (LOCAL scope only, so it does
#    NOT change class/field/method signatures -> stays aligned with Appshark/JADX/smali).
#  - dump-bytecode-on-error / decompiler-comments: any still-failing method shows its bytecode
#    and the reason instead of an empty body.
# NOTE: member renaming is deliberately left OFF to keep signatures matching the other tools.
def _vineflower_re_flags():
    threads = max(2, (os.cpu_count() or 4))
    return [
        "--ignore-invalid-bytecode=1",
        "--old-try-dedup=1",
        "--verify-merges=1",
        "--rename-parameters=1",
        "--variable-renaming=jad",
        "--dump-bytecode-on-error=1",
        "--decompiler-comments=1",
        "--skip-extra-files=1",
        "--kt-enable=0",
        "--thread-count=%d" % threads,
    ]

OUTPUT_TAIL_CHARS = 8000


def validate_file_name(file_name):
    if (not isinstance(file_name, str) or not file_name
            or file_name in (".", "..")
            or any(c in file_name for c in ("/", "\\", ":", "\x00"))
            or any(ord(c) < 32 for c in file_name)
            or not file_name.lower().endswith(".apk")):
        raise ValueError("Expected an uploaded APK basename")
    return file_name


def strict_child(root, *parts):
    root = os.path.realpath(root)
    candidate = os.path.abspath(os.path.join(root, *parts))
    path = os.path.realpath(candidate)
    if path != candidate:
        raise ValueError("Artifact paths must not contain symbolic links")
    if path == root or os.path.commonpath((root, path)) != root:
        raise ValueError("Artifact path is outside its permitted root")
    return path


def file_sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _run(argv, timeout=None):
    """Run argv with no shell; return (exit_code, output tail)."""
    logger.info("running: %s", " ".join(argv))
    proc = subprocess.run(
        argv,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=timeout,
        text=True,
        errors="replace",
    )
    return proc.returncode, (proc.stdout or "")[-OUTPUT_TAIL_CHARS:]


class Decompiler:
    name = "base"

    def __init__(self, file_name, uploads_dir=UPLOADS_DIR, decompiled_root=DECOMPILED_ROOT):
        self.file_name = validate_file_name(file_name)
        self.uploads_dir = uploads_dir.rstrip("/")
        self.decompiled_root = decompiled_root.rstrip("/")

    @property
    def input_path(self):
        return strict_child(self.uploads_dir, self.file_name)

    @property
    def output_dir(self):
        return strict_child(self.decompiled_root, self.file_name)

    @property
    def sources_dir(self):
        return os.path.join(self.output_dir, "sources")

    def _sources_nonempty(self):
        """True if sources/ contains at least one .java file.

        Was `find ... -print -quit`; os.walk with an early return is the same
        short-circuit without the shell.
        """
        if not os.path.isdir(self.sources_dir):
            return False
        for _dirpath, _dirnames, filenames in os.walk(self.sources_dir):
            for name in filenames:
                if name.endswith((".java", ".kt")):
                    return True
        return False

    def run(self, resources=False, timeout=None):  # pragma: no cover - abstract
        raise NotImplementedError


class JadxDecompiler(Decompiler):
    """JADX — writes sources/<pkg>/*.java natively."""

    name = "jadx"

    def run(self, resources=False, timeout=None):
        # JADX always emits resources natively; the flag is a no-op here.
        argv = [JADX_BIN, "--deobf", "--show-bad-code",
                self.input_path, "-d", self.output_dir]
        exit_code, output = _run(argv, timeout=timeout)

        # JADX often exits non-zero on partial decompilation while still
        # producing usable sources/. A non-empty sources/ is the real signal.
        if self._sources_nonempty():
            logger.info("[jadx] sources produced (exit code %s) at %s", exit_code, self.sources_dir)
            return True, output

        logger.error("[jadx] no sources produced (exit code %s)", exit_code)
        return False, output


class VineflowerDecompiler(Decompiler):
    """dex2jar -> Vineflower, normalised into sources/<pkg>/*.java."""

    name = "vineflower"

    @property
    def work_jar(self):
        return os.path.join(self.output_dir, "_work.jar")

    @property
    def raw_dir(self):
        return os.path.join(self.output_dir, "_vf")

    def run(self, resources=False, timeout=None):
        os.makedirs(self.output_dir, exist_ok=True)

        rc, out = _run(
            ["sh", DEX2JAR_SH, self.input_path, "-o", self.work_jar, "--force"],
            timeout=timeout,
        )
        if rc != 0 or not os.path.isfile(self.work_jar):
            logger.error("[vineflower] dex2jar failed (exit code %s)", rc)
            self._cleanup()
            return False, "dex2jar failed (rc=%s): %s" % (rc, out[-800:])

        # Vineflower treats an existing directory as another input, so a
        # pre-created empty sources/ made it write nowhere. Give it a path
        # that does not exist yet, then move files into the JADX layout.
        shutil.rmtree(self.raw_dir, ignore_errors=True)
        rc, vf_output = _run(
            ["java", "-jar", VINEFLOWER_JAR, *_vineflower_re_flags(),
             "--folder", self.work_jar, self.raw_dir],
            timeout=timeout,
        )
        self._collect_into_sources()
        self._cleanup()

        if rc != 0:
            logger.warning("[vineflower] exit code %s; checking sources anyway", rc)
        if not self._sources_nonempty():
            logger.error("[vineflower] no sources produced (exit code %s)", rc)
            return False, "vineflower produced no sources (rc=%s): %s" % (rc, vf_output[-800:])

        logger.info("[vineflower] sources produced at %s", self.sources_dir)

        if resources:
            self._extract_resources(timeout=timeout)

        return True, vf_output

    def _collect_into_sources(self):
        os.makedirs(self.sources_dir, exist_ok=True)
        search_roots = [self.raw_dir]
        archive = self.raw_dir + ".jar"
        extract = self.raw_dir + "_unzip"
        if os.path.isfile(archive):
            shutil.unpack_archive(archive, extract)
            search_roots.append(extract)

        for root in search_roots:
            if not os.path.isdir(root):
                continue
            for dirpath, _dirnames, filenames in os.walk(root):
                for name in filenames:
                    if not name.endswith((".java", ".kt")):
                        continue
                    src = os.path.join(dirpath, name)
                    rel = os.path.relpath(src, root)
                    if os.path.dirname(rel) in ("", "."):
                        stem, ext = os.path.splitext(name)
                        if "." in stem:
                            rel = stem.replace(".", "/") + ext
                    dest = os.path.join(self.sources_dir, rel)
                    os.makedirs(os.path.dirname(dest), exist_ok=True)
                    shutil.move(src, dest)

        shutil.rmtree(self.raw_dir, ignore_errors=True)
        shutil.rmtree(extract, ignore_errors=True)
        try:
            os.remove(archive)
        except OSError:
            pass

    def _extract_resources(self, timeout=None):
        rc, out = _run(
            [JADX_BIN, "--no-src", "-d", self.output_dir, self.input_path],
            timeout=timeout,
        )
        if rc != 0:
            logger.warning(
                "[vineflower] resource extraction exit code %s; Java decompile "
                "already succeeded. Tail: %s", rc, out[-800:]
            )

    def _cleanup(self):
        try:
            os.remove(self.work_jar)
        except OSError:
            pass


_DECOMPILER_CLASSES = {
    "jadx": JadxDecompiler,
    "vineflower": VineflowerDecompiler,
}


def get_decompiler(name, file_name, uploads_dir=UPLOADS_DIR, decompiled_root=DECOMPILED_ROOT):
    """Factory. Validates name against DECOMPILERS."""
    resolved = (name or DEFAULT_DECOMPILER).strip().lower()
    if resolved not in DECOMPILERS:
        raise ValueError(
            "Unknown decompiler engine: %r. Valid: %s" % (name, sorted(DECOMPILERS))
        )
    return _DECOMPILER_CLASSES[resolved](
        file_name, uploads_dir=uploads_dir, decompiled_root=decompiled_root
    )


# --- marker file helpers (engine-aware cache) ---

def marker_path(file_name, decompiled_root=DECOMPILED_ROOT):
    return strict_child(decompiled_root, validate_file_name(file_name), MARKER_NAME)


def write_marker(file_name, engine, version="", resources=False,
                 decompiled_root=DECOMPILED_ROOT, input_sha256=None):
    """Write the .decompiler JSON marker into the output dir."""
    payload = {
        "engine": engine,
        "version": version or "",
        "resources": bool(resources),
        "decompiled_at": datetime.utcnow().isoformat() + "Z",
        "input_sha256": input_sha256,
    }
    path = marker_path(file_name, decompiled_root)
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as fh:
            json.dump(payload, fh)
        return True
    except OSError as e:
        logger.warning("Failed to write decompiler marker at %s: %s", path, e)
        return False


def read_marker(file_name, decompiled_root=DECOMPILED_ROOT):
    """Read + parse the .decompiler marker; None if absent or invalid."""
    path = marker_path(file_name, decompiled_root)
    try:
        with open(path) as fh:
            return json.load(fh)
    except OSError:
        return None
    except ValueError:
        logger.warning("Invalid decompiler marker JSON at %s", path)
        return None
