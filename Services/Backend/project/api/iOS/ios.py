import os
import pathlib
import plistlib
import subprocess
import zipfile
import hashlib
import time
import json
import random
import shutil
import bisect
from flask import request, jsonify
from flask_restx import Namespace, Resource
#from androguard.core.bytecodes.apk import APK

#from androguard.core.apk import APK
from strongarm.objc import ObjcFunctionAnalyzer
from strongarm.objc import RegisterContentsType
from werkzeug.utils import secure_filename
from strongarm.macho import MachoParser, MachoBinary, MachoAnalyzer, CPU_TYPE
# VirtualMemoryPointer is needed to read bytes at an absolute address.
from strongarm.macho import VirtualMemoryPointer
from project.api.database.services import handle_db_error, add_android_info, add_ios_info, get_all_android_info, \
    add_ios_info

import lief
from rich import inspect
from pathlib import Path
import tempfile
from rich.console import Console
from rich import inspect
import ktool
import re
import icdump
from project.api.iOS import find_cccrypt_calls

console = Console()

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ios_namespace = Namespace("ios", description="iOS related operations")


# Helper functions.

# Cryptography Helper Functions.

# Binary Helper Functions.


def parse_class_declaration(decl):
    lines = decl.split('\n')
    if len(lines) == 0:
        return None

    class_declaration = lines[0].strip()
    if not class_declaration.startswith('@interface'):
        return None

    class_parts = class_declaration.split(':')
    class_name = class_parts[0].split()[-1].strip()
    superclass = class_parts[1].strip() if len(class_parts) > 1 else "NSObject"

    # Remove invalid characters from class name
    class_name = class_name.replace('{', '').strip()
    # Remove newlines from class name
    class_name = class_name.replace('\n', '').strip()
    # Remove empty classes and duplicates
    if class_name == '' or class_name == ' ':
        return None


    print(f"ClassName: {class_name}")

    ivars = []
    methods = []
    properties = []

    for line in lines[1:]:
        line = line.strip()
        if line.startswith('@interface') or line.startswith('}') or line == '':
            continue
        elif line.startswith('-') or line.startswith('+'):
            methods.append(line)
        elif line.startswith('@property'):
            properties.append(line)
        else:
            ivars.append(line)

    return {
        'name': class_name,
        'superclass': superclass,
        'ivars': ivars,
        'methods': methods,
        'properties': properties
    }





def parse_checksec_output(checksec_output):
    # Split the output string by '|' and strip extra whitespace
    parts = [part.strip() for part in checksec_output.split('|') if part.strip()]

    # Initialize an empty dictionary
    checksec = {}

    # Define a regular expression to match feature:value pairs
    pattern = re.compile(r'(\w+):\s+(true|false|\d+)')

    for part in parts:
        # Find all matches in the current part
        matches = pattern.findall(part)

        for match in matches:
            # Add each match to the dictionary
            key, value = match
            if value.isdigit():
                value = int(value)
            elif value.lower() == 'true':
                value = True
            elif value.lower() == 'false':
                value = False
            checksec[key] = value

    return checksec
def print_binary_segments(binary: MachoBinary) -> None:
    print("\nSegments:")
    for segment in binary.segments:
        virtual_loc = f"[{segment.vmaddr:#011x} - {segment.vmaddr + segment.vmsize:#011x}]"
        file_loc = f"[{segment.offset:#011x} - {segment.offset + segment.size:#011x}]"
        print(f"\t{virtual_loc} (file {file_loc}) {segment.name}")
        return virtual_loc, file_loc, segment.name, segment.vmaddr, segment.vmsize, segment.offset, segment.size


def print_load_binary_info(binary: MachoBinary) -> None:
    for linked_dylib in binary.linked_dylibs:
        for linked_dylib in binary.linked_dylibs:
            print(f"{linked_dylib.name} v.{hex(linked_dylib.current_version)}")
            return linked_dylib.name, linked_dylib.current_version


# Get the Entitlements
def get_macho_entitlements(macho_file_temp_path):
    parser = MachoParser(Path(macho_file_temp_path))
    binary = parser.get_arm64_slice()
    entitlements = binary.get_entitlements().decode()
    return entitlements


def extract_deep_links(file_path, macho_file_temp_path):
    """Extract URL Schemes, Universal Links, and queried schemes from an IPA."""
    links = {
        "url_schemes": [],
        "universal_links": [],
        "queried_schemes": [],
    }

    # 1. URL Schemes & queried schemes from Info.plist
    try:
        with zipfile.ZipFile(file_path, 'r') as ipa:
            plist_file_path = next(
                (name for name in ipa.namelist()
                 if name.endswith('Info.plist') and
                 name.count('/') == 2 and 'Payload/' in name and '.app/' in name),
                None)

            if plist_file_path:
                with ipa.open(plist_file_path) as plist_file:
                    plist = plistlib.load(plist_file)

                # CFBundleURLTypes → URL Schemes (deep links)
                for url_type in plist.get('CFBundleURLTypes', []):
                    entry = {
                        "name": url_type.get('CFBundleURLName', ''),
                        "role": url_type.get('CFBundleTypeRole', 'None'),
                        "schemes": url_type.get('CFBundleURLSchemes', []),
                    }
                    links["url_schemes"].append(entry)

                # LSApplicationQueriesSchemes → schemes the app can query
                links["queried_schemes"] = plist.get('LSApplicationQueriesSchemes', [])
    except Exception as e:
        print(f"Error extracting plist links: {str(e)}")

    # 2. Associated Domains from entitlements (Universal Links / App Links)
    try:
        entitlements_xml = get_macho_entitlements(macho_file_temp_path)
        if entitlements_xml:
            entitlements_dict = plistlib.loads(entitlements_xml.encode('utf-8'))
            domains = entitlements_dict.get('com.apple.developer.associated-domains', [])
            for domain in domains:
                # Format is typically "applinks:example.com" or "webcredentials:example.com"
                if ':' in domain:
                    service, host = domain.split(':', 1)
                else:
                    service, host = 'unknown', domain
                links["universal_links"].append({
                    "service": service,
                    "domain": host,
                    "raw": domain,
                })
    except Exception as e:
        print(f"Error extracting entitlements links: {str(e)}")

    return links


