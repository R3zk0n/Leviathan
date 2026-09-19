<template>
  <div class="feature-card crypto-card">
    <div class="feature-header">
      <div class="feature-info">
        <v-icon size="small" class="mr-2" :color="isMonitoring ? 'green' : 'grey'">
          {{ isMonitoring ? 'mdi-record-circle' : 'mdi-record-circle-outline' }}
        </v-icon>
        <span class="feature-name">Cryptography Operations Monitor</span>
        <v-chip size="x-small" class="ml-2" :color="isMonitoring ? 'purple' : 'grey'">
          {{ isMonitoring ? 'MONITORING' : 'INACTIVE' }}
        </v-chip>
        <v-chip size="x-small" class="ml-2" :color="stats.totalOperations > 0 ? 'green' : 'grey'" v-if="isMonitoring">
          {{ stats.totalOperations }} operations
        </v-chip>
        <v-chip
          v-if="isMonitoring && securityStats.weakCrypto > 0"
          size="x-small"
          class="ml-2"
          color="error"
        >
          {{ securityStats.weakCrypto }} WEAK CRYPTO
        </v-chip>
      </div>
      <v-switch
        v-model="isMonitoring"
        density="compact"
        hide-details
        @update:model-value="handleToggle"
        :disabled="!agentLoaded"
        color="purple"
      ></v-switch>
    </div>
    <div class="feature-description">
      Monitor cryptographic operations including encryption, decryption, hashing, key generation, and certificate validation with security analysis
    </div>

    <!-- DEBUG SECTION - Remove after fixing -->
      <div v-if="isMonitoring" class="debug-section" style="background: #2a2a0a; padding: 10px; margin: 10px 0; border: 1px solid #ffa726; border-radius: 4px;">
        <h5 style="color: #ffa726; margin: 0 0 10px 0;">Debug Info</h5>
        <div style="font-size: 12px; color: #ccc; font-family: monospace;">
          <div>Operations Array Length: {{ operations.length }}</div>
          <div>Total Operations Stat: {{ stats.totalOperations }}</div>
          <div>Filtered Operations: {{ filteredOperations.length }}</div>
          <div>Show Parsed View: {{ showParsedView }}</div>
          <div>Output Length: {{ output.length }}</div>
          <div v-if="operations.length > 0">Last Operation: {{ operations[operations.length - 1]?.operation }} | {{ operations[operations.length - 1]?.algorithm }}</div>
        </div>
      </div>

    <div v-if="isMonitoring && (output || operations.length > 0)" class="feature-output">
      <!-- Enhanced Control Bar -->
      <div class="output-header">
        <div class="header-left">
          <span class="operations-count">{{ operations.length }} operations</span>
          <v-chip
            v-if="securityStats.highRiskOperations > 0"
            size="x-small"
            color="error"
            class="ml-2"
          >
            {{ securityStats.highRiskOperations }} High Risk
          </v-chip>
          <v-chip
            v-if="securityStats.mediumRiskOperations > 0"
            size="x-small"
            color="warning"
            class="ml-2"
          >
            {{ securityStats.mediumRiskOperations }} Medium Risk
          </v-chip>
        </div>
        <div class="output-actions">
          <v-text-field
            v-model="searchQuery"
            placeholder="Search operations..."
            density="compact"
            hide-details
            variant="outlined"
            clearable
            class="search-field mr-2"
            @input="applyFilters"
          >
            <template v-slot:prepend-inner>
              <v-icon size="small">mdi-magnify</v-icon>
            </template>
          </v-text-field>

          <v-select
            v-model="algorithmFilter"
            :items="algorithmFilterOptions"
            density="compact"
            hide-details
            variant="outlined"
            class="filter-select mr-2"
            style="min-width: 140px;"
            @update:model-value="applyFilters"
          ></v-select>

          <v-select
            v-model="operationFilter"
            :items="operationFilterOptions"
            density="compact"
            hide-details
            variant="outlined"
            class="filter-select mr-2"
            style="min-width: 120px;"
            @update:model-value="applyFilters"
          ></v-select>

          <v-btn size="small" variant="text" @click="clearData" icon>
            <v-icon size="small">mdi-delete</v-icon>
            <v-tooltip activator="parent" location="bottom">Clear All</v-tooltip>
          </v-btn>

          <v-btn size="small" variant="text" @click="toggleView" icon>
            <v-icon size="small">{{ showParsedView ? 'mdi-code-tags' : 'mdi-format-list-bulleted' }}</v-icon>
            <v-tooltip activator="parent" location="bottom">
              {{ showParsedView ? 'Raw View' : 'Security View' }}
            </v-tooltip>
          </v-btn>

          <v-btn size="small" variant="text" @click="handleExport" :disabled="operations.length === 0" icon>
            <v-icon size="small">mdi-download</v-icon>
            <v-tooltip activator="parent" location="bottom">Export Data</v-tooltip>
          </v-btn>
        </div>
      </div>

      <div class="output-content">
        <!-- Security Dashboard -->
        <div v-if="showParsedView && operations.length > 0" class="crypto-security-dashboard">
          <!-- Security Overview -->
          <div class="security-overview">
            <h4 class="section-title">
              <v-icon size="small" class="mr-2">mdi-shield-lock</v-icon>
              Cryptography Security Overview
            </h4>
            <div class="security-metrics">
              <div class="metric-card high-risk" v-if="securityStats.highRiskOperations > 0">
                <div class="metric-value">{{ securityStats.highRiskOperations }}</div>
                <div class="metric-label">High Risk</div>
                <v-icon class="metric-icon">mdi-alert-circle</v-icon>
              </div>

              <div class="metric-card medium-risk" v-if="securityStats.mediumRiskOperations > 0">
                <div class="metric-value">{{ securityStats.mediumRiskOperations }}</div>
                <div class="metric-label">Medium Risk</div>
                <v-icon class="metric-icon">mdi-alert</v-icon>
              </div>

              <div class="metric-card weak-crypto" v-if="securityStats.weakCrypto > 0">
                <div class="metric-value">{{ securityStats.weakCrypto }}</div>
                <div class="metric-label">Weak Crypto</div>
                <v-icon class="metric-icon">mdi-lock-alert</v-icon>
              </div>

              <div class="metric-card deprecated" v-if="securityStats.deprecatedAlgorithms > 0">
                <div class="metric-value">{{ securityStats.deprecatedAlgorithms }}</div>
                <div class="metric-label">Deprecated</div>
                <v-icon class="metric-icon">mdi-clock-alert</v-icon>
              </div>

              <div class="metric-card failed-ops" v-if="securityStats.insecureOperations > 0">
                <div class="metric-value">{{ securityStats.insecureOperations }}</div>
                <div class="metric-label">Failed Ops</div>
                <v-icon class="metric-icon">mdi-close-circle</v-icon>
              </div>
            </div>
          </div>

          <!-- Algorithm Analysis -->
          <div class="algorithm-analysis" v-if="uniqueAlgorithms.length > 0">
            <h4 class="section-title">
              <v-icon size="small" class="mr-2">mdi-key</v-icon>
              Algorithm Analysis ({{ uniqueAlgorithms.length }} algorithms)
            </h4>
            <div class="algorithm-chips">
              <v-chip
                v-for="algorithm in uniqueAlgorithms.slice(0, 10)"
                :key="algorithm"
                size="small"
                :color="getAlgorithmColor(algorithm)"
                class="ma-1"
              >
                {{ algorithm }}
                <v-icon
                  v-if="isAlgorithmWeak(algorithm)"
                  size="small"
                  class="ml-1"
                >
                  mdi-alert-circle-outline
                </v-icon>
              </v-chip>
              <v-chip v-if="uniqueAlgorithms.length > 10" size="small" color="grey" class="ma-1">
                +{{ uniqueAlgorithms.length - 10 }} more
              </v-chip>
            </div>
          </div>

          <!-- Operation Breakdown -->
          <div class="operation-breakdown" v-if="stats.totalOperations > 0">
            <h4 class="section-title">
              <v-icon size="small" class="mr-2">mdi-chart-bar</v-icon>
              Operation Distribution
            </h4>
            <div class="operation-stats">
              <div
                v-for="(count, operation) in stats.operationBreakdown"
                :key="operation"
                v-if="count > 0"
                class="operation-stat"
              >
                <v-chip
                  size="small"
                  :color="getOperationColor(operation)"
                  class="operation-chip"
                >
                  {{ operation.replace('_', ' ').toUpperCase() }}
                </v-chip>
                <span class="count">{{ count }}</span>
                <div class="progress-bar">
                  <div
                    class="progress-fill"
                    :style="{
                      width: (count / stats.totalOperations * 100) + '%',
                      backgroundColor: getOperationColorHex(operation)
                    }"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Enhanced Operations List -->
        <div v-if="showParsedView && filteredOperations.length > 0" class="enhanced-operations-list">
          <div class="operations-header">
            <h4 class="section-title">
              <v-icon size="small" class="mr-2">mdi-lock</v-icon>
              Cryptographic Operations
              <span class="operation-count">({{ filteredOperations.length }} of {{ operations.length }})</span>
            </h4>
          </div>

          <div class="operations-container">
            <div
              v-for="(operation, index) in filteredOperations.slice(-50)"
              :key="operation.id || index"
              class="enhanced-operation-item"
              :class="getEnhancedOperationClass(operation)"
              @click="toggleOperationDetails(operation)"
            >
              <!-- Operation Header -->
              <div class="enhanced-operation-header">
                <div class="operation-main-info">
                  <div class="operation-badges">
                    <v-chip size="small" :color="getOperationColor(operation.operation)" class="operation-badge">
                      {{ operation.operation?.replace('_', ' ').toUpperCase() || 'UNKNOWN' }}
                    </v-chip>

                    <v-chip
                      v-if="operation.algorithm"
                      size="small"
                      :color="getAlgorithmColor(operation.algorithm)"
                      class="algorithm-badge"
                    >
                      {{ operation.algorithm }}
                    </v-chip>

                    <v-chip
                      v-if="!operation.success"
                      size="small"
                      color="error"
                      class="error-badge"
                    >
                      FAILED
                    </v-chip>

                    <!-- Security Risk Badge -->
                    <v-chip
                      :size="getOperationRisk(operation).score >= 7 ? 'small' : 'x-small'"
                      :color="getOperationRiskColor(operation)"
                      class="security-badge"
                    >
                      {{ getOperationRisk(operation).risk }}
                      <v-icon
                        v-if="getOperationRisk(operation).score >= 7"
                        size="small"
                        class="ml-1"
                      >
                        mdi-alert-circle
                      </v-icon>
                    </v-chip>
                  </div>

                  <div class="operation-details-section">
                    <div class="operation-metadata">
                      <span class="timestamp">{{ formatTimestamp(operation.timestamp) }}</span>
                      <span class="key-size" v-if="operation.keySize">{{ operation.keySize }} bits</span>
                      <span class="data-size" v-if="operation.dataSize">{{ formatBytes(operation.dataSize) }}</span>
                    </div>
                  </div>
                </div>

                <!-- Security Indicators -->
                <div class="security-indicators">
                  <v-tooltip location="bottom">
                    <template v-slot:activator="{ props }">
                      <v-icon
                        v-if="operation.keySize && operation.keySize < 256"
                        size="small"
                        color="warning"
                        class="indicator-icon"
                        v-bind="props"
                      >
                        mdi-key-alert
                      </v-icon>
                    </template>
                    <span>Weak Key Size</span>
                  </v-tooltip>

                  <v-tooltip location="bottom">
                    <template v-slot:activator="{ props }">
                      <v-icon
                        v-if="isAlgorithmWeak(operation.algorithm)"
                        size="small"
                        color="error"
                        class="indicator-icon"
                        v-bind="props"
                      >
                        mdi-shield-alert
                      </v-icon>
                    </template>
                    <span>Weak Algorithm</span>
                  </v-tooltip>

                  <v-tooltip location="bottom">
                    <template v-slot:activator="{ props }">
                      <v-icon
                        v-if="operation.stackTrace"
                        size="small"
                        color="info"
                        class="indicator-icon"
                        v-bind="props"
                      >
                        mdi-debug-step-over
                      </v-icon>
                    </template>
                    <span>Has Stack Trace</span>
                  </v-tooltip>

                  <v-tooltip location="bottom">
                    <template v-slot:activator="{ props }">
                      <v-icon
                        v-if="operation.parameters && Object.keys(operation.parameters).length > 0"
                        size="small"
                        color="success"
                        class="indicator-icon"
                        v-bind="props"
                      >
                        mdi-cog
                      </v-icon>
                    </template>
                    <span>Has Parameters</span>
                  </v-tooltip>

                  <!-- Expand Arrow -->
                  <v-icon
                    size="small"
                    :class="{ 'rotated': expandedOperations.has(operation.id) }"
                    class="expand-arrow"
                  >
                    mdi-chevron-down
                  </v-icon>
                </div>
              </div>

              <!-- Expanded Operation Details -->
              <div v-if="expandedOperations.has(operation.id)" class="enhanced-operation-details" @click.stop>
                <!-- Security Analysis Panel -->
                <div class="security-analysis-panel" @click.stop>
                  <h5 class="detail-section-title">
                    <v-icon size="small" class="mr-2">mdi-shield-search</v-icon>
                    Cryptographic Security Analysis
                  </h5>
                  <div class="security-findings">
                    <div class="risk-score">
                      <span class="risk-label">Risk Score:</span>
                      <v-chip
                        :color="getOperationRiskColor(operation)"
                        size="small"
                        class="ml-2"
                      >
                        {{ getOperationRisk(operation).score }}/10 - {{ getOperationRisk(operation).risk }}
                      </v-chip>
                    </div>
                    <div class="findings-list" v-if="getOperationRisk(operation).findings.length > 0">
                      <div
                        v-for="(finding, idx) in getOperationRisk(operation).findings"
                        :key="idx"
                        class="finding-item"
                      >
                        <v-icon size="small" color="warning" class="mr-2">mdi-alert-circle-outline</v-icon>
                        {{ finding }}
                      </div>
                    </div>
                    <div v-else class="no-findings">
                      <v-icon size="small" color="success" class="mr-2">mdi-check-circle</v-icon>
                      No security issues detected
                    </div>
                  </div>
                </div>

                <!-- Tabbed Content -->
                <div class="detail-tabs" @click.stop>
                  <div @click.stop>
                    <v-tabs
                      v-model="activeOperationTab[operation.id]"
                      density="compact"
                      color="primary"
                      @click.stop
                    >
                      <v-tab value="overview" @click.stop>Overview</v-tab>
                      <v-tab value="parameters" v-if="operation.parameters && Object.keys(operation.parameters).length > 0" @click.stop>Parameters</v-tab>
                      <v-tab value="hexdump" v-if="hasHexData(operation)" @click.stop>Hex Dump</v-tab>
                      <v-tab value="stack" v-if="operation.stackTrace" @click.stop>Stack Trace</v-tab>
                      <v-tab value="error" v-if="operation.error" @click.stop>Error</v-tab>
                    </v-tabs>

                    <v-window
                      v-model="activeOperationTab[operation.id]"
                      class="mt-4"
                      @click.stop
                    >
                      <!-- Overview Tab -->
                      <v-window-item value="overview">
                        <div class="overview-grid" @click.stop>
                          <div class="overview-section">
                            <h6 class="overview-title">Operation Details</h6>
                            <div class="info-pairs">
                              <div class="info-pair">
                                <span class="info-key">Operation:</span>
                                <span class="info-value">{{ operation.operation || 'Unknown' }}</span>
                              </div>
                              <div class="info-pair">
                                <span class="info-key">Algorithm:</span>
                                <span class="info-value">{{ operation.algorithm || 'N/A' }}</span>
                              </div>
                              <div class="info-pair">
                                <span class="info-key">Key Size:</span>
                                <span class="info-value">{{ operation.keySize ? operation.keySize + ' bits' : 'N/A' }}</span>
                              </div>
                              <div class="info-pair">
                                <span class="info-key">Data Size:</span>
                                <span class="info-value">{{ operation.dataSize ? formatBytes(operation.dataSize) : 'N/A' }}</span>
                              </div>
                            </div>
                          </div>

                          <div class="overview-section">
                            <h6 class="overview-title">Execution Info</h6>
                            <div class="info-pairs">
                              <div class="info-pair">
                                <span class="info-key">Status:</span>
                                <span class="info-value" :class="{ 'success-text': operation.success, 'error-text': !operation.success }">
                                  {{ operation.success ? 'Success' : 'Failed' }}
                                </span>
                              </div>
                              <div class="info-pair">
                                <span class="info-key">Timestamp:</span>
                                <span class="info-value">{{ formatTimestamp(operation.timestamp) }}</span>
                              </div>
                              <div class="info-pair" v-if="operation.parameters && operation.parameters.duration">
                                <span class="info-key">Duration:</span>
                                <span class="info-value">{{ operation.parameters.duration }}ms</span>
                              </div>
                              <div class="info-pair" v-if="operation.error">
                                <span class="info-key">Error:</span>
                                <span class="info-value error-text">{{ operation.error }}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </v-window-item>

                      <!-- Parameters Tab -->
                      <v-window-item value="parameters" v-if="operation.parameters">
                        <div class="parameters-section" @click.stop>
                          <div class="parameters-header">
                            <span class="parameters-title">Operation Parameters</span>
                            <v-btn
                              size="x-small"
                              variant="text"
                              @click.stop="copyToClipboard(JSON.stringify(operation.parameters, null, 2))"
                              class="ml-2"
                            >
                              <v-icon size="small">mdi-content-copy</v-icon>
                            </v-btn>
                          </div>
                          <div class="enhanced-parameters-list">
                            <div
                              v-for="(value, key) in operation.parameters"
                              :key="key"
                              class="enhanced-parameter-item"
                            >
                              <div class="parameter-key">{{ key }}</div>
                              <div class="parameter-value">{{ formatParameterValue(value) }}</div>
                            </div>
                          </div>
                        </div>
                      </v-window-item>

                      <!-- Hex Dump Tab -->
                      <v-window-item value="hexdump" v-if="hasHexData(operation)">
                        <div class="hexdump-section" @click.stop>
                          <div class="hexdump-header">
                            <span class="hexdump-title">Cryptographic Data Hex Dump</span>
                            <v-btn
                              size="x-small"
                              variant="text"
                              @click.stop="copyToClipboard(getAllHexData(operation))"
                              class="ml-2"
                            >
                              <v-icon size="small">mdi-content-copy</v-icon>
                            </v-btn>
                          </div>

                          <div class="hexdump-container">
                            <!-- Key Hex Dump -->
                            <div v-if="operation.parameters?.key" class="hex-data-block">
                              <div class="hex-data-label">
                                <v-icon size="small" class="mr-2">mdi-key</v-icon>
                                <span>Encryption Key ({{ getHexByteLength(operation.parameters.key) }} bytes)</span>
                              </div>
                              <div class="hexdump-content">
                                <pre class="hexdump-text">{{ formatHexDump(operation.parameters.key, 'Key') }}</pre>
                              </div>
                            </div>

                            <!-- IV Hex Dump -->
                            <div v-if="operation.parameters?.iv" class="hex-data-block">
                              <div class="hex-data-label">
                                <v-icon size="small" class="mr-2">mdi-vector-triangle</v-icon>
                                <span>Initialization Vector ({{ getHexByteLength(operation.parameters.iv) }} bytes)</span>
                              </div>
                              <div class="hexdump-content">
                                <pre class="hexdump-text">{{ formatHexDump(operation.parameters.iv, 'IV') }}</pre>
                              </div>
                            </div>

                            <!-- Input Hex Dump -->
                            <div v-if="operation.parameters?.input" class="hex-data-block">
                              <div class="hex-data-label">
                                <v-icon size="small" class="mr-2">mdi-download</v-icon>
                                <span>Input Data ({{ getHexByteLength(operation.parameters.input) }} bytes)</span>
                              </div>
                              <div class="hexdump-content">
                                <pre class="hexdump-text">{{ formatHexDump(operation.parameters.input, 'Input') }}</pre>
                              </div>
                            </div>

                            <!-- Output Hex Dump -->
                            <div v-if="operation.parameters?.output" class="hex-data-block">
                              <div class="hex-data-label">
                                <v-icon size="small" class="mr-2">mdi-upload</v-icon>
                                <span>Output Data ({{ getHexByteLength(operation.parameters.output) }} bytes)</span>
                              </div>
                              <div class="hexdump-content">
                                <pre class="hexdump-text">{{ formatHexDump(operation.parameters.output, 'Output') }}</pre>
                              </div>
                            </div>

                            <!-- Other Hex Data -->
                            <div v-for="(value, key) in operation.parameters" :key="key">
                              <div v-if="isHexString(value) && !['key', 'iv', 'input', 'output'].includes(key)" class="hex-data-block">
                                <div class="hex-data-label">
                                  <v-icon size="small" class="mr-2">mdi-code-array</v-icon>
                                  <span>{{ key.charAt(0).toUpperCase() + key.slice(1) }} ({{ getHexByteLength(value) }} bytes)</span>
                                </div>
                                <div class="hexdump-content">
                                  <pre class="hexdump-text">{{ formatHexDump(value, key) }}</pre>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </v-window-item>

                      <!-- Stack Trace Tab -->
                      <v-window-item value="stack" v-if="operation.stackTrace">
                        <div class="stack-section" @click.stop>
                          <div class="stack-header">
                            <span class="stack-title">Stack Trace</span>
                            <v-btn
                              size="x-small"
                              variant="text"
                              @click.stop="copyToClipboard(operation.stackTrace)"
                              class="ml-2"
                            >
                              <v-icon size="small">mdi-content-copy</v-icon>
                            </v-btn>
                          </div>
                          <div class="enhanced-stack-content">
                            <pre class="stack-text">{{ operation.stackTrace }}</pre>
                          </div>
                        </div>
                      </v-window-item>

                      <!-- Error Tab -->
                      <v-window-item value="error" v-if="operation.error">
                        <div class="error-section" @click.stop>
                          <div class="error-header">
                            <span class="error-title">Error Details</span>
                            <v-btn
                              size="x-small"
                              variant="text"
                              @click.stop="copyToClipboard(operation.error)"
                              class="ml-2"
                            >
                              <v-icon size="small">mdi-content-copy</v-icon>
                            </v-btn>
                          </div>
                          <div class="enhanced-error-content">
                            <div class="error-message">
                              <v-icon size="small" color="error" class="mr-2">mdi-alert-circle</v-icon>
                              {{ operation.error }}
                            </div>
                          </div>
                        </div>
                      </v-window-item>
                    </v-window>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Raw Crypto View (Fallback) -->
        <div v-else-if="!showParsedView" class="raw-crypto-view">
          <pre class="output-text live-output crypto-output" ref="cryptoMonitorOutput">{{ output }}</pre>
        </div>

        <!-- Empty State -->
        <div v-else-if="operations.length === 0" class="empty-state">
          <v-icon size="large" color="grey">mdi-lock-off</v-icon>
          <h4>No Cryptographic Operations</h4>
          <p>Start using the app to see cryptographic operations here</p>
        </div>

        <!-- No Filtered Results -->
        <div v-else class="no-results">
          <v-icon size="large" color="grey">mdi-filter-remove</v-icon>
          <h4>No Matching Operations</h4>
          <p>Try adjusting your search or filters</p>
          <v-btn size="small" @click="clearFilters" color="primary" variant="outlined" class="mt-2">
            Clear Filters
          </v-btn>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onUnmounted } from 'vue'
