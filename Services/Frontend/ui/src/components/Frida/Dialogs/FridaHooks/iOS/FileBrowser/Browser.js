// Browser.js - File Browser composable using Frida agent RPC functions
// Supports both iOS and Android file browsing, downloading, uploading, search
import { ref, computed, watch, onMounted } from 'vue'
import axios from 'axios'

export function usePentestBrowser(props, emit) {
  // ===== STATE =====
  const currentPath = ref('')
  const pathHistory = ref([])
  const directoryContents = ref([])
  const loading = ref(false)
  const searchTerm = ref('')
  const selectedItems = ref(new Set())
  const selectedTableItems = ref([])
  const viewMode = ref('list')
  const showHidden = ref(true)
  const sortBy = ref('name')
  const sortOrder = ref('asc')
  const appPaths = ref(null)
  const platform = ref(null) // 'ios' or 'android'
  const totalEntries = ref(0)
  const truncated = ref(false)
  const testing = ref(false)

  // File viewer state
  const selectedFile = ref(null)
  const showFileViewer = ref(false)
  const fileContent = ref('')
  const fileEncoding = ref('utf-8')
  const loadingFileContent = ref(false)
  const fileInfo = ref(null)

  // Search state
  const showSearchPanel = ref(false)
  const searchPattern = ref('')
  const searchBasePath = ref('')
  const searchMaxDepth = ref(5)
  const searchResults = ref([])
  const searchLoading = ref(false)
  const searchTruncated = ref(false)

  // Upload state
  const showUploadDialog = ref(false)
  const uploadPath = ref('')
  const uploadLoading = ref(false)

  // Create directory state
  const showCreateDirDialog = ref(false)
  const newDirName = ref('')
  const createDirLoading = ref(false)

  // Context menu state
  const showContextMenu = ref(false)
  const contextMenuX = ref(0)
  const contextMenuY = ref(0)
  const contextMenuItem = ref(null)

  // Debug / error
  const debugOutput = ref('')
  const lastError = ref(null)

  const API_BASE = import.meta.env.VITE_APP_API_URL || 'http://localhost:5000'

  // ===== UTILITY FUNCTIONS =====
  const showNotification = (message, type = 'info') => {
    emit('show-notification', { message, type })
  }

  const formatFileSize = (bytes) => {
    const n = Number(bytes)
    // Guard NaN / null / negative / Infinity so we never render "NaN undefined".
    if (!Number.isFinite(n) || n <= 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    // Clamp the unit index so sizes beyond TB don't produce `undefined`.
    const i = Math.min(Math.floor(Math.log(n) / Math.log(k)), sizes.length - 1)
    return parseFloat((n / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString) => {
    if (!dateString) return '—'
    const d = new Date(dateString)
    // Guard invalid input so the UI shows "—" instead of "Invalid Date".
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Best-effort permission formatting. iOS returns octal, sometimes with type
  // bits (e.g. '100644', '40755'); render the low 3 digits symbolically as
  // 'rw-r--r--'. Android returns symbolic strings ('rw'/'rwx') — pass through.
  const formatPermissions = (perms) => {
    if (perms == null || perms === '') return '—'
    const s = String(perms).trim()
    if (!/^[0-7]+$/.test(s)) return s
    const octal = s.slice(-3).padStart(3, '0')
    const map = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx']
    return octal.split('').map(d => map[Number(d)]).join('')
  }

  // ===== RPC COMMUNICATION =====
  const executeRPC = async (command) => {
    try {
      const sessionId = props.sessionId || 'default'
      const response = await axios.post(`${API_BASE}/frida/execute-with-agent`, {
        session_id: sessionId,
        command: command
      })
      if (response.data.status === 'success') {
        return response.data.result
      } else {
        throw new Error(response.data.message || 'Command failed')
      }
    } catch (error) {
      if (error.response?.status === 404 || error.message?.includes('session')) {
        throw new Error('Agent session not found. Please load the agent first.')
      }
      throw error
    }
  }

  // Escape path for safe inclusion in RPC command strings
  const escapePath = (path) => path.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

  // ===== CORE FILESYSTEM OPERATIONS =====

  // NOTE: The backend's /execute-with-agent endpoint double-unwraps responses.
  // If agent returns { success: true, data: { ... } }, backend returns result = { ... } (the inner data).
  // So executeRPC() returns the already-unwrapped data in most cases.
  // We handle both unwrapped (result IS the data) and wrapped (result.success + result.data) formats.

  const getAppPaths = async () => {
    // Try spec RPC function first
    try {
      const result = await executeRPC('getAppPaths()')
      // Backend unwraps: result is likely { bundleId, platform, paths: [...] }
      if (result?.paths) return result
      // Or still wrapped: { success, data: { paths } }
      if (result?.success && result?.data?.paths) return result.data
      if (result?.success && result?.paths) return result
    } catch (e) {
      console.log('getAppPaths() not available, trying legacy...', e.message)
    }
    // Fallback: try legacy function name
    try {
      const legacy = await executeRPC('getAppDirectoryPaths()')
      // Legacy returns { success, paths: { home, documents, ... } } or unwrapped { paths: {...} }
      if (legacy?.paths) return legacy
      if (legacy?.success && legacy?.data?.paths) return legacy.data
    } catch (e) {
      console.log('getAppDirectoryPaths() also failed:', e.message)
    }
    throw new Error('Failed to get app paths - no RPC function available')
  }

  const listDirectory = async (path) => {
    const result = await executeRPC(`listDirectory("${escapePath(path)}")`)
    // Backend-unwrapped: result = { path, entries, parentPath, totalEntries, truncated }
    if (result?.entries) return result
    // Still wrapped: { success, data: { entries } }
    if (result?.success && result?.data?.entries) return result.data
    // Legacy: { listing: { items, itemCount } }
    if (result?.listing) {
      return {
        path: path,
        entries: result.listing.items || [],
        parentPath: path === '/' ? null : path.substring(0, path.lastIndexOf('/')) || '/',
        totalEntries: result.listing.itemCount || result.listing.items?.length || 0,
        truncated: false
      }
    }
    throw new Error(result?.error || 'Failed to list directory')
  }

  const readFileRPC = async (path, offset = 0, length = null) => {
    let cmd = `readFile("${escapePath(path)}"`
    if (offset > 0 || length) {
      cmd += `, ${offset}`
      if (length) cmd += `, ${length}`
    }
    cmd += ')'
    const result = await executeRPC(cmd)
    // Unwrapped: result = { path, content, encoding, size, ... }
    if (result?.content !== undefined) return result
    // Wrapped
    if (result?.success && result?.data) return result.data
    if (result?.success) return result
    throw new Error(result?.error || 'Failed to read file')
  }

  const downloadFileRPC = async (path) => {
    const result = await executeRPC(`downloadFile("${escapePath(path)}")`)
    // Unwrapped: result = { path, fileName, size, base64, mimeType }
    if (result?.base64) return result
    // Wrapped
    if (result?.success && result?.data) return result.data
    if (result?.success) return result
    throw new Error(result?.error || 'Failed to download file')
  }

  const writeFileRPC = async (path, dataBase64) => {
    const result = await executeRPC(`writeFile("${escapePath(path)}", "${dataBase64}")`)
    // Any truthy result without error is success (backend already checked success)
    if (result && !result?.error) return result
    throw new Error(result?.error || 'Failed to write file')
  }

  const deleteFileRPC = async (path) => {
    const result = await executeRPC(`deleteFile("${escapePath(path)}")`)
    if (result && !result?.error) return result
    throw new Error(result?.error || 'Failed to delete file')
  }

  const createDirectoryRPC = async (path) => {
    const result = await executeRPC(`createDirectory("${escapePath(path)}")`)
    if (result && !result?.error) return result
    throw new Error(result?.error || 'Failed to create directory')
  }

  const getFileInfoRPC = async (path) => {
    const result = await executeRPC(`getFileInfo("${escapePath(path)}")`)
    // Unwrapped: result = { path, fileName, size, ... }
    if (result?.path || result?.fileName) return result
    // Wrapped
    if (result?.success && result?.data) return result.data
    if (result?.success) return result
    throw new Error(result?.error || 'Failed to get file info')
  }

  const searchFilesRPC = async (basePath, pattern, maxDepth = 5) => {
    const result = await executeRPC(`searchFiles("${escapePath(basePath)}", "${escapePath(pattern)}", ${maxDepth})`)
    // Unwrapped: result = { basePath, pattern, results, totalResults, truncated }
    if (result?.results) return result
    // Wrapped
    if (result?.success && result?.data) return result.data
    if (result?.success) return result
    throw new Error(result?.error || 'Search failed')
  }

  // ===== INITIALIZATION =====
  const initializeFilesystem = async () => {
    try {
      loading.value = true

      const pathsData = await getAppPaths()

      if (pathsData) {
        platform.value = pathsData.platform || null

        // Normalize paths - handle both spec format (paths array) and legacy format (paths object)
        if (Array.isArray(pathsData.paths)) {
          // Spec format: array of { label, path, description }
          appPaths.value = pathsData.paths
        } else if (pathsData.paths && typeof pathsData.paths === 'object') {
          // Legacy format: { home: '/...', documents: '/...' }
          const legacyPaths = pathsData.paths
          appPaths.value = Object.entries(legacyPaths)
            .filter(([, v]) => v && v !== 'null')
            .map(([key, path]) => ({
              label: key.charAt(0).toUpperCase() + key.slice(1),
              path: path,
              description: key
            }))
        } else {
          appPaths.value = []
        }

        // Determine starting path
        let startPath = '/'
        if (Array.isArray(appPaths.value) && appPaths.value.length > 0) {
          // Try Documents/Home first, then first available
          const preferred = ['Documents', 'Home', 'Data Dir', 'Internal Files']
          const found = appPaths.value.find(p => preferred.includes(p.label))
          startPath = found?.path || appPaths.value[0].path
        }

        currentPath.value = startPath
        await loadDirectory(startPath)
        showNotification('File browser ready', 'success')
      } else {
        // Fallback to root
        currentPath.value = '/'
        await loadDirectory('/')
        showNotification('File browser ready (root fallback)', 'warning')
      }
    } catch (error) {
      console.error('File browser init error:', error)
      showNotification(`Init error: ${error.message}`, 'error')
      // Try root as ultimate fallback
      try {
        currentPath.value = '/'
        await loadDirectory('/')
      } catch (e) {
        showNotification('File browser failed to initialize', 'error')
      }
    } finally {
      loading.value = false
    }
  }

  // ===== DIRECTORY LOADING =====
  const loadDirectory = async (path) => {
    try {
      loading.value = true
      if (!path || path === 'undefined' || path === 'null') {
        throw new Error('Invalid directory path')
      }

      const listing = await listDirectory(path)

      // Handle both spec format (entries) and legacy format (items)
      const entries = listing.entries || listing.items || []
      directoryContents.value = entries
      totalEntries.value = listing.totalEntries || entries.length
      truncated.value = listing.truncated || false
      currentPath.value = path

      emit('stats-update', {
        totalFiles: entries.filter(e => !e.isDirectory).length,
        totalDirectories: entries.filter(e => e.isDirectory).length,
        currentPath: path,
        itemCount: entries.length
      })
    } catch (error) {
      console.error(`Failed to load ${path}:`, error)
      showNotification(`Failed to load directory: ${error.message}`, 'error')
      directoryContents.value = []
    } finally {
      loading.value = false
    }
  }

  // ===== FILE READING =====
  const readFileContent = async (file) => {
    try {
      loadingFileContent.value = true
      const data = await readFileRPC(file.path)

      fileContent.value = data.content || ''
      fileEncoding.value = data.encoding || 'utf-8'

      // Try to get file info too
      try {
        fileInfo.value = await getFileInfoRPC(file.path)
      } catch (e) {
        fileInfo.value = null
      }

      showNotification(`File loaded (${formatFileSize(data.size || data.totalSize || 0)})`, 'success')
    } catch (error) {
      console.error('Read error:', error)
      showNotification(`Read error: ${error.message}`, 'error')
      fileContent.value = `Error reading file: ${error.message}`
      fileEncoding.value = 'utf-8'
    } finally {
      loadingFileContent.value = false
    }
  }

  // ===== FILE DOWNLOAD =====
  const downloadFile = async (file) => {
    try {
      showNotification(`Downloading ${file.name}...`, 'info')
      const data = await downloadFileRPC(file.path)

      const base64 = data.base64
      const mimeType = data.mimeType || 'application/octet-stream'
      const fileName = data.fileName || file.name

      // Decode base64 to blob
      const byteCharacters = atob(base64)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: mimeType })

      // Trigger browser download
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      showNotification(`Downloaded: ${fileName} (${formatFileSize(data.size)})`, 'success')
    } catch (error) {
      console.error('Download error:', error)
      // Fallback: try readFile and download as text
      try {
        const data = await readFileRPC(file.path)
        const content = data.content || ''
        const blob = new Blob([content], { type: 'application/octet-stream' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = file.name
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        showNotification(`Downloaded: ${file.name} (text fallback)`, 'success')
      } catch (fallbackErr) {
        showNotification(`Download error: ${error.message}`, 'error')
      }
    }
  }

  const downloadMultipleFiles = async () => {
    const files = directoryContents.value.filter(
      item => selectedItems.value.has(item.path) && !item.isDirectory
    )
    if (files.length === 0) {
      showNotification('No files selected', 'warning')
      return
    }
    showNotification(`Downloading ${files.length} files...`, 'info')
    for (const file of files) {
      await downloadFile(file)
      await new Promise(r => setTimeout(r, 100))
    }
    selectedItems.value = new Set()
    showNotification('Batch download completed', 'success')
  }

  // ===== FILE UPLOAD =====
  const uploadFile = async (destinationPath, fileData) => {
    try {
      uploadLoading.value = true

      let base64Data
      if (fileData instanceof File) {
        base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result.split(',')[1])
          reader.onerror = reject
          reader.readAsDataURL(fileData)
        })
      } else {
        base64Data = fileData // Already base64
      }

      await writeFileRPC(destinationPath, base64Data)
      showNotification(`Uploaded to ${destinationPath}`, 'success')
      showUploadDialog.value = false
      await refreshCurrentDirectory()
    } catch (error) {
      showNotification(`Upload error: ${error.message}`, 'error')
    } finally {
      uploadLoading.value = false
    }
  }

  // ===== DELETE =====
  const deleteItem = async (item) => {
    try {
      await deleteFileRPC(item.path)
      showNotification(`Deleted: ${item.name}`, 'success')
      await refreshCurrentDirectory()
    } catch (error) {
      showNotification(`Delete error: ${error.message}`, 'error')
    }
  }

  // ===== CREATE DIRECTORY =====
  const createDirectory = async () => {
    try {
      createDirLoading.value = true
      const dirPath = currentPath.value.endsWith('/')
        ? `${currentPath.value}${newDirName.value}`
        : `${currentPath.value}/${newDirName.value}`
      await createDirectoryRPC(dirPath)
      showNotification(`Created directory: ${newDirName.value}`, 'success')
      showCreateDirDialog.value = false
      newDirName.value = ''
      await refreshCurrentDirectory()
    } catch (error) {
      showNotification(`Create directory error: ${error.message}`, 'error')
    } finally {
      createDirLoading.value = false
    }
  }

  // ===== SEARCH =====
  const searchFiles = async () => {
    try {
      searchLoading.value = true
      const basePath = searchBasePath.value || currentPath.value
      const data = await searchFilesRPC(basePath, searchPattern.value, searchMaxDepth.value)
      searchResults.value = data.results || []
      searchTruncated.value = data.truncated || false
      showNotification(`Found ${data.totalResults || searchResults.value.length} results`, 'info')
    } catch (error) {
      showNotification(`Search error: ${error.message}`, 'error')
      searchResults.value = []
    } finally {
      searchLoading.value = false
    }
  }

  // ===== NAVIGATION =====
  const navigateToPath = async (path) => {
    if (currentPath.value && currentPath.value !== path) {
      pathHistory.value.push(currentPath.value)
    }
    currentPath.value = path
    await loadDirectory(path)
    selectedItems.value = new Set()
  }

  const navigateBack = async () => {
    if (pathHistory.value.length > 0) {
      const previousPath = pathHistory.value.pop()
      currentPath.value = previousPath
      await loadDirectory(previousPath)
      selectedItems.value = new Set()
    }
  }

  const navigateToParent = async () => {
    if (!currentPath.value || currentPath.value === '/') return
    const parent = currentPath.value.substring(0, currentPath.value.lastIndexOf('/')) || '/'
    await navigateToPath(parent)
  }

  const navigateToHome = () => {
    if (!appPaths.value || appPaths.value.length === 0) return
    const home = appPaths.value.find(p => p.label === 'Home' || p.label === 'home')
    if (home) {
      navigateToPath(home.path)
    } else {
      navigateToPath(appPaths.value[0].path)
    }
  }

  const refreshCurrentDirectory = async () => {
    if (currentPath.value) {
      await loadDirectory(currentPath.value)
    }
  }

  // ===== SECURITY DETECTION =====
  const securityPatterns = [
    { pattern: /\.(db|sqlite|sqlite3|realm)$/i, risk: 'high', label: 'Database' },
    { pattern: /\.(plist)$/i, risk: 'medium', label: 'Property list' },
    { pattern: /shared_prefs\/.*\.xml$/i, risk: 'medium', label: 'SharedPreferences' },
    { pattern: /(token|key|secret|password|credential|auth)/i, risk: 'high', label: 'Credential file' },
    { pattern: /keychain.*\.db/i, risk: 'high', label: 'Keychain DB' },
    { pattern: /embedded\.mobileprovision$/i, risk: 'medium', label: 'Provisioning profile' },
    { pattern: /Info\.plist$/i, risk: 'medium', label: 'App config' },
    { pattern: /\.(key|pem|crt|cer|p12|pfx|jks|keystore)$/i, risk: 'high', label: 'Certificate/Key' },
  ]

  const getSecurityFlag = (item) => {
    if (item.isDirectory) return null
    const fullPath = item.path || item.name
    for (const sp of securityPatterns) {
      if (sp.pattern.test(fullPath)) {
        return sp
      }
    }
    // Check permissions — flag world-WRITABLE files (a real risk). World-readable
    // was too noisy (it fires on almost every normal 0755 file). Only interpret
    // NUMERIC octal strings: the Android agent often returns symbolic modes like
    // "rw"/"rwx", which must not be misparsed as octal digits.
    if (item.permissions) {
      const perms = String(item.permissions)
      if (/^[0-7]{3,4}$/.test(perms) && (parseInt(perms.slice(-1), 10) & 2)) {
        return { risk: 'high', label: 'World-writable' }
      }
    }
    return null
  }

  // ===== UI HELPERS =====
  const getFileIcon = (item) => {
    if (item.isDirectory) return 'mdi-folder'
    if (item.isSymlink) return 'mdi-link-variant'

    const ext = item.name.split('.').pop()?.toLowerCase()
    const iconMap = {
      'txt': 'mdi-file-document', 'log': 'mdi-file-document-outline', 'md': 'mdi-file-document',
      'plist': 'mdi-file-xml', 'json': 'mdi-code-json', 'xml': 'mdi-file-xml',
      'config': 'mdi-cog', 'conf': 'mdi-cog', 'ini': 'mdi-cog',
      'db': 'mdi-database', 'sqlite': 'mdi-database', 'sqlite3': 'mdi-database', 'realm': 'mdi-database',
      'key': 'mdi-key', 'pem': 'mdi-certificate', 'crt': 'mdi-certificate', 'cer': 'mdi-certificate',
      'p12': 'mdi-certificate', 'pfx': 'mdi-certificate', 'jks': 'mdi-key-chain', 'keystore': 'mdi-key-chain',
      'js': 'mdi-language-javascript', 'py': 'mdi-language-python', 'java': 'mdi-language-java',
      'swift': 'mdi-language-swift', 'c': 'mdi-language-c', 'cpp': 'mdi-language-cpp',
      'h': 'mdi-file-code', 'm': 'mdi-file-code',
      'jpg': 'mdi-file-image', 'jpeg': 'mdi-file-image', 'png': 'mdi-file-image', 'gif': 'mdi-file-image',
      'svg': 'mdi-file-image',
      'zip': 'mdi-archive', 'tar': 'mdi-archive', 'gz': 'mdi-archive', 'rar': 'mdi-archive',
      'apk': 'mdi-android', 'ipa': 'mdi-apple', 'dex': 'mdi-file-cog',
      'dylib': 'mdi-file-cog', 'so': 'mdi-file-cog', 'dll': 'mdi-file-cog',
      'pdf': 'mdi-file-pdf-box',
      'mobileprovision': 'mdi-certificate-outline',
    }
    return iconMap[ext] || 'mdi-file'
  }

  const getFileIconColor = (item) => {
    // Security flag takes priority
    const flag = getSecurityFlag(item)
    if (flag?.risk === 'high') return 'red'
    if (flag?.risk === 'medium') return 'orange'

    if (item.isDirectory) return 'blue'
    if (item.isSymlink) return 'cyan'

    const ext = item.name.split('.').pop()?.toLowerCase()
    const colorMap = {
      'db': 'red', 'sqlite': 'red', 'sqlite3': 'red', 'key': 'red', 'pem': 'red', 'p12': 'red',
      'plist': 'orange', 'config': 'orange', 'conf': 'orange', 'log': 'orange',
      'js': 'purple', 'py': 'purple', 'java': 'purple', 'swift': 'purple',
      'json': 'green', 'xml': 'green', 'txt': 'green',
      'dylib': 'grey', 'so': 'grey', 'dex': 'grey',
    }
    return colorMap[ext] || 'grey'
  }

  // ===== UI EVENT HANDLERS =====
  // Open the file viewer; reset any previously-loaded content and auto-preview
  // small files (text or binary) so the user needn't click "Read Content".
  const SMALL_FILE_AUTO_PREVIEW = 256 * 1024
  const openFileViewer = (item) => {
    selectedFile.value = item
    fileContent.value = ''
    fileEncoding.value = 'utf-8'
    fileInfo.value = null
    showFileViewer.value = true
    const size = Number(item.size)
    if (Number.isFinite(size) && size > 0 && size <= SMALL_FILE_AUTO_PREVIEW) {
      readFileContent(item)
    }
  }

  const handleItemClick = (item) => {
    if (item.isDirectory) {
      navigateToPath(item.path)
    } else {
      openFileViewer(item)
    }
  }

  // Cycle sort field/order from a table column header. Maps the 'modified'
  // column to the 'date' sort key used by filteredAndSortedItems.
  const toggleSort = (field) => {
    const key = field === 'modified' ? 'date' : field
    if (sortBy.value === key) {
      sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortBy.value = key
      sortOrder.value = 'asc'
    }
  }

  const handleItemSelect = (item, selected) => {
    const newSelected = new Set(selectedItems.value)
    if (selected) {
      newSelected.add(item.path)
    } else {
      newSelected.delete(item.path)
    }
    selectedItems.value = newSelected
  }

  const handleContextMenu = (event, item) => {
    event.preventDefault()
    contextMenuX.value = event.clientX
    contextMenuY.value = event.clientY
    contextMenuItem.value = item
    showContextMenu.value = true
  }

  const selectAll = () => {
    const newSelected = new Set()
    directoryContents.value.forEach(item => newSelected.add(item.path))
    selectedItems.value = newSelected
  }

  const clearSelection = () => {
    selectedItems.value = new Set()
  }

  const showItemActions = (item) => {
    openFileViewer(item)
  }

  // Debug helpers (kept for dev)
  const testDirectoryAccess = async () => {
    testing.value = true
    try {
      const result = await executeRPC('listDirectory("/")')
      debugOutput.value = JSON.stringify(result, null, 2)
    } catch (e) {
      debugOutput.value = `Error: ${e.message}`
    } finally {
      testing.value = false
    }
  }

  const listRootDirectory = async () => {
    testing.value = true
    try {
      await navigateToPath('/')
    } finally {
      testing.value = false
    }
  }

  // ===== COMPUTED PROPERTIES =====
  const effectiveSessionId = computed(() => props.sessionId || 'default')

  const breadcrumbItems = computed(() => {
    if (!currentPath.value) return []
    const parts = currentPath.value.split('/').filter(Boolean)
    const items = [{
      title: '/',
      disabled: false,
      onClick: () => navigateToPath('/')
    }]
    let buildPath = ''
    parts.forEach((part, index) => {
      buildPath += '/' + part
      const pathCopy = buildPath
      items.push({
        title: part,
        disabled: index === parts.length - 1,
        onClick: () => navigateToPath(pathCopy)
      })
    })
    return items
  })

  const quickAccessPaths = computed(() => {
    if (!appPaths.value || !Array.isArray(appPaths.value)) return []

    const iconForLabel = (label) => {
      const map = {
        'App Bundle': 'mdi-package-variant', 'Documents': 'mdi-file-document',
        'Library': 'mdi-library', 'Caches': 'mdi-cached', 'Temp': 'mdi-folder-clock',
        'Home': 'mdi-home', 'Keychain DB': 'mdi-key-chain', 'System Root': 'mdi-folder-network',
        'Internal Files': 'mdi-folder-lock', 'Cache': 'mdi-cached',
        'External Files': 'mdi-sd', 'External Cache': 'mdi-sd',
        'Data Dir': 'mdi-database', 'Databases': 'mdi-database',
        'Shared Prefs': 'mdi-cog', 'Code Cache': 'mdi-code-braces',
        'SD Card': 'mdi-sd', '/data/data': 'mdi-folder-network',
        'Resources': 'mdi-folder-multiple', 'Preferences': 'mdi-cog',
        'Cookies': 'mdi-cookie', 'Bundle': 'mdi-package-variant',
      }
      return map[label] || 'mdi-folder'
    }

    const colorForLabel = (label) => {
      const map = {
        'App Bundle': 'red', 'Documents': 'green', 'Library': 'purple',
        'Caches': 'orange', 'Temp': 'grey', 'Home': 'blue',
        'Keychain DB': 'red', 'System Root': 'red',
        'Internal Files': 'blue', 'Data Dir': 'blue', 'Databases': 'red',
        'Shared Prefs': 'orange', 'SD Card': 'green',
      }
      return map[label] || 'blue-grey'
    }

    return appPaths.value
      .filter(p => p.path && p.path !== 'null')
      .map(p => ({
        name: p.label,
        path: p.path,
        description: p.description || '',
        icon: iconForLabel(p.label),
        color: colorForLabel(p.label)
      }))
  })

  const filteredAndSortedItems = computed(() => {
    let items = directoryContents.value.filter(item => {
      if (!showHidden.value && item.name.startsWith('.')) return false
      if (searchTerm.value) {
        return item.name.toLowerCase().includes(searchTerm.value.toLowerCase())
      }
      return true
    })

    items.sort((a, b) => {
      // Directories first
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1

      let aVal, bVal
      switch (sortBy.value) {
        case 'name':
          aVal = a.name.toLowerCase()
          bVal = b.name.toLowerCase()
          break
        case 'date':
          aVal = new Date(a.modified || a.modificationDate || 0).getTime() || 0
          bVal = new Date(b.modified || b.modificationDate || 0).getTime() || 0
          break
        case 'size':
          aVal = a.size || 0
          bVal = b.size || 0
          break
        default:
          aVal = a.name.toLowerCase()
          bVal = b.name.toLowerCase()
      }
      if (aVal < bVal) return sortOrder.value === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder.value === 'asc' ? 1 : -1
      return 0
    })

    return items
  })

  const selectedFiles = computed(() => {
    return directoryContents.value.filter(
      item => selectedItems.value.has(item.path) && !item.isDirectory
    )
  })

  const listHeaders = [
    // sortable:false — sorting is driven by the composable (filteredAndSortedItems,
    // which keeps directories-first) via clickable header slots, not the table's
    // own sort, so the two no longer compete.
    { title: 'Name', key: 'name', sortable: false },
    { title: 'Size', key: 'size', sortable: false },
    { title: 'Modified', key: 'modified', sortable: false },
    { title: 'Permissions', key: 'permissions', sortable: false },
    { title: '', key: 'actions', sortable: false, width: '48px' }
  ]

  // Search presets
  const searchPresets = [
    { label: '*.db', pattern: '*.db' },
    { label: '*.plist', pattern: '*.plist' },
    { label: '*password*', pattern: '*password*' },
    { label: '*token*', pattern: '*token*' },
    { label: '*secret*', pattern: '*secret*' },
    { label: '*.json', pattern: '*.json' },
    { label: '*.xml', pattern: '*.xml' },
  ]

  // ===== LIFECYCLE =====
  onMounted(() => {
    if (props.agentLoaded) {
      initializeFilesystem()
    }
    document.addEventListener('click', () => {
      showContextMenu.value = false
    })
  })

  watch(() => props.agentLoaded, (val) => {
    if (val) initializeFilesystem()
  })

  // ===== RETURN =====
  return {
    // State
    currentPath, pathHistory, directoryContents, loading, testing,
    searchTerm, selectedItems, selectedTableItems, viewMode, showHidden,
    sortBy, sortOrder, appPaths, platform, totalEntries, truncated,
    selectedFile, showFileViewer, fileContent, fileEncoding, loadingFileContent, fileInfo,
    showSearchPanel, searchPattern, searchBasePath, searchMaxDepth, searchResults,
    searchLoading, searchTruncated, searchPresets,
    showUploadDialog, uploadPath, uploadLoading,
    showCreateDirDialog, newDirName, createDirLoading,
    showContextMenu, contextMenuX, contextMenuY, contextMenuItem,
    debugOutput, lastError, effectiveSessionId,

    // Computed
    breadcrumbItems, quickAccessPaths, filteredAndSortedItems, selectedFiles, listHeaders,

    // Methods
    navigateBack, navigateToParent, navigateToHome, refreshCurrentDirectory,
    navigateToPath, handleItemClick, handleItemSelect, handleContextMenu,
    readFileContent, downloadFile, downloadMultipleFiles,
    uploadFile, deleteItem, createDirectory, searchFiles,
    selectAll, clearSelection, showItemActions, openFileViewer, toggleSort,
    getFileIcon, getFileIconColor, getSecurityFlag, formatFileSize, formatDate, formatPermissions,
    testDirectoryAccess, listRootDirectory,
  }
}