def _ipa_fingerprint(file_path: str) -> str:
    """Fast fingerprint for an IPA based on path + mtime + size."""
    st = os.stat(file_path)
    raw = f"{os.path.abspath(file_path)}|{st.st_mtime_ns}|{st.st_size}".encode("utf-8", errors="ignore")
    return hashlib.sha256(raw).hexdigest()


def _maybe_cleanup_macho_cache(cache_dir: str, ttl_seconds: int) -> None:
    """Best-effort TTL cleanup; safe under concurrent processes."""
    if ttl_seconds <= 0:
        return

    # Keep cleanup cheap: run occasionally.
    if random.random() > 0.02:
        return

    now = time.time()
    try:
        entries = os.listdir(cache_dir)
    except FileNotFoundError:
        return

    for entry in entries:
        if not entry or entry.endswith(".lock") or entry.startswith("."):
            continue
        entry_dir = os.path.join(cache_dir, entry)
        if not os.path.isdir(entry_dir):
            continue
        meta_path = os.path.join(entry_dir, "meta.json")

        last_access = None
        try:
            if os.path.exists(meta_path):
                with open(meta_path, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                last_access = meta.get("last_access")
            if last_access is None:
                last_access = os.path.getmtime(entry_dir)
        except Exception:
            # If meta is corrupt, use directory mtime.
            try:
                last_access = os.path.getmtime(entry_dir)
            except Exception:
                continue

        if (now - float(last_access)) > ttl_seconds:
            try:
                shutil.rmtree(entry_dir, ignore_errors=True)
            except Exception:
                pass


def extract_macho_binary_from_ipa(file_path):
    """Extract (and cache) the main Mach-O binary from an IPA.

    Returns: (macho_path, temp_dir)
      - macho_path: path to extracted Mach-O
      - temp_dir: kept for backward-compat; None when using cache
    """
    cache_dir = os.environ.get("IOS_MACHO_CACHE_DIR", "/tmp/leviathan-ios-macho-cache")
    ttl_seconds = int(os.environ.get("IOS_MACHO_CACHE_TTL_SECONDS", "86400"))

    try:
        os.makedirs(cache_dir, exist_ok=True)
        _maybe_cleanup_macho_cache(cache_dir, ttl_seconds)
    except Exception:
        # If cache dir can't be created (permissions), fall back to old behavior.
        cache_dir = None

    cache_key = _ipa_fingerprint(file_path) if cache_dir else None

    if cache_dir and cache_key:
        entry_dir = os.path.join(cache_dir, cache_key)
        macho_path = os.path.join(entry_dir, "macho")
        meta_path = os.path.join(entry_dir, "meta.json")

        # Cache hit.
        try:
            if os.path.exists(macho_path) and os.path.getsize(macho_path) > 0:
                # Best-effort touch/update access.
                try:
                    meta = {}
                    if os.path.exists(meta_path):
                        with open(meta_path, "r", encoding="utf-8") as f:
                            meta = json.load(f) or {}
                    meta["last_access"] = time.time()
                    with open(meta_path, "w", encoding="utf-8") as f:
                        json.dump(meta, f)
                except Exception:
                    pass
                return macho_path, None
        except Exception:
            # If cache is in a bad state, we'll re-extract.
            pass

        # Simple lock to avoid multiple extractors racing.
        lock_path = os.path.join(cache_dir, f"{cache_key}.lock")
        lock_fd = None
        acquired = False
        try:
            start = time.time()
            while True:
                try:
                    lock_fd = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_RDWR)
                    acquired = True
                    break
                except FileExistsError:
                    # Another worker is extracting. Wait briefly for it to finish.
                    if time.time() - start > 15:
                        break
                    time.sleep(0.2)

            # If lock wasn't acquired, check again for a finished cache and use it.
            if not acquired:
                if os.path.exists(macho_path) and os.path.getsize(macho_path) > 0:
                    return macho_path, None
                # Otherwise fall back to old behavior below.
            else:
                # Re-check under lock.
                if os.path.exists(macho_path) and os.path.getsize(macho_path) > 0:
                    return macho_path, None

                with zipfile.ZipFile(file_path, 'r') as ipa:
                    macho_file_path, app_name = find_macho_binary(ipa)
                    if macho_file_path is None:
                        raise FileNotFoundError('Mach-O binary not found')

                    staging_dir = f"{entry_dir}.tmp-{os.getpid()}"
                    os.makedirs(staging_dir, exist_ok=True)
                    staging_macho = os.path.join(staging_dir, "macho")

                    with ipa.open(macho_file_path) as macho_file:
                        data = macho_file.read()
                        if not data:
                            raise ValueError('Extracted Mach-O binary is empty')
                        with open(staging_macho, 'wb') as temp_file:
                            temp_file.write(data)

                    if os.path.getsize(staging_macho) == 0:
                        raise ValueError('Saved Mach-O binary is empty')

                    os.makedirs(entry_dir, exist_ok=True)
                    os.replace(staging_macho, macho_path)
                    shutil.rmtree(staging_dir, ignore_errors=True)

                    meta = {
                        "ipa_path": os.path.abspath(file_path),
                        "macho_member_path": macho_file_path,
                        "app_name": app_name,
                        "created_at": time.time(),
                        "last_access": time.time(),
                    }
                    try:
                        with open(meta_path, "w", encoding="utf-8") as f:
                            json.dump(meta, f)
                    except Exception:
                        pass

                    return macho_path, None
        finally:
            if lock_fd is not None:
                try:
                    os.close(lock_fd)
                except Exception:
                    pass
            if acquired:
                try:
                    os.unlink(lock_path)
                except Exception:
                    pass

    # Fallback (previous behavior): per-request temp dir.
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


MACHO_MAGIC = [b'\xcf\xfa\xed\xfe',
               b'\xca\xfe\xba\xbe',
               b'\xce\xfa\xed\xfe',
               b'\xfe\xed\xfa\xcf']


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


