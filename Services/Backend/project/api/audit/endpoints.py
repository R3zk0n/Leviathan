"""Audit route classes (registered on audit_namespace)."""
from project.api.audit._shared import *  # noqa: F401,F403  (re-export shared surface)
from project.api.audit.parsing import (
    UNKNOWN_COMPONENT_STATUS,
    pretty_print_xml,
    extract_outer_class,
    extract_libraries,
    parse_classes,
    extract_schemes,
    get_apk_package_name,
    find_android_info,
    find_component_directly,
    detect_framework,
    extract_resources,
    get_android_resources,
    _provider_item,
    _service_item,
    _activity_item,
    _receiver_item,
    _component_response,
    extract_exported_from_apk,
)


_apk_package_cache = {}


@audit_namespace.route('/upload/bulk')
class BulkUploadAPK(Resource):
    pass;


########


@audit_namespace.route('/upload')
class UploadAPK(Resource):
    def post(self):
        if 'file' not in request.files:
            return {'message': 'No file part'}, 400
        file = request.files['file']
        if file.filename == '':
            return {'message': 'No selected file'}, 400
        if file:
            filename = secure_filename(file.filename)
            file_path = os.path.join(UPLOAD_FOLDER, filename)
            file.save(file_path)

            file_type = request.args.get('type', 'android').lower()

            print(f"File uploaded: {filename}, Type: {file_type}")
            try:
                if file_type == 'ios':
                    print("iOS file uploaded")
                    return {'message': 'File uploaded and processed', 'filename': filename}, 201
                elif file_type == 'audit':
                    # Process the uploaded APK
                    self.process_apk(file_path, filename)
                    return {'message': 'File uploaded and processed', 'filename': filename}, 201
                else:
                    return {'message': 'Invalid file type'}, 400
            except Exception as e:
                logger.error(f"Error processing uploaded mobile file {filename}: {str(e)}")
                return {'message': f'File uploaded but processing failed: {str(e)}'}, 500

    def process_apk(self, file_path, filename):
        apk = APK(file_path)
        package_name = apk.get_package()
        if package_name is None or package_name.strip() == "":
            # Fall back to filename without extension as package name
            base_filename = os.path.splitext(filename)[0]
            package_name = f"unknown.{base_filename.lower().replace(' ', '_').replace('-', '_')}"
            logger.warning(f"No package name found in APK, using generated name: {package_name}")
        try:
            version = apk.get_androidversion_name()
            # Explicitly handle None or empty string case
            if version is None or version.strip() == "":
                version = "Unknown"
        except Exception as e:
            logger.error(f"Error getting version from APK: {e}")
            version = "Unknown"
        app_name = apk.get_app_name()
        if app_name is None or app_name.strip() == "":
            # Fall back to filename without extension as app name
            app_name = os.path.splitext(filename)[0]
            logger.warning(f"No app name found in APK, using filename: {app_name}")

        logger.info(f"Processing APK - Package Name: {package_name}, Version: {version}, App Name: {app_name}")

        # Parse and extract manifest XML once during upload
        manifest_axml = apk.get_android_manifest_axml()
        manifest_xml = manifest_axml.get_xml().decode('utf-8')

        # Add or update AndroidInfo
        android_info = AndroidInfo.query.filter_by(package_name=package_name, version=version).first()
        if not android_info:
            android_info = AndroidInfo(
                app_name=app_name,
                package_name=package_name,
                version=version,
                developer=None,  # You might want to extract this if available
                release_date=None,  # You might want to extract this if available
                manifest_xml=manifest_xml
            )
            db.session.add(android_info)
            db.session.flush()  # Ensure android_info has an id
        else:
            # Update manifest_xml if the android_info already exists
            android_info.manifest_xml = manifest_xml

        # Add or update APK details
        apk_details = ApkDetails.query.filter_by(android_info_id=android_info.id).first()
        if not apk_details:
            apk_details = ApkDetails(
                android_info_id=android_info.id,
                app_version=version,
                package_name=package_name,
                sdk_version=apk.get_target_sdk_version(),
                debuggable=apk.get_android_manifest_xml().find(".//application").get(
                    "{http://schemas.android.com/apk/res/android}debuggable") == "true",
                main_activity=apk.get_main_activity(),
                # Get the user from the AndroidManifest.xml if it exists
                android_user=apk.get_android_manifest_xml().get(
                    "{http://schemas.android.com/apk/res/android}sharedUserId")
            )
            db.session.add(apk_details)
        else:
            apk_details.app_version = version
            apk_details.package_name = package_name
            apk_details.sdk_version = apk.get_target_sdk_version()
            apk_details.debuggable = apk.get_android_manifest_xml().find(".//application").get(
                "{http://schemas.android.com/apk/res/android}debuggable") == "true"
            apk_details.main_activity = apk.get_main_activity()
            apk_details.android_user = apk.get_android_manifest_xml().get(
                "{http://schemas.android.com/apk/res/android}sharedUserId")

        # Process components
        self.process_activities(apk, android_info)
        self.process_services(apk, android_info)
        self.process_receivers(apk, android_info)
        self.process_providers(apk, android_info)

        print(f"Found sharedUserId: {apk_details.android_user}")
        db.session.commit()

    def process_activities(self, apk, android_info):
        manifest_xml = apk.get_android_manifest_xml()
        namespace = {'android': 'http://schemas.android.com/apk/res/android'}

        for activity in manifest_xml.findall(".//activity"):
            activity_name = activity.get(f"{{{namespace['android']}}}name")
            if activity_name:
                exported = parse_exported_attr(activity.get(f"{{{namespace['android']}}}exported"))
                activity_permission = activity.get(f"{{{namespace['android']}}}permission")

                # Capture the manifest snippet for this activity
                manifest_snippet = pretty_print_xml(activity)

                android_activity = AndroidActivity.query.filter_by(
                    android_info_id=android_info.id,
                    activity_name=activity_name
                ).first()

                if android_activity:
                    android_activity.activity_exported = exported
                    android_activity.activity_permission = activity_permission
                    android_activity.manifest_snippet = manifest_snippet
                else:
                    android_activity = AndroidActivity(
                        android_info_id=android_info.id,
                        activity_name=activity_name,
                        activity_exported=exported,
                        activity_permission=activity_permission,
                        manifest_snippet=manifest_snippet
                    )
                    db.session.add(android_activity)

                db.session.flush()  # Ensure android_activity has an id

                # Clear existing intent filters
                ActivityAction.query.filter_by(activity_id=android_activity.id).delete()
                ActivityCategory.query.filter_by(activity_id=android_activity.id).delete()
                ActivityScheme.query.filter_by(activity_id=android_activity.id).delete()
                ActivityIntentFilter.query.filter_by(activity_id=android_activity.id).delete()

                # Process intent filters
                for intent_filter in activity.findall("intent-filter"):
                    actions = [action.get(f"{{{namespace['android']}}}name") for action in
                               intent_filter.findall("action")]
                    categories = [category.get(f"{{{namespace['android']}}}name") for category in
                                  intent_filter.findall("category")]

                    # Process data tags to get scheme, host, and path
                    data_elements = intent_filter.findall("data")
                    schemes_data = []

                    for data in data_elements:
                        scheme = data.get(f"{{{namespace['android']}}}scheme")
                        host = data.get(f"{{{namespace['android']}}}host")
                        path = data.get(f"{{{namespace['android']}}}path")

                        if scheme:
                            schemes_data.append({
                                'scheme': scheme,
                                'host': host,
                                'path': path
                            })
                            # Add to ActivityScheme table
                            db.session.add(ActivityScheme(
                                activity_id=android_activity.id,
                                scheme=scheme,
                                host=host,
                                path=path
                            ))

                    # Process actions and categories
                    for action in actions:
                        db.session.add(ActivityAction(activity_id=android_activity.id, action=action))
                    for category in categories:
                        db.session.add(ActivityCategory(activity_id=android_activity.id, category=category))

                    # Create formatted strings for the intent filter
                    scheme_strings = []
                    for scheme_data in schemes_data:
                        scheme_str = scheme_data['scheme']
                        if scheme_data['host']:
                            scheme_str += f"://{scheme_data['host']}"
                            if scheme_data['path']:
                                scheme_str += scheme_data['path']
                        scheme_strings.append(scheme_str)

                    db.session.add(ActivityIntentFilter(
                        activity_id=android_activity.id,
                        intent_action=",".join(filter(None, actions)),
                        intent_category=",".join(filter(None, categories)),
                        intent_data_scheme=",".join(filter(None, scheme_strings))
                    ))

    def process_services(self, apk, android_info):
        manifest_xml = apk.get_android_manifest_xml()
        namespace = {'android': 'http://schemas.android.com/apk/res/android'}

        for service in manifest_xml.findall(".//service"):
            service_name = service.get(f"{{{namespace['android']}}}name")
            if service_name:
                exported = parse_exported_attr(service.get(f"{{{namespace['android']}}}exported"))
                service_permission = service.get(f"{{{namespace['android']}}}permission")

                # Capture the manifest snippet for this service
                manifest_snippet = pretty_print_xml(service)

                android_service = AndroidService.query.filter_by(
                    android_info_id=android_info.id,
                    service_name=service_name
                ).first()

                if android_service:
                    android_service.service_exported = exported
                    android_service.service_permission = service_permission
                    android_service.manifest_snippet = manifest_snippet
                else:
                    android_service = AndroidService(
                        android_info_id=android_info.id,
                        service_name=service_name,
                        service_exported=exported,
                        service_permission=service_permission,
                        manifest_snippet=manifest_snippet
                    )
                    db.session.add(android_service)

                db.session.flush()  # Ensure android_service has an id

                # Clear existing intent filters
                ServiceAction.query.filter_by(service_id=android_service.id).delete()
                ServiceCategory.query.filter_by(service_id=android_service.id).delete()
                ServiceScheme.query.filter_by(service_id=android_service.id).delete()

                # Process intent filters
                for intent_filter in service.findall("intent-filter"):
                    actions = [action.get(f"{{{namespace['android']}}}name") for action in
                               intent_filter.findall("action")]
                    categories = [category.get(f"{{{namespace['android']}}}name") for category in
                                  intent_filter.findall("category")]
                    schemes = [data.get(f"{{{namespace['android']}}}scheme") for data in intent_filter.findall("data")]

                    for action in actions:
                        db.session.add(ServiceAction(service_id=android_service.id, action=action))
                    for category in categories:
                        db.session.add(ServiceCategory(service_id=android_service.id, category=category))
                    for scheme in schemes:
                        if scheme:
                            db.session.add(ServiceScheme(service_id=android_service.id, scheme=scheme))

    def process_receivers(self, apk, android_info):
        manifest_xml = apk.get_android_manifest_xml()
        namespace = {'android': 'http://schemas.android.com/apk/res/android'}

        for receiver in manifest_xml.findall(".//receiver"):
            receiver_name = receiver.get(f"{{{namespace['android']}}}name")
            if receiver_name:
                exported = parse_exported_attr(receiver.get(f"{{{namespace['android']}}}exported"))
                receiver_permission = receiver.get(f"{{{namespace['android']}}}permission")

                # Capture the manifest snippet for this receiver
                manifest_snippet = pretty_print_xml(receiver)

                android_receiver = AndroidReceiver.query.filter_by(
                    android_info_id=android_info.id,
                    receiver_name=receiver_name
                ).first()

                if android_receiver:
                    android_receiver.receiver_exported = exported
                    android_receiver.receiver_permission = receiver_permission
                    android_receiver.manifest_snippet = manifest_snippet
                else:
                    android_receiver = AndroidReceiver(
                        android_info_id=android_info.id,
                        receiver_name=receiver_name,
                        receiver_exported=exported,
                        receiver_permission=receiver_permission,
                        manifest_snippet=manifest_snippet
                    )
                    db.session.add(android_receiver)

                db.session.flush()  # Ensure android_receiver has an id

                # Clear existing intent filters
                ReceiverAction.query.filter_by(receiver_id=android_receiver.id).delete()
                ReceiverCategory.query.filter_by(receiver_id=android_receiver.id).delete()

                # Process intent filters
                for intent_filter in receiver.findall("intent-filter"):
                    actions = [action.get(f"{{{namespace['android']}}}name") for action in
                               intent_filter.findall("action")]
                    categories = [category.get(f"{{{namespace['android']}}}name") for category in
                                  intent_filter.findall("category")]

                    for action in actions:
                        db.session.add(ReceiverAction(receiver_id=android_receiver.id, action=action))
                    for category in categories:
                        db.session.add(ReceiverCategory(receiver_id=android_receiver.id, category=category))

    def process_providers(self, apk, android_info):
        manifest_xml = apk.get_android_manifest_xml()
        namespace = {'android': 'http://schemas.android.com/apk/res/android'}

        for provider in manifest_xml.findall(".//provider"):
            provider_name = provider.get(f"{{{namespace['android']}}}name")
            if provider_name:
                exported = parse_exported_attr(provider.get(f"{{{namespace['android']}}}exported"))
                provider_permission = provider.get(f"{{{namespace['android']}}}permission")
                grant_uri_permissions = provider.get(f"{{{namespace['android']}}}grantUriPermissions") == "true"
                authorities = provider.get(f"{{{namespace['android']}}}authorities")
                read_permission = provider.get(f"{{{namespace['android']}}}readPermission")
                write_permission = provider.get(f"{{{namespace['android']}}}writePermission")

                # Capture the manifest snippet for this provider
                manifest_snippet = pretty_print_xml(provider)

                android_provider = AndroidProvider.query.filter_by(
                    android_info_id=android_info.id,
                    provider_name=provider_name
                ).first()

                if android_provider:
                    android_provider.provider_exported = exported
                    android_provider.provider_permission = provider_permission
                    android_provider.grant_uri_permissions = grant_uri_permissions
                    android_provider.authorities = authorities
                    android_provider.read_permission = read_permission
                    android_provider.write_permission = write_permission
                    android_provider.manifest_snippet = manifest_snippet
                else:
                    android_provider = AndroidProvider(
                        android_info_id=android_info.id,
                        provider_name=provider_name,
                        provider_exported=exported,
                        provider_permission=provider_permission,
                        grant_uri_permissions=grant_uri_permissions,
                        authorities=authorities,
                        read_permission=read_permission,
                        write_permission=write_permission,
                        manifest_snippet=manifest_snippet
                    )
                    db.session.add(android_provider)

                db.session.flush()  # Ensure android_provider has an id

                # Process metadata if needed
                # You can add code here to process metadata if required

        db.session.commit()


