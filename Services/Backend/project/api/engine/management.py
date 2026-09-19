"""Engine status, rules, config, and file endpoints."""

from project.api.engine._shared import (
    json, request, jsonify, Resource, logger, os, engine_namespace, engine_service,
)


@engine_namespace.route('/status')
class EngineStatus(Resource):
    def get(self):
        try:
            status = engine_service.get_container_status()
            return jsonify({"message": f"engine is {status}"})
        except Exception as e:
            return jsonify({"message": f"Error: {str(e)}"}), 500


@engine_namespace.route('/directories')
class EngineDirectories(Resource):
    def get(self):
        try:
            directories = engine_service.get_directories()
            return {"directories": directories}, 200
        except Exception as e:
            logger.error(f"Error fetching directories: {str(e)}")
            return {"message": f"Error fetching directories: {str(e)}"}, 500


@engine_namespace.route('/rules')
class EngineRules(Resource):
    def get(self):
        rule_path = request.args.get('rulePath', '/appshark_engine/appshark/config/rules')
        try:
            rules = engine_service.get_rules(rule_path)
            return {"rules": rules}, 200
        except Exception as e:
            return {"message": f"Error fetching rules: {str(e)}"}, 500


@engine_namespace.route('/file-content')
class EngineFileContent(Resource):
    def get(self):
        file_path = request.args.get('path')
        if not file_path:
            return {"error": "No file path provided"}, 400

        try:
            content = engine_service.get_file_content(file_path)
            try:
                # Try to parse as JSON first
                json_content = json.loads(content)
                return {"content": json_content}
            except json.JSONDecodeError:
                # If not JSON, return as plain text
                return {"content": content}
        except Exception as e:
            return {"error": str(e)}, 500


@engine_namespace.route('/rules/<string:filename>')
class EngineRuleContent(Resource):
    def get(self, filename):
        try:
            print("HERE")
            file_path = os.path.join('/appshark_engine/appshark/config/rules', filename)
            print(file_path)
            print("File path: ", file_path)
            if not os.path.exists(file_path):
                return {"error": "Rule file not found"}, 404

            with open(file_path, 'r') as file:
                content = json.load(file)
                return content
        except Exception as e:
            return {"error": str(e)}, 500


@engine_namespace.route('/settings')
class EngineSettings(Resource):
    def get(self):
        return engine_service.get_settings()

    def post(self):
        settings = request.json
        if 'outputPath' in settings:
            # Ensure the output directory exists
            engine_service.create_directory(settings['outputPath'])
        return engine_service.save_settings(settings)


@engine_namespace.route('/engine-config')
class EngineConfig(Resource):
    def get(self):
        try:
            return engine_service.get_engine_config(), 200
        except Exception as e:
            logger.exception("Error getting EngineConfig.json5")
            return {"success": False, "message": str(e)}, 500

    def put(self):
        try:
            payload = request.get_json(force=True, silent=True) or {}
            content = payload.get('content')
            expected_hash = payload.get('hash')
            if content is None:
                return {"success": False, "message": "Missing required field: content"}, 400

            result = engine_service.save_engine_config(content=content, expected_hash=expected_hash)
            status = int(result.get('status') or (200 if result.get('success') else 500))
            return result, status
        except Exception as e:
            logger.exception("Error saving EngineConfig.json5")
            return {"success": False, "message": str(e)}, 500


@engine_namespace.route('/save-rule/<path:rule_name>')
class SaveRule(Resource):
    def post(self, rule_name):
        content = request.json.get('content')
        print(content)
        print("Content: ", content)
        if not content:
            return {"success": False, "message": "No content provided"}, 400

        try:
            result = engine_service.save_rule(rule_name, content)
            return result, 200 if result['success'] else 500
        except Exception as e:
            return {"success": False, "message": f"Error saving rule: {str(e)}"}, 500


@engine_namespace.route('/create-rule-folder/<path:folder_name>')
class CreateRuleFolder(Resource):
    def post(self, folder_name):
        return engine_service.create_rule_folder(folder_name)


@engine_namespace.route('/delete-rule/<path:rule_name>')
class DeleteRule(Resource):
    def delete(self, rule_name):
        try:
            result = engine_service.delete_rule(rule_name)
            return result, 200 if result.get('success') else 500
        except Exception as e:
            return {"success": False, "message": f"Error deleting rule: {str(e)}"}, 500
