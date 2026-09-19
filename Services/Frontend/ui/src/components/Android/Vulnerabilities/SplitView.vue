<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    fullscreen
    hide-overlay
    transition="dialog-bottom-transition"
  >
    <v-card class="split-view-card">
      <v-toolbar dark color="primary">
        <v-btn icon dark @click="closeDialog">
          <v-icon>mdi-close</v-icon>
        </v-btn>
        <v-toolbar-title>Code and Vulnerability Analysis</v-toolbar-title>
        <v-spacer />
        <v-btn
          variant="text"
          class="text-none"
          title="Reset split (double-click the divider also works)"
          @click="resetSplit"
        >
          Reset split
        </v-btn>
      </v-toolbar>

      <div
        ref="splitContainerEl"
        class="fill-height split-container"
        :class="{ 'is-dragging': isDragging }"
      >
        <div class="split-pane" :style="leftPaneStyle">
          <v-card flat tile class="fill-height overflow-card">
            <v-card-title class="pane-title">
              Code: {{ currentFilename }}
              <span class="pane-title-sep">—</span>
              {{ currentComponentName }}
            </v-card-title>
            <v-card-text class="overflow-container">
              <CodeViewer />
            </v-card-text>
          </v-card>
        </div>

        <div
          class="splitter"
          role="separator"
          aria-orientation="vertical"
          :aria-valuemin="MIN_LEFT_PX"
          :aria-valuemax="Math.max(MIN_LEFT_PX, containerWidthPx - MIN_RIGHT_PX)"
          :aria-valuenow="Math.round(leftWidthPx)"
          aria-label="Resize panes"
          tabindex="0"
          title="Drag to resize • Double-click to reset • Arrow keys to adjust"
          @pointerdown="onSplitterPointerDown"
          @dblclick="resetSplit"
          @keydown="onSplitterKeyDown"
        />

        <div class="split-pane split-pane-right">
          <v-card flat tile class="fill-height overflow-card">
            <v-card-title class="pane-title">
              Vulnerability Details
              <span class="pane-title-hint">(drag the divider to resize)</span>
            </v-card-title>
            <v-card-text class="overflow-container">
              <div class="vuln-content" v-html="vulnerabilityDetailsHtml"></div>
            </v-card-text>
          </v-card>
        </div>

        <div v-if="isDragging" class="drag-shield" />
      </div>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { defineProps, defineEmits, computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useStore } from 'vuex';
import CodeViewer from '@/components/Android/CodeViewer.vue';

const store = useStore();

defineProps({
  modelValue: Boolean,
  vulnerabilityDetailsHtml: String,
});

const emit = defineEmits(['update:modelValue']);

const closeDialog = () => {
  emit('update:modelValue', false);
};

const currentFilename = computed(() => store.state.currentFilename);
const currentComponentName = computed(() => store.state.currentComponentName);
const isDark = computed(() => store.state.isDark);

const splitContainerEl = ref(null);
const isDragging = ref(false);

const SPLIT_STORAGE_KEY = 'splitView.leftWidthPx';
const DEFAULT_LEFT_PX = 560;
const MIN_LEFT_PX = 340;
const MIN_RIGHT_PX = 380;

const leftWidthPx = ref(DEFAULT_LEFT_PX);
const containerWidthPx = ref(0);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const measureContainer = () => {
  const container = splitContainerEl.value;
  if (!container) return;
  const rect = container.getBoundingClientRect();
  containerWidthPx.value = rect.width;
};

const getClampedLeftWidth = (proposedLeftPx) => {
  const container = splitContainerEl.value;
  if (!container) return proposedLeftPx;

  const rect = container.getBoundingClientRect();
  const maxLeft = Math.max(MIN_LEFT_PX, rect.width - MIN_RIGHT_PX);
  return clamp(proposedLeftPx, MIN_LEFT_PX, maxLeft);
};

const leftPaneStyle = computed(() => ({
  width: `${leftWidthPx.value}px`,
}));

const saveSplit = () => {
  try {
    localStorage.setItem(SPLIT_STORAGE_KEY, String(Math.round(leftWidthPx.value)));
  } catch {
    // ignore storage errors (private mode, disabled, etc.)
  }
};

const loadSplit = () => {
  try {
    const raw = localStorage.getItem(SPLIT_STORAGE_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    if (Number.isFinite(parsed)) {
      leftWidthPx.value = getClampedLeftWidth(parsed);
    } else {
      leftWidthPx.value = getClampedLeftWidth(DEFAULT_LEFT_PX);
    }
  } catch {
    leftWidthPx.value = getClampedLeftWidth(DEFAULT_LEFT_PX);
  }
};

const resetSplit = () => {
  const container = splitContainerEl.value;
  if (!container) {
    leftWidthPx.value = DEFAULT_LEFT_PX;
    return;
  }

  const rect = container.getBoundingClientRect();
  leftWidthPx.value = getClampedLeftWidth(rect.width / 2);
  measureContainer();
  saveSplit();
};

const updateFromClientX = (clientX) => {
  const container = splitContainerEl.value;
  if (!container) return;

  const rect = container.getBoundingClientRect();
  const proposed = clientX - rect.left;
  leftWidthPx.value = getClampedLeftWidth(proposed);
  measureContainer();
};

const onPointerMove = (e) => {
  if (!isDragging.value) return;
  updateFromClientX(e.clientX);
};

const stopDragging = () => {
  if (!isDragging.value) return;
  isDragging.value = false;
  document.body.classList.remove('split-view-dragging');
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);
  saveSplit();
};

