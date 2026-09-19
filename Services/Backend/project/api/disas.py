import json
import os
import pathlib
import plistlib
import zipfile

from flask import request, jsonify
from flask_restx import Namespace, Resource


from androguard.core.apk import APK
from werkzeug.utils import secure_filename
from strongarm.macho import MachoParser, MachoBinary, MachoAnalyzer, CPU_TYPE
from strongarm.cli.utils import disassemble_method
from strongarm.macho import BinaryEncryptedError, MachoAnalyzer, MachoBinary, MachoParser, VirtualMemoryPointer
from strongarm.objc import (
    ObjcFunctionAnalyzer,
    ObjcInstruction,
    ObjcMethodInfo,
    ObjcUnconditionalBranchInstruction,
    RegisterContentsType,
)
from rich.console import Console
console = Console()

from pathlib import Path
import tempfile
import re
from typing import List, Optional, Dict, Any

from capstone import CsInsn
from capstone.arm64 import ARM64_OP_IMM, ARM64_OP_MEM, ARM64_OP_REG, Arm64Op

from strongarm.macho import (
    CPU_TYPE,
    MachoAnalyzer,
    MachoBinary,
    MachoParser,
    ObjcCategory,
    ObjcClass,
    ObjcSelector,
    VirtualMemoryPointer,
)
from strongarm.objc import (
    ObjcBranchInstruction,
    ObjcFunctionAnalyzer,
    ObjcInstruction,
    ObjcMethodInfo,
    RegisterContentsType,
)


UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

disas_namespace = Namespace('disas', description='Disassemble related operations')





import json
from typing import List, Optional, Dict, Any

### Utils Functions for Decompiler Sections of Leviathan. TODO: Implement the methods in the decompiler class
def method_to_dict(method):
    return {
        "class": method.objc_class.name,
        "selector": method.objc_sel.name,
        "imp_addr": hex(int(method.imp_addr)) if method.imp_addr else None
    }


def _bounded_function_analyzer(binary, function_addr):
    """Build an ObjcFunctionAnalyzer for a function strongarm's automatic boundary
    detection can't handle. We compute the end from the next *valid* function start
    (ignoring bogus rebased-pointer entries above __text), capped at the __text
    section end, disassemble that exact range, and construct the analyzer from the
    instruction list — preserving strongarm's full per-instruction annotation."""
    import capstone

    analyzer = MachoAnalyzer.get_analyzer(binary)
    start = int(function_addr)

    text_end = None
    for sec in binary.sections:
        if sec.name == '__text':
            text_end = int(sec.address) + int(sec.size)
            break

    # Next legitimate function start after `start`, within __text (drops the bogus
    # 0x2000... entries that break strongarm's boundary index).
    nexts = [
        int(f) for f in analyzer.get_functions()
        if int(f) > start and (text_end is None or int(f) <= text_end)
    ]
    end = min(nexts) if nexts else text_end
    if not end or end <= start:
        raise ValueError(f'could not determine function bounds for {hex(start)}')

    data = bytes(binary.get_content_from_virtual_address(VirtualMemoryPointer(start), end - start))
    md = capstone.Cs(capstone.CS_ARCH_ARM64, capstone.CS_MODE_LITTLE_ENDIAN)
    md.detail = True
    instructions = list(md.disasm(data, start))
    if not instructions:
        raise ValueError(f'no instructions disassembled at {hex(start)}')
    return ObjcFunctionAnalyzer(binary, instructions)


