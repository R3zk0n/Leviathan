// Services/Frontend/ui/src/store/modules/fridaModule.js
import axios from 'axios';

// Heartbeat interval handle (module-level so it survives across actions)
let _heartbeatTimer = null
const HEARTBEAT_INTERVAL_MS = 5000
const EVENTSOURCE_MAX_RETRIES = 3
const EVENTSOURCE_RETRY_DELAY_MS = 2000

const state = {
  // Agent state
  agent: {
    loaded: false,
    loading: false,
    unloading: false,
    error: null,
    disconnected: false,       // true when process crash / session lost detected
    disconnectReason: null,    // human-readable reason for disconnect
    lastSessionConfig: null,   // { deviceId, pid, sessionId } — for quick re-attach
    sessionInfo: {
      sessionId: null,
      deviceId: null,
      pid: null
    }
  },

  // UI state - SECTIONS ARE EXPANDED BY DEFAULT
  ui: {
    expandedSections: {
      ios: true,      // Changed to true so it's expanded by default
      android: true,  // Changed to true so it's expanded by default
    },
    expandedCategories: {
      ios: {
        frida: false,
        deviceInfo: false,
        urlScheme: false,
        ipc: false,
        crypto: false,
        decryption: false,
        app: false,
        network: false,
        system: false,
        filesystem: false,
      },
      android: {
        frida: false,
        deviceInfo: true,   // Keep this expanded by default
        ipc: false,
        filesystem: false,
        app: false,
        network: false,
        system: false,
      },
    },
    fontSize: parseInt(localStorage.getItem('fridaClicks_fontSize') || '14'),  // Default to 14
    dialogPosition: {
      width: 1000,
      height: 800,
      top: 50,
      left: window.innerWidth - 1020,
    }
  },

  // Features state
  features: {
    ios: {
      frida: {},
      urlScheme: {
        urlSchemeMonitor: false
      },
      ipc: {
        pasteboardMonitor: false,
        darwinNotificationMonitor: false,
        appGroupMonitor: false
      },
      crypto: {
        cryptoMonitor: false,
      },
      filesystem: {
        browser: false,
        monitoring: false,
      },
      appInfo: {
        methodTracing: false,
      },
      network: {
        networkMonitor: false,
        sslPinning: false,
      },
      system: {
        systemMonitor: false,
      }
    },
    android: {
      deviceInfo: {
        androidVersion: null,
        fridaVersion: null,
      },
      ipc: {
        ipcMonitor: false,
      },
      filesystem: {
        browser: false,
      },
      appInfo: {
        methodTracing: false,
      },
      network: {
        networkMonitor: false,
        sslPinning: false,
      },
      system: {
        systemMonitor: false,
      }
    }
  },

  // Feature outputs
  outputs: {
    ios: {
      frida: {
        fridaVersion: null,
        loadedBridges: null,
      },
      deviceInfo: {
        iOSDeviceInfo: null,
        fridaVersion: null,
      },
      urlScheme: {
        urlSchemeMonitor: null
      },
      ipc: {
        pasteboardMonitor: null,
        darwinNotificationMonitor: null,
        appGroupMonitor: null
      },
      appInfo: {
        basicInfo: null,
        methodTracing: '',
      },
      network: {
        networkMonitor: '',
        sslPinning: null,
      },
      system: {
        getBatteryLevel: null,
        getBatteryState: null,
        getDeviceName: null,
        getDeviceModel: null,
        getDeviceScreenResolution: null,
        getDeviceOrientation: null,
        getCompleteDeviceInfo: null,
        systemMonitor: '',
      },
      crypto: {
        cryptoMonitor: null,
      },
      decryption: {
        get_encryption_info: null,
        get_bundle_info: null,
        validate_binary: null,
        decrypt_ipa: null,
        parse_and_decrypt_ipa: null,
        get_decrypt_status: null,
      },
      filesystem: {
        browser: null,
      }
    },
    android: {
      deviceInfo: {
        androidVersion: null,
        fridaVersion: null,
      },
      ipc: {
        ipcMonitor: null,
      },
      filesystem: {
        browser: null,
      },
      appInfo: {
        basicInfo: null,
        methodTracing: '',
      },
      network: {
        networkMonitor: '',
        sslPinning: null,
      },
      system: {
        systemMonitor: '',
      }
    }
  },

  // Loading states
  loadingFeatures: {},

  // Event sources
  eventSources: new Map(),

  // Network monitoring data
  networkData: {
    ios: {
      requests: [],
      stats: {
        totalRequests: 0,
        methodBreakdown: {},
        securityStats: {}
      }
    },
    android: {
      requests: [],
      stats: {
        totalRequests: 0,
        methodBreakdown: {},
        securityStats: {}
      }
    }
  }
}

