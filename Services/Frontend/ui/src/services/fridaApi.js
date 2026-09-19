// Frida dynamic-instrumentation endpoints (/frida).
//
// Note: streaming endpoints (feature-stream, bridges) are consumed as raw URLs
// by EventSource, not via this client — use `featureStreamUrl(...)`
// to build them with the configured base.
import http from '@/utils/http'

const enc = encodeURIComponent
const BASE = import.meta.env.VITE_APP_API_URL || ''

export const fridaApi = {
  // Devices & processes
  devices:      ()         => http.get('/frida/devices').then(r => r.data),
  list:         ()         => http.get('/frida/list').then(r => r.data),
  applications: (deviceId) => http.get(`/frida/applications/${enc(deviceId)}`).then(r => r.data),

  // Session lifecycle
  spawn:        (body) => http.post('/frida/spawn', body).then(r => r.data),
  attach:       (body) => http.post('/frida/attach', body).then(r => r.data),
  attachRemote: (body) => http.post('/frida/attach-remote', body).then(r => r.data),
  detach:       (body) => http.post('/frida/detach', body).then(r => r.data),

  // Script / agent execution
  execute:            (body) => http.post('/frida/execute', body).then(r => r.data),
  executeWithAgent:   (body) => http.post('/frida/execute-with-agent', body).then(r => r.data),
  loadAgent:          (body) => http.post('/frida/load-agent', body).then(r => r.data),
  unloadAgent:        (body) => http.post('/frida/unload-agent', body).then(r => r.data),
  agentStatus:        (id)   => http.get(`/frida/agent-status/${enc(id)}`).then(r => r.data),
  replInit:           (body) => http.post('/frida/repl/init', body).then(r => r.data),
  runPersistentScript:(body) => http.post('/frida/run_persistent_script', body).then(r => r.data),
  killScript:         (body) => http.post('/frida/kill_script', body).then(r => r.data),

  // Features
  startFeature: (body) => http.post('/frida/start-feature', body).then(r => r.data),
  stopFeature:  (body) => http.post('/frida/stop-feature', body).then(r => r.data),
  getHooks:     (id)   => http.get(`/frida/hooks/${enc(id)}`).then(r => r.data),

  // Raw stream URL for EventSource (not fetched through http)
  featureStreamUrl: (sessionId, feature) =>
    `${BASE}/frida/feature-stream/${enc(sessionId)}/${enc(feature)}`,
}
