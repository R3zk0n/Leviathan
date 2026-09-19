<template>
  <div v-if="visible" class="frida-clicks-overlay">
    <div
      ref="dialogRef"
      class="frida-clicks-dialog"
      :style="dialogStyle"
      :class="{
        dragging: isMoving,
        resizing: isResizing,
        minimized: isMinimized,
        fullscreen: isFullscreen
      }"
    >
      <!-- Enhanced header -->
      <div class="dialog-header" @mousedown="startMove">
        <div class="header-content">
          <div class="header-left">
            <v-icon class="header-icon">mdi-puzzle-outline</v-icon>
            <span class="header-title">{{ title }}</span>
            <v-chip size="x-small" class="ml-2" :color="agentLoaded ? 'success' : 'error'">
              {{ agentLoaded ? 'Agent Loaded' : 'No Agent' }}
            </v-chip>
          </div>
          <div class="header-actions">
            <!-- Collapse/Expand All Controls -->
            <v-tooltip location="bottom">
              <template v-slot:activator="{ props }">
                <v-btn icon size="x-small" @click="collapseAll" class="header-btn" v-bind="props">
                  <v-icon size="18">mdi-collapse-all</v-icon>
                </v-btn>
              </template>
              <span>Collapse all sections</span>
            </v-tooltip>

            <v-tooltip location="bottom">
              <template v-slot:activator="{ props }">
                <v-btn icon size="x-small" @click="expandAll" class="header-btn" v-bind="props">
                  <v-icon size="18">mdi-expand-all</v-icon>
                </v-btn>
              </template>
              <span>Expand all sections</span>
            </v-tooltip>

            <!-- Font Size Controls -->
            <v-divider vertical class="mx-2" style="opacity: 0.3; height: 24px;"></v-divider>

            <v-tooltip location="bottom">
              <template v-slot:activator="{ props }">
                <v-btn
                  icon
                  size="x-small"
                  @click="decreaseFontSize"
                  class="header-btn"
                  v-bind="props"
                  :disabled="currentFontSize <= minFontSize"
                >
                  <v-icon size="18">mdi-minus</v-icon>
                </v-btn>
              </template>
              <span>Decrease font size (Ctrl+-)</span>
            </v-tooltip>

            <v-chip size="x-small" color="blue" class="mx-1">
              {{ currentFontSize }}px
            </v-chip>

            <v-tooltip location="bottom">
              <template v-slot:activator="{ props }">
                <v-btn
                  icon
                  size="x-small"
                  @click="increaseFontSize"
                  class="header-btn"
                  v-bind="props"
                  :disabled="currentFontSize >= maxFontSize"
                >
                  <v-icon size="18">mdi-plus</v-icon>
                </v-btn>
              </template>
              <span>Increase font size (Ctrl++)</span>
            </v-tooltip>

            <v-divider vertical class="mx-2" style="opacity: 0.3; height: 24px;"></v-divider>

            <!-- Window Controls -->
            <v-btn icon size="x-small" variant="text" @click="minimizeDialog" class="header-btn">
              <v-icon size="18">mdi-window-minimize</v-icon>
            </v-btn>
            <v-btn icon size="x-small" variant="text" @click="toggleFullscreen" class="header-btn">
              <v-icon size="18">{{ isFullscreen ? 'mdi-window-restore' : 'mdi-window-maximize' }}</v-icon>
            </v-btn>
            <v-btn icon size="x-small" variant="text" @click="closeDialog" class="header-btn close-btn">
              <v-icon size="18">mdi-close</v-icon>
            </v-btn>
          </div>
        </div>
      </div>

      <!-- Agent Status Bar -->
      <AgentStatusBar
        :agent-loaded="agentLoaded"
        :agent-loading="agentLoading"
        :agent-error="agentError"
        :agent-disconnected="agentDisconnected"
        :disconnect-reason="disconnectReason"
        :session-id="sessionId"
        :device-id="deviceId"
        :pid="pid"
        @load-agent="loadAgent"
        @unload-agent="unloadAgent"
        @reconnect="reconnectAgent"
        @dismiss-disconnect="dismissDisconnect"
      />

      <!-- Enhanced content area -->
      <div class="dialog-content" :class="{ minimized: isMinimized }">
        <div class="content-wrapper">
          <!-- iOS Section -->
          <div class="platform-section ios-section" :class="{ expanded: expandedSections.ios }">
            <div class="platform-header" @click="toggleSection('ios')">
              <div class="platform-header-content">
                <div class="platform-info">
                  <v-icon
                    class="section-icon"
                    :class="{ rotated: expandedSections.ios }"
                  >
                    mdi-chevron-right
                  </v-icon>
                  <div class="platform-icon-wrapper ios">
                    <v-icon class="platform-icon">mdi-apple</v-icon>
                  </div>
                  <span class="platform-title">iOS</span>
                </div>
                <div class="platform-meta">
                  <v-chip
                    size="x-small"
                    class="platform-chip"
                    :color="getActiveCount('ios') > 0 ? 'blue' : 'grey'"
                  >
                    <v-icon size="12" start>mdi-puzzle</v-icon>
                    {{ getActiveCount('ios') }} active
                  </v-chip>
                </div>
              </div>
            </div>

            <v-expand-transition>
              <div v-show="expandedSections.ios" class="platform-content">
                <CategorySection
                  v-for="category in iosCategories"
                  :key="category.id"
                  :platform="'ios'"
                  :category="category.id"
                  :title="category.title"
                  :icon="category.icon"
                  :expanded="expandedCategories.ios?.[category.id]"
                  :status="getCategoryStatus('ios', category.id)"
                  :session-id="sessionId || 'default'"
                  :device-id="deviceId"
                  :pid="pid"
                  :agent-loaded="agentLoaded"
                  :features="features.ios?.[category.id]"
                  :feature-outputs="outputs.ios?.[category.id]"
                  :loading-features="loadingFeatures.ios?.[category.id]"
                  :font-size="currentFontSize"
                  @toggle="toggleCategory('ios', category.id)"
                  @execute-feature="handleExecuteFeature"
                  @feature-toggle="handleFeatureToggle"
                  @show-notification="showNotification"
                  class="enhanced-category"
                />
              </div>
            </v-expand-transition>
          </div>

          <!-- Android Section -->
          <div class="platform-section android-section" :class="{ expanded: expandedSections.android }">
            <div class="platform-header" @click="toggleSection('android')">
              <div class="platform-header-content">
                <div class="platform-info">
                  <v-icon
                    class="section-icon"
                    :class="{ rotated: expandedSections.android }"
                  >
                    mdi-chevron-right
                  </v-icon>
                  <div class="platform-icon-wrapper android">
                    <v-icon class="platform-icon">mdi-android</v-icon>
                  </div>
                  <span class="platform-title">Android</span>
                </div>
                <div class="platform-meta">
                  <v-chip
                    size="x-small"
                    class="platform-chip"
                    :color="getActiveCount('android') > 0 ? 'green' : 'grey'"
                  >
                    <v-icon size="12" start>mdi-puzzle</v-icon>
                    {{ getActiveCount('android') }} active
                  </v-chip>
                </div>
              </div>
            </div>

            <v-expand-transition>
              <div v-show="expandedSections.android" class="platform-content">
                <CategorySection
                  v-for="category in androidCategories"
                  :key="category.id"
                  :platform="'android'"
                  :category="category.id"
                  :title="category.title"
                  :icon="category.icon"
                  :expanded="expandedCategories.android?.[category.id]"
                  :status="getCategoryStatus('android', category.id)"
                  :session-id="sessionId || 'default'"
                  :device-id="deviceId"
                  :pid="pid"
                  :agent-loaded="agentLoaded"
                  :features="features.android?.[category.id]"
                  :feature-outputs="outputs.android?.[category.id]"
                  :loading-features="loadingFeatures.android?.[category.id]"
                  :font-size="currentFontSize"
                  @toggle="toggleCategory('android', category.id)"
                  @execute-feature="handleExecuteFeature"
                  @feature-toggle="handleFeatureToggle"
                  @show-notification="showNotification"
                  class="enhanced-category"
                />
              </div>
            </v-expand-transition>
          </div>
        </div>
      </div>

      <!-- Enhanced resize handle with hover animation -->
      <div
        class="resizer-handle"
        @mousedown="startResize"
        @mouseenter="hoverResize = true"
        @mouseleave="hoverResize = false"
        :class="{ hover: hoverResize }"
      >
        <div class="resize-grip"></div>
      </div>
    </div>

    <!-- Notifications -->
    <transition-group name="notification" tag="div" class="notification-container">
      <div
        v-for="notification in notifications"
        :key="notification.id"
        :class="['notification', `notification-${notification.type}`]"
        @click="removeNotification(notification.id)"
      >
        <v-icon class="notification-icon">
          {{ getNotificationIcon(notification.type) }}
        </v-icon>
        <span class="notification-message">{{ notification.message }}</span>
        <div class="notification-progress" :style="{ width: notification.progress + '%' }"></div>
      </div>
    </transition-group>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { useStore } from 'vuex'