def disassemble_function_json(
    binary: MachoBinary,
    function_addr: VirtualMemoryPointer,
    prefix: Optional[List[str]] = None,
    sel_args: Optional[List[str]] = None,
) -> Dict[str, Any]:
    if not prefix:
        prefix = []
    if not sel_args:
        sel_args = []

    try:
        function_analyzer = ObjcFunctionAnalyzer.get_function_analyzer(binary, function_addr)
    except Exception:
        # strongarm's auto function-boundary logic chokes on some functions (entry
        # points, or binaries whose LC_FUNCTION_STARTS table has bogus rebased-pointer
        # entries like 0x2000...). Bound the function ourselves and construct the
        # analyzer from an explicit instruction list — this keeps strongarm's full
        # per-instruction annotation (selectors, strings, msgSend args).
        function_analyzer = _bounded_function_analyzer(binary, function_addr)

    # Selector-stub map (__objc_stubs) so `bl _objc_msgSend$sel` calls can be
    # annotated with their selector — strongarm can't resolve these itself.
    try:
        analyzer = MachoAnalyzer.get_analyzer(binary)
        stub_map = _get_stub_map(binary, analyzer)
    except Exception:
        stub_map = {}

    # Gather basic block boundaries
    basic_block_boundaries = [
        [block.start_address, block.end_address]
        for block in function_analyzer.basic_blocks
    ]
    # Flatten them into a set for quick membership testing
    boundaries_flat = [addr for pair in basic_block_boundaries for addr in pair]
    basic_block_boundaries_set = set(boundaries_flat)

    instructions_data = []

    for instr in function_analyzer.instructions:
        # Build a dict for this one instruction
        instr_dict = {}
        instr_dict["address"] = instr.address
        instr_dict["is_basic_block_boundary"] = (instr.address in basic_block_boundaries_set)
        instr_dict["mnemonic"] = instr.mnemonic
        instr_dict["operands"] = [
            format_instruction_arg_json(instr, op)
            for op in instr.operands
        ]

        # This will return a dictionary describing the annotation
        instr_dict["annotation"] = annotate_instruction_json(
            function_analyzer, sel_args, instr, stub_map
        )

        instructions_data.append(instr_dict)

    # An `adrp` only loads a 4KB page base; our annotator naively shows whatever
    # string sits at that base, which is misleading. When the very next `add`
    # (same register) resolves the *real* string from that base, drop the adrp's
    # noise so only the correct string on the `add` remains.
    for i in range(len(instructions_data) - 1):
        cur = instructions_data[i]
        if cur["mnemonic"] != "adrp":
            continue
        if (cur.get("annotation") or {}).get("type") != "StringLoad":
            continue
        nxt = instructions_data[i + 1]
        if (nxt["mnemonic"] == "add"
                and (nxt.get("annotation") or {}).get("type") == "StringLoad"
                and cur["operands"] and len(nxt["operands"]) >= 2
                and nxt["operands"][1] == cur["operands"][0]):
            cur["annotation"] = {"type": "None"}

    # Return a dictionary, which we can later JSON-serialize
    return {
        "prefix": prefix,
        "basic_block_boundaries": basic_block_boundaries,
        "instructions": instructions_data
    }


def format_instruction_arg_json(instruction: CsInsn, arg: Arm64Op) -> str:
    """
    Return a plain string representation of the operand
    suitable for embedding in JSON.
    """
    if arg.type == ARM64_OP_REG:
        # Return the register name
        return f"{instruction.reg_name(arg.value.reg)}"

    elif arg.type == ARM64_OP_IMM:
        # Return the hex-encoded immediate
        return f"#{hex(arg.value.imm)}"

    elif arg.type == ARM64_OP_MEM:
        # Return base/displacement in bracket notation
        base_reg = instruction.reg_name(arg.mem.base)
        disp_hex = hex(arg.mem.disp)
        return f"[{base_reg} #{disp_hex}]"

    raise RuntimeError(f"Unknown arg type {arg.type}")


