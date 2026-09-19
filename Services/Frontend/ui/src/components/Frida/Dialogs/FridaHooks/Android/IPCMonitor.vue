<template>
  <div v-if="outputData && !platformMismatch" class="android-ipc-display">
    <!-- Modern Header -->
    <div class="ipc-header">
      <div class="header-left">
        <div class="header-icon-wrapper">
          <v-icon size="24" color="purple">mdi-swap-horizontal</v-icon>
          <div v-if="monitoring" class="pulse-ring"></div>
        </div>
        <div class="header-text">
          <h3 class="header-title">Android IPC Monitor</h3>
          <p class="header-subtitle">
            {{ monitoring ? 'Actively Monitoring' : 'Ready to Monitor' }} IPC Communications
          </p>
        </div>
      </div>
      <div class="header-actions">
        <v-chip size="small" :color="monitoring ? 'success' : 'grey'" class="mr-2">
          <v-icon size="small" class="mr-1">{{ monitoring ? 'mdi-record' : 'mdi-record-circle-outline' }}</v-icon>
          {{ monitoring ? 'LIVE' : 'STOPPED' }}
          <span v-if="monitoring && eventRate > 0" class="event-rate">
            ({{ eventRate }}/s)
          </span>
        </v-chip>
        <v-btn
          icon
          size="small"
          variant="text"
          @click="toggleFilters"
          class="action-btn"
        >
          <v-icon size="18">mdi-filter</v-icon>
          <v-tooltip activator="parent" location="bottom">
            <div>Filters</div>
            <div class="text-caption">Press F</div>
          </v-tooltip>
        </v-btn>
        <v-btn
          icon
          size="small"
          variant="text"
          @click="handleExport"
          class="action-btn"
        >
          <v-icon size="18">mdi-download</v-icon>
          <v-tooltip activator="parent" location="bottom">Export data</v-tooltip>
        </v-btn>
        <v-btn
          icon
          size="small"
          variant="text"
          @click="handleClear"
          class="action-btn"
        >
          <v-icon size="18">mdi-delete</v-icon>
          <v-tooltip activator="parent" location="bottom">
            <div>Clear events</div>
            <div class="text-caption">Press C</div>
          </v-tooltip>
        </v-btn>
      </div>
    </div>

    <!-- Statistics Cards -->
    <div class="stats-grid">
      <div
        v-for="(stat, index) in statsCards"
        :key="stat.id"
        :class="['stat-card', `${stat.id}-card`]"
        :style="{ animationDelay: `${index * 0.05}s` }"
      >
        <div class="card-glow"></div>
        <div class="card-content">
          <div class="stat-icon-wrapper">
            <v-icon size="20" :color="stat.color">{{ stat.icon }}</v-icon>
          </div>
          <div class="stat-info">
            <transition name="stat-change" mode="out-in">
              <span :key="stat.value" class="stat-value">{{ stat.value }}</span>
            </transition>
            <span class="stat-label">{{ stat.label }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters Panel -->
    <v-expand-transition>
      <div v-if="showFilters" class="filters-panel">
        <div class="filter-section">
          <h4 class="filter-title">IPC Types</h4>
          <div class="filter-chips">
            <v-chip
              v-for="type in ipcTypes"
              :key="type.value"
              size="small"
              :color="filters.types.includes(type.value) ? type.color : 'grey'"
              @click="toggleTypeFilter(type.value)"
              class="filter-chip"
            >
              <v-icon size="x-small" class="mr-1">{{ type.icon }}</v-icon>
              {{ type.label }}
            </v-chip>
          </div>
        </div>
        <div class="filter-section">
          <h4 class="filter-title">Options</h4>
          <v-switch
            v-model="filters.excludeSystem"
            label="Exclude System Packages"
            density="compact"
            hide-details
            color="purple"
          ></v-switch>
          <v-switch
            v-model="showStackTraces"
            label="Show Stack Traces"
            density="compact"
            hide-details
            color="purple"
            class="mt-2"
          ></v-switch>
        </div>
      </div>
    </v-expand-transition>

    <!-- Events Timeline -->
    <div class="events-container">
      <div class="events-header">
        <h4 class="events-title">
          <v-icon size="small" class="mr-2">mdi-timeline</v-icon>
          IPC Events Timeline
        </h4>
        <div class="events-controls">
          <v-text-field
            v-model="searchQuery"
            density="compact"
            hide-details
            single-line
            placeholder="Search events..."
            prepend-inner-icon="mdi-magnify"
            class="search-field"
            clearable
          ></v-text-field>
          <v-btn
            :color="monitoring ? 'error' : 'success'"
            @click="toggleMonitoring"
            :loading="loading"
            variant="flat"
            size="small"
            class="ml-3"
          >
            <v-icon class="mr-1">{{ monitoring ? 'mdi-stop' : 'mdi-play' }}</v-icon>
            {{ monitoring ? 'Stop' : 'Start' }} Monitoring
            <v-tooltip activator="parent" location="bottom">
              <div>{{ monitoring ? 'Stop' : 'Start' }} monitoring</div>
              <div class="text-caption">Press Space</div>
            </v-tooltip>
          </v-btn>
        </div>
      </div>

      <!-- Events List -->
      <div class="events-list" ref="eventsList">
        <transition-group name="event-slide" tag="div">
          <div
            v-for="event in filteredEvents"
            :key="event.id"
            :class="['event-item', `event-${event.type}`, { expanded: expandedEvents.has(event.id) }]"
          >
            <!-- Event Header -->
            <div class="event-header" @click="toggleEventDetails(event.id)">
              <div class="event-main">
                <div class="event-icon-wrapper">
                  <v-icon size="16" :color="getEventColor(event.type)">
                    {{ getEventIcon(event.type) }}
                  </v-icon>
                </div>
                <div class="event-info">
                  <div class="event-title">
                    {{ getEventTitle(event) }}
                  </div>
                  <div class="event-meta">
                    <span class="event-type">{{ event.type.toUpperCase() }}</span>
                    <span class="event-time">{{ formatTime(event.timestamp) }}</span>
                    <span v-if="event.packageName" class="event-package">{{ event.packageName }}</span>
                  </div>
                </div>
              </div>
              <div class="event-actions">
                <v-chip
                  v-if="event.callChain && event.callChain.length > 0"
                  size="x-small"
                  color="purple"
                  class="call-chain-indicator"
                >
                  <v-icon size="x-small" class="mr-1">mdi-source-branch</v-icon>
                  {{ event.callChain.length }} calls
                </v-chip>
                <v-btn
                  icon
                  size="x-small"
                  variant="text"
                  @click.stop="copyEventData(event)"
                  class="quick-action-btn"
                >
                  <v-icon size="14">mdi-content-copy</v-icon>
                  <v-tooltip activator="parent" location="top">Copy event data</v-tooltip>
                </v-btn>
                <v-btn
                  v-if="event.packageName && !filters.packages.includes(event.packageName)"
                  icon
                  size="x-small"
                  variant="text"
                  @click.stop="filterByPackage(event.packageName)"
                  class="quick-action-btn"
                >
                  <v-icon size="14">mdi-filter-plus</v-icon>
                  <v-tooltip activator="parent" location="top">Filter by {{ event.packageName }}</v-tooltip>
                </v-btn>
                <v-icon
                  size="small"
                  :class="['expand-arrow', { rotated: expandedEvents.has(event.id) }]"
                >
                  mdi-chevron-down
                </v-icon>
              </div>
            </div>

            <!-- Event Details -->
            <v-expand-transition>
              <div v-if="expandedEvents.has(event.id)" class="event-details">
                <!-- Call Chain Visualization -->
                <div v-if="event.callChain && event.callChain.length > 0" class="call-chain-section">
                  <h5 class="detail-section-title">
                    <v-icon size="small" class="mr-2">mdi-source-branch</v-icon>
                    Call Chain
                  </h5>
                  <div class="call-chain">
                    <div
                      v-for="(call, idx) in event.callChain"
                      :key="idx"
                      class="call-chain-item"
                    >
                      <div class="chain-connector" v-if="idx > 0"></div>
                      <div class="chain-node">
                        <v-icon size="x-small" color="purple">mdi-function</v-icon>
                        <span class="chain-text">{{ call }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Event Specific Details -->
                <div class="detail-tabs">
                  <v-tabs
                    v-model="activeTab[event.id]"
                    density="compact"
                    color="purple"
                  >
                    <v-tab value="details">Details</v-tab>
                    <v-tab value="extras" v-if="event.extras && Object.keys(event.extras).length > 0">
                      Extras ({{ Object.keys(event.extras).length }})
                    </v-tab>
                    <v-tab value="stack" v-if="showStackTraces && event.stackTrace">
                      Stack Trace
                    </v-tab>
                  </v-tabs>

                  <v-window v-model="activeTab[event.id]">
                    <!-- Details Tab -->
                    <v-window-item value="details">
                      <div class="detail-content">
                        <div class="detail-grid">
                          <div v-for="(value, key) in getEventDetails(event)" :key="key" class="detail-item">
                            <span class="detail-key">{{ formatDetailKey(key) }}</span>
                            <span class="detail-value" :class="{ 'monospace': isMonospace(key) }">
                              {{ formatDetailValue(value) }}
                            </span>
                          </div>
                        </div>
                      </div>
                    </v-window-item>

                    <!-- Extras Tab -->
                    <v-window-item value="extras" v-if="event.extras">
                      <div class="detail-content">
                        <div class="extras-list">
                          <div
                            v-for="(value, key) in event.extras"
                            :key="key"
                            class="extra-item"
                          >
                            <span class="extra-key">{{ key }}</span>
                            <span class="extra-value">{{ formatExtraValue(value) }}</span>
                          </div>
                        </div>
                      </div>
                    </v-window-item>

                    <!-- Stack Trace Tab -->
                    <v-window-item value="stack" v-if="event.stackTrace">
                      <div class="detail-content">
                        <div class="stack-trace">
                          <div
                            v-for="(frame, idx) in event.stackTrace"
                            :key="idx"
                            :class="['stack-frame', { important: frame.startsWith('→') }]"
                          >
                            <span class="frame-number">{{ idx }}</span>
                            <span class="frame-text">{{ frame.replace('→ ', '') }}</span>
                          </div>
                        </div>
                      </div>
                    </v-window-item>
                  </v-window>
                </div>
              </div>
            </v-expand-transition>
          </div>
        </transition-group>

        <!-- Empty State -->
        <div v-if="filteredEvents.length === 0" class="empty-state">
          <v-icon size="64" color="grey">mdi-swap-horizontal-circle-outline</v-icon>
          <h4>{{ monitoring ? 'No IPC Events Captured Yet' : 'Start Monitoring to Capture IPC Events' }}</h4>
          <p>{{ monitoring ? 'IPC events will appear here as they occur.' : 'Click the Start button to begin monitoring Android IPC communications.' }}</p>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="ipc-footer" v-if="localStats.totalEvents > 0">
      <div class="footer-stats">
        <span class="footer-stat">
          <v-icon size="small" class="mr-1">mdi-clock-outline</v-icon>
          Started: {{ formatTime(localStats.startTime) }}
        </span>
        <span v-if="localStats.lastEventTime" class="footer-stat">
          <v-icon size="small" class="mr-1">mdi-update</v-icon>
          Last Event: {{ formatTime(localStats.lastEventTime) }}
        </span>
      </div>
    </div>
  </div>

  <!-- Platform Mismatch Error -->
  <div v-else-if="outputData && platformMismatch" class="platform-mismatch-error">
    <v-alert type="error" variant="outlined" prominent>
      <v-alert-title>Platform Mismatch</v-alert-title>
      <div>
        Cannot execute Android IPC monitoring on {{ actualPlatformName }} device.
        <br>
        <span class="text-grey">This feature requires an <strong>Android</strong> device.</span>
      </div>
    </v-alert>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  outputData: {
    type: [Object, String, null],
    default: null
  },
  platform: {
    type: String,
    required: true,
    validator: (value) => ['ios', 'android'].includes(value)
  },
  category: {
    type: String,
    default: 'IPC'
  },
  feature: {
    type: String,
    default: 'ipcMonitor'
  },
  loading: {
    type: Boolean,
    default: false
  },
  sessionId: {
    type: String,
    default: 'default'
  }
})