def macho_encryption_status(macho_file_temp_path):
    """Return (is_encrypted, encryption_info) for a Mach-O by reading its FairPlay
    load commands.

    Only inspects LC_ENCRYPTION_INFO[_64] — a handful of load commands, not the
    (possibly encrypted) payload — so it's instant and works even on encrypted
    binaries. Callers use this to bail out *before* attempting Obj-C class/metadata
    parsing (icdump, strongarm), which on an encrypted binary walks ciphertext
    pointers: it floods logs with "Can't read ivar.name/type at 0x..." and never
    terminates because there is no valid structure to stop on.

    encryption_info mirrors the shape used by the /ios/info route.
    """
    info = []
    encrypted = False
    try:
        binary = lief.parse(macho_file_temp_path)
        if binary is None:
            return False, []
        for command in binary.commands:
            try:
                if (command.command == lief.MachO.LoadCommand.TYPE.ENCRYPTION_INFO_64
                        or command.command == lief.MachO.LoadCommand.TYPE.ENCRYPTION_INFO):
                    cid = int(command.crypt_id)
                    info.append({
                        "cryptid": cid,
                        "cryptsize": command.crypt_size,
                        "crypt_offset": command.crypt_offset,
                    })
                    if cid != 0:
                        encrypted = True
            except Exception as e:
                print(f"[encryption-check] command error: {e}")
                continue
    except Exception as e:
        # Never let the guard itself break a route — fail open (treat as not
        # encrypted) so behaviour is unchanged if LIEF can't parse the file.
        print(f"[encryption-check] parse error: {e}")
        return False, []
    return encrypted, info


####################################################################################################
# Routing - This section forwards the requests to the appropriate functions.


#### Binary Routes
@ios_namespace.route('/exports/<filename>')
class GetExports(Resource):
    def get(self, filename):
        file_path = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
        if not os.path.exists(file_path):
            return {'message': 'File not found'}, 404

        try:
            macho_file_temp_path, temp_dir = extract_macho_binary_from_ipa(file_path)

            ### Using LIEF to parse the Mach-O binaryy

            lief_parser = lief.parse(macho_file_temp_path)

            # Get the exports from lief
            exports = {}
            for exp in lief_parser.exported_symbols:
                section = lief_parser.section_from_virtual_address(exp.value)
                section_name = section.name if section else 'N/A'
                if section_name not in exports:
                    exports[section_name] = []
                exports[section_name].append({
                    'name': exp.name,
                    'address': hex(exp.value)
                })

            # Return the structured JSON response
            return jsonify({"exports": exports})

        except zipfile.BadZipFile:
            return {'message': 'Invalid ZIP file'}, 400
        except FileNotFoundError:
            return {'message': 'File not found after extraction'}, 404
        except ValueError as e:
            return {'message': str(e)}, 500
        except Exception as e:
            print(f"Error: {str(e)}")
            return {'message': str(e)}, 500



# Cryptography Helper Functions.


# // TODO: Implement LIEF parsing for encrypted binaries and add the ability to extract the symbols from the binary
@ios_namespace.route('/symbols/<filename>')
class GetSymbols(Resource):
    def get(self, filename):
        MMAP_ENABLED = False
        file_path = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
        if not os.path.exists(file_path):
            return {'message': 'File not found'}, 404

        try:

            macho_file_temp_path, temp_dir = extract_macho_binary_from_ipa(file_path)
            lief_parser = lief.parse(macho_file_temp_path)

            symbols_list = []
            with open(macho_file_temp_path, 'rb') as fd:
                image = ktool.load_image(fd, 0, load_imports=False, load_exports=False, use_mmaped_io=MMAP_ENABLED)
                if hasattr(image.symbol_table, 'table'):
                    for sym in image.symbol_table.table:
                        symbols_list.append({'address': sym.address, 'fullname': sym.fullname})
                else:
                    return {'message': 'No symbols found in the symbol table.'}, 404
            print(symbols_list)

            return jsonify(symbols_list)
        except zipfile.BadZipFile:
            return {'message': 'Invalid ZIP file'}, 400
        except FileNotFoundError:
            return {'message': 'File not found after extraction'}, 404
        except ValueError as e:
            return {'message': str(e)}, 500
        except Exception as e:
            print(f"Error: {str(e)}")
            return {'message': str(e)}, 500

@ios_namespace.route('/imports/<filename>')
class GetImports(Resource):
    def get(self, filename):
        file_path = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
        if not os.path.exists(file_path):
            return {'message': 'File not found'}, 404

        try:
            macho_file_temp_path, temp_dir = extract_macho_binary_from_ipa(file_path)
            # Using LIEF to parse the Mach-O binary
            lief_parser = lief.parse(macho_file_temp_path)
            # Get the imports from LIEF
            imports = {}
            for imp in lief_parser.imported_symbols:
                demangled = imp.demangled_name
                address = None
                if imp.has_binding_info:
                    info = imp.binding_info
                    if info.address:
                        address = hex(info.address)
                imports[demangled] = address
            # Return the structured JSON response
            return jsonify({"imports": imports})

        except zipfile.BadZipFile:
            return {'message': 'Invalid ZIP file'}, 400
        except FileNotFoundError:
            return {'message': 'File not found after extraction'}, 404
        except ValueError as e:
            return {'message': str(e)}, 500
        except Exception as e:
            print(f"Error: {str(e)}")
            return {'message': str(e)}, 500