def annotate_instruction_json(
    function_analyzer: ObjcFunctionAnalyzer,
    sel_args: List[str],
    instr: CsInsn,
    stub_map: Optional[Dict[int, str]] = None,
) -> Dict[str, Any]:
    """
    Return a dictionary describing the annotation for this instruction.
    """
    annotation_dict = {}

    # Modern selector-stub call: `bl _objc_msgSend$sel` targets an __objc_stubs
    # entry. strongarm doesn't resolve these, but our stub_map does — so a call
    # like `bl #0x1002bedc0` becomes a readable `[obj loadDeviceInfo]` message send.
    if stub_map and instr.mnemonic == 'bl' and instr.operands:
        try:
            op0 = instr.operands[0]
            if op0.type == ARM64_OP_IMM and op0.value.imm in stub_map:
                annotation_dict["type"] = "ObjcSelectorStub"
                annotation_dict["selector"] = stub_map[op0.value.imm]
                return annotation_dict
        except Exception:
            pass

    # Wrap the original instruction
    wrapped_instr = ObjcInstruction.parse_instruction(
        function_analyzer,
        function_analyzer.get_instruction_at_address(instr.address)
    )

    # Check if it is an ObjcBranchInstruction
    if isinstance(wrapped_instr, ObjcBranchInstruction):
        annotation_dict["type"] = "ObjcBranchInstruction"
        wrapped_branch_instr = wrapped_instr

        # Is it a local jump, or a call to a symbol?
        if function_analyzer.is_local_branch(wrapped_branch_instr):
            annotation_dict["is_local_branch"] = True
            annotation_dict["destination_address"] = wrapped_branch_instr.destination_address
        else:
            annotation_dict["is_local_branch"] = False
            # If there's a symbol, store it
            annotation_dict["symbol"] = wrapped_branch_instr.symbol
            # If there's a selector, store it with arguments
            if wrapped_branch_instr.selector:
                annotation_dict["selector"] = wrapped_branch_instr.selector.name
                annotation_dict["args"] = []

                arg_count = wrapped_branch_instr.selector.name.count(":")
                for i in range(arg_count):
                    register = f"x{i+2}"  # x2 onward for "real" ObjC method args
                    method_arg = function_analyzer.get_register_contents_at_instruction(
                        register, wrapped_branch_instr
                    )
                    if method_arg.type == RegisterContentsType.IMMEDIATE:
                        annotation_dict["args"].append(hex(method_arg.value))
                    else:
                        annotation_dict["args"].append("<?>")
            else:
                # No known selector, generic function call
                annotation_dict["selector"] = None
                annotation_dict["args"] = []
    else:
        # Possible string-load or other immediate loads.
        if instr.mnemonic in ["ldr", "adr", "adrp", "add"]:
            # Only care about registers that are written to
            if not ObjcInstruction.instruction_uses_vector_registers(instr):
                _, regs_written = instr.regs_access()
                if regs_written:
                    register = instr.reg_name(regs_written[0])
                    try:
                        register_contents = function_analyzer.get_register_contents_at_instruction(
                            register, wrapped_instr
                        )
                        if register_contents.type == RegisterContentsType.IMMEDIATE:
                            binary_str = function_analyzer.binary.read_string_at_address(
                                VirtualMemoryPointer(register_contents.value)
                            )
                            if binary_str:
                                annotation_dict["type"] = "StringLoad"
                                annotation_dict["string_value"] = binary_str
                                return annotation_dict
                    except Exception:
                        # The resolved register value isn't a valid string address
                        # (common for arithmetic immediates in C functions like main).
                        # That's simply not a string load — fall through to no annotation.
                        pass

        # If no annotation is found, you can either return an empty dictionary
        # or indicate some default annotation type:
        annotation_dict["type"] = "None"

    return annotation_dict








def args_from_sel_name(sel: str) -> List[str]:
    sel_args = ["self", f"@selector({sel})"]
    if ":" not in sel:
        return sel_args

    sel_components = sel.split(":")
    for component in sel_components:
        if not len(component):
            sel_args.append("")
            continue
        # extract the last capitalized word
        split = re.findall("[A-Z][^A-Z]*", component)
        # if no capitalized word, use the full component
        if not len(split):
            split.append(component)
        # lowercase it
        sel_args.append(split[-1].lower())
    return sel_args



def extract_macho_binary_from_ipa(file_path):
    with zipfile.ZipFile(file_path, 'r') as ipa:
        macho_file_path, app_name = find_macho_binary(ipa)
        if macho_file_path is None:
            raise FileNotFoundError('Mach-O binary not found')

        temp_dir = tempfile.mkdtemp()
        macho_file_temp_path = os.path.join(temp_dir, app_name)
        with ipa.open(macho_file_path) as macho_file:
            data = macho_file.read()
            if not data:
                raise ValueError('Extracted Mach-O binary is empty')
            with open(macho_file_temp_path, 'wb') as temp_file:
                temp_file.write(data)

        if os.path.getsize(macho_file_temp_path) == 0:
            raise ValueError('Saved Mach-O binary is empty')

        return macho_file_temp_path, temp_dir



MACHO_MAGIC = [b'\xcf\xfa\xed\xfe', b'\xca\xfe\xba\xbe', b'\xce\xfa\xed\xfe', b'\xfe\xed\xfa\xcf']


def is_macho_binary(data):
    """Check if the provided data starts with Mach-O magic bytes."""
    return any(data.startswith(magic) for magic in MACHO_MAGIC)


