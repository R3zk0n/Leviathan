import { reactive } from 'vue'
import axios from 'axios'

export function useIPCMonitor(props, store) {
  // IPC Stats
  const androidIPCStats = reactive({
    totalEvents: 0,
    byType: {
      intent: 0,
      broadcast: 0,
      content_provider: 0,
      binder: 0,
      service: 0
    }
  })

  // Toggle IPC Monitor
  const onAndroidIPCMonitorToggle = async (enabled) => {
    try {
      if (enabled) {
        // Call the RPC method to start monitoring
        const rpcResponse = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
          session_id: props.sessionId || 'default',
          command: 'startIPCMonitoring()',
        })

        if (rpcResponse.data.status === 'success') {
          await startIPCMonitoring()
          return { success: true, message: 'Android IPC monitoring started' }
        } else {
          throw new Error(rpcResponse.data.message || 'Failed to start IPC monitoring via RPC')
        }
      } else {
        // Call the RPC method to stop monitoring
        const rpcResponse = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
          session_id: props.sessionId || 'default',
          command: 'stopIPCMonitoring()',
        })

        if (rpcResponse.data.status === 'success') {
          await stopIPCMonitoring()
          return { success: true, message: 'Android IPC monitoring stopped' }
        } else {
          throw new Error(rpcResponse.data.message || 'Failed to stop IPC monitoring via RPC')
        }
      }
    } catch (error) {
      console.error('Error toggling Android IPC monitoring:', error)
      // Revert the feature state
      store.commit('frida/SET_FEATURE', {
        platform: 'android',
        category: 'ipc',
        feature: 'ipcMonitor',
        value: !enabled
      })
      throw error
    }
  }

  // Start IPC Monitoring
  const startIPCMonitoring = async () => {
    store.commit('frida/SET_LOADING_FEATURE', {
      platform: 'android',
      category: 'ipc',
      feature: 'ipcMonitor',
      loading: true
    })

    try {
      const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/start-feature`, {
        session_id: props.sessionId || 'default',
        device_id: props.deviceId,
        pid: props.pid,
        platform: 'android',
        category: 'ipc',
        feature: 'ipcMonitor',
      })

      if (response.data.status === 'success') {
        // Get initial data after starting
        await fetchInitialIPCData()
      } else {
        throw new Error(response.data.message || 'Failed to start IPC monitoring')
      }
    } catch (error) {
      console.error('Error starting IPC monitoring:', error)
      throw error
    } finally {
      store.commit('frida/SET_LOADING_FEATURE', {
        platform: 'android',
        category: 'ipc',
        feature: 'ipcMonitor',
        loading: false
      })
    }
  }

  // Stop IPC Monitoring
  const stopIPCMonitoring = async () => {
    try {
      await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/stop-feature`, {
        session_id: props.sessionId || 'default',
        platform: 'android',
        category: 'ipc',
        feature: 'ipcMonitor',
      })

      // Clear stats
      resetIPCStats()
    } catch (error) {
      console.error('Error stopping IPC monitoring:', error)
      throw error
    }
  }

  // Clear IPC Events
  const clearIPCEvents = async () => {
    try {
      const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
        session_id: props.sessionId || 'default',
        command: 'clearIPCEvents()',
      })

      if (response.data.status === 'success') {
        // Update local state
        const currentOutput = store.state.frida.featureOutputs.android?.ipc?.ipcMonitor
        if (currentOutput) {
          store.commit('frida/SET_FEATURE_OUTPUT', {
            platform: 'android',
            category: 'ipc',
            feature: 'ipcMonitor',
            output: {
              ...currentOutput,
              events: [],
              statistics: {
                totalEvents: 0,
                byType: {
                  intent: 0,
                  broadcast: 0,
                  content_provider: 0,
                  binder: 0,
                  service: 0
                }
              }
            }
          })
        }

        // Reset stats
        resetIPCStats()
        return { success: true, message: 'IPC events cleared' }
      }
    } catch (error) {
      console.error('Error clearing IPC events:', error)
      throw error
    }
  }

  // Refresh IPC Monitor
  const refreshIPCMonitor = async () => {
    const isMonitoring = store.state.frida.features.android?.ipc?.ipcMonitor
    if (!isMonitoring) {
      await onAndroidIPCMonitorToggle(true)
    } else {
      store.commit('frida/SET_LOADING_FEATURE', {
        platform: 'android',
        category: 'ipc',
        feature: 'ipcMonitor',
        loading: true
      })

      try {
        await fetchInitialIPCData()
      } catch (error) {
        console.error('Error refreshing IPC monitor:', error)
        throw error
      } finally {
        store.commit('frida/SET_LOADING_FEATURE', {
          platform: 'android',
          category: 'ipc',
          feature: 'ipcMonitor',
          loading: false
        })
      }
    }
  }

  // Export IPC Data
  const exportIPCData = (data) => {
    try {
      const exportData = {
        exportInfo: {
          timestamp: new Date().toISOString(),
          sessionId: props.sessionId,
          deviceId: props.deviceId,
          pid: props.pid,
          platform: 'android'
        },
        ...data
      }

      const dataStr = JSON.stringify(exportData, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `android_ipc_analysis_${props.sessionId}_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      return { success: true, message: 'Android IPC analysis exported successfully' }
    } catch (error) {
      console.error('Android IPC export error:', error)
      throw error
    }
  }

  // Helper Functions
  const fetchInitialIPCData = async () => {
    try {
      const [eventsResponse, statsResponse] = await Promise.all([
        axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
          session_id: props.sessionId || 'default',
          command: 'getIPCEvents()',
        }),
        axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
          session_id: props.sessionId || 'default',
          command: 'getIPCStatistics()',
        })
      ])

      if (eventsResponse.data.status === 'success' && statsResponse.data.status === 'success') {
        const events = eventsResponse.data.result || eventsResponse.data.output || []
        const statistics = statsResponse.data.result || statsResponse.data.output || {}

        const combinedData = {
          events: events,
          statistics: statistics,
          active: true,
          filters: {}
        }

        store.commit('frida/SET_FEATURE_OUTPUT', {
          platform: 'android',
          category: 'ipc',
          feature: 'ipcMonitor',
          output: combinedData
        })

        updateIPCStats(combinedData)
      }
    } catch (error) {
      console.error('Error fetching initial IPC data:', error)
      throw error
    }
  }

  const updateIPCStats = (data) => {
    if (data && data.statistics) {
      androidIPCStats.totalEvents = data.statistics.totalEvents || 0
      if (data.statistics.byType) {
        Object.assign(androidIPCStats.byType, data.statistics.byType)
      }
    }
  }

  const resetIPCStats = () => {
    androidIPCStats.totalEvents = 0
    Object.keys(androidIPCStats.byType).forEach(type => {
      androidIPCStats.byType[type] = 0
    })
  }

  return {
    androidIPCStats,
    onAndroidIPCMonitorToggle,
    startIPCMonitoring,
    stopIPCMonitoring,
    clearIPCEvents,
    refreshIPCMonitor,
    exportIPCData,
    updateIPCStats
  }
}
