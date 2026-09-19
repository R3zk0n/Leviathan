// src/utils/frida.js
// Shared helpers for the Frida UI.

// A Frida "session id" correlates one attach/spawn across every backend call:
// /frida/repl/init, /frida/execute, /frida/load-agent, the /frida/hooks SSE
// stream, and /frida/kill_script all key their in-memory state off it. It must be
//   - unique per attach/spawn, so two sessions never collide in the backend's
//     per-session dicts (hook_queues / repl_sessions / active_scripts), and
//   - stable for the life of that session, so the hook stream and the command
//     that produced its output share one key.
// The old default of 'default' violated both, which is why output crossed between
// sessions and the SSE guard (`if (sessionId && ...)`) sometimes never opened.
//
// crypto.randomUUID needs a secure context (localhost qualifies); fall back for
// older browsers or insecure origins.
export function newSessionId () {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  } catch { /* fall through to the non-crypto id */ }
  return `sess-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
