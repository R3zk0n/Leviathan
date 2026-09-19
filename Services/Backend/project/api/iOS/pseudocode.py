"""iOS pseudocode via r2ghidra (Ghidra's decompiler, no JVM) + our __objc_stubs
selector map.

"""

import os
import re
import shutil
from pathlib import Path

import r2pipe
from werkzeug.utils import secure_filename

from strongarm.macho import MachoParser, MachoAnalyzer, VirtualMemoryPointer
from strongarm.objc import ObjcFunctionAnalyzer

from project.api.disas import (
    extract_macho_binary_from_ipa,
    _build_selector_stub_map,
    UPLOAD_FOLDER,
)

_STAGE_DIR = "/tmp/leviathan_macho"
_stub_cache = {}    # filename -> {stub_addr: selector}  (per-process memo)


def _stage_macho(filename):
    """Extract the arm64 slice once and cache it at a stable path (r2 needs the
    Mach-O, not the .ipa)."""
    os.makedirs(_STAGE_DIR, exist_ok=True)
    dest = os.path.join(_STAGE_DIR, re.sub(r"[^A-Za-z0-9_.-]", "_", filename))
    if not os.path.exists(dest):
        src, _ = extract_macho_binary_from_ipa(
            os.path.join(UPLOAD_FOLDER, secure_filename(filename))
        )
        shutil.copy(src, dest)
    return dest


def _stub_map(filename, macho_path):
    """{stub_addr(int): selector} for the binary, memoized per process."""
    if filename in _stub_cache:
        return _stub_cache[filename]
    binary = MachoParser(Path(macho_path)).get_arm64_slice()
    analyzer = MachoAnalyzer.get_analyzer(binary)
    stub_map = _build_selector_stub_map(binary, analyzer)
    _stub_cache[filename] = stub_map
    return stub_map


def _sanitize(selector):
    """r2 function name for a selector (`:` is illegal in names)."""
    return "objc_" + re.sub(r"[^A-Za-z0-9_]", "_", selector)


# Void ARC/runtime calls that define nothing — safe to drop as pure noise.
_ARC_VOID = re.compile(
    r"^\s*(sym\.imp\.)?objc_(release|sync_enter|sync_exit)\s*\(", re.I
)


def _postprocess(code, strip_arc=True):
    """Conservative, semantics-preserving cleanup for readability."""
    if not code:
        return code
    out = []
    for line in code.splitlines():
        # Drop standalone void ARC statements (release / sync_enter / sync_exit).
        if strip_arc and _ARC_VOID.match(line):
            continue
        # Tidy the noisy import prefix.
        line = line.replace("sym.imp.", "")
        out.append(line)
    return "\n".join(out)


def decompile_function(filename, func_addr, strip_arc=True):
    """Decompile one function to C pseudocode with resolved Obj-C message sends.

    func_addr: int (static virtual address). Returns the pseudocode string.
    """
    macho = _stage_macho(filename)
    stub_map = _stub_map(filename, macho)

    # Which selector stubs does this function actually call? Name only those
    # (fast) rather than all ~4600 stubs in the binary.
    called = {}
    try:
        binary = MachoParser(Path(macho)).get_arm64_slice()
        fa = ObjcFunctionAnalyzer.get_function_analyzer(binary, VirtualMemoryPointer(func_addr))
        for ins in fa.instructions:
            if ins.mnemonic != "bl":
                continue
            try:
                tgt = ins.operands[0].imm
            except Exception:
                continue
            if tgt in stub_map and tgt not in called:
                called[tgt] = stub_map[tgt]
    except Exception:
        called = {}

    r2 = r2pipe.open(macho, flags=["-2", "-e", "bin.relocs.apply=true"])
    try:
        r2.cmd(f"af @ {hex(func_addr)}")
        for addr, sel in called.items():
            r2.cmd(f"af @ {hex(addr)}")
            r2.cmd(f"afn {_sanitize(sel)} @ {hex(addr)}")
        code = r2.cmd(f"pdg @ {hex(func_addr)}")
    finally:
        try:
            r2.quit()
        except Exception:
            pass

    return _postprocess(code, strip_arc=strip_arc)


def disassemble_function_r2(filename, func_addr):
    """Disassemble a function with r2 into the SAME JSON shape strongarm produces
    (instructions + basic_block_boundaries), with our selector-stub annotations
    applied. Used as a fallback when strongarm can't bound the function (e.g. entry
    points / functions with bad function-start table entries)."""
    macho = _stage_macho(filename)
    stub_map = _stub_map(filename, macho)

    r2 = r2pipe.open(macho, flags=["-2", "-e", "bin.relocs.apply=true"])
    try:
        r2.cmd(f"af @ {hex(func_addr)}")
        fn = r2.cmdj(f"pdfj @ {hex(func_addr)}") or {}
        blocks = r2.cmdj(f"afbj @ {hex(func_addr)}") or []
    finally:
        try:
            r2.quit()
        except Exception:
            pass

    ops = [o for o in fn.get("ops", []) if "addr" in o and o.get("type") != "invalid"]
    if not ops:
        raise ValueError("r2 produced no disassembly for this address")

    boundaries = [
        [int(b["addr"]), int(b["addr"]) + int(b["size"])]
        for b in blocks if "addr" in b and "size" in b
    ]
    bb_starts = {b[0] for b in boundaries}
    addrs = [int(o["addr"]) for o in ops]
    lo, hi = min(addrs), max(addrs)

    instructions = []
    for op in ops:
        addr = int(op["addr"])
        text = op.get("opcode") or op.get("disasm") or ""
        parts = text.split(None, 1)
        mnem = parts[0] if parts else ""
        operands = [x.strip() for x in parts[1].split(",")] if len(parts) > 1 else []

        annotation = {"type": "None"}
        jump = op.get("jump")
        typ = op.get("type", "")
        if jump is not None:
            jump = int(jump)
            if mnem == "bl" and jump in stub_map:
                annotation = {"type": "ObjcSelectorStub", "selector": stub_map[jump]}
            elif typ in ("jmp", "cjmp") and lo <= jump <= hi:
                annotation = {"type": "ObjcBranchInstruction",
                              "is_local_branch": True, "destination_address": jump}
            elif mnem in ("bl", "b"):
                # Call/branch out of the function — resolve the symbol r2 shows in disasm.
                sym = None
                m = re.search(r"\b(?:sym\.imp\.|sym\.|reloc\.)([A-Za-z_][\w$]*)", op.get("disasm", ""))
                if m:
                    sym = m.group(1)
                annotation = {"type": "ObjcBranchInstruction",
                              "is_local_branch": False, "symbol": sym, "selector": None}

        instructions.append({
            "address": addr,
            "is_basic_block_boundary": addr in bb_starts,
            "mnemonic": mnem,
            "operands": operands,
            "annotation": annotation,
        })

    if not boundaries:
        boundaries = [[lo, hi + 4]]
    return {"prefix": [], "basic_block_boundaries": boundaries, "instructions": instructions}