import axios from 'axios'

// Import only existing components
import CategorySection from './components/PlatformSection/CategorySection.vue'
import AgentStatusBar from './components/AgentStatusBar/AgentStatusBar.vue'

// Props
const props = defineProps({
  visible: {
    type: Boolean,
    required: true
  },
  title: {
    type: String,
    default: 'Frida Agent Control Panel'
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
  }
})

const emit = defineEmits(['close', 'feature-toggle'])

// Store
const store = useStore()

// Refs
const dialogRef = ref(null)
const hoverResize = ref(false)

// Dialog state and positioning
const dialogSize = reactive({
  width: 1100,
  height: 800,
  top: 50,
  left: window.innerWidth - 1120,
})

const dialogStyle = computed(() => ({
  position: 'fixed',
  zIndex: 9999,
  top: `${dialogSize.top}px`,
  left: `${dialogSize.left}px`,
  width: `${dialogSize.width}px`,
  height: isMinimized.value ? '48px' : `${dialogSize.height}px`,
}))

// Dialog state
const isMoving = ref(false)
const isResizing = ref(false)
const isFullscreen = ref(false)
const isMinimized = ref(false)
const previousSize = ref(null)

// Notifications
const notifications = ref([])
let notificationId = 0

// Get state from store using getters for better reactivity
const features = computed(() => store.getters['frida/features'])
const outputs = computed(() => store.getters['frida/outputs'])
const loadingFeatures = computed(() => store.getters['frida/loadingFeatures'])
const fontSize = computed(() => store.getters['frida/fontSize'])

