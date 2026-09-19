<template>
  <div class="category-section">
    <div class="category-header" @click="$emit('toggle')">
      <v-icon class="category-icon" :class="{ rotated: expanded }">
        mdi-chevron-right
      </v-icon>
      <v-icon class="feature-icon">{{ icon }}</v-icon>
      <span class="category-title">{{ title }}</span>
      <v-chip size="x-small" class="ml-2" :color="status.color">
        {{ status.text }}
      </v-chip>
    </div>

    <!-- Only render content if expanded AND hasBeenOpened (lazy loading) -->
    <div v-show="expanded" class="category-content">
      <template v-if="hasBeenOpened">
        <!-- Android Components -->
        <AndroidDeviceInfo
          v-if="platform === 'android' && category === 'deviceInfo'"
          :session-id="sessionId"
          :device-id="deviceId"
          :pid="pid"
          :agent-loaded="agentLoaded"
          :features="features"
          :feature-outputs="featureOutputs"
          :loading-features="loadingFeatures"
          :font-size="fontSize"
          @execute-feature="handleExecuteFeature"
          @feature-toggle="handleFeatureToggle"
          @show-notification="handleShowNotification"
        />

        <!-- Android IPC Monitor with proper initialization -->
        <IPCMonitor
          v-if="platform === 'android' && category === 'ipc'"
          :output-data="ipcOutputData"
          :platform="platform"
          :category="category"
          :feature="'ipcMonitor'"
          :loading="loadingFeatures?.ipcMonitor || false"
          :session-id="sessionId"
          :font-size="fontSize"
          @copy="handleCopy"
          @clear="handleClear"
          @refresh="handleRefresh"
          @export="handleExport"
          @start-monitoring="() => handleFeatureToggle({ feature: 'ipcMonitor', enabled: true })"
          @stop-monitoring="() => handleFeatureToggle({ feature: 'ipcMonitor', enabled: false })"
          @show-notification="handleShowNotification"
        />

        <!-- iOS Device Info -->
        <IOSDeviceInfo
          v-if="platform === 'ios' && category === 'deviceInfo'"
          :session-id="sessionId"
          :device-id="deviceId"
          :pid="pid"
          :agent-loaded="agentLoaded"
          :features="features"
          :feature-outputs="featureOutputs"
          :loading-features="loadingFeatures"
          :font-size="fontSize"
          @execute-feature="handleExecuteFeature"
          @feature-toggle="handleFeatureToggle"
          @show-notification="handleShowNotification"
        />

        <!-- iOS Components -->
        <CryptoMonitor
          v-if="platform === 'ios' && category === 'crypto'"
          :agent-loaded="agentLoaded"
          :session-id="sessionId"
          :device-id="deviceId"
          :pid="pid"
          :font-size="fontSize"
          @update:monitoring="(enabled) => handleFeatureToggle({ feature: 'cryptoMonitor', enabled })"
          @show-notification="handleShowNotification"
        />

        <AndroidSSLPinningManager
          v-if="platform === 'android' && category === 'network'"
          :agent-loaded="agentLoaded"
          :session-id="sessionId"
          :device-id="deviceId"
          :pid="pid"
          :font-size="fontSize"
          :active="features?.sslPinningManager"
          :output-data="sslPinningOutputData"
          @toggle="(enabled) => handleFeatureToggle({ feature: 'sslPinningManager', enabled })"
          @show-notification="handleShowNotification"
          @execute-feature="handleExecuteFeature"
        />

        <!-- ADD THIS - iOS URL Scheme Monitor -->
        <IOSURLSchemeMonitor
          v-if="platform === 'ios' && category === 'urlScheme'"
          :agent-loaded="agentLoaded"
          :session-id="sessionId"
          :device-id="deviceId"
          :pid="pid"
          :font-size="fontSize"
          :active="features?.urlSchemeMonitor"
          :output-data="urlSchemeOutputData"
          @toggle="(enabled) => handleFeatureToggle({ feature: 'urlSchemeMonitor', enabled })"
          @show-notification="handleShowNotification"
          @execute-feature="handleExecuteFeature"
        />

        <!-- iOS IPC Monitor (Pasteboard, Darwin Notifications, App Groups) -->
        <IOSIPCMonitor
          v-if="platform === 'ios' && category === 'ipc'"
          :agent-loaded="agentLoaded"
          :session-id="sessionId"
          :device-id="deviceId"
          :pid="pid"
          :font-size="fontSize"
          :active="features?.pasteboardMonitor || features?.darwinNotificationMonitor || features?.appGroupMonitor"
          :output-data="ipcOutputData"
          @toggle="(enabled) => handleFeatureToggle({ feature: 'ipcMonitor', enabled })"
          @show-notification="handleShowNotification"
          @execute-feature="handleExecuteFeature"
        />

        <!-- iOS Decryption & Binary Analysis -->
        <IOSDecryption
          v-if="platform === 'ios' && category === 'decryption'"
          :session-id="sessionId"
          :device-id="deviceId"
          :pid="pid"
          :agent-loaded="agentLoaded"
          :features="features"
          :feature-outputs="featureOutputs"
          :loading-features="loadingFeatures"
          :font-size="fontSize"
          @execute-feature="handleExecuteFeature"
          @feature-toggle="handleFeatureToggle"
          @show-notification="handleShowNotification"
        />

        <FilesystemBrowser
          v-if="category === 'filesystem'"
          :session-id="sessionId"
          :device-id="deviceId"
          :pid="pid"
          :agent-loaded="agentLoaded"
          :font-size="fontSize"
          :lazy-load="true"
          @show-notification="handleShowNotification"
        />

        <!-- Placeholder for unimplemented components -->
        <div v-if="!hasImplementedComponent" class="placeholder-content">
          <v-icon size="48" color="grey-lighten-1">{{ icon }}</v-icon>
          <p class="placeholder-text">{{ title }} features coming soon</p>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, provide, ref, watch } from 'vue'
