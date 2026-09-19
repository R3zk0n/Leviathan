"""Pluggable APK decompiler backends for the engine container.

Both backends MUST produce the identical on-disk layout::

    /tmp/decompiled/<file>/sources/<pkg>/*.java

because ``EngineService.resolve_decompiled_java_path``, the secret scanner, and
every frontend Java fetch assume that ``sources/`` tree. JADX writes it natively;
Vineflower is normalized into it here.

Each decompiler takes an ``exec_fn`` (``EngineService.exec_command``) so it runs
its shell commands inside the engine container — the backend and engine do NOT
share a filesystem for ``/tmp/decompiled`` paths, so all existence checks / reads
go through container exec.
"""

import json
import shlex
import logging
from datetime import datetime

logger = logging.getLogger("project.api.engine")

DECOMPILERS = {"jadx", "vineflower"}
DEFAULT_DECOMPILER = "jadx"

# Container paths (see CLAUDE.md / task contract).
UPLOADS_DIR = "/appshark_engine/appshark/uploads"
DECOMPILED_ROOT = "/tmp/decompiled"
MARKER_NAME = ".decompiler"

# Tool locations inside the engine container.
JADX_BIN = "/opt/jadx/bin/jadx"
DEX2JAR_SH = "/opt/dex2jar/d2j-dex2jar.sh"
VINEFLOWER_JAR = "/opt/vineflower/vineflower.jar"

# Resilient RE flags for Android (dex2jar'd/obfuscated) decompilation. Mirrors the
# engine-worker copy. old-try-dedup + ignore-invalid-bytecode survive obfuscated
# exception handlers / dex2jar malformations (the FinallyProcessor crash class);
# rename-parameters + variable-renaming=jad give readable LOCALS only (signatures
# unchanged -> stays aligned with Appshark/JADX/smali). Member renaming stays OFF.
VINEFLOWER_RE_FLAGS = (
    "--ignore-invalid-bytecode=1 --old-try-dedup=1 --verify-merges=1 "
    "--rename-parameters=1 --variable-renaming=jad "
    "--dump-bytecode-on-error=1 --decompiler-comments=1 --thread-count=6"
)


class Decompiler:
    """Base backend. Subclasses implement :meth:`run`.

    ``exec_fn(command) -> (exit_code, output)`` runs a shell command in the
    engine container.
    """

    name = "base"

    def __init__(self, exec_fn, file_name, uploads_dir=UPLOADS_DIR, decompiled_root=DECOMPILED_ROOT):
        self.exec_fn = exec_fn
        self.file_name = file_name
        self.uploads_dir = uploads_dir.rstrip("/")
        self.decompiled_root = decompiled_root.rstrip("/")

    # --- shared path helpers (container paths) ---
    @property
    def input_path(self):
        return f"{self.uploads_dir}/{self.file_name}"

    @property
    def output_dir(self):
        return f"{self.decompiled_root}/{self.file_name}"

    @property
    def sources_dir(self):
        return f"{self.output_dir}/sources"

    def _sources_nonempty(self):
        """True if sources/ contains at least one .java file."""
        cmd = (
            f"find {shlex.quote(self.sources_dir)} -type f -name '*.java' "
            f"-print -quit 2>/dev/null"
        )
        exit_code, output = self.exec_fn(cmd)
        return exit_code == 0 and bool(str(output).strip())

    def run(self, resources=False):  # pragma: no cover - abstract
        raise NotImplementedError


class JadxDecompiler(Decompiler):
    """JADX — writes ``sources/<pkg>/*.java`` natively."""

    name = "jadx"

    def run(self, resources=False):
        # JADX always emits resources natively; the resources flag is a no-op here.
        command = (
            f"{JADX_BIN} --deobf --show-bad-code "
            f"{shlex.quote(self.input_path)} -d {shlex.quote(self.output_dir)}"
        )
        logger.info(f"[jadx] running: {command}")
        exit_code, output = self.exec_fn(command)

        # JADX often returns a non-zero exit code on partial decompilation while
        # still producing usable sources/. Treat a non-empty sources/ as success.
        if self._sources_nonempty():
            logger.info(f"[jadx] sources produced (exit code {exit_code}) at {self.sources_dir}")
            return True, str(output)

        logger.error(f"[jadx] no sources produced (exit code {exit_code})")
        return False, str(output)


