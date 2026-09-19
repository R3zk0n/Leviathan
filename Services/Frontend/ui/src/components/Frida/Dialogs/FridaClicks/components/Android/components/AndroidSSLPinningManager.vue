<template>
  <div class="android-ssl-pinning-manager">
    <!-- Main Feature Card -->
    <div class="feature-card ssl-pinning-card">
      <!-- Feature Header -->
      <div class="feature-header">
        <div class="feature-info">
          <v-icon size="small" class="mr-2" :color="isMonitoring ? 'purple' : 'grey'">
            {{ isMonitoring ? 'mdi-shield-lock' : 'mdi-shield-lock-outline' }}
          </v-icon>
          <div>
            <span class="feature-name" :style="{ fontSize: `${fontSize}px` }">SSL/TLS Pinning Security Monitor</span>
            <div class="feature-chips">
              <v-chip size="x-small" class="mr-2" :color="isMonitoring ? 'purple' : 'grey'">
                {{ isMonitoring ? 'ACTIVE' : 'INACTIVE' }}
              </v-chip>
              <v-chip size="x-small" class="mr-2" :color="statistics.activeHooks > 0 ? 'green' : 'grey'" v-if="isMonitoring">
                {{ statistics.activeHooks }} hooks
              </v-chip>
              <v-chip
                v-if="isMonitoring && statistics.bypassedHooks > 0"
                size="x-small"
                class="mr-2"
                color="orange"
              >
                {{ statistics.bypassedHooks }} bypassing
              </v-chip>
              <v-chip
                v-if="isMonitoring && eventRate > 0"
                size="x-small"
                color="blue"
              >
                {{ eventRate }}/s
              </v-chip>
            </div>
          </div>
        </div>
        <v-switch
          v-model="isMonitoring"
          density="compact"
          hide-details
          @update:model-value="toggleMonitoring"
          :disabled="!agentLoaded"
          color="purple"
        />
      </div>

      <div class="feature-description" :style="{ fontSize: `${fontSize - 1}px` }">
        Step 1: Discover available SSL hooks → Step 2: Start monitoring to see which hooks are used → Step 3: Selectively enable/bypass specific hooks
      </div>

      <!-- Control Panel -->
      <div class="control-panel" v-if="isMonitoring">
        <div class="control-section">
          <div class="control-group">
            <v-btn
              size="small"
              color="green"
              @click="discoverHooks"
              :loading="discovering"
              :disabled="!agentLoaded"
            >
              <v-icon left size="small">mdi-radar</v-icon>
              Discover Hooks
            </v-btn>

            <v-btn
              size="small"
              color="blue"
              @click="enableAllMonitoring"
              :disabled="availableHooks.length === 0"
            >
              <v-icon left size="small">mdi-eye</v-icon>
              Monitor All
            </v-btn>

            <v-btn
              size="small"
              color="orange"
              @click="toggleAllBypass"
              :disabled="availableHooks.length === 0"
            >
              <v-icon left size="small">mdi-lock-open</v-icon>
              {{ allBypassEnabled ? 'Disable All Bypass' : 'Enable All Bypass' }}
            </v-btn>

            <v-btn
              size="small"
              color="red"
              @click="disableAllHooks"
              :disabled="availableHooks.length === 0"
            >
              <v-icon left size="small">mdi-stop</v-icon>
              Disable All
            </v-btn>

            <v-btn
              size="small"
              color="blue"
              @click="refreshStatus"
              :loading="refreshing"
            >
              <v-icon left size="small">mdi-refresh</v-icon>
              Refresh
            </v-btn>
          </div>

          <div class="control-group">
            <v-btn
              size="small"
              color="red"
              @click="clearEvents"
              :disabled="events.length === 0"
            >
              <v-icon left size="small">mdi-delete</v-icon>
              Clear Events
            </v-btn>
            <v-btn
              size="small"
              color="teal"
              @click="exportData"
              :disabled="events.length === 0"
            >
              <v-icon left size="small">mdi-download</v-icon>
              Export Data
            </v-btn>
          </div>
        </div>

        <!-- Hook Categories Filter -->
        <div class="category-filter" v-if="availableHooks.length > 0">
          <v-chip-group v-model="selectedCategory" color="primary" variant="outlined">
            <v-chip value="all" size="small">All ({{ availableHooks.length }})</v-chip>
            <v-chip
              v-for="category in hookCategories"
              :key="category.name"
              :value="category.name"
              size="small"
            >
              {{ category.label }} ({{ category.count }})
            </v-chip>
          </v-chip-group>
        </div>

        <!-- Filter Controls -->
        <div class="filter-controls">
          <v-text-field
            v-model="searchFilter"
            density="compact"
            hide-details
            placeholder="Search events..."
            prepend-inner-icon="mdi-magnify"
            clearable
            variant="outlined"
            class="search-field"
          />
          <v-select
            v-model="hookTypeFilter"
            density="compact"
            hide-details
            :items="hookTypeOptions"
            placeholder="Filter by hook type"
            variant="outlined"
            class="filter-select"
            clearable
          />
          <v-select
            v-model="statusFilter"
            density="compact"
            hide-details
            :items="statusOptions"
            placeholder="Filter by status"
            variant="outlined"
            class="filter-select"
            clearable
          />
        </div>
      </div>

      <!-- Statistics Panel -->
      <div class="stats-panel" v-if="isMonitoring">
        <div class="stat-item">
          <span class="stat-label">Total Hooks</span>
          <span class="stat-value">{{ statistics.totalHooks }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Active Hooks</span>
          <span class="stat-value" :class="{ 'text-green': statistics.activeHooks > 0 }">{{ statistics.activeHooks }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Bypassed</span>
          <span class="stat-value" :class="{ 'text-orange': statistics.bypassedHooks > 0 }">{{ statistics.bypassedHooks }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Total Events</span>
          <span class="stat-value">{{ statistics.totalEvents }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Event Rate</span>
          <span class="stat-value">{{ eventRate }}/s</span>
        </div>
        <div class="stat-item" v-if="statistics.lastEventTime">
          <span class="stat-label">Last Event</span>
          <span class="stat-value">{{ formatTime(statistics.lastEventTime) }}</span>
        </div>
      </div>

      <!-- Hook Management Section -->
      <div class="hooks-section" v-if="isMonitoring && availableHooks.length > 0">
        <div class="hooks-header">
          <h4>SSL Hooks Management</h4>
          <div class="hooks-legend">
            <span class="legend-item">
              <v-icon size="x-small" color="green">mdi-circle</v-icon>
              Monitor
            </span>
            <span class="legend-item">
              <v-icon size="x-small" color="orange">mdi-circle</v-icon>
              Bypass
            </span>
            <span class="legend-item">
              <v-icon size="x-small" color="blue">mdi-circle</v-icon>
              Active
            </span>
          </div>
        </div>

        <!-- Hooks by Category -->
        <div class="hooks-list">
          <div
            v-for="category in organizedHooks"
            :key="category.name"
            class="hook-category"
            v-show="selectedCategory === 'all' || selectedCategory === category.name"
          >
            <div class="category-header">
              <h5>{{ category.label }}</h5>
              <div class="category-actions">
                <v-btn
                  size="x-small"
                  variant="outlined"
                  color="green"
                  @click="enableCategoryMonitoring(category.name)"
                >
                  Monitor All
                </v-btn>
                <v-btn
                  size="x-small"
                  variant="outlined"
                  color="orange"
                  @click="enableCategoryBypass(category.name)"
                >
                  Bypass All
                </v-btn>
                <v-btn
                  size="x-small"
                  variant="outlined"
                  color="red"
                  @click="disableCategoryHooks(category.name)"
                >
                  Disable All
                </v-btn>
              </div>
            </div>

            <div class="hooks-grid">
              <div
                v-for="hook in category.hooks"
                :key="hook.id"
                class="hook-card"
                :class="{
                  'hook-monitoring': hook.enabled,
                  'hook-bypassing': hook.bypassActive,
                  'hook-active': hook.hitCount > 0
                }"
              >
                <div class="hook-header">
                  <div class="hook-info">
                    <div class="hook-name">{{ hook.displayName || hook.name }}</div>
                    <div class="hook-library">{{ hook.library }}</div>
                  </div>
                  <div class="hook-status">
                    <v-icon
                      v-if="hook.hitCount > 0"
                      size="small"
                      color="blue"
                      class="pulse"
                    >
                      mdi-pulse
                    </v-icon>
                    <span v-if="hook.hitCount > 0" class="hit-count">{{ hook.hitCount }}</span>
                  </div>
                </div>

                <div class="hook-description" v-if="hook.description">
                  {{ hook.description }}
                </div>

                <div class="hook-controls">
                  <div class="control-row">
                    <label class="control-label">Monitor</label>
                    <v-switch
                      v-model="hook.enabled"
                      density="compact"
                      hide-details
                      @update:model-value="(enabled) => toggleHook(hook.id, enabled)"
                      color="green"
                      class="hook-switch"
                    />
                  </div>

                  <div class="control-row">
                    <label class="control-label">Bypass</label>
                    <v-switch
                      v-model="hook.bypassActive"
                      density="compact"
                      hide-details
                      @update:model-value="(enabled) => toggleBypass(hook.id, enabled)"
                      color="orange"
                      class="bypass-switch"
                      :disabled="!hook.enabled"
                    />
                  </div>
                </div>

                <div class="hook-footer" v-if="hook.enabled">
                  <div class="hook-metadata">
                    <span class="hook-type">{{ hook.type }}</span>
                    <span v-if="hook.lastHit" class="last-hit">
                      Last: {{ formatTime(hook.lastHit) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Events Display -->
      <div class="ssl-events" v-if="isMonitoring">
        <div class="events-header">
          <h4>SSL/TLS Events ({{ filteredEvents.length }})</h4>
          <div class="events-actions">
            <v-btn size="x-small" @click="toggleEventsPaused" :color="eventsPaused ? 'orange' : 'green'">
              <v-icon size="small">{{ eventsPaused ? 'mdi-play' : 'mdi-pause' }}</v-icon>
              {{ eventsPaused ? 'Resume' : 'Pause' }}
            </v-btn>
          </div>
        </div>

        <!-- Event List -->
        <div class="events-list" v-if="filteredEvents.length > 0">
          <div
            v-for="(event, index) in filteredEvents.slice(0, maxDisplayEvents)"
            :key="`${event.timestamp}-${index}`"
            class="event-item"
            :class="{
              expanded: expandedEvents.includes(event.id),
              'new-event': isNewEvent(event),
              'event-success': event.success,
              'event-error': !event.success,
              'event-bypass': event.bypassActive
            }"
            @click="toggleEventExpansion(event.id)"
          >
            <div class="event-header">
              <v-icon
                size="small"
                class="event-icon"
                :color="getEventIconColor(event)"
              >
                {{ getEventIcon(event) }}
              </v-icon>
              <div class="event-summary">
                <div class="event-title">{{ event.hookName || event.method }}</div>
                <div class="event-details">
                  <span class="event-host">{{ event.hostname || event.url }}</span>
                  <span class="event-time">{{ formatTime(event.timestamp) }}</span>
                  <v-chip size="x-small" :color="event.success ? 'green' : 'red'">
                    {{ event.success ? 'Success' : 'Failed' }}
                  </v-chip>
                  <v-chip v-if="event.bypassActive" size="x-small" color="orange">
                    Bypassed
                  </v-chip>
                </div>
              </div>
              <v-icon size="small" class="expand-icon">
                {{ expandedEvents.includes(event.id) ? 'mdi-chevron-up' : 'mdi-chevron-down' }}
              </v-icon>
            </div>

            <!-- Expanded Event Details -->
            <div v-if="expandedEvents.includes(event.id)" class="event-expanded">
              <div class="detail-content">
                <div class="detail-row" v-if="event.hostname">
                  <span class="detail-label">Hostname:</span>
                  <span class="detail-value">{{ event.hostname }}</span>
                </div>
                <div class="detail-row" v-if="event.url">
                  <span class="detail-label">URL:</span>
                  <span class="detail-value">{{ event.url }}</span>
                </div>
                <div class="detail-row" v-if="event.method">
                  <span class="detail-label">Method:</span>
                  <span class="detail-value">{{ event.method }}</span>
                </div>
                <div class="detail-row" v-if="event.hookType">
                  <span class="detail-label">Hook Type:</span>
                  <span class="detail-value">{{ event.hookType }}</span>
                </div>
                <div class="detail-row" v-if="event.certificate">
                  <span class="detail-label">Certificate:</span>
                  <div class="certificate-info">
                    <div v-if="event.certificate.subject">Subject: {{ event.certificate.subject }}</div>
                    <div v-if="event.certificate.issuer">Issuer: {{ event.certificate.issuer }}</div>
                    <div v-if="event.certificate.fingerprint">Fingerprint: {{ event.certificate.fingerprint }}</div>
                  </div>
                </div>
                <div class="detail-row" v-if="event.error">
                  <span class="detail-label">Error:</span>
                  <span class="detail-value error-text">{{ event.error }}</span>
                </div>
                <div class="detail-row" v-if="event.stackTrace">
                  <span class="detail-label">Stack Trace:</span>
                  <div class="stack-trace">
                    <pre>{{ event.stackTrace }}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Load More Button -->
          <div v-if="filteredEvents.length > maxDisplayEvents" class="load-more">
            <v-btn size="small" @click="loadMoreEvents" color="blue">
              Load More ({{ filteredEvents.length - maxDisplayEvents }} remaining)
            </v-btn>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="empty-state">
          <v-icon size="48" color="grey-lighten-1">mdi-shield-lock-outline</v-icon>
          <h4>{{ isMonitoring ? 'No SSL Events Captured Yet' : 'Start Monitoring to Capture SSL Events' }}</h4>
          <p>{{ isMonitoring ? 'SSL events will appear here as they occur.' : 'Enable hooks and toggle monitoring to begin capturing SSL/TLS communications.' }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import EventSource from '@/utils/authenticatedEventSource'
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import axios from 'axios'

// Props
const props = defineProps({
  sessionId: String,
  agentLoaded: Boolean,
  active: Boolean,
  fontSize: { type: Number, default: 14 },
  sslData: Object,
  deviceId: String,
  pid: Number,
  outputData: { type: [Object, Array], default: () => ({}) }
})

// Emits
const emit = defineEmits(['toggle', 'show-notification'])

// State
const isMonitoring = ref(false)
const discovering = ref(false)
const refreshing = ref(false)
const eventsPaused = ref(false)
const selectedCategory = ref('all')
const availableHooks = ref([])
const events = ref([])
const eventRate = ref(0)
const expandedEvents = ref([])
const newEventIds = ref(new Set())
const maxDisplayEvents = ref(50)

// Filter state
const searchFilter = ref('')
const hookTypeFilter = ref(null)
const statusFilter = ref(null)

// Statistics
const statistics = ref({
  totalHooks: 0,
  activeHooks: 0,
  bypassedHooks: 0,
  totalEvents: 0,
  lastEventTime: null
})

// Event source management
let eventSource = null
let reconnectTimeout = null
let eventRateInterval = null
let lastEventCount = 0
let recentEvents = []

// Filter options
const hookTypeOptions = computed(() => {
  const types = [...new Set(availableHooks.value.map(h => h.category))].filter(Boolean)
  return types.map(type => ({ title: type, value: type }))
})

const statusOptions = [
  { title: 'All', value: null },
  { title: 'Success', value: 'success' },
  { title: 'Failed', value: 'failed' },
  { title: 'Bypassed', value: 'bypassed' }
]

// Computed properties
const allBypassEnabled = computed(() => {
  return availableHooks.value.length > 0 &&
         availableHooks.value.filter(h => h.enabled).every(h => h.bypassActive)
})

const filteredEvents = computed(() => {
  let filtered = events.value

  if (searchFilter.value) {
    const search = searchFilter.value.toLowerCase()
    filtered = filtered.filter(event =>
      event.hostname?.toLowerCase().includes(search) ||
      event.url?.toLowerCase().includes(search) ||
      event.method?.toLowerCase().includes(search) ||
      event.hookName?.toLowerCase().includes(search)
    )
  }

  if (hookTypeFilter.value) {
    filtered = filtered.filter(event => event.hookType === hookTypeFilter.value)
  }

  if (statusFilter.value) {
    filtered = filtered.filter(event => {
      switch (statusFilter.value) {
        case 'success': return event.success
        case 'failed': return !event.success
        case 'bypassed': return event.bypassActive
        default: return true
      }
    })
  }

  return filtered.filter(event => event && event.timestamp)
})

const hookCategories = computed(() => {
  const categories = {}
  availableHooks.value.forEach(hook => {
    if (!categories[hook.category]) {
      categories[hook.category] = {
        name: hook.category,
        label: getCategoryLabel(hook.category),
        count: 0
      }
    }
    categories[hook.category].count++
  })
  return Object.values(categories)
})

const organizedHooks = computed(() => {
  const categories = {}
  availableHooks.value.forEach(hook => {
    if (!categories[hook.category]) {
      categories[hook.category] = {
        name: hook.category,
        label: getCategoryLabel(hook.category),
        hooks: []
      }
    }
    categories[hook.category].hooks.push(hook)
  })

  // Sort hooks within each category by name
  Object.values(categories).forEach(category => {
    category.hooks.sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name))
  })

  return Object.values(categories)
})

// Helper functions
const getCategoryLabel = (category) => {
  const labels = {
    native: 'Native SSL',
    conscrypt: 'Conscrypt',
    java: 'Java SSL',
    okhttp: 'OkHttp',
    webview: 'WebView'
  }
  return labels[category] || category.charAt(0).toUpperCase() + category.slice(1)
}

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString()
}

const executeSSLFeature = async (method, ...args) => {
  try {
    const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
      session_id: props.sessionId,
      command: args.length > 0 ? `${method}(${args.map(a => JSON.stringify(a)).join(', ')})` : `${method}()`,
    })

    if (response.data.status === 'success') {
      return response.data.result || response.data.output
    } else {
      throw new Error(response.data.message || 'Failed to execute SSL feature')
    }
  } catch (error) {
    console.error('Error executing SSL feature:', error)
    throw error
  }
}

