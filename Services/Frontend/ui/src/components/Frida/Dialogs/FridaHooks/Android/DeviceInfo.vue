<template>
  <div v-if="outputData && !platformMismatch" class="android-device-display">
    <!-- Modern Header -->
    <div class="device-header">
      <div class="header-left">
        <div class="header-icon-wrapper">
          <v-icon size="24" color="green">mdi-android</v-icon>
        </div>
        <div class="header-text">
          <h3 class="header-title">Android Device Information</h3>
          <p class="header-subtitle">{{ deviceModel }} • Android {{ androidVersion }}</p>
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
          <v-tooltip activator="parent" location="bottom">Copy device info</v-tooltip>
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
        v-for="(card, index) in deviceCards"
        :key="card.id"
        :class="['info-card', `${card.id}-card`, { highlight: card.highlight }]"
        :style="{ animationDelay: `${index * 0.05}s` }"
      >
        <div class="card-glow"></div>
        <div class="card-content">
          <div class="card-icon-wrapper">
            <v-icon size="28" :color="card.color">{{ card.icon }}</v-icon>
          </div>
          <div class="card-info">
            <span class="card-label">{{ card.label }}</span>
            <span class="card-value" :class="card.valueClass">{{ card.value }}</span>
            <span class="card-detail">{{ card.detail }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Detailed Info Section -->
    <div class="details-section">
      <h4 class="section-title">Build Information</h4>
      <div class="details-grid">
        <div v-for="detail in buildDetails" :key="detail.key" class="detail-item">
          <span class="detail-label">{{ detail.label }}</span>
          <span class="detail-value">{{ detail.value }}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Show error message when platform mismatch -->
  <div v-else-if="outputData && platformMismatch" class="platform-mismatch-error">
    <v-alert type="error" variant="outlined" prominent>
      <v-alert-title>Platform Mismatch</v-alert-title>
      <div>
        Cannot get Android device info from an iOS device.
        <br>
        <span class="text-grey">Please connect to an Android device to use this feature.</span>
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
    default: 'deviceInfo'
  },
  feature: {
    type: String,
    default: 'androidVersion'
  },
  loading: {
    type: Boolean,
    default: false
  },
  showFullData: {
    type: Boolean,
    default: true // Default to true for security research
  }
})

const emit = defineEmits(['copy', 'clear', 'refresh'])

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
      }
    } else if (data.success && data.data) {
      data = data.data
    } else if (data.data) {
      data = data.data
    }

    console.log('Android device data:', data)
    return data
  } catch (error) {
    console.error('Error parsing Android device data:', error)
    return {}
  }
})

// Platform mismatch detection
const platformMismatch = computed(() => {
  // This component is for Android only
  return props.platform !== 'android'
})

// Computed properties for header
const deviceModel = computed(() => parsedData.value.model || 'Unknown Device')
const androidVersion = computed(() => parsedData.value.version || 'Unknown')

// Generate device info cards
const deviceCards = computed(() => {
  const data = parsedData.value

  return [
    {
      id: 'version',
      icon: 'mdi-android',
      color: 'green',
      label: 'Android Version',
      value: data.version || 'N/A',
      detail: `API Level ${data.apiLevel || 'N/A'}`,
      highlight: true
    },
    {
      id: 'manufacturer',
      icon: 'mdi-factory',
      color: 'blue',
      label: 'Manufacturer',
      value: formatManufacturer(data.manufacturer),
      detail: data.brand || 'Unknown Brand'
    },
    {
      id: 'model',
      icon: 'mdi-cellphone',
      color: 'purple',
      label: 'Model',
      value: data.model || 'N/A',
      detail: data.device || 'Unknown Device'
    },
    {
      id: 'hardware',
      icon: 'mdi-chip',
      color: 'orange',
      label: 'Hardware',
      value: data.hardware || 'N/A',
      detail: data.board || 'Unknown Board'
    },
    {
      id: 'serial',
      icon: 'mdi-barcode',
      color: 'cyan',
      label: 'Serial Number',
      value: data.serialNumber || 'N/A',
      detail: 'Device Identifier'
    },
    {
      id: 'package',
      icon: 'mdi-package-variant',
      color: 'teal',
      label: 'Package',
      value: getPackageName(data.packageName),
      detail: 'Current Application'
    }
  ]
})