@ios_namespace.route('/crypto/<filename>')
# We are using this function to defined and call into strongarm crypto analysis functions to get the cryptography info from the binary and return it as a JSON response. This will allow us to determine if the binary is encrypted or not and if it is encrypted, we can use the cryptography for static keys
class GetCryptography(Resource):
    def get(self, filename):
        file_path = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
        if not os.path.exists(file_path):
            return {'message': 'File not found'}, 404
        try:
            macho_file_temp_path, temp_dir = extract_macho_binary_from_ipa(file_path)
            parser = MachoParser(Path(macho_file_temp_path))
            binary = parser.get_arm64_slice()
            analyzer = MachoAnalyzer.get_analyzer(binary)

            # Return caller addresses so the frontend can jump into the decompiler at that location
            crypto_calls = find_cccrypt_calls(analyzer)

            # Crypto-only: compute the start address of the containing caller function.
            # Prefer Strongarm's call.caller_func_start_address when available; otherwise fall back
            # to a floor lookup over LIEF-derived function start addresses.
            function_starts = None
            try:
                lief_binary = lief.parse(macho_file_temp_path)
                base_address = lief_binary.imagebase
                function_starts = sorted(base_address + func.address for func in lief_binary.functions)
            except Exception:
                function_starts = None

            for c in crypto_calls:
                # Strongarm value might not be in our current return shape, but honor it if present.
                caller_func_start = c.get("caller_func_start_address")
                if caller_func_start:
                    try:
                        c["caller_function_start"] = hex(int(caller_func_start, 16))
                    except Exception:
                        c["caller_function_start"] = None
                else:
                    caller_addr = c.get("caller_addr")
                    if not caller_addr or not function_starts:
                        c["caller_function_start"] = None
                    else:
                        try:
                            caller_int = int(caller_addr, 16)
                            idx = bisect.bisect_right(function_starts, caller_int) - 1
                            c["caller_function_start"] = hex(function_starts[idx]) if idx >= 0 else None
                        except Exception:
                            c["caller_function_start"] = None

                # Attempt to resolve a static key for _CCCrypt from x3 at the call instruction.
                # Best-effort only: some binaries pass the key pointer indirectly or compute it dynamically.
                c["static_key"] = None
                try:
                    caller_addr = c.get("caller_addr")
                    caller_func_start = c.get("caller_func_start_address") or c.get("caller_function_start")
                    if caller_addr and caller_func_start:
                        func_analyzer = ObjcFunctionAnalyzer.get_function_analyzer(
                            binary,
                            VirtualMemoryPointer(int(str(caller_func_start), 16)),
                        )
                        instr = func_analyzer.get_instruction_at_address(int(str(caller_addr), 16))
                        reg_contents = func_analyzer.get_register_contents_at_instruction("x3", instr)

                        reg_type = getattr(getattr(reg_contents, "type", None), "name", None) or str(getattr(reg_contents, "type", None))
                        reg_value = getattr(reg_contents, "value", None)

                        if getattr(reg_contents, "type", None) == RegisterContentsType.IMMEDIATE and reg_value is not None:
                            key_address = int(reg_value)
                            try:
                                key_bytes = binary.get_content_from_virtual_address(
                                    VirtualMemoryPointer(key_address),
                                    32,
                                )
                                c["static_key"] = {
                                    "register": "x3",
                                    "type": "IMMEDIATE",
                                    "address": hex(key_address),
                                    "size": 32,
                                    "hex": key_bytes.hex(),
                                }
                            except Exception as e:
                                c["static_key"] = {
                                    "register": "x3",
                                    "type": "IMMEDIATE",
                                    "address": hex(key_address),
                                    "size": 32,
                                    "error": str(e),
                                }
                        else:
                            # Keep a tiny bit of metadata for debugging/UI, without being noisy.
                            c["static_key"] = {
                                "register": "x3",
                                "type": reg_type,
                                "value": hex(int(reg_value)) if isinstance(reg_value, int) else (str(reg_value) if reg_value is not None else None),
                            }
                except Exception:
                    # If anything fails, keep static_key as None.
                    c["static_key"] = None

            return jsonify({
                "symbol": "_CCCrypt",
                "calls": crypto_calls,
            })

        except Exception as e:
            print(f"Error: {str(e)}")
            return {'message': str(e)}, 500

@ios_namespace.route('/functions/<filename>')
class GetFunctions(Resource):
    def get(self, filename):
        try:
            page = int(request.args.get('page', 1))
            page_size = int(request.args.get('page_size', 50))
            if page < 1 or page_size < 1:
                return {'message': 'Page and page_size must be positive integers'}, 400
        except ValueError:
            return {'message': 'Invalid page or page_size parameter'}, 400

        file_path = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
        if not os.path.exists(file_path):
            return {'message': 'File not found'}, 404

        try:
            macho_file_temp_path, temp_dir = extract_macho_binary_from_ipa(file_path)
            binary = lief.parse(macho_file_temp_path)
            # Get the base address (usually 0x100000000 for iOS apps)
            base_address = binary.imagebase
            print(f"Base Address: {hex(base_address)}")

            # Get functions and their addresses
            functions = []
            for func in binary.functions:
                # For iOS binaries, we need to add the base address
                # func.address is the offset from the base
                func_address = base_address + func.address
                functions.append(func_address)

            # Sort functions by address
            functions.sort()

            # Convert to hex strings with '0x' prefix
            hex_functions = [f"0x{func:x}" for func in functions]

            # Best-effort address -> symbol name map from the symbol table so the UI
            # can label function-start addresses instead of showing raw hex. Stripped
            # binaries simply yield fewer names; callers must treat this as optional.
            symbol_map = {}
            try:
                for sym in binary.symbols:
                    try:
                        addr = getattr(sym, 'value', 0)
                        if not addr:
                            continue
                        name = getattr(sym, 'demangled_name', None) or getattr(sym, 'name', None)
                        if name:
                            symbol_map.setdefault(f"0x{addr:x}", name)
                    except Exception:
                        continue
            except Exception:
                symbol_map = {}

            # Pagination
            total_functions = len(hex_functions)
            start = (page - 1) * page_size
            end = start + page_size

            if start >= total_functions:
                return {'message': 'Page number out of range'}, 400

            paginated_functions = hex_functions[start:end]

            # Only ship names for the functions on this page (keep the payload small).
            paginated_symbols = {a: symbol_map[a] for a in paginated_functions if a in symbol_map}

            return jsonify({
                "functions": paginated_functions,
                "symbols": paginated_symbols,  # optional; {address: name}, backward-compatible
                "total": total_functions,
                "page": page,
                "page_size": page_size,
                "total_pages": (total_functions + page_size - 1) // page_size,
                "base_address": hex(base_address)  # Include base address in response
            })
        except Exception as e:
            print(f"Error: {str(e)}")
            return {'message': str(e)}, 500


