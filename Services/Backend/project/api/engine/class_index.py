"""Decompiled-Java class -> source-file index (Option C).

The problem: JADX and Vineflower lay out `sources/` differently (deobfuscated
names, dex2jar name-mangling, inner-class placement), so resolving a class to its
file by basename is unreliable. The fix: after a decompile, read what each .java
file *declares* (`package` + top-level type names) and record FQCN -> rel_path in
Postgres. Resolution is then an exact, package-aware, decompiler-agnostic lookup.

The parser runs INSIDE the engine container (that's where the .java files live and
it ships python3). The backend pushes CLASS_INDEX_SCRIPT in via write_file, runs
it, and reads a JSON array of {fqcn, simple, package, rel_path} back from stdout.
"""

import json
import logging
import shlex

logger = logging.getLogger("project.api.engine")

# Path of the parser script inside the engine container.
_SCRIPT_PATH = "/tmp/_leviathan_class_index.py"

# Executed in the engine container as: python3 _SCRIPT_PATH <decompiled_root>
# Prints a JSON array to stdout and nothing else (errors go to stderr, which the
# caller drops). Kept dependency-free and python3.8-compatible.
CLASS_INDEX_SCRIPT = r'''
import os, sys, re, json, bisect

root = sys.argv[1]                       # /tmp/decompiled/<file_name>
sources = os.path.join(root, "sources")

# Index both Java (JADX; Vineflower's generated Java) and Kotlin (Vineflower emits
# .kt for Kotlin classes). Same class is Foo.java under one engine, Foo.kt under
# the other — that divergence is exactly what this index normalizes.
SRC_EXT = (".java", ".kt")

# Kotlin `package a.b` has NO trailing semicolon; Java requires one. Optional `;`.
PKG_RE = re.compile(r'^\s*package\s+([A-Za-z_][\w.]*)\s*;?', re.M)
# Type declaration: keyword + name. `object` covers Kotlin singletons; `data
# class`/`sealed class`/`enum class`/`annotation class` all still match on the
# `class` keyword. Modifiers/annotations before it are fine (we anchor on the kw).
TYPE_RE = re.compile(r'\b(class|interface|enum|record|@interface|object)\s+([A-Za-z_]\w*)')

def strip_noise(text):
    # Remove block comments, line comments, and string/char literals so their
    # braces and keywords never affect depth counting or match TYPE_RE.
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    text = re.sub(r'//[^\n]*', '', text)
    text = re.sub(r'"""(?:.|\n)*?"""', '""', text)   # Kotlin raw strings first
    text = re.sub(r'"(?:\\.|[^"\\])*"', '""', text)
    text = re.sub(r"'(?:\\.|[^'\\])*'", "''", text)
    return text

def top_level_types(text):
    text = strip_noise(text)
    opens = [m.start() for m in re.finditer(r'\{', text)]
    closes = [m.start() for m in re.finditer(r'\}', text)]
    out = []
    seen = set()
    for m in TYPE_RE.finditer(text):
        pos = m.start()
        # Brace depth immediately before this declaration; 0 == top level.
        depth = bisect.bisect_right(opens, pos) - bisect.bisect_right(closes, pos)
        if depth == 0:
            name = m.group(2)
            if name not in seen:
                seen.add(name)
                out.append(name)
    return out

rows = []
for dirpath, _dirs, files in os.walk(sources):
    for fn in files:
        if not fn.endswith(SRC_EXT):
            continue
        full = os.path.join(dirpath, fn)
        rel = os.path.relpath(full, root)          # sources/com/foo/Bar.java
        try:
            with open(full, "r", encoding="utf-8", errors="replace") as fh:
                text = fh.read()
        except Exception:
            continue
        pm = PKG_RE.search(text)
        pkg = pm.group(1) if pm else None
        types = top_level_types(text)
        if not types:
            # No parseable declaration (rare) -> fall back to the filename stem so
            # the file is still reachable by simple name.
            types = [os.path.splitext(fn)[0]]
        for t in types:
            fqcn = (pkg + "." + t) if pkg else t
            rows.append({"fqcn": fqcn, "simple": t, "package": pkg, "rel_path": rel})

sys.stdout.write(json.dumps(rows))
'''


def build_class_index_rows(containers, file_name):
    """Ask the engine worker for the class-index rows.

    The parser is now ordinary code in the engine worker image
    (Services/Engine/worker/class_index.py) rather than a script this module
    pushed into the container and executed.

    Returns [] on any failure — indexing is best-effort and must never break a
    decompile.
    """
    try:
        result = containers._send("engine.class_index", [file_name], timeout=600)
    except Exception as e:
        logger.warning("class-index: dispatch failed for %s: %s", file_name, e)
        return []

    if result.get("status") != "ok":
        logger.warning(
            "class-index: parser reported %s for %s", result.get("reason"), file_name
        )
        return []

    rows = result.get("rows")
    return rows if isinstance(rows, list) else []
