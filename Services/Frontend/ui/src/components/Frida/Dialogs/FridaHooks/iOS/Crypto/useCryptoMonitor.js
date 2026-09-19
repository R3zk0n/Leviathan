// useCryptoMonitor.js - Optimized version with performance improvements

import { ref, reactive, nextTick, shallowRef, computed } from 'vue'
import axios from 'axios'

// Constants for performance tuning
const MAX_OPERATIONS_IN_MEMORY = 100 // Reduced from 200
const BATCH_SIZE = 10 // Process operations in batches
const DEBOUNCE_MS = 100 // Debounce UI updates
const VIRTUAL_SCROLL_BUFFER = 50 // Items to render at once

export function useCryptoMonitor(sessionId) {
  // Use shallowRef for better performance with large arrays
  const operations = shallowRef([])
  const output = ref('')
  const isLoading = ref(false)
  const showParsedView = ref(true)
  const searchQuery = ref('')
  const algorithmFilter = ref('ALL')
  const operationFilter = ref('ALL')
  const expandedOperations = ref(new Set())
  const activeOperationTab = reactive({})

  // Performance tracking
  const performanceStats = reactive({
    totalProcessed: 0,
    droppedOperations: 0,
    processingRate: 0,
    lastUpdateTime: Date.now()
  })

  // Batch processing queue
  const operationQueue = []
  let batchProcessor = null
  let updateDebouncer = null

  const stats = reactive({
    totalOperations: 0,
    operationBreakdown: {
      encrypt: 0,
      decrypt: 0,
      hash: 0,
      hmac: 0,
      sign: 0,
      verify: 0,
      key_generation: 0,
      key_derivation: 0,
      random_generation: 0,
      other: 0
    }
  })

  const securityStats = reactive({
    weakCrypto: 0,
    insecureOperations: 0,
    deprecatedAlgorithms: 0,
    highRiskOperations: 0,
    mediumRiskOperations: 0
  })

  let eventSource = null
  let isPaused = ref(false)
  let operationRate = ref(0)

  // Computed property for filtered operations with caching
  const filteredOperations = computed(() => {
    if (!operations.value || operations.value.length === 0) return []

    let filtered = operations.value

    if (searchQuery.value) {
      const search = searchQuery.value.toLowerCase()
      filtered = filtered.filter(op =>
        (op.algorithm && op.algorithm.toLowerCase().includes(search)) ||
        (op.operation && op.operation.toLowerCase().includes(search)) ||
        (op.error && op.error.toLowerCase().includes(search))
      )
    }

    if (algorithmFilter.value !== 'ALL') {
      filtered = filtered.filter(op =>
        op.algorithm && op.algorithm.toUpperCase().includes(algorithmFilter.value)
      )
    }

    if (operationFilter.value !== 'ALL') {
      filtered = filtered.filter(op => op.operation === operationFilter.value)
    }

    return filtered
  })

  // Security analysis functions (keep existing implementation)
  const getOperationRisk = (operation) => {
    let riskScore = 0
    const findings = []

    const weakAlgorithms = ['MD5', 'SHA1', 'DES', 'RC4', 'RC2']
    const deprecatedAlgorithms = ['3DES', 'CAST', 'Blowfish']

    if (operation.algorithm) {
      const algorithm = operation.algorithm.toUpperCase()

      if (weakAlgorithms.some(weak => algorithm.includes(weak))) {
        riskScore += 8
        findings.push(`Weak algorithm detected: ${operation.algorithm}`)
      } else if (deprecatedAlgorithms.some(deprecated => algorithm.includes(deprecated))) {
        riskScore += 5
        findings.push(`Deprecated algorithm: ${operation.algorithm}`)
      }
    }

    if (operation.keySize && operation.keySize < 128) {
      riskScore += 6
      findings.push(`Small key size: ${operation.keySize} bits`)
    } else if (operation.keySize && operation.keySize < 256) {
      riskScore += 3
      findings.push(`Below recommended key size: ${operation.keySize} bits`)
    }

    if (!operation.success) {
      riskScore += 2
      findings.push('Cryptographic operation failed')
    }

    if (operation.operation === 'encrypt' && operation.dataSize && operation.dataSize < 16) {
      riskScore += 1
      findings.push('Encrypting very small data')
    }

    return {
      score: Math.min(riskScore, 10),
      risk: riskScore >= 7 ? 'HIGH' : riskScore >= 4 ? 'MEDIUM' : riskScore >= 1 ? 'LOW' : 'NONE',
      findings
    }
  }

  const getOperationRiskColor = (operation) => {
    const risk = getOperationRisk(operation).risk
    switch (risk) {
      case 'HIGH': return 'error'
      case 'MEDIUM': return 'warning'
      case 'LOW': return 'orange'
      default: return 'success'
    }
  }

  const getAlgorithmColor = (algorithm) => {
    if (!algorithm) return 'grey'

    const alg = algorithm.toUpperCase()

    if (['MD5', 'SHA1', 'DES', 'RC4'].some(weak => alg.includes(weak))) {
      return 'error'
    }

    if (['3DES', 'CAST', 'BLOWFISH'].some(dep => alg.includes(dep))) {
      return 'warning'
    }

    if (['AES', 'SHA256', 'SHA384', 'SHA512', 'HMAC'].some(modern => alg.includes(modern))) {
      return 'success'
    }

    return 'info'
  }

  const getOperationColor = (operation) => {
    const colors = {
      encrypt: 'blue',
      decrypt: 'cyan',
      hash: 'green',
      hmac: 'teal',
      sign: 'purple',
      verify: 'indigo',
      key_generation: 'orange',
      key_derivation: 'amber',
      random_generation: 'pink'
    }
    return colors[operation] || 'grey'
  }

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatTimestamp = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
      })
    } catch (e) {
      return timestamp || 'Invalid'
    }
  }

  // Optimized stats update with debouncing
  const updateSecurityStats = () => {
    if (updateDebouncer) {
      clearTimeout(updateDebouncer)
    }

    updateDebouncer = setTimeout(() => {
      const stats = {
        weakCrypto: 0,
        insecureOperations: 0,
        deprecatedAlgorithms: 0,
        highRiskOperations: 0,
        mediumRiskOperations: 0
      }

      // Only process visible operations for performance
      const visibleOps = operations.value.slice(-VIRTUAL_SCROLL_BUFFER)

      visibleOps.forEach(operation => {
        const risk = getOperationRisk(operation)

        switch (risk.risk) {
          case 'HIGH':
            stats.highRiskOperations++
            stats.weakCrypto++
            break
          case 'MEDIUM':
            stats.mediumRiskOperations++
            break
        }

        if (operation.algorithm) {
          const alg = operation.algorithm.toUpperCase()
          if (['MD5', 'SHA1', 'DES', 'RC4'].some(weak => alg.includes(weak))) {
            stats.weakCrypto++
          }
          if (['3DES', 'CAST', 'BLOWFISH'].some(dep => alg.includes(dep))) {
            stats.deprecatedAlgorithms++
          }
        }

        if (!operation.success) {
          stats.insecureOperations++
        }
      })

      Object.assign(securityStats, stats)
    }, DEBOUNCE_MS)
  }

  const updateOperationStats = (operation) => {
    stats.totalOperations++

    const operationType = operation.operation || 'other'
    if (stats.operationBreakdown[operationType] !== undefined) {
      stats.operationBreakdown[operationType]++
    } else {
      stats.operationBreakdown.other++
    }
  }

  // Batch processing function
  const processBatch = () => {
    if (isPaused.value || operationQueue.length === 0) {
      batchProcessor = null
      return
    }

    const batch = operationQueue.splice(0, BATCH_SIZE)
    const currentOps = [...operations.value]

    batch.forEach(cryptoOperation => {
      currentOps.push(cryptoOperation)
      updateOperationStats(cryptoOperation)
    })

    // Keep operations list manageable
    if (currentOps.length > MAX_OPERATIONS_IN_MEMORY) {
      const dropped = currentOps.length - MAX_OPERATIONS_IN_MEMORY
      performanceStats.droppedOperations += dropped
      operations.value = currentOps.slice(-MAX_OPERATIONS_IN_MEMORY)
    } else {
      operations.value = currentOps
    }

    // Calculate processing rate
    const now = Date.now()
    const timeDiff = (now - performanceStats.lastUpdateTime) / 1000
    performanceStats.processingRate = Math.round(batch.length / timeDiff)
    performanceStats.lastUpdateTime = now
    operationRate.value = performanceStats.processingRate

    // Schedule next batch
    if (operationQueue.length > 0) {
      batchProcessor = requestAnimationFrame(processBatch)
    } else {
      // Update security stats after batch is complete
      nextTick(() => {
        updateSecurityStats()
      })
    }
  }

  const startMonitoring = async (deviceId, pid) => {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }

    isLoading.value = true
    isPaused.value = false
    operationQueue.length = 0 // Clear queue

    try {
      const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/start-feature`, {
        session_id: sessionId || 'default',
        device_id: deviceId,
        pid: pid,
        platform: 'ios',
        category: 'crypto',
        feature: 'cryptoMonitor',
      })

      if (response.data.status === 'success') {
        eventSource = new EventSource(
          `${import.meta.env.VITE_APP_API_URL}/frida/feature-stream/${sessionId || 'default'}/ios/crypto/cryptoMonitor`
        )

        eventSource.onmessage = (event) => {
          if (isPaused.value) return

          // Only add minimal raw output for debugging
          if (showParsedView.value === false) {
            output.value += event.data + '\n'
            const lines = output.value.split('\n')
            if (lines.length > 100) {
              output.value = lines.slice(-100).join('\n')
            }
          }

          performanceStats.totalProcessed++

          let cryptoOperationData = null

          try {
            const eventDataJson = JSON.parse(event.data)

            if (eventDataJson.type === 'crypto_operation') {
              cryptoOperationData = eventDataJson
            } else if (eventDataJson.payload && eventDataJson.payload.type === 'crypto_operation') {
              cryptoOperationData = eventDataJson.payload
            } else if (eventDataJson.data && eventDataJson.data.type === 'crypto_operation') {
              cryptoOperationData = eventDataJson.data
            }
          } catch (e) {
            // Skip unparseable data to avoid performance hit
            return
          }

          if (cryptoOperationData) {
            const cryptoOperation = {
              id: cryptoOperationData.id || `crypto_op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              timestamp: cryptoOperationData.timestamp || new Date().toISOString(),
              operation: cryptoOperationData.operation || 'unknown',
              algorithm: cryptoOperationData.algorithm || null,
              keySize: cryptoOperationData.keySize || null,
              dataSize: cryptoOperationData.dataSize || null,
              success: cryptoOperationData.success !== false,
              error: cryptoOperationData.error || null,
              parameters: cryptoOperationData.parameters || {},
              stackTrace: cryptoOperationData.stackTrace || null
            }

            // Add to queue for batch processing
            operationQueue.push(cryptoOperation)

            // Start batch processor if not running
            if (!batchProcessor) {
              batchProcessor = requestAnimationFrame(processBatch)
            }
          }
        }

        eventSource.onerror = (error) => {
          console.error('Crypto EventSource error:', error)
          setTimeout(() => {
            if (eventSource && !isPaused.value) {
              console.log('Attempting to reconnect crypto monitoring...')
              startMonitoring(deviceId, pid)
            }
          }, 3000)
        }

        console.log('Crypto monitoring started with performance optimizations')
      } else {
        throw new Error(response.data.message || 'Failed to start crypto monitoring')
      }
    } catch (error) {
      console.error('Error starting crypto monitoring:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const stopMonitoring = async () => {
    isPaused.value = true

    if (eventSource) {
      eventSource.close()
      eventSource = null
    }

    if (batchProcessor) {
      cancelAnimationFrame(batchProcessor)
      batchProcessor = null
    }

    try {
      await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/stop-feature`, {
        session_id: sessionId || 'default',
        platform: 'ios',
        category: 'crypto',
        feature: 'cryptoMonitor',
      })
    } catch (error) {
      console.error('Error stopping crypto monitoring:', error)
    }
  }

  const pauseMonitoring = () => {
    isPaused.value = !isPaused.value
    if (!isPaused.value && operationQueue.length > 0 && !batchProcessor) {
      batchProcessor = requestAnimationFrame(processBatch)
    }
  }

  const clearData = () => {
    operations.value = []
    output.value = ''
    operationQueue.length = 0
    stats.totalOperations = 0
    Object.keys(stats.operationBreakdown).forEach(key => {
      stats.operationBreakdown[key] = 0
    })
    expandedOperations.value.clear()
    performanceStats.totalProcessed = 0
    performanceStats.droppedOperations = 0
    updateSecurityStats()
  }

  const exportData = () => {
    try {
      const exportData = {
        exportInfo: {
          timestamp: new Date().toISOString(),
          totalOperations: operations.value.length,
          totalProcessed: performanceStats.totalProcessed,
          droppedOperations: performanceStats.droppedOperations,
          sessionId: sessionId,
          platform: 'ios'
        },
        statistics: {
          totalOperations: stats.totalOperations,
          operationBreakdown: { ...stats.operationBreakdown },
          securityStats: { ...securityStats },
          timeSpan: {
            first: operations.value[0]?.timestamp,
            last: operations.value[operations.value.length - 1]?.timestamp
          }
        },
        operations: operations.value.map(op => ({
          ...op,
          securityAnalysis: getOperationRisk(op)
        }))
      }

      const dataStr = JSON.stringify(exportData, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `ios_crypto_analysis_${sessionId}_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      return { success: true, message: 'Crypto analysis exported successfully' }
    } catch (error) {
      console.error('Crypto export error:', error)
      return { success: false, message: 'Failed to export crypto data' }
    }
  }

  const toggleOperationDetails = (operation) => {
    const operationId = operation.id || operation.timestamp
    if (expandedOperations.value.has(operationId)) {
      expandedOperations.value.delete(operationId)
      delete activeOperationTab[operationId]
    } else {
      expandedOperations.value.add(operationId)
      if (!activeOperationTab[operationId]) {
        activeOperationTab[operationId] = 'overview'
      }
    }
  }

  const toggleView = () => {
    showParsedView.value = !showParsedView.value
  }

  const clearFilters = () => {
    searchQuery.value = ''
    algorithmFilter.value = 'ALL'
    operationFilter.value = 'ALL'
  }

  const applyFilters = () => {
    // Filters are now handled by computed property
  }

  // Filter options
  const algorithmFilterOptions = [
    { title: 'All Algorithms', value: 'ALL' },
    { title: 'AES', value: 'AES' },
    { title: 'SHA256', value: 'SHA256' },
    { title: 'SHA512', value: 'SHA512' },
    { title: 'HMAC', value: 'HMAC' },
    { title: 'RSA', value: 'RSA' },
    { title: 'MD5 (Weak)', value: 'MD5' },
    { title: 'SHA1 (Weak)', value: 'SHA1' },
    { title: 'DES (Weak)', value: 'DES' }
  ]

  const operationFilterOptions = [
    { title: 'All Operations', value: 'ALL' },
    { title: 'Encrypt', value: 'encrypt' },
    { title: 'Decrypt', value: 'decrypt' },
    { title: 'Hash', value: 'hash' },
    { title: 'HMAC', value: 'hmac' },
    { title: 'Sign', value: 'sign' },
    { title: 'Verify', value: 'verify' },
    { title: 'Key Generation', value: 'key_generation' },
    { title: 'Key Derivation', value: 'key_derivation' },
    { title: 'Random Generation', value: 'random_generation' }
  ]

  // Cleanup
  const cleanup = () => {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    if (batchProcessor) {
      cancelAnimationFrame(batchProcessor)
      batchProcessor = null
    }
    if (updateDebouncer) {
      clearTimeout(updateDebouncer)
      updateDebouncer = null
    }
  }

  return {
    // Data
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
    isPaused,
    operationRate,
    performanceStats,

    // Options
    algorithmFilterOptions,
    operationFilterOptions,

    // Methods
    startMonitoring,
    stopMonitoring,
    pauseMonitoring,
    clearData,
    exportData,
    toggleOperationDetails,
    toggleView,
    clearFilters,
    applyFilters,
    cleanup,

    // Utilities
    getOperationRisk,
    getOperationRiskColor,
    getAlgorithmColor,
    getOperationColor,
    formatBytes,
    formatTimestamp,
    updateSecurityStats
  }
}
