// Appshark engine: scans, rules, decompilation, results (/engine).
import http from '@/utils/http'

const enc = encodeURIComponent

export const engineApi = {
  // Status / versions
  status:        () => http.get('/engine/status').then(r => r.data),
  version:       () => http.get('/engine/version').then(r => r.data),
  containerLogs: () => http.get('/engine/container-logs').then(r => r.data),

  // Settings & engine config
  getSettings:     ()        => http.get('/engine/settings').then(r => r.data),
  saveSettings:    (settings) => http.post('/engine/settings', settings).then(r => r.data),
  getEngineConfig: ()        => http.get('/engine/engine-config').then(r => r.data),
  saveEngineConfig:(body)    => http.put('/engine/engine-config', body).then(r => r.data),

  // Rules
  getRules:        ()            => http.get('/engine/rules').then(r => r.data),
  getDirectories:  ()            => http.get('/engine/directories').then(r => r.data),
  getRuleContent:  (filename)    => http.get(`/engine/rules/${enc(filename)}`).then(r => r.data),
  getFileContent:  (path)        => http.get('/engine/file-content', { params: { path } }).then(r => r.data),
  saveRule:        (name, body)  => http.post(`/engine/save-rule/${name}`, body).then(r => r.data),
  createRuleFolder:(name)        => http.post(`/engine/create-rule-folder/${name}`).then(r => r.data),
  deleteRule:      (name)        => http.delete(`/engine/delete-rule/${name}`).then(r => r.data),

  // Scans
  runScan:       (filename, opts)  => http.post(`/engine/scan/${enc(filename)}`, opts).then(r => r.data),
  stopScan:      (taskId)          => http.post(`/engine/scan/stop/${taskId}`).then(r => r.data),
  scanStatus:    (taskId)          => http.get(`/engine/scan/status/${taskId}`).then(r => r.data),
  scanStatusByGuid: (guid)         => http.get(`/engine/scan/status-by-guid/${guid}`).then(r => r.data),
  listScans:     ()                => http.get('/engine/scan/list').then(r => r.data),
  activeScanTasks: ()              => http.get('/engine/scan-tasks/active').then(r => r.data),

  // Results
  getResults:        (app) => http.get(`/engine/scan/results/${enc(app)}`).then(r => r.data),
  getHighLevel:      (app) => http.get(`/engine/scan/results/${enc(app)}/high-level`).then(r => r.data),
  getSecurityIssue:  (app, issueId) =>
    http.get(`/engine/scan/results/${enc(app)}/security-issue/${issueId}`).then(r => r.data),
  getVulnerabilityDetails: (app, vulnId) =>
    http.get(`/engine/vulnerability-details/${enc(app)}/${enc(vulnId)}`).then(r => r.data),
  suppressVulnerability:   (vulnId, body) =>
    http.post(`/engine/vulnerability/${vulnId}/suppress`, body).then(r => r.data),

  // Decompilation
  // engine:    'jadx' | 'vineflower' (optional — backend defaults to jadx when omitted).
  // force:     re-run even if already decompiled.
  // resources: Vineflower-only — also extract decoded resources (jadx --no-src);
  //            ignored by the backend for jadx, which always includes resources.
  // Only truthy values are sent as query params.
  decompile:        (filename, { engine, force, resources } = {}) => {
    const params = {};
    if (engine)    params.engine = engine;
    if (force)     params.force = true;
    if (resources) params.resources = true;
    return http.get(`/engine/decompile/${enc(filename)}`, { params }).then(r => r.data);
  },
  // Returns { decompiled: bool, engine: <str|null> }.
  decompileCheck:   (filename) => http.get(`/engine/decompile/check/${enc(filename)}`).then(r => r.data),
  decompileStatus:  (taskId)   => http.get(`/engine/decompile/status/${taskId}`).then(r => r.data),
  getDecompiled:    (file, javaFile) =>
    http.get(`/engine/decompiled/${enc(file)}/${javaFile}`).then(r => r.data),
  batchDecompiledStatus: (file, items) =>
    http.post(`/engine/decompiled/${enc(file)}/batch-status`, { items }).then(r => r.data),
  // HEAD existence check — resolves to a boolean rather than data.
  decompiledExists: (file, name) =>
    http.head(`/engine/decompiled/${enc(file)}/${name}`)
      .then(r => r.status === 200)
      .catch(() => false),

  // Secret scanning (TruffleHog)
  trufflehogScan:    (filename) => http.post(`/engine/trufflehog/scan/${enc(filename)}`).then(r => r.data),
  trufflehogStatus:  (taskId)   => http.get(`/engine/trufflehog/scan/status/${taskId}`).then(r => r.data),
  trufflehogVersion: ()         => http.get('/engine/trufflehog/version').then(r => r.data),
}
