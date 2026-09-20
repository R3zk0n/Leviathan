import { readonly, ref } from 'vue'

const STORAGE_KEY = 'leviathan.reportTextSize'
const MIN_TEXT_SIZE = 100
const MAX_TEXT_SIZE = 200
const TEXT_SIZE_STEP = 25

function readTextSize () {
  try {
    const stored = Number(window.localStorage.getItem(STORAGE_KEY))
    if (Number.isInteger(stored)
      && stored >= MIN_TEXT_SIZE
      && stored <= MAX_TEXT_SIZE
      && (stored - MIN_TEXT_SIZE) % TEXT_SIZE_STEP === 0) {
      return stored
    }
  } catch {
    // Storage may be unavailable; the control still works for this session.
  }
  return MIN_TEXT_SIZE
}

// Shared across full details and Split View, including simultaneously mounted panes.
const textSize = ref(readTextSize())

function setTextSize (value) {
  textSize.value = Math.min(MAX_TEXT_SIZE, Math.max(MIN_TEXT_SIZE, value))
  try {
    window.localStorage.setItem(STORAGE_KEY, String(textSize.value))
  } catch {
    // Preserve the in-memory preference when the browser blocks storage.
  }
}

export function useReportTextSize () {
  return {
    textSize: readonly(textSize),
    minTextSize: MIN_TEXT_SIZE,
    maxTextSize: MAX_TEXT_SIZE,
    decreaseTextSize: () => setTextSize(textSize.value - TEXT_SIZE_STEP),
    increaseTextSize: () => setTextSize(textSize.value + TEXT_SIZE_STEP),
    resetTextSize: () => setTextSize(MIN_TEXT_SIZE),
  }
}
