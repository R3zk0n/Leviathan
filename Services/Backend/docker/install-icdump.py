import os
import platform
import shutil
import subprocess
import sys
import sysconfig
import tempfile
import zipfile

arch = os.environ.get("TARGETARCH") or (
    "amd64" if platform.machine() in ("x86_64", "AMD64") else "arm64"
)
wheels = {
    ("Linux", "amd64"): "icdump-1.1.0-cp311-cp311-manylinux_2_27_x86_64.whl",
    ("Darwin", "arm64"): "icdump-1.1.0-cp311-cp311-macosx_12_0_arm64.whl",
    ("Darwin", "amd64"): "icdump-1.1.0-cp311-cp311-macosx_12_0_x86_64.whl",
}
wheel_name = wheels.get((platform.system(), arch))
if not wheel_name:
    sys.exit(0)

url = f"https://github.com/romainthomas/iCDump/releases/download/1.1.0/{wheel_name}"
tmpdir = tempfile.mkdtemp(prefix="icdump-")
whl = os.path.join(tmpdir, wheel_name)

try:
    subprocess.check_call(["curl", "-fsSL", "--retry", "3", "-o", whl, url])
    if os.path.getsize(whl) < 100_000:
        raise RuntimeError("icdump wheel download was too small")

    staged = subprocess.run(
        [
            sys.executable, "-m", "pip", "install", "--no-cache-dir", "--no-deps",
            "--platform", "manylinux_2_27_x86_64",
            "--target", "/tmp/icdump_stage",
            "--only-binary=:all:",
            whl,
        ],
        capture_output=True,
        text=True,
    )
    if staged.returncode == 0:
        site = sysconfig.get_paths()["platlib"]
        for item in os.listdir("/tmp/icdump_stage"):
            src = os.path.join("/tmp/icdump_stage", item)
            dst = os.path.join(site, item)
            if os.path.exists(dst):
                shutil.rmtree(dst) if os.path.isdir(dst) else os.remove(dst)
            shutil.move(src, dst)
        shutil.rmtree("/tmp/icdump_stage", ignore_errors=True)
    else:
        direct = subprocess.run(
            [sys.executable, "-m", "pip", "install", "--no-cache-dir", "--no-deps", whl],
            capture_output=True,
            text=True,
        )
        if direct.returncode != 0:
            with zipfile.ZipFile(whl) as archive:
                archive.extractall(sysconfig.get_paths()["platlib"])

    if subprocess.run([sys.executable, "-c", "import icdump"], capture_output=True).returncode != 0:
        sys.exit(1)
except Exception:
    sys.exit(1)
finally:
    shutil.rmtree(tmpdir, ignore_errors=True)