@audit_namespace.route('/details/<string:identifier>')
class GetDetails(Resource):
    def _get_apk_info(self, identifier: str) -> Optional[Tuple[str, str]]:
        """Get APK package name from file if it exists (cached by path, mtime)."""
        file_path = os.path.join(UPLOAD_FOLDER, f"{identifier}.apk")
        if os.path.exists(file_path):
            try:
                mtime = os.path.getmtime(file_path)
                cached = _apk_package_cache.get(file_path)
                if cached and cached[0] == mtime:
                    return cached[1]
                package = pyAPK(file_path).package
                _apk_package_cache[file_path] = (mtime, package)
                return package
            except Exception as e:
                logger.warning(f"Failed to extract package name from {file_path}: {e}")
        return None

    def get(self, identifier: str) -> tuple:
        try:
            # Strip .apk extension if present
            base_identifier = identifier.replace('.apk', '')

            # First try to get the actual package name from APK if file exists
            actual_package = self._get_apk_info(base_identifier)

            query = AndroidInfo.query.outerjoin(ApkDetails)

            if actual_package:
                # If we have the actual package name, only look for exact match
                android_info = query.filter(AndroidInfo.package_name == actual_package).first()
            else:
                # Fallback to fuzzy matching only if we couldn't get the actual package name
                android_info = query.filter(
                    or_(
                        AndroidInfo.package_name == base_identifier,
                        AndroidInfo.package_name.like(f"%{base_identifier}%")
                    )
                ).first()

            if android_info and android_info.apk_details:
                logger.debug(f"Found details for {identifier} with package {android_info.package_name}")
                return {
                    "appVersion": android_info.apk_details.app_version,
                    "packageName": android_info.apk_details.package_name,
                    "sdkVersion": android_info.apk_details.sdk_version,
                    "debuggable": "Yes" if android_info.apk_details.debuggable else "No",
                    "MainActivity": android_info.apk_details.main_activity,
                    "AndroidUser": android_info.apk_details.android_user
                }

            logger.debug(f"No details found for {identifier}")
            return {
                'message': f'No details found for {identifier}. Please ensure the app is properly uploaded.'
            }, 404

        except Exception as e:
            logger.error(f"Error fetching details for {identifier}: {str(e)}")
            return {'message': str(e)}, 500