// Event source management
const setupEventSource = () => {
  if (eventSource) {
    closeEventSource()
  }

  const eventSourceUrl = `${import.meta.env.VITE_APP_API_URL}/frida/feature-stream/${props.sessionId || 'default'}/android/Network-Security/sslPinningManager`

  console.log('SSL EventSource: Setting up connection')
  console.log('URL:', eventSourceUrl)
  console.log('Session ID:', props.sessionId)

  try {
    eventSource = new EventSource(eventSourceUrl)

    eventSource.onopen = () => {
      console.log('SSL EventSource: Connection opened successfully')
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        handleEventSourceMessage(data)
      } catch (error) {
        console.error('Error parsing event data:', error)
      }
    }

    eventSource.onerror = (error) => {
      console.error('SSL EventSource error:', error)
      closeEventSource()

      if (isMonitoring.value && props.agentLoaded) {
        reconnectTimeout = setTimeout(() => {
          console.log('Attempting to reconnect SSL EventSource...')
          setupEventSource()
        }, 3000)
      }
    }
  } catch (error) {
    console.error('SSL EventSource: Failed to create EventSource:', error)
    emit('show-notification', `Failed to start SSL monitoring: ${error.message}`, 'error')
  }
}

const closeEventSource = () => {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout)
    reconnectTimeout = null
  }
}