const mutations = {
  // Agent mutations
  SET_AGENT_LOADED(state, loaded) {
    state.agent.loaded = loaded
  },

  SET_AGENT_LOADING(state, loading) {
    state.agent.loading = loading
  },

  SET_AGENT_UNLOADING(state, unloading) {
    state.agent.unloading = unloading
  },

  SET_AGENT_ERROR(state, error) {
    state.agent.error = error
  },

  SET_SESSION_INFO(state, { sessionId, deviceId, pid }) {
    state.agent.sessionInfo = { sessionId, deviceId, pid }
  },

  SET_AGENT_DISCONNECTED(state, { disconnected, reason }) {
    state.agent.disconnected = disconnected
    state.agent.disconnectReason = reason || null
  },

  SAVE_LAST_SESSION_CONFIG(state) {
    const { sessionId, deviceId, pid } = state.agent.sessionInfo
    if (sessionId && deviceId && pid) {
      state.agent.lastSessionConfig = { sessionId, deviceId, pid }
    }
  },

  CLEAR_LAST_SESSION_CONFIG(state) {
    state.agent.lastSessionConfig = null
  },

  // UI mutations
  TOGGLE_SECTION(state, section) {
    state.ui.expandedSections[section] = !state.ui.expandedSections[section]
  },

  TOGGLE_CATEGORY(state, { section, category }) {
    if (!state.ui.expandedCategories[section]) {
      state.ui.expandedCategories[section] = {}
    }
    state.ui.expandedCategories[section][category] = !state.ui.expandedCategories[section][category]
  },

  EXPAND_ALL(state) {
    Object.keys(state.ui.expandedSections).forEach(section => {
      state.ui.expandedSections[section] = true
    })
    Object.keys(state.ui.expandedCategories).forEach(section => {
      Object.keys(state.ui.expandedCategories[section]).forEach(category => {
        state.ui.expandedCategories[section][category] = true
      })
    })
  },

  COLLAPSE_ALL(state) {
    Object.keys(state.ui.expandedSections).forEach(section => {
      state.ui.expandedSections[section] = false
    })
    Object.keys(state.ui.expandedCategories).forEach(section => {
      Object.keys(state.ui.expandedCategories[section]).forEach(category => {
        state.ui.expandedCategories[section][category] = false
      })
    })
  },

  SET_FONT_SIZE(state, size) {
    state.ui.fontSize = size
    localStorage.setItem('fridaClicks_fontSize', size.toString())
  },

  UPDATE_DIALOG_POSITION(state, updates) {
    Object.assign(state.ui.dialogPosition, updates)
  },

  // Feature mutations
  TOGGLE_FEATURE(state, { platform, category, feature, value }) {
    if (state.features[platform]?.[category]) {
      state.features[platform][category][feature] = value
    }
  },

  SET_FEATURE_OUTPUT(state, { platform, category, feature, output }) {
    if (!state.outputs[platform]) state.outputs[platform] = {}
    if (!state.outputs[platform][category]) state.outputs[platform][category] = {}
    state.outputs[platform][category][feature] = output
  },

  APPEND_FEATURE_OUTPUT(state, { platform, category, feature, text }) {
    // Initialize structure if it doesn't exist
    if (!state.outputs[platform]) state.outputs[platform] = {}
    if (!state.outputs[platform][category]) state.outputs[platform][category] = {}

    if (typeof state.outputs[platform][category][feature] !== 'string') {
      state.outputs[platform][category][feature] = ''
    }

    state.outputs[platform][category][feature] += text + '\n'

    // Limit the number of lines
    const lines = state.outputs[platform][category][feature].split('\n')
    if (lines.length > 2000) {
      state.outputs[platform][category][feature] = lines.slice(-2000).join('\n')
    }
  },

  CLEAR_FEATURE_OUTPUT(state, { platform, category, feature }) {
    if (state.outputs[platform]?.[category]) {
      state.outputs[platform][category][feature] =
        typeof state.outputs[platform][category][feature] === 'string' ? '' : null
    }
  },

  SET_LOADING_FEATURE(state, { platform, category, feature, loading }) {
    if (!state.loadingFeatures[platform]) state.loadingFeatures[platform] = {}
    if (!state.loadingFeatures[platform][category]) state.loadingFeatures[platform][category] = {}
    state.loadingFeatures[platform][category][feature] = loading
  },

  // Event source mutations
  ADD_EVENT_SOURCE(state, { key, source }) {
    state.eventSources.set(key, source)
  },

  REMOVE_EVENT_SOURCE(state, key) {
    if (state.eventSources.has(key)) {
      state.eventSources.get(key).close()
      state.eventSources.delete(key)
    }
  },

  CLEAR_ALL_EVENT_SOURCES(state) {
    state.eventSources.forEach(source => source.close())
    state.eventSources.clear()
  },

  // Network data mutations
  ADD_NETWORK_REQUEST(state, { platform, request }) {
    state.networkData[platform].requests.push(request)
    state.networkData[platform].stats.totalRequests++

    // Limit stored requests
    if (state.networkData[platform].requests.length > 200) {
      state.networkData[platform].requests = state.networkData[platform].requests.slice(-200)
    }
  },

  CLEAR_NETWORK_DATA(state, platform) {
    state.networkData[platform].requests = []
    state.networkData[platform].stats = {
      totalRequests: 0,
      methodBreakdown: {},
      securityStats: {}
    }
  },

  UPDATE_NETWORK_STATS(state, { platform, stats }) {
    Object.assign(state.networkData[platform].stats, stats)
  }
}

