#!/usr/bin/env bash
set -eu

RADARE2_VERSION="${RADARE2_VERSION:-6.2.0}"
R2GHIDRA_VERSION="${R2GHIDRA_VERSION:-6.2.0}"

detect_arch() {
  case "${TARGETARCH:-}" in
    amd64|arm64) printf '%s' "$TARGETARCH"; return ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64) printf 'amd64' ;;
    aarch64|arm64) printf 'arm64' ;;
    *) echo "unsupported arch: $(uname -m)" >&2; exit 1 ;;
  esac
}

ARCH="$(detect_arch)"
R2_BASE="https://github.com/radareorg/radare2/releases/download/${RADARE2_VERSION}"
R2G_BASE="https://github.com/radareorg/r2ghidra/releases/download/${R2GHIDRA_VERSION}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cd "$TMP"

wget -q "${R2_BASE}/radare2_${RADARE2_VERSION}_${ARCH}.deb"
wget -q "${R2_BASE}/radare2-dev_${RADARE2_VERSION}_${ARCH}.deb"
apt-get update
apt-get install -y --no-install-recommends \
  "./radare2_${RADARE2_VERSION}_${ARCH}.deb" \
  "./radare2-dev_${RADARE2_VERSION}_${ARCH}.deb"
rm -rf /var/lib/apt/lists/*

SLEIGH_HOME=/usr/share/radare2/r2ghidra_sleigh
mkdir -p "$SLEIGH_HOME"
wget -q "${R2G_BASE}/r2ghidra_sleigh-${R2GHIDRA_VERSION}.zip"
unzip -q "r2ghidra_sleigh-${R2GHIDRA_VERSION}.zip" -d "$TMP/sleigh"
if [ -d "$TMP/sleigh/Processors" ]; then
  cp -a "$TMP/sleigh/." "$SLEIGH_HOME/"
else
  inner="$(find "$TMP/sleigh" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
  cp -a "${inner}/." "$SLEIGH_HOME/"
fi

if [ "$ARCH" = "amd64" ]; then
  wget -q "${R2G_BASE}/r2ghidra_${R2GHIDRA_VERSION}_amd64.deb"
  apt-get update
  apt-get install -y --no-install-recommends "./r2ghidra_${R2GHIDRA_VERSION}_amd64.deb"
  rm -rf /var/lib/apt/lists/*
  r2 -e scr.color=0 -e "r2ghidra.sleighhome=${SLEIGH_HOME}" \
    -qc 'aa; s entry0; pdg' /bin/ls 2>/dev/null | grep -q '{' || exit 1
else
  r2 -qv >/dev/null
fi
