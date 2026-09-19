<template>
  <div class="ios-ipc-monitor" :style="dynamicFontStyle">
    <div class="feature-card">
      <!-- Header -->
      <div class="feature-header">
        <div class="feature-info">
          <v-icon color="blue" size="24">mdi-swap-horizontal</v-icon>
          <div>
            <div class="feature-name" :style="dynamicHeaderFontStyle">iOS IPC Monitor</div>
            <v-chip size="small" :color="anyMonitorActive ? 'success' : 'default'" variant="outlined">
              {{ anyMonitorActive ? `${activeMonitorCount} ACTIVE` : 'READY' }}
            </v-chip>
          </div>
        </div>
        <div class="header-actions">
          <v-btn
            v-if="!anyMonitorActive"
            color="success"
            size="small"
            @click="startAll"
            :loading="startingAll"
          >
            START ALL
          </v-btn>
          <v-btn
            v-else
            color="error"
            size="small"
            @click="stopAll"
            :loading="stoppingAll"
          >
            STOP ALL
          </v-btn>
        </div>
      </div>

      <!-- Description -->
      <div class="feature-description">
        Monitor iOS Inter-Process Communication: Pasteboard, Darwin Notifications, App Groups, and more.
      </div>

      <!-- Stats Bar -->
      <div v-if="anyMonitorActive" class="stats-bar">
        <div class="stat-chip" v-for="s in statChips" :key="s.type">
          <v-icon :color="s.color" size="14">{{ s.icon }}</v-icon>
          <span class="stat-type">{{ s.label }}:</span>
          <span class="stat-count">{{ s.count }}</span>
        </div>
        <div class="stat-chip total">
          <span class="stat-type">Total:</span>
          <span class="stat-count">{{ totalEvents }}</span>
        </div>
      </div>

      <!-- Tabs -->
      <v-tabs v-model="activeTab" bg-color="transparent" color="blue" density="compact" class="ipc-tabs">
        <v-tab value="pasteboard">
          <v-icon start size="16">mdi-clipboard-text-outline</v-icon>
          Pasteboard
          <v-badge v-if="pasteboardEvents.length" :content="pasteboardEvents.length" color="orange" inline class="ml-1" />
        </v-tab>
        <v-tab value="notifications">
          <v-icon start size="16">mdi-bell-outline</v-icon>
          Notifications
          <v-badge v-if="darwinEvents.length" :content="darwinEvents.length" color="purple" inline class="ml-1" />
        </v-tab>
        <v-tab value="appgroups">
          <v-icon start size="16">mdi-folder-account-outline</v-icon>
          App Groups
          <v-badge v-if="appGroupEvents.length" :content="appGroupEvents.length" color="green" inline class="ml-1" />
        </v-tab>
      </v-tabs>

      <v-window v-model="activeTab" class="ipc-window">
        <!-- Pasteboard Tab -->
        <v-window-item value="pasteboard">
          <div class="tab-content">
            <div class="tab-toolbar">
              <v-switch
                v-model="monitors.pasteboard"
                density="compact"
                hide-details
                color="orange"
                @update:model-value="(v) => toggleMonitor('pasteboard', v)"
                :loading="loading.pasteboard"
              >
                <template #label>
                  <span class="switch-label">{{ monitors.pasteboard ? 'Monitoring' : 'Stopped' }}</span>
                </template>
              </v-switch>
              <v-spacer />
              <div class="tab-actions">
                <v-btn size="small" icon="mdi-refresh" @click="refreshMonitor('pasteboard')" :loading="loading.pasteboard" />
                <v-btn size="small" icon="mdi-delete" color="error" @click="clearMonitor('pasteboard')" />
                <v-btn size="small" icon="mdi-download" @click="exportMonitor('pasteboard')" />
              </div>
            </div>

            <!-- Current Pasteboard Contents -->
            <div class="info-panel" v-if="pasteboardContents">
              <div class="panel-title">
                <v-icon size="16" class="mr-1">mdi-clipboard-check-outline</v-icon>
                Current Pasteboard
                <v-btn size="x-small" icon="mdi-refresh" variant="text" @click="fetchPasteboardContents" class="ml-1" />
              </div>
              <div class="panel-grid">
                <div class="panel-item">
                  <span class="item-label">Change Count:</span>
                  <span class="item-value">{{ pasteboardContents.changeCount }}</span>
                </div>
                <div class="panel-item">
                  <span class="item-label">Items:</span>
                  <span class="item-value">{{ pasteboardContents.numberOfItems }}</span>
                </div>
                <div class="panel-item" v-if="pasteboardContents.string">
                  <span class="item-label">String:</span>
                  <span class="item-value truncate">{{ pasteboardContents.string }}</span>
                </div>
                <div class="panel-item" v-if="pasteboardContents.types?.length">
                  <span class="item-label">Types:</span>
                  <span class="item-value">
                    <v-chip v-for="t in pasteboardContents.types.slice(0, 5)" :key="t" size="x-small" class="mr-1" variant="outlined">{{ t }}</v-chip>
                  </span>
                </div>
              </div>
            </div>

            <!-- Inject Pasteboard -->
            <div class="inject-panel">
              <v-text-field
                v-model="pasteboardInject"
                placeholder="Write to pasteboard..."
                variant="outlined"
                density="compact"
                hide-details
                class="inject-field"
              >
                <template #append-inner>
                  <v-btn size="x-small" color="orange" variant="flat" @click="injectPasteboard" :loading="injecting.pasteboard" :disabled="!pasteboardInject.trim()">
                    Inject
                  </v-btn>
                </template>
              </v-text-field>
            </div>

            <!-- Event List -->
            <div class="events-list" ref="pasteboardList">
              <div v-for="event in pasteboardEvents" :key="event.id" class="event-item event-pasteboard" @click="toggleExpand(event.id)">
                <div class="event-row">
                  <v-icon size="16" color="orange">mdi-clipboard-text-outline</v-icon>
                  <v-chip size="x-small" :color="event.callChain?.[0] === 'write' ? 'orange' : 'blue'" variant="flat" class="op-chip">
                    {{ event.callChain?.[0] || 'unknown' }}
                  </v-chip>
                  <span class="event-datatype">{{ event.dataType || 'N/A' }}</span>
                  <span class="event-data-preview" v-if="event.data">{{ truncate(String(event.data), 60) }}</span>
                  <v-spacer />
                  <span class="event-time">{{ formatTime(event.timestamp) }}</span>
                </div>
                <v-expand-transition>
                  <div v-if="expandedEvents.has(event.id)" class="event-detail" @click.stop>
                    <div class="detail-row" v-if="event.boardName"><span class="dl">Board:</span><span class="dv">{{ event.boardName }}</span></div>
                    <div class="detail-row" v-if="event.dataType"><span class="dl">Data Type:</span><span class="dv">{{ event.dataType }}</span></div>
                    <div class="detail-row" v-if="event.data"><span class="dl">Content:</span><span class="dv monospace">{{ event.data }}</span></div>
                    <div class="detail-row" v-if="event.process?.bundleId"><span class="dl">Bundle:</span><span class="dv">{{ event.process.bundleId }}</span></div>
                    <div class="detail-row" v-if="event.process?.pid"><span class="dl">PID:</span><span class="dv">{{ event.process.pid }}</span></div>
                    <div v-if="event.stackTrace?.length" class="stack-section">
                      <span class="dl">Stack Trace:</span>
                      <div class="stack-frames">
                        <div v-for="(frame, i) in event.stackTrace" :key="i" class="stack-frame">
                          <span class="frame-num">{{ i }}</span>{{ frame }}
                        </div>
                      </div>
                    </div>
                  </div>
                </v-expand-transition>
              </div>
              <div v-if="monitors.pasteboard && pasteboardEvents.length === 0" class="empty-tab">
                <v-icon size="36" color="grey">mdi-clipboard-text-outline</v-icon>
                <p>No pasteboard events captured yet</p>
              </div>
            </div>
          </div>
        </v-window-item>

        <!-- Darwin Notifications Tab -->
        <v-window-item value="notifications">
          <div class="tab-content">
            <div class="tab-toolbar">
              <v-switch
                v-model="monitors.darwinNotification"
                density="compact"
                hide-details
                color="purple"
                @update:model-value="(v) => toggleMonitor('darwinNotification', v)"
                :loading="loading.darwinNotification"
              >
                <template #label>
                  <span class="switch-label">{{ monitors.darwinNotification ? 'Monitoring' : 'Stopped' }}</span>
                </template>
              </v-switch>
              <v-spacer />
              <div class="tab-actions">
                <v-btn size="small" icon="mdi-refresh" @click="refreshMonitor('darwinNotification')" :loading="loading.darwinNotification" />
                <v-btn size="small" icon="mdi-delete" color="error" @click="clearMonitor('darwinNotification')" />
                <v-btn size="small" icon="mdi-download" @click="exportMonitor('darwinNotification')" />
              </div>
            </div>

            <!-- Post Notification -->
            <div class="inject-panel">
              <v-text-field
                v-model="notificationInject"
                placeholder="Post Darwin notification name..."
                variant="outlined"
                density="compact"
                hide-details
                class="inject-field"
              >
                <template #append-inner>
                  <v-btn size="x-small" color="purple" variant="flat" @click="postNotification" :loading="injecting.notification" :disabled="!notificationInject.trim()">
                    Post
                  </v-btn>
                </template>
              </v-text-field>
            </div>

            <!-- Event List -->
            <div class="events-list">
              <div v-for="event in darwinEvents" :key="event.id" class="event-item event-notification" @click="toggleExpand(event.id)">
                <div class="event-row">
                  <v-icon size="16" color="purple">mdi-bell-outline</v-icon>
                  <v-chip size="x-small" :color="getNotifOpColor(event.callChain?.[0])" variant="flat" class="op-chip">
                    {{ event.callChain?.[0] || 'observe' }}
                  </v-chip>
                  <span class="event-name">{{ event.name }}</span>
                  <v-spacer />
                  <span class="event-time">{{ formatTime(event.timestamp) }}</span>
                </div>
                <v-expand-transition>
                  <div v-if="expandedEvents.has(event.id)" class="event-detail" @click.stop>
                    <div class="detail-row"><span class="dl">Name:</span><span class="dv monospace">{{ event.name }}</span></div>
                    <div class="detail-row" v-if="event.callChain?.[0]"><span class="dl">Operation:</span><span class="dv">{{ event.callChain[0] }}</span></div>
                    <div class="detail-row" v-if="event.process?.bundleId"><span class="dl">Bundle:</span><span class="dv">{{ event.process.bundleId }}</span></div>
                    <div class="detail-row" v-if="event.process?.pid"><span class="dl">PID:</span><span class="dv">{{ event.process.pid }}</span></div>
                    <div v-if="event.stackTrace?.length" class="stack-section">
                      <span class="dl">Stack Trace:</span>
                      <div class="stack-frames">
                        <div v-for="(frame, i) in event.stackTrace" :key="i" class="stack-frame">
                          <span class="frame-num">{{ i }}</span>{{ frame }}
                        </div>
                      </div>
                    </div>
                  </div>
                </v-expand-transition>
              </div>
              <div v-if="monitors.darwinNotification && darwinEvents.length === 0" class="empty-tab">
                <v-icon size="36" color="grey">mdi-bell-outline</v-icon>
                <p>No Darwin notifications captured yet</p>
              </div>
            </div>
          </div>
        </v-window-item>

        <!-- App Groups Tab -->
        <v-window-item value="appgroups">
          <div class="tab-content">
            <div class="tab-toolbar">
              <v-switch
                v-model="monitors.appGroup"
                density="compact"
                hide-details
                color="green"
                @update:model-value="(v) => toggleMonitor('appGroup', v)"
                :loading="loading.appGroup"
              >
                <template #label>
                  <span class="switch-label">{{ monitors.appGroup ? 'Monitoring' : 'Stopped' }}</span>
                </template>
              </v-switch>
              <v-spacer />
              <div class="tab-actions">
                <v-btn size="small" icon="mdi-refresh" @click="refreshMonitor('appGroup')" :loading="loading.appGroup" />
                <v-btn size="small" icon="mdi-delete" color="error" @click="clearMonitor('appGroup')" />
                <v-btn size="small" icon="mdi-download" @click="exportMonitor('appGroup')" />
              </div>
            </div>

            <!-- App Groups List -->
            <div class="info-panel" v-if="appGroups.length">
              <div class="panel-title">
                <v-icon size="16" class="mr-1">mdi-folder-account-outline</v-icon>
                Registered App Groups
                <v-btn size="x-small" icon="mdi-refresh" variant="text" @click="fetchAppGroups" class="ml-1" />
              </div>
              <div class="groups-list">
                <div v-for="g in appGroups" :key="g.groupId" class="group-item" @click="browseGroup(g.groupId)">
                  <v-icon size="16" color="green" class="mr-2">mdi-folder-outline</v-icon>
                  <span class="group-id">{{ g.groupId }}</span>
                  <span class="group-path" v-if="g.containerPath">{{ g.containerPath }}</span>
                  <v-icon size="14" class="browse-icon">mdi-chevron-right</v-icon>
                </div>
              </div>
            </div>

            <!-- Group Browser -->
            <div class="info-panel" v-if="browsedGroup">
              <div class="panel-title">
                <v-icon size="16" class="mr-1">mdi-folder-open-outline</v-icon>
                {{ browsedGroup.groupId }}
                <v-btn size="x-small" icon="mdi-close" variant="text" @click="browsedGroup = null" class="ml-1" />
              </div>
              <div v-if="browsedGroup.files?.length" class="files-list">
                <div v-for="f in browsedGroup.files" :key="f.name" class="file-item">
                  <v-icon size="14" :color="f.isDirectory ? 'blue' : 'grey'" class="mr-1">
                    {{ f.isDirectory ? 'mdi-folder' : 'mdi-file-outline' }}
                  </v-icon>
                  <span class="file-name">{{ f.name }}</span>
                  <span class="file-size" v-if="!f.isDirectory">{{ formatBytes(f.size) }}</span>
                </div>
              </div>
              <div v-if="browsedGroup.userDefaults && Object.keys(browsedGroup.userDefaults).length" class="defaults-list">
                <div class="panel-subtitle">UserDefaults</div>
                <div v-for="(val, key) in browsedGroup.userDefaults" :key="key" class="defaults-item">
                  <span class="defaults-key">{{ key }}</span>
                  <span class="defaults-value">{{ val }}</span>
                </div>
              </div>
            </div>

            <!-- Event List -->
            <div class="events-list">
              <div v-for="event in appGroupEvents" :key="event.id" class="event-item event-appgroup" @click="toggleExpand(event.id)">
                <div class="event-row">
                  <v-icon size="16" color="green">mdi-folder-account-outline</v-icon>
                  <v-chip size="x-small" :color="getAppGroupOpColor(event.callChain?.[0])" variant="flat" class="op-chip">
                    {{ event.callChain?.[0] || 'access' }}
                  </v-chip>
                  <span class="event-name">{{ event.groupId || 'unknown' }}</span>
                  <span class="event-data-preview" v-if="event.userDefaultsKey">{{ event.userDefaultsKey }}</span>
                  <v-spacer />
                  <span class="event-time">{{ formatTime(event.timestamp) }}</span>
                </div>
                <v-expand-transition>
                  <div v-if="expandedEvents.has(event.id)" class="event-detail" @click.stop>
                    <div class="detail-row"><span class="dl">Group ID:</span><span class="dv monospace">{{ event.groupId }}</span></div>
                    <div class="detail-row" v-if="event.callChain?.[0]"><span class="dl">Operation:</span><span class="dv">{{ event.callChain[0] }}</span></div>
                    <div class="detail-row" v-if="event.filePath"><span class="dl">File Path:</span><span class="dv monospace">{{ event.filePath }}</span></div>
                    <div class="detail-row" v-if="event.userDefaultsKey"><span class="dl">Key:</span><span class="dv monospace">{{ event.userDefaultsKey }}</span></div>
                    <div class="detail-row" v-if="event.value !== undefined"><span class="dl">Value:</span><span class="dv monospace">{{ event.value }}</span></div>
                    <div class="detail-row" v-if="event.process?.bundleId"><span class="dl">Bundle:</span><span class="dv">{{ event.process.bundleId }}</span></div>
                    <div v-if="event.stackTrace?.length" class="stack-section">
                      <span class="dl">Stack Trace:</span>
                      <div class="stack-frames">
                        <div v-for="(frame, i) in event.stackTrace" :key="i" class="stack-frame">
                          <span class="frame-num">{{ i }}</span>{{ frame }}
                        </div>
                      </div>
                    </div>
                  </div>
                </v-expand-transition>
              </div>
              <div v-if="monitors.appGroup && appGroupEvents.length === 0" class="empty-tab">
                <v-icon size="36" color="grey">mdi-folder-account-outline</v-icon>
                <p>No App Group events captured yet</p>
              </div>
            </div>
          </div>
        </v-window-item>
      </v-window>
    </div>
  </div>
