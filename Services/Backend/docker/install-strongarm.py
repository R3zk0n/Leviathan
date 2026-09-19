import os
import platform
import subprocess
import sys

arch = os.environ.get("TARGETARCH") or (
    "amd64" if platform.machine() in ("x86_64", "AMD64") else "arm64"
)
is_linux = platform.system() == "Linux"
is_macos = platform.system() == "Darwin"


def pip(*args):
    subprocess.check_call([sys.executable, "-m", "pip", "install", "--no-cache-dir", *args])


def pip_try(*args):
    try:
        pip(*args)
        return True
    except subprocess.CalledProcessError:
        return False


pkg = "strongarm-dataflow==3.0.0"
if is_linux and arch == "amd64":
    pip(pkg)
    subprocess.check_call([
        sys.executable, "-c",
        "from strongarm_dataflow.dataflow import get_register_contents_at_instruction_fast",
    ])
elif is_macos or not is_linux:
    pip_try(pkg)

subprocess.check_call(["git", "clone", "--depth=1", "https://github.com/R3zk0n/strongarm", "/opt/strongarm"])
subprocess.check_call([sys.executable, "setup.py", "install"], cwd="/opt/strongarm")
