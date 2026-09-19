import json
import os
import re
import shutil
import subprocess
import tarfile
import tempfile
import urllib.request

arch = os.environ.get("TARGETARCH") or (
    "amd64" if platform.machine() in ("x86_64", "AMD64") else "arm64"
)
asset_arch = "x86_64" if arch == "amd64" else "arm64"


def fetch_json(url):
    with urllib.request.urlopen(url) as response:
        return json.load(response)


def download(url, path):
    with urllib.request.urlopen(url) as response, open(path, "wb") as handle:
        shutil.copyfileobj(response, handle)


def find_asset(assets, *patterns):
    for asset in assets:
        name = asset.get("name", "")
        url = asset.get("browser_download_url")
        if not url:
            continue
        for pattern in patterns:
            if re.search(pattern, name):
                return name, url
    return None, None


release = fetch_json("https://api.github.com/repos/blacktop/ipsw/releases/latest")
assets = release.get("assets") or []
deb_name, deb_url = find_asset(assets, rf"ipsw_.*_linux_{re.escape(asset_arch)}\.deb$")
tgz_name, tgz_url = find_asset(assets, rf"ipsw_.*_linux_{re.escape(asset_arch)}\.tar\.gz$")

tmpdir = tempfile.mkdtemp(prefix="ipsw-")
try:
    if deb_url:
        path = os.path.join(tmpdir, deb_name)
        download(deb_url, path)
        subprocess.check_call(["dpkg", "-i", path])
    elif tgz_url:
        path = os.path.join(tmpdir, tgz_name)
        download(tgz_url, path)
        with tarfile.open(path, "r:gz") as archive:
            archive.extractall(tmpdir)
        binary = next(
            (os.path.join(root, "ipsw") for root, _, files in os.walk(tmpdir) if "ipsw" in files),
            None,
        )
        if not binary:
            raise RuntimeError("ipsw binary not found in tarball")
        dest = "/usr/local/bin/ipsw"
        shutil.copy2(binary, dest)
        os.chmod(dest, 0o755)
except Exception:
    pass
finally:
    shutil.rmtree(tmpdir, ignore_errors=True)
