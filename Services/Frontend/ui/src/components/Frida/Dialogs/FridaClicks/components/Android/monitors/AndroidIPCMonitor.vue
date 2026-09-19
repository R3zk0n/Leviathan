<template>
  <div class="android-ipc-monitor">
    <div class="feature-card ipc-card">
      <div class="feature-header">
        <div class="feature-info">
          <v-icon size="small" class="mr-2" :color="isMonitoring ? 'purple' : 'grey'">
            {{ isMonitoring ? 'mdi-record-circle' : 'mdi-record-circle-outline' }}
          </v-icon>
          <span class="feature-name">Android IPC Security Monitor</span>
          <v-chip size="x-small" class="ml-2" :color="isMonitoring ? 'purple' : 'grey'">
            {{ isMonitoring ? 'MONITORING' : 'INACTIVE' }}
          </v-chip>
          <v-chip
            v-if="isMonitoring && stats.totalEvents > 0"
            size="x-small"
            class="ml-2"
            color="green"
          >
            {{ stats.totalEvents }} events
          </v-chip>
        </div>
        <v-switch
          v-model="isMonitoring"
          density="compact"
          hide-details
          @update:model-value="toggleMonitoring"
          color="purple"
        />
      </div>

      <div class="feature-description">
        Monitor Android Inter-Process Communication including Intents, Broadcasts, Content Providers, Binder calls, and Service operations with real-time security analysis
      </div>

      <!-- Control Panel -->
      <div v-if="isMonitoring" class="control-panel">
        <div class="filter-controls">
          <v-chip-group v-model="selectedFilters" multiple>
            <v-chip
              v-for="type in eventTypes"
              :key="type.value"
              filter
              :color="type.color"
              size="small"
            >
              {{ type.label }}
            </v-chip>
          </v-chip-group>
        </div>

        <div class="action-buttons">
          <v-btn size="small" icon="mdi-refresh" @click="refreshEvents" :loading="refreshing" />
          <v-btn size="small" icon="mdi-delete" @click="clearEvents" color="error" />
          <v-btn size="small" icon="mdi-download" @click="exportEvents" />
        </div>
      </div>

      <!-- Stats Display -->
      <div v-if="isMonitoring && stats.totalEvents > 0" class="stats-panel">
        <div class="stat-item" v-for="(count, type) in stats.byType" :key="type">
          <span class="stat-label">{{ type }}:</span>
          <span class="stat-value">{{ count }}</span>
        </div>
      </div>

      <!-- Events List -->
      <div v-if="isMonitoring && events.length > 0" class="events-container">
        <div class="events-header">
          <span>Recent IPC Events</span>
          <v-chip size="x-small" color="info">{{ events.length }} / {{ maxEvents }}</v-chip>
        </div>

        <div class="events-list">
          <div
            v-for="event in filteredEvents"
            :key="event.id"
            class="event-item"
            :class="`event-${event.type}`"
          >
            <div class="event-header">
              <div class="event-type">
                <v-icon size="small" :color="getEventColor(event.type)">
                  {{ getEventIcon(event.type) }}
                </v-icon>
                <span>{{ event.type }}</span>
              </div>
              <span class="event-time">{{ formatTime(event.timestamp) }}</span>
            </div>

            <div class="event-content">
              <div v-if="event.action" class="event-field">
                <span class="field-label">Action:</span>
                <span class="field-value">{{ event.action }}</span>
              </div>
              <div v-if="event.targetPackage" class="event-field">
                <span class="field-label">Target:</span>
                <span class="field-value">{{ event.targetPackage }}</span>
              </div>
              <div v-if="event.sourcePackage" class="event-field">
                <span class="field-label">Source:</span>
                <span class="field-value">{{ event.sourcePackage }}</span>
              </div>
              <div v-if="event.data" class="event-field">
                <span class="field-label">Data:</span>
                <span class="field-value">{{ event.data }}</span>
              </div>

              <div v-if="expandedEvents.includes(event.id)" class="event-details">
                <pre>{{ JSON.stringify(event, null, 2) }}</pre>
              </div>

              <v-btn
                size="x-small"
                variant="text"
                @click="toggleEventDetails(event.id)"
              >
                {{ expandedEvents.includes(event.id) ? 'Less' : 'More' }}
              </v-btn>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="isMonitoring" class="empty-state">
        <v-icon size="48" color="grey">mdi-swap-horizontal</v-icon>
        <p>No IPC events captured yet</p>
        <p class="text-caption">IPC events will appear here as they occur</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, onUnmounted } from 'vue'
import axios from 'axios'

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  }
})

// Inject notification handler
const showNotification = inject('showNotification', () => {})

// State
const isMonitoring = ref(false)
const refreshing = ref(false)
const events = ref([])
const expandedEvents = ref([])
const selectedFilters = ref([0, 1, 2, 3, 4])
const maxEvents = ref(100)
let eventSource = null
let refreshInterval = null

// Event types configuration
const eventTypes = [
  { value: 'intent', label: 'Intent', color: 'blue', icon: 'mdi-send' },
  { value: 'broadcast', label: 'Broadcast', color: 'purple', icon: 'mdi-broadcast' },
  { value: 'content_provider', label: 'Content', color: 'orange', icon: 'mdi-database' },
  { value: 'binder', label: 'Binder', color: 'green', icon: 'mdi-link-variant' },
  { value: 'service', label: 'Service', color: 'red', icon: 'mdi-cog' }
]

