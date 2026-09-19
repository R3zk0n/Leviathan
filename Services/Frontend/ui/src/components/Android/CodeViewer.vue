<template>
  <div :class="['code-viewer', isDark ? 'theme--dark' : 'theme--light']">

    <!-- ── Header ─────────────────────────────────────────────────────────── -->
    <code-viewer-header
      :isDark="isDark"
      :filename="currentFilename"
      :component-name="currentComponentName"
      :simple-component-name="simpleComponentName"
      :current-package="currentPackage"
      :can-back="canBack"
      :can-forward="canForward"
      :bookmark-count="bookmarks.length"
      :reference-count="referenceCount"
      :current-match-index="currentMatchIndex"
      :font-size="fontSize"
      :min-font-size="minFontSize"
      :max-font-size="maxFontSize"
      @back="codeViewerBack"
      @forward="codeViewerForward"
      @toggle-search="toggleSearch"
      @prev-bookmark="prevBookmark"
      @next-bookmark="nextBookmark"
      @clear-bookmarks="clearBookmarks"
      @prev-reference="goToPreviousReference"
      @next-reference="goToNextReference"
      @increase-font="increaseFontSize"
      @decrease-font="decreaseFontSize"
      @close="goBack"
    />

    <!-- ── Editor ─────────────────────────────────────────────────────────── -->
    <div class="editor-wrapper">
      <div
        ref="editorContainer"
        class="editor-container"
        @contextmenu.prevent="handleContextMenu"
      />
    </div>

    <!-- ── Status bar ─────────────────────────────────────────────────────── -->
    <div :class="['status-bar', isDark ? 'status-bar--dark' : 'status-bar--light']">
      <span class="status-item">Ln {{ cursorLine }}, Col {{ cursorCol }}</span>
      <span class="status-sep">│</span>
      <span class="status-item">{{ totalLines }} lines</span>
      <span v-if="bookmarks.length" class="status-sep">│</span>
      <span v-if="bookmarks.length" class="status-item status-bookmark">
        {{ bookmarks.length }} bookmark{{ bookmarks.length > 1 ? 's' : '' }}
      </span>
      <span class="status-sep">│</span>
      <span class="status-item status-hint">
        Ctrl+Click / F12 = Go to Def &nbsp;│&nbsp; Ctrl+G = Go to Line &nbsp;│&nbsp; F2 = Bookmark &nbsp;│&nbsp; Ctrl+F = Search
      </span>
    </div>

    <!-- ── Android class tooltip ──────────────────────────────────────────── -->
    <div
      v-if="androidTooltipVisible"
      :class="['android-tooltip', isDark ? 'android-tooltip--dark' : 'android-tooltip--light']"
      :style="{ left: androidTooltipPosition.left + 'px', top: androidTooltipPosition.top + 'px' }"
      @click="openAndroidDocs"
    >
      <div class="android-tooltip-content">{{ androidTooltipText }}</div>
    </div>

    <!-- ── Context menu ───────────────────────────────────────────────────── -->
    <div
      v-if="contextMenuVisible"
      :class="['context-menu', isDark ? 'context-menu--dark' : 'context-menu--light']"
      :style="{ left: contextMenuPosition.left + 'px', top: contextMenuPosition.top + 'px' }"
    >
      <div class="ctx-section">
        <div class="ctx-item" @click="goToDefinition">
          <span class="ctx-icon">→</span> Go to Definition <span class="ctx-hint">F12</span>
        </div>
        <div class="ctx-item" @click="goToImplementation">
          <span class="ctx-icon">↳</span> Go to Implementation
        </div>
        <div class="ctx-item" @click="findReferences">
          <span class="ctx-icon">◎</span> Find References <span class="ctx-hint">Shift+F12</span>
        </div>
      </div>
      <div class="ctx-divider"></div>
      <div class="ctx-section">
        <div class="ctx-item" @click="copySelection">
          <span class="ctx-icon">⎘</span> Copy
        </div>
        <div class="ctx-item" @click="copyAsFinding">
          <span class="ctx-icon">📋</span> Copy as Finding
        </div>
      </div>
      <div class="ctx-divider"></div>
      <div class="ctx-section">
        <div class="ctx-item" @click="toggleBookmarkAtCursor">
          <span class="ctx-icon">🔖</span> Toggle Bookmark <span class="ctx-hint">F2</span>
        </div>
        <div class="ctx-item" @click="getDocumentation">
          <span class="ctx-icon">📖</span> Open Android Docs
        </div>
      </div>
    </div>

    <!-- ── Toast ──────────────────────────────────────────────────────────── -->
    <div v-if="toast.visible" :class="['toast', isDark ? 'toast--dark' : 'toast--light', `toast--${toast.type}`]">
      {{ toast.message }}
    </div>

  </div>
