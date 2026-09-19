<template>
  <div class="app_info">
    <!-- Encryption Info Card -->
    <div class="feature-card accent-purple">
      <div class="feature-header">
        <div class="feature-info">
          <div class="feature-icon-wrapper purple">
            <v-icon size="18" color="purple-lighten-2">mdi-shield-search</v-icon>
          </div>
          <div>
            <span class="feature-name">Encryption Info</span>
            <span class="feature-subtitle">Inspect binary encryption status</span>
          </div>
        </div>
        <v-btn
          size="small"
          @click="executeCommand('get_encryption_info', 'get_encryption_info()')"
          :loading="isLoading('get_encryption_info')"
          color="purple"
          variant="outlined"
          :disabled="!agentLoaded"
          class="action-btn"
        >
          <v-icon size="small" class="mr-1">mdi-magnify</v-icon>
          Check
        </v-btn>
      </div>

      <div v-if="outputs.get_encryption_info" class="result-card">
        <div class="result-header">
          <div class="result-status" :class="encryptionStatusClass">
            <v-icon size="16">{{ encryptionStatusIcon }}</v-icon>
            <span>{{ encryptionStatusText }}</span>
          </div>
          <v-btn size="x-small" variant="text" @click="clearOutput('get_encryption_info')">
            <v-icon size="14">mdi-close</v-icon>
          </v-btn>
        </div>
        <div class="result-body">
          <div v-if="encryptionInfo" class="mini-grid">
            <div class="mini-item" v-for="(val, key) in encryptionInfo" :key="key">
              <span class="mini-label">{{ formatLabel(key) }}</span>
              <span class="mini-value" :class="{ 'highlight-true': val === true, 'highlight-false': val === false }">
                {{ typeof val === 'boolean' ? (val ? 'Yes' : 'No') : val }}
              </span>
            </div>
          </div>
          <pre v-else class="raw-output">{{ formatOutput(outputs.get_encryption_info) }}</pre>
        </div>
      </div>
    </div>

    <!-- Bundle Info Card -->
    <div class="feature-card accent-blue">
      <div class="feature-header">
        <div class="feature-info">
          <div class="feature-icon-wrapper blue">
            <v-icon size="18" color="blue-lighten-2">mdi-package-variant</v-icon>
          </div>
          <div>
            <span class="feature-name">Bundle Info</span>
            <span class="feature-subtitle">Application bundle metadata</span>
          </div>
        </div>
        <v-btn
          size="small"
          @click="executeCommand('get_bundle_info', 'get_bundle_info()')"
          :loading="isLoading('get_bundle_info')"
          color="blue"
          variant="outlined"
          :disabled="!agentLoaded"
          class="action-btn"
        >
          <v-icon size="small" class="mr-1">mdi-information-outline</v-icon>
          Get Info
        </v-btn>
      </div>

      <div v-if="outputs.get_bundle_info" class="result-card">
        <div class="result-header">
          <span class="result-title">Bundle Details</span>
          <div class="result-actions">
            <v-btn size="x-small" variant="text" @click="copyOutput('get_bundle_info')">
              <v-icon size="14">mdi-content-copy</v-icon>
            </v-btn>
            <v-btn size="x-small" variant="text" @click="clearOutput('get_bundle_info')">
              <v-icon size="14">mdi-close</v-icon>
            </v-btn>
          </div>
        </div>
        <div class="result-body">
          <div v-if="bundleInfo" class="mini-grid">
            <div class="mini-item" v-for="(val, key) in bundleInfo" :key="key">
              <span class="mini-label">{{ formatLabel(key) }}</span>
              <span class="mini-value">{{ val }}</span>
            </div>
          </div>
          <pre v-else class="raw-output">{{ formatOutput(outputs.get_bundle_info) }}</pre>
        </div>
      </div>
    </div>

    <!-- Validate Binary Card -->
    <div class="feature-card accent-teal">
      <div class="feature-header">
        <div class="feature-info">
          <div class="feature-icon-wrapper teal">
            <v-icon size="18" color="teal-lighten-2">mdi-check-decagram</v-icon>
          </div>
          <div>
            <span class="feature-name">Validate Binary</span>
            <span class="feature-subtitle">Verify binary integrity and signature</span>
          </div>
        </div>
        <v-btn
          size="small"
          @click="executeCommand('validate_binary', 'validate_binary()')"
          :loading="isLoading('validate_binary')"
          color="teal"
          variant="outlined"
          :disabled="!agentLoaded"
          class="action-btn"
        >
          <v-icon size="small" class="mr-1">mdi-check-circle-outline</v-icon>
          Validate
        </v-btn>
      </div>

      <div v-if="outputs.validate_binary" class="result-card">
        <div class="result-header">
          <div class="result-status" :class="validationStatusClass">
            <v-icon size="16">{{ validationStatusIcon }}</v-icon>
            <span>{{ validationStatusText }}</span>
          </div>
          <v-btn size="x-small" variant="text" @click="clearOutput('validate_binary')">
            <v-icon size="14">mdi-close</v-icon>
          </v-btn>
        </div>
        <div class="result-body">
          <div v-if="validationInfo" class="mini-grid">
            <div class="mini-item" v-for="(val, key) in validationInfo" :key="key">
              <span class="mini-label">{{ formatLabel(key) }}</span>
              <span class="mini-value" :class="{ 'highlight-true': val === true, 'highlight-false': val === false }">
                {{ typeof val === 'boolean' ? (val ? 'Pass' : 'Fail') : val }}
              </span>
            </div>
          </div>
          <pre v-else class="raw-output">{{ formatOutput(outputs.validate_binary) }}</pre>
        </div>
      </div>
    </div>

    <!-- Decrypt IPA Section -->
    <div class="feature-card accent-red decrypt-main">
      <div class="feature-header">
        <div class="feature-info">
          <div class="feature-icon-wrapper red">
            <v-icon size="18" color="red-lighten-2">mdi-lock-open-variant</v-icon>
          </div>
          <div>
            <span class="feature-name">Decrypt IPA</span>
            <span class="feature-subtitle">Decrypt application binary for analysis</span>
          </div>
        </div>
        <div class="decrypt-actions">
          <v-btn
            size="small"
            @click="executeCommand('parse_and_decrypt_ipa', 'parse_and_decrypt_ipa()')"
            :loading="isLoading('parse_and_decrypt_ipa')"
            color="red"
            variant="flat"
            :disabled="!agentLoaded || isDecrypting"
            class="action-btn"
          >
            <v-icon size="small" class="mr-1">mdi-rocket-launch</v-icon>
            Parse & Decrypt
          </v-btn>
          <v-btn
            size="small"
            @click="executeCommand('decrypt_ipa', 'decrypt_ipa()')"
            :loading="isLoading('decrypt_ipa')"
            color="red"
            variant="outlined"
            :disabled="!agentLoaded || isDecrypting"
            class="action-btn"
          >
            <v-icon size="small" class="mr-1">mdi-lock-open</v-icon>
            Decrypt Only
          </v-btn>
        </div>
      </div>

      <!-- Decrypt Progress -->
      <div v-if="isDecrypting" class="decrypt-progress">
        <div class="progress-animation">
          <div class="progress-ring">
            <v-progress-circular indeterminate color="red-lighten-2" size="32" width="3" />
          </div>
          <div class="progress-info">
            <span class="progress-title">Decrypting...</span>
            <span class="progress-detail" v-if="decryptStatus">{{ decryptStatus }}</span>
            <span class="progress-detail" v-else>This may take a moment</span>
          </div>
        </div>
        <v-btn size="x-small" variant="text" color="grey" @click="checkDecryptStatus">
          <v-icon size="14" class="mr-1">mdi-refresh</v-icon>
          Check Status
        </v-btn>
      </div>

      <!-- Decrypt Results -->
      <div v-if="outputs.decrypt_ipa || outputs.parse_and_decrypt_ipa" class="result-card decrypt-result">
        <div class="result-header">
          <div class="result-status" :class="decryptResultClass">
            <v-icon size="16">{{ decryptResultIcon }}</v-icon>
            <span>{{ decryptResultText }}</span>
          </div>
          <div class="result-actions">
            <v-btn size="x-small" variant="text" @click="copyOutput(decryptOutputKey)">
              <v-icon size="14">mdi-content-copy</v-icon>
            </v-btn>
            <v-btn size="x-small" variant="text" @click="clearDecryptOutputs">
              <v-icon size="14">mdi-close</v-icon>
            </v-btn>
          </div>
        </div>
        <div class="result-body">
          <pre class="raw-output">{{ formatOutput(outputs.parse_and_decrypt_ipa || outputs.decrypt_ipa) }}</pre>
        </div>
      </div>

      <!-- Decrypt Status -->
      <div v-if="outputs.get_decrypt_status && !isDecrypting" class="result-card">
        <div class="result-header">
          <span class="result-title">Last Status</span>
          <v-btn size="x-small" variant="text" @click="clearOutput('get_decrypt_status')">
            <v-icon size="14">mdi-close</v-icon>
          </v-btn>
        </div>
        <div class="result-body">
          <pre class="raw-output">{{ formatOutput(outputs.get_decrypt_status) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'

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

const isDecrypting = ref(false)
const decryptStatus = ref(null)

// Output accessors
const outputs = computed(() => ({
  get_encryption_info: props.featureOutputs?.get_encryption_info,
  get_bundle_info: props.featureOutputs?.get_bundle_info,
  validate_binary: props.featureOutputs?.validate_binary,
  decrypt_ipa: props.featureOutputs?.decrypt_ipa,
  parse_and_decrypt_ipa: props.featureOutputs?.parse_and_decrypt_ipa,
  get_decrypt_status: props.featureOutputs?.get_decrypt_status,
}))

const isLoading = (feature) => props.loadingFeatures?.[feature] || false

// Parse helper - extract data from agent response wrapper
const extractData = (raw) => {
  if (!raw) return null
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw) } catch { return null }
  }
  if (typeof raw === 'object') {
    if (raw.data && typeof raw.data === 'object') return raw.data
    if (raw.result && typeof raw.result === 'object') {
      return raw.result.data || raw.result
    }
    // If it doesn't have the wrapper, return as-is (excluding success/timestamp)
    const { success, timestamp, ...rest } = raw
    if (Object.keys(rest).length > 0) return rest
  }
  return null
}