const actions = {
  // Agent actions
  async loadAgent({ commit, state, dispatch }, params) {
    commit('SET_AGENT_LOADING', true)
    commit('SET_AGENT_ERROR', null)
    commit('SET_AGENT_DISCONNECTED', { disconnected: false, reason: null })

    try {
      const cleanParams = {
        device_id: String(params.deviceId || ''),
        pid: parseInt(params.pid) || 0,
        session_id: String(params.sessionId || 'default')
      }

      console.log('Clean params for API:', cleanParams)

      const response = await axios.post(
        `${import.meta.env.VITE_APP_API_URL}/frida/load-agent`,
        cleanParams
      )

      if (response.data.status === 'success') {
        commit('SET_AGENT_LOADED', true)
        commit('SET_SESSION_INFO', {
          sessionId: cleanParams.session_id,
          deviceId: cleanParams.device_id,
          pid: cleanParams.pid
        })
        commit('SAVE_LAST_SESSION_CONFIG')

        // Start heartbeat polling
        dispatch('startHeartbeat')

        return { success: true }
      } else {
        throw new Error(response.data.message || 'Failed to load agent')
      }
    } catch (error) {
      console.error('Load agent error:', error)
      commit('SET_AGENT_ERROR', error.message)
      return { success: false, error: error.message }
    } finally {
      commit('SET_AGENT_LOADING', false)
    }
  },

  async unloadAgent({ commit, state, dispatch }) {
    commit('SET_AGENT_UNLOADING', true)

    // Stop heartbeat first
    dispatch('stopHeartbeat')

    try {
      // Clear all event sources first
      commit('CLEAR_ALL_EVENT_SOURCES')

      const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/unload-agent`, {
        session_id: state.agent.sessionInfo.sessionId || 'default',
      })

      if (response.data.status === 'success') {
        commit('SET_AGENT_LOADED', false)
        commit('SET_AGENT_ERROR', null)
        commit('SET_AGENT_DISCONNECTED', { disconnected: false, reason: null })

        // Reset all features
        Object.keys(state.features).forEach(platform => {
          Object.keys(state.features[platform]).forEach(category => {
            Object.keys(state.features[platform][category]).forEach(feature => {
              commit('TOGGLE_FEATURE', { platform, category, feature, value: false })
            })
          })
        })

        return { success: true }
      } else {
        throw new Error(response.data.message || 'Failed to unload agent')
      }
    } catch (error) {
      return { success: false, error: error.message }
    } finally {
      commit('SET_AGENT_UNLOADING', false)
    }
  },

  // --- Heartbeat: periodic health check ---
  startHeartbeat({ state, dispatch }) {
    dispatch('stopHeartbeat')
    _heartbeatTimer = setInterval(() => {
      dispatch('checkAgentHealth')
    }, HEARTBEAT_INTERVAL_MS)
  },

  stopHeartbeat() {
    if (_heartbeatTimer) {
      clearInterval(_heartbeatTimer)
      _heartbeatTimer = null
    }
  },

  async checkAgentHealth({ commit, state, dispatch }) {
    const sessionId = state.agent.sessionInfo.sessionId
    if (!sessionId || !state.agent.loaded || state.agent.disconnected) return

    try {
      const response = await axios.get(
        `${import.meta.env.VITE_APP_API_URL}/frida/agent-status/${sessionId}`,
        { timeout: 4000 }
      )

      if (response.data.status === 'active') {
        // Agent is alive — clear any transient error
        if (state.agent.error) commit('SET_AGENT_ERROR', null)
        return
      }

      // Agent reported inactive or not_loaded → process crashed
      dispatch('handleSessionCrash', response.data.message || 'Process terminated')
    } catch (error) {
      // Network error talking to backend — could be transient
      console.warn('Heartbeat check failed:', error.message)
      // Don't trigger crash on network blips; only on confirmed inactive status
    }
  },

  // --- Crash handling: central cleanup when session is lost ---
  handleSessionCrash({ commit, state, dispatch }, reason) {
    if (state.agent.disconnected) return // already handled

    console.error('Session crash detected:', reason)

    dispatch('stopHeartbeat')

    commit('SET_AGENT_DISCONNECTED', {
      disconnected: true,
      reason: reason || 'Process crashed or session lost'
    })
    commit('SET_AGENT_LOADED', false)

    // Close all EventSource streams
    commit('CLEAR_ALL_EVENT_SOURCES')

    // Reset all feature toggles
    Object.keys(state.features).forEach(platform => {
      Object.keys(state.features[platform]).forEach(category => {
        Object.keys(state.features[platform][category]).forEach(feature => {
          commit('TOGGLE_FEATURE', { platform, category, feature, value: false })
        })
      })
    })
  },

  // --- Reconnect: re-attach using last session config ---
  async reconnect({ state, dispatch, commit }) {
    const config = state.agent.lastSessionConfig
    if (!config) {
      return { success: false, error: 'No previous session to reconnect to' }
    }

    commit('SET_AGENT_DISCONNECTED', { disconnected: false, reason: null })

    return dispatch('loadAgent', {
      deviceId: config.deviceId,
      pid: config.pid,
      sessionId: config.sessionId
    })
  },

  // UI actions
  toggleSection({ commit }, section) {
    commit('TOGGLE_SECTION', section)
  },

  toggleCategory({ commit }, { section, category }) {
    commit('TOGGLE_CATEGORY', { section, category })
  },

  expandAll({ commit }) {
    commit('EXPAND_ALL')
  },

  collapseAll({ commit }) {
    commit('COLLAPSE_ALL')
  },

  setFontSize({ commit }, size) {
    commit('SET_FONT_SIZE', size)
  },

  updateDialogPosition({ commit }, updates) {
    commit('UPDATE_DIALOG_POSITION', updates)
  },


  // In fridaModule.js actions section, add:
forceStopMonitoring({ commit }, { platform, category, feature }) {
  // Force set active to false regardless of backend state
  const currentOutput = state.outputs[platform]?.[category]?.[feature] || {}
  commit('SET_FEATURE_OUTPUT', {
    platform,
    category,
    feature,
    output: {
      ...currentOutput,
      active: false
    }
  })

  // Also set feature toggle to false
  commit('TOGGLE_FEATURE', {
    platform,
    category,
    feature,
    value: false
  })

  // Close any event sources for this feature
  const key = `${platform}-${category}-${feature}`
  commit('REMOVE_EVENT_SOURCE', key)
},
  // Feature actions
  async toggleFeature({ commit }, { platform, category, feature, value }) {
    commit('TOGGLE_FEATURE', { platform, category, feature, value })
  },

  async executeFeature({ commit, state }, { platform, category, feature, command, sessionId, deviceId, pid }) {
  // Add validation
  if (!command) {
    console.error('No command provided for feature:', { platform, category, feature })
    return { success: false, error: 'No command provided' }
  }

  commit('SET_LOADING_FEATURE', { platform, category, feature, loading: true })

  try {
    const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
      session_id: sessionId || state.agent.sessionInfo.sessionId || 'default',
      command: command,
    })

    if (response.data.status === 'success') {
      const result = response.data.result || response.data.output
      commit('SET_FEATURE_OUTPUT', { platform, category, feature, output: result })
      return { success: true, result }
    } else {
      throw new Error(response.data.message || 'Failed to execute feature')
    }
  } catch (error) {
    const errorMsg = `Error: ${error.message}`
    commit('SET_FEATURE_OUTPUT', { platform, category, feature, output: errorMsg })
    return { success: false, error: error.message }
  } finally {
    commit('SET_LOADING_FEATURE', { platform, category, feature, loading: false })
  }
},

  clearFeatureOutput({ commit }, { platform, category, feature }) {
    commit('CLEAR_FEATURE_OUTPUT', { platform, category, feature })
  },

  // Event source actions with auto-reconnect
  startFeatureStream({ commit, state, dispatch }, { platform, category, feature }) {
    const key = `${platform}-${category}-${feature}`

    // Close existing source if any
    commit('REMOVE_EVENT_SOURCE', key)

    let retryCount = 0

    const createEventSource = () => {
      const eventSource = new EventSource(
        `${import.meta.env.VITE_APP_API_URL}/frida/feature-stream/${state.agent.sessionInfo.sessionId}/${platform}/${category}/${feature}`
      )

      eventSource.onmessage = (event) => {
        // Reset retry count on successful message
        retryCount = 0

        // Check for crash notification from backend
        try {
          const parsed = JSON.parse(event.data)
          if (parsed.type === 'error' && parsed.reason === 'process_crashed') {
            dispatch('handleSessionCrash', parsed.message || 'Process crashed')
            return
          }
        } catch {
          // Not JSON or no type field — normal text output
        }

        commit('APPEND_FEATURE_OUTPUT', { platform, category, feature, text: event.data })

        // Handle specific feature types
        if (feature === 'networkMonitor') {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'network_request') {
              commit('ADD_NETWORK_REQUEST', { platform, request: data })
            }
          } catch (e) {
            // Not JSON, just regular log output
          }
        }
      }

      eventSource.onerror = () => {
        console.error(`EventSource error for ${key}`)

        // If already disconnected, don't retry
        if (state.agent.disconnected) {
          commit('REMOVE_EVENT_SOURCE', key)
          return
        }

        retryCount++
        if (retryCount <= EVENTSOURCE_MAX_RETRIES) {
          console.log(`EventSource retry ${retryCount}/${EVENTSOURCE_MAX_RETRIES} for ${key}`)
          // Close current and recreate after delay
          commit('REMOVE_EVENT_SOURCE', key)
          setTimeout(() => {
            // Only retry if agent is still supposed to be loaded
            if (state.agent.loaded && !state.agent.disconnected) {
              createEventSource()
            }
          }, EVENTSOURCE_RETRY_DELAY_MS * retryCount)
        } else {
          console.error(`EventSource max retries reached for ${key}, checking agent health`)
          commit('REMOVE_EVENT_SOURCE', key)
          // Trigger a health check — if agent is dead this will fire handleSessionCrash
          dispatch('checkAgentHealth')
        }
      }

      commit('ADD_EVENT_SOURCE', { key, source: eventSource })
    }

    createEventSource()
  },

  stopFeatureStream({ commit }, { platform, category, feature }) {
    const key = `${platform}-${category}-${feature}`
    commit('REMOVE_EVENT_SOURCE', key)
  },

  // Cleanup
  cleanup({ commit, dispatch }) {
    dispatch('stopHeartbeat')
    commit('CLEAR_ALL_EVENT_SOURCES')
  }
}

const getters = {
  // Agent getters
  isAgentLoaded: state => state.agent.loaded,
  isAgentLoading: state => state.agent.loading,
  isAgentUnloading: state => state.agent.unloading,
  agentError: state => state.agent.error,
  isAgentDisconnected: state => state.agent.disconnected,
  disconnectReason: state => state.agent.disconnectReason,
  lastSessionConfig: state => state.agent.lastSessionConfig,
  sessionInfo: state => state.agent.sessionInfo,

  // UI getters
  expandedSections: state => state.ui.expandedSections,
  expandedCategories: state => state.ui.expandedCategories,
  fontSize: state => state.ui.fontSize,
  dialogPosition: state => state.ui.dialogPosition,

  // Feature getters
  features: state => state.features,
  outputs: state => state.outputs,
  loadingFeatures: state => state.loadingFeatures,

  isFeatureActive: state => (platform, category, feature) => state.features[platform]?.[category]?.[feature] || false,
  getFeatureOutput: state => (platform, category, feature) => state.outputs[platform]?.[category]?.[feature] || null,
  isFeatureLoading: state => (platform, category, feature) => state.loadingFeatures[platform]?.[category]?.[feature] || false,

  getActiveFeatureCount: state => platform => {
    let count = 0
    if (state.features[platform]) {
      Object.values(state.features[platform]).forEach(category => {
        Object.values(category).forEach(feature => {
          if (feature) count++
        })
      })
    }
    return count
  },

  getTotalActiveFeatures: state => {
    let count = 0
    Object.keys(state.features).forEach(platform => {
      Object.values(state.features[platform]).forEach(category => {
        Object.values(category).forEach(feature => {
          if (feature) count++
        })
      })
    })
    return count
  },

  // Network getters
  getNetworkRequests: state => platform => state.networkData[platform].requests,
  getNetworkStats: state => platform => state.networkData[platform].stats
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}
