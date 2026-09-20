"""Parsing / analysis helpers for the audit endpoints."""
from functools import lru_cache

from project.api.audit._shared import *  # noqa: F401,F403  (re-export shared surface)
from project.api.audit.artifacts import (
    ArtifactError, ArtifactConflict, artifact_path, apk_identity, unique_record,
)


UNKNOWN_COMPONENT_STATUS = {
    "type": "UNKNOWN",
    "exported": None,
    "accessible": None,
    "has_intent_filters": None,
}







def pretty_print_xml(element):
    """Convert an XML element to a pretty-printed string with proper indentation."""
    try:
        # Convert to bytes first, then decode - lxml expects bytes encoding
        xml_bytes = etree.tostring(element, pretty_print=True, method='xml', encoding='UTF-8')
        xml_string = xml_bytes.decode('utf-8')
        # Remove the XML declaration if present
        lines = [line for line in xml_string.split('\n') if line.strip() and not line.strip().startswith('<?xml')]
        return '\n'.join(lines)
    except Exception as e:
        logger.warning(f"Error pretty-printing XML: {e}")
        # Fallback to regular tostring without pretty printing
        try:
            xml_bytes = etree.tostring(element, method='xml', encoding='UTF-8')
            return xml_bytes.decode('utf-8')
        except Exception as e2:
            logger.error(f"Fallback also failed: {e2}")
            # Last resort - return empty string to avoid database error
            return ""


def extract_outer_class(class_name):
    """
    Extract the outer/parent class name from an inner class name.

    Java inner classes use $ notation, e.g.:
    - com.android.settings.ActivityPicker$PickAdapter$Item -> com.android.settings.ActivityPicker
    - com.example.MainActivity$1 -> com.example.MainActivity
    - com.example.MainActivity -> com.example.MainActivity (no change if no inner class)

    Args:
        class_name: Full class name potentially containing inner class notation

    Returns:
        The outer class name with inner class parts stripped
    """
    if not class_name or '$' not in class_name:
        return class_name

    # Split on $ and return just the first part (the outer class)
    return class_name.split('$')[0]


def extract_libraries(file_path):
    apk = APK(file_path)
    assets = apk.get_files()
    x86_64 = []
    x86 = []
    armeabi_v7a = []
    arm64_v8a = []
    for entry in assets:
        if 'lib/x86_64/' in entry:
            x86_64.append(entry)
        elif 'lib/x86/' in entry:
            x86.append(entry)
        elif 'lib/armeabi-v7a/' in entry:
            armeabi_v7a.append(entry)
        elif 'lib/arm64-v8a/' in entry:
            arm64_v8a.append(entry)

    return x86_64, x86, armeabi_v7a, arm64_v8a


# Classes Parsing and Extraction


def parse_classes(file_path):
    """
    Use the Androguard Analysis class to obtain and parse the classes
    :param file_path: Path to the APK file
    :return: List of classes
    """

    apk = APK(file_path)
    analysis = Analysis(apk)
    classes = analysis.get_classes()
    print(f"Classes: {classes}")
    return classes


###


def extract_schemes(file_path):
    """
    Detect and find all  the schemes from the APK file
    :param file_path: Path to the APK file
    :return: List of schemes
    """
    apk = APK(file_path)
    manifest = apk.get_android_manifest_xml()
    namespace = {'android': 'http://schemas.android.com/apk/res/android'}
    schemes = []
    for data in manifest.findall(".//data"):
        scheme = data.get(f"{{{namespace['android']}}}scheme")
        if scheme:
            schemes.append(scheme)
    return schemes


def get_apk_package_name(file_path: str) -> Optional[str]:
    """Extract package name from APK file safely."""
    try:
        apk_file = pyAPK(file_path)
        return apk_file.package
    except Exception as e:
        logger.warning(f"Failed to extract package name from {file_path}: {e}")
        return None


def _apk_file_fingerprint(file_path):
    file_stat = os.stat(file_path)
    return (file_stat.st_dev, file_stat.st_ino, file_stat.st_size,
            file_stat.st_mtime_ns, file_stat.st_ctime_ns)


@lru_cache(maxsize=256)
def _cached_apk_identity(file_path, fingerprint):
    """Cache immutable metadata only, never APK instances or database rows."""
    identity = apk_identity(APK(file_path))
    if _apk_file_fingerprint(file_path) != fingerprint:
        # Exceptions are not cached, so a concurrent file update can be retried.
        raise ArtifactError('Unable to read APK identity')
    return identity


