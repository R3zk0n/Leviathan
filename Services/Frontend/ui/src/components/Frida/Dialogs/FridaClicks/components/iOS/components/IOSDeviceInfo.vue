<template>
  <div class="ios-device-info">
    <!-- iOS Device Info -->
    <div class="feature-card">
      <div class="feature-header">
        <div class="feature-info">
          <v-icon size="small" class="mr-2" color="blue">mdi-apple</v-icon>
          <span class="feature-name">iOS Device Information</span>
          <v-chip size="x-small" class="ml-2" color="blue">DEVICE</v-chip>
        </div>
        <div class="feature-actions">
          <v-btn
            size="small"
            @click="executeDeviceInfo"
            :loading="loading"
            color="blue"
            variant="outlined"
            :disabled="!agentLoaded"
          >
            <v-icon size="small" class="mr-1">mdi-cellphone-information</v-icon>
            Get Device Info
          </v-btn>
        </div>
      </div>
      <div class="feature-description">
        Get comprehensive iOS device information including hardware, OS version, battery, and app bundle details
      </div>

      <!-- Beautiful Device Info Cards -->
      <div v-if="parsedInfo" class="device-info-display">
        <div class="info-actions-bar">
          <span class="info-timestamp" v-if="infoTimestamp">
            <v-icon size="12" class="mr-1">mdi-clock-outline</v-icon>
            {{ infoTimestamp }}
          </span>
          <div class="info-actions">
            <v-btn size="x-small" variant="text" @click="executeDeviceInfo" color="blue-lighten-2">
              <v-icon size="small" class="mr-1">mdi-refresh</v-icon>
              Refresh
            </v-btn>
            <v-btn size="x-small" variant="text" @click="copyDeviceInfo" color="blue-lighten-2">
              <v-icon size="small" class="mr-1">mdi-content-copy</v-icon>
              Copy
            </v-btn>
            <v-btn size="x-small" variant="text" @click="clearDeviceInfo" color="grey">
              <v-icon size="small" class="mr-1">mdi-delete-outline</v-icon>
              Clear
            </v-btn>
          </div>
        </div>

        <!-- Device Section -->
        <div class="info-section" v-if="deviceSection.length > 0">
          <div class="section-header">
            <v-icon size="16" color="blue-lighten-1">mdi-cellphone</v-icon>
            <span>Device</span>
          </div>
          <div class="info-grid">
            <div class="info-card" v-for="item in deviceSection" :key="item.label">
              <div class="info-card-icon" :style="{ background: item.bg }">
                <v-icon size="16" :color="item.color">{{ item.icon }}</v-icon>
              </div>
              <div class="info-card-content">
                <span class="info-card-label">{{ item.label }}</span>
                <span class="info-card-value">{{ item.value }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- System Section -->
        <div class="info-section" v-if="systemSection.length > 0">
          <div class="section-header">
            <v-icon size="16" color="teal-lighten-1">mdi-cog</v-icon>
            <span>System</span>
          </div>
          <div class="info-grid">
            <div class="info-card" v-for="item in systemSection" :key="item.label">
              <div class="info-card-icon" :style="{ background: item.bg }">
                <v-icon size="16" :color="item.color">{{ item.icon }}</v-icon>
              </div>
              <div class="info-card-content">
                <span class="info-card-label">{{ item.label }}</span>
                <span class="info-card-value">{{ item.value }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- App Section -->
        <div class="info-section" v-if="appSection.length > 0">
          <div class="section-header">
            <v-icon size="16" color="purple-lighten-1">mdi-application</v-icon>
            <span>Application</span>
          </div>
          <div class="info-grid">
            <div class="info-card" v-for="item in appSection" :key="item.label">
              <div class="info-card-icon" :style="{ background: item.bg }">
                <v-icon size="16" :color="item.color">{{ item.icon }}</v-icon>
              </div>
              <div class="info-card-content">
                <span class="info-card-label">{{ item.label }}</span>
                <span class="info-card-value">{{ item.value }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Hardware Section -->
        <div class="info-section" v-if="hardwareSection.length > 0">
          <div class="section-header">
            <v-icon size="16" color="orange-lighten-1">mdi-chip</v-icon>
            <span>Hardware</span>
          </div>
          <div class="info-grid">
            <div class="info-card" v-for="item in hardwareSection" :key="item.label">
              <div class="info-card-icon" :style="{ background: item.bg }">
                <v-icon size="16" :color="item.color">{{ item.icon }}</v-icon>
              </div>
              <div class="info-card-content">
                <span class="info-card-label">{{ item.label }}</span>
                <span class="info-card-value">{{ item.value }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Raw fallback if no structured data -->
        <pre v-if="!hasStructuredData" class="output-text">{{ formatOutput(deviceInfoOutput) }}</pre>
      </div>
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
            <v-icon size="small" class="mr-1">mdi-bug</v-icon>
            Get Version
          </v-btn>
        </div>
      </div>
      <div class="feature-description">
        Get current Frida version and runtime information
      </div>

      <div v-if="fridaVersionOutput" class="feature-output">
        <div class="version-display">
          <div class="version-content">
            <div class="version-icon-wrapper">
              <v-icon color="cyan" size="24">mdi-bug</v-icon>
            </div>
            <div class="version-text">
              <span class="version-label">Frida Runtime</span>
              <span class="version-number">v{{ fridaVersionOutput }}</span>
            </div>
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
import { ref, computed, inject } from 'vue'

const props = defineProps({
  sessionId: { type: String, required: true },
  deviceId: { type: String, required: true },
  pid: { type: Number, required: true },
  agentLoaded: { type: Boolean, required: true },
  features: { type: Object, default: () => ({}) },
  featureOutputs: { type: Object, default: () => ({}) },
  loadingFeatures: { type: Object, default: () => ({}) },
  fontSize: { type: Number, default: 14 }
})

const emit = defineEmits(['execute-feature', 'feature-toggle', 'show-notification'])

const showNotification = inject('showNotification', (message, type = 'info') => {
  emit('show-notification', { message, type })
})

// Computed
const deviceInfoOutput = computed(() => props.featureOutputs?.iOSDeviceInfo)
const fridaVersionOutput = computed(() => props.featureOutputs?.fridaVersion)
const loading = computed(() => props.loadingFeatures?.iOSDeviceInfo || false)
const fridaLoading = computed(() => props.loadingFeatures?.fridaVersion || false)

// Extract the actual data from the agent response
// Store saves response.data.result which is {success, data, timestamp}
const parsedInfo = computed(() => {
  try {
    const raw = deviceInfoOutput.value
    if (!raw) return null

    let data = raw
    // Handle the agent response wrapper: {success: true, data: {...}, timestamp: "..."}
    if (typeof raw === 'object' && raw !== null) {
      if (raw.data && typeof raw.data === 'object') {
        data = raw.data
      } else if (raw.result && typeof raw.result === 'object') {
        data = raw.result
        if (data.data) data = data.data
      }
    } else if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw)
        data = parsed.data || parsed.result || parsed
      } catch { return null }
    }

    return data
  } catch (e) {
    console.warn('Error parsing iOS device info:', e)
    return null
  }
})

const infoTimestamp = computed(() => {
  const raw = deviceInfoOutput.value
  if (!raw || typeof raw !== 'object') return null
  if (raw.timestamp) {
    try {
      return new Date(raw.timestamp).toLocaleTimeString()
    } catch { return null }
  }
  return null
})

// Structured info sections
const deviceSection = computed(() => {
  const d = parsedInfo.value
  if (!d) return []
  const items = []
  if (d.name) items.push({ label: 'Device Name', value: d.name, icon: 'mdi-cellphone', color: 'blue-lighten-2', bg: 'rgba(33, 150, 243, 0.15)' })
  if (d.model) items.push({ label: 'Model', value: d.model, icon: 'mdi-tablet-cellphone', color: 'blue-lighten-1', bg: 'rgba(33, 150, 243, 0.12)' })
  if (d.localizedModel) items.push({ label: 'Localized Model', value: d.localizedModel, icon: 'mdi-translate', color: 'indigo-lighten-2', bg: 'rgba(63, 81, 181, 0.12)' })
  if (d.identifierForVendor) items.push({ label: 'Vendor ID', value: d.identifierForVendor, icon: 'mdi-identifier', color: 'blue-grey-lighten-1', bg: 'rgba(96, 125, 139, 0.12)' })
  if (d.orientation !== undefined) items.push({ label: 'Orientation', value: orientationLabel(d.orientation), icon: 'mdi-screen-rotation', color: 'light-blue-lighten-2', bg: 'rgba(3, 169, 244, 0.12)' })
  return items
})

const systemSection = computed(() => {
  const d = parsedInfo.value
  if (!d) return []
  const items = []
  const osVersion = d.systemName && d.systemVersion ? `${d.systemName} ${d.systemVersion}` : d.systemVersion || d.systemName
  if (osVersion) items.push({ label: 'Operating System', value: osVersion, icon: 'mdi-apple', color: 'teal-lighten-2', bg: 'rgba(0, 150, 136, 0.15)' })
  return items
})

const appSection = computed(() => {
  const d = parsedInfo.value
  if (!d) return []
  const items = []
  if (d.bundleIdentifier) items.push({ label: 'Bundle ID', value: d.bundleIdentifier, icon: 'mdi-package-variant', color: 'purple-lighten-2', bg: 'rgba(156, 39, 176, 0.12)' })
  if (d.appVersion) {
    const ver = d.buildVersion ? `${d.appVersion} (${d.buildVersion})` : d.appVersion
    items.push({ label: 'App Version', value: ver, icon: 'mdi-tag-outline', color: 'deep-purple-lighten-2', bg: 'rgba(103, 58, 183, 0.12)' })
  }
  return items
})

const hardwareSection = computed(() => {
  const d = parsedInfo.value
  if (!d) return []
  const items = []
  if (d.processorCount) items.push({ label: 'CPU Cores', value: `${d.processorCount} cores`, icon: 'mdi-chip', color: 'orange-lighten-1', bg: 'rgba(255, 152, 0, 0.12)' })
  if (d.physicalMemory) {
    const gb = (d.physicalMemory / (1024 * 1024 * 1024)).toFixed(1)
    items.push({ label: 'Memory', value: `${gb} GB`, icon: 'mdi-memory', color: 'amber-lighten-1', bg: 'rgba(255, 193, 7, 0.12)' })
  }
  if (d.batteryLevel !== undefined) {
    const pct = Math.round(d.batteryLevel * 100)
    const batteryIcon = pct > 80 ? 'mdi-battery-high' : pct > 30 ? 'mdi-battery-medium' : 'mdi-battery-low'
    const batteryColor = pct > 80 ? 'green-lighten-1' : pct > 30 ? 'yellow-lighten-1' : 'red-lighten-1'
    items.push({ label: 'Battery', value: `${pct}%`, icon: batteryIcon, color: batteryColor, bg: pct > 80 ? 'rgba(76, 175, 80, 0.12)' : pct > 30 ? 'rgba(255, 235, 59, 0.12)' : 'rgba(244, 67, 54, 0.12)' })
  }
  if (d.batteryState !== undefined) {
    const states = { '0': 'Unknown', '1': 'Unplugged', '2': 'Charging', '3': 'Full' }
    items.push({ label: 'Battery State', value: states[String(d.batteryState)] || d.batteryState, icon: 'mdi-battery-charging', color: 'light-green-lighten-1', bg: 'rgba(139, 195, 74, 0.12)' })
  }
  return items
})

const hasStructuredData = computed(() => {
  return deviceSection.value.length > 0 || systemSection.value.length > 0 ||
    appSection.value.length > 0 || hardwareSection.value.length > 0
})

// Helpers
const orientationLabel = (val) => {
  const orientations = { '0': 'Unknown', '1': 'Portrait', '2': 'Portrait (Upside Down)', '3': 'Landscape Left', '4': 'Landscape Right', '5': 'Face Up', '6': 'Face Down' }
  return orientations[String(val)] || `Unknown (${val})`
}

// Methods
const executeDeviceInfo = () => {
  emit('execute-feature', {
    feature: 'iOSDeviceInfo',
    command: 'getiOSDeviceInfo()'
  })
}

const executeFridaVersion = () => {
  emit('execute-feature', {
    feature: 'fridaVersion',
    command: 'Frida.version'
  })
}

const clearDeviceInfo = () => {
  emit('execute-feature', {
    feature: 'iOSDeviceInfo',
    action: 'clear'
  })
  showNotification('Device info cleared', 'info')
}

const clearFridaVersion = () => {
  emit('execute-feature', {
    feature: 'fridaVersion',
    action: 'clear'
  })
  showNotification('Frida version cleared', 'info')
}

const copyDeviceInfo = async () => {
  try {
    const data = parsedInfo.value
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    showNotification('Copied to clipboard', 'success')
  } catch (error) {
    console.error('Failed to copy:', error)
    showNotification('Failed to copy to clipboard', 'error')
  }
}

const formatOutput = (data) => {
  if (typeof data === 'string') return data
  return JSON.stringify(data, null, 2)
}
</script>

<style scoped>
.ios-device-info {
  padding: 8px;
  color: #ffffff;
}

.feature-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
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
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  margin-bottom: 12px;
}