import { useStore } from 'vuex'

// Android components
import AndroidDeviceInfo from "@/components/Frida/Dialogs/FridaClicks/components/Android/components/AndroidDeviceInfo.vue";
import AndroidSSLPinningManager from "@/components/Frida/Dialogs/FridaClicks/components/Android/components/AndroidSSLPinningManager.vue";

// Import monitors directly from FridaHooks for full functionality
import IPCMonitor from "@/components/Frida/Dialogs/FridaHooks/Android/IPCMonitor.vue";

// For iOS, we can use existing components from FridaHooks
import CryptoMonitor from "@/components/Frida/Dialogs/FridaHooks/iOS/Crypto/CryptoMonitor.vue";
import FilesystemBrowser from "@/components/Frida/Dialogs/FridaHooks/iOS/FileBrowser/Browser.vue";

// iOS Device Info
import IOSDeviceInfo from '@/components/Frida/Dialogs/FridaClicks/components/iOS/components/IOSDeviceInfo.vue';

// iOS URL Scheme Monitor
import IOSURLSchemeMonitor from '../iOS/components/IOSURLSchemeMonitor.vue';

// iOS IPC Monitor (Pasteboard, Darwin Notifications, App Groups)
import IOSIPCMonitor from '../iOS/monitors/IOSIPCMonitor.vue';

// iOS Decryption & Binary Analysis
import IOSDecryption from '@/components/Frida/Dialogs/FridaClicks/components/iOS/components/IOSDecryption.vue';