def find_macho_binary(ipa):
    """
    Walk through all the files in the .ipa archive to find the Mach-O binary,
    ignoring subdirectories within the .app directory.
    """
    for name in ipa.namelist():
        if name.startswith('Payload/') and '.app/' in name:
            sub_path = name.split('.app/', 1)[-1]
            app_name = name.split('.app/')[0].split('/')[-1]
            if '/' not in sub_path and not sub_path.endswith(('.json', '.plist', '.png', '.jpg', '.jpeg', '.xml')):
                with ipa.open(name) as file:
                    if is_macho_binary(file.read(4)):
                        return name, app_name
    return None, None


@disas_namespace.route('/disassemble/ios/<filename>/methods/<method_name>')
class DissassembleMethod(Resource):
    def get(self, filename, method_name):
        file_path = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
        if not os.path.exists(file_path):
            return {'message': 'File not found'}, 404

        try:
            macho_file_temp_path, temp_dir = extract_macho_binary_from_ipa(file_path)
            parser = MachoParser(Path(macho_file_temp_path))
            binary = parser.get_arm64_slice()
            analyze = MachoAnalyzer(binary)
            sel_args = args_from_sel_name(method_name)
            matching_sels = [x for x in analyze.get_objc_methods()]
            print(matching_sels)

            argument_list = ", ".join(sel_args)
            disassembled_str = disassemble_method(binary, matching_sels[0])
            print(disassembled_str)


        except FileNotFoundError as e:
            print(f"Error: {str(e)}")
            return {'message': str(e)}, 404

        except Exception as e:
            print(f"Error: {str(e)}")
            return {'message': str(e)}, 500



@disas_namespace.route('/disassemble/ios/<filename>/methods')
class GetMethods(Resource):
    def get(self, filename):
        file_path = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
        if not os.path.exists(file_path):
            return {'message': 'File not found'}, 404

        try:
            macho_file_temp_path, temp_dir = extract_macho_binary_from_ipa(file_path)
            parser = MachoParser(Path(macho_file_temp_path))
            binary = parser.get_arm64_slice()
            analyze = MachoAnalyzer(binary)
            methods = analyze.get_objc_methods()
            print(methods)
            methods_json = json.dumps([method_to_dict(m) for m in methods], indent=2)
            return {'methods': methods_json}, 200
        except FileNotFoundError as e:
            print(f"Error: {str(e)}")
            return {'message': str(e)}, 404
        except Exception as e:
            print(f"Error: {str(e)}")
            return {'message': str(e)}, 500

@disas_namespace.route('/disassemble/ios/<filename>')
class DisassembleBinary(Resource):
    pass


@disas_namespace.route('/disassemble/ios/<filename>/strings')
class DisassembleStrings(Resource):
    def get(self, filename):
        file_path = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
        if not os.path.exists(file_path):
            return {'message': 'File not found'}, 404

        try:
            macho_file_temp_path, temp_dir = extract_macho_binary_from_ipa(file_path)
            parser = MachoParser(Path(macho_file_temp_path))
            binary = parser.get_arm64_slice()
            analyze = MachoAnalyzer(binary)

            all_strings = set()
            print(analyze.strings())

            for string in analyze.strings():
                all_strings.add(string)

            strings = list(all_strings)
            # Remove nulllines and empty strings
            strings = [s for s in strings if s and s != '\n']



            return {'strings': strings}, 200

        except FileNotFoundError as e:
            print(f"Error: {str(e)}")
            return {'message': str(e)}, 404
        except Exception as e:
            print(f"Error: {str(e)}")
            return {'message': str(e)}, 500














def validate_address_in_binary(binary: MachoBinary, address: int) -> bool:
    """Check if address falls within any segment's virtual address range."""
    for segment in binary.segments:
        if segment.vmaddr <= address < segment.vmaddr + segment.vmsize:
            return True
    return False