import { useCryptoMonitor } from '@/components/Frida/Dialogs/FridaHooks/iOS/Crypto/useCryptoMonitor'

const props = defineProps({
  agentLoaded: Boolean,
  sessionId: String,
  deviceId: String,
  pid: Number
})

const emit = defineEmits(['update:monitoring', 'show-notification'])

const {
  operations,
  output,
  filteredOperations,
  stats,
  securityStats,
  isLoading,
  showParsedView,
  searchQuery,
  algorithmFilter,
  operationFilter,
  expandedOperations,
  activeOperationTab,
  algorithmFilterOptions,
  operationFilterOptions,
  startMonitoring,
  stopMonitoring,
  clearData,
  exportData,
  toggleOperationDetails,
  toggleView,
  clearFilters,
  applyFilters,
  cleanup,
  getOperationRisk,
  getOperationRiskColor,
  getAlgorithmColor,
  getOperationColor,
  formatBytes,
  formatTimestamp
} = useCryptoMonitor(props.sessionId)

const isMonitoring = ref(false)

// Computed properties
const uniqueAlgorithms = computed(() => {
  const algorithms = new Set()
  operations.value.forEach(op => {
    if (op.algorithm) {
      algorithms.add(op.algorithm)
    }
  })
  return Array.from(algorithms)
})