def _read_apk_identity(file_path):
    # Include file identity and timestamps so replacement and in-place changes
    # invalidate cached metadata, even when a filename is reused.
    file_path = os.path.normcase(os.path.abspath(file_path))
    fingerprint = _apk_file_fingerprint(file_path)
    identity = _cached_apk_identity(file_path, fingerprint)
    if _apk_file_fingerprint(file_path) != fingerprint:
        raise ArtifactError('Unable to read APK identity')
    return identity


def find_android_info(identifier: str, skip_apk_analysis: bool = False) -> Optional[AndroidInfo]:
    """Resolve an uploaded APK by package AND version, without fuzzy fallback.

    The legacy skip flag remains accepted, but cannot skip identity checks for
    an existing artifact. Bare package/display names must identify one row.
    """
    if not identifier:
        return None
    candidates = [identifier] if identifier.lower().endswith('.apk') else [f'{identifier}.apk']
    for filename in candidates:
        file_path = artifact_path(UPLOAD_FOLDER, filename)
        if os.path.isfile(file_path):
            try:
                package, version = _read_apk_identity(file_path)
            except ArtifactError:
                raise
            except Exception as exc:
                raise ArtifactError('Unable to read APK identity') from exc
            return unique_record(AndroidInfo.query.filter_by(
                package_name=package, version=version).limit(2).all())
    if identifier.lower().endswith('.apk'):
        return None
    return unique_record(AndroidInfo.query.filter(or_(
        AndroidInfo.package_name == identifier,
        AndroidInfo.app_name == identifier,
    )).limit(2).all())


def find_component_directly(component_name):
    """
    Search across ALL apps in the DB for a component matching component_name.
    Used as a last-resort fallback when the owning AndroidInfo can't be identified.
    Returns a status dict or None.
    """
    if not component_name:
        return None

    outer_name = component_name.split('$')[0] if '$' in component_name else component_name
    candidates = list({component_name, outer_name})  # deduplicate

    activity = AndroidActivity.query.filter(
        AndroidActivity.activity_name.in_(candidates)
    ).first()
    if activity:
        has_intent_filters = len(activity.intent_filters) > 0
        return {
            "type": "activity",
            "exported": activity.activity_exported,
            "accessible": is_component_accessible(activity.activity_exported, has_intent_filters),
            "has_intent_filters": has_intent_filters,
        }

    service = AndroidService.query.filter(
        AndroidService.service_name.in_(candidates)
    ).first()
    if service:
        has_intent_filters = (len(service.actions) > 0 or len(service.categories) > 0 or len(service.schemes) > 0)
        return {
            "type": "service",
            "exported": service.service_exported,
            "accessible": is_component_accessible(service.service_exported, has_intent_filters),
            "has_intent_filters": has_intent_filters,
        }

    receiver = AndroidReceiver.query.filter(
        AndroidReceiver.receiver_name.in_(candidates)
    ).first()
    if receiver:
        has_intent_filters = (len(receiver.actions) > 0 or len(receiver.categories) > 0)
        return {
            "type": "receiver",
            "exported": receiver.receiver_exported,
            "accessible": is_component_accessible(receiver.receiver_exported, has_intent_filters),
            "has_intent_filters": has_intent_filters,
        }

    provider = AndroidProvider.query.filter(
        AndroidProvider.provider_name.in_(candidates)
    ).first()
    if provider:
        permission_gated = bool(provider.provider_permission or provider.read_permission or provider.write_permission)
        return {
            "type": "provider",
            "exported": provider.provider_exported,
            "accessible": bool(provider.provider_exported) and not permission_gated,
            "has_intent_filters": False,
        }

    return None


def detect_framework(file_path):
    """
    Detect the framework used in the APK
    :param file_path: Path to the APK file
    :return: Tuple of (Framework used, Icon identifier)
    """
    apk = APK(file_path)
    assets = apk.get_files()
    for entry in assets:
        print(f"Entry: {entry}")
        if 'index.android.bundle' in entry:
            return 'React Native', 'mdi-react'
        elif fnmatch.fnmatch(entry, '*cordova*.js') or ('www/index.html' in assets and 'www/js/index.js' in assets):
            return 'Ionic Cordova', 'mdi-ionic'
        elif fnmatch.fnmatch(entry, '*libflutter.so'):
            for fEntry in assets:
                if fnmatch.fnmatch(fEntry, '*libapp.so'):
                    return 'Flutter', 'mdi-flutter'
        elif fnmatch.fnmatch(entry, '*assemblies.manifest'):
            for xEntry in assets:
                if fnmatch.fnmatch(xEntry, '*assemblies.blob'):
                    return 'Xamarin', 'mdi-xamarin'
    return 'Standard Android', 'mdi-android'


def extract_resources(apk, resid):
    try:
        res_value = apk.get_res_value(resid)
        if res_value:
            file = apk.get_file(res_value)
            xml_printer = AXMLPrinter(file)
            xml_string = xml_printer.get_xml()
            return xml_string
    except Exception as e:
        print(f"Error extracting resource {resid}: {e}")
        return None


