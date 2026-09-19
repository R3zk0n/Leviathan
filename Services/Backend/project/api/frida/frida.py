"""Frida API namespace (aggregator).

Route classes live in sibling modules (files, devices, scripts, repl,
features, agent) and share state + helpers via _shared/helpers. Importing
them here registers their @frida_namespace.route classes; the add_resource()
block preserves the original alternate/explicit registrations verbatim.
Public entry point: `from project.api.frida.frida import frida_namespace`.
"""

from project.api.frida._shared import frida_namespace  # noqa: F401

from project.api.frida.files import (
    FridaDownload,
    FridaPull,
)
from project.api.frida.devices import (
    FridaProcessInfo,
    FridaSpawn,
    FridaAttach,
    FridaList,
    FridaRemoteAttach,
    FridaApplications,
    FridaDetach,
    FridaResume,
)
from project.api.frida.scripts import (
    FridaBridgeFile,
    FridaMonitorScript,
    FridaRunPersistentScript,
    FridaKillScript,
    FridaHooks,
)
from project.api.frida.repl import (
    FridaREPLInit,
    FridaExecute,
    FridaREPLClose,
)
from project.api.frida.features import (
    FridaAgentExecute,
    FridaExecuteFeature,
    FridaStartFeature,
    FridaStopFeature,
    FridaFeatureStream,
)
from project.api.frida.agent import (
    FridaLoadAgent,
    FridaAgentStatus,
    FridaUnloadAgent,
)

# Explicit/alternate path registrations preserved verbatim from the original file.
frida_namespace.add_resource(FridaList, "/list")
frida_namespace.add_resource(FridaAttach, "/attach")
frida_namespace.add_resource(FridaDetach, "/detach")
frida_namespace.add_resource(FridaExecute, "/execute")
frida_namespace.add_resource(FridaRemoteAttach, "/attach-remote")
frida_namespace.add_resource(FridaApplications, "/applications/<string:device_id>")
frida_namespace.add_resource(FridaLoadAgent, "/load-agent")
frida_namespace.add_resource(FridaAgentExecute, "/execute-with-agent")
frida_namespace.add_resource(FridaAgentStatus, "/agent-status/<string:session_id>")
frida_namespace.add_resource(FridaUnloadAgent, "/unload-agent")
frida_namespace.add_resource(FridaExecuteFeature, "/execute-feature")
frida_namespace.add_resource(FridaStartFeature, "/start-feature")
frida_namespace.add_resource(FridaStopFeature, "/stop-feature")
frida_namespace.add_resource(
    FridaFeatureStream, "/feature-stream/<session_id>/<platform>/<category>/<feature>"
)
frida_namespace.add_resource(FridaMonitorScript, "/monitor_script")
frida_namespace.add_resource(FridaHooks, "/hooks/<session_id>")
frida_namespace.add_resource(FridaSpawn, "/spawn")
frida_namespace.add_resource(FridaResume, "/resume")
frida_namespace.add_resource(
    FridaProcessInfo, "/process-info/<string:device_id>/<int:pid>"
)
frida_namespace.add_resource(FridaPull, "/pull")
frida_namespace.add_resource(FridaDownload, "/download/<string:download_id>")

__all__ = ["frida_namespace"]