const onPointerUp = () => {
  stopDragging();
};

const onSplitterPointerDown = (e) => {
  // Primary button only for mouse; still allows touch/pen.
  if (e.pointerType === 'mouse' && e.button !== 0) return;

  isDragging.value = true;
  document.body.classList.add('split-view-dragging');

  // Prevent text selection and other default behaviors while dragging.
  e.preventDefault();

  updateFromClientX(e.clientX);

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
};

const STEP_PX = 24;
const onSplitterKeyDown = (e) => {
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    leftWidthPx.value = getClampedLeftWidth(leftWidthPx.value - STEP_PX);
    measureContainer();
    saveSplit();
  }
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    leftWidthPx.value = getClampedLeftWidth(leftWidthPx.value + STEP_PX);
    measureContainer();
    saveSplit();
  }
  if (e.key === 'Home') {
    e.preventDefault();
    leftWidthPx.value = getClampedLeftWidth(MIN_LEFT_PX);
    measureContainer();
    saveSplit();
  }
  if (e.key === 'End') {
    e.preventDefault();
    const container = splitContainerEl.value;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    leftWidthPx.value = getClampedLeftWidth(rect.width - MIN_RIGHT_PX);
    measureContainer();
    saveSplit();
  }
};

const onResizeHandler = ref(null);

onMounted(() => {
  measureContainer();
  loadSplit();
  measureContainer();

  // Re-clamp on resize so stored sizes don't break on smaller screens.
  onResizeHandler.value = () => {
    measureContainer();
    leftWidthPx.value = getClampedLeftWidth(leftWidthPx.value);
  };

  window.addEventListener('resize', onResizeHandler.value);

  // Reset to 50/50 quickly with Shift+double-click on empty space? Keep it simple for now.
});

onBeforeUnmount(() => {
  if (onResizeHandler.value) {
    window.removeEventListener('resize', onResizeHandler.value);
  }
  stopDragging();
});
</script>

<style scoped>
.split-view-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.fill-height {
  height: calc(100% - 64px); /* Subtracting toolbar height */
}

.split-container {
  display: flex;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: rgb(var(--v-theme-surface));
}

.split-container.is-dragging {
  user-select: none;
}

.split-pane {
  height: 100%;
  overflow: hidden;
  min-width: 0; /* critical for flex overflow behavior */
}

.split-pane-right {
  flex: 1;
}

.pane-title {
  font-weight: 600;
  line-height: 1.2;
}

.pane-title-sep {
  opacity: 0.65;
  margin: 0 6px;
}

.pane-title-hint {
  font-weight: 400;
  opacity: 0.75;
  margin-left: 8px;
  font-size: 0.9em;
}

/* Wider hit-target, with a visible center line */
.splitter {
  width: 12px;
  flex: 0 0 12px;
  cursor: col-resize;
  position: relative;
  touch-action: none;
}

.splitter::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.22);
}

.splitter:hover::before,
.split-container.is-dragging .splitter::before,
.splitter:focus-visible::before {
  background: rgb(var(--v-theme-primary, 25 118 210));
}

.splitter:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary, 25 118 210) / 0.35);
  outline-offset: -2px;
}

.drag-shield {
  position: absolute;
  inset: 0;
  background: transparent;
  cursor: col-resize;
}

.overflow-card {
  display: flex;
  flex-direction: column;
}

.overflow-container {
  flex-grow: 1;
  overflow-x: auto;
  overflow-y: auto;
}

.vuln-content {
  white-space: normal; /* readability for narrative/details */
  line-height: 1.5;
  font-size: 0.95rem;
}

.vuln-content :deep(pre),
.vuln-content :deep(code) {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

/* Ensure the CodeViewer takes up the full height of its container */
:deep(.code-viewer) {
  height: 100%;
}

/* Style scrollbars for webkit browsers */
.overflow-container::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

.overflow-container::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.06);
}

.overflow-container::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.35);
  border-radius: 6px;
  border: 3px solid rgba(0, 0, 0, 0.06);
}

.overflow-container::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.55);
}

/* Dark mode tweaks */
:deep(.v-theme--dark) .overflow-container::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.08);
}

:deep(.v-theme--dark) .overflow-container::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.35);
  border: 3px solid rgba(255, 255, 255, 0.08);
}

:deep(.v-theme--dark) .overflow-container::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.55);
}
</style>

<style>
/* Global: while dragging, avoid text selection and show resize cursor everywhere */
body.split-view-dragging {
  user-select: none;
  cursor: col-resize;
}
</style>
