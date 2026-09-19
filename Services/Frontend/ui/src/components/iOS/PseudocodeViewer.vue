<template>
  <div
    ref="editorEl"
    class="pseudocode-cm"
    :class="isDark ? 'theme--dark' : 'theme--light'"
    :style="{ '--pc-font': fontSize + 'px' }"
  ></div>
</template>

<script setup>
/**
 * PseudocodeViewer — read-only CodeMirror 6 view for r2ghidra C pseudocode.
 * C/C++ highlighting (matches the decompiler's native output), line numbers,
 * theme-aware. Mirrors the CM6 pattern used by the Android CodeViewer.
 */
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { cpp } from '@codemirror/lang-cpp';

const props = defineProps({
  code:     { type: String,  default: '' },
  isDark:   { type: Boolean, default: false },
  fontSize: { type: Number,  default: 13 },
});

const editorEl = ref(null);
let view = null;
const themeCompartment = new Compartment();

// Both themes must be COMPLETE (surface + colors) so switching resets the
// background symmetrically. oneDark already sets a dark surface; the light
// branch pairs a light EditorView theme with the default highlight style.
const lightTheme = EditorView.theme({
  '&': { backgroundColor: '#fafafa', color: '#1f2937' },
  '.cm-gutters': { backgroundColor: '#f3f4f6', color: '#9ca3af', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'rgba(0,0,0,0.035)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(0,0,0,0.05)' },
}, { dark: false });

// OLED surface layered over oneDark. oneDark ships a #282c34 grey-blue
// background; on an OLED panel a near-black surface reads far deeper. It's
// nudged just off pure #000 (#0a0a0c) so bright glyph edges don't halo — set
// backgroundColor to '#000000' here if you want absolute OLED black instead.
const oledDark = EditorView.theme({
  '&': { backgroundColor: '#0a0a0c' },
  '.cm-gutters': { backgroundColor: '#0a0a0c', color: '#4b5563', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,0.04)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(255,255,255,0.06)' },
}, { dark: true });

const themeExt = () => (
  props.isDark
    ? [oneDark, oledDark] // oledDark last so its near-black surface wins
    : [lightTheme, syntaxHighlighting(defaultHighlightStyle)]
);

onMounted(() => {
  view = new EditorView({
    parent: editorEl.value,
    state: EditorState.create({
      doc: props.code || '',
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        cpp(),
        themeCompartment.of(themeExt()),
        EditorView.editable.of(false),
        EditorState.readOnly.of(true),
        EditorView.theme({
          '&': { maxHeight: '72vh' },
          '.cm-scroller': {
            overflow: 'auto',
            // App-wide mono stack (single source of truth in typography.css).
            // CSS vars resolve inside CodeMirror's injected stylesheet.
            fontFamily: "var(--code-font)",
            // Grayscale AA (not subpixel) → thinner, fringe-free text on the
            // OLED near-black surface. StyleModule maps these capitalised keys
            // to the -webkit-/-moz- prefixed properties.
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            // Disable ligatures so -> == != render as literal characters —
            // clearer when reading decompiled C than combined glyphs.
            fontFeatureSettings: '"liga" 0, "calt" 0',
            fontVariantLigatures: 'none',
            lineHeight: '1.55',
          },
        }),
      ],
    }),
  });
});

watch(() => props.code, (code) => {
  if (!view) return;
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code || '' } });
});

watch(() => props.isDark, () => {
  if (view) view.dispatch({ effects: themeCompartment.reconfigure(themeExt()) });
});

onBeforeUnmount(() => {
  if (view) { view.destroy(); view = null; }
});
</script>

<style scoped>
.pseudocode-cm {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(128, 128, 128, 0.18);
}
/* Respect the header font-size control. */
.pseudocode-cm :deep(.cm-content),
.pseudocode-cm :deep(.cm-gutters) {
  font-size: var(--pc-font, 13px);
}
</style>
