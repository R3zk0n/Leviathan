"""Pure validation for artifact, rule, and structured secret-result boundaries."""

import hashlib
import json
import os
import posixpath
import re


def validate_apk_name(name):
    if (not isinstance(name, str) or not name or name in (".", "..")
            or any(c in name for c in ("/", "\\", ":", "\x00"))
            or any(ord(c) < 32 for c in name)
            or not name.lower().endswith(".apk")):
        raise ValueError("Expected an uploaded APK basename")
    return name


def file_sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def rule_path(name):
    if (not isinstance(name, str) or not name or name.startswith("/")
            or "\\" in name or ":" in name
            or any(ord(c) < 32 for c in name)
            or any(part in ("", ".", "..") for part in name.split("/"))
            or not name.lower().endswith(".json")):
        raise ValueError("Expected a relative rule JSON path")
    root = "/appshark_engine/appshark/config/rules"
    path = posixpath.normpath(posixpath.join(root, name))
    if not path.startswith(root + "/"):
        raise ValueError("Rule path is outside the rules directory")
    return path


def load_secret_findings(result, decompiled_path, scans_root):
    """Reject failed, truncated, or malformed output instead of reporting clean."""
    if (not isinstance(result, dict) or result.get("status") != "ok"
            or result.get("exit_code") != 0 or result.get("complete") is not True):
        raise ValueError("Secret scan failed or did not complete")
    path = result.get("findings_path", "")
    root = os.path.realpath(os.path.join(scans_root, ".secret-results"))
    if (not isinstance(path, str)
            or not re.fullmatch(r"[0-9a-f]{32}\.jsonl", os.path.basename(path))
            or os.path.dirname(os.path.realpath(path)) != root):
        raise ValueError("Invalid secret-scan result artifact")
    findings, record_count = [], 0
    try:
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                if not line.strip():
                    continue
                data = json.loads(line)
                if not isinstance(data, dict):
                    raise ValueError("Invalid secret-scan record")
                if "SourceMetadata" not in data:
                    if "level" in data:
                        continue
                    raise ValueError("Unexpected secret-scan record")
                record_count += 1
                source = data.get("SourceMetadata", {}).get("Data", {}).get("Filesystem", {})
                raw_value = data.get("Raw", "")
                if not raw_value:
                    continue
                file_path = source.get("file", "")
                if file_path.startswith(decompiled_path.rstrip("/") + "/"):
                    file_path = file_path[len(decompiled_path):].lstrip("/")
                findings.append({
                    "type": data.get("DetectorName"),
                    "description": data.get("DetectorDescription"),
                    "value": data.get("Redacted", raw_value),
                    "raw_value": raw_value,
                    "file": file_path, "line": source.get("line"),
                    "source_name": data.get("SourceName"),
                    "detector_type": data.get("DetectorType"),
                    "detector_name": data.get("DetectorName"),
                    "decoder_name": data.get("DecoderName"),
                    "verified": data.get("Verified", False),
                    "verification_error": data.get("VerificationError"),
                    "verification_cached": data.get("VerificationFromCache", False),
                })
    except (OSError, ValueError, TypeError, AttributeError) as exc:
        # Exception text can contain attacker-controlled finding contents.
        raise ValueError("Secret scan results are incomplete or invalid") from None
    if record_count != result.get("finding_count"):
        raise ValueError("Secret scan result count did not match")
    return findings
