// services/fridaAPI.js
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_APP_API_URL || '/api'

class FridaAPIService {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    // Add request/response interceptors if needed
    this.setupInterceptors()
  }

  setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add auth token if available
        const token = localStorage.getItem('auth_token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        // Handle common errors
        if (error.response?.status === 401) {
          // Handle unauthorized
          window.dispatchEvent(new CustomEvent('auth:unauthorized'))
        }
        return Promise.reject(error)
      }
    )
  }

  // Agent Management
  async loadAgent(params) {
    return this.client.post('/frida/load-agent', params)
  }

  async unloadAgent(params) {
    return this.client.post('/frida/unload-agent', params)
  }

  async executeWithAgent(params) {
    return this.client.post('/frida/execute-with-agent', params)
  }

  // Feature Management
  async startFeature(params) {
    return this.client.post('/frida/start-feature', params)
  }

  async stopFeature(params) {
    return this.client.post('/frida/stop-feature', params)
  }

  // Event Streams
  createEventSource(sessionId, platform, category, feature) {
    const url = `${API_BASE_URL}/frida/feature-stream/${sessionId}/${platform}/${category}/${feature}`
    return new EventSource(url)
  }

  // iOS Specific
  async executeIOSFeature(sessionId, command) {
    return this.executeWithAgent({
      session_id: sessionId,
      command: command
    })
  }

  // Android Specific
  async executeAndroidFeature(sessionId, command) {
    return this.executeWithAgent({
      session_id: sessionId,
      command: command
    })
  }

  // Network Monitoring
  async startNetworkMonitoring(params) {
    return this.startFeature({
      ...params,
      category: 'network',
      feature: 'networkMonitor'
    })
  }

  async stopNetworkMonitoring(params) {
    return this.stopFeature({
      ...params,
      category: 'network',
      feature: 'networkMonitor'
    })
  }

  // IPC Monitoring (Android)
  async startIPCMonitoring(sessionId) {
    return this.executeWithAgent({
      session_id: sessionId,
      command: 'startIPCMonitoring()'
    })
  }

  async stopIPCMonitoring(sessionId) {
    return this.executeWithAgent({
      session_id: sessionId,
      command: 'stopIPCMonitoring()'
    })
  }

  async getIPCEvents(sessionId) {
    return this.executeWithAgent({
      session_id: sessionId,
      command: 'getIPCEvents()'
    })
  }

  async getIPCStatistics(sessionId) {
    return this.executeWithAgent({
      session_id: sessionId,
      command: 'getIPCStatistics()'
    })
  }

  async clearIPCEvents(sessionId) {
    return this.executeWithAgent({
      session_id: sessionId,
      command: 'clearIPCEvents()'
    })
  }

  // SSL Pinning (Android)
  async discoverSSLHooks(sessionId) {
    return this.executeWithAgent({
      session_id: sessionId,
      command: 'discoverSSLHooks()'
    })
  }

  async getSSLHookStatus(sessionId) {
    return this.executeWithAgent({
      session_id: sessionId,
      command: 'getSSLHookStatus()'
    })
  }

  async toggleSSLHook(sessionId, hookId, enabled) {
    return this.executeWithAgent({
      session_id: sessionId,
      command: `toggleSSLHook("${hookId}", ${enabled})`
    })
  }

  async setSSLBypass(sessionId, hookId, bypass) {
    return this.executeWithAgent({
      session_id: sessionId,
      command: `setSSLBypass("${hookId}", ${bypass})`
    })
  }

  async getSSLEvents(sessionId) {
    return this.executeWithAgent({
      session_id: sessionId,
      command: 'getSSLEvents()'
    })
  }

  async clearSSLEvents(sessionId) {
    return this.executeWithAgent({
      session_id: sessionId,
      command: 'clearSSLEvents()'
    })
  }

  async disableAllSSLHooks(sessionId) {
    return this.executeWithAgent({
      session_id: sessionId,
      command: 'disableAllSSLHooks()'
    })
  }

  // Filesystem Operations (iOS)
  async listDirectory(sessionId, path) {
    return this.executeWithAgent({
      session_id: sessionId,
      command: `listDirectory("${path}")`
    })
  }

  async getFileInfo(sessionId, path) {
    return this.executeWithAgent({
      session_id: sessionId,
      command: `getFileInfo("${path}")`
    })
  }

  async readFile(sessionId, path, encoding = 'utf8') {
    return this.executeWithAgent({
      session_id: sessionId,
      command: `readFile("${path}", "${encoding}")`
    })
  }

  async writeFile(sessionId, path, content) {
    return this.executeWithAgent({
      session_id: sessionId,
      command: `writeFile("${path}", ${JSON.stringify(content)})`
    })
  }

  async deleteFile(sessionId, path) {
    return this.executeWithAgent({
      session_id: sessionId,
      command: `deleteFile("${path}")`
    })
  }

  async createDirectory(sessionId, path) {
    return this.executeWithAgent({
      session_id: sessionId,
      command: `createDirectory("${path}")`
    })
  }
}

// Export singleton instance
export const fridaAPI = new FridaAPIService()
