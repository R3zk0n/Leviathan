<template>
  <div class="android-network-monitor">
    <div class="feature-card">
      <div class="feature-header">
        <div class="feature-info">
          <v-icon size="small" class="mr-2" :color="isMonitoring ? 'blue' : 'grey'">
            {{ isMonitoring ? 'mdi-record-circle' : 'mdi-record-circle-outline' }}
          </v-icon>
          <span class="feature-name">HTTP/HTTPS Security Monitor</span>
          <v-chip size="x-small" class="ml-2" :color="isMonitoring ? 'blue' : 'grey'">
            {{ isMonitoring ? 'MONITORING' : 'INACTIVE' }}
          </v-chip>
          <v-chip
            v-if="isMonitoring && stats.totalRequests > 0"
            size="x-small"
            class="ml-2"
            color="green"
          >
            {{ stats.totalRequests }} requests
          </v-chip>
          <v-chip
            v-if="isMonitoring && securityStats.highRisk > 0"
            size="x-small"
            class="ml-2"
            color="error"
          >
            {{ securityStats.highRisk }} HIGH RISK
          </v-chip>
        </div>
        <v-switch
          v-model="isMonitoring"
          density="compact"
          hide-details
          @update:model-value="toggleMonitoring"
          color="blue"
        />
      </div>

      <div class="feature-description">
        Advanced security monitoring for Android HTTP/HTTPS requests with real-time threat detection and library identification
      </div>

      <!-- Control Panel -->
      <div v-if="isMonitoring" class="control-panel">
        <div class="filter-controls">
          <v-select
            v-model="filterLevel"
            :items="securityLevels"
            label="Security Level"
            density="compact"
            hide-details
            variant="outlined"
          />
        </div>

        <div class="action-buttons">
          <v-btn size="small" icon="mdi-refresh" @click="refreshRequests" :loading="refreshing" />
          <v-btn size="small" icon="mdi-delete" @click="clearRequests" color="error" />
          <v-btn size="small" icon="mdi-download" @click="exportRequests" />
          <v-btn size="small" icon="mdi-pause" v-if="!isPaused" @click="pauseMonitoring" />
          <v-btn size="small" icon="mdi-play" v-else @click="resumeMonitoring" color="green" />
        </div>
      </div>

      <!-- Stats Display -->
      <div v-if="isMonitoring" class="stats-grid">
        <div class="stat-card">
          <v-icon size="small" color="info">mdi-web</v-icon>
          <div class="stat-content">
            <div class="stat-value">{{ stats.totalRequests }}</div>
            <div class="stat-label">Total Requests</div>
          </div>
        </div>
        <div class="stat-card">
          <v-icon size="small" color="success">mdi-lock</v-icon>
          <div class="stat-content">
            <div class="stat-value">{{ stats.httpsRequests }}</div>
            <div class="stat-label">HTTPS</div>
          </div>
        </div>
        <div class="stat-card">
          <v-icon size="small" color="warning">mdi-lock-open</v-icon>
          <div class="stat-content">
            <div class="stat-value">{{ stats.httpRequests }}</div>
            <div class="stat-label">HTTP</div>
          </div>
        </div>
        <div class="stat-card">
          <v-icon size="small" color="error">mdi-alert</v-icon>
          <div class="stat-content">
            <div class="stat-value">{{ securityStats.highRisk }}</div>
            <div class="stat-label">High Risk</div>
          </div>
        </div>
      </div>

      <!-- Requests List -->
      <div v-if="isMonitoring && filteredRequests.length > 0" class="requests-container">
        <div class="requests-header">
          <span>Network Requests</span>
          <v-chip size="x-small" color="info">{{ filteredRequests.length }} / {{ maxRequests }}</v-chip>
        </div>

        <div class="requests-list">
          <div
            v-for="request in filteredRequests"
            :key="request.id"
            class="request-item"
            :class="`security-${request.securityLevel}`"
          >
            <div class="request-header">
              <div class="request-method-url">
                <v-chip size="x-small" :color="getMethodColor(request.method)">
                  {{ request.method }}
                </v-chip>
                <span class="request-url">{{ truncateUrl(request.url) }}</span>
              </div>
              <div class="request-meta">
                <v-chip v-if="request.library" size="x-small" color="purple">
                  {{ request.library }}
                </v-chip>
                <span class="request-time">{{ formatTime(request.timestamp) }}</span>
              </div>
            </div>

            <div v-if="request.securityLevel !== 'safe'" class="security-warnings">
              <v-chip
                v-for="warning in request.securityWarnings"
                :key="warning"
                size="x-small"
                :color="getWarningColor(request.securityLevel)"
                class="mr-1"
              >
                {{ warning }}
              </v-chip>
            </div>

            <div v-if="expandedRequests.includes(request.id)" class="request-details">
              <div class="detail-section">
                <div class="detail-label">Headers:</div>
                <pre>{{ JSON.stringify(request.headers, null, 2) }}</pre>
              </div>
              <div v-if="request.body" class="detail-section">
                <div class="detail-label">Body:</div>
                <pre>{{ request.body }}</pre>
              </div>
              <div v-if="request.response" class="detail-section">
                <div class="detail-label">Response:</div>
                <pre>{{ JSON.stringify(request.response, null, 2) }}</pre>
              </div>
            </div>

            <v-btn
              size="x-small"
              variant="text"
              @click="toggleRequestDetails(request.id)"
            >
              {{ expandedRequests.includes(request.id) ? 'Less' : 'More' }}
            </v-btn>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="isMonitoring" class="empty-state">
        <v-icon size="48" color="grey">mdi-web</v-icon>
        <p>No network requests captured yet</p>
        <p class="text-caption">HTTP/HTTPS requests will appear here as they occur</p>
      </div>
    </div>

    <!-- SSL Pinning Bypass -->
    <div class="feature-card mt-4">
      <div class="feature-header">
        <div class="feature-info">
          <v-icon size="small" class="mr-2" :color="sslBypassEnabled ? 'orange' : 'grey'">
            {{ sslBypassEnabled ? 'mdi-lock-open' : 'mdi-lock' }}
          </v-icon>
          <span class="feature-name">SSL Pinning Bypass</span>
          <v-chip size="x-small" class="ml-2" :color="sslBypassEnabled ? 'orange' : 'grey'">
            {{ sslBypassEnabled ? 'ACTIVE' : 'INACTIVE' }}
          </v-chip>
        </div>
        <v-switch
          v-model="sslBypassEnabled"
          density="compact"
          hide-details
          @update:model-value="toggleSSLBypass"
          color="orange"
        />
      </div>

      <div class="feature-description">
        Bypass SSL certificate pinning to inspect HTTPS traffic
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
const sslBypassEnabled = ref(false)
const isPaused = ref(false)
const refreshing = ref(false)
const requests = ref([])
const expandedRequests = ref([])
const filterLevel = ref('all')
const maxRequests = ref(100)
let refreshInterval = null