const isSuccess = (raw) => {
  if (!raw) return false
  if (typeof raw === 'object') return raw.success === true
  return false
}

// Parsed sub-outputs
const encryptionInfo = computed(() => extractData(outputs.value.get_encryption_info))
const bundleInfo = computed(() => extractData(outputs.value.get_bundle_info))
const validationInfo = computed(() => extractData(outputs.value.validate_binary))

// Encryption status display
const encryptionStatusClass = computed(() => {
  const raw = outputs.value.get_encryption_info
  return isSuccess(raw) ? 'status-success' : 'status-neutral'
})
const encryptionStatusIcon = computed(() => {
  const info = encryptionInfo.value
  if (!info) return 'mdi-help-circle'
  if (info.encrypted || info.isEncrypted) return 'mdi-lock'
  return 'mdi-lock-open-variant'
})
const encryptionStatusText = computed(() => {
  const info = encryptionInfo.value
  if (!info) return 'Retrieved'
  if (info.encrypted || info.isEncrypted) return 'Binary is Encrypted'
  return 'Binary is Not Encrypted'
})

// Validation status display
const validationStatusClass = computed(() => {
  const raw = outputs.value.validate_binary
  return isSuccess(raw) ? 'status-success' : 'status-neutral'
})
const validationStatusIcon = computed(() => {
  const info = validationInfo.value
  if (!info) return 'mdi-help-circle'
  if (info.valid === true || info.isValid === true) return 'mdi-check-circle'
  if (info.valid === false || info.isValid === false) return 'mdi-alert-circle'
  return 'mdi-information'
})
const validationStatusText = computed(() => {
  const info = validationInfo.value
  if (!info) return 'Checked'
  if (info.valid === true || info.isValid === true) return 'Binary Valid'
  if (info.valid === false || info.isValid === false) return 'Validation Issues Found'
  return 'Validation Complete'
})