</template>

<script setup>
import {
  ref, computed, watch, onMounted, onUnmounted, nextTick,
} from 'vue';
import { useStore }  from 'vuex';
import { useRouter } from 'vue-router';

import { java }                  from '@codemirror/lang-java';
import {
  EditorView, ViewPlugin, Decoration, gutter, GutterMarker,
  lineNumbers, highlightActiveLineGutter, highlightActiveLine, keymap,
} from '@codemirror/view';
import {
  bracketMatching, syntaxHighlighting, defaultHighlightStyle, forceParsing,
} from '@codemirror/language';
import { autocompletion }              from '@codemirror/autocomplete';
import { oneDark }                     from '@codemirror/theme-one-dark';
import {
  EditorState, StateField, StateEffect, RangeSet,
} from '@codemirror/state';
import {
  search, openSearchPanel, closeSearchPanel, searchKeymap, highlightSelectionMatches,
} from '@codemirror/search';
import { showMinimap }  from '@replit/codemirror-minimap';

import CodeViewerHeader from './CodeViewerHeader.vue';

// ─────────────────────────────────────────────────────────────────────────────
// Module-level CodeMirror primitives (created once, shared across remounts)
// ─────────────────────────────────────────────────────────────────────────────

const addBookmark      = StateEffect.define();
const removeBookmark   = StateEffect.define();
const clearAllBookmarks = StateEffect.define();

class BookmarkMarker extends GutterMarker {
  toDOM() {
    const el = document.createElement('span');
    el.textContent = '🔖';
    el.style.cssText = 'font-size:11px;cursor:pointer;';
    return el;
  }
}
const bookmarkMarker = new BookmarkMarker();

const bookmarkField = StateField.define({
  create: () => RangeSet.empty,
  update(marks, tr) {
    marks = marks.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(addBookmark))       marks = marks.update({ add: [bookmarkMarker.range(effect.value)] });
      else if (effect.is(removeBookmark)) marks = marks.update({ filter: (from) => from !== effect.value });
      else if (effect.is(clearAllBookmarks)) marks = RangeSet.empty;
    }
    return marks;
  },
});

const bookmarkGutter = gutter({
  class: 'cm-bookmark-gutter',
  markers: (view) => view.state.field(bookmarkField),
  initialSpacer: () => bookmarkMarker,
});

const androidClassMark  = Decoration.mark({ class: 'android-class-highlight' });
const androidPattern    = /(android\.|androidx\.|com\.android\.|com\.google\.android\.)[\w.]+/g;