@audit_namespace.route('/recon/<filename>')
class GetRecon(Resource):
    def get(self, filename):
        print("Filename: ", filename)
        file_path = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
        print("File Path: ", file_path)
        if not os.path.exists(file_path):
            return {'message': 'File not found'}, 404

        try:
            # Try to get cached recon data from database
            android_info = find_android_info(filename)
            if android_info and android_info.apk_details and android_info.apk_details.recon_data:
                logger.info(f"Returning cached recon data for {filename}")
                return android_info.apk_details.recon_data, 200

            # No cached data, calculate it
            logger.info(f"Calculating recon data for {filename}")

            # Get the file information
            with open(file_path, 'rb') as f:
                data = f.read()
                sha1 = hashlib.sha1(data).hexdigest()
                sha256 = hashlib.sha256(data).hexdigest()
                md5 = hashlib.md5(data).hexdigest()
                bin_size = os.path.getsize(file_path)
                # Convert the bin_size to human-readable format
                for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
                    if bin_size < 1024:
                        bin_size = f"{bin_size:.2f} {unit}"
                        break
                    bin_size /= 1024

            apk = APK(file_path)

            android_version_code = apk.get_androidversion_code()
            android_version_name = apk.get_androidversion_name()
            android_min = apk.get_min_sdk_version()
            android_target = apk.get_target_sdk_version()
            android_max = apk.get_max_sdk_version()
            android_libraries = apk.get_libraries()
            signed = apk.is_signed()

            android_schemes = extract_schemes(file_path)
            # Append "://" to the schemes
            console.log(f"[green]Android Schemes: {android_schemes}[/green]")
            for i in range(len(android_schemes)):
                android_schemes[i] = f"{android_schemes[i]}://"

            print("Android Libraries: ", android_libraries)

            libraries_ext = extract_libraries(file_path)
            libraries_dict = {
                'x86_64': libraries_ext[0],
                'x86': libraries_ext[1],
                'armeabi-v7a': libraries_ext[2],
                'arm64-v8a': libraries_ext[3]
            }
            for arch, libs in libraries_dict.items():
                print(f"Libraries for {arch}: {libs}")

            framework, framework_icon = detect_framework(file_path)

            if android_max is None:
                android_max = "N/A"

            # Build the recon data
            recon_data = {
                "sha1": sha1,
                "sha256": sha256,
                "md5": md5,
                "bin_size": bin_size,
                "androidInfo": {
                    "versionCode": android_version_code,
                    "libraries": android_libraries,
                    "versionName": android_version_name,
                    "minSdk": android_min,
                    "targetSdk": android_target,
                    "maxSdk": android_max,
                    "signed": signed,
                    "framework": framework,
                    "frameworkIcon": framework_icon,
                    "schemes": android_schemes
                },
                "libraries": libraries_dict
            }

            # Cache it in the database if we found the android_info
            if android_info and android_info.apk_details:
                android_info.apk_details.recon_data = recon_data
                db.session.commit()
                logger.info(f"Cached recon data for {filename}")

            return recon_data, 200

        except Exception as e:
            print(f"Error processing file: {e}")
            return {'message': str(e)}, 500


