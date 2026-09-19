// Android app upload / manifest / component endpoints (/audit).
import http from '@/utils/http'

const enc = encodeURIComponent

export const auditApi = {
  // Upload & lifecycle
  upload: (formData) =>
    http.post('/audit/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data),
  deleteApp: (app) => http.delete(`/audit/delete/${enc(app)}`).then(r => r.data),
  listFiles: ()    => http.get('/audit/files').then(r => r.data),

  // App metadata
  getDetails:   (app) => http.get(`/audit/details/${enc(app)}`).then(r => r.data),
  getResults:   (app) => http.get(`/audit/results/${enc(app)}`).then(r => r.data),
  getManifest:  (app) => http.get(`/audit/manifest/${enc(app)}`).then(r => r.data),
  getRecon:     (app) => http.get(`/audit/recon/${enc(app)}`).then(r => r.data),

  // Components
  getActivities: (app) => http.get(`/audit/activities/${enc(app)}`).then(r => r.data),
  getServices:   (app) => http.get(`/audit/services/${enc(app)}`).then(r => r.data),
  getReceivers:  (app) => http.get(`/audit/receivers/${enc(app)}`).then(r => r.data),
  getProviders:  (app) => http.get(`/audit/providers/${enc(app)}`).then(r => r.data),

  // Component accessibility
  componentStatus: (app, name) =>
    http.get(`/audit/component-status/${enc(app)}/${enc(name)}`).then(r => r.data),
  componentStatusBatch: (app, names) =>
    http.post(`/audit/component-status-batch/${enc(app)}`, { components: names }).then(r => r.data),
}