// Helper methods
const getOperationColorHex = (operation) => {
  const colors = {
    encrypt: '#2196F3',
    decrypt: '#00BCD4',
    hash: '#4CAF50',
    hmac: '#009688',
    sign: '#9C27B0',
    verify: '#3F51B5',
    key_generation: '#FF9800',
    key_derivation: '#FFC107',
    random_generation: '#E91E63'
  }
  return colors[operation] || '#9E9E9E'
}

const isAlgorithmWeak = (algorithm) => {
  if (!algorithm) return false
  const weakAlgorithms = ['MD5', 'SHA1', 'DES', 'RC4', 'RC2']
  return weakAlgorithms.some(weak => algorithm.toUpperCase().includes(weak))
}

const getEnhancedOperationClass = (operation) => {
  const classes = [`operation-${(operation.operation || 'unknown').toLowerCase().replace('_', '-')}`]
  const security = getOperationRisk(operation)

  if (operation.error) classes.push('has-error')
  if (operation.stackTrace) classes.push('has-stack-trace')
  if (operation.parameters && Object.keys(operation.parameters).length > 0) classes.push('has-parameters')
  if (security.risk === 'HIGH') classes.push('high-risk')
  if (security.risk === 'MEDIUM') classes.push('medium-risk')

  return classes
}

