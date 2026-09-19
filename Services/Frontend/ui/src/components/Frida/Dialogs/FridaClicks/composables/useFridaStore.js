// src/components/Frida/Dialogs/FridaClicks/composables/useFridaStore.js
import { computed } from 'vue'
import { useStore } from 'vuex'

/**
 * Helper composable to easily access Frida module in Vuex
 */
export function useFridaStore() {
  const store = useStore()

  // Agent state
  const agentLoaded = computed(() => store.getters['frida/isAgentLoaded'])
  const agentLoading = computed(() => store.getters['frida/isAgentLoading'])
  const agentError = computed(() => store.getters['frida/agentError'])
  const sessionInfo = computed(() => store.getters['frida/sessionInfo'])

  // UI state
  const fontSize = computed(() => store.getters['frida/fontSize'])
  const expandedSections = computed(() => store.getters['frida/expandedSections'])
  const expandedCategories = computed(() => store.getters['frida/expandedCategories'])

  // Feature state
  const features = computed(() => store.getters['frida/features'])
  const outputs = computed(() => store.getters['frida/outputs'])
  const loadingFeatures = computed(() => store.getters['frida/loadingFeatures'])

  // Feature methods
  const isFeatureActive = (platform, category, feature) => {
    return store.getters['frida/isFeatureActive'](platform, category, feature)
  }

  const getFeatureOutput = (platform, category, feature) => {
    return store.getters['frida/getFeatureOutput'](platform, category, feature)
  }

  const isFeatureLoading = (platform, category, feature) => {
    return store.getters['frida/isFeatureLoading'](platform, category, feature)
  }

  // Actions
  const loadAgent = (params) => store.dispatch('frida/loadAgent', params)
  const unloadAgent = () => store.dispatch('frida/unloadAgent')
  const toggleSection = (section) => store.dispatch('frida/toggleSection', section)
  const toggleCategory = (params) => store.dispatch('frida/toggleCategory', params)
  const expandAll = () => store.dispatch('frida/expandAll')
  const collapseAll = () => store.dispatch('frida/collapseAll')
  const setFontSize = (size) => store.dispatch('frida/setFontSize', size)

  const toggleFeature = (params) => store.dispatch('frida/toggleFeature', params)
  const executeFeature = (params) => store.dispatch('frida/executeFeature', params)
  const clearFeatureOutput = (params) => store.dispatch('frida/clearFeatureOutput', params)

  const startFeatureStream = (params) => store.dispatch('frida/startFeatureStream', params)
  const stopFeatureStream = (params) => store.dispatch('frida/stopFeatureStream', params)

  // Network data
  const getNetworkRequests = (platform) => store.getters['frida/getNetworkRequests'](platform)
  const getNetworkStats = (platform) => store.getters['frida/getNetworkStats'](platform)

  return {
    // State
    agentLoaded,
    agentLoading,
    agentError,
    sessionInfo,
    fontSize,
    expandedSections,
    expandedCategories,
    features,
    outputs,
    loadingFeatures,

    // Getters
    isFeatureActive,
    getFeatureOutput,
    isFeatureLoading,
    getNetworkRequests,
    getNetworkStats,

    // Actions
    loadAgent,
    unloadAgent,
    toggleSection,
    toggleCategory,
    expandAll,
    collapseAll,
    setFontSize,
    toggleFeature,
    executeFeature,
    clearFeatureOutput,
    startFeatureStream,
    stopFeatureStream,

    // Direct store access if needed
    store
  }
}
