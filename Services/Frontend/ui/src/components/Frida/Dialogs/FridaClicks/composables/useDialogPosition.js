// composables/useDialogPosition.js
import { computed, onMounted, onUnmounted, ref } from 'vue'

export function useDialogPosition(dialogRef, store) {
  let isDragging = false
  let isResizing = false
  let startX = 0
  let startY = 0
  let startWidth = 0
  let startHeight = 0
  let startLeft = 0
  let startTop = 0
  let rafId = null

  // Get dialog position from store
  const dialogPosition = computed(() => store.getters['frida/dialogPosition'])

  const dialogStyle = computed(() => ({
    position: 'fixed',
    zIndex: 9999,
    top: `${dialogPosition.value.top}px`,
    left: `${dialogPosition.value.left}px`,
    width: `${dialogPosition.value.width}px`,
    height: `${dialogPosition.value.height}px`,
  }))

  const updateDialogPosition = (updates) => {
    store.dispatch('frida/updateDialogPosition', updates)
  }

  const onMouseDown = (e) => {
    if (!dialogRef.value) return

    // Check if clicking on header for dragging
    if (e.target.closest('.vss-movable')) {
      isDragging = true
      startX = e.clientX
      startY = e.clientY
      startLeft = dialogPosition.value.left
      startTop = dialogPosition.value.top

      // Add visual feedback
      dialogRef.value.style.transition = 'none'
      dialogRef.value.style.opacity = '0.95'
      addDragStyles()
    } else if (e.target.closest('.resizer-handle')) {
      isResizing = true
      startX = e.clientX
      startY = e.clientY
      startWidth = dialogPosition.value.width
      startHeight = dialogPosition.value.height

      dialogRef.value.style.transition = 'none'
      addDragStyles()
    }

    if (isDragging || isResizing) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  const onMouseMove = (e) => {
    if (!isDragging && !isResizing) return

    e.preventDefault()

    // Cancel any pending animation frame
    if (rafId) {
      cancelAnimationFrame(rafId)
    }

    // Use requestAnimationFrame for smooth 60fps updates
    rafId = requestAnimationFrame(() => {
      if (isDragging) {
        const dx = e.clientX - startX
        const dy = e.clientY - startY

        // Calculate new position
        const newLeft = startLeft + dx
        const newTop = startTop + dy

        // Smooth constraint checking with window bounds
        const maxLeft = window.innerWidth - dialogPosition.value.width
        const maxTop = window.innerHeight - dialogPosition.value.height

        // Add some padding from edges
        const edgePadding = 20

        // Update position
        updateDialogPosition({
          left: Math.max(edgePadding, Math.min(maxLeft - edgePadding, newLeft)),
          top: Math.max(edgePadding, Math.min(maxTop - edgePadding, newTop))
        })

      } else if (isResizing) {
        const dx = e.clientX - startX
        const dy = e.clientY - startY

        // Smooth resizing with constraints
        const newWidth = Math.max(600, Math.min(window.innerWidth - dialogPosition.value.left - 20, startWidth + dx))
        const newHeight = Math.max(500, Math.min(window.innerHeight - dialogPosition.value.top - 20, startHeight + dy))

        updateDialogPosition({
          width: newWidth,
          height: newHeight
        })
      }
    })
  }


  const onMouseUp = () => {
  if (isDragging) {
    // Restore smooth transitions after dragging
    if (dialogRef.value) {
      dialogRef.value.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      dialogRef.value.style.opacity = '1'
    }
  }

  if (isResizing) {
    // Restore smooth transitions after resizing
    if (dialogRef.value) {
      dialogRef.value.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    }
  }

  isDragging = false
  isResizing = false
  removeDragStyles()

  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

  const addDragStyles = () => {
    document.body.style.cursor = isDragging ? 'move' : isResizing ? 'se-resize' : ''
    document.body.style.userSelect = 'none'
    document.body.style.webkitUserSelect = 'none'
    document.body.style.msUserSelect = 'none'
  }

  const removeDragStyles = () => {
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    document.body.style.webkitUserSelect = ''
    document.body.style.msUserSelect = ''
  }

  // Touch support
  const onTouchStart = (e) => {
    const touch = e.touches[0]
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: touch.clientX,
      clientY: touch.clientY,
      bubbles: true
    })
    e.target.dispatchEvent(mouseEvent)
  }

  const onTouchMove = (e) => {
    const touch = e.touches[0]
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: touch.clientX,
      clientY: touch.clientY,
      bubbles: true
    })
    e.target.dispatchEvent(mouseEvent)
  }

  const onTouchEnd = (e) => {
    const mouseEvent = new MouseEvent('mouseup', {
      bubbles: true
    })
    e.target.dispatchEvent(mouseEvent)
  }

  // Center dialog
  const centerDialog = () => {
    const centerX = (window.innerWidth - dialogPosition.value.width) / 2
    const centerY = (window.innerHeight - dialogPosition.value.height) / 2

    if (dialogRef.value) {
      dialogRef.value.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    }

    updateDialogPosition({
      left: centerX,
      top: centerY
    })

    setTimeout(() => {
      if (dialogRef.value) {
        dialogRef.value.style.transition = ''
      }
    }, 300)
  }

  onMounted(() => {
    // Add event listeners
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('mouseleave', onMouseUp)

    // Touch support
    if (dialogRef.value) {
      dialogRef.value.addEventListener('touchstart', onTouchStart, { passive: false })
      dialogRef.value.addEventListener('touchmove', onTouchMove, { passive: false })
      dialogRef.value.addEventListener('touchend', onTouchEnd, { passive: false })

      // Double-click header to center dialog
      const headerEl = dialogRef.value.querySelector('.dialog-header')
      if (headerEl) {
        headerEl.addEventListener('dblclick', centerDialog)
      }
    }
  })

  onUnmounted(() => {
    // Remove event listeners
    document.removeEventListener('mousedown', onMouseDown)
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.removeEventListener('mouseleave', onMouseUp)

    if (dialogRef.value) {
      dialogRef.value.removeEventListener('touchstart', onTouchStart)
      dialogRef.value.removeEventListener('touchmove', onTouchMove)
      dialogRef.value.removeEventListener('touchend', onTouchEnd)

      const headerEl = dialogRef.value.querySelector('.dialog-header')
      if (headerEl) {
        headerEl.removeEventListener('dblclick', centerDialog)
      }
    }
  })

  return {
    dialogStyle,
    updateDialogPosition,
    centerDialog
  }
}