</template>

<script setup>
import EventSource from '@/utils/authenticatedEventSource'
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import axios from 'axios'

const props = defineProps({
  agentLoaded: { type: Boolean, default: false },
  sessionId: { type: String, default: 'default' },
  deviceId: { type: String, default: null },
  pid: { type: String, default: null },
  fontSize: { type: Number, default: 14 },
  outputData: { type: [Object, String, null], default: null },
  active: { type: Boolean, default: false }
})

const emit = defineEmits(['toggle', 'show-notification', 'execute-feature'])

const API = import.meta.env.VITE_APP_API_URL

// Tab state
const activeTab = ref('pasteboard')

// Monitor states
const monitors = reactive({
  pasteboard: false,
  darwinNotification: false,
  appGroup: false
})

const loading = reactive({
  pasteboard: false,
  darwinNotification: false,
  appGroup: false
})

const injecting = reactive({
  pasteboard: false,
  notification: false
})

const startingAll = ref(false)
const stoppingAll = ref(false)

// Events
const pasteboardEvents = ref([])
const darwinEvents = ref([])
const appGroupEvents = ref([])
const expandedEvents = ref(new Set())

// Inject inputs
const pasteboardInject = ref('')
const notificationInject = ref('')

// Pasteboard contents
const pasteboardContents = ref(null)