const emit = defineEmits(['copy', 'clear', 'refresh', 'export', 'start-monitoring', 'stop-monitoring', 'update-filters', 'show-notification'])

// State
const monitoring = ref(false)
const events = ref([])

// Use a reactive object for local statistics tracking
const localStats = reactive({
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
})

const expandedEvents = ref(new Set())
const activeTab = reactive({})
const showFilters = ref(false)
const showStackTraces = ref(true)
const searchQuery = ref('')
const eventsList = ref(null)
const eventRate = ref(0)

// Filters
const filters = reactive({
  types: ['intent', 'broadcast', 'content_provider', 'binder', 'service'],
  packages: [],
  excludeSystem: true
})

// IPC Types Configuration
const ipcTypes = [
  { value: 'intent', label: 'Intents', icon: 'mdi-send', color: 'blue' },
  { value: 'broadcast', label: 'Broadcasts', icon: 'mdi-broadcast', color: 'green' },
  { value: 'content_provider', label: 'Content Providers', icon: 'mdi-database', color: 'orange' },
  { value: 'binder', label: 'Binder', icon: 'mdi-pipe', color: 'purple' },
  { value: 'service', label: 'Services', icon: 'mdi-cog', color: 'cyan' }
]

// Parse the output data
const parsedData = computed(() => {
  if (!props.outputData) return { events: [], statistics: null, filters: {}, active: false }

  try {
    let data = props.outputData
    if (typeof data === 'string') {
      data = JSON.parse(data)
    }

    // Handle the result wrapper structure
    if (data.success && data.result) {
      if (data.result.data) {
        data = data.result.data
      } else if (data.result.success && data.result.data) {
        data = data.result.data
      }
    } else if (data.success && data.data?.data) {
      data = data.data.data
    } else if (data.success && data.data) {
      data = data.data
    } else if (data.data) {
      data = data.data
    }

    console.log('Parsed IPC data:', data)
    return data
  } catch (error) {
    console.error('Error parsing IPC data:', error)
    return { events: [], statistics: null, filters: {}, active: false }
  }
})