const props = defineProps({
  platform: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    required: true
  },
  expanded: {
    type: Boolean,
    default: false
  },
  status: {
    type: Object,
    default: () => ({ color: 'grey', text: 'Available' })
  },
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

const emit = defineEmits(['toggle', 'execute-feature', 'feature-toggle', 'show-notification'])
const store = useStore()

// Lazy loading state - track if this category has ever been opened
const hasBeenOpened = ref(false)

// Watch for expansion and mark as opened
watch(() => props.expanded, (newVal) => {
  if (newVal && !hasBeenOpened.value) {
    hasBeenOpened.value = true
    console.log(`Category ${props.category} opened for the first time`)
  }
})

// Computed property for IPC Monitor data with proper structure
const ipcOutputData = computed(() => {
  if (props.category === 'ipc' && props.platform === 'android') {
    // Ensure proper data structure for IPC Monitor
    const data = props.featureOutputs?.ipcMonitor || {}
    return {
      events: data.events || [],
      statistics: data.statistics || {
        totalEvents: 0,
        byType: {
          intent: 0,
          broadcast: 0,
          content_provider: 0,
          binder: 0,
          service: 0
        },
        startTime: null,
        lastEventTime: null
      },
      active: data.active || false,
      filters: data.filters || {
        types: ['intent', 'broadcast', 'content_provider', 'binder', 'service'],
        search: ''
      }
    }
  }
  return props.featureOutputs?.ipcMonitor || {}
})

// ADD THIS - Computed property for URL Scheme Monitor data
const urlSchemeOutputData = computed(() => {
  if (props.category === 'urlScheme' && props.platform === 'ios') {
    // Ensure proper data structure for URL Scheme Monitor
    const data = props.featureOutputs?.urlSchemeMonitor || {}
    return {
      events: data.events || [],
      statistics: data.statistics || {
        totalEvents: 0,
        byType: {
          url_scheme: 0
        },
        byBundle: {},
        byOperation: {},
        startTime: null,
        lastEventTime: null
      },
      active: data.active || false,
      filters: data.filters || {
        types: ['url_scheme'],
        search: ''
      }
    }
  }
  return props.featureOutputs?.urlSchemeMonitor || {}
})

const sslPinningOutputData = computed(() => {
  if (props.category === 'network' && props.platform === 'android') {
    const data = props.featureOutputs?.sslPinningManager || {}
    return {
      events: data.events || [],
      hooks: data.hooks || [],
      statistics: data.statistics || {
        totalHooks: 0,
        activeHooks: 0,
        bypassedHooks: 0,
        totalEvents: 0,
        lastEventTime: null
      }
    }
  }
  return props.featureOutputs?.sslPinningManager || {}
})

// Event handlers that bubble up to parent
const handleExecuteFeature = (data) => {
  // Handle clear actions locally for device info
  if (data.action === 'clear' && props.category === 'deviceInfo' && props.platform === 'android') {
    if (store) {
      store.commit('frida/SET_FEATURE_OUTPUT', {
        platform: props.platform,
        category: props.category,
        feature: data.feature,
        output: null
      })
      handleShowNotification({ message: `${data.feature} cleared`, type: 'info' })
    }
    return
  }

  emit('execute-feature', {
    platform: props.platform,
    category: props.category,
    ...data
  })
}

const handleFeatureToggle = (data) => {
  emit('feature-toggle', {
    platform: props.platform,
    category: props.category,
    ...data
  })
}

const handleShowNotification = (notification) => {
  emit('show-notification', notification)
}

// IPC Monitor specific handlers
const handleCopy = (data) => {
  navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    .then(() => {
      handleShowNotification({ message: 'Copied to clipboard', type: 'success' })
    })
    .catch(() => {
      handleShowNotification({ message: 'Failed to copy to clipboard', type: 'error' })
    })
}

const handleClear = () => {
  // For IPC Monitor, execute clear command
  if (props.category === 'ipc' && props.platform === 'android') {
    handleExecuteFeature({
      feature: 'ipcMonitor',
      command: 'clearIPCEvents()'
    })

    // Also clear the local store data
    if (store) {
      store.commit('frida/SET_FEATURE_OUTPUT', {
        platform: props.platform,
        category: props.category,
        feature: 'ipcMonitor',
        output: {
          events: [],
          statistics: {
            totalEvents: 0,
            byType: {
              intent: 0,
              broadcast: 0,
              content_provider: 0,
              binder: 0,
              service: 0
            },
            startTime: new Date().toISOString(),
            lastEventTime: null
          },
          active: true,
          filters: {
            types: ['intent', 'broadcast', 'content_provider', 'binder', 'service'],
            search: ''
          }
        }
      })
    }
  } else {
    handleExecuteFeature({ feature: props.feature, action: 'clear' })
  }
}

const handleRefresh = () => {
  if (props.category === 'ipc' && props.platform === 'android') {
    // For IPC monitor, refresh means getting current statistics
    handleExecuteFeature({
      feature: 'ipcMonitor',
      command: 'getIPCStatistics()'
    })
  } else {
    handleExecuteFeature({ feature: props.feature, action: 'refresh' })
  }
}

const handleExport = (data) => {
  const exportData = JSON.stringify(data, null, 2)
  const blob = new Blob([exportData], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ipc-monitor-export-${new Date().toISOString()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  handleShowNotification({ message: 'Data exported successfully', type: 'success' })
}

// Provide showNotification to child components that use inject
provide('showNotification', (message, type = 'info', duration = 3000) => {
  handleShowNotification({ message, type, duration })
})

// UPDATE THIS - Check if this category has an implemented component
const hasImplementedComponent = computed(() => {
  if (props.platform === 'android') {
    return ['deviceInfo', 'ipc', 'filesystem', 'network'].includes(props.category)
  } else if (props.platform === 'ios') {
    return ['crypto', 'filesystem', 'urlScheme', 'ipc', 'deviceInfo', 'decryption'].includes(props.category)
  }
  return false
})

</script>

<style scoped>
.category-section {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  margin-bottom: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.category-section:hover {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.12);
}

.category-header {
  padding: 12px 16px;
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: background 0.2s ease;
}

.category-header:hover {
  background: rgba(255, 255, 255, 0.05);
}

.category-icon {
  color: rgba(255, 255, 255, 0.6);
  transition: transform 0.3s ease;
}

.category-icon.rotated {
  transform: rotate(90deg);
}

.feature-icon {
  color: rgba(255, 255, 255, 0.8);
}

.category-title {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.category-content {
  padding: 16px;
  background: rgba(0, 0, 0, 0.2);
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.placeholder-content {
  padding: 48px;
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
}

.placeholder-text {
  margin-top: 16px;
  font-size: 14px;
}
</style>