// Agent state from store
const agentLoaded = computed(() => store.getters['frida/isAgentLoaded'])
const agentLoading = computed(() => store.getters['frida/isAgentLoading'])
const agentError = computed(() => store.getters['frida/agentError'])
const agentDisconnected = computed(() => store.getters['frida/isAgentDisconnected'])
const disconnectReason = computed(() => store.getters['frida/disconnectReason'])

// UI state from store
const expandedSections = computed(() => store.getters['frida/expandedSections'])
const expandedCategories = computed(() => store.getters['frida/expandedCategories'])

// Font size controls
const minFontSize = 10
const maxFontSize = 24
const currentFontSize = ref(fontSize.value)

// Categories configuration
const iosCategories = [
  { id: 'frida', title: 'Frida Information', icon: 'mdi-console' },
  { id: 'deviceInfo', title: 'Device Information', icon: 'mdi-cellphone-information' },
  { id: 'crypto', title: 'Cryptography Security', icon: 'mdi-lock' },
  { id: 'urlScheme', title: 'URL Scheme Monitor', icon: 'mdi-open-in-app' },
  { id: 'ipc', title: 'IPC Monitor', icon: 'mdi-swap-horizontal' },
  { id: 'decryption', title: 'Decryption & Binary Analysis', icon: 'mdi-lock-open-variant' },
  { id: 'filesystem', title: 'Filesystem Browser', icon: 'mdi-folder' },
  { id: 'app', title: 'App Information', icon: 'mdi-application' },
  { id: 'network', title: 'Network Security', icon: 'mdi-web' },
  { id: 'system', title: 'System', icon: 'mdi-cellphone' },
]

