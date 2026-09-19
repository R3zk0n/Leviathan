// EventSource-compatible reader for protected API streams. Credentials stay in
// the Authorization header, never in URLs, proxy logs or browser history.
const API_BASE_URL = import.meta.env.VITE_APP_API_URL || ''

export class SseDecoder {
  constructor (onEvent, onRetry = () => {}) {
    this.onEvent = onEvent
    this.onRetry = onRetry
    this.buffer = ''
    this.data = []
    this.type = ''
    this.id = ''
  }

  feed (chunk) {
    this.buffer += chunk
    let match
    while ((match = /\r\n|\r|\n/.exec(this.buffer))) {
      // A CR at the chunk boundary may be followed by LF in the next chunk.
      if (match[0] === '\r' && match.index === this.buffer.length - 1) break
      const line = this.buffer.slice(0, match.index)
      this.buffer = this.buffer.slice(match.index + match[0].length)
      if (!line) {
        if (this.data.length) {
          this.onEvent({ type: this.type || 'message', data: this.data.join('\n'), id: this.id })
        }
        this.data = []
        this.type = ''
        continue
      }
      if (line.startsWith(':')) continue
      const colon = line.indexOf(':')
      const field = colon < 0 ? line : line.slice(0, colon)
      let value = colon < 0 ? '' : line.slice(colon + 1)
      if (value.startsWith(' ')) value = value.slice(1)
      if (field === 'data') this.data.push(value)
      else if (field === 'event') this.type = value
      else if (field === 'id' && !value.includes('\0')) this.id = value
      else if (field === 'retry' && /^\d+$/.test(value)) this.onRetry(Number(value))
    }
  }
}

function accessToken () {
  try { return localStorage.getItem('access_token') || '' } catch { return '' }
}

export default class AuthenticatedEventSource extends EventTarget {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSED = 2
  CONNECTING = 0
  OPEN = 1
  CLOSED = 2

  constructor (url) {
    super()
    const base = new URL(API_BASE_URL || '/', window.location.href)
    const target = new URL(url, window.location.href)
    const prefix = base.pathname.replace(/\/+$/, '') + '/frida/'
    if (target.origin !== base.origin ||
        !['hooks/', 'feature-stream/'].some(path => target.pathname.startsWith(prefix + path)) ||
        target.username || target.password) {
      throw new TypeError('Stream must use the configured backend and a supported stream route')
    }
    this.url = target.href
    this.withCredentials = false
    this.readyState = this.CONNECTING
    this.onopen = null
    this.onmessage = null
    this.onerror = null
    this.retry = 3000
    this.lastEventId = ''
    this.controller = null
    this.timer = null
    this.onLogout = () => this.close()
    this.onStorage = event => {
      if (event.key === null || (event.key === 'access_token' && event.newValue === null)) this.close()
    }
    window.addEventListener('leviathan:logout', this.onLogout)
    window.addEventListener('storage', this.onStorage)
    // Match EventSource: consumers can attach handlers after construction.
    queueMicrotask(() => this.connect())
  }

  emit (event) {
    this.dispatchEvent(event)
    const handler = this['on' + event.type]
    if (typeof handler === 'function') handler.call(this, event)
  }

  async connect () {
    if (this.readyState === this.CLOSED) return
    const token = accessToken()
    if (!token) {
      this.close()
      this.emit(new Event('error'))
      return
    }
    this.controller = new AbortController()
    let reader
    try {
      const headers = { Accept: 'text/event-stream', Authorization: 'Bearer ' + token }
      if (this.lastEventId) headers['Last-Event-ID'] = this.lastEventId
      const response = await fetch(this.url, {
        headers,
        signal: this.controller.signal,
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
      })
      if ([204, 401, 403].includes(response.status)) {
        this.close()
        if (response.status !== 204) this.emit(new Event('error'))
        return
      }
      if (!response.ok || !response.headers.get('content-type')?.startsWith('text/event-stream') || !response.body) {
        throw new Error('Stream unavailable')
      }
      if (this.readyState === this.CLOSED) return
      this.readyState = this.OPEN
      this.emit(new Event('open'))
      const decoder = new TextDecoder()
      const parser = new SseDecoder(({ type, data, id }) => {
        if (this.readyState === this.CLOSED) return
        this.lastEventId = id
        this.emit(new MessageEvent(type, { data, lastEventId: id, origin: new URL(this.url).origin }))
      }, retry => { this.retry = Math.max(1000, Math.min(retry, 30000)) })
      reader = response.body.getReader()
      while (this.readyState !== this.CLOSED) {
        const { value, done } = await reader.read()
        if (done) break
        if (!accessToken()) { this.close(); break }
        parser.feed(decoder.decode(value, { stream: true }))
      }
    } catch {
      // Handlers receive the same generic error event as native EventSource.
    } finally {
      if (reader) {
        try { await reader.cancel() } catch { /* already aborted */ }
        reader.releaseLock()
      }
      this.controller?.abort()
      if (this.readyState !== this.CLOSED) {
        this.readyState = this.CONNECTING
        this.emit(new Event('error'))
        if (this.readyState !== this.CLOSED) {
          this.timer = setTimeout(() => this.connect(), this.retry)
        }
      }
    }
  }

  close () {
    this.readyState = this.CLOSED
    clearTimeout(this.timer)
    this.controller?.abort()
    window.removeEventListener('leviathan:logout', this.onLogout)
    window.removeEventListener('storage', this.onStorage)
  }
}
