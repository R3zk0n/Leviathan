// Centralised API service layer.
//
// Every module here wraps the shared `http` client (src/utils/http.js), which
// already handles the base URL, the Authorization header, and 401 refresh.
// Components should import from here instead of calling `axios` with hand-built
// `${VITE_APP_API_URL}/...` URLs.
//
// Convention: methods return the parsed response body (`res.data`). The few
// that need the raw response/status say so in their name (e.g. `*Exists`).
//
//   import { engineApi } from '@/services'
//   const results = await engineApi.getResults(appId)

export { authApi } from './authApi'
export { usersApi } from './usersApi'
export { auditApi } from './auditApi'
export { engineApi } from './engineApi'
export { fridaApi } from './fridaApi'
export { iosApi } from './iosApi'