const androidCategories = [
  { id: 'deviceInfo', title: 'Device Information', icon: 'mdi-information' },
  { id: 'ipc', title: 'IPC Security Monitor', icon: 'mdi-swap-horizontal' },
  { id: 'filesystem', title: 'Filesystem Browser', icon: 'mdi-folder' },
  { id: 'app', title: 'App Information', icon: 'mdi-application' },
  { id: 'network', title: 'Network Monitor', icon: 'mdi-web' },
  { id: 'system', title: 'System', icon: 'mdi-cellphone' },
]

// Methods
const closeDialog = () => {
  emit('close')
}

const toggleSection = (platform) => {
  store.dispatch('frida/toggleSection', platform)
}

const toggleCategory = (platform, category) => {
  store.dispatch('frida/toggleCategory', { section: platform, category })
}

// Font size controls
const increaseFontSize = () => {
  if (currentFontSize.value < maxFontSize) {
    currentFontSize.value += 2
    updateFontSize()
  }
}

const decreaseFontSize = () => {
  if (currentFontSize.value > minFontSize) {
    currentFontSize.value -= 2
    updateFontSize()
  }
}

const updateFontSize = () => {
  store.dispatch('frida/setFontSize', currentFontSize.value)

  // Apply font size to dialog content
  if (dialogRef.value) {
    dialogRef.value.style.setProperty('--font-scale', currentFontSize.value / 14)
  }
}

// Expand/Collapse all sections
const expandAll = () => {
  store.dispatch('frida/expandAll')
}

const collapseAll = () => {
  store.dispatch('frida/collapseAll')
}

const getActiveCount = (platform) => {
  const platformFeatures = features.value[platform] || {}
  let count = 0

  Object.values(platformFeatures).forEach(category => {
    if (typeof category === 'object') {
      Object.values(category).forEach(feature => {
        if (feature === true) count++
      })
    }
  })

  return count
}

const getCategoryStatus = (platform, category) => {
  const categoryFeatures = features.value[platform]?.[category] || {}
  const activeFeatures = Object.values(categoryFeatures).filter(v => v).length

  if (activeFeatures > 0) {
    return {
      color: platform === 'ios' ? 'blue' : 'green',
      text: `${activeFeatures} active`
    }
  }

  return { color: 'grey', text: 'Ready' }
}

// Agent management using store actions
const loadAgent = async () => {
  const result = await store.dispatch('frida/loadAgent', {
    deviceId: props.deviceId,
    sessionId: props.sessionId,
    pid: props.pid
  })

  if (result.success) {
    showNotification('Agent loaded successfully', 'success')
  } else {
    showNotification(`Failed to load agent: ${result.error}`, 'error')
  }
}

const unloadAgent = async () => {
  const result = await store.dispatch('frida/unloadAgent')

  if (result.success) {
    showNotification('Agent unloaded successfully', 'success')
  } else {
    showNotification(`Failed to unload agent: ${result.error}`, 'error')
  }
}

const reconnectAgent = async () => {
  showNotification('Attempting to reconnect...', 'info')
  const result = await store.dispatch('frida/reconnect')

  if (result.success) {
    showNotification('Reconnected successfully', 'success')
  } else {
    showNotification(`Reconnect failed: ${result.error}`, 'error')
  }
}

const dismissDisconnect = () => {
  store.commit('frida/SET_AGENT_DISCONNECTED', { disconnected: false, reason: null })
  store.commit('frida/CLEAR_LAST_SESSION_CONFIG')
}

// Notifications
const showNotification = (message, type = 'info', duration = 3000) => {
  const id = ++notificationId
  const notification = reactive({
    id,
    message,
    type,
    progress: 100
  })

  notifications.value.push(notification)

  const startTime = Date.now()
  const updateProgress = () => {
    const elapsed = Date.now() - startTime
    const progress = Math.max(0, 100 - (elapsed / duration) * 100)

    notification.progress = progress

    if (progress > 0) {
      requestAnimationFrame(updateProgress)
    } else {
      removeNotification(id)
    }
  }

  requestAnimationFrame(updateProgress)
  return id
}

const removeNotification = (id) => {
  const index = notifications.value.findIndex(n => n.id === id)
  if (index > -1) {
    notifications.value.splice(index, 1)
  }
}

