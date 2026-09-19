<template>
  <div v-if="outputData && !platformMismatch" class="frida-version-display">
    <!-- Modern Header -->
    <div class="version-header">
      <div class="header-left">
        <div class="header-icon-wrapper">
          <v-icon size="24" :color="platformColor">{{ platformIcon }}</v-icon>
        </div>
        <div class="header-text">
          <h3 class="header-title">Frida Runtime Information</h3>
          <p class="header-subtitle">{{ platformName }} Environment</p>
        </div>
      </div>
      <div class="header-actions">
        <v-btn
          icon
          size="small"
          variant="text"
          @click="handleCopy"
          class="action-btn"
        >
          <v-icon size="18">mdi-content-copy</v-icon>
          <v-tooltip activator="parent" location="bottom">Copy raw data</v-tooltip>
        </v-btn>
        <v-btn
          icon
          size="small"
          variant="text"
          @click="handleClear"
          class="action-btn"
        >
          <v-icon size="18">mdi-close</v-icon>
          <v-tooltip activator="parent" location="bottom">Clear</v-tooltip>
        </v-btn>
      </div>
    </div>

    <!-- Info Cards Grid -->
    <div class="info-cards-grid">
      <div
        v-for="(card, index) in infoCards"
        :key="card.id"
        :class="['info-card', `${card.id}-card`, { active: card.active }]"
        :style="{ animationDelay: `${index * 0.05}s` }"
      >
        <div class="card-glow"></div>
        <div class="card-content">
          <div class="card-icon-wrapper">
            <v-icon size="28" :color="card.color">{{ card.icon }}</v-icon>
            <div v-if="card.pulse" class="pulse-ring"></div>
          </div>
          <div class="card-info">
            <span class="card-label">{{ card.label }}</span>
            <span class="card-value" :class="card.valueClass">{{ card.value }}</span>
            <span class="card-detail">{{ card.detail }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Refresh Button -->
    <div class="version-footer">
      <v-btn
        variant="flat"
        :color="buttonColor"
        @click="handleRefresh"
        :loading="loading"
        class="refresh-btn"
      >
        <v-icon class="mr-2">mdi-refresh</v-icon>
        Refresh Information
      </v-btn>
    </div>
  </div>

  <!-- Show error message when platform mismatch -->
  <div v-else-if="outputData && platformMismatch" class="platform-mismatch-error">
    <v-alert type="error" variant="outlined" prominent>
      <v-alert-title>Platform Mismatch</v-alert-title>
      <div>
        Cannot execute {{ platformName }} features on {{ actualPlatformName }} device.
        <br>
        <span class="text-grey">The Frida agent is connected to a <strong>{{ actualPlatformName }}</strong> device.</span>
      </div>
    </v-alert>
  </div>
</template>

<script setup>
import { computed } from 'vue'

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
    default: 'frida'
  },
  feature: {
    type: String,
    default: 'fridaVersion'
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['copy', 'clear', 'refresh'])

// Platform configuration
const platformConfig = {
  ios: {
    name: 'iOS',
    icon: 'mdi-apple',
    color: 'blue',
    buttonColor: 'cyan'
  },
  android: {
    name: 'Android',
    icon: 'mdi-android',
    color: 'green',
    buttonColor: 'green'
  }
}

const config = computed(() => platformConfig[props.platform])
const platformName = computed(() => config.value.name)
const platformIcon = computed(() => config.value.icon)
const platformColor = computed(() => config.value.color)
const buttonColor = computed(() => config.value.buttonColor)

// Parse the output data
const parsedData = computed(() => {
  if (!props.outputData) return {}

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

    console.log('Final parsed data:', data) // Debug log
    return data
  } catch (error) {
    console.error('Error parsing Frida version data:', error)
    return {}
  }
})

// Platform mismatch detection
const platformMismatch = computed(() => {
  if (!parsedData.value.platform) return false

  const actualPlatform = parsedData.value.platform.toLowerCase()

  // For iOS, we expect 'darwin' platform
  // For Android, we expect 'linux' or 'android' platform
  if (props.platform === 'ios') {
    return actualPlatform !== 'darwin'
  } else if (props.platform === 'android') {
    return actualPlatform !== 'linux' && actualPlatform !== 'android'
  }

  return false
})