@ios_namespace.route('/classes/<filename>')
class GetClasses(Resource):
    def get(self, filename):
        file_path = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
        if not os.path.exists(file_path):
            return {'message': 'File not found'}, 404

        try:
            macho_file_temp_path, temp_dir = extract_macho_binary_from_ipa(file_path)

            # Bail out early on FairPlay-encrypted binaries. Obj-C metadata lives
            # in the encrypted region, so icdump/ipsw would walk ciphertext,
            # spew "Can't read ivar.*" endlessly and hang the worker. Cheap check.
            encrypted, encryption_info = macho_encryption_status(macho_file_temp_path)
            if encrypted:
                return {
                    'message': ('Binary is FairPlay-encrypted (cryptid=1). Obj-C class '
                                'metadata cannot be parsed until it is decrypted. Decrypt '
                                'on a jailbroken device (e.g. frida-ios-dump) and re-upload.'),
                    'encrypted': True,
                    'encryption_info': encryption_info,
                    'objc_classes': [],
                    'swift_classes': [],
                }, 409

            parser = MachoParser(Path(macho_file_temp_path))
            binary = parser.get_arm64_slice()
            class_metadata = icdump.objc.parse(macho_file_temp_path)
            class_declarations = class_metadata.to_decl().split('@interface')
            parsed_classes = [parse_class_declaration('@interface' + decl) for decl in class_declarations if decl.strip()]


            # Get Swift classes using ipsw. Bounded by a timeout so a pathological
            # binary can never hang the request/worker indefinitely.
            try:
                swift_classes_output = subprocess.check_output(
                    ['ipsw', 'swift-dump', macho_file_temp_path, '--arch', 'ARM64'],
                    timeout=120).decode(
                    'utf-8').strip().split('\n\n')
                swift_classes = [cls.strip() for cls in swift_classes_output]
            except subprocess.TimeoutExpired:
                print("Error: ipsw swift-dump timed out after 120s; returning Obj-C classes only")
                swift_classes = []
            except Exception as e:
                print(f"Error: {str(e)}")
                swift_classes = []



            #print(parsed_classes)
            print("SWIFT ======================================================")
            print(swift_classes)

            return jsonify({'objc_classes': parsed_classes, 'swift_classes': swift_classes})

        except zipfile.BadZipFile:
            return {'message': 'Invalid ZIP file'}, 400
        except FileNotFoundError:
            return {'message': 'File not found after extraction'}, 404
        except ValueError as e:
            return {'message': str(e)}, 500
        except Exception as e:
            print(f"Error: {str(e)}")
            return {'message': str(e)}, 500



@ios_namespace.route('/strings/<filename>')
class DumpStrings(Resource):
    def get(self, filename):
        file_path = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
        if not os.path.exists(file_path):
            return {'message': 'File not found'}, 404
        try:
            macho_file_temp_path, temp_dir = extract_macho_binary_from_ipa(file_path)
            parser = MachoParser(Path(macho_file_temp_path))
            binary = parser.get_arm64_slice()
            strings_section = binary.get_cstring_section()
            if not strings_section:
                return
            strings_content = binary.get_bytes(strings_section.offset, strings_section.size)
            strings = strings_content.decode('utf-8', errors='ignore').split('\x00')
            strings = [s for s in strings if s]
            # Remove empty strings and null strings and duplicates from the strings list
            strings = list(set(strings))

            # remove duplicates
            strings = list(dict.fromkeys(strings))
            # remove empty strings
            strings = [x for x in strings if x]
            # Remove null strings
            strings = [x for x in strings if x != '\x00']

            print(strings)

            # Return the strings as a JSON response
            return jsonify({"strings": strings})

        except zipfile.BadZipFile:
            return {'message': 'Invalid ZIP file'}, 400
        except FileNotFoundError:
            return {'message': 'File not found after extraction'}, 404
        except ValueError as e:
            return {'message': str(e)}, 500
        except Exception as e:
            print(f"Error: {str(e)}")
            return {'message': str(e)}, 500

@ios_namespace.route('/webviews/<filename>')
class GetWebViews(Resource):
    def get(self, filename):
        file_path = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
        if not os.path.exists(file_path):
            return {'message': 'File not found'}, 404
        try:
            pass
            # We want to whatever UIApp.keyWindows.recursiveDescription().toString would return?
            #
        except zipfile.BadZipFile:
            return {'message': 'Invalid ZIP file'}, 400
        except FileNotFoundError:
            return {'message': 'File not found after extraction'}, 404
        except ValueError as e:
            return {'message': str(e)}, 500

        except Exception as e:
            print(f"Error: {str(e)}")
            return {'message': str(e)}, 500



@ios_namespace.route('/binary_analysis/<filename>')
class GetBinaryAnalysis(Resource):
    def get(self, filename):
        MMAP_ENABLED = False
        file_path = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
        if not os.path.exists(file_path):
            return {'message': 'File not found'}, 404

        try:
            macho_file_temp_path, temp_dir = extract_macho_binary_from_ipa(file_path)
            # We need to load the file as BytesIO object to pass it to the MachoFile object

            # Open as Byte Object and pass it to the MachoFile object
            with open(macho_file_temp_path, 'rb') as f:
                image = ktool.load_image(f, False, load_symtab=False, load_imports=False, load_exports=False,use_mmaped_io=MMAP_ENABLED)
                flags = {", ".join([i.name for i in image.macho_header.flags])}
                UUID = {image.uuid.hex().upper()}
                r_path = {image.rpath}
                Platform = {image.platform}
                print(f"Flags: {flags}")
                print(f"UUID: {UUID}")
                print(f"Rpath: {r_path}")
                print(f"Platform: {Platform}")










        except zipfile.BadZipFile:
            return {'message': 'Invalid ZIP file'}, 400
        except FileNotFoundError:
            return {'message': 'File not found after extraction'}, 404
        except ValueError as e:
            return {'message': str(e)}, 500
        except Exception as e:
            print(f"Error: {str(e)}")
            return {'message': str(e)}, 500