// Stats computed from events
const stats = computed(() => {
  const byType = events.value.reduce((acc, event) => {
    acc[event.type] = (acc[event.type] || 0) + 1
    return acc
  }, {})

  return {
    totalEvents: events.value.length,
    byType
  }
})

// Filtered events based on selected filters
const filteredEvents = computed(() => {
  const selectedTypes = selectedFilters.value.map(i => eventTypes[i]?.value).filter(Boolean)
  return events.value
    .filter(event => selectedTypes.includes(event.type))
    .slice(0, maxEvents.value)
})

// Methods
const toggleMonitoring = async (value) => {
  if (value) {
    await startMonitoring()
  } else {
    await stopMonitoring()
  }
}

const startMonitoring = async () => {
  try {
    const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
      session_id: props.sessionId,
      command: 'startIPCMonitoring()',
    })

    if (response.data.status === 'success') {
      showNotification('IPC monitoring started', 'success')
      setupEventStream()
      // Set up refresh interval
      refreshInterval = setInterval(refreshEvents, 5000)
    } else {
      isMonitoring.value = false
      showNotification(`Failed to start IPC monitoring: ${response.data.message}`, 'error')
    }
  } catch (error) {
    isMonitoring.value = false
    console.error('Error starting IPC monitoring:', error)
    showNotification(`Error: ${error.message}`, 'error')
  }
}

const stopMonitoring = async () => {
  try {
    const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
      session_id: props.sessionId,
      command: 'stopIPCMonitoring()',
    })

    if (response.data.status === 'success') {
      showNotification('IPC monitoring stopped', 'info')
      cleanupEventStream()
      if (refreshInterval) {
        clearInterval(refreshInterval)
        refreshInterval = null
      }
    } else {
      showNotification(`Failed to stop IPC monitoring: ${response.data.message}`, 'error')
    }
  } catch (error) {
    console.error('Error stopping IPC monitoring:', error)
    showNotification(`Error: ${error.message}`, 'error')
  }
}

const refreshEvents = async () => {
  if (!isMonitoring.value) return

  refreshing.value = true
  try {
    const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
      session_id: props.sessionId,
      command: 'getIPCEvents()',
    })

    if (response.data.status === 'success' && response.data.result) {
      events.value = response.data.result.events || []
    }
  } catch (error) {
    console.error('Error refreshing IPC events:', error)
  } finally {
    refreshing.value = false
  }
}

const clearEvents = async () => {
  try {
    const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
      session_id: props.sessionId,
      command: 'clearIPCEvents()',
    })

    if (response.data.status === 'success') {
      events.value = []
      expandedEvents.value = []
      showNotification('IPC events cleared', 'info')
    }
  } catch (error) {
    console.error('Error clearing IPC events:', error)
    showNotification(`Error: ${error.message}`, 'error')
  }
}

const exportEvents = () => {
  const data = JSON.stringify(events.value, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ipc-events-${new Date().toISOString()}.json`
  a.click()
  URL.revokeObjectURL(url)
  showNotification('IPC events exported', 'success')
}

const setupEventStream = () => {
  // Simulate real-time event streaming
  // In production, this would connect to a WebSocket or SSE endpoint
  refreshEvents()
}

const cleanupEventStream = () => {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
}

const toggleEventDetails = (eventId) => {
  const index = expandedEvents.value.indexOf(eventId)
  if (index > -1) {
    expandedEvents.value.splice(index, 1)
  } else {
    expandedEvents.value.push(eventId)
  }
}

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString()
}

const getEventIcon = (type) => {
  return eventTypes.find(t => t.value === type)?.icon || 'mdi-help'
}

const getEventColor = (type) => {
  return eventTypes.find(t => t.value === type)?.color || 'grey'
}

// Cleanup
onUnmounted(() => {
  if (isMonitoring.value) {
    stopMonitoring()
  }
  cleanupEventStream()
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<style scoped>
.android-ipc-monitor {
  padding: 8px;
}

.feature-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 16px;
  transition: all 0.3s ease;
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
}

.feature-description {
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  margin-bottom: 12px;
}

.control-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 12px 0;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.stats-panel {
  display: flex;
  gap: 16px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  margin-bottom: 12px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stat-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  text-transform: capitalize;
}

.stat-value {
  font-size: 12px;
  font-weight: 500;
}

.events-container {
  margin-top: 16px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  overflow: hidden;
}

.events-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.events-list {
  max-height: 400px;
  overflow-y: auto;
}

.event-item {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: background 0.2s ease;
}

.event-item:hover {
  background: rgba(255, 255, 255, 0.02);
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.event-type {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  text-transform: capitalize;
}

.event-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.event-content {
  font-size: 12px;
}

.event-field {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
}

.field-label {
  color: rgba(255, 255, 255, 0.6);
  min-width: 60px;
}

.field-value {
  color: rgba(255, 255, 255, 0.9);
  word-break: break-all;
}

.event-details {
  margin-top: 8px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  font-size: 11px;
}

.event-details pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: rgba(255, 255, 255, 0.5);
}

.empty-state p {
  margin: 8px 0;
}

/* Event type colors */
.event-intent { border-left: 3px solid #2196F3; }
.event-broadcast { border-left: 3px solid #9C27B0; }
.event-content_provider { border-left: 3px solid #FF9800; }
.event-binder { border-left: 3px solid #4CAF50; }
.event-service { border-left: 3px solid #F44336; }
</style>