// App Groups
const appGroups = ref([])
const browsedGroup = ref(null)

// EventSources
let eventSources = {}

// RPC command map
const RPC = {
  pasteboard: {
    start: 'startPasteboardMonitor()',
    stop: 'stopPasteboardMonitor()',
    get: 'getPasteboardEvents()',
    clear: 'clearPasteboardEvents()',
    eventType: 'pasteboard'
  },
  darwinNotification: {
    start: 'startDarwinNotificationMonitor()',
    stop: 'stopDarwinNotificationMonitor()',
    get: 'getDarwinNotificationEvents()',
    clear: 'clearDarwinNotificationEvents()',
    eventType: 'darwin_notification'
  },
  appGroup: {
    start: 'startAppGroupMonitor()',
    stop: 'stopAppGroupMonitor()',
    get: 'getAppGroupEvents()',
    clear: 'clearAppGroupEvents()',
    eventType: 'app_group'
  }
}

// Computed
const dynamicFontStyle = computed(() => ({ fontSize: `${props.fontSize}px` }))
const dynamicHeaderFontStyle = computed(() => ({ fontSize: `${props.fontSize + 2}px` }))

const anyMonitorActive = computed(() => monitors.pasteboard || monitors.darwinNotification || monitors.appGroup)
const activeMonitorCount = computed(() => [monitors.pasteboard, monitors.darwinNotification, monitors.appGroup].filter(Boolean).length)