const getNotificationIcon = (type) => {
  const icons = {
    success: 'mdi-check-circle',
    error: 'mdi-alert-circle',
    warning: 'mdi-alert',
    info: 'mdi-information'
  }
  return icons[type] || icons.info
}

// Dialog move/resize handlers
let moveData = null
let resizeData = null

const startMove = (event) => {
  if (event.target.closest('.header-actions') || isFullscreen.value) return

  event.preventDefault()
  isMoving.value = true

  moveData = {
    startX: event.clientX,
    startY: event.clientY,
    startLeft: dialogSize.left,
    startTop: dialogSize.top
  }

  document.addEventListener('mousemove', handleMove)
  document.addEventListener('mouseup', stopMove)
}

const handleMove = (e) => {
  if (!isMoving.value || !moveData) return

  const deltaX = e.clientX - moveData.startX
  const deltaY = e.clientY - moveData.startY

  dialogSize.left = Math.max(0, Math.min(window.innerWidth - dialogSize.width, moveData.startLeft + deltaX))
  dialogSize.top = Math.max(0, Math.min(window.innerHeight - 50, moveData.startTop + deltaY))
}

const stopMove = () => {
  isMoving.value = false
  moveData = null
  document.removeEventListener('mousemove', handleMove)
  document.removeEventListener('mouseup', stopMove)
}

const startResize = (event) => {
  if (isFullscreen.value) return

  event.preventDefault()
  event.stopPropagation()
  isResizing.value = true

  resizeData = {
    startX: event.clientX,
    startY: event.clientY,
    startWidth: dialogSize.width,
    startHeight: dialogSize.height
  }

  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
}

const handleResize = (e) => {
  if (!isResizing.value || !resizeData) return

  const deltaX = e.clientX - resizeData.startX
  const deltaY = e.clientY - resizeData.startY

  dialogSize.width = Math.max(600, Math.min(window.innerWidth - dialogSize.left, resizeData.startWidth + deltaX))
  dialogSize.height = Math.max(400, Math.min(window.innerHeight - dialogSize.top, resizeData.startHeight + deltaY))
}

const stopResize = () => {
  isResizing.value = false
  resizeData = null
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
}

const toggleFullscreen = () => {
  if (isFullscreen.value) {
    if (previousSize.value) {
      Object.assign(dialogSize, previousSize.value)
    }
    isFullscreen.value = false
  } else {
    previousSize.value = { ...dialogSize }
    dialogSize.top = 0
    dialogSize.left = 0
    dialogSize.width = window.innerWidth
    dialogSize.height = window.innerHeight
    isFullscreen.value = true
  }
}

const minimizeDialog = () => {
  isMinimized.value = !isMinimized.value
}

// Feature handlers
const handleExecuteFeature = async (data) => {
  console.log('Execute feature:', data)

  // Handle clear action without needing agent or command
  if (data.action === 'clear') {
    store.commit('frida/SET_FEATURE_OUTPUT', {
      platform: data.platform,
      category: data.category,
      feature: data.feature,
      output: null
    })
    showNotification(`${data.feature} cleared`, 'info')
    return
  }

  // CRITICAL: Check agent is loaded before ANY command execution
  if (!agentLoaded.value) {
    showNotification('Please load the agent first before using features', 'warning')
    return
  }

  // Ensure we have a command
  if (!data.command) {
    console.error('No command provided for feature:', data)
    showNotification('No command specified for this feature', 'error')
    return
  }

  try {
    // Always dispatch to store with full context
    const result = await store.dispatch('frida/executeFeature', {
      sessionId: props.sessionId || 'default',
      deviceId: props.deviceId,
      pid: props.pid,
      platform: data.platform,
      category: data.category,
      feature: data.feature,
      command: data.command
    })

    if (result.success) {
      showNotification(`${data.feature} executed successfully`, 'success')
    } else {
      showNotification(`Failed to execute ${data.feature}: ${result.error}`, 'error')
    }
  } catch (error) {
    console.error('Error executing feature:', error)
    showNotification(`Failed to execute feature: ${error.message}`, 'error')
  }
}

