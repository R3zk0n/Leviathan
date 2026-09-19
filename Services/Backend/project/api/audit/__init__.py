"""Audit API package (aggregator).

Re-exports audit_namespace and find_android_info (imported by other
modules), imports the endpoints module so its @audit_namespace.route
classes register, and re-runs the original add_resource() block verbatim
for the extra/alternate <filename> path registrations.
"""
from project.api.audit._shared import audit_namespace  # noqa: F401
from project.api.audit.parsing import find_android_info  # noqa: F401
from project.api.audit.endpoints import (
    BulkUploadAPK,
    UploadAPK,
    GetDetails,
    GetRecon,
    GetPermissions,
    GetManifest,
    GetProviders,
    GetServices,
    GetActivities,
    GetReceivers,
    DeleteFile,
    ListFiles,
    Hello,
    DownloadLibrary,
    ComponentStatus,
    ComponentStatusBatch,
    DebugComponent,
)

# Extra/alternate path registrations preserved verbatim from the original file.
audit_namespace.add_resource(UploadAPK, "/upload")
audit_namespace.add_resource(GetDetails, "/details/<filename>")
audit_namespace.add_resource(GetPermissions, "/permissions/<filename>")
audit_namespace.add_resource(GetManifest, "/manifest/<filename>")
audit_namespace.add_resource(GetActivities, "/activities/<filename>")
audit_namespace.add_resource(GetReceivers, "/receivers/<filename>")
audit_namespace.add_resource(GetServices, "/services/<filename>")
audit_namespace.add_resource(GetProviders, "/providers/<filename>")
audit_namespace.add_resource(Hello, "/hello")
audit_namespace.add_resource(DeleteFile, "/delete/<filename>")
audit_namespace.add_resource(ListFiles, "/files")
audit_namespace.add_resource(ComponentStatus, "/component-status/<string:app_name>/<string:component_name>")
audit_namespace.add_resource(ComponentStatusBatch, "/component-status-batch/<string:app_name>")
audit_namespace.add_resource(DebugComponent, "/debug/component/<string:component_name>")

__all__ = ["audit_namespace", "find_android_info"]
