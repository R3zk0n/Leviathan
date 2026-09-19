// stores/uiStore.js
import { defineStore } from 'pinia'
import { reactive, computed } from 'vue'

const UI_PREFERENCES_KEY = 'fridaClicks_ui_preferences'

export const useUIStore = defineStore('fridaUI', () => {
  // State
  const expandedSections = reactive({
    ios: true,
    android: false,
  })

  const expandedCategories = reactive({
    ios: {
      frida: true,
      crypto: false,
      app: true,
      network: true,
      system: true,
      filesystem: true,
    },
    android: {
      frida: false,
      deviceInfo: true,
      ipc: true,
      app: false,
      network: true,
      system: false,
    },
  })

  const dialogState = reactive({
    width: 1000,
    height: 800,
    top: 50,
    left: window.innerWidth - 1020,
  })

  const preferences = reactive({
    showVersionToggle: true,
    autoLoadAgent: false,
    theme: 'dark',
    animations: true,
  })

  // Getters
  const isSectionExpanded = computed(() => (section) => {
    return expandedSections[section] || false
  })

  const isCategoryExpanded = computed(() => (section, category) => {
    return expandedCategories[section]?.[category] || false
  })

  const getDialogStyle = computed(() => ({
    position: 'fixed',
    zIndex: 9999,
    top: `${dialogState.top}px`,
    left: `${dialogState.left}px`,
    width: `${dialogState.width}px`,
    height: `${dialogState.height}px`,
  }))

  // Actions
  const toggleSection = (section) => {
    expandedSections[section] = !expandedSections[section]
    savePreferences()
  }

  const toggleCategory = (section, category) => {
    if (!expandedCategories[section]) {
      expandedCategories[section] = {}
    }
    expandedCategories[section][category] = !expandedCategories[section][category]
    savePreferences()
  }

  const expandAll = () => {
    // Expand all sections
    Object.keys(expandedSections).forEach(section => {
      expandedSections[section] = true
    })

    // Expand all categories
    Object.keys(expandedCategories).forEach(section => {
      Object.keys(expandedCategories[section]).forEach(category => {
        expandedCategories[section][category] = true
      })
    })

    savePreferences()
  }

  const collapseAll = () => {
    // Collapse all sections
    Object.keys(expandedSections).forEach(section => {
      expandedSections[section] = false
    })

    // Collapse all categories
    Object.keys(expandedCategories).forEach(section => {
      Object.keys(expandedCategories[section]).forEach(category => {
        expandedCategories[section][category] = false
      })
    })

    savePreferences()
  }

  const updateDialogPosition = (updates) => {
    Object.assign(dialogState, updates)
    savePreferences()
  }

  const setPreference = (key, value) => {
    preferences[key] = value
    savePreferences()
  }

  const savePreferences = () => {
    try {
      const dataToSave = {
        expandedSections: { ...expandedSections },
        expandedCategories: { ...expandedCategories },
        dialogState: { ...dialogState },
        preferences: { ...preferences }
      }
      localStorage.setItem(UI_PREFERENCES_KEY, JSON.stringify(dataToSave))
    } catch (e) {
      console.warn('Unable to save UI preferences:', e)
    }
  }

  const loadPreferences = () => {
    try {
      const saved = localStorage.getItem(UI_PREFERENCES_KEY)
      if (saved) {
        const data = JSON.parse(saved)

        if (data.expandedSections) {
          Object.assign(expandedSections, data.expandedSections)
        }

        if (data.expandedCategories) {
          Object.assign(expandedCategories, data.expandedCategories)
        }

        if (data.dialogState) {
          // Validate dialog position is within screen bounds
          const validatedState = {
            ...data.dialogState,
            top: Math.max(0, Math.min(data.dialogState.top, window.innerHeight - 100)),
            left: Math.max(0, Math.min(data.dialogState.left, window.innerWidth - 100))
          }
          Object.assign(dialogState, validatedState)
        }

        if (data.preferences) {
          Object.assign(preferences, data.preferences)
        }
      }
    } catch (e) {
      console.warn('Unable to load UI preferences:', e)
    }
  }

  const resetToDefaults = () => {
    // Reset sections
    expandedSections.ios = true
    expandedSections.android = false

    // Reset categories
    Object.assign(expandedCategories.ios, {
      frida: true,
      crypto: false,
      app: true,
      network: true,
      system: true,
      filesystem: true,
    })

    Object.assign(expandedCategories.android, {
      frida: false,
      deviceInfo: true,
      ipc: true,
      app: false,
      network: true,
      system: false,
    })

    // Reset dialog position
    dialogState.width = 1000
    dialogState.height = 800
    dialogState.top = 50
    dialogState.left = window.innerWidth - 1020

    // Reset preferences
    preferences.showVersionToggle = true
    preferences.autoLoadAgent = false
    preferences.theme = 'dark'
    preferences.animations = true

    savePreferences()
  }

  return {
    // State
    expandedSections,
    expandedCategories,
    dialogState,
    preferences,

    // Getters
    isSectionExpanded,
    isCategoryExpanded,
    getDialogStyle,

    // Actions
    toggleSection,
    toggleCategory,
    expandAll,
    collapseAll,
    updateDialogPosition,
    setPreference,
    savePreferences,
    loadPreferences,
    resetToDefaults
  }
})