const totalEvents = computed(() => pasteboardEvents.value.length + darwinEvents.value.length + appGroupEvents.value.length)

const statChips = computed(() => [
  { type: 'pasteboard', label: 'Pasteboard', count: pasteboardEvents.value.length, color: 'orange', icon: 'mdi-clipboard-text-outline' },
  { type: 'darwin_notification', label: 'Notifications', count: darwinEvents.value.length, color: 'purple', icon: 'mdi-bell-outline' },
  { type: 'app_group', label: 'App Groups', count: appGroupEvents.value.length, color: 'green', icon: 'mdi-folder-account-outline' }
])

// Event arrays by monitor name
const eventArrays = {
  pasteboard: pasteboardEvents,
  darwinNotification: darwinEvents,
  appGroup: appGroupEvents
}

// Execute RPC command
const rpc = async (command) => {
  const response = await axios.post(`${API}/frida/execute-with-agent`, {
    session_id: props.sessionId,
    command
  })
  if (response.data.status !== 'success') {
    throw new Error(response.data.message || 'RPC call failed')
  }
  return response.data.result || response.data
}

// Toggle individual monitor
const toggleMonitor = async (name, enabled) => {
  if (!props.agentLoaded) {
    emit('show-notification', { message: 'Load the agent first', type: 'error' })
    monitors[name] = false
    return
  }

  loading[name] = true
  try {
    await rpc(enabled ? RPC[name].start : RPC[name].stop)
    monitors[name] = enabled

    if (enabled) {
      setupEventSource(name)
      // Fetch initial data
      await refreshMonitor(name)
    } else {
      closeEventSource(name)
    }

    emit('show-notification', {
      message: `${name} monitor ${enabled ? 'started' : 'stopped'}`,
      type: 'success'
    })
    emit('toggle', anyMonitorActive.value)
  } catch (error) {
    monitors[name] = !enabled
    emit('show-notification', { message: `Error: ${error.message}`, type: 'error' })
  } finally {
    loading[name] = false
  }
}