.feature-actions .v-btn {
  text-transform: none;
}

/* Device Info Display */
.device-info-display {
  margin-top: 12px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(0, 0, 0, 0.2);
}

.info-actions-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.info-timestamp {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  display: flex;
  align-items: center;
}

.info-actions {
  display: flex;
  gap: 2px;
}

.info-section {
  padding: 12px 14px 8px;
}

.info-section + .info-section {
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: rgba(255, 255, 255, 0.5);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px;
}

.info-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.2s ease;
}

.info-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.1);
  transform: translateY(-1px);
}

.info-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  flex-shrink: 0;
}

.info-card-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.info-card-label {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.45);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  line-height: 1.2;
}

.info-card-value {
  font-size: 13px;
  font-weight: 500;
  color: #ffffff;
  word-break: break-all;
  line-height: 1.4;
  margin-top: 2px;
}

.output-text {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  padding: 14px;
}

/* Frida Version */
.feature-output {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  margin-top: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  overflow: hidden;
}

.version-display {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: linear-gradient(135deg, rgba(0, 188, 212, 0.08), rgba(0, 150, 136, 0.08));
  border: 1px solid rgba(0, 188, 212, 0.15);
}

.version-content {
  display: flex;
  align-items: center;
  gap: 14px;
}

.version-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(0, 188, 212, 0.15);
}

.version-text {
  display: flex;
  flex-direction: column;
}

.version-label {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.version-number {
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
}

.version-clear-btn {
  opacity: 0.6;
  transition: all 0.2s;
}

.version-clear-btn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
}

@media (max-width: 500px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