// Computed properties
const platformMismatch = computed(() => {
  return props.platform !== 'android'
})

const actualPlatformName = computed(() => {
  return props.platform === 'ios' ? 'iOS' : props.platform.charAt(0).toUpperCase() + props.platform.slice(1)
})

const statsCards = computed(() => {
  return [
    {
      id: 'total',
      icon: 'mdi-sigma',
      color: 'purple',
      label: 'Total Events',
      value: localStats.totalEvents || 0
    },
    {
      id: 'intents',
      icon: 'mdi-send',
      color: 'blue',
      label: 'Intents',
      value: localStats.byType?.intent || 0
    },
    {
      id: 'broadcasts',
      icon: 'mdi-broadcast',
      color: 'green',
      label: 'Broadcasts',
      value: localStats.byType?.broadcast || 0
    },
    {
      id: 'providers',
      icon: 'mdi-database',
      color: 'orange',
      label: 'Providers',
      value: localStats.byType?.content_provider || 0
    },
    {
      id: 'binder',
      icon: 'mdi-pipe',
      color: 'purple',
      label: 'Binder',
      value: localStats.byType?.binder || 0
    },
    {
      id: 'services',
      icon: 'mdi-cog',
      color: 'cyan',
      label: 'Services',
      value: localStats.byType?.service || 0
    }
  ]
})

