// composables/useAgentManager.js
import { computed } from 'vue'
import { useStore } from 'vuex'

export function useAgentManager({ deviceId, pid, sessionId, showNotification }) {
  const store = useStore()

  // All state from Vuex store
  const agentLoaded = computed(() => store.getters['frida/isAgentLoaded'])
  const agentLoading = computed(() => store.getters['frida/isAgentLoading'])
  const agentUnloading = computed(() => store.getters['frida/isAgentUnloading'] || false)
  const agentError = computed(() => store.getters['frida/agentError'])

  // Methods that dispatch to Vuex store
  const loadAgent = async () => {
    if (agentLoading.value || agentLoaded.value) {
      showNotification('Agent is already loaded or loading', 'info')
      return
    }

    // Pass simple values to the store action
    const result = await store.dispatch('frida/loadAgent', {
      deviceId: deviceId,
      pid: pid,
      sessionId: sessionId
    })

    if (result.success) {
      showNotification('Frida agent loaded successfully', 'success')
    } else {
      showNotification(`Failed to load agent: ${result.error}`, 'error', 5000)
    }
  }

  const unloadAgent = async () => {
    if (!agentLoaded.value) {
      showNotification('Agent is not loaded', 'info')
      return
    }

    if (agentUnloading.value) {
      showNotification('Agent is already being unloaded', 'info')
      return
    }

    const result = await store.dispatch('frida/unloadAgent')

    if (result.success) {
      showNotification('Agent unloaded successfully', 'success')
      window.dispatchEvent(new CustomEvent('frida:agent:unloaded'))
    } else {
      showNotification(`Failed to unload agent: ${result.error}`, 'error')
    }
  }

  const refreshAgent = async () => {
    try {
      if (agentLoaded.value) {
        showNotification('Refreshing agent...', 'info')

        const unloadResult = await store.dispatch('frida/unloadAgent')

        if (!unloadResult.success) {
          showNotification(`Failed to refresh: ${unloadResult.error}`, 'error')
          return
        }

        await new Promise(resolve => setTimeout(resolve, 500))

        const loadResult = await store.dispatch('frida/loadAgent', {
          deviceId: deviceId,
          pid: pid,
          sessionId: sessionId
        })

        if (loadResult.success) {
          showNotification('Agent refreshed successfully', 'success')
        } else {
          showNotification(`Failed to reload agent: ${loadResult.error}`, 'error')
        }
      } else {
        store.dispatch('frida/cleanup')
        showNotification('Agent state cleaned up', 'success')
      }

      window.dispatchEvent(new CustomEvent('frida:agent:refresh'))
    } catch (error) {
      console.error('Error refreshing agent:', error)
      showNotification('Failed to refresh agent', 'error')
    }
  }

  return {
    agentLoaded,
    agentLoading,
    agentUnloading,
    agentError,
    loadAgent,
    unloadAgent,
    refreshAgent
  }
}