// Security levels
const securityLevels = [
  { title: 'All', value: 'all' },
  { title: 'Safe Only', value: 'safe' },
  { title: 'Medium Risk', value: 'medium' },
  { title: 'High Risk', value: 'high' }
]

// Stats computed from requests
const stats = computed(() => {
  const total = requests.value.length
  const https = requests.value.filter(r => r.url.startsWith('https://')).length
  const http = total - https

  return {
    totalRequests: total,
    httpsRequests: https,
    httpRequests: http
  }
})

const securityStats = computed(() => {
  const byLevel = requests.value.reduce((acc, req) => {
    acc[req.securityLevel] = (acc[req.securityLevel] || 0) + 1
    return acc
  }, {})

  return {
    safe: byLevel.safe || 0,
    medium: byLevel.medium || 0,
    highRisk: byLevel.high || 0
  }
})

// Filtered requests based on security level
const filteredRequests = computed(() => {
  let filtered = requests.value

  if (filterLevel.value !== 'all') {
    filtered = filtered.filter(r => r.securityLevel === filterLevel.value)
  }

  return filtered.slice(0, maxRequests.value)
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
      command: 'startNetworkMonitoring()',
    })

    if (response.data.status === 'success') {
      showNotification('Network monitoring started', 'success')
      // Set up refresh interval
      refreshInterval = setInterval(refreshRequests, 3000)
    } else {
      isMonitoring.value = false
      showNotification(`Failed to start network monitoring: ${response.data.message}`, 'error')
    }
  } catch (error) {
    isMonitoring.value = false
    console.error('Error starting network monitoring:', error)
    showNotification(`Error: ${error.message}`, 'error')
  }
}

const stopMonitoring = async () => {
  try {
    const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
      session_id: props.sessionId,
      command: 'stopNetworkMonitoring()',
    })

    if (response.data.status === 'success') {
      showNotification('Network monitoring stopped', 'info')
      if (refreshInterval) {
        clearInterval(refreshInterval)
        refreshInterval = null
      }
    } else {
      showNotification(`Failed to stop network monitoring: ${response.data.message}`, 'error')
    }
  } catch (error) {
    console.error('Error stopping network monitoring:', error)
    showNotification(`Error: ${error.message}`, 'error')
  }
}