const filteredEvents = computed(() => {
  let filtered = events.value

  // Type filter
  if (filters.types.length > 0) {
    filtered = filtered.filter(event => filters.types.includes(event.type))
  }

  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(event => {
      const searchableText = [
        event.action,
        event.uri,
        event.serviceName,
        event.interfaceName,
        event.packageName,
        event.targetPackage,
        JSON.stringify(event.extras)
      ].filter(Boolean).join(' ').toLowerCase()

      return searchableText.includes(query)
    })
  }

  // System package filter
  if (filters.excludeSystem) {
    filtered = filtered.filter(event => {
      const packages = [event.packageName, event.targetPackage].filter(Boolean)
      return !packages.some(pkg =>
        pkg.startsWith('android.') ||
        pkg.startsWith('com.android.') ||
        pkg.startsWith('com.google.android.')
      )
    })
  }

  return filtered.reverse() // Show newest first
})

// Methods
const toggleMonitoring = () => {
  if (monitoring.value) {
    emit('stop-monitoring')
  } else {
    emit('start-monitoring')
  }
}

const toggleFilters = () => {
  showFilters.value = !showFilters.value
}

const toggleTypeFilter = (type) => {
  const index = filters.types.indexOf(type)
  if (index > -1) {
    filters.types.splice(index, 1)
  } else {
    filters.types.push(type)
  }
  emit('update-filters', filters)
}

const toggleEventDetails = (eventId) => {
  if (expandedEvents.value.has(eventId)) {
    expandedEvents.value.delete(eventId)
  } else {
    expandedEvents.value.add(eventId)
    if (!activeTab[eventId]) {
      activeTab[eventId] = 'details'
    }
  }
}

const copyEventData = (event) => {
  const eventData = JSON.stringify(event, null, 2)
  navigator.clipboard.writeText(eventData).then(() => {
    emit('show-notification', {
      message: 'Event data copied to clipboard',
      type: 'success'
    })
  }).catch((err) => {
    console.error('Failed to copy:', err)
    emit('show-notification', {
      message: 'Failed to copy event data',
      type: 'error'
    })
  })
}

const filterByPackage = (packageName) => {
  if (!filters.packages.includes(packageName)) {
    filters.packages.push(packageName)
    emit('update-filters', filters)
    emit('show-notification', {
      message: `Added filter for ${packageName}`,
      type: 'info'
    })
  }
}

const getEventColor = (type) => {
  const typeConfig = ipcTypes.find(t => t.value === type)
  return typeConfig ? typeConfig.color : 'grey'
}

const getEventIcon = (type) => {
  const typeConfig = ipcTypes.find(t => t.value === type)
  return typeConfig ? typeConfig.icon : 'mdi-help-circle'
}

const getEventTitle = (event) => {
  switch (event.type) {
    case 'intent':
    case 'broadcast':
      return event.action || 'Unknown Action'
    case 'content_provider':
      return `${event.operation?.toUpperCase()} ${event.authority || 'Unknown'}`
    case 'binder':
      return `${event.interfaceName || 'Unknown Interface'}.${event.methodName || 'method'}`
    case 'service':
      return `${event.operation?.toUpperCase()} ${event.serviceName || 'Unknown Service'}`
    default:
      return 'Unknown Event'
  }
}

const getEventDetails = (event) => {
  const details = {}

  switch (event.type) {
    case 'intent':
    case 'broadcast':
      if (event.action) details.action = event.action
      if (event.targetPackage) details.targetPackage = event.targetPackage
      if (event.targetComponent) details.component = event.targetComponent
      if (event.data) details.data = event.data
      if (event.scheme) details.scheme = event.scheme
      if (event.mimeType) details.mimeType = event.mimeType
      if (event.flags) details.flags = `0x${event.flags.toString(16)}`
      if (event.categories?.length) details.categories = event.categories.join(', ')
      break

    case 'content_provider':
      if (event.uri) details.uri = event.uri
      if (event.authority) details.authority = event.authority
      if (event.operation) details.operation = event.operation
      if (event.selection) details.selection = event.selection
      if (event.projection?.length) details.projection = event.projection.join(', ')
      break

    case 'binder':
      if (event.interfaceName) details.interface = event.interfaceName
      if (event.methodName) details.method = event.methodName
      if (event.transactionCode !== undefined) details.transactionCode = event.transactionCode
      if (event.flags !== undefined) details.flags = `0x${event.flags.toString(16)}`
      break

    case 'service':
      if (event.serviceName) details.service = event.serviceName
      if (event.operation) details.operation = event.operation
      if (event.flags !== undefined) details.flags = `0x${event.flags.toString(16)}`
      break
  }

  if (event.pid) details.pid = event.pid
  if (event.tid) details.tid = event.tid
  if (event.packageName) details.package = event.packageName

  return details
}