@ios_namespace.route('/info/<filename>')
class GetInfo(Resource):
    def get(self, filename):
        MMAP_ENABLED = False
        file_path = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
        if not os.path.exists(file_path):
            return {'message': 'File not found'}, 404

        try:
            macho_file_temp_path, temp_dir = extract_macho_binary_from_ipa(file_path)
            parser = MachoParser(Path(macho_file_temp_path))
            binary_64 = parser.get_arm64_slice()
            ARCH_TYPE = CPU_TYPE(binary_64.cpu_type).name
            signing_identity = binary_64.get_signing_identity()
            team_id = binary_64.get_team_id()
            vbase = hex(binary_64.get_virtual_base())
            framework_name, v_addr = print_load_binary_info(binary_64)
            is_swp = binary_64.is_swap

            # # Checksec the binary for security features
            # try:
            #     checksec_output = subprocess.check_output(['/tooling/checksec.rs/target/release/checksec', '-f', macho_file_temp_path]).decode('utf-8').strip()
            #     checksec = parse_checksec_output(checksec_output)
            # except Exception as e:
            #     print(f"Error: {str(e)}")
            #     checksec_output = "Error: checksec.rs not found"
            #
            #
            # checksec_array = {
            #     "ARC": checksec['ARC'],
            #     "Encrypted": checksec['Encrypted'],
            #     "PIE": checksec['PIE'],
            #     "Canary": checksec['Canary'],
            # }
            #
            # print(checksec_array)
            info = {
                "Filename": filename,
                "Architecture": ARCH_TYPE,
                "Virtual Base": vbase,
                "Virtual Address": hex(v_addr),
                "Signing Identity": signing_identity,
                "Endianness": is_swp,
                "Team ID": team_id
            }


            #######
            # Lief Parsing - This allows us to parse things even if its encrypted.

            binary = lief.parse(macho_file_temp_path)
            encryption_info = []
            crypt_id = 0
            for command in binary.commands:
                try:
                    if (command.command == lief.MachO.LoadCommand.TYPE.ENCRYPTION_INFO_64
                            or command.command == lief.MachO.LoadCommand.TYPE.ENCRYPTION_INFO):
                        encryption_info.append({
                            "cryptsize": command.crypt_size,
                            "cryptid": command.crypt_id,
                            "crypt_offset": command.crypt_offset,
                            "size": command.size

                        })
                except Exception as e:
                    print(f"Error: {str(e)}")
                    encryption_info = []


        

            ####


                # image = ktool.load_image(f, 0, load_imports=False, load_exports=False, use_mmaped_io=MMAP_ENABLED)
                # macho_header = ktool.MachOImageHeader.from_image(image)
                # LC_ENCRYPTION_INFO = 0x21
                #
                # for command in macho_header.load_commands:
                #     if command.cmd == LC_ENCRYPTION_INFO:
                #         encryption_info.append({
                #             "cmd": command.cmd,
                #             "cmdsize": command.cmdsize,
                #             "cryptoff": command.cryptoff,
                #             "cryptsize": command.cryptsize,
                #             "cryptid": command.cryptid
                #         })
                with open(macho_file_temp_path, 'rb') as f:
                    data = f.read()
                    sha1 = hashlib.sha1(data).hexdigest()
                    sha256 = hashlib.sha256(data).hexdigest()
                    md5 = hashlib.md5(data).hexdigest()
                    bin_size = os.path.getsize(macho_file_temp_path)

            file_info = {
                "SHA1": sha1,
                "SHA256": sha256,
                "MD5": md5,
                "Binary Size": f"{bin_size / (1024 * 1024):.2f} MB"
            }

            segments = []
            for segment in binary_64.segments:
                virtual_loc = f"[{segment.vmaddr:#011x} - {segment.vmaddr + segment.vmsize:#011x}]"
                file_loc = f"[{segment.offset:#011x} - {segment.offset + segment.size:#011x}]"
                segments.append(f"{virtual_loc} (file {file_loc}) {segment.name}")

            load_cmd = []
            for linked_dylib in binary_64.linked_dylibs:
                load_cmd.append(f"{linked_dylib.name} {hex(linked_dylib.current_version)}")

            sections = []
            for section in binary_64.sections:
                sections.append(
                    f"[{hex(section.address)} - {hex(section.end_address)}] {section.name} ({section.segment.name})")

            print("File Info: ", file_info)
            print("Encryption Info: ", encryption_info)

            # We want to check the cryptid value to see if the binary is encrypted or not and return that as a response

            

            # Extract deep links / universal links / URL schemes
            links = extract_deep_links(file_path, macho_file_temp_path)

            return jsonify({"info": info, "file_info": file_info, "segments": segments, "load_commands": load_cmd,
                            "sections": sections, "encryption_info": encryption_info, "links": links})

        except zipfile.BadZipFile:
            return {'message': 'Invalid ZIP file'}, 400
        except FileNotFoundError:
            return {'message': 'File not found after extraction'}, 404
        except ValueError as e:
            return {'message': str(e)}, 500
        except Exception as e:
            print(f"Error: {str(e)}")
            return {'message': str(e)}, 500


###################################################################################################
#####
# Entitlements Route
@ios_namespace.route('/entitlements/<filename>')
class GetEntitlements(Resource):
    def get(self, filename):
        file_path = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
        if not os.path.exists(file_path):
            return {'message': 'File not found'}, 404

        try:
            macho_file_temp_path, temp_dir = extract_macho_binary_from_ipa(file_path)
            entitlements = get_macho_entitlements(macho_file_temp_path)

            # Jsonify the entitlements and return them
            response = jsonify({"entitlements": entitlements})
            if temp_dir:
                os.remove(macho_file_temp_path)
                os.rmdir(temp_dir)
            return response
        except zipfile.BadZipFile:
            return {'message': 'Invalid ZIP file'}, 400
        except FileNotFoundError:
            return {'message': 'File not found after extraction'}, 404
        except ValueError as e:
            return {'message': str(e)}, 500
        except Exception as e:
            print(f"Error: {str(e)}")
            return {'message': str(e)}, 500