@audit_namespace.route('/permissions/<filename>')
class GetPermissions(Resource):
    def get(self, filename):
        file_path = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
        if not os.path.exists(file_path):
            return {'message': 'File not found'}, 404

        try:
            apk = APK(file_path)
            permissions = apk.get_permissions()
            return jsonify({"permissions": permissions})
        except Exception as e:
            return {'message': str(e)}, 500


@audit_namespace.route('/manifest/<filename>')
class GetManifest(Resource):
    def get(self, filename):
        try:
            # Try to fetch manifest from database first
            android_info = find_android_info(filename)

            if android_info and android_info.manifest_xml:
                logger.debug(f"Returning cached manifest for {filename} from database")
                return jsonify({"manifest": android_info.manifest_xml})

            # Fallback to parsing APK if not in database (for backwards compatibility)
            logger.warning(f"Manifest not found in database for {filename}, falling back to parsing APK")
            file_path = os.path.join(UPLOAD_FOLDER, secure_filename(filename))

            if not os.path.exists(file_path):
                logger.error(f"File not found at {file_path}")
                return {'message': 'File not found'}, 404

            apk = APK(file_path)
            manifest_axml = apk.get_android_manifest_axml()
            manifest = manifest_axml.get_xml().decode('utf-8')

            # Store in database for future requests
            if android_info:
                android_info.manifest_xml = manifest
                db.session.commit()
                logger.info(f"Stored manifest for {filename} in database")

            return jsonify({"manifest": manifest})

        except Exception as e:
            logger.error(f"Error fetching manifest for {filename}: {str(e)}")
            return {'message': str(e)}, 500


# ── Manifest-component endpoints ────────────────────────────────────────────
# GetProviders/Services/Activities/Receivers used to be four near-identical
# copy-pasted classes; the drift bred bugs (receivers 500'd instead of 404'd on
# an empty result, providers returned a bare dict while the rest used jsonify,
# and several had dead double-checks). They now share one skeleton and differ
# only by a per-model item builder.


@audit_namespace.route('/providers/<string:identifier>')
class GetProviders(Resource):
    def get(self, identifier):
        try:
            return _component_response(
                identifier, AndroidProvider, None,
                exported_attr='provider_exported', name_attr='provider_name',
                build_item=_provider_item,
                extra_key='providers', extra_value=lambda data: data,
                label='providers',
            )
        except Exception as e:
            logger.error(f"Error fetching providers for {identifier}: {str(e)}")
            return {'message': str(e)}, 500