const formatParameterValue = (value) => {
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2)
  }
  return String(value)
}

// Hex dump utility functions
const hasHexData = (operation) => {
  if (!operation.parameters) return false

  // Check for common hex data fields
  const hexFields = ['key', 'iv', 'input', 'output']
  for (const field of hexFields) {
    if (operation.parameters[field] && isHexString(operation.parameters[field])) {
      return true
    }
  }

  // Check for any other hex-like strings in parameters
  for (const [key, value] of Object.entries(operation.parameters)) {
    if (typeof value === 'string' && isHexString(value)) {
      return true
    }
  }

  return false
}

const isHexString = (str) => {
  if (typeof str !== 'string' || str.length === 0) return false
  if (str.length < 8) return false // Must be at least 4 bytes
  if (str.length % 2 !== 0) return false // Must be even length
  return /^[0-9A-Fa-f]+$/.test(str)
}

const getHexByteLength = (hexStr) => {
  if (!isHexString(hexStr)) return 0
  return hexStr.length / 2
}

const formatHexDump = (hexStr, label = 'Data') => {
  if (!isHexString(hexStr)) return 'Invalid hex data'

  const bytes = []
  for (let i = 0; i < hexStr.length; i += 2) {
    bytes.push(hexStr.substr(i, 2))
  }

  let result = `${label} Hex Dump:\n`
  result += `${''.padStart(7, ' ')} | ${'HEX'.padStart(47, ' ')} | ASCII\n`
  result += `${''.padStart(7, '-')} | ${''.padStart(47, '-')} | ${''.padStart(16, '-')}\n`

  for (let i = 0; i < bytes.length; i += 16) {
    const offset = i.toString(16).padStart(5, '0').toUpperCase()
    const hexChunk = bytes.slice(i, i + 16)
    const hexLine = hexChunk.join(' ').padEnd(47, ' ')

    // Convert hex to ASCII, replace non-printable with '.'
    const asciiChunk = hexChunk.map(byte => {
      const charCode = parseInt(byte, 16)
      return (charCode >= 32 && charCode <= 126) ? String.fromCharCode(charCode) : '.'
    }).join('')

    result += `${offset} | ${hexLine} | ${asciiChunk}\n`
  }

  return result
}