const androidClassField = StateField.define({
  create: () => RangeSet.empty,
  update(decorations, tr) {
    if (!tr.docChanged && decorations !== RangeSet.empty) return decorations;
    const ranges = [];
    for (let i = 1; i <= tr.state.doc.lines; i++) {
      const line = tr.state.doc.line(i);
      let m;
      androidPattern.lastIndex = 0;
      while ((m = androidPattern.exec(line.text)) !== null) {
        ranges.push(androidClassMark.range(line.from + m.index, line.from + m.index + m[0].length));
      }
    }
    return RangeSet.of(ranges);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Component setup
// ─────────────────────────────────────────────────────────────────────────────

const store  = useStore();
const router = useRouter();
const goBack = () => router.back();

// ── Core state ────────────────────────────────────────────────────────────────
const editorContainer = ref(null);
let _view = null; // raw EditorView instance (not reactive)

const internalCode          = ref(store.state.currentCode || '');
const currentFilename       = computed(() => store.state.currentFilename);
const currentComponentName  = computed(() => store.state.currentComponentName);
const isDark                = computed(() => store.state.isDark);

const pendingJumpPos  = ref(null);
const searchOpen      = ref(false);

// ── Cursor / status bar ───────────────────────────────────────────────────────
const cursorLine = ref(1);
const cursorCol  = ref(1);
const totalLines = ref(1);

// ── Breadcrumb ────────────────────────────────────────────────────────────────
const currentPackage = computed(() => {
  const m = (internalCode.value || '').match(/^[\t ]*package\s+([\w$.]+)\s*;/m);
  return m ? m[1] : '';
});

const simpleComponentName = computed(() => {
  const name = currentComponentName.value || '';
  const parts = name.split('.');
  return parts[parts.length - 1] || name;
});

// ── Font size ─────────────────────────────────────────────────────────────────
const fontSize    = ref(14);
const minFontSize = 10;
const maxFontSize = 32;

const increaseFontSize = () => {
  if (fontSize.value < maxFontSize) { fontSize.value += 2; showToast(`Font: ${fontSize.value}px`); }
};
const decreaseFontSize = () => {
  if (fontSize.value > minFontSize) { fontSize.value -= 2; showToast(`Font: ${fontSize.value}px`); }
};

// ── Toast ─────────────────────────────────────────────────────────────────────
const toast = ref({ visible: false, message: '', type: 'info', timer: null });

const showToast = (message, type = 'info') => {
  if (toast.value.timer) clearTimeout(toast.value.timer);
  toast.value = {
    visible: true, message, type,
    timer: setTimeout(() => { toast.value.visible = false; }, 2500),
  };
};

// ── Bookmarks ─────────────────────────────────────────────────────────────────
const bookmarks      = ref([]);
const bookmarkNavIdx = ref(0);

const toggleBookmarkAtCursor = () => {
  closeContextMenu();
  if (!_view) return;
  const pos       = _view.state.selection.main.head;
  const line      = _view.state.doc.lineAt(pos);
  const lineStart = line.from;
  const idx = bookmarks.value.indexOf(lineStart);
  if (idx >= 0) {
    bookmarks.value.splice(idx, 1);
    _view.dispatch({ effects: removeBookmark.of(lineStart) });
    showToast(`Bookmark removed: line ${line.number}`);
  } else {
    bookmarks.value = [...bookmarks.value, lineStart].sort((a, b) => a - b);
    _view.dispatch({ effects: addBookmark.of(lineStart) });
    showToast(`Bookmark added: line ${line.number}`);
  }
};

const nextBookmark = () => {
  if (!bookmarks.value.length) return;
  bookmarkNavIdx.value = (bookmarkNavIdx.value + 1) % bookmarks.value.length;
  scrollToPos(bookmarks.value[bookmarkNavIdx.value]);
};

const prevBookmark = () => {
  if (!bookmarks.value.length) return;
  bookmarkNavIdx.value = (bookmarkNavIdx.value - 1 + bookmarks.value.length) % bookmarks.value.length;
  scrollToPos(bookmarks.value[bookmarkNavIdx.value]);
};

const clearBookmarks = () => {
  bookmarks.value = [];
  if (_view) _view.dispatch({ effects: clearAllBookmarks.of(null) });
  showToast('All bookmarks cleared');
};

// ── Search ────────────────────────────────────────────────────────────────────
const toggleSearch = () => {
  if (!_view) return;
  if (searchOpen.value) {
    closeSearchPanel(_view);
    searchOpen.value = false;
  } else {
    openSearchPanel(_view);
    searchOpen.value = true;
  }
};

// ── References ────────────────────────────────────────────────────────────────
const referenceCount    = ref(0);
const currentMatches    = ref([]);
const currentMatchIndex = ref(0);
const currentSearchText = ref('');

// ── Context menu ──────────────────────────────────────────────────────────────
const contextMenuVisible   = ref(false);
const contextMenuPosition  = ref({ left: 0, top: 0 });
const currentPosition      = ref(null);
const currentTokenText     = ref('');
const storedSelectionForCopy = ref({ from: 0, to: 0 });
const currentSelection     = ref({ from: 0, to: 0 });

// ── Android tooltip ───────────────────────────────────────────────────────────
const androidTooltipVisible  = ref(false);
const androidTooltipText     = ref('');
const androidTooltipPosition = ref({ left: 0, top: 0 });
const hoveredAndroidClass    = ref('');

// ─────────────────────────────────────────────────────────────────────────────
// Editor helpers
// ─────────────────────────────────────────────────────────────────────────────

const scrollToPos = async (pos) => {
  if (!_view || typeof pos !== 'number') return;
  await nextTick();
  try {
    _view.dispatch({ selection: { anchor: pos, head: pos }, scrollIntoView: true });
  } catch { /* ignore */ }
};

const getWordAtPosition = (view, pos) => {
  if (!view?.state) return '';
  try {
    const line   = view.state.doc.lineAt(pos);
    const text   = line.text;
    const offset = pos - line.from;
    if (offset >= text.length || /\s/.test(text[offset])) return '';
    const javaChar = /[\w$.]/;
    let start = offset, end = offset;
    while (start > 0 && javaChar.test(text[start - 1])) start--;
    while (end < text.length && javaChar.test(text[end])) end++;
    return text.substring(start, end);
  } catch { return ''; }
};

// ─────────────────────────────────────────────────────────────────────────────
// Extensions builder
// ─────────────────────────────────────────────────────────────────────────────

const makeSelectionTracker = () => ViewPlugin.fromClass(class {
  update(update) {
    if (update.selectionSet) {
      const sel = update.state.selection.main;
      currentSelection.value = sel;
      if (sel.from !== sel.to) storedSelectionForCopy.value = sel;
      const line = update.state.doc.lineAt(sel.head);
      cursorLine.value = line.number;
      cursorCol.value  = sel.head - line.from + 1;
      totalLines.value = update.state.doc.lines;
    }
  }
});

const buildExtensions = () => {
  const fontTheme = EditorView.theme({
    '.cm-editor, .cm-content, .cm-line': {
      fontSize: fontSize.value + 'px',
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, monospace',
    },
  });

  return [
    java(),
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    highlightSelectionMatches({ minSelectionLength: 2 }),
    EditorView.lineWrapping,
    bracketMatching(),
    autocompletion({ activateOnTyping: false }),
    EditorView.editable.of(false),
    search({ top: true }),
    keymap.of(searchKeymap),
    makeSelectionTracker(),
    bookmarkField,
    bookmarkGutter,
    androidClassField,
    EditorView.decorations.from(androidClassField),
    fontTheme,
    EditorView.domEventHandlers({
      mousemove: handleMouseMove,
      mouseleave: () => hideAndroidTooltip(),
      click: handleEditorClick,
      keydown: handleKeydown,
    }),
    EditorView.updateListener.of((update) => {
      if (update.selectionSet || update.docChanged) {
        const sel = update.state.selection.main;
        const line = update.state.doc.lineAt(sel.head);
        cursorLine.value = line.number;
        cursorCol.value  = sel.head - line.from + 1;
        totalLines.value = update.state.doc.lines;
      }
    }),
    showMinimap.compute(['doc'], () => ({
      create: () => { const dom = document.createElement('div'); return { dom }; },
      displayText: 'blocks',
      showOverlay: 'always',
      gutters: [{ 1: '#00FF00', 2: '#00FF00' }],
    })),
    isDark.value ? oneDark : syntaxHighlighting(defaultHighlightStyle),
  ];
};

// ─────────────────────────────────────────────────────────────────────────────
// Editor lifecycle
// ─────────────────────────────────────────────────────────────────────────────

const initEditor = () => {
  if (_view) {
    _view.destroy();
    _view = null;
  }
  if (!editorContainer.value) return;

  // Reset bookmarks when editor reinitialises (theme/font change)
  bookmarks.value = [];

  _view = new EditorView({
    state: EditorState.create({
      doc: internalCode.value,
      extensions: buildExtensions(),
    }),
    parent: editorContainer.value,
  });

  // Force a full parse so syntax highlighting is correct from line 1
  forceParsing(_view, _view.state.doc.length, 5000);
};

onMounted(() => { initEditor(); });

onUnmounted(() => {
  if (_view) { _view.destroy(); _view = null; }
});

// Recreate the editor when theme or font size changes (extensions must be rebuilt)
watch([isDark, fontSize], () => {
  if (editorContainer.value) initEditor();
});

// Update doc content on file navigation (keeps editor alive, just swaps text)
watch(() => store.state.currentCode, (newCode) => {
  const code = newCode || '';
  internalCode.value = code;
  if (_view) {
    if (_view.state.doc.toString() !== code) {
      _view.dispatch({ changes: { from: 0, to: _view.state.doc.length, insert: code } });
    }
    forceParsing(_view, _view.state.doc.length, 5000);
    // Scroll to pending jump target after code loads
    if (pendingJumpPos.value !== null) {
      const pos = pendingJumpPos.value;
      pendingJumpPos.value = null;
      setTimeout(() => scrollToPos(pos), 60);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Keyboard handler
// ─────────────────────────────────────────────────────────────────────────────

const handleKeydown = (event) => {
  if (!_view) return;

  if (event.key === 'F12' && !event.shiftKey) {
    event.preventDefault();
    const pos   = _view.state.selection.main.head;
    const token = getWordAtPosition(_view, pos);
    if (token) { currentPosition.value = pos; currentTokenText.value = token; performGoToDefinition(token); }
  }

  if (event.key === 'F12' && event.shiftKey) {
    event.preventDefault();
    findReferences();
  }

  if (event.key === 'F2' && !event.shiftKey) {
    event.preventDefault();
    toggleBookmarkAtCursor();
  }

  if (event.key === 'F2' && event.shiftKey) {
    event.preventDefault();
    prevBookmark();
  }

  if (event.key === 'g' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    const lineStr = window.prompt('Go to line:');
    const lineNum = parseInt(lineStr, 10);
    if (!isNaN(lineNum) && lineNum > 0) {
      const doc  = _view.state.doc;
      const line = doc.line(Math.min(lineNum, doc.lines));
      _view.dispatch({ selection: { anchor: line.from }, scrollIntoView: true });
      _view.focus();
    }
  }

  if (event.key === 'f' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    openSearchPanel(_view);
    searchOpen.value = true;
  }

  if (event.key === 'Escape' && searchOpen.value) {
    closeSearchPanel(_view);
    searchOpen.value = false;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Go to definition / references
// ─────────────────────────────────────────────────────────────────────────────

const performGoToDefinition = async (tokenOverride, preferClass = false) => {
  const token = (tokenOverride ?? currentTokenText.value ?? '').trim();
  if (!token) { showToast('No token selected', 'warning'); return; }
  try {
    showToast(`Resolving: ${token}…`, 'info');
    const result = await store.dispatch('goToDefinition', {
      token,
      file:     currentFilename.value,
      position: currentPosition.value,
      preferClass,
    });
    if (result && typeof result.targetPos === 'number') {
      pendingJumpPos.value = result.targetPos;
      if (result.targetComponentName === currentComponentName.value) {
        await scrollToPos(result.targetPos);
        pendingJumpPos.value = null;
      }
    }
    if (result?.isLocal) showToast('Jumped to declaration', 'success');
    else showToast(`Navigated to ${result?.targetComponentName?.split('.').pop() || token}`, 'success');
  } catch (err) {
    showToast(err?.message || 'Definition not found', 'error');
  }
};

const goToDefinition = () => { closeContextMenu(); performGoToDefinition(); };

const goToImplementation = () => {
  closeContextMenu();
  performGoToDefinition(null, true);
};

// ─────────────────────────────────────────────────────────────────────────────
// Copy actions
// ─────────────────────────────────────────────────────────────────────────────

const copySelection = () => {
  closeContextMenu();
  if (!_view) return;
  const sel  = storedSelectionForCopy.value;
  const text = sel.from !== sel.to
    ? _view.state.sliceDoc(sel.from, sel.to)
    : _view.state.doc.lineAt(_view.state.selection.main.head).text;
  if (!text) { showToast('Nothing to copy', 'warning'); return; }
  navigator.clipboard.writeText(text)
    .then(() => showToast(`Copied ${text.length} chars`, 'success'))
    .catch(() => showToast('Copy failed', 'error'));
};

const copyAsFinding = () => {
  closeContextMenu();
  if (!_view) return;
  const sel      = _view.state.selection.main;
  const line     = _view.state.doc.lineAt(sel.head);
  const lineText = sel.from !== sel.to
    ? _view.state.sliceDoc(sel.from, sel.to).split('\n')[0]
    : line.text.trim();
  const component = currentComponentName.value || currentFilename.value || '';
  navigator.clipboard.writeText(`${component}:${line.number}: ${lineText}`)
    .then(() => showToast('Finding copied', 'success'))
    .catch(() => showToast('Copy failed', 'error'));
};

// ─────────────────────────────────────────────────────────────────────────────
// Context menu
// ─────────────────────────────────────────────────────────────────────────────

const handleContextMenu = (event) => {
  if (!_view) return;
  try {
    const sel = _view.state.selection.main;
    currentPosition.value  = sel.head;
    currentSelection.value = sel;
    currentTokenText.value = sel.from !== sel.to
      ? _view.state.sliceDoc(sel.from, sel.to)
      : getWordAtPosition(_view, sel.head) || '';
    contextMenuPosition.value = { left: event.clientX, top: event.clientY };
    contextMenuVisible.value  = true;
    setTimeout(() => document.addEventListener('click', closeContextMenu, { once: true }), 10);
  } catch { /* ignore */ }
};

const closeContextMenu = () => {
  contextMenuVisible.value = false;
  document.removeEventListener('click', closeContextMenu);
};

// ─────────────────────────────────────────────────────────────────────────────
// Click handler (Ctrl+Click = go to definition)
// ─────────────────────────────────────────────────────────────────────────────

const handleEditorClick = (event) => {
  if (!(event.ctrlKey || event.metaKey)) return;
  if (!_view) return;
  try {
    const coords = _view.posAtCoords(event);
    if (!coords) return;
    const token = getWordAtPosition(_view, coords.pos);
    if (!token) return;
    event.preventDefault();
    event.stopPropagation();
    currentPosition.value  = coords.pos;
    currentTokenText.value = token;
    performGoToDefinition(token);
  } catch { /* ignore */ }
};

// ─────────────────────────────────────────────────────────────────────────────
// Android class tooltip
// ─────────────────────────────────────────────────────────────────────────────

const isAndroidToken = (token) =>
  /^(android\.|androidx\.|com\.android\.|com\.google\.android\.)[\w.]+$/.test(token || '');

const androidRefUrl = (fqn) =>
  `https://developer.android.com/reference/${fqn.replace(/\./g, '/')}`;

const handleMouseMove = (event) => {
  if (!_view) return;
  try {
    const coords = _view.posAtCoords(event);
    if (!coords) { hideAndroidTooltip(); return; }
    const token = getWordAtPosition(_view, coords.pos);
    if (token && isAndroidToken(token)) {
      if (hoveredAndroidClass.value !== token) {
        hoveredAndroidClass.value    = token;
        androidTooltipText.value     = `${token}\n↗ Android Docs — click to open`;
        androidTooltipPosition.value = { left: event.clientX + 12, top: event.clientY - 10 };
        androidTooltipVisible.value  = true;
      }
    } else {
      hideAndroidTooltip();
    }
  } catch { hideAndroidTooltip(); }
};

const hideAndroidTooltip = () => {
  androidTooltipVisible.value = false;
  hoveredAndroidClass.value   = '';
};

const openAndroidDocs = () => {
  if (hoveredAndroidClass.value) {
    window.open(androidRefUrl(hoveredAndroidClass.value), '_blank');
    hideAndroidTooltip();
  }
};

const getDocumentation = () => {
  closeContextMenu();
  const token = currentTokenText.value;
  if (!token) return;
  if (isAndroidToken(token)) window.open(androidRefUrl(token), '_blank');
  else showToast(`No docs available for: ${token}`, 'info');
};

// ─────────────────────────────────────────────────────────────────────────────
// History navigation
// ─────────────────────────────────────────────────────────────────────────────

const canBack    = computed(() => store.getters.canCodeViewerBack);
const canForward = computed(() => store.getters.canCodeViewerForward);

const codeViewerBack    = () => { if (canBack.value)    store.dispatch('codeViewerBack'); };
const codeViewerForward = () => { if (canForward.value) store.dispatch('codeViewerForward'); };
</script>

<style scoped>
/* ── Layout ───────────────────────────────────────────────────────────────── */
.code-viewer {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.theme--dark  { background-color: #1e2227; color: #abb2bf; }
.theme--light { background-color: #f9f9f9; color: #24292e; }

.editor-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.editor-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

:deep(.cm-editor)  { height: 100%; }
:deep(.cm-scroller) { overflow: auto !important; }

/* ── Bookmark gutter ─────────────────────────────────────────────────────── */
:deep(.cm-bookmark-gutter) { width: 18px; }

/* ── Android class highlight ─────────────────────────────────────────────── */
:deep(.android-class-highlight) {
  background: rgba(97, 175, 239, 0.14);
  border-radius: 2px;
  cursor: pointer;
}
:deep(.android-class-highlight:hover) { background: rgba(97, 175, 239, 0.26); }

/* ── Status bar ──────────────────────────────────────────────────────────── */
.status-bar {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 3px 14px;
  font-size: 11px;
  flex-shrink: 0;
  border-top: 1px solid;
  min-height: 24px;
}
.status-bar--dark  { background: #21252b; border-color: #1a1d23; color: #6b7280; }
.status-bar--light { background: #e8e8e8; border-color: #ccc;    color: #555; }

.status-item { white-space: nowrap; }
.status-sep  { margin: 0 8px; opacity: 0.4; }
.status-hint { opacity: 0.55; font-size: 10px; }
.status-bookmark { color: #e5c07b; }

/* ── Context menu ────────────────────────────────────────────────────────── */
.context-menu {
  position: fixed;
  z-index: 2000;
  min-width: 220px;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  border: 1px solid transparent;
  font-size: 13px;
}
.context-menu--dark  { background: #2c313a; border-color: #181a1f; color: #abb2bf; }
.context-menu--light { background: #ffffff; border-color: #ddd;    color: #333; }

.ctx-section { padding: 4px 0; }
.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  cursor: pointer;
  transition: background 0.1s;
}
.context-menu--dark  .ctx-item:hover { background: #3a3f4b; }
.context-menu--light .ctx-item:hover { background: #f0f4ff; }

.ctx-icon { width: 16px; text-align: center; opacity: 0.75; }
.ctx-hint { margin-left: auto; font-size: 11px; opacity: 0.45; }

.ctx-divider { height: 1px; margin: 2px 0; }
.context-menu--dark  .ctx-divider { background: #1a1d23; }
.context-menu--light .ctx-divider { background: #e8e8e8; }

/* ── Android tooltip ─────────────────────────────────────────────────────── */
.android-tooltip {
  position: fixed;
  z-index: 3000;
  max-width: 320px;
  border-radius: 6px;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  border: 1px solid transparent;
  animation: fadeUp 0.15s ease;
}
.android-tooltip--dark  { background: #2c313a; border-color: #1a1d23; }
.android-tooltip--light { background: #ffffff; border-color: #ccc; }

.android-tooltip-content {
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-line;
}
.android-tooltip--dark  .android-tooltip-content { color: #abb2bf; }
.android-tooltip--light .android-tooltip-content { color: #333; }

/* ── Toast ───────────────────────────────────────────────────────────────── */
.toast {
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 18px;
  border-radius: 6px;
  font-size: 13px;
  z-index: 4000;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  animation: fadeUp 0.2s ease;
  white-space: nowrap;
  max-width: 480px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.toast--dark    { background: #3a3f4b; color: #e6e6e6; }
.toast--light   { background: #333;    color: #fff; }
.toast--success { border-left: 3px solid #98c379; }
.toast--error   { border-left: 3px solid #e06c75; }
.toast--warning { border-left: 3px solid #e5c07b; }
.toast--info    { border-left: 3px solid #61afef; }

@keyframes fadeUp {
  from { opacity: 0; transform: translate(-50%, 8px); }
  to   { opacity: 1; transform: translate(-50%, 0); }
}
</style>