const handleFeatureToggle = async (data) => {
  console.log('Feature toggle:', data)

  // CRITICAL: Check agent is loaded before ANY toggle
  if (!agentLoaded.value) {
    showNotification('Please load the agent first before using features', 'warning')
    return
  }

  // Special handling for IPC Monitor
  if (data.feature === 'ipcMonitor') {
    console.log('IPC Monitor toggle - enabled:', data.enabled, 'platform:', data.platform)

    // iOS IPC Monitor manages its own RPC calls internally (per-monitor start/stop)
    // We just need to update the store state here
    if (data.platform === 'ios') {
      store.dispatch('frida/toggleFeature', {
        platform: data.platform,
        category: data.category,
        feature: data.feature,
        value: data.enabled
      })
      emit('feature-toggle', data)
      return
    }

    if (data.enabled) {
      try {
        // First check if monitoring is already active
        const currentOutput = store.getters['frida/getFeatureOutput'](data.platform, data.category, data.feature) || {}
        if (currentOutput.active) {
          showNotification('IPC monitoring is already active', 'warning')
          return
        }

        // Start monitoring on the backend (Android only - uses startIPCMonitoring)
        const startResult = await store.dispatch('frida/executeFeature', {
          sessionId: props.sessionId || 'default',
          deviceId: props.deviceId,
          pid: props.pid,
          platform: data.platform,
          category: data.category,
          feature: data.feature,
          command: 'startIPCMonitoring()'
        })

        if (startResult.success) {
          // Initialize the output structure for IPC monitor
          store.commit('frida/SET_FEATURE_OUTPUT', {
            platform: data.platform,
            category: data.category,
            feature: data.feature,
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

          // Update feature state to enabled
          store.dispatch('frida/toggleFeature', {
            platform: data.platform,
            category: data.category,
            feature: data.feature,
            value: true
          })

          showNotification('IPC monitoring started', 'success')
        } else {
          showNotification('Failed to start IPC monitoring', 'error')
          return
        }
      } catch (error) {
        console.error('Error starting IPC monitor:', error)
        showNotification(`Failed to start IPC monitoring: ${error.message}`, 'error')
        return
      }
    } else {
      try {
        // Stop monitoring on the backend
        const stopResult = await store.dispatch('frida/executeFeature', {
          sessionId: props.sessionId || 'default',
          deviceId: props.deviceId,
          pid: props.pid,
          platform: data.platform,
          category: data.category,
          feature: data.feature,
          command: 'stopIPCMonitoring()' // Note: it's stopIPCMonitoring, not stopIPCMonitor
        })

        console.log('Stop monitoring result:', stopResult)

        // Always update the state regardless of backend response
        // The backend might think monitoring is not active, but we need to stop the EventSource
        const currentOutput = store.getters['frida/getFeatureOutput'](data.platform, data.category, data.feature) || {}

        // Force update the output to inactive
        store.commit('frida/SET_FEATURE_OUTPUT', {
          platform: data.platform,
          category: data.category,
          feature: data.feature,
          output: {
            ...currentOutput,
            active: false // This MUST trigger the IPCMonitor to close EventSource
          }
        })

        // Update feature state to disabled
        store.dispatch('frida/toggleFeature', {
          platform: data.platform,
          category: data.category,
          feature: data.feature,
          value: false
        })

        // Stop any event streams
        store.dispatch('frida/stopFeatureStream', {
          platform: data.platform,
          category: data.category,
          feature: data.feature
        })

        if (stopResult.success) {
          showNotification('IPC monitoring stopped', 'info')
        } else {
          // Even if backend says monitoring wasn't active, we've stopped the frontend
          console.warn('Backend reported monitoring not active, but frontend has been stopped')
          showNotification('IPC monitoring stopped (forced)', 'warning')
        }
      } catch (error) {
        console.error('Error stopping IPC monitor:', error)
        showNotification(`Failed to stop IPC monitoring: ${error.message}`, 'error')
      }
    }
  } else if (data.feature === 'urlSchemeMonitor') {
    // ADD THIS ENTIRE SECTION FOR URL SCHEME MONITOR
    console.log('URL Scheme Monitor toggle - enabled:', data.enabled)

    if (data.enabled) {
      try {
        // First check if monitoring is already active
        const currentOutput = store.getters['frida/getFeatureOutput'](data.platform, data.category, data.feature) || {}
        if (currentOutput.active) {
          showNotification('URL scheme monitoring is already active', 'warning')
          return
        }

        // Start monitoring on the backend
        const startResult = await store.dispatch('frida/executeFeature', {
          sessionId: props.sessionId || 'default',
          deviceId: props.deviceId,
          pid: props.pid,
          platform: data.platform,
          category: data.category,
          feature: data.feature,
          command: 'startURLSchemeMonitor()'
        })

        if (startResult.success) {
          // Initialize the output structure for URL scheme monitor
          store.commit('frida/SET_FEATURE_OUTPUT', {
            platform: data.platform,
            category: data.category,
            feature: data.feature,
            output: {
              events: [],
              statistics: {
                totalEvents: 0,
                byType: {
                  url_scheme: 0
                },
                byBundle: {},
                byOperation: {},
                startTime: new Date().toISOString(),
                lastEventTime: null
              },
              active: true,
              filters: {
                types: ['url_scheme'],
                search: ''
              }
            }
          })

          // Update feature state to enabled
          store.dispatch('frida/toggleFeature', {
            platform: data.platform,
            category: data.category,
            feature: data.feature,
            value: true
          })

          showNotification('URL scheme monitoring started', 'success')
        } else {
          showNotification('Failed to start URL scheme monitoring', 'error')
          return
        }
      } catch (error) {
        console.error('Error starting URL scheme monitor:', error)
        showNotification(`Failed to start URL scheme monitoring: ${error.message}`, 'error')
        return
      }
    } else {
      try {
        // Stop monitoring on the backend
        const stopResult = await store.dispatch('frida/executeFeature', {
          sessionId: props.sessionId || 'default',
          deviceId: props.deviceId,
          pid: props.pid,
          platform: data.platform,
          category: data.category,
          feature: data.feature,
          command: 'stopURLSchemeMonitor()'
        })

        console.log('Stop URL scheme monitoring result:', stopResult)

        // Always update the state regardless of backend response
        const currentOutput = store.getters['frida/getFeatureOutput'](data.platform, data.category, data.feature) || {}

        // Force update the output to inactive
        store.commit('frida/SET_FEATURE_OUTPUT', {
          platform: data.platform,
          category: data.category,
          feature: data.feature,
          output: {
            ...currentOutput,
            active: false // This will trigger the URLSchemeMonitor to stop
          }
        })

        // Update feature state to disabled
        store.dispatch('frida/toggleFeature', {
          platform: data.platform,
          category: data.category,
          feature: data.feature,
          value: false
        })

        // Stop any event streams
        store.dispatch('frida/stopFeatureStream', {
          platform: data.platform,
          category: data.category,
          feature: data.feature
        })

        if (stopResult.success) {
          showNotification('URL scheme monitoring stopped', 'info')
        } else {
          // Even if backend says monitoring wasn't active, we've stopped the frontend
          console.warn('Backend reported URL scheme monitoring not active, but frontend has been stopped')
          showNotification('URL scheme monitoring stopped (forced)', 'warning')
        }
      } catch (error) {
        console.error('Error stopping URL scheme monitor:', error)
        showNotification(`Failed to stop URL scheme monitoring: ${error.message}`, 'error')
      }
    }
  } else if (data.feature === 'cryptoMonitor') {
    // Similar handling for crypto monitor
    const command = data.enabled ? 'startCryptoMonitor()' : 'stopCryptoMonitor()'

    try {
      const result = await store.dispatch('frida/executeFeature', {
        sessionId: props.sessionId || 'default',
        deviceId: props.deviceId,
        pid: props.pid,
        platform: data.platform,
        category: data.category,
        feature: data.feature,
        command: command
      })

      if (result.success) {
        // Update feature state
        store.dispatch('frida/toggleFeature', {
          platform: data.platform,
          category: data.category,
          feature: data.feature,
          value: data.enabled
        })

        if (data.enabled) {
          // Initialize output structure for crypto monitor
          store.commit('frida/SET_FEATURE_OUTPUT', {
            platform: data.platform,
            category: data.category,
            feature: data.feature,
            output: {
              events: [],
              active: true
            }
          })
          showNotification('Crypto monitoring started', 'success')
        } else {
          // Update to inactive
          const currentOutput = store.getters['frida/getFeatureOutput'](data.platform, data.category, data.feature) || {}
          store.commit('frida/SET_FEATURE_OUTPUT', {
            platform: data.platform,
            category: data.category,
            feature: data.feature,
            output: {
              ...currentOutput,
              active: false
            }
          })
          showNotification('Crypto monitoring stopped', 'info')
        }
      } else {
        showNotification(`Failed to ${data.enabled ? 'start' : 'stop'} crypto monitoring`, 'error')
      }
    } catch (error) {
      console.error('Error toggling crypto monitor:', error)
      showNotification(`Failed to ${data.enabled ? 'start' : 'stop'} crypto monitoring: ${error.message}`, 'error')
    }
  } else {
    // For other features, just update the state
    store.dispatch('frida/toggleFeature', {
      platform: data.platform,
      category: data.category,
      feature: data.feature,
      value: data.enabled
    })
  }

  emit('feature-toggle', data)
}

// Keyboard shortcuts
const handleKeyDown = (event) => {
  if (!props.visible) return

  const isCtrlOrCmd = event.ctrlKey || event.metaKey

  if (isCtrlOrCmd) {
    switch (event.key.toLowerCase()) {
      case 'escape':
        event.preventDefault()
        closeDialog()
        break
      case 'm':
        event.preventDefault()
        minimizeDialog()
        break
      case 'f':
        event.preventDefault()
        toggleFullscreen()
        break
      case '+':
      case '=':
        event.preventDefault()
        increaseFontSize()
        break
      case '-':
      case '_':
        event.preventDefault()
        decreaseFontSize()
        break
      case 'a':
        event.preventDefault()
        expandAll()
        break
      case 'c':
        event.preventDefault()
        collapseAll()
        break
    }
  }
}

// Lifecycle
onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)

  // CRITICAL: Only initialize UI, don't execute any commands or check agent status
  updateFontSize()

  // Log current state for debugging
  console.log('FridaClicksContainer mounted')
  console.log('Agent loaded:', agentLoaded.value)
  console.log('Session ID:', props.sessionId)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)

  // Force stop any active monitoring before closing
  if (features.value.android?.ipc?.ipcMonitor) {
    // Set IPC monitoring to inactive
    store.commit('frida/SET_FEATURE_OUTPUT', {
      platform: 'android',
      category: 'ipc',
      feature: 'ipcMonitor',
      output: {
        ...outputs.value.android?.ipc?.ipcMonitor,
        active: false
      }
    })
  }

  // Clean up any active streams
  store.dispatch('frida/cleanup')
})

