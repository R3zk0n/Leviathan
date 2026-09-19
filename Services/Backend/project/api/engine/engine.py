"""Engine API namespace (aggregator).

Route classes live in sibling modules; importing them here registers their
@engine_namespace.route classes. The add_resource() block preserves the
original file's extra/alternate path registrations verbatim. Kept as the
public entry point so `from project.api.engine.engine import engine_namespace`
still resolves.
"""
from project.api.engine._shared import engine_namespace  # noqa: F401

from project.api.engine.decompile import (
    EngineDecompiledBatchStatus,
    EngineDecompiled,
    EngineDecompile,
    EngineDecompileCheck,
    EngineDecompileStatus,
    EngineVersion,
)
from project.api.engine.trufflehog import (
    EngineTrufflehogScan,
    EngineTrufflehogScanStatus,
    EngineTrufflehogScanChainDebug,
    EngineTrufflehogScanDebug,
    EngineTrufflehogVersion,
)
from project.api.engine.management import (
    EngineStatus,
    EngineDirectories,
    EngineRules,
    EngineFileContent,
    EngineRuleContent,
    EngineSettings,
    EngineConfig,
    SaveRule,
    CreateRuleFolder,
    DeleteRule,
)
from project.api.engine.run import (
    EngineRun,
    EngineScan,
)
from project.api.engine.results import (
    VulnerabilityDetails,
    VulnerabilitySuppress,
    EngineScanResults,
    EngineScanHighLevelResults,
    EngineScanSecurityIssueDetails,
)
from project.api.engine.status import (
    EngineScanStatus,
    EngineScanStatusByGuid,
    EngineScanStop,
    BackfillComponentStatus,
    BackfillComponentStatusForApp,
    EngineScanTasks,
    EngineActiveScanTasks,
    EngineContainerLogs,
    EngineScanList,
    EngineScanLogs,
)
from project.api.engine.misc import (
    EngineMcpStatus,
    EngineAgentsStatus,
)

# Extra/alternate path registrations preserved verbatim from the original file.
engine_namespace.add_resource(EngineStatus, "/status")
engine_namespace.add_resource(EngineVersion, "/version")
engine_namespace.add_resource(EngineDecompile, "/decompile/<string:file_name>")
engine_namespace.add_resource(EngineDecompileCheck, "/decompile/check/<string:file_name>")
engine_namespace.add_resource(EngineDecompiledBatchStatus, "/decompiled/<string:file_name>/batch-status")
engine_namespace.add_resource(EngineDecompiled, "/decompiled/<string:file_name>/<string:java_file>")
engine_namespace.add_resource(EngineRules, "/rules")
engine_namespace.add_resource(EngineRuleContent, "/rules/<string:filename>")
engine_namespace.add_resource(EngineSettings, "/settings")
engine_namespace.add_resource(EngineConfig, "/engine-config")
engine_namespace.add_resource(EngineFileContent, "/file-content")
engine_namespace.add_resource(EngineScan, "/scan/<string:filename>")
engine_namespace.add_resource(EngineScanStatus, "/scan/status/<string:task_id>")
engine_namespace.add_resource(EngineMcpStatus, "/mcp/status")
engine_namespace.add_resource(EngineAgentsStatus, "/agents/status")
engine_namespace.add_resource(EngineScanStop, "/scan/stop/<string:task_id>")
engine_namespace.add_resource(EngineScanResults, "/scan/results/<string:app_name>")
engine_namespace.add_resource(VulnerabilityDetails, "/vulnerability-details/<string:app_name>/<string:vulnerability_id>")
engine_namespace.add_resource(VulnerabilitySuppress, "/vulnerability/<int:vuln_id>/suppress")
engine_namespace.add_resource(EngineRun, "/run")
engine_namespace.add_resource(EngineTrufflehogScanDebug, "/trufflehog/scan/debug/<task_id>")
engine_namespace.add_resource(EngineScanHighLevelResults, "/scan/results/<string:app_identifier>/high-level")
engine_namespace.add_resource(EngineScanSecurityIssueDetails, "/scan/results/<string:app_identifier>/security-issue/<int:issue_id>")
engine_namespace.add_resource(EngineDirectories, "/directories")
engine_namespace.add_resource(EngineTrufflehogVersion, "/trufflehog/version")
engine_namespace.add_resource(EngineTrufflehogScan, "/trufflehog/scan/<filename>")
engine_namespace.add_resource(EngineTrufflehogScanStatus, "/trufflehog/scan/status/<task_id>")
engine_namespace.add_resource(EngineTrufflehogScanChainDebug, "/trufflehog/scan/chain-debug/<task_id>")
engine_namespace.add_resource(BackfillComponentStatus, "/backfill-component-status")
engine_namespace.add_resource(BackfillComponentStatusForApp, "/backfill-component-status/<string:app_name>")
engine_namespace.add_resource(EngineScanTasks, "/scan-tasks")
engine_namespace.add_resource(EngineActiveScanTasks, "/scan-tasks/active")
engine_namespace.add_resource(EngineContainerLogs, "/container-logs")
engine_namespace.add_resource(EngineScanList, "/scan/list")
engine_namespace.add_resource(EngineScanLogs, "/scan/logs/<string:scan_name>")

__all__ = ["engine_namespace"]