const getAllHexData = (operation) => {
  if (!operation.parameters) return ''

  let allHex = ''
  const hexFields = ['key', 'iv', 'input', 'output']

  for (const field of hexFields) {
    if (operation.parameters[field] && isHexString(operation.parameters[field])) {
      allHex += formatHexDump(operation.parameters[field], field.toUpperCase()) + '\n\n'
    }
  }

  // Add other hex data
  for (const [key, value] of Object.entries(operation.parameters)) {
    if (typeof value === 'string' && isHexString(value) && !hexFields.includes(key)) {
      allHex += formatHexDump(value, key.toUpperCase()) + '\n\n'
    }
  }

  return allHex.trim()
}

const copyToClipboard = async (data) => {
  try {
    let text
    if (typeof data === 'object' && data !== null) {
      text = JSON.stringify(data, null, 2)
    } else {
      text = String(data)
    }

    await navigator.clipboard.writeText(text)
    emit('show-notification', { message: 'Copied to clipboard', type: 'success' })
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    emit('show-notification', { message: 'Failed to copy to clipboard', type: 'error' })
  }
}

const handleToggle = async (value) => {
  try {
    if (value) {
      await startMonitoring(props.deviceId, props.pid)
      emit('update:monitoring', true)
      emit('show-notification', { message: 'Crypto monitoring started', type: 'success' })
    } else {
      await stopMonitoring()
      emit('update:monitoring', false)
      emit('show-notification', { message: 'Crypto monitoring stopped', type: 'info' })
    }
  } catch (error) {
    isMonitoring.value = !value
    emit('show-notification', { message: `Error: ${error.message}`, type: 'error' })
  }
}

