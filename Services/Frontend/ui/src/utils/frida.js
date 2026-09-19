// src/utils/frida.js

export function newSessionId () {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  } catch { /* fall through to the non-crypto id */ }
  return `sess-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