// Decrypt result display
const decryptOutputKey = computed(() => outputs.value.parse_and_decrypt_ipa ? 'parse_and_decrypt_ipa' : 'decrypt_ipa')
const decryptResultClass = computed(() => {
  const raw = outputs.value.parse_and_decrypt_ipa || outputs.value.decrypt_ipa
  return isSuccess(raw) ? 'status-success' : 'status-error'
})
const decryptResultIcon = computed(() => {
  const raw = outputs.value.parse_and_decrypt_ipa || outputs.value.decrypt_ipa
  return isSuccess(raw) ? 'mdi-check-circle' : 'mdi-alert-circle'
})
const decryptResultText = computed(() => {
  const raw = outputs.value.parse_and_decrypt_ipa || outputs.value.decrypt_ipa
  return isSuccess(raw) ? 'Decryption Complete' : 'Decryption Result'
})

// Methods
const executeCommand = (feature, command) => {
  if (feature === 'decrypt_ipa' || feature === 'parse_and_decrypt_ipa') {
    isDecrypting.value = true
    decryptStatus.value = null
  }
  emit('execute-feature', { feature, command })

  // Auto-update decrypting state when output appears
  if (feature === 'decrypt_ipa' || feature === 'parse_and_decrypt_ipa') {
    const checkDone = setInterval(() => {
      if (outputs.value[feature]) {
        isDecrypting.value = false
        clearInterval(checkDone)
      }
    }, 1000)
    // Safety timeout
    setTimeout(() => {
      clearInterval(checkDone)
      isDecrypting.value = false
    }, 120000)
  }
}