@ios_namespace.route('/permissions/<filename>')
class GetIOSPermissions(Resource):
    IOS_Permissions = [
        "NSBluetoothAlwaysUsageDescription",
        "NSBluetoothPeripheralUsageDescription",
        "NSCalendarsFullAccessUsageDescription",
        "NSCalendarsWriteOnlyAccessUsageDescription",
        "NSRemindersFullAccessUsageDescription",
        "NSCameraUsageDescription",
        "NSMicrophoneUsageDescription",
        "NSContactsUsageDescription",
        "NSFaceIDUsageDescription",
        "NSDesktopFolderUsageDescription",
        "NSDocumentsFolderUsageDescription",
        "NSDownloadsFolderUsageDescription",
        "NSNetworkVolumesUsageDescription",
        "NSRemovableVolumesUsageDescription",
        "NSFileProviderDomainUsageDescription",
        "NSGKFriendListUsageDescription",
        "NSHealthClinicalHealthRecordsShareUsageDescription",
        "NSHealthShareUsageDescription",
        "NSHealthUpdateUsageDescription",
        "NSHomeKitUsageDescription",
        "NSLocationAlwaysAndWhenInUseUsageDescription",
        "NSLocationUsageDescription",
        "NSLocationWhenInUseUsageDescription",
        "NSLocationAlwaysUsageDescription",
        "NSAppleMusicUsageDescription",
        "NSMotionUsageDescription",
        "NSFallDetectionUsageDescription",
        "NSLocalNetworkUsageDescription",
        "NSNearbyInteractionUsageDescription",
        "NSNearbyInteractionAllowOnceUsageDescription",
        "NFCReaderUsageDescription",
        "NSPhotoLibraryAddUsageDescription",
        "NSPhotoLibraryUsageDescription",
        "NSAppDataUsageDescription",
        "NSUserTrackingUsageDescription",
        "NSAppleEventsUsageDescription",
        "NSSystemAdministrationUsageDescription",
        "NSSensorKitUsageDescription",
        "NSSiriUsageDescription",
        "NSSpeechRecognitionUsageDescription",
        "NSVideoSubscriberAccountUsageDescription",
        "NSWorldSensingUsageDescription",
        "NSHandsTrackingUsageDescription",
        "NSIdentityUsageDescription",
        "NSCalendarsUsageDescription",
        "NSRemindersUsageDescription",
    ]

    def get(self, filename):
        file_path = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
        if not os.path.exists(file_path):
            return {'message': 'File not found'}, 404
        try:
            with zipfile.ZipFile(file_path, 'r') as ipa:
                # Look for the main Info.plist file in the Payload/<appname>.app directory
                plist_file_path = next(
                    (name for name in ipa.namelist()
                     if name.endswith('Info.plist') and
                     name.count('/') == 2 and 'Payload/' in name and '.app/' in name),
                    None)

                if plist_file_path is None:
                    return {'message': 'Info.plist not found'}, 404

                with ipa.open(plist_file_path) as plist_file:
                    plist = plistlib.load(plist_file)

            permissions = {key: plist.get(key, 'N/A') for key in self.IOS_Permissions if key in plist}
            return jsonify(permissions)
        except Exception as e:
            print(f"Error: {str(e)}")
            return {'message': str(e)}, 500


@ios_namespace.route('/plist/<filename>')
class GetPlist(Resource):
    def get(self, filename):
        file_path = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
        if not os.path.exists(file_path):
            return {'message': 'File not found'}, 404

        try:
            import re

            with zipfile.ZipFile(file_path, 'r') as ipa:
                # Use regex to find the main app's Info.plist file
                # Pattern matches: Payload/AppName.app/Info.plist exactly (no additional directories)
                main_info_pattern = re.compile(r'^Payload/[^/]+\.app/Info\.plist$')

                main_info_plist = next(
                    (name for name in ipa.namelist()
                     if main_info_pattern.match(name)),
                    None
                )

                if main_info_plist is None:
                    return {'message': 'Main Info.plist not found'}, 404

                with ipa.open(main_info_plist) as plist_file:
                    plist = plistlib.load(plist_file)
                    print(f"Processing Main App Info.plist: {main_info_plist}")

            # Return in the expected format for the frontend
            return jsonify({"plist": plist})

        except Exception as e:
            print(f"Error processing Info.plist: {str(e)}")
            return {'message': str(e)}, 500

@ios_namespace.route('/details/<filename>')
class GetIOSDetails(Resource):
    def get(self, filename):
        file_path = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
        if not os.path.exists(file_path):
            return {'message': 'File not found'}, 404

        try:
            with zipfile.ZipFile(file_path, 'r') as ipa:
                # Look for the main Info.plist file in the Payload/<appname>.app directory
                plist_file_path = next(
                    (name for name in ipa.namelist()
                     if name.endswith('Info.plist') and
                     name.count('/') == 2 and 'Payload/' in name and '.app/' in name),
                    None)

                if plist_file_path is None:
                    return {'message': 'Info.plist not found'}, 404

                with ipa.open(plist_file_path) as plist_file:
                    plist = plistlib.load(plist_file)

            details = {
                "CFBundleSupportedPlatforms": plist.get('CFBundleSupportedPlatforms', []),
                "CFBundleIdentifier": plist.get('CFBundleIdentifier', 'N/A'),
                "CFBundleName": plist.get('CFBundleName', 'N/A'),
                "MinimumOSVersion": plist.get('MinimumOSVersion', 'N/A'),
                "CFBundleShortVersionString": plist.get('CFBundleShortVersionString', 'N/A'),
                "CFBundleVersion": plist.get('CFBundleVersion', 'N/A')
            }
            # Get the Team Signing Identity
            macho_file_temp_path, temp_dir = extract_macho_binary_from_ipa(file_path)
            parser = MachoParser(Path(macho_file_temp_path))
            binary = parser.get_arm64_slice()
            team_signing_identity = binary.get_team_id()
            add_ios_info(details['CFBundleName'], details['CFBundleIdentifier'], details['MinimumOSVersion'],
                         developer=team_signing_identity)

            # Record binary identity (hash -> app/version) for the xref index and
            # future version diffing. The slice is already extracted above.
            try:
                import hashlib
                from project import db
                from sqlalchemy import text
                h = hashlib.sha256()
                with open(macho_file_temp_path, 'rb') as _bf:
                    for _chunk in iter(lambda: _bf.read(1024 * 1024), b''):
                        h.update(_chunk)
                db.session.execute(text("""
                    INSERT INTO ios_binary (binary_hash, filename, app_id, version, build)
                    VALUES (:h, :f, :app_id, :version, :build)
                    ON CONFLICT (binary_hash) DO UPDATE
                    SET filename = :f, app_id = :app_id, version = :version, build = :build
                """), {
                    'h': h.hexdigest(),
                    'f': filename,
                    'app_id': details['CFBundleIdentifier'],
                    'version': details['CFBundleShortVersionString'],
                    'build': details['CFBundleVersion'],
                })
                db.session.commit()
            except Exception as _e:
                print(f"Warning: could not record ios_binary identity: {_e}")

            return jsonify(details)
        except Exception as e:
            print(f"Error: {str(e)}")  # Debug statement
            return {'message': str(e)}, 500


