// src/utils/http.js
//
// Centralized axios HTTP client for the whole app.
//
// Why this exists:
//  - Previously the Authorization header was only set inside the `login`/`refresh`
//    Vuex actions via `axios.defaults.headers.common.Authorization = ...`. That
//    in-memory default was lost on every full-page reload (incl. Vite dep-optimize
//    reloads), so the very first protected request after a reload went out
//    UN-authenticated, the backend returned 401, and pages rendered as if the
//    user "got bounced out" even though localStorage still had a valid token.
//
// What this gives us:
//  - A request interceptor that ALWAYS reads the latest access_token from
//    localStorage and attaches it before every request.
//  - A response interceptor that, on 401, transparently calls /auth/refresh
//    once and replays the original request. If that fails, we clear auth and
//    push the user to /login (with a redirect query so they bounce back to
//    where they were going, not back to /).
//  - A single configured baseURL so individual components don't have to
//    keep concatenating `${import.meta.env.VITE_APP_API_URL}` everywhere.
//
// Usage:
//   import http from '@/utils/http'
//   const { data } = await http.get('/engine/settings')
//
// Existing call sites that use plain `axios` will keep working because we also
// register the interceptors on the global axios instance via `installHttp()`.

import axios from 'axios'

// `VITE_APP_API_URL` is injected by vite.config.mjs at build time. We fall back
// to '' so when not set we use relative paths (good for nginx-proxied prod).
const BASE_URL = import.meta.env.VITE_APP_API_URL || ''

// The /ios and /disas routes are served by a separate `ios-analysis` container
// (amd64/Rosetta) so the strongarm-dataflow x86_64 wheel is available, while the
// main backend runs native arm64 with frida. If VITE_IOS_API_URL is set we
// rewrite those requests to that origin; otherwise they stay on BASE_URL (the
// single-image x86_64 case, or nginx-proxied prod where location blocks route it).
const IOS_API_URL = import.meta.env.VITE_IOS_API_URL || ''
const IOS_PATH_RE = /^\/(ios|disas)(\/|$)/

// Given a request URL (absolute or path), return the ios origin override if the
// path targets an ios-analysis route, else null (leave the request untouched).
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
function clearTokens () {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

// Single in-flight refresh promise so concurrent 401s don't all hit /auth/refresh.
let refreshInFlight = null

function refreshAccessToken () {
  if (refreshInFlight) return refreshInFlight
  const refreshToken = getRefreshToken()
  if (!refreshToken) return Promise.reject(new Error('no_refresh_token'))

  // Use a bare axios call to avoid recursion into the interceptors.
  refreshInFlight = axios
    .post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken })
    .then(resp => {
      const accessToken = resp?.data?.access_token
      const newRefreshToken = resp?.data?.refresh_token
      if (!accessToken) throw new Error('refresh_no_access_token')
      setTokens({ accessToken, refreshToken: newRefreshToken })
      return accessToken
    })
    .finally(() => {
      refreshInFlight = null
    })

  return refreshInFlight
}

// The shared instance. Most code should import this rather than plain axios.
const http = axios.create({
  baseURL: BASE_URL,
  // 30s default; Frida REPL/long polls should set their own override.
  timeout: 30000,
})

function attachAuthHeader (config) {
  // Redirect /ios and /disas to the ios-analysis origin before auth is attached
  // (the header is origin-agnostic, so order only matters for correctness of url).
  routeIosRequest(config)
  const token = getAccessToken()
  if (token) {
    config.headers = config.headers || {}
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
}

function isAuthEndpoint (url = '') {
  // Don't try to refresh on the auth endpoints themselves.
  return /\/auth\/(login|refresh|register)\b/.test(url)
}

function buildResponseInterceptor (router, store) {
  return async function onError (error) {
    const original = error?.config
    const status = error?.response?.status

    // Network error / no response → just bubble up.
    if (!original || !error?.response) return Promise.reject(error)

    // Don't loop on auth endpoints, and only retry once per request.
    if (status === 401 && !original._retried && !isAuthEndpoint(original.url || '')) {
      original._retried = true
      try {
        const newToken = await refreshAccessToken()
        // Push token into Vuex if available so other consumers stay in sync.
        if (store?.commit) {
          try { store.commit('setAccessToken', newToken) } catch { /* non-fatal */ }
        }
        original.headers = original.headers || {}
        original.headers.Authorization = `Bearer ${newToken}`
        return http(original)
      } catch (refreshErr) {
        // Refresh failed → user genuinely needs to log in again.
        clearTokens()
        if (store?.commit) {
          try { store.commit('clearAuthData') } catch { /* non-fatal */ }
        }
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

