"""Decompiled-source class
"""

import bisect
import logging
import os
import re

logger = logging.getLogger(__name__)

# Index both Java (JADX; Vineflower's generated Java) and Kotlin (Vineflower
# emits .kt for Kotlin classes). The same class is Foo.java under one engine and
# Foo.kt under the other — that divergence is what this index normalises.
SRC_EXT = (".java", ".kt")

# Kotlin `package a.b` has NO trailing semicolon; Java requires one.
PKG_RE = re.compile(r'^\s*package\s+([A-Za-z_][\w.]*)\s*;?', re.M)
# `object` covers Kotlin singletons; data/sealed/enum/annotation class all still
# match on the `class` keyword. Preceding modifiers/annotations are fine since
# we anchor on the keyword.
TYPE_RE = re.compile(r'\b(class|interface|enum|record|@interface|object)\s+([A-Za-z_]\w*)')


def strip_noise(text):
    """Remove comments and string/char literals.

    Their braces and keywords would otherwise corrupt depth counting and match
    TYPE_RE.
    """
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    text = re.sub(r'//[^\n]*', '', text)
    text = re.sub(r'"""(?:.|\n)*?"""', '""', text)   # Kotlin raw strings first
    text = re.sub(r'"(?:\\.|[^"\\])*"', '""', text)
    text = re.sub(r"'(?:\\.|[^'\\])*'", "''", text)
    return text


def top_level_types(text):
    """Type names declared at brace depth 0."""
    text = strip_noise(text)
    opens = [m.start() for m in re.finditer(r'\{', text)]
    closes = [m.start() for m in re.finditer(r'\}', text)]
    out = []
    seen = set()
    for m in TYPE_RE.finditer(text):
        pos = m.start()
        depth = bisect.bisect_right(opens, pos) - bisect.bisect_right(closes, pos)
        if depth == 0:
            name = m.group(2)
            if name not in seen:
                seen.add(name)
                out.append(name)
    return out


def build_rows(root):
    """Walk root/sources and return [{fqcn, simple, package, rel_path}, ...]."""
    sources = os.path.join(root, "sources")
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
            except OSError:
                continue
            pm = PKG_RE.search(text)
            pkg = pm.group(1) if pm else None
            types = top_level_types(text)
            if not types:
                # No parseable declaration (rare) -> fall back to the filename
                # stem so the file stays reachable by simple name.
                types = [os.path.splitext(fn)[0]]
            for t in types:
                fqcn = (pkg + "." + t) if pkg else t
                rows.append({"fqcn": fqcn, "simple": t, "package": pkg, "rel_path": rel})
    return rows
