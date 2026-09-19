// composables/useKeyboardShortcuts.js
import { onMounted, onUnmounted } from 'vue'

export function useKeyboardShortcuts(elementRef, shortcuts) {
  const handleKeydown = (e) => {
    // Check if the dialog is visible
    if (!elementRef.value || elementRef.value.style.display === 'none') return

    // Build the key combination string
    const parts = []
    if (e.ctrlKey || e.metaKey) parts.push('ctrl')
    if (e.altKey) parts.push('alt')
    if (e.shiftKey) parts.push('shift')

    // Add the actual key
    const key = e.key.toLowerCase()
    if (key === '+' || key === '=') {
      parts.push('=')
    } else if (key === '-' || key === '_') {
      parts.push('-')
    } else {
      parts.push(key)
    }

    const combination = parts.join('+')

    // Check if we have a handler for this combination
    if (shortcuts[combination]) {
      e.preventDefault()
      shortcuts[combination](e)
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
  })

  return {
    // Could expose methods to add/remove shortcuts dynamically if needed
  }
}