const formatDetailKey = (key) => {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
}

const formatDetailValue = (value) => {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return value.toString()
  return String(value)
}

const formatExtraValue = (value) => {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

const isMonospace = (key) => {
  return ['flags', 'transactionCode', 'pid', 'tid'].includes(key)
}

const formatTime = (timestamp) => {
  try {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    })
  } catch (e) {
    return timestamp
  }
}

const handleClear = () => {
  emit('clear', props.platform, props.category, props.feature)
  expandedEvents.value.clear()
  events.value = []
  // Reset local statistics
  localStats.totalEvents = 0
  localStats.byType = {
    intent: 0,
    broadcast: 0,
    content_provider: 0,
    binder: 0,
    service: 0
  }
  localStats.startTime = null
  localStats.lastEventTime = null
}

const handleExport = () => {
  const exportData = {
    ...parsedData.value,
    events: events.value,
    statistics: localStats
  }
  emit('export', exportData)
}

let eventSource = null
let reconnectAttempts = 0
const maxReconnectAttempts = 5
const reconnectDelay = 2000
let eventRateInterval = null

// Calculate event rate
const calculateEventRate = () => {
  if (eventRateInterval) {
    clearInterval(eventRateInterval)
  }

  let lastCount = events.value.length
  eventRateInterval = setInterval(() => {
    const currentCount = events.value.length
    const rate = currentCount - lastCount
    eventRate.value = Math.max(0, rate)
    lastCount = currentCount
  }, 1000)
}

// Update local statistics when new event arrives
const updateLocalStatistics = (eventData) => {
  // Initialize start time if needed
  if (!localStats.startTime) {
    localStats.startTime = new Date().toISOString()
  }

  // Increment total events
  localStats.totalEvents += 1

  // Increment type-specific counter
  if (eventData.type && localStats.byType.hasOwnProperty(eventData.type)) {
    localStats.byType[eventData.type] += 1
  }

  // Update last event time
  localStats.lastEventTime = eventData.timestamp || new Date().toISOString()

  console.log('Updated local statistics:', localStats)
}