// Start / Stop all
const startAll = async () => {
  startingAll.value = true
  for (const name of Object.keys(RPC)) {
    if (!monitors[name]) {
      await toggleMonitor(name, true)
    }
  }
  startingAll.value = false
}

const stopAll = async () => {
  stoppingAll.value = true
  for (const name of Object.keys(RPC)) {
    if (monitors[name]) {
      await toggleMonitor(name, false)
    }
  }
  stoppingAll.value = false
}

// Refresh monitor data
const refreshMonitor = async (name) => {
  loading[name] = true
  try {
    const result = await rpc(RPC[name].get)
    if (result?.data?.events) {
      eventArrays[name].value = result.data.events
    }
  } catch (error) {
    console.error(`Error refreshing ${name}:`, error)
  } finally {
    loading[name] = false
  }
}

// Clear monitor data
const clearMonitor = async (name) => {
  try {
    await rpc(RPC[name].clear)
    eventArrays[name].value = []
    emit('show-notification', { message: `${name} events cleared`, type: 'success' })
  } catch (error) {
    emit('show-notification', { message: `Error: ${error.message}`, type: 'error' })
  }
}

// Export monitor data
const exportMonitor = (name) => {
  const data = {
    timestamp: new Date().toISOString(),
    monitor: name,
    events: eventArrays[name].value
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `ios-ipc-${name}-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  emit('show-notification', { message: 'Exported successfully', type: 'success' })
}

// EventSource setup
const setupEventSource = (name) => {
  closeEventSource(name)
  const featureName = name === 'darwinNotification' ? 'darwinNotificationMonitor' : `${name}Monitor`
  const url = `${API}/frida/feature-stream/${props.sessionId}/ios/ipc/${featureName}`

  try {
    const es = new EventSource(url)
    let reconnectAttempts = 0

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'ipc_event' && data.data) {
          processEvent(name, data.data)
        } else if (data.type === 'error') {
          emit('show-notification', { message: data.message, type: 'error' })
        }
      } catch (e) {
        console.error(`EventSource parse error (${name}):`, e)
      }
    }

    es.onopen = () => { reconnectAttempts = 0 }

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED && reconnectAttempts < 3) {
        reconnectAttempts++
        setTimeout(() => {
          if (monitors[name]) setupEventSource(name)
        }, 1000 * reconnectAttempts)
      }
    }

    eventSources[name] = es
  } catch (error) {
    console.error(`EventSource setup error (${name}):`, error)
  }
}

const closeEventSource = (name) => {
  if (eventSources[name]) {
    eventSources[name].close()
    delete eventSources[name]
  }
}

// Process incoming event
const processEvent = (name, eventData) => {
  const arr = eventArrays[name]
  if (!arr) return

  const evt = {
    id: eventData.id || `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: eventData.timestamp || new Date().toISOString(),
    ...eventData
  }

  arr.value.unshift(evt)
  if (arr.value.length > 500) arr.value = arr.value.slice(0, 500)
}