@disas_namespace.route('/disassemble/ios/<filename>/<address>')
class DisassembleAddress(Resource):
    def get(self, filename, address):
        file_path = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
        if not os.path.exists(file_path):
            return {'message': 'File not found'}, 404

        try:
            addr_int = int(address, 16) if isinstance(address, str) else address
        except ValueError:
            return {'message': f'Invalid address format: {address}'}, 400

        try:
            macho_file_temp_path, temp_dir = extract_macho_binary_from_ipa(file_path)
            parser = MachoParser(Path(macho_file_temp_path))
            binary = parser.get_arm64_slice()

            if not validate_address_in_binary(binary, addr_int):
                return {'message': f'Address {address} is outside valid binary segments'}, 400

            vmp = VirtualMemoryPointer(addr_int)
            try:
                disassembled_json = disassemble_function_json(binary, vmp)
                return {'disassembly': disassembled_json, 'engine': 'strongarm'}, 200
            except Exception as strongarm_err:
                # strongarm can't bound some functions (entry points, non-Obj-C, bad
                # function-start table entries) → fall back to r2, which is more robust
                # and still gets our selector annotations. Same JSON shape.
                msg = str(strongarm_err)
                if 'negative offset' in msg or 'InvalidAddress' in msg or 'bounds' in msg:
                    from project.api.iOS.pseudocode import disassemble_function_r2
                    disassembled_json = disassemble_function_r2(filename, addr_int)
                    return {'disassembly': disassembled_json, 'engine': 'r2'}, 200
                raise

        except FileNotFoundError as e:
            print(f"Error: {str(e)}")
            return {'message': str(e)}, 404
        except Exception as e:
            error_msg = str(e)
            print(f"Error: {error_msg}")
            if 'negative offset' in error_msg or 'InvalidAddress' in error_msg:
                return {'message': (
                    f'Could not disassemble the function at {address} with either engine.'
                )}, 400
            return {'message': error_msg}, 500


@disas_namespace.route('/disassemble/ios/<filename>/xrefs/<address>')
class XrefsToAddress(Resource):
    """Cross-references: every code location in the binary that branches/calls
    to the given address. Backed by strongarm's prebuilt xref database, so each
    lookup is cheap once the analyzer is warm (the analyzer itself is cached)."""

    def get(self, filename, address):
        file_path = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
        if not os.path.exists(file_path):
            return {'message': 'File not found'}, 404

        try:
            addr_int = int(address, 16) if isinstance(address, str) else address
        except ValueError:
            return {'message': f'Invalid address format: {address}'}, 400

        try:
            macho_file_temp_path, temp_dir = extract_macho_binary_from_ipa(file_path)
            parser = MachoParser(Path(macho_file_temp_path))
            binary = parser.get_arm64_slice()
            analyzer = MachoAnalyzer.get_analyzer(binary)

            target = VirtualMemoryPointer(addr_int)
            name_cache = {}
            xrefs = []
            for xref in analyzer.calls_to(target):
                func_start = int(xref.caller_func_start_address)
                # Resolve the calling function's symbol name (best-effort; internal
                # functions are often unnamed). Cache per function to avoid repeats.
                if func_start not in name_cache:
                    try:
                        sym = analyzer.callable_symbol_for_address(VirtualMemoryPointer(func_start))
                        name_cache[func_start] = sym.symbol_name if sym else None
                    except Exception:
                        name_cache[func_start] = None
                xrefs.append({
                    'caller_addr': hex(int(xref.caller_addr)),
                    'caller_func_start_address': hex(func_start),
                    'caller_func_name': name_cache[func_start],
                    'destination_addr': hex(int(xref.destination_addr)),
                })

            # Stable order: by calling function, then by call-site address.
            xrefs.sort(key=lambda x: (int(x['caller_func_start_address'], 16),
                                      int(x['caller_addr'], 16)))

            return {
                'address': hex(addr_int),
                'count': len(xrefs),
                'xrefs': xrefs,
            }, 200

        except FileNotFoundError as e:
            print(f"Error: {str(e)}")
            return {'message': str(e)}, 404
        except Exception as e:
            print(f"Error computing xrefs for {address}: {str(e)}")
            return {'message': str(e)}, 500


