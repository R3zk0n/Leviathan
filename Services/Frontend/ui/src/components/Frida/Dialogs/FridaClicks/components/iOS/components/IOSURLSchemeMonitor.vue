
<template>
  <div class="ios-url-scheme-monitor" :style="dynamicFontStyle">
    <div class="feature-card">
      <!-- Feature Header -->
      <div class="feature-header">
        <div class="feature-info">
          <v-icon color="orange" size="24">mdi-open-in-app</v-icon>
          <div>
            <div class="feature-name" :style="dynamicHeaderFontStyle">iOS URL Scheme Monitor</div>
            <v-chip size="small" :color="isMonitoring ? 'success' : 'default'" variant="outlined">
              {{ isMonitoring ? 'MONITORING' : 'READY' }}
            </v-chip>
          </div>
        </div>
        <div class="header-actions">
          <v-btn
            :color="isMonitoring ? 'error' : 'success'"
            :loading="refreshing"
            @click="toggleMonitoring(!isMonitoring)"
            size="small"
          >
            {{ isMonitoring ? 'STOP' : 'START MONITORING' }}
          </v-btn>
        </div>
      </div>

      <!-- Feature Description -->
      <div class="feature-description">
        <p>Monitor iOS URL scheme handling including application:openURL:options: calls with real-time security analysis and deep link inspection</p>
      </div>

      <!-- Control Panel -->
      <div class="control-panel">
        <div class="filter-controls">
          <v-chip-group v-model="selectedFilters" column multiple>
            <v-chip
              v-for="type in schemeTypes"
              :key="type.value"
              :value="type.value"
              :color="type.color"
              variant="outlined"
              size="small"
            >
              {{ type.label }}
            </v-chip>
          </v-chip-group>
        </div>

        <div class="action-buttons">
          <v-btn size="small" icon="mdi-refresh" @click="refreshEvents" :loading="refreshing" />
          <v-btn size="small" icon="mdi-delete" @click="clearEvents" title="Clear URL Schemes" color="error" />
          <v-btn size="small" icon="mdi-download" @click="exportSchemes" />
          <v-btn size="small" icon="mdi-send" @click="showSendDialog" color="primary" />
        </div>
      </div>

      <!-- Test URL Dialog -->
      <v-dialog v-model="sendDialogOpen" max-width="600">
        <v-card>
          <v-card-title>Send Test URL Scheme</v-card-title>
          <v-card-text>
            <v-text-field
              v-model="testUrl"
              label="URL Scheme"
              placeholder="iGoat://?contactNumber=Ty&message=BARH"
              variant="outlined"
              hide-details
              class="mb-4"
            />
            <v-text-field
              v-model="testSender"
              label="Sender Name (optional)"
              placeholder="TestSender"
              variant="outlined"
              hide-details
            />
          </v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn @click="sendDialogOpen = false">Cancel</v-btn>
            <v-btn color="primary" @click="sendTestUrl" :loading="sending">Send</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <!-- Stats Display -->
      <div v-if="isMonitoring" class="stats-panel">
        <div class="stat-item">
          <span class="stat-label">Total Events:</span>
          <span class="stat-value">{{ stats.totalEvents }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Unique Bundles:</span>
          <span class="stat-value">{{ Object.keys(stats.byBundle).length }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">URL Schemes:</span>
          <span class="stat-value">{{ stats.byType.url_scheme || 0 }}</span>
        </div>
        <div class="stat-item" v-if="eventRate > 0">
          <span class="stat-label">Rate:</span>
          <span class="stat-value">{{ eventRate }}/sec</span>
        </div>
      </div>

      <!-- URL Scheme Events Display -->
      <div v-if="isMonitoring" class="url-scheme-events">
        <div class="events-header">
          <h4 :style="dynamicHeaderFontStyle">URL Scheme Events</h4>
          <div class="header-controls">
            <v-text-field
              v-model="searchQuery"
              placeholder="Search schemes..."
              variant="outlined"
              density="compact"
              hide-details
              clearable
              prepend-inner-icon="mdi-magnify"
              class="search-field"
            />
          </div>
        </div>

        <div class="events-list" ref="eventsList">
          <div
            v-for="event in filteredEvents"
            :key="event.id"
            :class="[
              'event-item',
              expandedEvents.has(event.id) ? 'expanded' : ''
            ]"
            @click="toggleEventExpansion(event.id)"
          >
            <div class="event-header">
              <div class="event-icon">
                <v-icon :color="getDirectionColor(event)" size="20">{{ getDirectionIcon(event) }}</v-icon>
              </div>
              <div class="event-summary">
                <div class="event-scheme">
                  <span class="scheme-highlight">{{ extractScheme(event.url) }}://</span>{{ event.url.split('://').slice(1).join('://') }}
                </div>
                <div class="event-details">
                  <v-chip size="x-small" :color="getDirectionColor(event)" variant="flat" class="direction-chip">
                    {{ getDirection(event) }}
                  </v-chip>
                  <span class="event-app">{{ event.process?.bundleId || 'Unknown' }}</span>
                  <span class="event-time">{{ formatTime(event.timestamp) }}</span>
                  <span v-if="event.sourceBundleId" class="event-source">
                    from {{ event.sourceBundleId }}
                  </span>
                  <v-chip v-if="event.canOpen !== undefined" size="x-small" :color="event.canOpen ? 'success' : 'error'" variant="outlined">
                    {{ event.canOpen ? 'CAN OPEN' : 'CANNOT OPEN' }}
                  </v-chip>
                </div>
              </div>
              <div class="event-status">
                <v-chip size="small" color="orange" variant="outlined">
                  {{ extractScheme(event.url) }}
                </v-chip>
              </div>
            </div>

            <v-expand-transition>
              <div v-if="expandedEvents.has(event.id)" class="event-expanded" @click.stop>
                <v-tabs v-model="activeTab[event.id]" density="compact" color="primary" @click.stop>
                  <v-tab value="details" @click.stop>Details</v-tab>
                  <v-tab value="url" @click.stop>URL Analysis</v-tab>
                  <v-tab value="stack" @click.stop>Stack Trace</v-tab>
                  <v-tab value="process" @click.stop>Process Info</v-tab>
                </v-tabs>

                <v-window v-model="activeTab[event.id]" @click.stop>
                  <!-- Details Tab -->
                  <v-window-item value="details">
                    <div class="detail-content">
                      <div class="detail-row">
                        <span class="detail-label">Direction:</span>
                        <span class="detail-value">
                          <v-chip size="x-small" :color="getDirectionColor(event)" variant="flat">{{ getDirection(event) }}</v-chip>
                        </span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">Full URL:</span>
                        <span class="detail-value">{{ event.url }}</span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">Scheme:</span>
                        <span class="detail-value">{{ extractScheme(event.url) }}</span>
                      </div>
                      <div class="detail-row" v-if="event.canOpen !== undefined">
                        <span class="detail-label">Can Open:</span>
                        <span class="detail-value">
                          <v-chip size="x-small" :color="event.canOpen ? 'success' : 'error'" variant="outlined">{{ event.canOpen ? 'Yes' : 'No' }}</v-chip>
                        </span>
                      </div>
                      <div class="detail-row" v-if="event.sourceBundleId">
                        <span class="detail-label">Source Bundle:</span>
                        <span class="detail-value">{{ event.sourceBundleId }}</span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">Target Bundle:</span>
                        <span class="detail-value">{{ event.process?.bundleId || 'Unknown' }}</span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">Call Chain:</span>
                        <span class="detail-value">{{ event.callChain?.join(' → ') || 'N/A' }}</span>
                      </div>
                    </div>
                  </v-window-item>

                  <!-- URL Analysis Tab -->
                  <v-window-item value="url">
                    <div class="detail-content">
                      <div class="url-analysis">
                        <div class="url-components">
                          <div class="component-item">
                            <span class="component-label">Scheme:</span>
                            <span class="component-value">{{ extractScheme(event.url) }}</span>
                          </div>
                          <div class="component-item">
                            <span class="component-label">Host:</span>
                            <span class="component-value">{{ extractHost(event.url) }}</span>
                          </div>
                          <div class="component-item">
                            <span class="component-label">Path:</span>
                            <span class="component-value">{{ extractPath(event.url) }}</span>
                          </div>
                          <div class="component-item">
                            <span class="component-label">Query:</span>
                            <span class="component-value">{{ extractQuery(event.url) }}</span>
                          </div>
                        </div>
                        <div v-if="extractParameters(event.url)" class="url-parameters">
                          <h5>Parameters:</h5>
                          <div class="parameter-grid">
                            <div
                              v-for="(value, key) in extractParameters(event.url)"
                              :key="key"
                              class="parameter-item"
                            >
                              <span class="parameter-key">{{ key }}:</span>
                              <span class="parameter-value">{{ value }}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </v-window-item>

                  <!-- Stack Trace Tab -->
                  <v-window-item value="stack">
                    <div class="detail-content">
                      <div class="stack-trace">
                        <div v-if="event.stackTrace?.length > 0" class="stack-frames">
                          <div
                            v-for="(frame, idx) in event.stackTrace"
                            :key="idx"
                            class="stack-frame"
                          >
                            <span class="frame-number">{{ idx }}</span>
                            <span class="frame-text">{{ frame }}</span>
                          </div>
                        </div>
                        <div v-else class="empty-stack">
                          <p>No stack trace available</p>
                        </div>
                      </div>
                    </div>
                  </v-window-item>

                  <!-- Process Info Tab -->
                  <v-window-item value="process">
                    <div class="detail-content">
                      <div class="detail-row">
                        <span class="detail-label">Bundle ID:</span>
                        <span class="detail-value">{{ event.process?.bundleId || 'Unknown' }}</span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">Process ID:</span>
                        <span class="detail-value">{{ event.process?.pid || 'N/A' }}</span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">Thread ID:</span>
                        <span class="detail-value">{{ event.process?.tid || 'N/A' }}</span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">Timestamp:</span>
                        <span class="detail-value">{{ event.timestamp }}</span>
                      </div>
                    </div>
                  </v-window-item>
                </v-window>
              </div>
            </v-expand-transition>
          </div>
        </div>

        <!-- Empty State when monitoring but no events -->
        <div v-if="filteredEvents.length === 0 && isMonitoring" class="empty-state">
          <v-icon size="48" color="grey">mdi-open-in-app</v-icon>
          <h4>No URL Schemes Captured Yet</h4>
          <p>URL scheme events will appear here as apps handle deep links.</p>
        </div>
      </div>

      <!-- Empty State when not monitoring -->
      <div v-else class="empty-state">
        <v-icon size="64" color="grey">mdi-open-in-app</v-icon>
        <h4>{{ isMonitoring ? 'No URL Schemes Captured Yet' : 'Start Monitoring to Capture URL Schemes' }}</h4>
        <p>{{ isMonitoring ? 'URL scheme events will appear here as apps handle deep links.' : 'Click the Start button to begin monitoring iOS URL scheme handling.' }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import axios from 'axios'

const props = defineProps({
  agentLoaded: {
    type: Boolean,
    default: false
  },
  sessionId: {
    type: String,
    default: 'default'
  },
  deviceId: {
    type: String,
    default: null
  },
  pid: {
    type: String,
    default: null
  },
  fontSize: {
    type: Number,
    default: 14
  },
  outputData: {
    type: [Object, String, null],
    default: null
  },
  active: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['toggle', 'show-notification', 'execute-feature'])

// State
const isMonitoring = ref(false)
const refreshing = ref(false)
const sending = ref(false)
const events = ref([])
const stats = ref({
  totalEvents: 0,
  byType: { url_scheme: 0 },
  byBundle: {},
  byOperation: {}
})
const expandedEvents = ref(new Set())
const activeTab = reactive({})
const searchQuery = ref('')
const selectedFilters = ref([0]) // Default to URL schemes
const eventRate = ref(0)
const eventsList = ref(null)

// Test URL dialog
const sendDialogOpen = ref(false)
const testUrl = ref('iGoat://?contactNumber=Ty&message=BARH')
const testSender = ref('TestSender')

// EventSource for real-time events (using Android IPC pattern)
let eventSource = null
let reconnectAttempts = 0
const maxReconnectAttempts = 5
const reconnectDelay = 1000

// Configuration
const schemeTypes = [
  { value: 'url_scheme', label: 'URL Schemes', color: 'orange' }
]

// Event rate tracking
let eventRateInterval = null
let lastEventCount = 0

// Computed properties
const dynamicFontStyle = computed(() => ({
  fontSize: `${props.fontSize}px`
}))

const dynamicHeaderFontStyle = computed(() => ({
  fontSize: `${props.fontSize + 2}px`
}))

const filteredEvents = computed(() => {
  let filtered = events.value

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(event =>
      event.url.toLowerCase().includes(query) ||
      event.process?.bundleId?.toLowerCase().includes(query) ||
      event.sourceBundleId?.toLowerCase().includes(query)
    )
  }

  // Apply type filters (only url_scheme for now)
  if (selectedFilters.value.length > 0) {
    filtered = filtered.filter(event => event.type === 'url_scheme')
  }

  return filtered.slice(0, 200) // Limit to 200 events for performance
})

// EventSource setup for real-time events (copied from AndroidIPCMonitor pattern)
const setupEventSource = () => {
  console.log('URLScheme EventSource: Setting up connection')

  // Use the correct endpoint pattern: /frida/feature-stream/{session_id}/ios/ipc/urlSchemeMonitor
  const eventSourceUrl = `${import.meta.env.VITE_APP_API_URL}/frida/feature-stream/${props.sessionId || 'default'}/ios/ipc/urlSchemeMonitor`

  console.log('URLScheme EventSource: Setting up connection')
  console.log('URL:', eventSourceUrl)
  console.log('Session ID:', props.sessionId)

  // Close existing connection if any
  if (eventSource) {
    console.log('URLScheme EventSource: Closing existing connection')
    eventSource.close()
    eventSource = null
  }

  try {
    eventSource = new EventSource(eventSourceUrl)
    console.log('URLScheme EventSource: Connection created successfully')

    eventSource.onopen = (event) => {
      console.log('URLScheme EventSource: Connection opened successfully')
      reconnectAttempts = 0
    }

    eventSource.onmessage = (event) => {
      try {
        console.log('URLScheme EventSource: Raw message received:', event.data)

        const data = JSON.parse(event.data)
        console.log('URLScheme EventSource: Parsed data:', data)

        // Handle URL scheme events - matching the backend's send pattern
        if (data.type === 'ipc_event' && data.data && data.data.type === 'url_scheme') {
          console.log('URLScheme EventSource: Processing URL scheme event:', data.data)
          processUrlSchemeEvent(data.data)
        }
        // Handle statistics updates
        else if (data.type === 'url_scheme_stats') {
          console.log('URLScheme EventSource: Received statistics update:', data)
          // Update statistics if needed
        }
        // Handle status messages
        else if (data.type === 'status') {
          console.log('ℹURLScheme EventSource: Status message:', data.message)
          emit('show-notification', {
            message: data.message,
            type: 'info'
          })
        }
        // Handle error messages
        else if (data.type === 'error') {
          console.error('URLScheme EventSource: Error message:', data.message)
          emit('show-notification', {
            message: `URLScheme Error: ${data.message}`,
            type: 'error'
          })
        }
        else {
          console.log('URLScheme EventSource: Other message type:', data.type)
        }
      } catch (error) {
        console.error('URLScheme EventSource: Error processing message:', error)
        console.error('Raw message data:', event.data)
      }
    }

    eventSource.onerror = (error) => {
      console.error('URLScheme EventSource: Connection error:', error)
      console.error('EventSource state:', eventSource?.readyState)
      console.error('URL was:', eventSourceUrl)

      if (eventSource?.readyState === EventSource.CLOSED) {
        console.log('URLScheme EventSource: Connection closed, attempting reconnect...')

        // Implement reconnection logic
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++
          console.log(`URLScheme EventSource: Reconnect attempt ${reconnectAttempts}/${maxReconnectAttempts}`)

          setTimeout(() => {
            if (isMonitoring.value) {
              setupEventSource()
            }
          }, 1000 * reconnectAttempts) // Exponential backoff
        } else {
          console.error('URLScheme EventSource: Max reconnection attempts reached')
          emit('show-notification', {
            message: 'URL scheme monitoring connection lost. Please restart monitoring.',
            type: 'error'
          })
        }
      }
    }

  } catch (error) {
    console.error('URLScheme EventSource: Failed to create connection:', error)
    emit('show-notification', {
      message: 'Failed to establish URL scheme monitoring connection',
      type: 'error'
    })
  }
}

const processUrlSchemeEvent = (eventData) => {
  console.log('Processing URL scheme event:', eventData)

  // Create a formatted event object
  const urlSchemeEvent = {
    id: eventData.id || `url_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: eventData.timestamp || new Date().toISOString(),
    type: 'url_scheme',
    url: eventData.url || 'unknown',
    process: eventData.process || {},
    callChain: eventData.callChain || [],
    stackTrace: eventData.stackTrace || [],
    sourceBundleId: eventData.sourceBundleId || eventData.process?.bundleId || 'unknown'
  }

  // Add to events array
  events.value.unshift(urlSchemeEvent)

  // Keep only the latest 200 events for performance
  if (events.value.length > 200) {
    events.value = events.value.slice(0, 200)
  }

  // Update local statistics
  updateLocalStatistics(urlSchemeEvent)

  console.log('URL scheme event processed and added to UI:', urlSchemeEvent)
}

// Update local statistics (copied from AndroidIPCMonitor)
const updateLocalStatistics = (eventData) => {
  // Update stats
  stats.value.totalEvents = events.value.length
  stats.value.byType.url_scheme = events.value.filter(e => e.type === 'url_scheme').length

  // Update bundle stats
  const bundleId = eventData.process?.bundleId || 'unknown'
  stats.value.byBundle[bundleId] = (stats.value.byBundle[bundleId] || 0) + 1

  // Update operation stats (based on scheme)
  try {
    const scheme = eventData.url.split(':')[0]?.toLowerCase() || 'unknown'
    stats.value.byOperation[scheme] = (stats.value.byOperation[scheme] || 0) + 1
  } catch (error) {
    console.error('Error updating operation stats:', error)
  }

  console.log('Updated local statistics:', stats.value)
}

// Clean up EventSource
const closeEventSource = () => {
  console.log('URLScheme EventSource: Closing connection')
  if (eventSource) {
    eventSource.close()
    eventSource = null
    console.log('URLScheme EventSource: Connection closed')
  }
  reconnectAttempts = 0
}

// Methods
const toggleMonitoring = async (value) => {
  if (value) {
    await startMonitoring()
  } else {
    await stopMonitoring()
  }
}

const startMonitoring = async () => {
  if (!props.agentLoaded) {
    emit('show-notification', {
      message: 'Agent not loaded. Please load the agent first.',
      type: 'error'
    })
    return
  }

  try {
    const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
      session_id: props.sessionId,
      command: 'startURLSchemeMonitor()',
    })

    if (response.data.status === 'success') {
      isMonitoring.value = true

      // Set up EventSource for real-time events
      setupEventSource()

      // Start event rate calculation
      calculateEventRate()

      emit('show-notification', {
        message: 'URL scheme monitoring started',
        type: 'success'
      })
    } else {
      emit('show-notification', {
        message: `Failed to start monitoring: ${response.data.message}`,
        type: 'error'
      })
    }
  } catch (error) {
    console.error('Error starting URL scheme monitoring:', error)
    emit('show-notification', {
      message: `Error: ${error.message}`,
      type: 'error'
    })
  }
}

const stopMonitoring = async () => {
  try {
    const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
      session_id: props.sessionId,
      command: 'stopURLSchemeMonitor()',
    })

    if (response.data.status === 'success') {
      isMonitoring.value = false

      // Clean up EventSource
      closeEventSource()

      // Clear event rate interval
      if (eventRateInterval) {
        clearInterval(eventRateInterval)
        eventRate.value = 0
      }

      emit('show-notification', {
        message: 'URL scheme monitoring stopped',
        type: 'success'
      })
    } else {
      emit('show-notification', {
        message: `Failed to stop monitoring: ${response.data.message}`,
        type: 'error'
      })
    }
  } catch (error) {
    console.error('Error stopping URL scheme monitoring:', error)
    emit('show-notification', {
      message: `Error: ${error.message}`,
      type: 'error'
    })
  }
}

const refreshEvents = async () => {
  if (!isMonitoring.value) return

  refreshing.value = true
  try {
    const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
      session_id: props.sessionId,
      command: 'getURLSchemeEvents()',
    })

    if (response.data.status === 'success' && response.data.result?.data) {
      const data = response.data.result.data
      events.value = data.events || []
      stats.value = data.statistics || stats.value
    }
  } catch (error) {
    console.error('Error refreshing URL scheme events:', error)
  } finally {
    refreshing.value = false
  }
}

const clearEvents = async () => {
  try {
    const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
      session_id: props.sessionId,
      command: 'clearURLSchemeEvents()',
    })

    if (response.data.status === 'success') {
      events.value = []
      stats.value = {
        totalEvents: 0,
        byType: { url_scheme: 0 },
        byBundle: {},
        byOperation: {}
      }
      expandedEvents.value.clear()

      emit('show-notification', {
        message: 'URL scheme events cleared',
        type: 'success'
      })
    }
  } catch (error) {
    console.error('Error clearing URL scheme events:', error)
    emit('show-notification', {
      message: `Error: ${error.message}`,
      type: 'error'
    })
  }
}

const showSendDialog = () => {
  sendDialogOpen.value = true
}

const sendTestUrl = async () => {
  if (!testUrl.value.trim()) return

  sending.value = true
  try {
    const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
      session_id: props.sessionId,
      command: `sendURLSchemeEvent("${testUrl.value}", {sourceApplication: "${testSender.value}"}, "${testSender.value}")`
    })

    if (response.data.status === 'success') {
      emit('show-notification', {
        message: `URL scheme sent successfully: ${testUrl.value}`,
        type: 'success'
      })
      sendDialogOpen.value = false
    } else {
      emit('show-notification', {
        message: `Failed to send URL scheme: ${response.data.message}`,
        type: 'error'
      })
    }
  } catch (error) {
    console.error('Error sending URL scheme:', error)
    emit('show-notification', {
      message: `Failed to send URL scheme: ${error.message}`,
      type: 'error'
    })
  } finally {
    sending.value = false
  }
}

const exportSchemes = () => {
  try {
    const data = {
      timestamp: new Date().toISOString(),
      stats: stats.value,
      events: events.value
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ios-url-schemes-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    emit('show-notification', {
      message: 'URL schemes exported successfully',
      type: 'success'
    })
  } catch (error) {
    console.error('Export error:', error)
    emit('show-notification', {
      message: 'Failed to export URL schemes',
      type: 'error'
    })
  }
}

const toggleEventExpansion = (eventId) => {
  if (expandedEvents.value.has(eventId)) {
    expandedEvents.value.delete(eventId)
  } else {
    expandedEvents.value.add(eventId)
    if (!activeTab[eventId]) {
      activeTab[eventId] = 'details'
    }
  }
}

// Direction helpers (based on callChain values from the agent)
const getDirection = (event) => {
  const chain = event.callChain || []
  if (chain[0] === 'outgoing') return 'OUTGOING'
  if (chain[0] === 'query') return 'QUERY'
  if (chain[0]?.startsWith('- application:') || chain[0]?.startsWith('- scene:')) return 'INCOMING'
  // Fallback: if sourceBundleId differs from process bundleId, it's incoming
  if (event.sourceBundleId && event.sourceBundleId !== event.process?.bundleId) return 'INCOMING'
  return 'OUTGOING'
}

const getDirectionColor = (event) => {
  const dir = getDirection(event)
  if (dir === 'INCOMING') return 'blue'
  if (dir === 'QUERY') return 'grey'
  return 'orange'
}

const getDirectionIcon = (event) => {
  const dir = getDirection(event)
  if (dir === 'INCOMING') return 'mdi-arrow-down-bold'
  if (dir === 'QUERY') return 'mdi-help-circle-outline'
  return 'mdi-arrow-up-bold'
}

// URL parsing utilities
const extractScheme = (url) => {
  try {
    return url.split(':')[0] || 'unknown'
  } catch {
    return 'unknown'
  }
}

const extractHost = (url) => {
  try {
    const match = url.match(/^[^:]+:\/\/([^\/\?]+)/)
    return match ? match[1] : 'N/A'
  } catch {
    return 'N/A'
  }
}

const extractPath = (url) => {
  try {
    const match = url.match(/^[^:]+:\/\/[^\/]*([^\?]*)/)
    return match ? match[1] : 'N/A'
  } catch {
    return 'N/A'
  }
}

const extractQuery = (url) => {
  try {
    const match = url.match(/\?(.+)$/)
    return match ? match[1] : 'N/A'
  } catch {
    return 'N/A'
  }
}

const extractParameters = (url) => {
  try {
    const match = url.match(/\?(.+)$/)
    if (!match) return null

    const params = {}
    const pairs = match[1].split('&')

    for (const pair of pairs) {
      const [key, value] = pair.split('=')
      if (key) {
        params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : ''
      }
    }

    return Object.keys(params).length > 0 ? params : null
  } catch {
    return null
  }
}

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString()
}

const formatTimestamp = (timestamp) => {
  return new Date(timestamp).toLocaleString()
}

const calculateEventRate = () => {
  lastEventCount = events.value.length
  eventRateInterval = setInterval(() => {
    const currentCount = events.value.length
    eventRate.value = Math.max(0, currentCount - lastEventCount)
    lastEventCount = currentCount
  }, 1000)
}

// Handle incoming events from Frida (fallback method)
const handleIncomingEvent = (eventData) => {
  console.log('URLScheme Window Event: Received event:', eventData)

  // Handle direct event data
  if (eventData.detail && eventData.detail.type === 'ipc_event' && eventData.detail.data?.type === 'url_scheme') {
    const newEvent = eventData.detail.data
    console.log('URLScheme Window Event: Processing URL scheme event:', newEvent)

    // Add to events
    events.value.unshift(newEvent)

    // Limit events
    if (events.value.length > 1000) {
      events.value = events.value.slice(0, 1000)
    }

    // Update stats
    updateLocalStatistics(newEvent)

    // Auto-scroll to new events
    nextTick(() => {
      if (eventsList.value) {
        eventsList.value.scrollTop = 0
      }
    })
  }
  // Handle EventSource-style data
  else if (eventData.type === 'ipc_event' && eventData.data?.type === 'url_scheme') {
    const newEvent = eventData.data
    console.log('URLScheme Window Event: Processing URL scheme event (direct):', newEvent)

    // Add to events
    events.value.unshift(newEvent)

    // Limit events
    if (events.value.length > 1000) {
      events.value = events.value.slice(0, 1000)
    }

    // Update stats
    updateLocalStatistics(newEvent)

    // Auto-scroll to new events
    nextTick(() => {
      if (eventsList.value) {
        eventsList.value.scrollTop = 0
      }
    })
  }
}

// Watchers
watch(() => props.active, (newVal) => {
  if (newVal !== isMonitoring.value) {
    isMonitoring.value = newVal
    if (newVal) {
      setupEventSource()
      calculateEventRate()
    } else {
      closeEventSource()
      if (eventRateInterval) {
        clearInterval(eventRateInterval)
        eventRate.value = 0
      }
    }
  }
})

watch(() => props.outputData, (newData) => {
  if (newData) {
    // Handle output data updates from parent
    try {
      const data = typeof newData === 'string' ? JSON.parse(newData) : newData
      if (data.events && Array.isArray(data.events)) {
        events.value = data.events
      }
      if (data.statistics) {
        stats.value = { ...stats.value, ...data.statistics }
      }
    } catch (error) {
      console.error('Error parsing output data:', error)
    }
  }
}, { deep: true, immediate: true })

// Watchers for monitoring state
watch(isMonitoring, (newVal, oldVal) => {
  console.log('URLScheme Watcher: monitoring changed:', oldVal, '->', newVal)
  if (newVal && !oldVal) {
    console.log('▶URLScheme Watcher: Starting EventSource')
    setupEventSource()
    calculateEventRate()
  } else if (!newVal && oldVal) {
    console.log('⏹URLScheme Watcher: Stopping EventSource')
    closeEventSource()
    if (eventRateInterval) {
      clearInterval(eventRateInterval)
      eventRate.value = 0
    }
  }
})

// Lifecycle
onMounted(() => {
  console.log('URLScheme Component: Mounted')
  console.log('Session ID:', props.sessionId)
  console.log('▶Monitoring state:', isMonitoring.value)

  if (props.active) {
    isMonitoring.value = true
    setupEventSource()
    calculateEventRate()
  }

  // Always set up EventSource on mount
  setupEventSource()

  // Set up event listener for incoming Frida events (fallback)
  window.addEventListener('frida-event', handleIncomingEvent)
})

onUnmounted(() => {
  console.log('URLScheme Component: Unmounting, closing EventSource')
  if (eventRateInterval) {
    clearInterval(eventRateInterval)
  }

  // Clean up EventSource
  closeEventSource()

  // Remove window event listener
  window.removeEventListener('frida-event', handleIncomingEvent)
})

// Expose forceReconnect for debugging
if (import.meta.env.DEV) {
  window.debugURLSchemeReconnect = () => {
    console.log('URLScheme EventSource: Force reconnecting...')
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
.ios-url-scheme-monitor {
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

.feature-description {
  padding: 16px 20px;
  color: #9aa0a6;
  line-height: 1.5;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.control-panel {
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.filter-controls {
  margin-bottom: 16px;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.stats-panel {
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
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

.url-scheme-events {
  max-height: 600px;
  overflow-y: auto;
}

.events-header {
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.events-header h4 {
  margin: 0;
  color: #ffffff;
}

.search-field {
  max-width: 200px;
}

.events-list {
  padding: 8px;
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
  border-color: rgba(255, 165, 0, 0.3);
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

.event-scheme {
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

.event-app {
  font-size: 14px;
  color: #9aa0a6;
}

.event-time {
  font-size: 12px;
  color: #666;
}

.event-source {
  font-size: 12px;
  color: #4ade80;
}

.event-status {
  display: flex;
  flex-direction: column;
  gap: 4px;
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

.url-analysis {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.url-components {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.component-item {
  display: flex;
  gap: 12px;
}

.component-label {
  font-weight: 600;
  color: #9aa0a6;
  min-width: 80px;
  flex-shrink: 0;
}

.component-value {
  color: #ffffff;
  word-break: break-all;
}

.url-parameters h5 {
  color: #ffffff;
  margin-bottom: 8px;
}

.parameter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 8px;
}

.parameter-item {
  background: rgba(255, 255, 255, 0.02);
  padding: 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.parameter-key {
  font-weight: 600;
  color: #9aa0a6;
  margin-right: 8px;
}

.parameter-value {
  color: #ffffff;
  word-break: break-all;
}

.stack-trace {
  max-height: 300px;
  overflow-y: auto;
}

.stack-frames {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stack-frame {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.frame-number {
  font-weight: 600;
  color: #9aa0a6;
  min-width: 24px;
  flex-shrink: 0;
}

.frame-text {
  color: #ffffff;
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}

.no-stack-trace {
  color: #666;
  font-style: italic;
  text-align: center;
  padding: 20px;
}

.process-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.process-item {
  display: flex;
  gap: 16px;
}

.process-label {
  font-weight: 600;
  color: #9aa0a6;
  min-width: 120px;
  flex-shrink: 0;
}

.process-value {
  color: #ffffff;
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

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Direction chip styling */
.direction-chip {
  font-weight: 600;
  font-size: 10px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

/* Scheme highlight in URL display */
.scheme-highlight {
  color: #ff9800;
  font-weight: 700;
  background: rgba(255, 152, 0, 0.1);
  padding: 1px 4px;
  border-radius: 3px;
  font-family: monospace;
}

/* Header controls layout */
.header-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* New event animation */
.event-item.new-event {
  animation: newEventGlow 1s ease-out;
}

@keyframes newEventGlow {
  0% {
    background: rgba(255, 165, 0, 0.2);
    border-color: rgba(255, 165, 0, 0.5);
    transform: scale(1.02);
  }
  100% {
    background: rgba(255, 255, 255, 0.02);
    border-color: rgba(255, 255, 255, 0.06);
    transform: scale(1);
  }
}
</style>