// Pasteboard specific
const fetchPasteboardContents = async () => {
  try {
    const result = await rpc('getPasteboardContents()')
    if (result?.data) pasteboardContents.value = result.data
  } catch (error) {
    console.error('Error fetching pasteboard contents:', error)
  }
}

const injectPasteboard = async () => {
  if (!pasteboardInject.value.trim()) return
  injecting.pasteboard = true
  try {
    await rpc(`setPasteboardString("${pasteboardInject.value.replace(/"/g, '\\"')}")`)
    emit('show-notification', { message: 'String written to pasteboard', type: 'success' })
    pasteboardInject.value = ''
    await fetchPasteboardContents()
  } catch (error) {
    emit('show-notification', { message: `Error: ${error.message}`, type: 'error' })
  } finally {
    injecting.pasteboard = false
  }
}

// Darwin notification specific
const postNotification = async () => {
  if (!notificationInject.value.trim()) return
  injecting.notification = true
  try {
    await rpc(`postDarwinNotification("${notificationInject.value.replace(/"/g, '\\"')}")`)
    emit('show-notification', { message: `Posted: ${notificationInject.value}`, type: 'success' })
    notificationInject.value = ''
  } catch (error) {
    emit('show-notification', { message: `Error: ${error.message}`, type: 'error' })
  } finally {
    injecting.notification = false
  }
}

