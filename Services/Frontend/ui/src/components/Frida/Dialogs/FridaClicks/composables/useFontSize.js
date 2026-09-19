// composables/useFontSize.js
import { ref, computed, onMounted } from 'vue'

const FONT_SIZE_KEY = 'fridaClicks_fontSize'
const MIN_FONT_SIZE = 10
const MAX_FONT_SIZE = 20
const DEFAULT_FONT_SIZE = 12
const FONT_SIZE_STEP = 1

export function useFontSize() {
  // State
  const fontSize = ref(DEFAULT_FONT_SIZE)

  // Computed styles
  const dynamicFontStyle = computed(() => ({
    fontSize: `${fontSize.value}px`,
    lineHeight: `${fontSize.value * 1.6}px`
  }))

  const dynamicHeaderFontStyle = computed(() => ({
    fontSize: `${fontSize.value + 2}px`,
    lineHeight: `${(fontSize.value + 2) * 1.5}px`
  }))

  const dynamicTitleFontStyle = computed(() => ({
    fontSize: `${fontSize.value + 4}px`,
    lineHeight: `${(fontSize.value + 4) * 1.5}px`
  }))

  // Methods
  const increaseFontSize = () => {
    if (fontSize.value < MAX_FONT_SIZE) {
      fontSize.value = Math.min(fontSize.value + FONT_SIZE_STEP, MAX_FONT_SIZE)
      saveFontPreference()
      return { success: true, message: `Font size increased to ${fontSize.value}px` }
    }
    return { success: false, message: 'Maximum font size reached' }
  }

  const decreaseFontSize = () => {
    if (fontSize.value > MIN_FONT_SIZE) {
      fontSize.value = Math.max(fontSize.value - FONT_SIZE_STEP, MIN_FONT_SIZE)
      saveFontPreference()
      return { success: true, message: `Font size decreased to ${fontSize.value}px` }
    }
    return { success: false, message: 'Minimum font size reached' }
  }

  const resetFontSize = () => {
    fontSize.value = DEFAULT_FONT_SIZE
    saveFontPreference()
    return { success: true, message: 'Font size reset to default' }
  }

  const setFontSize = (size) => {
    const validSize = Math.min(Math.max(size, MIN_FONT_SIZE), MAX_FONT_SIZE)
    fontSize.value = validSize
    saveFontPreference()
    return { success: true, message: `Font size set to ${validSize}px` }
  }

  const saveFontPreference = () => {
    try {
      localStorage.setItem(FONT_SIZE_KEY, fontSize.value.toString())
    } catch (e) {
      console.warn('Unable to save font preference:', e)
    }
  }

  const loadFontPreference = () => {
    try {
      const saved = localStorage.getItem(FONT_SIZE_KEY)
      if (saved) {
        const savedSize = parseInt(saved)
        if (!isNaN(savedSize)) {
          fontSize.value = Math.min(Math.max(savedSize, MIN_FONT_SIZE), MAX_FONT_SIZE)
        }
      }
    } catch (e) {
      console.warn('Unable to load font preference:', e)
    }
  }

  // Load preference on mount
  onMounted(() => {
    loadFontPreference()
  })

  return {
    // State
    fontSize: computed(() => fontSize.value),
    minFontSize: MIN_FONT_SIZE,
    maxFontSize: MAX_FONT_SIZE,

    // Computed styles
    dynamicFontStyle,
    dynamicHeaderFontStyle,
    dynamicTitleFontStyle,

    // Methods
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    setFontSize
  }
}