@audit_namespace.route('/services/<string:identifier>')
class GetServices(Resource):
    def get(self, identifier):
        try:
            return _component_response(
                identifier, AndroidService,
                # Same cartesian-product risk as activities; this one just
                # hasn't hit an app with enough rows to fall over yet.
                [selectinload(AndroidService.actions),
                 selectinload(AndroidService.categories),
                 selectinload(AndroidService.schemes)],
                exported_attr='service_exported', name_attr='service_name',
                build_item=_service_item,
                extra_key='intent_filters', extra_value=lambda data: data['intentFilters'],
                label='services',
            )
        except Exception as e:
            logger.error(f"Error fetching services for {identifier}: {str(e)}")
            return {'message': str(e)}, 500


@audit_namespace.route('/activities/<string:identifier>')
class GetActivities(Resource):
    def get(self, identifier):
        try:
            return _component_response(
                identifier, AndroidActivity,
                # selectinload, NOT joinedload: joining four collections in one
                # query produces a cartesian product of them per parent row.
                # Galaxy Store's launcher activity has 23 filters x 23 actions
                # x 45 categories x 74 schemes = ~1.76M rows for that single
                # activity, which exhausted memory and got the container
                # OOM-killed mid-request — the endpoint never returned, so the
                # UI spinner hung forever. selectinload issues one extra SELECT
                # per relationship instead, so the row count stays linear.
                [selectinload(AndroidActivity.actions),
                 selectinload(AndroidActivity.categories),
                 selectinload(AndroidActivity.schemes),
                 selectinload(AndroidActivity.intent_filters)],
                exported_attr='activity_exported', name_attr='activity_name',
                build_item=_activity_item,
                extra_key='intent_filters', extra_value=lambda data: data['intentFilters'],
                label='activities',
            )
        except Exception as e:
            logger.error(f"Error fetching activities for {identifier}: {str(e)}")
            return {'message': str(e)}, 500


@audit_namespace.route('/receivers/<string:identifier>')
class GetReceivers(Resource):
    def get(self, identifier):
        try:
            return _component_response(
                identifier, AndroidReceiver,
                [selectinload(AndroidReceiver.actions),
                 selectinload(AndroidReceiver.categories)],
                exported_attr='receiver_exported', name_attr='receiver_name',
                build_item=_receiver_item,
                extra_key='intent_filters', extra_value=lambda data: data['intentFilters'],
                label='receivers',
            )
        except Exception as e:
            logger.error(f"Error fetching receivers for {identifier}: {str(e)}")
            return {'message': str(e)}, 500


@audit_namespace.route('/delete/<filename>')
class DeleteFile(Resource):
    def delete(self, filename):
        try:
            # Delete the file
            file_path = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.info(f"File {filename} deleted from filesystem.")
            else:
                logger.warning(f"File {filename} not found in filesystem.")

            # Delete database records
            app_name = os.path.splitext(filename)[0]  # Remove file extension
            try:
                # Find all matching AndroidInfo records
                matching_records = AndroidInfo.query.filter(
                    or_(
                        AndroidInfo.app_name == app_name,
                        AndroidInfo.app_name == filename,
                        AndroidInfo.package_name.like(f"%{app_name}%")
                    )
                ).all()

                if matching_records:
                    for record in matching_records:
                        # Delete related records
                        self.delete_related_records(record)

                    # Directly delete matching AndroidInfo records
                    AndroidInfo.query.filter(
                        or_(
                            AndroidInfo.app_name == app_name,
                            AndroidInfo.app_name == filename,
                            AndroidInfo.package_name.like(f"%{app_name}%")
                        )
                    ).delete(synchronize_session=False)

                    db.session.commit()
                    logger.info(f"All AndroidInfo records for {filename} deleted.")
                    return {'message': 'File and all associated records deleted successfully'}, 200
                else:
                    logger.warning(f"No database records found for {filename}.")
                    return {'message': 'File deleted, but no associated records found in database'}, 200

            except SQLAlchemyError as e:
                logger.error(f"Database error while deleting records for {filename}: {str(e)}")
                db.session.rollback()
                return {'message': f'Error occurred while deleting database records: {str(e)}'}, 500

        except Exception as e:
            logger.error(f"Error deleting {filename}: {str(e)}")
            return {'message': f'Error occurred: {str(e)}'}, 500

    def delete_related_records(self, android_info):
        inspector = inspect(db.engine)

        related_models = [
            (ApkDetails, 'apk_details'),
            (AndroidActivity, 'android_activities'),
            (AndroidService, 'android_services'),
            (AndroidReceiver, 'android_receivers'),
            (AndroidProvider, 'android_providers'),
            (ActivityAction, 'activity_actions'),
            (ActivityCategory, 'activity_categories'),
            (ActivityScheme, 'activity_schemes'),
            (ActivityIntentFilter, 'activity_intent_filters'),
            (ServiceAction, 'service_actions'),
            (ServiceCategory, 'service_categories'),
            (ServiceScheme, 'service_schemes'),
            (ReceiverAction, 'receiver_actions'),
            (ReceiverCategory, 'receiver_categories'),
            (AndroidSourceCode, 'android_source_code'),
            (AppsharkScan, 'appshark_scans'),
            (AppsharkSecurityIssue, 'appshark_security_issues'),
            (AppsharkVulnerability, 'appshark_vulnerabilities')
        ]

        # Only include ProviderAction, ProviderCategory, and ProviderScheme if they are defined
        if 'ProviderAction' in globals():
            related_models.append((ProviderAction, 'provider_actions'))
        if 'ProviderCategory' in globals():
            related_models.append((ProviderCategory, 'provider_categories'))
        if 'ProviderScheme' in globals():
            related_models.append((ProviderScheme, 'provider_schemes'))

        for model, table_name in related_models:
            if inspector.has_table(table_name):
                try:
                    if model == ApkDetails:
                        # Special case for ApkDetails due to one-to-one relationship
                        ApkDetails.query.filter_by(android_info_id=android_info.id).delete(synchronize_session=False)
                    elif hasattr(model, 'android_info_id'):
                        model.query.filter_by(android_info_id=android_info.id).delete(synchronize_session=False)
                    elif hasattr(model, 'appshark_scan_id'):
                        # For AppsharkSecurityIssue and AppsharkVulnerability
                        scan_ids = [scan.id for scan in AppsharkScan.query.filter_by(android_info_id=android_info.id)]
                        model.query.filter(model.appshark_scan_id.in_(scan_ids)).delete(synchronize_session=False)
                    elif hasattr(model, 'provider_id'):
                        # For provider-related models, delete based on the provider's ID
                        provider_ids = [p.id for p in AndroidProvider.query.filter_by(android_info_id=android_info.id)]
                        model.query.filter(model.provider_id.in_(provider_ids)).delete(synchronize_session=False)
                    else:
                        logger.warning(f"No direct link found for {model.__name__}. Skipping.")
                except Exception as e:
                    logger.warning(f"Error deleting {model.__name__} records: {str(e)}")
                    db.session.rollback()
            else:
                logger.warning(f"Table {table_name} does not exist. Skipping.")

        db.session.flush()