const handleExport = () => {
  const result = exportData()
  emit('show-notification', {
    message: result.message,
    type: result.success ? 'success' : 'error'
  })
}

// Watch for filter changes
watch([searchQuery, algorithmFilter, operationFilter], () => {
  applyFilters()
})

// Cleanup on unmount
onUnmounted(() => {
  if (isMonitoring.value) {
    stopMonitoring()
  }
  cleanup()
})
</script>

<style scoped>
/* Component-specific styles */
.crypto-card {
  border-color: rgba(156, 39, 176, 0.3);
  background: linear-gradient(145deg, #1a0a2a 0%, #1e1e1e 100%);
}

.crypto-card::before {
  background: linear-gradient(90deg, transparent, rgba(156, 39, 176, 0.4), transparent);
}

/* Crypto Security Dashboard */
.crypto-security-dashboard {
  padding: 20px;
  background: linear-gradient(145deg, #0a0a0a 0%, #111111 100%);
  border-radius: 12px;
  margin-bottom: 20px;
  border: 1px solid rgba(156, 39, 176, 0.2);
}

/* Algorithm Analysis */
.algorithm-analysis {
  margin-bottom: 24px;
}

.algorithm-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* Enhanced Operations List */
.enhanced-operations-list {
  background: linear-gradient(145deg, #0a0a0a 0%, #111111 100%);
  border-radius: 12px;
  padding: 20px;
  border: 1px solid rgba(156, 39, 176, 0.1);
}

.operations-container {
  max-height: 600px;
  overflow-y: auto;
}

/* Enhanced Operation Items */
.enhanced-operation-item {
  background: linear-gradient(145deg, #1a1a1a 0%, #252525 100%);
  border: 1px solid rgba(156, 39, 176, 0.1);
  border-radius: 12px;
  margin-bottom: 16px;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  position: relative;
}

.enhanced-operation-item:hover {
  border-color: rgba(156, 39, 176, 0.3);
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(156, 39, 176, 0.2);
}

.enhanced-operation-item.high-risk {
  border-left: 4px solid #f44336;
  background: linear-gradient(145deg, #2a1515 0%, #1a1a1a 100%);
}

.enhanced-operation-item.medium-risk {
  border-left: 4px solid #ff9800;
  background: linear-gradient(145deg, #2a1f10 0%, #1a1a1a 100%);
}

.enhanced-operation-item.has-error {
  border-left: 4px solid #f44336;
  background: linear-gradient(145deg, #2a0a0a 0%, #1a1a1a 100%);
}

/* Operation Header */
.enhanced-operation-header {
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.operation-main-info {
  flex: 1;
  min-width: 0;
}

.operation-badges {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.operation-badge, .algorithm-badge, .error-badge, .security-badge {
  font-weight: 600 !important;
  letter-spacing: 0.5px !important;
}

.operation-details-section {
  margin-top: 8px;
}

.operation-metadata {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #888;
}

.timestamp, .key-size, .data-size {
  font-family: 'SF Mono', monospace;
}

/* Parameters Section */
.parameters-section {
  space-y: 16px;
}

.parameters-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.parameters-title {
  font-size: 14px;
  font-weight: 600;
  color: #58a6ff;
}

.enhanced-parameters-list {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  max-height: 300px;
  overflow-y: auto;
}

.enhanced-parameter-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.enhanced-parameter-item:last-child {
  border-bottom: none;
}

.parameter-key {
  font-size: 12px;
  color: #2196f3;
  font-weight: 600;
  font-family: 'SF Mono', monospace;
  min-width: 0;
  max-width: 40%;
  word-break: break-word;
}

.parameter-value {
  font-size: 12px;
  color: #ccc;
  font-family: 'SF Mono', monospace;
  word-break: break-all;
  text-align: right;
  max-width: 60%;
}

/* Stack Trace Section */
.stack-section {
  space-y: 16px;
}

.stack-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.stack-title {
  font-size: 14px;
  font-weight: 600;
  color: #58a6ff;
}

.enhanced-stack-content {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
}

.stack-text {
  padding: 16px;
  font-size: 11px;
  color: #e6e6e6;
  font-family: 'SF Mono', monospace;
  line-height: 1.4;
  max-height: 400px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

/* Error Section */
.error-section {
  space-y: 16px;
}

.error-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.error-title {
  font-size: 14px;
  font-weight: 600;
  color: #f44336;
}

.enhanced-error-content {
  background: rgba(244, 67, 54, 0.1);
  border: 1px solid rgba(244, 67, 54, 0.2);
  border-radius: 8px;
  padding: 16px;
}

.error-message {
  display: flex;
  align-items: flex-start;
  color: #ff6b6b;
  font-family: 'SF Mono', monospace;
  font-size: 13px;
  line-height: 1.4;
}

/* Success/Error text colors */
.success-text {
  color: #4caf50 !important;
}

.error-text {
  color: #ff6b6b !important;
}

/* Hex Dump Section */
.hexdump-section {
  space-y: 16px;
}

.hexdump-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.hexdump-title {
  font-size: 14px;
  font-weight: 600;
  color: #58a6ff;
}

.hexdump-container {
  max-height: 500px;
  overflow-y: auto;
}

.hex-data-block {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 16px;
  overflow: hidden;
}

.hex-data-label {
  background: rgba(88, 166, 255, 0.1);
  border-bottom: 1px solid rgba(88, 166, 255, 0.2);
  padding: 8px 12px;
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  color: #58a6ff;
}

.hexdump-content {
  padding: 0;
}

.hexdump-text {
  padding: 12px;
  font-size: 11px;
  color: #e6e6e6;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
  line-height: 1.3;
  margin: 0;
  background: rgba(0, 0, 0, 0.4);
  white-space: pre;
  overflow-x: auto;
}

.hexdump-text::-webkit-scrollbar {
  height: 8px;
}

.hexdump-text::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

.hexdump-text::-webkit-scrollbar-thumb {
  background: rgba(88, 166, 255, 0.3);
  border-radius: 4px;
}

.hexdump-text::-webkit-scrollbar-thumb:hover {
  background: rgba(88, 166, 255, 0.5);
}

/* Raw crypto output */
.crypto-output::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(156, 39, 176, 0.4) 0%, rgba(156, 39, 176, 0.2) 100%);
}

.crypto-output::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(156, 39, 176, 0.6) 0%, rgba(156, 39, 176, 0.4) 100%);
}
</style>