const setupEventSource = () => {
  console.log('IPC EventSource: Setting up connection')

  // Create SSE connection for real-time events
  const eventSourceUrl = `${import.meta.env.VITE_APP_API_URL}/frida/feature-stream/${props.sessionId || 'default'}/android/ipc/ipcMonitor`

  console.log('IPC EventSource: Setting up connection')
  console.log('URL:', eventSourceUrl)
  console.log('Session ID:', props.sessionId)

  // Close existing connection if any
  if (eventSource) {
    console.log('IPC EventSource: Closing existing connection')
    eventSource.close()
    eventSource = null
  }

  try {
    eventSource = new EventSource(eventSourceUrl)
    console.log('IPC EventSource: Connection created successfully')

    eventSource.onopen = (event) => {
      console.log('IPC EventSource: Connection opened successfully')
      reconnectAttempts = 0
    }

    eventSource.onmessage = (event) => {
      try {
        console.log('IPC EventSource: Raw message received:', event.data)

        const data = JSON.parse(event.data)
        console.log('IPC EventSource: Parsed data:', data)

        // Handle IPC events
        if (data.type === 'ipc_event' && data.data) {
          console.log('IPC EventSource: Processing IPC event:', data.data.type, data.data)

          const eventData = data.data

          // Add unique ID if not present
          if (!eventData.id) {
            eventData.id = `ipc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          }

          // Add timestamp if not present
          if (!eventData.timestamp) {
            eventData.timestamp = new Date().toISOString()
          }

          // Add new event to the beginning of the array (newest first)
          events.value.unshift(eventData)
          console.log(`IPC EventSource: Total events now: ${events.value.length}`)

          // Update local statistics
          updateLocalStatistics(eventData)

          // Add animation class to the new event
          nextTick(() => {
            const firstEvent = document.querySelector('.event-item')
            if (firstEvent) {
              firstEvent.classList.add('new-event')
              setTimeout(() => {
                firstEvent.classList.remove('new-event')
              }, 1000)
            }
          })

          // Auto-scroll to top if monitoring
          if (eventsList.value && monitoring.value) {
            nextTick(() => {
              eventsList.value.scrollTop = 0
            })
          }

          // Emit notification for new event
          emit('show-notification', {
            message: `New IPC ${eventData.type}: ${getEventTitle(eventData)}`,
            type: 'info'
          })
        }
        // Handle other message types
        else if (data.type === 'ipc_stats') {
          console.log('IPC EventSource: Received statistics update:', data)
          // You can update statistics from server if needed
        }
        // Handle status messages
        else if (data.type === 'status') {
          console.log('ℹIPC EventSource: Status message:', data.message)
          emit('show-notification', {
            message: data.message,
            type: 'info'
          })
        }
        // Handle error messages
        else if (data.type === 'error') {
          console.error('IPC EventSource: Error message:', data.message)
          emit('show-notification', {
            message: `IPC Error: ${data.message}`,
            type: 'error'
          })
        }
        // Handle unknown message types
        else {
          console.log('IPC EventSource: Unknown message type:', data.type, data)
        }
      } catch (error) {
        console.error('IPC EventSource: Error processing message:', error)
        console.error('Raw event data:', event.data)
      }
    }

    eventSource.onerror = (error) => {
      console.error('IPC EventSource: Connection error:', error)
      console.error('EventSource state:', eventSource?.readyState)
      console.error('URL was:', eventSourceUrl)

      // Handle different ready states
      switch (eventSource?.readyState) {
        case EventSource.CONNECTING:
          console.log('IPC EventSource: Attempting to reconnect...')
          break
        case EventSource.CLOSED:
          console.log('IPC EventSource: Connection closed')
          if (monitoring.value && reconnectAttempts < maxReconnectAttempts) {
            console.log(`IPC EventSource: Attempting reconnection ${reconnectAttempts + 1}/${maxReconnectAttempts}`)
            reconnectAttempts++
            setTimeout(() => {
              if (monitoring.value) {
                setupEventSource()
              }
            }, reconnectDelay * reconnectAttempts)
          } else if (reconnectAttempts >= maxReconnectAttempts) {
            console.error('IPC EventSource: Max reconnection attempts reached')
            emit('show-notification', {
              message: 'IPC monitoring connection lost. Please restart monitoring.',
              type: 'error'
            })
          }
          break
        default:
          console.log('IPC EventSource: Unknown connection state')
      }

      if (eventSource && eventSource.readyState === EventSource.CLOSED) {
        eventSource = null
      }
    }

  } catch (error) {
    console.error('IPC EventSource: Failed to create EventSource:', error)
    emit('show-notification', {
      message: `Failed to start IPC monitoring: ${error.message}`,
      type: 'error'
    })
  }
}

const closeEventSource = () => {
  console.log('IPC EventSource: Closing connection')
  if (eventSource) {
    eventSource.close()
    eventSource = null
    console.log('IPC EventSource: Connection closed')
  }
  reconnectAttempts = 0
}

// Force reconnect function for manual retry
const forceReconnect = () => {
  console.log('IPC EventSource: Force reconnecting...')
  closeEventSource()
  if (monitoring.value) {
    setTimeout(() => {
      setupEventSource()
    }, 1000)
  }
}

// Watchers
watch(() => parsedData.value, (newData) => {
  console.log('IPC Watcher: parsedData changed:', newData)
  if (newData) {
    // Update monitoring state
    monitoring.value = newData.active || false

    // Only update events and statistics if we have new data
    if (newData.events && Array.isArray(newData.events)) {
      events.value = newData.events

      // Recalculate local statistics from events
      localStats.totalEvents = events.value.length
      localStats.byType = {
        intent: 0,
        broadcast: 0,
        content_provider: 0,
        binder: 0,
        service: 0
      }

      events.value.forEach(event => {
        if (event.type && localStats.byType.hasOwnProperty(event.type)) {
          localStats.byType[event.type]++
        }
      })
    }

    if (newData.statistics) {
      // Initialize local stats from server stats if available
      localStats.totalEvents = newData.statistics.totalEvents || localStats.totalEvents
      if (newData.statistics.byType) {
        Object.assign(localStats.byType, newData.statistics.byType)
      }
      if (newData.statistics.startTime) {
        localStats.startTime = newData.statistics.startTime
      }
      if (newData.statistics.lastEventTime) {
        localStats.lastEventTime = newData.statistics.lastEventTime
      }
    }

    if (newData.filters) {
      Object.assign(filters, newData.filters)
    }

    console.log('IPC Watcher: Updated state:', {
      monitoring: monitoring.value,
      eventsCount: events.value.length,
      statistics: localStats
    })
  }
}, { deep: true, immediate: true })

watch(monitoring, (newVal, oldVal) => {
  console.log('IPC Watcher: monitoring changed:', oldVal, '->', newVal)
  if (newVal && !oldVal) {
    console.log('▶IPC Watcher: Starting EventSource')
    setupEventSource()
    calculateEventRate()
  } else if (!newVal && oldVal) {
    console.log('⏹IPC Watcher: Stopping EventSource')
    closeEventSource()
    if (eventRateInterval) {
      clearInterval(eventRateInterval)
      eventRate.value = 0
    }
  }
})

// Keyboard handler
let keyboardHandler = null

// Lifecycle
onMounted(() => {
  console.log('IPC Component: Mounted')
  console.log('Session ID:', props.sessionId)
  console.log('▶Monitoring state:', monitoring.value)

  // Always set up EventSource on mount
  setupEventSource()

  // Setup keyboard shortcuts
  keyboardHandler = (e) => {
    // Check if IPCMonitor is actually visible and active
    const ipcContainer = document.querySelector('.android-ipc-display')
    if (!ipcContainer || !ipcContainer.offsetParent) return

    // Check if FridaClicksContainer is the active dialog
    const fridaContainer = document.querySelector('.frida-clicks-dialog')
    if (!fridaContainer || fridaContainer.style.display === 'none') return

    // Don't handle if user is typing
    if (document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA') return

    switch(e.key.toLowerCase()) {
      case ' ':
        // Only handle spacebar if we have monitoring state
        if (monitoring.value !== undefined) {
          e.preventDefault()
          e.stopPropagation()
          toggleMonitoring()
        }
        break
      case 'c':
        if (e.ctrlKey || e.metaKey) return
        handleClear()
        break
      case 'f':
        if (e.ctrlKey || e.metaKey) return
        toggleFilters()
        break
    }
  }

  window.addEventListener('keydown', keyboardHandler)
})

onUnmounted(() => {
  console.log('IPC Component: Unmounting, closing EventSource')
  closeEventSource()
  if (eventRateInterval) {
    clearInterval(eventRateInterval)
  }
  if (keyboardHandler) {
    window.removeEventListener('keydown', keyboardHandler)
  }
})

// Expose forceReconnect for debugging
if (import.meta.env.DEV) {
  window.debugIPCReconnect = forceReconnect
}
</script>

<style scoped>
.android-ipc-display {
  animation: fadeIn 0.3s ease-out;
  margin-top: 16px;
}

/* Platform Mismatch Error */
.platform-mismatch-error {
  margin-top: 16px;
  animation: fadeIn 0.3s ease-out;
}

.platform-mismatch-error strong {
  color: #ffffff;
  font-weight: 600;
}

/* Header Styles */
.ipc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: linear-gradient(135deg, #1a1d21 0%, #13151a 100%);
  border-radius: 12px 12px 0 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-icon-wrapper {
  width: 44px;
  height: 44px;
  background: rgba(156, 39, 176, 0.1);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(156, 39, 176, 0.2);
  position: relative;
}

.pulse-ring {
  position: absolute;
  inset: -4px;
  border: 2px solid rgba(156, 39, 176, 0.4);
  border-radius: 16px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(0.95);
    opacity: 1;
  }
  70% {
    transform: scale(1.15);
    opacity: 0;
  }
  100% {
    transform: scale(1.15);
    opacity: 0;
  }
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
}

.header-subtitle {
  font-size: 12px;
  color: #9aa0a6;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-btn {
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.05);
}

/* Event Rate */
.event-rate {
  margin-left: 4px;
  font-size: 10px;
  font-weight: 600;
  color: #4ade80;
}

/* Statistics Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  padding: 16px 20px;
  background: linear-gradient(180deg, #0f1013 0%, #0a0b0e 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

/* Stat Card Styles */
.stat-card {
  position: relative;
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 16px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  animation: cardSlideIn 0.4s ease-out;
  animation-fill-mode: both;
}

@keyframes cardSlideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.stat-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.12);
  transform: translateY(-2px);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.1);
}

.card-glow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg,
    transparent,
    rgba(156, 39, 176, 0.2),
    transparent
  );
  opacity: 0;
  transition: opacity 0.3s ease;
}

.stat-card:hover .card-glow {
  opacity: 1;
}

.card-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-icon-wrapper {
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #ffffff;
  font-family: 'Inter', 'SF Pro Display', sans-serif;
}

/* Stat value transition animation */
.stat-change-enter-active,
.stat-change-leave-active {
  transition: all 0.3s ease;
}

.stat-change-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.stat-change-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.stat-label {
  font-size: 11px;
  color: #9aa0a6;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

/* Filters Panel */
.filters-panel {
  padding: 20px;
  background: linear-gradient(180deg, #13151a 0%, #0f1013 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.filter-section {
  margin-bottom: 20px;
}

.filter-section:last-child {
  margin-bottom: 0;
}

.filter-title {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 12px;
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-chip {
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-chip:hover {
  transform: scale(1.05);
}

/* Events Container */
.events-container {
  background: linear-gradient(180deg, #0a0b0e 0%, #0f1013 100%);
  border-radius: 0 0 12px 12px;
  position: relative;
}

.events-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(10, 11, 14, 0.95);
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(10px);
}

.events-title {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
  display: flex;
  align-items: center;
}

.events-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-field {
  max-width: 250px;
}

/* Events List */
.events-list {
  max-height: 600px;
  overflow-y: auto;
  padding: 20px;
}

/* Event Items */
.event-item {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  margin-bottom: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.event-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.12);
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

/* Event type specific styling */
.event-intent {
  border-left: 3px solid #2196f3;
}

.event-broadcast {
  border-left: 3px solid #4caf50;
}

.event-content_provider {
  border-left: 3px solid #ff9800;
}

.event-binder {
  border-left: 3px solid #9c27b0;
}

.event-service {
  border-left: 3px solid #00bcd4;
}

/* Event Header */
.event-header {
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  cursor: pointer;
  transition: background 0.2s ease;
}

.event-header:hover {
  background: rgba(255, 255, 255, 0.02);
}

.event-main {
  display: flex;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.event-icon-wrapper {
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.event-info {
  flex: 1;
  min-width: 0;
}

.event-title {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 4px;
  word-break: break-word;
}

.event-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.event-type {
  font-size: 10px;
  font-weight: 600;
  color: #9aa0a6;
  letter-spacing: 0.5px;
}

.event-time {
  font-size: 11px;
  color: #888;
  font-family: 'SF Mono', monospace;
}

.event-package {
  font-size: 11px;
  color: #888;
  font-family: 'SF Mono', monospace;
}

.event-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.quick-action-btn {
  opacity: 0;
  transition: all 0.2s ease;
}

.event-header:hover .quick-action-btn {
  opacity: 0.7;
}

.quick-action-btn:hover {
  opacity: 1 !important;
  background: rgba(255, 255, 255, 0.1);
}

.call-chain-indicator {
  font-weight: 600 !important;
}

.expand-arrow {
  transition: transform 0.3s ease;
  color: #888;
}

.expand-arrow.rotated {
  transform: rotate(180deg);
  color: #9c27b0;
}

/* Event Details */
.event-details {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.2);
}

/* Call Chain Section */
.call-chain-section {
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.detail-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #9c27b0;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
}

.call-chain {
  position: relative;
  padding-left: 20px;
}

.call-chain-item {
  position: relative;
  margin-bottom: 12px;
}

.chain-connector {
  position: absolute;
  left: -20px;
  top: -12px;
  width: 1px;
  height: calc(100% + 12px);
  background: linear-gradient(180deg, rgba(156, 39, 176, 0.3) 0%, rgba(156, 39, 176, 0.1) 100%);
}

.chain-node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(156, 39, 176, 0.1);
  border: 1px solid rgba(156, 39, 176, 0.2);
  border-radius: 6px;
  font-size: 12px;
  font-family: 'SF Mono', monospace;
  color: #e6e6e6;
}

/* Detail Tabs */
.detail-tabs {
  padding: 16px;
}

.detail-tabs .v-tabs {
  margin-bottom: 16px;
}

/* Detail Content */
.detail-content {
  padding: 16px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
}

.detail-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  align-items: start;
}

.detail-item {
  display: contents;
}

.detail-key {
  font-size: 12px;
  color: #9aa0a6;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding-right: 16px;
}

.detail-value {
  font-size: 13px;
  color: #ffffff;
  word-break: break-word;
}

.detail-value.monospace {
  font-family: 'SF Mono', monospace;
}

/* Extras List */
.extras-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.extra-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.extra-key {
  font-size: 12px;
  color: #2196f3;
  font-weight: 600;
  font-family: 'SF Mono', monospace;
}

.extra-value {
  font-size: 12px;
  color: #e6e6e6;
  font-family: 'SF Mono', monospace;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Stack Trace */
.stack-trace {
  font-family: 'SF Mono', monospace;
  font-size: 11px;
}

.stack-frame {
  display: flex;
  gap: 12px;
  padding: 8px;
  margin-bottom: 4px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
  transition: all 0.2s ease;
}

.stack-frame:hover {
  background: rgba(255, 255, 255, 0.05);
}

.stack-frame.important {
  background: rgba(156, 39, 176, 0.1);
  border: 1px solid rgba(156, 39, 176, 0.2);
}

.frame-number {
  color: #666;
  min-width: 24px;
  text-align: right;
}

.frame-text {
  color: #e6e6e6;
  word-break: break-word;
}

/* Empty State */
.empty-state {
  padding: 80px 20px;
  text-align: center;
  color: #888;
}

.empty-state h4 {
  margin: 16px 0 8px;
  color: #aaa;
  font-weight: 600;
}

.empty-state p {
  margin-bottom: 16px;
  font-size: 14px;
  line-height: 1.6;
}

/* Footer */
.ipc-footer {
  padding: 16px 20px;
  background: linear-gradient(135deg, #13151a 0%, #1a1d21 100%);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  justify-content: center;
}

.footer-stats {
  display: flex;
  gap: 24px;
  font-size: 12px;
  color: #888;
}

.footer-stat {
  display: flex;
  align-items: center;
}

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes newEventPulse {
  0% {
    box-shadow: 0 0 0 0 rgba(156, 39, 176, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(156, 39, 176, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(156, 39, 176, 0);
  }
}

.event-item.new-event {
  animation: newEventPulse 1s ease-out;
  border-color: rgba(156, 39, 176, 0.5);
}

.event-slide-enter-active {
  transition: all 0.3s ease-out;
}

.event-slide-leave-active {
  transition: all 0.3s ease-in;
}

.event-slide-enter-from {
  transform: translateY(-20px);
  opacity: 0;
}

.event-slide-leave-to {
  transform: translateY(20px);
  opacity: 0;
}

/* Scrollbar Styling */
.events-list::-webkit-scrollbar {
  width: 6px;
}

.events-list::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.events-list::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(156, 39, 176, 0.4) 0%, rgba(156, 39, 176, 0.2) 100%);
  border-radius: 3px;
}

.events-list::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(156, 39, 176, 0.6) 0%, rgba(156, 39, 176, 0.4) 100%);
}

/* Responsive Design */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .events-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }

  .events-controls {
    flex-direction: column;
    gap: 8px;
  }

  .search-field {
    max-width: 100%;
  }

  .event-meta {
    font-size: 10px;
  }

  .detail-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .detail-key {
    padding-right: 0;
    margin-bottom: 4px;
  }
}
</style>
