from flask import request
from flask_restx import Resource, fields, Namespace
from flask import jsonify
from flask_restx import Resource
from project.api.database.services import (
    handle_db_error,
    get_android_info_by_package,
    get_all_ios_info,
    get_all_android_info
)

from project.api.database.models import AndroidInfo, AndroidActivity
from project.api.database.services import get_appshark_issues, get_activity_status, get_app_secrets_by_package, bulk_add_app_secrets
from project.api.database.services import AndroidService
database_namespace = Namespace("database", description="Levaithan Database Operations")

@database_namespace.route("/appshark-issues/<string:package_name>")
class AppSharkIssues(Resource):
    def get(self, package_name):
        issues = get_appshark_issues(package_name)
        if issues is None:
            return {"message": "No scan results found or an error occurred"}, 404
        return jsonify(issues)


import re as _re
from project.api.database.models import AndroidReceiver, AndroidProvider


def _decode_protection_label(raw):
    """Human label for android:protectionLevel (hex or named). Also returns whether a
    third-party (differently-signed) app can hold it."""
    if not raw:
        return 'normal', True
    v = str(raw).strip().lower()
    if v.startswith('0x') or v.isdigit():
        try:
            n = int(v, 16) if v.startswith('0x') else int(v)
        except ValueError:
            return v, True
        base = {0: 'normal', 1: 'dangerous', 2: 'signature', 3: 'signatureOrSystem', 4: 'internal'}.get(n & 0x0f, 'normal')
        flags = []
        if n & 0x10:
            flags.append('privileged')
        if n & 0x40000:
            flags.append('oem')
        if n & 0x80000:
            flags.append('vendorPrivileged')
        label = base + ('|' + '|'.join(flags) if flags else '')
        holdable = (n & 0x0f) <= 1 and not flags
        return label, holdable
    holdable = not any(tok in v for tok in ('signature', 'system', 'privileged', 'internal'))
    return v, holdable


def _declared_permissions(manifest_xml):
    """{permission_name: raw_protectionLevel} declared in this app's manifest."""
    out = {}
    for tag in _re.findall(r'<permission\b[^>]*>', manifest_xml or ''):
        name_m = _re.search(r'android:name="([^"]+)"', tag)
        if not name_m:
            continue
        lvl_m = _re.search(r'android:protectionLevel="([^"]+)"', tag)
        out[name_m.group(1)] = lvl_m.group(1) if lvl_m else 'normal'
    return out


@database_namespace.route("/permissions-map")
class PermissionsMap(Resource):
    """Cross-app permission map for chain hunting: for each permission, which scanned
    apps DECLARE it, which apps REQUIRE it (via a component's android:permission), its
    protectionLevel, and how many components it gates. App/OEM independent — derived
    purely from each scanned app's manifest."""
    def get(self):
        apps = get_all_android_info() or []
        perms = {}  # name -> aggregate

        def slot(name):
            return perms.setdefault(name, {
                'name': name,
                'protection_level': None,
                'third_party_holdable': None,
                'declared_by': set(),
                'required_by': {},  # pkg -> {'components': n, 'accessible': n}
            })

        for app in apps:
            pkg = app.package_name
            declared = _declared_permissions(getattr(app, 'manifest_xml', None))
            for name, raw in declared.items():
                s = slot(name)
                s['declared_by'].add(pkg)
                label, holdable = _decode_protection_label(raw)
                s['protection_level'] = label
                s['third_party_holdable'] = holdable

            # component permission requirements
            comp_sets = [
                (app.activities, 'activity_permission', 'activity_exported'),
                (app.services, 'service_permission', 'service_exported'),
                (app.receivers, 'receiver_permission', 'receiver_exported'),
                (app.providers, 'provider_permission', 'provider_exported'),
            ]
            for comps, perm_attr, exp_attr in comp_sets:
                for c in comps:
                    perm = getattr(c, perm_attr, None)
                    if not perm:
                        continue
                    s = slot(perm)
                    rb = s['required_by'].setdefault(pkg, {'components': 0, 'accessible': 0})
                    rb['components'] += 1
                    if getattr(c, exp_attr, None):
                        rb['accessible'] += 1

        result = []
        for name, s in perms.items():
            declared_by = sorted(s['declared_by'])
            required_by = [
                {'app': p, 'components': v['components'], 'accessible': v['accessible']}
                for p, v in sorted(s['required_by'].items())
            ]
            requiring_apps = set(s['required_by'].keys())
            # Chain signal: a non-third-party-holdable permission that spans apps —
            # declared by >1 app, OR required by an app that does not itself declare it
            # (someone else must hold it -> potential cross-app deputy).
            cross_app = len(s['declared_by']) > 1 or bool(requiring_apps - s['declared_by'])
            chainable = cross_app and (s['third_party_holdable'] is False)
            result.append({
                'name': name,
                'protection_level': s['protection_level'] or 'unknown',
                'third_party_holdable': s['third_party_holdable'],
                'declared_by': declared_by,
                'required_by': required_by,
                'component_count': sum(v['components'] for v in s['required_by'].values()),
                'chainable': chainable,
            })
        # chainable first, then most-gated
        result.sort(key=lambda r: (not r['chainable'], -r['component_count']))
        return jsonify({'app_count': len(apps), 'permissions': result})

@database_namespace.route("/activity-status/<string:package_name>/<string:activity_name>")
class ActivityStatus(Resource):
    def get(self, package_name, activity_name):
        result, error = get_activity_status(package_name, activity_name)
        if error:
            return jsonify({'error': error}), 404 if 'not found' in error else 500
        return jsonify(result)


@database_namespace.route("/app-secrets/<string:package_name>")
# First, define your resource class without the route decorator
class AppSecrets(Resource):
    def get(self, package_name):
        """
        Get all saved secrets for a specific app package
        """
        secrets, error = get_app_secrets_by_package(package_name)
        if error:
            return {'error': error}, 404 if 'not found' in error else 500
        return secrets

    def post(self, package_name):
        """
        Save discovered secrets for an app
        """
        data = request.get_json()
        if not data or 'secrets' not in data:
            return {'error': 'Invalid request. Must provide secrets data.'}, 400

        # Get the Android app info
        android_info = get_android_info_by_package(package_name)
        if not android_info:
            return {'error': 'Android app not found'}, 404

        # Transform the data into the expected format
        secrets_to_add = []
        for secret in data['secrets']:
            secrets_to_add.append({
                'file_path': secret.get('file', ''),
                'secret_type': secret.get('type', 'Unknown'),
                'description': secret.get('description', ''),
                'redacted_value': secret.get('redacted_value', secret.get('value', '')),
                'raw_value': secret.get('raw_value', ''),
                'secret_line': secret.get('line'),
                'source_name': secret.get('source_name', ''),
                'source_type': secret.get('source_type', ''),
                'detector_type': str(secret.get('detector_type', '')),
                'decoder_name': secret.get('decoder_name', ''),
                'is_verified': secret.get('verified', False),
                'verification_error': secret.get('verification_error', ''),
                'verification_cached': secret.get('verification_cached', False)
            })

        try:
            # Save all secrets in bulk
            bulk_add_app_secrets(android_info.id, secrets_to_add)
            return {'message': f'Successfully saved {len(secrets_to_add)} secrets for {package_name}'}, 201
        except Exception as e:
            return {'error': f'Failed to save secrets: {str(e)}'}, 500

# Then, explicitly register the resource with the namespace
database_namespace.add_resource(AppSecrets, "/app-secrets/<string:package_name>")