// Build details for the details section
const buildDetails = computed(() => {
  const data = parsedData.value

  const details = [
    {
      key: 'build',
      label: 'Build Number',
      value: data.buildNumber || 'Unknown'
    },
    {
      key: 'fingerprint',
      label: 'Fingerprint',
      value: formatFingerprint(data.fingerprint)
    },
    {
      key: 'bootloader',
      label: 'Bootloader',
      value: data.bootloader || 'Unknown'
    }
  ]

  // Add optional fields if they exist
  if (data.imei && data.imei !== 'permission_denied' && data.imei !== 'method_unavailable') {
    details.push({
      key: 'imei',
      label: 'IMEI',
      value: data.imei
    })
  }

  if (data.macAddress && data.macAddress !== 'unavailable' && data.macAddress !== '02:00:00:00:00:00') {
    details.push({
      key: 'mac',
      label: 'MAC Address',
      value: data.macAddress
    })
  }

  if (data.phoneNumber && data.phoneNumber !== 'unavailable' && data.phoneNumber !== 'method_unavailable') {
    details.push({
      key: 'phone',
      label: 'Phone Number',
      value: data.phoneNumber
    })
  }

  if (data.deviceId && data.deviceId !== 'permission_denied' && data.deviceId !== 'method_unavailable') {
    details.push({
      key: 'deviceId',
      label: 'Device ID',
      value: data.deviceId
    })
  }

  return details
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
function formatManufacturer(manufacturer) {
  if (!manufacturer || manufacturer === 'unknown') return 'Unknown'
  // Capitalize manufacturer names properly
  const known = {
    'samsung': 'Samsung',
    'google': 'Google',
    'xiaomi': 'Xiaomi',
    'oneplus': 'OnePlus',
    'huawei': 'Huawei',
    'oppo': 'OPPO',
    'vivo': 'Vivo',
    'realme': 'Realme',
    'motorola': 'Motorola',
    'nokia': 'Nokia',
    'sony': 'Sony',
    'lg': 'LG',
    'htc': 'HTC',
    'asus': 'ASUS',
    'lenovo': 'Lenovo'
  }
  const lower = manufacturer.toLowerCase()
  return known[lower] || manufacturer
}

function getPackageName(packageName) {
  if (!packageName) return 'N/A'
  // Shorten long package names for display
  if (packageName.length > 25) {
    const parts = packageName.split('.')
    if (parts.length >= 3) {
      return `${parts[0]}.${parts[1]}...`
    }
  }
  return packageName
}

function formatFingerprint(fingerprint) {
  if (!fingerprint || fingerprint === 'unknown') return 'Unknown'
  // Truncate very long fingerprints for display, but show full data on hover
  if (fingerprint.length > 50) {
    return fingerprint.substring(0, 47) + '...'
  }
  return fingerprint
}
</script>

<style scoped>
.android-device-display {
  animation: fadeIn 0.3s ease-out;
  margin-top: 16px;
}

/* Platform Mismatch Error */
.platform-mismatch-error {
  margin-top: 16px;
  animation: fadeIn 0.3s ease-out;
}

/* Header Styles */
.device-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: linear-gradient(135deg, #1a2a1a 0%, #0f1a0f 100%);
  border-radius: 12px 12px 0 0;
  border-bottom: 1px solid rgba(76, 175, 80, 0.2);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-icon-wrapper {
  width: 44px;
  height: 44px;
  background: rgba(76, 175, 80, 0.1);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(76, 175, 80, 0.2);
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

.info-card.highlight {
  border-color: rgba(76, 175, 80, 0.3);
  background: rgba(76, 175, 80, 0.05);
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
    rgba(76, 175, 80, 0.4),
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
  font-size: 18px;
  font-weight: 700;
  color: #ffffff;
  font-family: var(--ui-font);
  word-break: break-word;
}

.card-detail {
  font-size: 12px;
  color: #5f6368;
  font-weight: 500;
}

/* Details Section */
.details-section {
  padding: 20px;
  background: linear-gradient(180deg, #0a0b0e 0%, #0f1013 100%);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #4ade80;
  margin: 0 0 16px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.detail-item:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.08);
}

.detail-label {
  font-size: 12px;
  color: #9aa0a6;
  font-weight: 500;
}

.detail-value {
  font-size: 12px;
  color: #e0e0e0;
  font-family: 'SF Mono', monospace;
  text-align: right;
  max-width: 60%;
  word-break: break-all;
  cursor: text;
  user-select: text;
}

/* Tooltip for truncated fingerprint */
.detail-value[title] {
  cursor: help;
}

/* Footer */
.device-footer {
  padding: 16px 20px;
  background: linear-gradient(135deg, #0f1a0f 0%, #1a2a1a 100%);
  border-top: 1px solid rgba(76, 175, 80, 0.2);
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

  .device-header {
    padding: 16px;
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }

  .header-actions {
    align-self: flex-end;
  }

  .details-grid {
    grid-template-columns: 1fr;
  }

  .detail-value {
    max-width: 50%;
    font-size: 11px;
  }
}
</style>