const handleEventSourceMessage = (data) => {
  if (data.type === 'ssl_event' && data.event) {
    if (!eventsPaused.value) {
      const eventData = data.event

      // Add unique ID if not present
      if (!eventData.id) {
        eventData.id = `ssl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }

      // Add timestamp if not present
      if (!eventData.timestamp) {
        eventData.timestamp = new Date().toISOString()
      }

      // Add new event to the beginning of the array (newest first)
      events.value.unshift(eventData)

      // Update statistics
      statistics.value.totalEvents = events.value.length
      statistics.value.lastEventTime = eventData.timestamp

      // Update hook hit count
      const hook = availableHooks.value.find(h => h.id === eventData.hookId)
      if (hook) {
        hook.hitCount = data.hitCount || (hook.hitCount + 1)
        hook.lastHit = eventData.timestamp
      }

      // Mark as new event for animation
      newEventIds.value.add(eventData.id)
      setTimeout(() => newEventIds.value.delete(eventData.id), 3000)

      // Add to recent events for rate calculation
      recentEvents.push(Date.now())

      // Limit events to prevent memory issues
      if (events.value.length > 1000) {
        events.value = events.value.slice(-1000)
      }

      updateStatistics()

      // Emit notification for new event
      emit('show-notification', `New SSL event: ${eventData.hookName} on ${eventData.hostname || 'unknown'}`, 'info')

      // Special notifications for important events
      if (eventData.action === 'bypassed') {
        emit('show-notification', `SSL pinning bypassed: ${eventData.hookName}`, 'success')
      } else if (eventData.action === 'blocked') {
        emit('show-notification', `SSL pinning blocked: ${eventData.hookName}`, 'warning')
      }
    }
  }
  else if (data.type === 'ssl_hook_enabled' || data.type === 'ssl_hook_disabled') {
    const hook = availableHooks.value.find(h => h.id === data.hookId)
    if (hook) {
      hook.enabled = data.type === 'ssl_hook_enabled'
      updateStatistics()
    }
  }
  else if (data.type === 'ssl_discovery_complete') {
    if (data.hooks && Array.isArray(data.hooks)) {
      availableHooks.value = data.hooks.map(hook => ({
        ...hook,
        hitCount: 0,
        lastHit: null
      }))
      updateStatistics()
      emit('show-notification', `Discovered ${data.hooks.length} SSL hooks`, 'success')
    }
  }
  else if (data.type === 'ssl_monitoring_started') {
    emit('show-notification', `SSL monitoring started: ${data.hooksEnabled} hooks enabled`, 'success')
    refreshStatus()
  }
  else if (data.type === 'ssl_monitoring_stopped') {
    emit('show-notification', `SSL monitoring stopped: ${data.hooksDisabled} hooks disabled`, 'info')
    refreshStatus()
  }
  else if (data.type === 'ssl_stats') {
    if (data.statistics) {
      statistics.value = { ...statistics.value, ...data.statistics }
    }
  }
  else if (data.type === 'status') {
    emit('show-notification', data.message, 'info')
  }
}

const calculateEventRate = () => {
  eventRateInterval = setInterval(() => {
    const now = Date.now()
    recentEvents = recentEvents.filter(time => now - time < 1000)
    eventRate.value = recentEvents.length
  }, 1000)
}

const updateStatistics = () => {
  statistics.value = {
    ...statistics.value,
    totalHooks: availableHooks.value.length,
    activeHooks: availableHooks.value.filter(h => h.enabled).length,
    bypassedHooks: availableHooks.value.filter(h => h.bypassActive).length,
    totalEvents: events.value.length
  }
}

// Main control functions
const toggleMonitoring = async (enabled) => {
  try {
    if (enabled) {
      await startMonitoring()
    } else {
      await stopMonitoring()
    }
    emit('toggle', enabled)
  } catch (error) {
    console.error('Error toggling SSL monitoring:', error)
    emit('show-notification', `Error toggling SSL monitoring: ${error.message}`, 'error')
    isMonitoring.value = !enabled
  }
}

const startMonitoring = async () => {
  try {
    await executeSSLFeature('monitorSSLCalls')
    setupEventSource()
    calculateEventRate()
    emit('show-notification', 'SSL monitoring started - all available hooks enabled in monitor mode', 'success')
  } catch (error) {
    throw new Error(`Failed to start SSL monitoring: ${error.message}`)
  }
}

const stopMonitoring = async () => {
  try {
    await executeSSLFeature('stopSSLMonitoring')
    closeEventSource()
    if (eventRateInterval) {
      clearInterval(eventRateInterval)
      eventRate.value = 0
    }
    emit('show-notification', 'SSL monitoring stopped', 'info')
  } catch (error) {
    throw new Error(`Failed to stop SSL monitoring: ${error.message}`)
  }
}

// Hook discovery and management
const discoverHooks = async () => {
  discovering.value = true
  try {
    const result = await executeSSLFeature('discoverSSLHooks')
    console.log('Hook discovery result:', result)

    // Handle nested response structure - the hooks might be at result.hooks or result.result.hooks
    let hooks = result?.hooks || result?.result?.hooks || []

    if (hooks && hooks.length > 0) {
      // Preserve the actual hitCount and lastHit from backend, don't overwrite them
      availableHooks.value = hooks.map(hook => ({
        ...hook,
        displayName: hook.name, // Ensure displayName is set
        hitCount: hook.hitCount || 0,
        lastHit: hook.lastHit || null
      }))
      updateStatistics()
      console.log('Hooks loaded:', availableHooks.value.length)
    } else {
      console.warn('No hooks found in response')
    }

    emit('show-notification', `Discovered ${hooks.length} SSL hooks`, 'success')
  } catch (error) {
    console.error('Error discovering hooks:', error)
    emit('show-notification', `Error discovering hooks: ${error.message}`, 'error')
  } finally {
    discovering.value = false
  }
}

// Individual hook controls
const toggleHook = async (hookId, enabled) => {
  try {
    await executeSSLFeature(enabled ? 'enableSSLHook' : 'disableSSLHook', hookId)
    const hook = availableHooks.value.find(h => h.id === hookId)
    if (hook) {
      hook.enabled = enabled
      if (!enabled) {
        hook.bypassActive = false // Disable bypass when disabling monitoring
      }
      updateStatistics()
    }
    emit('show-notification', `Hook ${hookId} ${enabled ? 'enabled' : 'disabled'}`, 'success')
  } catch (error) {
    emit('show-notification', `Error toggling hook: ${error.message}`, 'error')
    // Revert the change
    const hook = availableHooks.value.find(h => h.id === hookId)
    if (hook) hook.enabled = !enabled
  }
}

const toggleBypass = async (hookId, enabled) => {
  try {
    await executeSSLFeature(enabled ? 'enableSSLBypass' : 'disableSSLBypass', hookId)
    const hook = availableHooks.value.find(h => h.id === hookId)
    if (hook) {
      hook.bypassActive = enabled
      updateStatistics()
    }
    emit('show-notification', `Bypass for ${hookId} ${enabled ? 'enabled' : 'disabled'}`, 'info')
  } catch (error) {
    emit('show-notification', `Error toggling bypass: ${error.message}`, 'error')
    // Revert the change
    const hook = availableHooks.value.find(h => h.id === hookId)
    if (hook) hook.bypassActive = !enabled
  }
}

// Bulk operations
const enableAllMonitoring = async () => {
  try {
    await executeSSLFeature('enableAllSSLHooks', false)
    availableHooks.value.forEach(hook => {
      hook.enabled = true
    })
    updateStatistics()
    emit('show-notification', 'All hooks enabled for monitoring', 'success')
  } catch (error) {
    emit('show-notification', `Error enabling all hooks: ${error.message}`, 'error')
  }
}

const toggleAllBypass = async () => {
  const enable = !allBypassEnabled.value
  try {
    await executeSSLFeature(enable ? 'enableAllSSLBypass' : 'disableAllSSLBypass')
    availableHooks.value.forEach(hook => {
      if (hook.enabled) hook.bypassActive = enable
    })
    updateStatistics()
    emit('show-notification', `All bypasses ${enable ? 'enabled' : 'disabled'}`, 'success')
  } catch (error) {
    emit('show-notification', `Error toggling all bypasses: ${error.message}`, 'error')
  }
}

const disableAllHooks = async () => {
  try {
    await executeSSLFeature('disableAllSSLHooks')
    availableHooks.value.forEach(hook => {
      hook.enabled = false
      hook.bypassActive = false
    })
    updateStatistics()
    emit('show-notification', 'All hooks disabled', 'info')
  } catch (error) {
    emit('show-notification', `Error disabling all hooks: ${error.message}`, 'error')
  }
}

const refreshStatus = async () => {
  refreshing.value = true
  try {
    const result = await executeSSLFeature('getSSLHookStatus')
    if (result?.hooks) {
      availableHooks.value = result.hooks
    }
    if (result?.stats) {
      statistics.value = { ...statistics.value, ...result.stats }
    }
    emit('show-notification', 'Status refreshed', 'success')
  } catch (error) {
    emit('show-notification', `Error refreshing status: ${error.message}`, 'error')
  } finally {
    refreshing.value = false
  }
}

// Category-based operations
const enableCategoryMonitoring = async (category) => {
  try {
    await executeSSLFeature('enableSSLHooksByCategory', category, false)
    availableHooks.value.forEach(hook => {
      if (hook.category === category) hook.enabled = true
    })
    updateStatistics()
    emit('show-notification', `All ${getCategoryLabel(category)} hooks enabled for monitoring`, 'success')
  } catch (error) {
    emit('show-notification', `Error enabling ${category} hooks: ${error.message}`, 'error')
  }
}

const enableCategoryBypass = async (category) => {
  try {
    await executeSSLFeature('enableSSLHooksByCategory', category, true)
    availableHooks.value.forEach(hook => {
      if (hook.category === category) {
        hook.enabled = true
        hook.bypassActive = true
      }
    })
    updateStatistics()
    emit('show-notification', `All ${getCategoryLabel(category)} hooks enabled with bypass`, 'success')
  } catch (error) {
    emit('show-notification', `Error enabling ${category} bypass: ${error.message}`, 'error')
  }
}

const disableCategoryHooks = async (category) => {
  availableHooks.value.forEach(hook => {
    if (hook.category === category) {
      hook.enabled = false
      hook.bypassActive = false
    }
  })
  updateStatistics()
  emit('show-notification', `All ${getCategoryLabel(category)} hooks disabled`, 'info')
}

// Event management
const toggleEventExpansion = (eventId) => {
  const index = expandedEvents.value.indexOf(eventId)
  if (index > -1) {
    expandedEvents.value.splice(index, 1)
  } else {
    expandedEvents.value.push(eventId)
  }
}

const toggleEventsPaused = () => {
  eventsPaused.value = !eventsPaused.value
  emit('show-notification', `Events ${eventsPaused.value ? 'paused' : 'resumed'}`, 'info')
}

const loadMoreEvents = () => {
  maxDisplayEvents.value += 50
}

const isNewEvent = (event) => {
  return newEventIds.value.has(event.id)
}

const getEventIcon = (event) => {
  if (event.bypassActive) return 'mdi-lock-open'
  if (event.success) return 'mdi-shield-check'
  return 'mdi-shield-alert'
}

const getEventIconColor = (event) => {
  if (event.bypassActive) return 'orange'
  if (event.success) return 'green'
  return 'red'
}

const clearEvents = () => {
  events.value = []
  expandedEvents.value = []
  newEventIds.value.clear()
  statistics.value.totalEvents = 0
  statistics.value.lastEventTime = null
  emit('show-notification', 'Events cleared', 'info')
}

const exportData = () => {
  try {
    const exportData = {
      exportInfo: {
        timestamp: new Date().toISOString(),
        sessionId: props.sessionId,
        deviceId: props.deviceId,
        pid: props.pid,
        platform: 'android'
      },
      statistics: statistics.value,
      hooks: availableHooks.value,
      events: events.value
    }

    const dataStr = JSON.stringify(exportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ssl-pinning-data-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)

    emit('show-notification', 'SSL data exported successfully', 'success')
  } catch (error) {
    emit('show-notification', `Error exporting data: ${error.message}`, 'error')
  }
}

// Watch for external data updates
watch(() => props.sslData, (newData) => {
  if (newData) {
    if (newData.events) {
      events.value = newData.events
    }
    if (newData.hooks) {
      availableHooks.value = newData.hooks
    }
    if (newData.statistics) {
      statistics.value = { ...statistics.value, ...newData.statistics }
    }
  }
}, { deep: true, immediate: true })

watch(() => props.active, (newVal) => {
  if (newVal !== isMonitoring.value) {
    isMonitoring.value = newVal
    if (newVal) {
      setupEventSource()
    } else {
      closeEventSource()
    }
  }
})

watch(() => props.outputData, (newData) => {
  if (newData && typeof newData === 'object') {
    if (newData.events) {
      events.value = newData.events
    }
    if (newData.hooks) {
      availableHooks.value = newData.hooks
    }
    if (newData.statistics) {
      statistics.value = { ...statistics.value, ...newData.statistics }
    }
  }
}, { deep: true, immediate: true })

// Lifecycle
onMounted(() => {
  console.log('SSL Pinning Manager mounted')
  console.log('Session ID:', props.sessionId)
  console.log('Agent loaded:', props.agentLoaded)
  console.log('▶Active state:', props.active)

  if (props.active) {
    isMonitoring.value = true
    nextTick(() => {
      startMonitoring()
    })
  }

  // Always set up EventSource on mount if agent is loaded
  if (props.agentLoaded) {
    setupEventSource()
  }
})

onUnmounted(() => {
  console.log('SSL Pinning Manager unmounting')
  closeEventSource()
  if (eventRateInterval) {
    clearInterval(eventRateInterval)
  }
})

// Expose forceReconnect for debugging
if (import.meta.env.DEV) {
  window.debugSSLReconnect = () => {
    console.log('SSL EventSource: Force reconnecting...')
    closeEventSource()
    if (isMonitoring.value) {
      setTimeout(() => {
        setupEventSource()
      }, 1000)
    }
  }
}
</script>

<style scoped>
.android-ssl-pinning-manager {
  animation: fadeIn 0.3s ease-out;
}

.feature-card {
  background: linear-gradient(135deg, #1a1d21 0%, #13151a 100%);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.feature-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.feature-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.feature-name {
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 4px;
}

.feature-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.feature-description {
  padding: 16px 20px;
  color: #9aa0a6;
  line-height: 1.5;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.control-panel {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.control-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.control-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.category-filter {
  margin-top: 16px;
}

.filter-controls {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
  margin-top: 16px;
}

.search-field {
  flex: 1;
  min-width: 200px;
  max-width: 300px;
}

.filter-select {
  min-width: 150px;
}

.stats-panel {
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 12px;
  color: #9aa0a6;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
}

.text-green {
  color: #4ade80 !important;
}

.text-orange {
  color: #fb923c !important;
}

.hooks-section {
  padding: 20px;
}

.hooks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.hooks-legend {
  display: flex;
  gap: 16px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #9aa0a6;
}

.hook-category {
  margin-bottom: 24px;
}

.category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.category-header h5 {
  margin: 0;
  color: #ffffff;
  font-weight: 500;
}

.category-actions {
  display: flex;
  gap: 8px;
}

.hooks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.hook-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 16px;
  transition: all 0.3s ease;
}

.hook-card:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.12);
}

.hook-card.hook-monitoring {
  border-left: 4px solid #4caf50;
}

.hook-card.hook-bypassing {
  border-left: 4px solid #ff9800;
  background: rgba(255, 152, 0, 0.05);
}

.hook-card.hook-active {
  box-shadow: 0 0 20px rgba(33, 150, 243, 0.3);
}

.hook-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.hook-info {
  flex: 1;
}

.hook-name {
  font-weight: 500;
  color: #ffffff;
  margin-bottom: 4px;
  font-size: 14px;
}

.hook-library {
  font-size: 12px;
  color: #9aa0a6;
  font-family: monospace;
}

.hook-status {
  display: flex;
  align-items: center;
  gap: 4px;
}

.hit-count {
  font-size: 12px;
  color: #2196f3;
  font-weight: 500;
}

.hook-description {
  font-size: 12px;
  color: #9aa0a6;
  margin-bottom: 12px;
  line-height: 1.4;
}

.hook-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.control-label {
  font-size: 12px;
  color: #9aa0a6;
  font-weight: 500;
}

.hook-footer {
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.hook-metadata {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #9aa0a6;
}

.hook-type {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}

.ssl-events {
  padding: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.events-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.events-actions {
  display: flex;
  gap: 8px;
}

.events-list {
  max-height: 400px;
  overflow-y: auto;
}

.event-item {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 12px;
  margin-bottom: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: all 0.2s ease;
}

.event-item:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.12);
}

.event-item.expanded {
  border-color: rgba(156, 39, 176, 0.3);
}

.event-item.new-event {
  animation: newEventGlow 1s ease-out;
}

.event-item.event-success {
  border-left: 3px solid #4ade80;
}

.event-item.event-error {
  border-left: 3px solid #ef4444;
}

.event-item.event-bypass {
  border-left: 3px solid #fb923c;
}

.event-header {
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.event-icon {
  flex-shrink: 0;
}

.event-summary {
  flex: 1;
  min-width: 0;
}

.event-title {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 4px;
  word-break: break-all;
}

.event-details {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.event-host {
  font-size: 14px;
  color: #9aa0a6;
  word-break: break-all;
}

.event-time {
  font-size: 12px;
  color: #666;
}

.expand-icon {
  flex-shrink: 0;
}

.event-expanded {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding: 16px;
}

.detail-content {
  padding: 16px 0;
}

.detail-row {
  display: flex;
  margin-bottom: 12px;
  gap: 16px;
}

.detail-label {
  font-weight: 600;
  color: #9aa0a6;
  min-width: 120px;
  flex-shrink: 0;
}

.detail-value {
  color: #ffffff;
  word-break: break-all;
}

.error-text {
  color: #ef4444;
}

.certificate-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-family: monospace;
  font-size: 12px;
}

.stack-trace {
  max-height: 200px;
  overflow-y: auto;
}

.stack-trace pre {
  color: #9aa0a6;
  font-size: 11px;
  margin: 0;
  white-space: pre-wrap;
}

.load-more {
  text-align: center;
  padding: 16px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #9aa0a6;
}

.empty-state h4 {
  margin: 16px 0 8px 0;
  color: #ffffff;
}

.empty-state p {
  margin: 0;
  line-height: 1.5;
}

.pulse {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes newEventGlow {
  0% {
    background: rgba(156, 39, 176, 0.2);
    border-color: rgba(156, 39, 176, 0.5);
    transform: scale(1.02);
  }
  100% {
    background: rgba(255, 255, 255, 0.02);
    border-color: rgba(255, 255, 255, 0.06);
    transform: scale(1);
  }
}
</style>
