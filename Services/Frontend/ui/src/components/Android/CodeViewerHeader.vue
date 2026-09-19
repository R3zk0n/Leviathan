<template>
  <div :class="['header', isDark ? 'header--dark' : 'header--light']">

    <!-- Breadcrumb -->
    <div class="breadcrumb" :title="componentName">
      <span class="breadcrumb-file">{{ filename || '—' }}</span>
      <span v-if="componentName" class="breadcrumb-sep">›</span>
      <span v-if="componentName" class="breadcrumb-component">{{ simpleComponentName }}</span>
      <span v-if="currentPackage" class="breadcrumb-pkg">{{ currentPackage }}</span>
    </div>

    <div class="header-controls">

      <!-- Back/Forward -->
      <div class="nav-controls">
        <button @click="$emit('back')"    :disabled="!canBack"    title="Back (Alt+←)">←</button>
        <button @click="$emit('forward')" :disabled="!canForward" title="Forward (Alt+→)">→</button>
      </div>

      <!-- Search -->
      <button class="ctrl-btn" @click="$emit('toggle-search')" title="Search (Ctrl+F)">
        <span>🔍</span>
      </button>

      <!-- Bookmarks -->
      <div v-if="bookmarkCount > 0" class="bookmark-nav">
        <span class="bm-count" title="Bookmarked lines">🔖 {{ bookmarkCount }}</span>
        <button @click="$emit('prev-bookmark')" title="Previous bookmark">◀</button>
        <button @click="$emit('next-bookmark')" title="Next bookmark">▶</button>
        <button @click="$emit('clear-bookmarks')" title="Clear all bookmarks" class="bm-clear">✕</button>
      </div>

      <!-- References -->
      <div v-if="referenceCount > 0" class="reference-navigation">
        <span class="reference-count">{{ referenceCount }} refs</span>
        <div class="reference-buttons">
          <button @click="$emit('prev-reference')" title="Previous">◀</button>
          <span class="reference-index">{{ currentMatchIndex + 1 }}/{{ referenceCount }}</span>
          <button @click="$emit('next-reference')" title="Next">▶</button>
        </div>
      </div>

      <!-- Font size -->
      <div class="font-size-controls">
        <button @click="$emit('decrease-font')" :disabled="fontSize <= minFontSize" title="Smaller">A-</button>
        <span class="font-size-display">{{ fontSize }}px</span>
        <button @click="$emit('increase-font')" :disabled="fontSize >= maxFontSize" title="Larger">A+</button>
      </div>

      <!-- Close -->
      <button @click="$emit('close')" class="close-btn" title="Close">✕ Close</button>

    </div>
  </div>
</template>

<script setup>
defineProps({
  isDark:            { type: Boolean, default: false },
  filename:          { type: String,  default: '' },
  componentName:     { type: String,  default: '' },
  simpleComponentName: { type: String, default: '' },
  currentPackage:    { type: String,  default: '' },
  canBack:           { type: Boolean, default: false },
  canForward:        { type: Boolean, default: false },
  bookmarkCount:     { type: Number,  default: 0 },
  referenceCount:    { type: Number,  default: 0 },
  currentMatchIndex: { type: Number,  default: 0 },
  fontSize:          { type: Number,  default: 14 },
  minFontSize:       { type: Number,  default: 10 },
  maxFontSize:       { type: Number,  default: 32 },
});

defineEmits([
  'back', 'forward',
  'toggle-search',
  'prev-bookmark', 'next-bookmark', 'clear-bookmarks',
  'prev-reference', 'next-reference',
  'increase-font', 'decrease-font',
  'close',
]);
</script>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 14px;
  border-bottom: 1px solid;
  flex-shrink: 0;
  gap: 12px;
  min-height: 44px;
}
.header--dark  { background-color: #2c313a; border-bottom-color: #1a1d23; color: #e6e6e6; }
.header--light { background-color: #f0f0f0; border-bottom-color: #d0d0d0; color: #333; }

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  min-width: 0;
  overflow: hidden;
  flex-shrink: 1;
}
.breadcrumb-file      { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.breadcrumb-sep       { opacity: 0.4; }
.breadcrumb-component { font-weight: 700; color: #61afef; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.breadcrumb-pkg       { font-size: 11px; opacity: 0.5; white-space: nowrap; margin-left: 4px; }
.header--light .breadcrumb-component { color: #0550ae; }

.header-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.nav-controls,
.font-size-controls { display: flex; align-items: center; gap: 4px; }

.nav-controls button,
.font-size-controls button,
.ctrl-btn,
.bm-clear {
  background: rgba(97, 175, 239, 0.1);
  border: 1px solid rgba(97, 175, 239, 0.25);
  border-radius: 4px;
  color: inherit;
  padding: 3px 9px;
  cursor: pointer;
  font-size: 12px;
  min-width: 28px;
  line-height: 1.6;
  transition: background 0.15s;
}
.nav-controls button:hover:not(:disabled),
.font-size-controls button:hover:not(:disabled),
.ctrl-btn:hover,
.bm-clear:hover { background: rgba(97, 175, 239, 0.22); }

.nav-controls button:disabled,
.font-size-controls button:disabled { opacity: 0.4; cursor: not-allowed; }

.font-size-display { font-size: 12px; min-width: 34px; text-align: center; font-weight: 500; }

/* Bookmark nav */
.bookmark-nav { display: flex; align-items: center; gap: 4px; font-size: 12px; }
.bm-count {
  padding: 2px 7px;
  background: rgba(229, 192, 123, 0.15);
  border-radius: 4px;
  white-space: nowrap;
}

/* References nav */
.reference-navigation { display: flex; align-items: center; gap: 6px; }
.reference-count {
  font-size: 12px;
  padding: 2px 8px;
  background: rgba(97, 175, 239, 0.15);
  border-radius: 4px;
  white-space: nowrap;
}
.reference-buttons { display: flex; align-items: center; gap: 3px; }
.reference-buttons button {
  background: rgba(97, 175, 239, 0.1);
  border: 1px solid rgba(97, 175, 239, 0.2);
  border-radius: 4px;
  color: inherit;
  width: 26px; height: 26px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px;
  transition: background 0.15s;
}
.reference-buttons button:hover { background: rgba(97, 175, 239, 0.22); }
.reference-index { font-size: 12px; min-width: 36px; text-align: center; }

.close-btn {
  background: rgba(224, 108, 117, 0.12);
  border: 1px solid rgba(224, 108, 117, 0.3);
  border-radius: 4px;
  color: inherit;
  padding: 3px 10px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: background 0.15s;
}
.close-btn:hover { background: rgba(224, 108, 117, 0.25); }
</style>