class VineflowerDecompiler(Decompiler):
    """dex2jar -> Vineflower, normalized into ``sources/<pkg>/*.java``.

    Pipeline (all in the engine container):
      1. dex2jar the APK into a single ``_work.jar`` (handles multidex + zip).
      2. Vineflower (``--folder``) the jar into ``sources/`` (loose .java, package dirs).
      3. Remove the intermediate jar.
      4. Verify ``sources/`` is non-empty.
      5. Optionally (resources=True) run JADX ``--no-src`` purely as a resource
         decoder, writing decoded resources into ``<output_dir>/resources/``.
    """

    name = "vineflower"

    @property
    def work_jar(self):
        return f"{self.output_dir}/_work.jar"

    def run(self, resources=False):
        quoted_input = shlex.quote(self.input_path)
        quoted_jar = shlex.quote(self.work_jar)
        quoted_sources = shlex.quote(self.sources_dir)
        quoted_output = shlex.quote(self.output_dir)

        # Ensure the output + sources dirs exist before either tool writes.
        self.exec_fn(f"mkdir -p {quoted_sources}")

        # Step 1: dex2jar (multidex + apk zip extraction handled internally).
        d2j_cmd = f"sh {DEX2JAR_SH} {quoted_input} -o {quoted_jar} --force"
        logger.info(f"[vineflower] step 1 dex2jar: {d2j_cmd}")
        rc, out = self.exec_fn(d2j_cmd)
        if rc != 0 or not self._file_exists(self.work_jar):
            logger.error(f"[vineflower] dex2jar failed (exit code {rc})")
            self._cleanup()
            return False, f"dex2jar failed (rc={rc}): {self._tail(out)}"

        # Step 2: Vineflower jar -> sources/. --folder forces loose .java output
        # (preserving package structure) and extraction of the input archive.
        vf_cmd = f"java -jar {VINEFLOWER_JAR} {VINEFLOWER_RE_FLAGS} --folder {quoted_jar} {quoted_sources}"
        logger.info(f"[vineflower] step 2 vineflower: {vf_cmd}")
        rc, out2 = self.exec_fn(vf_cmd)
        vf_output = str(out2)

        # Step 3: drop the intermediate jar regardless of decompile outcome.
        self._cleanup()

        # Step 4: verify sources/ actually has .java files.
        if rc != 0:
            logger.warning(f"[vineflower] vineflower returned exit code {rc}; checking sources anyway")
        if not self._sources_nonempty():
            logger.error(f"[vineflower] no sources produced (exit code {rc})")
            return False, f"vineflower produced no sources (rc={rc}): {self._tail(vf_output)}"

        logger.info(f"[vineflower] sources produced at {self.sources_dir}")

        # Step 5 (optional): reuse JADX purely as a resource decoder. Non-fatal.
        if resources:
            self._extract_resources()

        return True, vf_output

    def _extract_resources(self):
        """Decode resources with JADX (--no-src => no Java). Failure is non-fatal."""
        res_cmd = (
            f"{JADX_BIN} --no-src -d {shlex.quote(self.output_dir)} "
            f"{shlex.quote(self.input_path)}"
        )
        logger.info(f"[vineflower] step 5 resources (jadx --no-src): {res_cmd}")
        rc, out = self.exec_fn(res_cmd)
        if rc != 0:
            logger.warning(
                f"[vineflower] resource extraction returned exit code {rc}; "
                f"Java decompile already succeeded. Output tail: {self._tail(out)}"
            )

    def _file_exists(self, path):
        exit_code, _ = self.exec_fn(f"test -f {shlex.quote(path)}")
        return exit_code == 0

    def _cleanup(self):
        self.exec_fn(f"rm -f {shlex.quote(self.work_jar)}")

    @staticmethod
    def _tail(output, limit=800):
        s = str(output or "")
        return s[-limit:]


_DECOMPILER_CLASSES = {
    "jadx": JadxDecompiler,
    "vineflower": VineflowerDecompiler,
}


def get_decompiler(name, exec_fn, file_name,
                   uploads_dir=UPLOADS_DIR, decompiled_root=DECOMPILED_ROOT):
    """Factory. Validates ``name`` against :data:`DECOMPILERS`."""
    resolved = (name or DEFAULT_DECOMPILER).strip().lower()
    if resolved not in DECOMPILERS:
        raise ValueError(f"Unknown decompiler engine: {name!r}. Valid: {sorted(DECOMPILERS)}")
    cls = _DECOMPILER_CLASSES[resolved]
    return cls(exec_fn, file_name, uploads_dir=uploads_dir, decompiled_root=decompiled_root)


# --- marker file helpers (engine-aware cache) ---

def marker_path(file_name, decompiled_root=DECOMPILED_ROOT):
    return f"{decompiled_root.rstrip('/')}/{file_name}/{MARKER_NAME}"


def write_marker(exec_fn, file_name, engine, version="", resources=False,
                 decompiled_root=DECOMPILED_ROOT):
    """Write ``.decompiler`` JSON marker into the output dir (via container exec).

    Written with ``printf ... > file`` so arbitrary content survives the shell
    round-trip; content is single-line JSON so quoting is straightforward.
    """
    payload = json.dumps({
        "engine": engine,
        "version": version or "",
        "resources": bool(resources),
        "decompiled_at": datetime.utcnow().isoformat() + "Z",
    })
    path = marker_path(file_name, decompiled_root)
    # printf '%s' avoids interpreting backslashes; single-quote the JSON payload.
    cmd = f"printf '%s' {shlex.quote(payload)} > {shlex.quote(path)}"
    exit_code, output = exec_fn(cmd)
    if exit_code != 0:
        logger.warning(f"Failed to write decompiler marker at {path}: {output}")
    return exit_code == 0


def read_marker(exec_fn, file_name, decompiled_root=DECOMPILED_ROOT):
    """Read + parse the ``.decompiler`` marker; return dict or None if absent/invalid."""
    path = marker_path(file_name, decompiled_root)
    exit_code, output = exec_fn(f"cat {shlex.quote(path)} 2>/dev/null")
    if exit_code != 0:
        return None
    text = str(output).strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except (ValueError, TypeError):
        logger.warning(f"Invalid decompiler marker JSON at {path}: {text[:200]!r}")
        return None
