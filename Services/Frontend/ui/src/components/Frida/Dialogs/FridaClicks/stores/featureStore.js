// stores/featureStore.js
import { defineStore } from 'pinia'
import { reactive, computed } from 'vue'

export const useFeatureStore = defineStore('fridaFeatures', () => {
  // State
  const features = reactive({
    ios: {
      frida: {},
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
  })

  const outputs = reactive({
    ios: {
      frida: {
        fridaVersion: null,
        loadedBridges: null,
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
  })

  // Getters
  const getActiveCount = computed(() => (platform) => {
    let count = 0
    if (features[platform]) {
      Object.values(features[platform]).forEach(category => {
        Object.values(category).forEach(feature => {
          if (feature) count++
        })
      })
    }
    return count
  })

  const isFeatureActive = computed(() => (platform, category, feature) => {
    return features[platform]?.[category]?.[feature] || false
  })

  const getFeatureOutput = computed(() => (platform, category, feature) => {
    return outputs[platform]?.[category]?.[feature] || null
  })

  const getTotalActiveFeatures = computed(() => {
    let count = 0
    Object.keys(features).forEach(platform => {
      count += getActiveCount.value(platform)
    })
    return count
  })

  // Actions
  const toggleFeature = async (platform, category, feature, value) => {
    if (features[platform]?.[category]) {
      features[platform][category][feature] = value
    }
  }

  const setFeatureOutput = (platform, category, feature, output) => {
    if (!outputs[platform]) outputs[platform] = {}
    if (!outputs[platform][category]) outputs[platform][category] = {}
    outputs[platform][category][feature] = output
  }

  const appendFeatureOutput = (platform, category, feature, text, maxLines = 2000) => {
    if (!outputs[platform]?.[category]) return

    if (typeof outputs[platform][category][feature] !== 'string') {
      outputs[platform][category][feature] = ''
    }

    outputs[platform][category][feature] += text + '\n'

    // Limit the number of lines
    const lines = outputs[platform][category][feature].split('\n')
    if (lines.length > maxLines) {
      outputs[platform][category][feature] = lines.slice(-maxLines).join('\n')
    }
  }

  const clearFeatureOutput = (platform, category, feature) => {
    if (outputs[platform]?.[category]) {
      outputs[platform][category][feature] =
        typeof outputs[platform][category][feature] === 'string' ? '' : null
    }
  }

  const clearAllOutputs = () => {
    Object.keys(outputs).forEach(platform => {
      Object.keys(outputs[platform]).forEach(category => {
        Object.keys(outputs[platform][category]).forEach(feature => {
          clearFeatureOutput(platform, category, feature)
        })
      })
    })
  }

  const resetFeatures = () => {
    // Reset all features to their default state
    Object.keys(features).forEach(platform => {
      Object.keys(features[platform]).forEach(category => {
        Object.keys(features[platform][category]).forEach(feature => {
          features[platform][category][feature] = false
        })
      })
    })
  }

  return {
    // State
    features,
    outputs,

    // Getters
    getActiveCount,
    isFeatureActive,
    getFeatureOutput,
    getTotalActiveFeatures,

    // Actions
    toggleFeature,
    setFeatureOutput,
    appendFeatureOutput,
    clearFeatureOutput,
    clearAllOutputs,
    resetFeatures
  }
})