@audit_namespace.route('/files')
class ListFiles(Resource):
    def _get_apk_package_name(self, file_path: str) -> Optional[str]:
        """Extract package name from an APK, cached by (path, mtime).

        Avoids re-running androguard on every APK on every /audit/files call;
        re-parses only when the file's mtime changes.
        """
        try:
            mtime = os.path.getmtime(file_path)
            cached = _apk_package_cache.get(file_path)
            if cached and cached[0] == mtime:
                return cached[1]
            package = pyAPK(file_path).package
            _apk_package_cache[file_path] = (mtime, package)
            return package
        except Exception as e:
            logger.warning(f"Failed to extract package name from {file_path}: {e}")
            return None

    def _find_matching_info(self, base_name: str, info_map: Dict) -> Optional[object]:
        """Find matching Android info based on package name."""
        for package_name, info in info_map.items():
            if package_name and (package_name in base_name or base_name in package_name):
                return info
        return None

    def _build_file_info(self, file: str, matching_info: Optional[object] = None) -> Dict:
        """Build response dictionary for a file."""
        manifest_link = f"{request.url_root}api/audit/manifest/{file}"
        activities_link = f"{request.url_root}api/audit/activities/{file}"

        file_info = {
            "application": file,
            "version": "",
            "patch": "",
            "diff": "",
            "manifest": manifest_link,
            "activities": activities_link
        }

        # Add APK details if it's an APK file and we have matching info
        if file.lower().endswith('.apk') and matching_info and matching_info.apk_details:
            file_info.update({
                "version": matching_info.apk_details.app_version,
                "packageName": matching_info.apk_details.package_name,
                "sdkVersion": matching_info.apk_details.sdk_version,
                "debuggable": "Yes" if matching_info.apk_details.debuggable else "No",
                "MainActivity": matching_info.apk_details.main_activity,
                "AndroidUser": matching_info.apk_details.android_user
            })

        return file_info

    def get(self) -> tuple:
        """Get list of APK and IPA files with their details."""
        try:
            files = [
                f for f in os.listdir(UPLOAD_FOLDER)
                if os.path.isfile(os.path.join(UPLOAD_FOLDER, f))
            ]

            # Only fetch Android info for APK files
            android_infos = AndroidInfo.query.outerjoin(ApkDetails).all()
            info_map = {info.package_name: info for info in android_infos if info.package_name}

            file_data = []
            for file in files:
                matching_info = None
                if file.lower().endswith('.apk'):
                    file_path = os.path.join(UPLOAD_FOLDER, file)
                    base_name = os.path.splitext(file)[0]
                    package_name = self._get_apk_package_name(file_path)

                    if package_name:
                        matching_info = info_map.get(package_name) or self._find_matching_info(base_name, info_map)

                file_info = self._build_file_info(file, matching_info)
                file_data.append(file_info)

            return jsonify(file_data)

        except Exception as e:
            error_msg = f"Error listing files: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return {'message': error_msg}, 500


@audit_namespace.route('/hello')
class Hello(Resource):
    def get(self):
        return jsonify(message="Hello, the Flask API is running")


# Implementing download-lbrary endpoint @app.route('/audit/download-library/<string:filename>/<string:arch>/<path:lib>', methods=['GET'])


@audit_namespace.route('/download-library/<string:filename>/<string:arch>/<path:lib>')
class DownloadLibrary(Resource):
    def get(self, filename, arch, lib):
        file_path = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
        if not os.path.exists(file_path):
            return {'message': 'APK file not found'}, 404

        try:
            with zipfile.ZipFile(file_path, 'r') as apk_zip:
                lib_path = f'{lib}'
                print(f"Looking for library at {lib_path}")
                if lib_path not in apk_zip.namelist():
                    return {'message': 'Library not found in APK'}, 404

                # Extract the library to a temporary file
                with tempfile.NamedTemporaryFile(delete=False) as temp_file:
                    temp_file.write(apk_zip.read(lib_path))
                    temp_file_path = temp_file.name

            # Send the extracted library file
            return send_file(
                temp_file_path,
                as_attachment=True,
                download_name=lib,
                mimetype='application/octet-stream'
            )

        except Exception as e:
            print(f"Error extracting library from {filename}: {e}")
            return {'message': 'Error extracting library'}, 500

        finally:
            # Clean up the temporary file
            if 'temp_file_path' in locals():
                os.unlink(temp_file_path)


