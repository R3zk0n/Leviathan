// iOS binary analysis / decompilation endpoints (/ios).
import http from '@/utils/http'

const enc = encodeURIComponent

export const iosApi = {
  getInfo:         (app) => http.get(`/ios/info/${enc(app)}`).then(r => r.data),
  getClasses:      (app) => http.get(`/ios/classes/${enc(app)}`).then(r => r.data),
  getFunctions:    (app) => http.get(`/ios/functions/${enc(app)}`).then(r => r.data),
  getStrings:      (app) => http.get(`/ios/strings/${enc(app)}`).then(r => r.data),
  getSymbols:      (app) => http.get(`/ios/symbols/${enc(app)}`).then(r => r.data),
  getEntitlements: (app) => http.get(`/ios/entitlements/${enc(app)}`).then(r => r.data),
  getPermissions:  (app) => http.get(`/ios/permissions/${enc(app)}`).then(r => r.data),
  getPlist:        (app) => http.get(`/ios/plist/${enc(app)}`).then(r => r.data),

  // Per-class introspection
  getClassMethods: (cls)  => http.get(`/ios/${enc(cls)}/methods`).then(r => r.data),
  getClassStrings: (cls)  => http.get(`/ios/${enc(cls)}/strings`).then(r => r.data),
}
