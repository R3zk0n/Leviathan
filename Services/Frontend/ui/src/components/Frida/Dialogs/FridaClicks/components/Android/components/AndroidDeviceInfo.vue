<template>
  <div class="android-device-info">
    <!-- Android Version Info -->
    <div class="feature-card">
      <div class="feature-header">
        <div class="feature-info">
          <v-icon size="small" class="mr-2" color="green">mdi-android</v-icon>
          <span class="feature-name">Android Device Information</span>
          <v-chip size="x-small" class="ml-2" color="green">DEVICE</v-chip>
        </div>
        <div class="feature-actions">
          <v-btn
            size="small"
            @click="executeAndroidDeviceFeature"
            :loading="loading"
            color="green"
            variant="outlined"
            :disabled="!agentLoaded"
          >
            Get Device Info
          </v-btn>
        </div>
      </div>
      <div class="feature-description">
        Get comprehensive Android device information including version, hardware details, and system properties
      </div>

      <!-- Use the existing DeviceInfo component from FridaHooks -->
      <DeviceInfo
        v-if="deviceInfoOutput"
        :output-data="deviceInfoOutput"
        platform="android"
        category="deviceInfo"
        feature="androidVersion"
        :loading="loading"
        :show-full-data="true"
        @copy="copyToClipboard"
        @clear="clearDeviceInfo"
        @refresh="executeAndroidDeviceFeature"
      />
    </div>

    <!-- Frida Version Info -->
    <div class="feature-card">
      <div class="feature-header">
        <div class="feature-info">
          <v-icon size="small" class="mr-2" color="cyan">mdi-information-outline</v-icon>
          <span class="feature-name">Frida Version</span>
          <v-chip size="x-small" class="ml-2" color="cyan">INFO</v-chip>
        </div>
        <div class="feature-actions">
          <v-btn
            size="small"
            @click="executeFridaVersion"
            :loading="fridaLoading"
            color="cyan"
            variant="outlined"
            :disabled="!agentLoaded"
          >
            Get Version
          </v-btn>
        </div>
      </div>
      <div class="feature-description">
        Get current Frida version and runtime information
      </div>

      <!-- Frida Version Display -->
      <div v-if="fridaVersionOutput" class="feature-output">
        <div class="version-display">
          <div class="version-content">
            <v-icon color="cyan">mdi-bug</v-icon>
            <span>Frida {{ fridaVersionOutput }}</span>
          </div>
          <v-btn
            icon
            size="small"
            variant="text"
            @click="clearFridaVersion"
            class="version-clear-btn"
          >
            <v-icon size="18">mdi-close</v-icon>
          </v-btn>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, watch } from 'vue'
import { useStore } from 'vuex'
import DeviceInfo from '@/components/Frida/Dialogs/FridaHooks/Android/DeviceInfo.vue'

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  },
  deviceId: {
    type: String,
    required: true
  },
  pid: {
    type: Number,
    required: true
  },
  agentLoaded: {
    type: Boolean,
    required: true
  },
  features: {
    type: Object,
    default: () => ({})
  },
  featureOutputs: {
    type: Object,
    default: () => ({})
  },
  loadingFeatures: {
    type: Object,
    default: () => ({})
  },
  fontSize: {
    type: Number,
    default: 14
  }
})

const emit = defineEmits(['execute-feature', 'feature-toggle', 'show-notification'])
const store = useStore()

// Get the injected notification handler or use emit
const showNotification = inject('showNotification', (message, type = 'info') => {
  emit('show-notification', { message, type })
})

// Computed properties for outputs and loading states
const deviceInfoOutput = computed(() => props.featureOutputs?.androidVersion)
const fridaVersionOutput = computed(() => props.featureOutputs?.fridaVersion)
const loading = computed(() => props.loadingFeatures?.androidVersion || false)
const fridaLoading = computed(() => props.loadingFeatures?.fridaVersion || false)

// Methods - just emit the command, don't make API calls
const executeAndroidDeviceFeature = () => {
  emit('execute-feature', {
    feature: 'androidVersion',
    command: 'getAndroidDeviceInfo()'
  })
}

const executeFridaVersion = () => {
  emit('execute-feature', {
    feature: 'fridaVersion',
    command: 'Frida.version'
  })
}

// Clear methods that properly clear the store data
const clearDeviceInfo = () => {
  // Clear the output in the store
  store.commit('frida/SET_FEATURE_OUTPUT', {
    platform: 'android',
    category: 'deviceInfo',
    feature: 'androidVersion',
    output: null
  })

  showNotification('Device info cleared', 'info')
}

const clearFridaVersion = () => {
  // Clear the Frida version output in the store
  store.commit('frida/SET_FEATURE_OUTPUT', {
    platform: 'android',
    category: 'deviceInfo',
    feature: 'fridaVersion',
    output: null
  })

  showNotification('Frida version cleared', 'info')
}

const copyToClipboard = async (data) => {
  try {
    let textToCopy = data
    if (typeof data === 'object' && data !== null) {
      textToCopy = JSON.stringify(data, null, 2)
    }
    await navigator.clipboard.writeText(textToCopy)
    showNotification('Copied to clipboard', 'success')
  } catch (error) {
    console.error('Failed to copy:', error)
    showNotification('Failed to copy to clipboard', 'error')
  }
}
</script>

<style scoped>
.android-device-info {
  padding: 8px;
  color: #ffffff;
}

.feature-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  transition: all 0.3s ease;
}

.feature-card:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.12);
}

.feature-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.feature-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.feature-name {
  font-weight: 500;
  font-size: 14px;
  color: #ffffff;
}

.feature-description {
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  margin-bottom: 12px;
}

.feature-actions .v-btn {
  text-transform: none;
}

.feature-output {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  margin-top: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  overflow: hidden;
}

.version-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: rgba(0, 156, 224, 0.1);
  border: 1px solid rgba(0, 156, 224, 0.2);
}

.version-content {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 16px;
  font-weight: 500;
  color: #ffffff;
}

.version-clear-btn {
  opacity: 0.7;
  transition: all 0.2s;
}

.version-clear-btn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
}
</style>