@audit_namespace.route('/component-status/<string:app_name>/<string:component_name>')
class ComponentStatus(Resource):
    def get(self, app_name, component_name):
        try:
            # Use database-only lookup to avoid slow APK parsing
            android_info = find_android_info(app_name, skip_apk_analysis=True)

            # If not found, try searching by package name in component
            if not android_info and '.' in component_name:
                package_parts = component_name.split('.')
                for i in range(len(package_parts), 2, -1):
                    potential_package = '.'.join(package_parts[:i])
                    android_info = AndroidInfo.query.filter(
                        AndroidInfo.package_name == potential_package
                    ).first()
                    if android_info:
                        break

            if not android_info:
                # Try direct component lookup as fallback
                status = find_component_directly(component_name)
                if status:
                    return status, 200
                return UNKNOWN_COMPONENT_STATUS, 200

            package_name = android_info.package_name

            # Calculate relative name for matching (e.g., ".homepage.Activity" from "com.pkg.homepage.Activity")
            relative_name = None
            if component_name.startswith(package_name):
                relative_name = component_name[len(package_name):]

            # Handle inner class notation (e.g., com.example.Activity$InnerClass -> com.example.Activity)
            # Vulnerabilities may reference inner classes, but manifest only declares outer classes
            outer_class_name = extract_outer_class(component_name) if '$' in component_name else None
            outer_relative_name = None
            if outer_class_name and outer_class_name.startswith(package_name):
                outer_relative_name = outer_class_name[len(package_name):]

            # Helper to check if activity name matches any of the candidate names
            def matches_activity(activity_name, candidates):
                for candidate in candidates:
                    if candidate and activity_name == candidate:
                        return True
                    # Also check if DB has relative and we're looking for full
                    if candidate and activity_name.startswith('.') and package_name + activity_name == candidate:
                        return True
                return False

            # Check activities (try exact match first, then outer class match for inner classes)
            for activity in android_info.activities:
                candidates = [component_name, relative_name, outer_class_name, outer_relative_name]
                if matches_activity(activity.activity_name, candidates):
                    has_intent_filters = len(activity.intent_filters) > 0
                    return {
                        "type": "activity",
                        "exported": activity.activity_exported,
                        "accessible": is_component_accessible(activity.activity_exported, has_intent_filters),
                        "has_intent_filters": has_intent_filters
                    }

            # Check services
            for service in android_info.services:
                candidates = [component_name, relative_name, outer_class_name, outer_relative_name]
                if matches_activity(service.service_name, candidates):
                    has_intent_filters = (len(service.actions) > 0 or len(service.categories) > 0 or len(service.schemes) > 0)
                    return {
                        "type": "service",
                        "exported": service.service_exported,
                        "accessible": is_component_accessible(service.service_exported, has_intent_filters),
                        "has_intent_filters": has_intent_filters
                    }

            # Check receivers
            for receiver in android_info.receivers:
                candidates = [component_name, relative_name, outer_class_name, outer_relative_name]
                if matches_activity(receiver.receiver_name, candidates):
                    has_intent_filters = (len(receiver.actions) > 0 or len(receiver.categories) > 0)
                    return {
                        "type": "receiver",
                        "exported": receiver.receiver_exported,
                        "accessible": is_component_accessible(receiver.receiver_exported, has_intent_filters),
                        "has_intent_filters": has_intent_filters
                    }

            # Check providers
            for provider in android_info.providers:
                candidates = [component_name, relative_name, outer_class_name, outer_relative_name]
                if matches_activity(provider.provider_name, candidates):
                    permission_gated = bool(
                        provider.provider_permission or provider.read_permission or provider.write_permission
                    )
                    return {
                        "type": "provider",
                        "exported": provider.provider_exported,
                        "accessible": bool(provider.provider_exported) and not permission_gated,
                        "has_intent_filters": False
                    }

            # Not found in the app's components - try direct lookup as fallback
            status = find_component_directly(component_name)
            if status:
                return status, 200
            return UNKNOWN_COMPONENT_STATUS, 200

        except Exception as e:
            print(f"Error in ComponentStatus: {str(e)}")
            return UNKNOWN_COMPONENT_STATUS, 200


