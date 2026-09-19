

import axios from 'axios'

const BASE_URL = import.meta.env.VITE_APP_API_URL || ''


const IOS_API_URL = import.meta.env.VITE_IOS_API_URL || ''
const IOS_PATH_RE = /^\/(ios|disas)(\/|$)/

function iosOriginFor (url = '') {
  if (!IOS_API_URL) return null
  // Normalise: axios may hand us a full URL (raw-axios call sites) or a path.
  let path = url
  if (/^https?:\/\//i.test(url)) {
    try { path = new URL(url).pathname } catch { return null }
  } else if (BASE_URL && url.startsWith(BASE_URL)) {
    path = url.slice(BASE_URL.length)
  }
  return IOS_PATH_RE.test(path) ? { path } : null
}

// Rewrite a config in place so /ios and /disas hit IOS_API_URL. Works whether the
// call used the shared `http` instance (relative path + baseURL) or raw axios
// with a hand-built `${VITE_APP_API_URL}/disas/...` absolute URL.
function routeIosRequest (config) {
  const target = iosOriginFor(config.url || '')
  if (!target) return config
  config.baseURL = IOS_API_URL
  config.url = target.path
  return config
}

const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'
let authSessionVersion = 0

export function getAuthSessionVersion () {
  return authSessionVersion
}

function sessionChangedError () {
  const error = new Error('Session changed while the request was running')
  error.code = 'AUTH_SESSION_CHANGED'
  return error
}

function getAccessToken () {
  try { return localStorage.getItem(ACCESS_TOKEN_KEY) || '' } catch { return '' }
}
function getRefreshToken () {
  try { return localStorage.getItem(REFRESH_TOKEN_KEY) || '' } catch { return '' }
}
function setTokens ({ accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}
export function clearAuthSession () {
  authSessionVersion += 1
  refreshInFlight = null
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  delete axios.defaults.headers.common.Authorization
  delete axios.defaults.headers.common.authorization
  delete http.defaults.headers.common.Authorization
  delete http.defaults.headers.common.authorization
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('leviathan:logout'))
}

// Single in-flight refresh promise so concurrent 401s don't all hit /auth/refresh.
let refreshInFlight = null

function refreshAccessToken () {
  if (refreshInFlight) return refreshInFlight
  const refreshToken = getRefreshToken()
  if (!refreshToken) return Promise.reject(new Error('no_refresh_token'))
  const sessionVersion = authSessionVersion

  // A separate instance really has no auth/refresh interceptors or stale defaults.
  const pending = refreshHttp
    .post('/auth/refresh', { refresh_token: refreshToken })
    .then(resp => {
      if (sessionVersion !== authSessionVersion || refreshToken !== getRefreshToken()) {
        throw sessionChangedError()
      }
      const accessToken = resp?.data?.access_token
      const newRefreshToken = resp?.data?.refresh_token
      if (!accessToken) throw new Error('refresh_no_access_token')
      setTokens({ accessToken, refreshToken: newRefreshToken })
      return accessToken
    })
    .finally(() => {
      if (refreshInFlight === pending) refreshInFlight = null
    })

  refreshInFlight = pending
  return pending
}

// The shared instance. Most code should import this rather than plain axios.
const http = axios.create({
  baseURL: BASE_URL,
  // 30s default; Frida REPL/long polls should set their own override.
  timeout: 30000,
})
const refreshHttp = axios.create({ baseURL: BASE_URL, timeout: 30000 })

function attachAuthHeader (config) {
  // Redirect /ios and /disas to the ios-analysis origin before auth is attached
  // (the header is origin-agnostic, so order only matters for correctness of url).
  routeIosRequest(config)
  // Only explicit logout may carry the captured token after local cleanup.
  const token = config._logoutToken || getAccessToken()
  config._authSessionVersion = authSessionVersion
  config.headers = config.headers || {}
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  } else {
    delete config.headers.Authorization
    delete config.headers.authorization
  }
  return config
}

function isAuthEndpoint (url = '') {
  // Don't try to refresh on the auth endpoints themselves.
  return /\/auth\/(login|refresh|register|logout)\b/.test(url)
}

function buildResponseInterceptor (router, store) {
  return async function onError (error) {
    const original = error?.config
    const status = error?.response?.status

    // Network error / no response → just bubble up.
    if (!original || !error?.response) return Promise.reject(error)

    // Don't loop on auth endpoints, and only retry once per request.
    if (status === 401 && !original._retried && !isAuthEndpoint(original.url || '')) {
      if (original._authSessionVersion !== authSessionVersion) return Promise.reject(error)
      original._retried = true
      try {
        const newToken = await refreshAccessToken()
        if (original._authSessionVersion !== authSessionVersion) throw sessionChangedError()
        // Push token into Vuex if available so other consumers stay in sync.
        if (store?.commit) {
          try { store.commit('setAccessToken', newToken) } catch { /* non-fatal */ }
        }
        original.headers = original.headers || {}
        original.headers.Authorization = `Bearer ${newToken}`
        return http(original)
      } catch (refreshErr) {
        // A response for a previous login must not restore or clear a new session.
        if (refreshErr.code === 'AUTH_SESSION_CHANGED' || original._authSessionVersion !== authSessionVersion) {
          return Promise.reject(refreshErr)
        }
        // Refresh failed → user genuinely needs to log in again.
        if (store?.commit) {
          try { store.commit('clearAuthData') } catch { /* non-fatal */ }
        } else clearAuthSession()
        if (router) {
          const current = router.currentRoute?.value
          const redirect = current?.fullPath && current.fullPath !== '/login'
            ? current.fullPath
            : undefined
          // Avoid pushing /login on top of /login.
          if (current?.path !== '/login') {
            router.push({ path: '/login', query: redirect ? { redirect } : {} })
          }
        }
        return Promise.reject(refreshErr)
      }
    }

    return Promise.reject(error)
  }
}

let installed = false

/**
 * Wire the HTTP client into the app. Call this from main.js BEFORE app.mount().
 *
 * This:
 *  - registers the request/response interceptors on our shared `http` instance,
 *  - registers the SAME interceptors on the global `axios` so that every
 *    pre-existing `import axios from 'axios'` call site picks up the auth
 *    header and 401-refresh behaviour without needing a code change.
 */
export function installHttp ({ router, store } = {}) {
  if (installed) return
  installed = true

  // Seed the global axios default header from localStorage so any module that
  // captured `axios.defaults.headers.common.Authorization` already has the
  // token after a hard reload.
  const token = getAccessToken()
  if (token) {
    axios.defaults.headers.common.Authorization = `Bearer ${token}`
  }

  // ── shared instance ────────────────────────────────────────────────────────
  http.interceptors.request.use(attachAuthHeader)
  http.interceptors.response.use(r => r, buildResponseInterceptor(router, store))

  // ── global axios (covers existing call sites) ──────────────────────────────
  axios.interceptors.request.use(attachAuthHeader)
  axios.interceptors.response.use(r => r, buildResponseInterceptor(router, store))
}

export default http