def sha256_of_macho_slice(filename):
    """sha256 of the extracted arm64 Mach-O slice — the binary's content identity."""
    import hashlib
    file_path = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
    macho_file_temp_path, _ = extract_macho_binary_from_ipa(file_path)
    h = hashlib.sha256()
    with open(macho_file_temp_path, 'rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def _build_selector_stub_map(binary, analyzer):
    """Map each __objc_stubs selector-stub address -> selector name.

    Modern Xcode compiles `[x sel]` to `bl _objc_msgSend$sel`, a per-selector stub in
    __objc_stubs of the form:  adrp x1,#page ; ldr x1,[x1,#off] ; adrp x16 ; ldr x16 ;
    br x16.  The selref (page+off) loaded into x1 identifies the selector. strongarm's
    version doesn't parse these, so we decode them ourselves — this is what makes the
    vast majority of message sends visible (it's why loadDeviceInfo was invisible).
    """
    import capstone
    md = capstone.Cs(capstone.CS_ARCH_ARM64, capstone.CS_MODE_LITTLE_ENDIAN)
    md.detail = True
    stub_to_sel = {}
    for sec in binary.sections:
        if sec.name != '__objc_stubs':
            continue
        start = int(sec.address)
        size = int(sec.size)
        data = bytes(binary.get_content_from_virtual_address(VirtualMemoryPointer(start), size))
        STUB = 32  # each selector stub is 32 bytes
        for off in range(0, size, STUB):
            insns = list(md.disasm(data[off:off + STUB], start + off))
            if len(insns) < 2:
                continue
            adrp, ldr = insns[0], insns[1]
            if adrp.mnemonic != 'adrp' or ldr.mnemonic != 'ldr':
                continue
            try:
                selref = adrp.operands[1].imm + ldr.operands[1].mem.disp
                sel = analyzer.selector_for_selref(VirtualMemoryPointer(selref))
                if sel:
                    stub_to_sel[start + off] = sel.name
            except Exception:
                continue
    return stub_to_sel


def _get_stub_map(binary, analyzer):
    """Selector-stub map, memoized on the analyzer so it's built once per binary
    (the ~0.6s decode) instead of on every disassembly request."""
    cached = getattr(analyzer, '_lev_stub_map', None)
    if cached is not None:
        return cached
    try:
        stub_map = _build_selector_stub_map(binary, analyzer)
    except Exception:
        stub_map = {}
    try:
        setattr(analyzer, '_lev_stub_map', stub_map)
    except Exception:
        pass
    return stub_map


def collect_ios_xrefs(filename):
    """Whole-binary pass collecting Obj-C message-send cross-references.

    Two dispatch mechanisms are handled so coverage is complete on modern binaries:
      1. __objc_stubs selector stubs (`bl _objc_msgSend$sel`) — the majority on recent
         Xcode. The stub identifies the selector directly (no dataflow needed).
      2. Legacy direct `bl _objc_msgSend` with the selector in x1 — resolved via
         strongarm's ObjcBranchInstruction.

    Returns row dicts ready for bulk insert into ios_xref_index. ~6s of analysis for a
    17k-function binary (plus extract + analyzer warm-up); well under a minute.
    """
    file_path = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
    macho_file_temp_path, _ = extract_macho_binary_from_ipa(file_path)
    binary = MachoParser(Path(macho_file_temp_path)).get_arm64_slice()
    analyzer = MachoAnalyzer.get_analyzer(binary)

    stub_to_sel = _build_selector_stub_map(binary, analyzer)

    # Legacy direct objc_msgSend stub address(es) for the pre-__objc_stubs path.
    msgsend_stubs = set()
    try:
        for addr, name in analyzer.imp_stubs_to_symbol_names.items():
            if name == '_objc_msgSend':
                msgsend_stubs.add(int(addr))
    except Exception:
        pass

    rows = []
    name_cache = {}
    for func in analyzer.get_functions():
        func_start = int(func)
        try:
            fa = ObjcFunctionAnalyzer.get_function_analyzer(binary, VirtualMemoryPointer(func_start))
        except Exception:
            continue

        if func_start not in name_cache:
            try:
                sym = analyzer.callable_symbol_for_address(VirtualMemoryPointer(func_start))
                name_cache[func_start] = sym.symbol_name if sym else None
            except Exception:
                name_cache[func_start] = None
        caller_name = name_cache[func_start]

        for instr in fa.instructions:
            if instr.mnemonic != 'bl':
                continue
            try:
                target = instr.operands[0].imm
            except Exception:
                continue

            selector = None
            if target in stub_to_sel:
                # Modern selector stub — the selector is known from the stub itself.
                selector = stub_to_sel[target]
            elif target in msgsend_stubs:
                # Legacy direct send — resolve the selector via strongarm dataflow.
                try:
                    wrapped = ObjcInstruction.parse_instruction(
                        fa, fa.get_instruction_at_address(instr.address)
                    )
                    if isinstance(wrapped, ObjcBranchInstruction) and getattr(wrapped, 'selector', None):
                        selector = wrapped.selector.name
                except Exception:
                    selector = None

            if not selector:
                continue
            rows.append({
                'kind': 'msgsend',
                'target': selector,
                'caller_addr': int(instr.address),
                'caller_func_start': func_start,
                'caller_func_name': caller_name,
                'receiver_class': None,
            })

    return rows