@audit_namespace.route('/component-status-batch/<string:app_name>')
class ComponentStatusBatch(Resource):
    """Batch endpoint to check status of multiple components at once"""
    def post(self, app_name):
        try:
            data = request.get_json()
            component_names = data.get('components', [])

            if not component_names or not isinstance(component_names, list):
                return {"error": "components array required"}, 400

            print(f"Batch lookup for {len(component_names)} components in app: {app_name}")

            # Use database-only lookup (skip_apk_analysis=True) to avoid slow APK parsing
            # The manifest is already stored in database when APK is uploaded
            android_info = find_android_info(app_name, skip_apk_analysis=True)

            # If not found by app_name, try to extract package from each component's prefix
            # (trying only the first component fails when it comes from a library package)
            if not android_info and component_names:
                for candidate_component in component_names:
                    if '.' not in candidate_component:
                        continue
                    package_parts = candidate_component.split('.')
                    for i in range(len(package_parts), 2, -1):
                        potential_package = '.'.join(package_parts[:i])
                        android_info = AndroidInfo.query.filter(
                            AndroidInfo.package_name == potential_package
                        ).first()
                        if android_info:
                            print(f"Found app by package name from component: {potential_package}")
                            break
                    if android_info:
                        break

            if not android_info:
                # No app found by name - try direct component lookup as fallback
                print(f"No app found in database for {app_name}, trying direct component lookup...")
                results = {}
                for component_name in component_names:
                    status = find_component_directly(component_name)
                    if status:
                        results[component_name] = status
                        print(f"[DIRECT] Found {component_name}: exported={status['exported']}, accessible={status['accessible']}")
                    else:
                        results[component_name] = UNKNOWN_COMPONENT_STATUS

                found_count = sum(1 for s in results.values() if s.get('type') != 'UNKNOWN')
                print(f"Direct lookup complete: {found_count}/{len(component_names)} components found")
                return results, 200

            print(f"Found app: {android_info.app_name} (ID: {android_info.id}, package: {android_info.package_name})")

            package_name = android_info.package_name

            # Build lookup dictionaries for fast access
            # Handle both relative names (.Activity) and full names (com.package.Activity)
            activities = {}
            for a in android_info.activities:
                # Store original name
                activities[a.activity_name] = a
                # If relative name (starts with .), also store the full name
                if a.activity_name.startswith('.'):
                    full_name = package_name + a.activity_name
                    activities[full_name] = a
                # Handle $ escaping
                if '\\$' in a.activity_name:
                    activities[a.activity_name.replace('\\$', '$')] = a

            services = {}
            for s in android_info.services:
                services[s.service_name] = s
                if s.service_name.startswith('.'):
                    full_name = package_name + s.service_name
                    services[full_name] = s
                if '\\$' in s.service_name:
                    services[s.service_name.replace('\\$', '$')] = s

            receivers = {}
            for r in android_info.receivers:
                receivers[r.receiver_name] = r
                if r.receiver_name.startswith('.'):
                    full_name = package_name + r.receiver_name
                    receivers[full_name] = r
                if '\\$' in r.receiver_name:
                    receivers[r.receiver_name.replace('\\$', '$')] = r

            providers = {}
            for p in android_info.providers:
                providers[p.provider_name] = p
                if p.provider_name.startswith('.'):
                    full_name = package_name + p.provider_name
                    providers[full_name] = p
                if '\\$' in p.provider_name:
                    providers[p.provider_name.replace('\\$', '$')] = p

            results = {}
            for component_name in component_names:
                # Activities
                comp = activities.get(component_name)
                if comp:
                    has_intent_filters = len(comp.intent_filters) > 0
                    results[component_name] = {
                        "type": "activity",
                        "exported": comp.activity_exported,
                        "accessible": is_component_accessible(comp.activity_exported, has_intent_filters),
                        "has_intent_filters": has_intent_filters
                    }
                    continue

                # Services
                comp = services.get(component_name)
                if comp:
                    has_intent_filters = (len(comp.actions) > 0 or len(comp.categories) > 0 or len(comp.schemes) > 0)
                    results[component_name] = {
                        "type": "service",
                        "exported": comp.service_exported,
                        "accessible": is_component_accessible(comp.service_exported, has_intent_filters),
                        "has_intent_filters": has_intent_filters
                    }
                    continue

                # Receivers
                comp = receivers.get(component_name)
                if comp:
                    has_intent_filters = (len(comp.actions) > 0 or len(comp.categories) > 0)
                    results[component_name] = {
                        "type": "receiver",
                        "exported": comp.receiver_exported,
                        "accessible": is_component_accessible(comp.receiver_exported, has_intent_filters),
                        "has_intent_filters": has_intent_filters
                    }
                    continue

                # Providers
                comp = providers.get(component_name)
                if comp:
                    permission_gated = bool(
                        comp.provider_permission or comp.read_permission or comp.write_permission
                    )
                    results[component_name] = {
                        "type": "provider",
                        "exported": comp.provider_exported,
                        "accessible": bool(comp.provider_exported) and not permission_gated,
                        "has_intent_filters": False
                    }
                    continue

                # Not found in app components, try direct lookup
                not_found_status = find_component_directly(component_name)
                if not_found_status:
                    results[component_name] = not_found_status
                    print(f"[BATCH DIRECT LOOKUP] Found {component_name}: {not_found_status}")
                else:
                    results[component_name] = UNKNOWN_COMPONENT_STATUS

            return results, 200

        except Exception as e:
            print(f"Error in ComponentStatusBatch: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"error": str(e)}, 500


@audit_namespace.route('/debug/component/<string:component_name>')
class DebugComponent(Resource):
    """Debug endpoint to see what's in the database for a component"""
    def get(self, component_name):
        try:
            class_name = component_name.split('.')[-1]

            # Search all component tables
            activities = AndroidActivity.query.filter(
                AndroidActivity.activity_name.ilike(f'%{class_name}%')
            ).all()

            services = AndroidService.query.filter(
                AndroidService.service_name.ilike(f'%{class_name}%')
            ).all()

            receivers = AndroidReceiver.query.filter(
                AndroidReceiver.receiver_name.ilike(f'%{class_name}%')
            ).all()

            providers = AndroidProvider.query.filter(
                AndroidProvider.provider_name.ilike(f'%{class_name}%')
            ).all()

            return {
                "searched_for": component_name,
                "class_name": class_name,
                "activities": [
                    {
                        "id": a.id,
                        "name": a.activity_name,
                        "exported": a.activity_exported,
                        "android_info_id": a.android_info_id,
                        "has_intent_filters": len(a.intent_filters) > 0
                    }
                    for a in activities
                ],
                "services": [
                    {
                        "id": s.id,
                        "name": s.service_name,
                        "exported": s.service_exported,
                        "android_info_id": s.android_info_id
                    }
                    for s in services
                ],
                "receivers": [
                    {
                        "id": r.id,
                        "name": r.receiver_name,
                        "exported": r.receiver_exported,
                        "android_info_id": r.android_info_id
                    }
                    for r in receivers
                ],
                "providers": [
                    {
                        "id": p.id,
                        "name": p.provider_name,
                        "exported": p.provider_exported,
                        "android_info_id": p.android_info_id
                    }
                    for p in providers
                ],
                "direct_lookup_result": find_component_directly(component_name)
            }, 200

        except Exception as e:
            return {"error": str(e)}, 500