// App Group specific
const fetchAppGroups = async () => {
  try {
    const result = await rpc('getAppGroups()')
    if (result?.data?.groups) appGroups.value = result.data.groups
  } catch (error) {
    console.error('Error fetching app groups:', error)
  }
}

const browseGroup = async (groupId) => {
  try {
    const result = await rpc(`getAppGroupContents("${groupId}")`)
    if (result?.data) browsedGroup.value = result.data
  } catch (error) {
    emit('show-notification', { message: `Error browsing group: ${error.message}`, type: 'error' })
  }
}

// Helpers
const toggleExpand = (id) => {
  if (expandedEvents.value.has(id)) expandedEvents.value.delete(id)
  else expandedEvents.value.add(id)
}

const formatTime = (ts) => new Date(ts).toLocaleTimeString()

const truncate = (str, len) => str.length > len ? str.slice(0, len) + '...' : str

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const getNotifOpColor = (op) => {
  const colors = { post_cf: 'deep-purple', post_notify: 'purple', post_ns: 'indigo', register_observe: 'blue' }
  return colors[op] || 'grey'
}

const getAppGroupOpColor = (op) => {
  const colors = { container_access: 'teal', userdefaults_init: 'green', userdefaults_write: 'orange' }
  return colors[op] || 'grey'
}

// Lifecycle
onMounted(() => {
  if (props.agentLoaded) {
    fetchPasteboardContents()
    fetchAppGroups()
  }
})

onUnmounted(() => {
  for (const name of Object.keys(eventSources)) {
    closeEventSource(name)
  }
})
</script>

<style scoped>
.ios-ipc-monitor {
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
  padding: 12px 20px;
  color: #9aa0a6;
  font-size: 13px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

/* Stats Bar */
.stats-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-wrap: wrap;
}