const actualPlatformName = computed(() => {
  const platform = parsedData.value.platform?.toLowerCase()
  if (platform === 'linux' || platform === 'android') return 'Android'
  if (platform === 'darwin') return 'iOS'
  if (platform === 'windows') return 'Windows'
  return platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : 'Unknown'
})

// Generate info cards
const infoCards = computed(() => {
  const data = parsedData.value

  return [
    {
      id: 'version',
      icon: 'mdi-numeric',
      color: 'cyan',
      label: 'Version',
      value: data.version || 'N/A',
      detail: 'Core Framework'
    },
    {
      id: 'runtime',
      icon: 'mdi-language-javascript',
      color: 'purple',
      label: 'Runtime',
      value: data.runtime || 'N/A',
      detail: 'JS Engine'
    },
    {
      id: 'arch',
      icon: 'mdi-cpu-64-bit',
      color: 'blue',
      label: 'Architecture',
      value: data.arch || 'N/A',
      detail: `${(data.pointerSize || 8) * 8}-bit System`
    },
    {
      id: 'platform',
      icon: actualPlatformName.value === 'Android' ? 'mdi-android' : actualPlatformName.value === 'iOS' ? 'mdi-apple' : 'mdi-desktop-classic',
      color: actualPlatformName.value === 'Android' ? 'green' : actualPlatformName.value === 'iOS' ? 'blue' : 'grey',
      label: 'Platform',
      value: actualPlatformName.value,
      detail: 'Operating System'
    },
    {
      id: 'memory',
      icon: 'mdi-memory',
      color: 'orange',
      label: 'Page Size',
      value: formatBytes(data.pageSize || 4096),
      detail: 'Memory Unit'
    },
    {
      id: 'status',
      icon: 'mdi-check-circle',
      color: 'success',
      label: 'Status',
      value: 'Active',
      detail: 'Ready',
      valueClass: 'success',
      active: true,
      pulse: true
    }
  ]
})

// Event handlers
const handleCopy = () => {
  emit('copy', props.outputData)
}

const handleClear = () => {
  emit('clear', props.platform, props.category, props.feature)
}

const handleRefresh = () => {
  emit('refresh', props.platform, props.category, props.feature)
}

// Utility functions
function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>

<style scoped>
.frida-version-display {
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
.version-header {
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
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.08);
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
  gap: 4px;
}

.action-btn {
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.05);
}

/* Info Cards Grid */
.info-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  padding: 20px;
  background: linear-gradient(180deg, #0f1013 0%, #0a0b0e 100%);
}

/* Info Card Styles */
.info-card {
  position: relative;
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 20px;
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

.info-card:hover {
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
    rgba(255, 255, 255, 0.2),
    transparent
  );
  opacity: 0;
  transition: opacity 0.3s ease;
}

.info-card:hover .card-glow {
  opacity: 1;
}

.card-content {
  position: relative;
  z-index: 1;
}

.card-icon-wrapper {
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  position: relative;
}

.pulse-ring {
  position: absolute;
  inset: -4px;
  border: 2px solid rgba(76, 175, 80, 0.4);
  border-radius: 12px;
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

.card-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-label {
  font-size: 11px;
  color: #9aa0a6;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.card-value {
  font-size: 20px;
  font-weight: 700;
  color: #ffffff;
  font-family: 'Inter', 'SF Pro Display', sans-serif;
}

.card-value.success {
  color: #4ade80;
}

.card-detail {
  font-size: 12px;
  color: #5f6368;
  font-weight: 500;
}

/* Footer */
.version-footer {
  padding: 16px 20px;
  background: linear-gradient(135deg, #13151a 0%, #1a1d21 100%);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0 0 12px 12px;
  display: flex;
  justify-content: center;
}

.refresh-btn {
  font-weight: 500;
  letter-spacing: 0.3px;
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

/* Responsive */
@media (max-width: 768px) {
  .info-cards-grid {
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 16px;
  }

  .version-header {
    padding: 16px;
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }

  .header-actions {
    align-self: flex-end;
  }
}
</style>