// Watch for visibility changes
watch(() => props.visible, (newVal) => {
  if (newVal && store.commit) {
    store.commit('frida/SET_ACTIVE_DIALOG', 'FridaClicksContainer')
  } else if (!newVal && store.state.frida?.activeDialog === 'FridaClicksContainer' && store.commit) {
    store.commit('frida/SET_ACTIVE_DIALOG', null)

    // When dialog is closed, ensure all monitoring is stopped
    if (features.value.android?.ipc?.ipcMonitor) {
      store.commit('frida/SET_FEATURE_OUTPUT', {
        platform: 'android',
        category: 'ipc',
        feature: 'ipcMonitor',
        output: {
          ...outputs.value.android?.ipc?.ipcMonitor,
          active: false
        }
      })
    }

    if (features.value.ios?.crypto?.cryptoMonitor) {
      store.commit('frida/SET_FEATURE_OUTPUT', {
        platform: 'ios',
        category: 'crypto',
        feature: 'cryptoMonitor',
        output: {
          ...outputs.value.ios?.crypto?.cryptoMonitor,
          active: false
        }
      })
    }
  }
})

// Watch for font size changes from store
watch(fontSize, (newSize) => {
  currentFontSize.value = newSize
  updateFontSize()
})

// Watch for crash / disconnect events
watch(agentDisconnected, (isDisconnected) => {
  if (isDisconnected) {
    showNotification(
      disconnectReason.value || 'Process crashed — session lost',
      'error',
      8000
    )
  }
})
</script>

<style scoped>
@import './styles/FridaClicksContainer.css';
</style>