const checkDecryptStatus = () => {
  emit('execute-feature', {
    feature: 'get_decrypt_status',
    command: 'get_decrypt_status()'
  })
}

const clearOutput = (feature) => {
  emit('execute-feature', { feature, action: 'clear' })
}

const clearDecryptOutputs = () => {
  clearOutput('decrypt_ipa')
  clearOutput('parse_and_decrypt_ipa')
}

const copyOutput = async (feature) => {
  try {
    const data = outputs.value[feature]
    await navigator.clipboard.writeText(typeof data === 'string' ? data : JSON.stringify(data, null, 2))
    showNotification('Copied to clipboard', 'success')
  } catch {
    showNotification('Failed to copy', 'error')
  }
}

const formatLabel = (key) => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, s => s.toUpperCase())
    .trim()
}

const formatOutput = (data) => {
  if (typeof data === 'string') return data
  try {
    // Unwrap agent response for display
    if (data?.data) return JSON.stringify(data.data, null, 2)
    return JSON.stringify(data, null, 2)
  } catch { return String(data) }
}
</script>

<style scoped>
.ios-decryption {
  padding: 8px;
  color: #ffffff;
}

.feature-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 14px;
  transition: all 0.3s ease;
}

.feature-card:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.12);
}

.feature-card.accent-purple { border-left: 3px solid rgba(156, 39, 176, 0.4); }
.feature-card.accent-blue { border-left: 3px solid rgba(33, 150, 243, 0.4); }
.feature-card.accent-teal { border-left: 3px solid rgba(0, 150, 136, 0.4); }
.feature-card.accent-red { border-left: 3px solid rgba(244, 67, 54, 0.4); }

.feature-card.decrypt-main {
  background: rgba(244, 67, 54, 0.03);
}

.feature-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.feature-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.feature-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  flex-shrink: 0;
}

.feature-icon-wrapper.purple { background: rgba(156, 39, 176, 0.15); }
.feature-icon-wrapper.blue { background: rgba(33, 150, 243, 0.15); }
.feature-icon-wrapper.teal { background: rgba(0, 150, 136, 0.15); }
.feature-icon-wrapper.red { background: rgba(244, 67, 54, 0.15); }

.feature-name {
  font-weight: 600;
  font-size: 14px;
  color: #ffffff;
  display: block;
}

.feature-subtitle {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  display: block;
  margin-top: 1px;
}

.action-btn {
  text-transform: none;
  font-size: 12px;
}

.decrypt-actions {
  display: flex;
  gap: 8px;
}

/* Results */
.result-card {
  margin-top: 12px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(0, 0, 0, 0.2);
}

.result-card.decrypt-result {
  border-color: rgba(244, 67, 54, 0.15);
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.result-title {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
}

.result-actions {
  display: flex;
  gap: 2px;
}

.result-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
}

.result-status.status-success { color: #66bb6a; }
.result-status.status-error { color: #ef5350; }
.result-status.status-neutral { color: rgba(255, 255, 255, 0.7); }

.result-body {
  padding: 10px 12px;
}

.mini-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 6px;
}

.mini-item {
  display: flex;
  flex-direction: column;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.mini-label {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.mini-value {
  font-size: 13px;
  font-weight: 500;
  color: #ffffff;
  word-break: break-all;
  margin-top: 2px;
}

.mini-value.highlight-true { color: #66bb6a; }
.mini-value.highlight-false { color: #ef5350; }

.raw-output {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 300px;
  overflow-y: auto;
}

/* Decrypt Progress */
.decrypt-progress {
  margin-top: 14px;
  padding: 14px 16px;
  border-radius: 8px;
  background: rgba(244, 67, 54, 0.06);
  border: 1px solid rgba(244, 67, 54, 0.12);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-animation {
  display: flex;
  align-items: center;
  gap: 14px;
}

.progress-info {
  display: flex;
  flex-direction: column;
}

.progress-title {
  font-size: 13px;
  font-weight: 600;
  color: #ef9a9a;
}

.progress-detail {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  margin-top: 2px;
}

@media (max-width: 500px) {
  .mini-grid {
    grid-template-columns: 1fr;
  }
  .decrypt-actions {
    flex-direction: column;
  }
}
</style>