# ─────────────────────────────────────────────────────────────────────────────
# iOS cross-reference index — status / lazy-build / query.
# See Xref_Index_Redesign.md. Keyed by binary_hash; resolved from ios_binary
# (populated at ingest) or computed on demand.
# ─────────────────────────────────────────────────────────────────────────────

def _resolve_binary_hash(filename):
    """Get the binary's content hash from ios_binary, or compute + record it."""
    from project import db
    from sqlalchemy import text
    row = db.session.execute(
        text("SELECT binary_hash FROM ios_binary WHERE filename = :f "
             "ORDER BY uploaded_at DESC LIMIT 1"),
        {'f': filename},
    ).fetchone()
    if row:
        return row[0]
    from project.api.disas import sha256_of_macho_slice
    binary_hash = sha256_of_macho_slice(filename)
    db.session.execute(
        text("INSERT INTO ios_binary (binary_hash, filename) VALUES (:h, :f) "
             "ON CONFLICT (binary_hash) DO NOTHING"),
        {'h': binary_hash, 'f': filename},
    )
    db.session.commit()
    return binary_hash


@ios_namespace.route('/xrefs/<filename>/status')
class XrefIndexStatus(Resource):
    def get(self, filename):
        from project import db
        from sqlalchemy import text
        from project.api.tasks.tasks import build_ios_xref_index_task
        try:
            binary_hash = _resolve_binary_hash(filename)
            row = db.session.execute(
                text("SELECT state, total_refs, built_at FROM ios_xref_status WHERE binary_hash = :h"),
                {'h': binary_hash},
            ).fetchone()
            if not row:
                build_ios_xref_index_task.delay(binary_hash, filename)
                return {'state': 'BUILDING', 'total_refs': 0}, 202
            return {'state': row[0], 'total_refs': row[1],
                    'built_at': str(row[2]) if row[2] else None}
        except Exception as e:
            return {'message': str(e)}, 500


@ios_namespace.route('/xrefs/<filename>/rebuild')
class XrefIndexRebuild(Resource):
    def post(self, filename):
        from project.api.tasks.tasks import build_ios_xref_index_task
        try:
            binary_hash = _resolve_binary_hash(filename)
            build_ios_xref_index_task.delay(binary_hash, filename)
            return {'state': 'BUILDING'}, 202
        except Exception as e:
            return {'message': str(e)}, 500


@ios_namespace.route('/xrefs/<filename>/msgsend/<path:selector>')
class XrefMsgSend(Resource):
    def get(self, filename, selector):
        from project import db
        from sqlalchemy import text
        from project.api.tasks.tasks import build_ios_xref_index_task
        try:
            binary_hash = _resolve_binary_hash(filename)
            status = db.session.execute(
                text("SELECT state FROM ios_xref_status WHERE binary_hash = :h"),
                {'h': binary_hash},
            ).fetchone()
            if not status:
                build_ios_xref_index_task.delay(binary_hash, filename)
                return {'ready': False, 'state': 'BUILDING'}, 202
            if status[0] != 'READY':
                return {'ready': False, 'state': status[0]}, 202

            rows = db.session.execute(text("""
                SELECT caller_addr, caller_func_start, caller_func_name, receiver_class
                FROM ios_xref_index
                WHERE binary_hash = :h AND kind = 'msgsend' AND target = :t
                ORDER BY caller_func_start, caller_addr
            """), {'h': binary_hash, 't': selector}).fetchall()

            xrefs = [{
                'caller_addr': hex(r[0]),
                'caller_func_start_address': hex(r[1]),
                'caller_func_name': r[2],
                'receiver_class': r[3],
            } for r in rows]
            return {'ready': True, 'count': len(xrefs), 'xrefs': xrefs}
        except Exception as e:
            return {'message': str(e)}, 500


@ios_namespace.route('/pseudocode/<filename>/<address>')
class Pseudocode(Resource):
    """Decompile one function to C pseudocode (r2ghidra + selector map). Cached in
    ios_pseudocode; decompile is fast per function so it's done inline on a miss."""

    def get(self, filename, address):
        from project import db
        from sqlalchemy import text
        try:
            func_start = int(address, 16) if isinstance(address, str) else int(address)
        except (ValueError, TypeError):
            return {'message': f'Invalid address: {address}'}, 400

        try:
            binary_hash = _resolve_binary_hash(filename)
            row = db.session.execute(text(
                "SELECT code FROM ios_pseudocode WHERE binary_hash = :h AND func_start = :a"
            ), {'h': binary_hash, 'a': func_start}).fetchone()
            if row and row[0]:
                return {'ready': True, 'cached': True, 'code': row[0]}

            from project.api.iOS.pseudocode import decompile_function
            code = decompile_function(filename, func_start)
            if not code or not code.strip():
                return {'ready': False, 'message': 'Decompiler produced no output for this address.'}

            db.session.execute(text(
                "INSERT INTO ios_pseudocode (binary_hash, func_start, code) VALUES (:h, :a, :c) "
                "ON CONFLICT (binary_hash, func_start) DO UPDATE SET code = :c, built_at = now()"
            ), {'h': binary_hash, 'a': func_start, 'c': code})
            db.session.commit()
            return {'ready': True, 'cached': False, 'code': code}
        except Exception as e:
            return {'message': str(e)}, 500