const toggleSSLBypass = async (value) => {
  try {
    const command = value ? 'enableSSLPinningBypass()' : 'disableSSLPinningBypass()'
    const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
      session_id: props.sessionId,
      command,
    })

    if (response.data.status === 'success') {
      showNotification(`SSL pinning bypass ${value ? 'enabled' : 'disabled'}`, value ? 'warning' : 'info')
    } else {
      sslBypassEnabled.value = !value
      showNotification(`Failed to ${value ? 'enable' : 'disable'} SSL bypass: ${response.data.message}`, 'error')
    }
  } catch (error) {
    sslBypassEnabled.value = !value
    console.error('Error toggling SSL bypass:', error)
    showNotification(`Error: ${error.message}`, 'error')
  }
}

const refreshRequests = async () => {
  if (!isMonitoring.value || isPaused.value) return

  refreshing.value = true
  try {
    const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
      session_id: props.sessionId,
      command: 'getNetworkRequests()',
    })

    if (response.data.status === 'success' && response.data.result) {
      requests.value = analyzeSecurityRisks(response.data.result.requests || [])
    }
  } catch (error) {
    console.error('Error refreshing network requests:', error)
  } finally {
    refreshing.value = false
  }
}

const analyzeSecurityRisks = (requests) => {
  return requests.map(req => {
    const warnings = []
    let securityLevel = 'safe'

    // Check for HTTP
    if (req.url.startsWith('http://')) {
      warnings.push('Unencrypted HTTP')
      securityLevel = 'high'
    }

    // Check for sensitive data in URL
    if (req.url.includes('password=') || req.url.includes('token=') || req.url.includes('api_key=')) {
      warnings.push('Sensitive data in URL')
      securityLevel = 'high'
    }

    // Check for missing security headers
    const headers = req.headers || {}
    if (!headers['X-Content-Type-Options']) {
      warnings.push('Missing X-Content-Type-Options')
      if (securityLevel === 'safe') securityLevel = 'medium'
    }

    return {
      ...req,
      securityLevel,
      securityWarnings: warnings
    }
  })
}

const clearRequests = () => {
  requests.value = []
  expandedRequests.value = []
  showNotification('Network requests cleared', 'info')
}

const exportRequests = () => {
  const data = JSON.stringify(requests.value, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `network-requests-${new Date().toISOString()}.json`
  a.click()
  URL.revokeObjectURL(url)
  showNotification('Network requests exported', 'success')
}

const pauseMonitoring = () => {
  isPaused.value = true
  showNotification('Monitoring paused', 'info')
}

const resumeMonitoring = () => {
  isPaused.value = false
  showNotification('Monitoring resumed', 'info')
  refreshRequests()
}

const toggleRequestDetails = (requestId) => {
  const index = expandedRequests.value.indexOf(requestId)
  if (index > -1) {
    expandedRequests.value.splice(index, 1)
  } else {
    expandedRequests.value.push(requestId)
  }
}

const truncateUrl = (url) => {
  const maxLength = 60
  if (url.length <= maxLength) return url
  return url.substring(0, maxLength) + '...'
}

const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString()
}

const getMethodColor = (method) => {
  const colors = {
    GET: 'green',
    POST: 'blue',
    PUT: 'orange',
    DELETE: 'red',
    PATCH: 'purple'
  }
  return colors[method] || 'grey'
}

const getWarningColor = (level) => {
  const colors = {
    safe: 'success',
    medium: 'warning',
    high: 'error'
  }
  return colors[level] || 'grey'
}

// Cleanup
onUnmounted(() => {
  if (isMonitoring.value) {
    stopMonitoring()
  }
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>

<style scoped>
.android-network-monitor {
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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
}

.stat-content {
  text-align: center;
  flex: 1;
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
}

.stat-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
}

.requests-container {
  margin-top: 16px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  overflow: hidden;
}

.requests-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.requests-list {
  max-height: 500px;
  overflow-y: auto;
}

.request-item {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: background 0.2s ease;
}

.request-item:hover {
  background: rgba(255, 255, 255, 0.02);
}

.request-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.request-method-url {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.request-url {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.request-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.request-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.security-warnings {
  margin: 8px 0;
}

.request-details {
  margin-top: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
}

.detail-section {
  margin-bottom: 12px;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 4px;
}

.detail-section pre {
  margin: 0;
  font-size: 11px;
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

/* Security level borders */
.security-safe { border-left: 3px solid #4CAF50; }
.security-medium { border-left: 3px solid #FF9800; }
.security-high { border-left: 3px solid #F44336; }
</style>
