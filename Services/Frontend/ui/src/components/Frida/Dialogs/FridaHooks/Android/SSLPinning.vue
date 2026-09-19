<template>
  <div v-if="outputData && !platformMismatch" class="ssl-pinning-display">
    <!-- Modern Header -->
    <div class="ssl-header">
      <div class="header-left">
        <div class="header-icon-wrapper">
          <v-icon size="24" color="purple">mdi-shield-lock</v-icon>
          <div v-if="monitoring" class="pulse-ring"></div>
        </div>
        <div class="header-text">
          <h3 class="header-title">SSL Pinning Monitor</h3>
          <p class="header-subtitle">
            {{ discoveredHooks.available || 0 }} of {{ discoveredHooks.total || 0 }} hooks available
            <span v-if="activeHooksCount > 0" class="active-hooks">
              • {{ activeHooksCount }} active
            </span>
          </p>
        </div>
      </div>
      <div class="header-actions">
        <v-chip size="small" :color="monitoring ? 'success' : 'grey'" class="mr-2">
          <v-icon size="small" class="mr-1">{{ monitoring ? 'mdi-record' : 'mdi-record-circle-outline' }}</v-icon>
          {{ monitoring ? 'MONITORING' : 'STOPPED' }}
          <span v-if="monitoring && eventRate > 0" class="event-rate">
            ({{ eventRate }}/s)
          </span>
        </v-chip>
        <v-btn
          icon
          size="small"
          variant="text"
          @click="toggleHookPanel"
          class="action-btn"
        >
          <v-icon size="18">mdi-toggle-switch</v-icon>
          <v-tooltip activator="parent" location="bottom">
            <div>Hook Controls</div>
            <div class="text-caption">Press H</div>
          </v-tooltip>
        </v-btn>
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
          @click="handleClearEvents"
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
            <span class="stat-value">{{ stat.value }}</span>
            <span class="stat-label">{{ stat.label }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="quick-actions">
      <v-btn
        :color="bypassModeGlobal ? 'success' : 'grey'"
        @click="toggleGlobalBypass"
        variant="flat"
        size="small"
        class="mr-2"
      >
        <v-icon class="mr-1">{{ bypassModeGlobal ? 'mdi-shield-off' : 'mdi-shield' }}</v-icon>
        {{ bypassModeGlobal ? 'Bypass Active' : 'Monitor Only' }}
      </v-btn>
      <v-btn
        color="purple"
        @click="enableAllHooks"
        variant="outlined"
        size="small"
        class="mr-2"
        :disabled="loading"
      >
        <v-icon class="mr-1">mdi-toggle-switch-off</v-icon>
        Enable All
      </v-btn>
      <v-btn
        color="grey"
        @click="disableAllHooks"
        variant="outlined"
        size="small"
        :disabled="loading"
      >
        <v-icon class="mr-1">mdi-toggle-switch</v-icon>
        Disable All
      </v-btn>
      <v-btn
        color="primary"
        @click="discoverHooks"
        variant="text"
        size="small"
        class="ml-2"
        :loading="discovering"
      >
        <v-icon class="mr-1">mdi-refresh</v-icon>
        Rediscover
      </v-btn>
    </div>

    <!-- Hook Controls Panel -->
    <v-expand-transition>
      <div v-if="showHookPanel" class="hook-controls-panel">
        <div class="panel-header">
          <h4 class="panel-title">
            <v-icon size="small" class="mr-2">mdi-toggle-switch</v-icon>
            SSL Hook Controls
          </h4>
          <v-text-field
            v-model="hookSearchQuery"
            density="compact"
            hide-details
            single-line
            placeholder="Search hooks..."
            prepend-inner-icon="mdi-magnify"
            class="hook-search-field"
            clearable
          ></v-text-field>
        </div>

        <!-- Category Tabs -->
        <v-tabs
          v-model="selectedCategory"
          density="compact"
          color="purple"
          class="category-tabs"
        >
          <v-tab value="all">
            All
            <v-chip size="x-small" class="ml-2">{{ hooks.length }}</v-chip>
          </v-tab>
          <v-tab
            v-for="cat in categories"
            :key="cat.category"
            :value="cat.category"
          >
            {{ formatCategoryName(cat.category) }}
            <v-chip size="x-small" class="ml-2">{{ cat.count }}</v-chip>
          </v-tab>
        </v-tabs>

        <!-- Hooks List -->
        <div class="hooks-container">
          <div class="hooks-list">
            <div
              v-for="hook in filteredHooks"
              :key="hook.id"
              :class="['hook-item', { 'hook-enabled': hook.enabled, 'hook-unavailable': !hook.available }]"
            >
              <div class="hook-main">
                <v-switch
                  :model-value="hook.enabled"
                  @update:model-value="toggleHook(hook.id)"
                  :disabled="!hook.available || loading"
                  color="purple"
                  density="compact"
                  hide-details
                  class="hook-switch"
                ></v-switch>
                <div class="hook-info">
                  <div class="hook-name">
                    {{ hook.name }}
                    <v-chip
                      v-if="hook.bypassActive"
                      size="x-small"
                      color="success"
                      class="ml-2"
                    >
                      BYPASS
                    </v-chip>
                  </div>
                  <div class="hook-details">
                    <span class="hook-category">{{ formatCategoryName(hook.category) }}</span>
                    <span v-if="hook.hitCount > 0" class="hook-hits">
                      <v-icon size="x-small" class="mr-1">mdi-target</v-icon>
                      {{ hook.hitCount }} hits
                    </span>
                    <span v-if="!hook.available" class="hook-unavailable-badge">
                      <v-icon size="x-small" class="mr-1">mdi-alert-circle</v-icon>
                      Not Available
                    </span>
                  </div>
                </div>
              </div>
              <div class="hook-actions">
                <v-btn
                  v-if="hook.enabled"
                  icon
                  size="x-small"
                  variant="text"
                  @click="toggleBypassMode(hook.id)"
                  :color="hook.bypassActive ? 'success' : 'grey'"
                  class="bypass-btn"
                >
                  <v-icon size="14">{{ hook.bypassActive ? 'mdi-shield-off' : 'mdi-shield' }}</v-icon>
                  <v-tooltip activator="parent" location="top">
                    {{ hook.bypassActive ? 'Bypass Mode Active' : 'Monitor Mode' }}
                  </v-tooltip>
                </v-btn>
              </div>
            </div>
          </div>
        </div>
      </div>
    </v-expand-transition>

    <!-- Filters Panel -->
    <v-expand-transition>
      <div v-if="showFilters" class="filters-panel">
        <div class="filter-section">
          <h4 class="filter-title">Event Types</h4>
          <div class="filter-chips">
            <v-chip
              v-for="type in eventTypes"
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
            v-model="filters.showBypassedOnly"
            label="Show Bypassed Events Only"
            density="compact"
            hide-details
            color="purple"
          ></v-switch>
          <v-switch
            v-model="filters.showStackTraces"
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
          SSL Events Timeline
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
                  <v-icon size="16" :color="getEventColor(event)">
                    {{ getEventIcon(event) }}
                  </v-icon>
                </div>
                <div class="event-info">
                  <div class="event-title">
                    {{ event.function }}
                    <v-chip
                      v-if="event.action === 'bypassed'"
                      size="x-small"
                      color="success"
                      class="ml-2"
                    >
                      BYPASSED
                    </v-chip>
                  </div>
                  <div class="event-meta">
                    <span class="event-hook">{{ event.hookName }}</span>
                    <span class="event-time">{{ formatTime(event.timestamp) }}</span>
                    <span v-if="event.certificateInfo?.hostname" class="event-hostname">
                      <v-icon size="x-small" class="mr-1">mdi-web</v-icon>
                      {{ event.certificateInfo.hostname }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="event-actions">
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
                <!-- Event Details Tabs -->
                <div class="detail-tabs">
                  <v-tabs
                    v-model="activeTab[event.id]"
                    density="compact"
                    color="purple"
                  >
                    <v-tab value="details">Details</v-tab>
                    <v-tab value="certificate" v-if="event.certificateInfo">
                      Certificate
                    </v-tab>
                    <v-tab value="stack" v-if="filters.showStackTraces && event.stackTrace">
                      Stack Trace
                    </v-tab>
                  </v-tabs>

                  <v-window v-model="activeTab[event.id]">
                    <!-- Details Tab -->
                    <v-window-item value="details">
                      <div class="detail-content">
                        <div class="detail-grid">
                          <div class="detail-item">
                            <span class="detail-key">Hook ID</span>
                            <span class="detail-value monospace">{{ event.hookId }}</span>
                          </div>
                          <div class="detail-item">
                            <span class="detail-key">Library</span>
                            <span class="detail-value">{{ event.library }}</span>
                          </div>
                          <div class="detail-item">
                            <span class="detail-key">Type</span>
                            <span class="detail-value">{{ event.type }}</span>
                          </div>
                          <div class="detail-item">
                            <span class="detail-key">Action</span>
                            <span class="detail-value">{{ event.action }}</span>
                          </div>
                          <div v-if="event.parameters?.duration" class="detail-item">
                            <span class="detail-key">Duration</span>
                            <span class="detail-value">{{ event.parameters.duration }}ms</span>
                          </div>
                          <div v-if="event.error" class="detail-item">
                            <span class="detail-key">Error</span>
                            <span class="detail-value error-text">{{ event.error }}</span>
                          </div>
                        </div>
                      </div>
                    </v-window-item>

                    <!-- Certificate Tab -->
                    <v-window-item value="certificate" v-if="event.certificateInfo">
                      <div class="detail-content">
                        <div class="cert-info">
                          <div v-if="event.certificateInfo.subject" class="cert-item">
                            <span class="cert-key">Subject</span>
                            <span class="cert-value">{{ event.certificateInfo.subject }}</span>
                          </div>
                          <div v-if="event.certificateInfo.issuer" class="cert-item">
                            <span class="cert-key">Issuer</span>
                            <span class="cert-value">{{ event.certificateInfo.issuer }}</span>
                          </div>
                          <div v-if="event.certificateInfo.serialNumber" class="cert-item">
                            <span class="cert-key">Serial Number</span>
                            <span class="cert-value monospace">{{ event.certificateInfo.serialNumber }}</span>
                          </div>
                          <div v-if="event.certificateInfo.chain && event.certificateInfo.chain.length > 0" class="cert-chain">
                            <span class="cert-key">Certificate Chain</span>
                            <div class="chain-list">
                              <div
                                v-for="(cert, idx) in event.certificateInfo.chain"
                                :key="idx"
                                class="chain-item"
                              >
                                <v-icon size="x-small" color="purple">mdi-certificate</v-icon>
                                <span class="chain-text">{{ cert }}</span>
                              </div>
                            </div>
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
                            class="stack-frame"
                          >
                            <span class="frame-number">{{ idx }}</span>
                            <span class="frame-text">{{ frame }}</span>
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
          <v-icon size="64" color="grey">mdi-shield-lock-outline</v-icon>
          <h4>{{ monitoring ? 'No SSL Events Captured Yet' : 'Start Monitoring to Capture SSL Events' }}</h4>
          <p>{{ monitoring ? 'SSL events will appear here as they occur.' : 'Enable hooks and click Start to begin monitoring SSL/TLS communications.' }}</p>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="ssl-footer" v-if="statistics.totalEvents > 0">
      <div class="footer-stats">
        <span class="footer-stat">
          <v-icon size="small" class="mr-1">mdi-clock-outline</v-icon>
          Started: {{ formatTime(statistics.startTime) }}
        </span>
        <span v-if="statistics.lastEventTime" class="footer-stat">
          <v-icon size="small" class="mr-1">mdi-update</v-icon>
          Last Event: {{ formatTime(statistics.lastEventTime) }}
        </span>
        <span class="footer-stat">
          <v-icon size="small" class="mr-1">mdi-sigma</v-icon>
          Total Events: {{ statistics.totalEvents }}
        </span>
      </div>
    </div>
  </div>

  <!-- Platform Mismatch Error -->
  <div v-else-if="outputData && platformMismatch" class="platform-mismatch-error">
    <v-alert type="error" variant="outlined" prominent>
      <v-alert-title>Platform Mismatch</v-alert-title>
      <div>
        Cannot execute SSL Pinning monitoring on {{ actualPlatformName }} device.
        <br>
        <span class="text-grey">This feature requires an <strong>Android</strong> device.</span>
      </div>
    </v-alert>
  </div>
</template>

<script setup>
import EventSource from '@/utils/authenticatedEventSource'
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
    default: 'Network-Security'
  },
  feature: {
    type: String,
    default: 'sslPinning'
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

const emit = defineEmits(['execute', 'copy', 'export', 'show-notification'])

// State
const monitoring = ref(false)
const discovering = ref(false)
const hooks = ref([])
const events = ref([])
const statistics = ref({
  totalEvents: 0,
  totalHits: 0,
  startTime: null,
  lastEventTime: null
})
const expandedEvents = ref(new Set())
const activeTab = reactive({})
const showHookPanel = ref(true)
const showFilters = ref(false)
const searchQuery = ref('')
const hookSearchQuery = ref('')
const eventsList = ref(null)
const eventRate = ref(0)
const selectedCategory = ref('all')
const bypassModeGlobal = ref(false)

// Discovery state
const discoveredHooks = ref({
  available: 0,
  total: 0
})

// Filters
const filters = reactive({
  types: ['monitor', 'bypass', 'error'],
  showBypassedOnly: false,
  showStackTraces: false
})

// Event Types Configuration
const eventTypes = [
  { value: 'monitor', label: 'Monitor', icon: 'mdi-eye', color: 'blue' },
  { value: 'bypass', label: 'Bypass', icon: 'mdi-shield-off', color: 'success' },
  { value: 'error', label: 'Error', icon: 'mdi-alert-circle', color: 'error' }
]

// Parse the output data
const parsedData = computed(() => {
  if (!props.outputData) return null

  try {
    let data = props.outputData
    if (typeof data === 'string') {
      data = JSON.parse(data)
    }

    // Handle the result wrapper structure
    if (data.success && data.result) {
      data = data.result
    } else if (data.data) {
      data = data.data
    }

    console.log('Parsed SSL data:', data)
    return data
  } catch (error) {
    console.error('Error parsing SSL data:', error)
    return null
  }
})

// Computed properties
const platformMismatch = computed(() => {
  return props.platform !== 'android'
})

const actualPlatformName = computed(() => {
  return props.platform === 'ios' ? 'iOS' : props.platform.charAt(0).toUpperCase() + props.platform.slice(1)
})

const categories = computed(() => {
  const catMap = new Map()
  hooks.value.forEach(hook => {
    const cat = catMap.get(hook.category) || { category: hook.category, count: 0, available: 0, enabled: 0 }
    cat.count++
    if (hook.available) cat.available++
    if (hook.enabled) cat.enabled++
    catMap.set(hook.category, cat)
  })
  return Array.from(catMap.values())
})

const activeHooksCount = computed(() => {
  return hooks.value.filter(h => h.enabled).length
})

const statsCards = computed(() => {
  const totalHooks = hooks.value.length
  const availableHooks = hooks.value.filter(h => h.available).length
  const enabledHooks = hooks.value.filter(h => h.enabled).length
  const bypassedHooks = hooks.value.filter(h => h.bypassActive).length
  const totalHits = hooks.value.reduce((sum, h) => sum + (h.hitCount || 0), 0)

  return [
    {
      id: 'available',
      icon: 'mdi-check-circle',
      color: 'green',
      label: 'Available',
      value: `${availableHooks}/${totalHooks}`
    },
    {
      id: 'active',
      icon: 'mdi-toggle-switch',
      color: 'purple',
      label: 'Active Hooks',
      value: enabledHooks
    },
    {
      id: 'bypass',
      icon: 'mdi-shield-off',
      color: 'orange',
      label: 'Bypassing',
      value: bypassedHooks
    },
    {
      id: 'hits',
      icon: 'mdi-target',
      color: 'blue',
      label: 'Total Hits',
      value: totalHits
    },
    {
      id: 'events',
      icon: 'mdi-timeline',
      color: 'cyan',
      label: 'Events',
      value: statistics.value.totalEvents || 0
    }
  ]
})

const filteredHooks = computed(() => {
  let filtered = hooks.value

  // Category filter
  if (selectedCategory.value !== 'all') {
    filtered = filtered.filter(hook => hook.category === selectedCategory.value)
  }

  // Search filter
  if (hookSearchQuery.value) {
    const query = hookSearchQuery.value.toLowerCase()
    filtered = filtered.filter(hook => {
      return hook.name.toLowerCase().includes(query) ||
             hook.id.toLowerCase().includes(query) ||
             hook.category.toLowerCase().includes(query)
    })
  }

  // Sort by: enabled first, then available, then alphabetical
  return filtered.sort((a, b) => {
    if (a.enabled !== b.enabled) return b.enabled ? 1 : -1
    if (a.available !== b.available) return b.available ? 1 : -1
    return a.name.localeCompare(b.name)
  })
})

const filteredEvents = computed(() => {
  let filtered = events.value

  // Type filter
  if (filters.types.length > 0) {
    filtered = filtered.filter(event => filters.types.includes(event.type))
  }

  // Bypassed only filter
  if (filters.showBypassedOnly) {
    filtered = filtered.filter(event => event.action === 'bypassed')
  }

  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(event => {
      const searchableText = [
        event.function,
        event.hookName,
        event.library,
        event.certificateInfo?.hostname,
        event.certificateInfo?.subject,
        event.error
      ].filter(Boolean).join(' ').toLowerCase()

      return searchableText.includes(query)
    })
  }

  return filtered.reverse() // Show newest first
})

// Methods
const discoverHooks = async () => {
  discovering.value = true
  try {
    const result = await emit('execute', 'discoverSSLHooks')
    if (result?.success) {
      discoveredHooks.value = {
        available: result.available,
        total: result.total
      }

      // Get updated hook status
      await getHookStatus()

      emit('show-notification', {
        message: `Discovered ${result.available} available SSL hooks out of ${result.total}`,
        type: 'success'
      })
    }
  } catch (error) {
    console.error('Failed to discover hooks:', error)
    emit('show-notification', {
      message: 'Failed to discover SSL hooks',
      type: 'error'
    })
  } finally {
    discovering.value = false
  }
}

const getHookStatus = async () => {
  try {
    const result = await emit('execute', 'getSSLHookStatus')
    if (result?.success && result.hooks) {
      hooks.value = result.hooks
      statistics.value.totalHits = result.stats?.totalHits || 0
    }
  } catch (error) {
    console.error('Failed to get hook status:', error)
  }
}

const toggleMonitoring = () => {
  monitoring.value = !monitoring.value
  if (monitoring.value) {
    statistics.value.startTime = new Date().toISOString()
    emit('show-notification', {
      message: 'SSL monitoring started',
      type: 'info'
    })
  } else {
    emit('show-notification', {
      message: 'SSL monitoring stopped',
      type: 'info'
    })
  }
}

const toggleHookPanel = () => {
  showHookPanel.value = !showHookPanel.value
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
}

const toggleHook = async (hookId) => {
  try {
    const result = await emit('execute', 'toggleSSLHook', hookId, bypassModeGlobal.value)
    if (result?.success) {
      await getHookStatus()
      emit('show-notification', {
        message: result.message,
        type: 'success'
      })
    }
  } catch (error) {
    console.error('Failed to toggle hook:', error)
    emit('show-notification', {
      message: `Failed to toggle hook ${hookId}`,
      type: 'error'
    })
  }
}

const toggleBypassMode = async (hookId) => {
  const hook = hooks.value.find(h => h.id === hookId)
  if (!hook) return

  try {
    const newBypassMode = !hook.bypassActive
    const result = await emit('execute', 'setSSLBypassMode', hookId, newBypassMode)
    if (result?.success) {
      await getHookStatus()
      emit('show-notification', {
        message: result.message,
        type: 'success'
      })
    }
  } catch (error) {
    console.error('Failed to toggle bypass mode:', error)
    emit('show-notification', {
      message: `Failed to toggle bypass mode for ${hookId}`,
      type: 'error'
    })
  }
}

const toggleGlobalBypass = () => {
  bypassModeGlobal.value = !bypassModeGlobal.value
  emit('show-notification', {
    message: `Global bypass mode ${bypassModeGlobal.value ? 'enabled' : 'disabled'}`,
    type: 'info'
  })
}

const enableAllHooks = async () => {
  try {
    const result = await emit('execute', 'enableAllSSLHooks', bypassModeGlobal.value)
    if (result?.success) {
      await getHookStatus()
      emit('show-notification', {
        message: result.message,
        type: 'success'
      })
    }
  } catch (error) {
    console.error('Failed to enable all hooks:', error)
    emit('show-notification', {
      message: 'Failed to enable all hooks',
      type: 'error'
    })
  }
}

const disableAllHooks = async () => {
  try {
    const result = await emit('execute', 'disableAllSSLHooks')
    if (result?.success) {
      await getHookStatus()
      emit('show-notification', {
        message: result.message,
        type: 'success'
      })
    }
  } catch (error) {
    console.error('Failed to disable all hooks:', error)
    emit('show-notification', {
      message: 'Failed to disable all hooks',
      type: 'error'
    })
  }
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

const getEventColor = (event) => {
  if (event.type === 'error') return 'error'
  if (event.action === 'bypassed') return 'success'
  if (event.type === 'bypass') return 'orange'
  return 'blue'
}

const getEventIcon = (event) => {
  if (event.type === 'error') return 'mdi-alert-circle'
  if (event.action === 'bypassed') return 'mdi-shield-off'
  if (event.type === 'bypass') return 'mdi-shield-remove'
  return 'mdi-eye'
}

const formatCategoryName = (category) => {
  const names = {
    native: 'Native',
    java: 'Java',
    conscrypt: 'Conscrypt',
    okhttp: 'OkHttp',
    apache: 'Apache',
    webview: 'WebView',
    flutter: 'Flutter',
    custom: 'Custom'
  }
  return names[category] || category.charAt(0).toUpperCase() + category.slice(1)
}

const formatTime = (timestamp) => {
  try {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch (e) {
    return timestamp
  }
}

const handleClearEvents = async () => {
  try {
    const result = await emit('execute', 'clearSSLEvents')
    if (result?.success) {
      events.value = []
      statistics.value.totalEvents = 0
      expandedEvents.value.clear()
      emit('show-notification', {
        message: result.message,
        type: 'success'
      })
    }
  } catch (error) {
    console.error('Failed to clear events:', error)
    emit('show-notification', {
      message: 'Failed to clear events',
      type: 'error'
    })
  }
}

const handleExport = () => {
  const exportData = {
    hooks: hooks.value,
    events: events.value,
    statistics: statistics.value,
    timestamp: new Date().toISOString()
  }
  emit('export', exportData)
}

let eventSource = null
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

const setupEventSource = () => {
  console.log('SSL EventSource: Setting up connection')

  const eventSourceUrl = `${import.meta.env.VITE_APP_API_URL}/frida/feature-stream/${props.sessionId || 'default'}/android/Network-Security/sslPinning`

  console.log('SSL EventSource URL:', eventSourceUrl)

  if (eventSource) {
    eventSource.close()
    eventSource = null
  }

  try {
    eventSource = new EventSource(eventSourceUrl)

    eventSource.onopen = () => {
      console.log('SSL EventSource: Connection opened')
    }

    eventSource.onmessage = (event) => {
      try {
        console.log('SSL EventSource: Raw message:', event.data)
        const data = JSON.parse(event.data)

        // Handle SSL events
        if (data.type === 'ssl_event' && data.event) {
          const sslEvent = data.event

          // Add to events
          events.value.unshift(sslEvent)
          statistics.value.totalEvents++
          statistics.value.lastEventTime = sslEvent.timestamp

          // Update hit count for the hook
          const hook = hooks.value.find(h => h.id === sslEvent.hookId)
          if (hook) {
            hook.hitCount = data.hitCount || (hook.hitCount + 1)
          }

          // Auto-scroll to top
          if (eventsList.value && monitoring.value) {
            nextTick(() => {
              eventsList.value.scrollTop = 0
            })
          }

          // Show notification for bypassed events
          if (sslEvent.action === 'bypassed') {
            emit('show-notification', {
              message: `SSL pinning bypassed: ${sslEvent.hookName}`,
              type: 'success'
            })
          }
        }
        // Handle hook enabled/disabled events
        else if (data.type === 'ssl_hook_enabled' || data.type === 'ssl_hook_disabled') {
          // Refresh hook status
          getHookStatus()
        }
        // Handle discovery complete
        else if (data.type === 'ssl_discovery_complete') {
          discoveredHooks.value = {
            available: data.availableHooks,
            total: data.totalHooks
          }
        }
      } catch (error) {
        console.error('SSL EventSource: Error processing message:', error)
      }
    }

    eventSource.onerror = (error) => {
      console.error('SSL EventSource: Connection error:', error)

      if (eventSource?.readyState === EventSource.CLOSED) {
        eventSource = null
        // Attempt reconnection after delay
        setTimeout(() => {
          if (monitoring.value) {
            setupEventSource()
          }
        }, 5000)
      }
    }

  } catch (error) {
    console.error('SSL EventSource: Failed to create:', error)
  }
}

const closeEventSource = () => {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
}

// Keyboard handler
let keyboardHandler = null

// Lifecycle
onMounted(async () => {
  console.log('SSL Component: Mounted')

  // Set up EventSource
  setupEventSource()

  // Initial discovery
  await discoverHooks()

  // Setup keyboard shortcuts
  keyboardHandler = (e) => {
    if (document.activeElement?.tagName === 'INPUT') return

    switch(e.key.toLowerCase()) {
      case ' ':
        e.preventDefault()
        toggleMonitoring()
        break
      case 'c':
        if (e.ctrlKey || e.metaKey) return
        handleClearEvents()
        break
      case 'f':
        if (e.ctrlKey || e.metaKey) return
        toggleFilters()
        break
      case 'h':
        toggleHookPanel()
        break
    }
  }

  window.addEventListener('keydown', keyboardHandler)
})

onUnmounted(() => {
  console.log('SSL Component: Unmounting')
  closeEventSource()
  if (eventRateInterval) {
    clearInterval(eventRateInterval)
  }
  if (keyboardHandler) {
    window.removeEventListener('keydown', keyboardHandler)
  }
})

// Watch monitoring state
watch(monitoring, (newVal) => {
  if (newVal) {
    calculateEventRate()
  } else {
    if (eventRateInterval) {
      clearInterval(eventRateInterval)
      eventRate.value = 0
    }
  }
})

// Watch parsed data for updates
watch(() => parsedData.value, (newData) => {
  if (newData) {
    // Update state from parsed data
    if (newData.hooks) {
      hooks.value = newData.hooks
    }
    if (newData.events) {
      events.value = newData.events
    }
    if (newData.stats) {
      Object.assign(statistics.value, newData.stats)
    }
  }
}, { deep: true, immediate: true })
</script>

<style scoped>
.ssl-pinning-display {
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
.ssl-header {
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

.active-hooks {
  color: #4ade80;
  font-weight: 600;
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

.stat-label {
  font-size: 11px;
  color: #9aa0a6;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

/* Quick Actions */
.quick-actions {
  padding: 16px 20px;
  background: linear-gradient(180deg, #0a0b0e 0%, #0f1013 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
}

/* Hook Controls Panel */
.hook-controls-panel {
  background: linear-gradient(180deg, #13151a 0%, #0f1013 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 20px 12px;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
  display: flex;
  align-items: center;
}

.hook-search-field {
  max-width: 250px;
}

/* Category Tabs */
.category-tabs {
  padding: 0 20px;
}

.category-tabs .v-chip {
  margin-left: 4px !important;
  font-size: 10px !important;
  height: 16px !important;
  padding: 0 6px !important;
}

/* Hooks Container */
.hooks-container {
  max-height: 400px;
  overflow-y: auto;
  padding: 16px 20px;
}

.hooks-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Hook Item */
.hook-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.hook-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.12);
}

.hook-item.hook-enabled {
  background: rgba(156, 39, 176, 0.1);
  border-color: rgba(156, 39, 176, 0.3);
}

.hook-item.hook-unavailable {
  opacity: 0.6;
}

.hook-main {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.hook-switch {
  flex-shrink: 0;
}

.hook-info {
  flex: 1;
  min-width: 0;
}

.hook-name {
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 2px;
  display: flex;
  align-items: center;
}

.hook-details {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: #888;
}

.hook-category {
  color: #9c27b0;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.hook-hits {
  display: flex;
  align-items: center;
  color: #4ade80;
}

.hook-unavailable-badge {
  display: flex;
  align-items: center;
  color: #ff9800;
}

.hook-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bypass-btn {
  transition: all 0.2s ease;
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
.event-monitor {
  border-left: 3px solid #2196f3;
}

.event-bypass {
  border-left: 3px solid #ff9800;
}

.event-error {
  border-left: 3px solid #f44336;
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
  display: flex;
  align-items: center;
}

.event-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.event-hook {
  font-size: 11px;
  color: #9c27b0;
  font-weight: 600;
}

.event-time {
  font-size: 11px;
  color: #888;
  font-family: 'SF Mono', monospace;
}

.event-hostname {
  font-size: 11px;
  color: #888;
  display: flex;
  align-items: center;
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

.error-text {
  color: #ff5252;
}

/* Certificate Info */
.cert-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cert-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cert-key {
  font-size: 12px;
  color: #9aa0a6;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.cert-value {
  font-size: 13px;
  color: #ffffff;
  font-family: 'SF Mono', monospace;
}

.cert-chain {
  margin-top: 8px;
}

.chain-list {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chain-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(156, 39, 176, 0.1);
  border: 1px solid rgba(156, 39, 176, 0.2);
  border-radius: 6px;
  font-size: 12px;
}

.chain-text {
  color: #e6e6e6;
  font-family: 'SF Mono', monospace;
  word-break: break-all;
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
.ssl-footer {
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
.hooks-container::-webkit-scrollbar,
.events-list::-webkit-scrollbar {
  width: 6px;
}

.hooks-container::-webkit-scrollbar-track,
.events-list::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.hooks-container::-webkit-scrollbar-thumb,
.events-list::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(156, 39, 176, 0.4) 0%, rgba(156, 39, 176, 0.2) 100%);
  border-radius: 3px;
}

.hooks-container::-webkit-scrollbar-thumb:hover,
.events-list::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(156, 39, 176, 0.6) 0%, rgba(156, 39, 176, 0.4) 100%);
}

/* Responsive Design */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .quick-actions {
    flex-wrap: wrap;
    gap: 8px;
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

  .search-field,
  .hook-search-field {
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

  .panel-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
}
</style>