.stat-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.stat-type { color: #9aa0a6; }
.stat-count { color: #fff; font-weight: 600; }
.stat-chip.total { margin-left: auto; }

/* Tabs */
.ipc-tabs {
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.ipc-window {
  min-height: 200px;
}

/* Tab Content */
.tab-content {
  display: flex;
  flex-direction: column;
}

.tab-toolbar {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.switch-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}

.tab-actions {
  display: flex;
  gap: 4px;
}

/* Info Panels */
.info-panel {
  margin: 12px 16px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
}

.panel-title {
  display: flex;
  align-items: center;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 10px;
}

.panel-subtitle {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.6);
  margin: 10px 0 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.panel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
}

.panel-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.item-label { font-size: 12px; color: #9aa0a6; white-space: nowrap; }
.item-value { font-size: 12px; color: #fff; }
.item-value.truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px; }

/* Inject Panel */
.inject-panel {
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.inject-field {
  font-size: 13px;
}

/* Events List */
.events-list {
  max-height: 500px;
  overflow-y: auto;
  padding: 8px;
}

.event-item {
  margin-bottom: 4px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.04);
  cursor: pointer;
  transition: all 0.15s ease;
  overflow: hidden;
}

.event-item:hover {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.08);
}

.event-pasteboard { border-left: 3px solid rgba(255, 152, 0, 0.4); }
.event-notification { border-left: 3px solid rgba(156, 39, 176, 0.4); }
.event-appgroup { border-left: 3px solid rgba(76, 175, 80, 0.4); }

.event-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  font-size: 13px;
}

.op-chip {
  font-size: 10px !important;
  height: 20px !important;
  text-transform: lowercase;
}

.event-name {
  color: #fff;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-datatype {
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
}

.event-data-preview {
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.event-time {
  color: rgba(255, 255, 255, 0.35);
  font-size: 11px;
  white-space: nowrap;
}

/* Event Detail */
.event-detail {
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.15);
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.detail-row {
  display: flex;
  gap: 12px;
  margin-bottom: 6px;
  font-size: 12px;
}

.dl { color: #9aa0a6; min-width: 80px; flex-shrink: 0; }
.dv { color: #fff; word-break: break-all; }
.dv.monospace { font-family: 'SF Mono', 'Consolas', monospace; font-size: 11px; }

/* Stack Trace */
.stack-section { margin-top: 8px; }

.stack-frames {
  margin-top: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.stack-frame {
  font-family: 'SF Mono', 'Consolas', monospace;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  padding: 3px 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.frame-num {
  display: inline-block;
  min-width: 24px;
  color: rgba(255, 255, 255, 0.35);
  margin-right: 8px;
}

/* Groups */
.groups-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.group-item {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.group-item:hover { background: rgba(255, 255, 255, 0.05); }

.group-id { color: #fff; font-weight: 500; font-size: 12px; }
.group-path { color: rgba(255, 255, 255, 0.35); font-size: 11px; margin-left: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.browse-icon { margin-left: auto; color: rgba(255, 255, 255, 0.3); }

/* Files List */
.files-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 200px;
  overflow-y: auto;
}

.file-item {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  font-size: 12px;
  color: #fff;
}

.file-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-size { color: rgba(255, 255, 255, 0.4); font-size: 11px; margin-left: 8px; }

/* Defaults List */
.defaults-list {
  margin-top: 8px;
}

.defaults-item {
  display: flex;
  gap: 12px;
  padding: 4px 8px;
  font-size: 11px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.defaults-key {
  color: #9aa0a6;
  min-width: 120px;
  font-family: 'SF Mono', 'Consolas', monospace;
}

.defaults-value {
  color: #fff;
  word-break: break-all;
  font-family: 'SF Mono', 'Consolas', monospace;
}

/* Empty State */
.empty-tab {
  text-align: center;
  padding: 40px 20px;
  color: rgba(255, 255, 255, 0.4);
}

.empty-tab p { margin-top: 8px; font-size: 13px; }

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
