import { ref, reactive, onMounted, onUnmounted } from 'vue'

export function useDialogResize() {
  // Dialog positioning and sizing
  const dialogSize = reactive({
    width: 1100,
    height: 800,
    top: 50,
    left: window.innerWidth - 1120,
  })

  const dialogStyle = reactive({
    position: 'fixed',
    zIndex: 9999,
    top: `${dialogSize.top}px`,
    left: `${dialogSize.left}px`,
    width: `${dialogSize.width}px`,
    height: `${dialogSize.height}px`,
  })

  // Dialog state
  const isMoving = ref(false)
  const isResizing = ref(false)
  const isFullscreen = ref(false)
  const isMinimized = ref(false)
  const previousSize = ref(null)

  // Move functionality
  const startMove = (event) => {
    if (isFullscreen.value) return

    event.preventDefault()
    isMoving.value = true

    const startX = event.clientX
    const startY = event.clientY
    const startLeft = dialogSize.left
    const startTop = dialogSize.top

    const handleMove = (e) => {
      if (!isMoving.value) return

      const deltaX = e.clientX - startX
      const deltaY = e.clientY - startY

      dialogSize.left = Math.max(0, Math.min(window.innerWidth - dialogSize.width, startLeft + deltaX))
      dialogSize.top = Math.max(0, Math.min(window.innerHeight - 50, startTop + deltaY))

      updateDialogStyle()
    }

    const stopMove = () => {
      isMoving.value = false
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', stopMove)
    }

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', stopMove)
  }

  // Resize functionality
  const startResize = (event) => {
    if (isFullscreen.value) return

    event.preventDefault()
    isResizing.value = true

    const startX = event.clientX
    const startY = event.clientY
    const startWidth = dialogSize.width
    const startHeight = dialogSize.height

    const handleResize = (e) => {
      if (!isResizing.value) return

      const deltaX = e.clientX - startX
      const deltaY = e.clientY - startY

      dialogSize.width = Math.max(600, Math.min(window.innerWidth - dialogSize.left, startWidth + deltaX))
      dialogSize.height = Math.max(400, Math.min(window.innerHeight - dialogSize.top, startHeight + deltaY))

      updateDialogStyle()
    }

    const stopResize = () => {
      isResizing.value = false
      document.removeEventListener('mousemove', handleResize)
      document.removeEventListener('mouseup', stopResize)
    }

    document.addEventListener('mousemove', handleResize)
    document.addEventListener('mouseup', stopResize)
  }

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (isFullscreen.value) {
      // Restore previous size
      if (previousSize.value) {
        Object.assign(dialogSize, previousSize.value)
        updateDialogStyle()
      }
      isFullscreen.value = false
    } else {
      // Save current size
      previousSize.value = { ...dialogSize }

      // Go fullscreen
      dialogSize.top = 0
      dialogSize.left = 0
      dialogSize.width = window.innerWidth
      dialogSize.height = window.innerHeight
      updateDialogStyle()
      isFullscreen.value = true
    }
  }

  // Minimize toggle
  const minimizeDialog = () => {
    isMinimized.value = !isMinimized.value
    if (isMinimized.value) {
      dialogStyle.height = '48px'
    } else {
      dialogStyle.height = `${dialogSize.height}px`
    }
  }

  // Update dialog style
  const updateDialogStyle = () => {
    dialogStyle.top = `${dialogSize.top}px`
    dialogStyle.left = `${dialogSize.left}px`
    dialogStyle.width = `${dialogSize.width}px`
    dialogStyle.height = isMinimized.value ? '48px' : `${dialogSize.height}px`
  }

  // Handle window resize
  const handleWindowResize = () => {
    // Ensure dialog stays within viewport
    if (dialogSize.left + dialogSize.width > window.innerWidth) {
      dialogSize.left = Math.max(0, window.innerWidth - dialogSize.width)
    }
    if (dialogSize.top + dialogSize.height > window.innerHeight) {
      dialogSize.top = Math.max(0, window.innerHeight - dialogSize.height)
    }
    updateDialogStyle()
  }

  // Lifecycle
  onMounted(() => {
    window.addEventListener('resize', handleWindowResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleWindowResize)
  })

  return {
    dialogStyle,
    isMoving,
    isResizing,
    isFullscreen,
    isMinimized,
    startMove,
    startResize,
    toggleFullscreen,
    minimizeDialog
  }
}