def get_android_resources(APK_PATH, resource):
    """
    Get the Android resources from the APK
    :param apk: APK object
    :return: Android resources
    """
    print("PATH: ", APK_PATH)
    print("RESOURCE: ", resource)
    a = APK(APK_PATH)
    r = a.get_android_resources()
    location = int(resource, 16)
    print("LOCATION: ", location)


# Bulk upload of APKs


def _provider_item(p):
    return {
        "name": p.provider_name,
        "exported": p.provider_exported,
        "grantUriPermissions": p.grant_uri_permissions,
        "authorities": p.authorities,
        "readPermission": p.read_permission,
        "writePermission": p.write_permission,
        "manifestSnippet": p.manifest_snippet,
        "metaData": {"resource": p.provider_permission, "content": ""},
    }


def _service_item(s):
    return {
        "name": s.service_name,
        "exported": s.service_exported,
        "permission": s.service_permission,
        "manifestSnippet": s.manifest_snippet,
        "intentFilters": [
            {
                "actions": [a.action for a in s.actions],
                "categories": [c.category for c in s.categories],
                "schemes": [sc.scheme for sc in s.schemes],
            }
        ],
    }


def _activity_item(a):
    return {
        "name": a.activity_name,
        "exported": a.activity_exported,
        "manifestSnippet": a.manifest_snippet,
        # NOTE: preserves the pre-refactor behavior of emitting one (identical)
        # filter block per intent_filter row rather than per distinct filter.
        "intentFilters": [
            {
                "actions": [ac.action for ac in a.actions],
                "categories": [c.category for c in a.categories],
                "schemes": [sc.scheme for sc in a.schemes],
                "host": [sc.host for sc in a.schemes],
            }
            for _intent_filter in a.intent_filters
        ],
    }


def _receiver_item(r):
    return {
        "name": r.receiver_name,
        "exported": r.receiver_exported,
        "permission": r.receiver_permission,
        "manifestSnippet": r.manifest_snippet,
        "intentFilters": [
            {
                "actions": [a.action for a in r.actions],
                "categories": [c.category for c in r.categories],
            }
        ],
    }


def _component_response(identifier, model, options, exported_attr, name_attr,
                        build_item, extra_key, extra_value, label):
    """Shared handler for the manifest-component endpoints.

    Resolves the app, loads its components of `model`, splits them into
    exported/non-exported, and assembles a consistent response. `build_item`
    produces the per-component dict; `extra_key`/`extra_value` add the endpoint's
    third map (providers keep the full item; the rest map name -> intentFilters).
    """
    try:
        android_info = find_android_info(identifier)
    except ArtifactError as exc:
        return {'message': str(exc)}, exc.status_code
    if not android_info:
        return {'message': f'App not found for identifier: {identifier}'}, 404

    query = model.query.filter_by(android_info_id=android_info.id)
    if options:
        query = query.options(*options)
    components = query.all()
    if not components:
        return {'message': f'No {label} found. The app may need to be processed first.'}, 404

    exported = []
    non_exported = []
    extra = {}
    for obj in components:
        data = build_item(obj)
        if getattr(obj, exported_attr):
            exported.append(data)
        else:
            non_exported.append(data)
        extra[getattr(obj, name_attr)] = extra_value(data)

    return {"exported": exported, "non_exported": non_exported, extra_key: extra}


def extract_exported_from_apk(apk_path, component_name):
    """Extract exported status directly from APK manifest if not in database."""
    try:
        from androguard.core.apk import APK
        apk = APK(apk_path)
        manifest = apk.get_android_manifest_xml()

        # Search for the component in manifest
        for tag_name in ['activity', 'service', 'receiver', 'provider']:
            for element in manifest.findall(f".//{tag_name}"):
                name_attr = element.get('{http://schemas.android.com/apk/res/android}name')
                if name_attr:
                    # Handle both full names and short names (starting with .)
                    full_name = name_attr if '.' in name_attr else f"{apk.get_package()}{name_attr}"
                    if full_name == component_name:
                        exported_state = parse_exported_attr(
                            element.get('{http://schemas.android.com/apk/res/android}exported')
                        )
                        has_intent_filters = len(element.findall('.//intent-filter')) > 0

                        return {
                            "type": tag_name,
                            "exported": exported_state,
                            "accessible": is_component_accessible(exported_state, has_intent_filters),
                            "has_intent_filters": has_intent_filters,
                            "source": "manifest_direct"
                        }
        return None
    except Exception as e:
        print(f"Error extracting from APK manifest: {e}")
        return None


# Canonical UNKNOWN status: don't lie with False; unknown is unknown.
