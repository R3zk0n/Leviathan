<template>
  <!--
    Shows an engine-generated report page (AppShark's per-finding HTML) exactly as it was
    written: the file is NOT parsed, sanitised or restyled, because its own <style> block
    and class attributes carry the Source/Sink highlighting.

    Safety comes from isolation instead of rewriting. The page's text originates in the app
    under analysis, so it is rendered in an iframe whose `sandbox` attribute is EMPTY:
    scripts off, opaque origin (no access to this app's token, storage or DOM), no forms,
    popups or top-level navigation. Keep it empty. Adding allow-scripts together with
    allow-same-origin would hand the report full access to the analyst's session.

    A frame also keeps the report's CSS (generic names such as .code and .background) from
    leaking into the app, and the app's CSS from distorting the report.
  -->
  <div class="safe-report">
    <div class="safe-report-shell">
      <div class="report-text-controls" role="group" aria-label="HTML report text size">
        <span class="report-text-label">Text size</span>
        <button
          type="button"
          aria-label="Decrease HTML text size"
          title="Decrease HTML text size"
          :disabled="textSize <= minTextSize"
          @click="decreaseTextSize"
        >A−</button>
        <output aria-live="polite" aria-atomic="true" aria-label="HTML text size">{{ textSize }}%</output>
        <button
          type="button"
          aria-label="Increase HTML text size"
          title="Increase HTML text size"
          :disabled="textSize >= maxTextSize"
          @click="increaseTextSize"
        >A+</button>
        <button
          type="button"
          aria-label="Reset HTML text size to 100 percent"
          :disabled="textSize === minTextSize"
          @click="resetTextSize"
        >Reset</button>
      </div>
      <div class="report-frame-viewport">
        <iframe
          class="report-frame"
          title="Vulnerability details"
          sandbox=""
          referrerpolicy="no-referrer"
          :srcdoc="srcdoc"
          :style="frameStyle"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useReportTextSize } from '@/utils/reportTextSize'

const props = defineProps({ content: { type: String, default: '' } })
const {
  textSize,
  minTextSize,
  maxTextSize,
  decreaseTextSize,
  increaseTextSize,
  resetTextSize,
} = useReportTextSize()

// Only a policy is prepended; the report itself is passed through byte for byte.
// A policy can only be tightened by later <meta> tags, never loosened, so the report
// cannot undo it. It allows the page's inline styles and nothing else: no script and no
// network, which also stops the report's CDN stylesheet/script links from phoning out.
const POLICY = '<!doctype html><meta charset="utf-8">'
  + '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; '
  + 'style-src \'unsafe-inline\'; form-action \'none\'; base-uri \'none\'">'

const srcdoc = computed(() => POLICY + props.content)

// Enlarge the isolated frame itself so the report's fixed-pixel text and source/sink
// highlighting scale together. Only its viewport changes: srcdoc stays unchanged,
// so adjusting the size does not reload the report. Text may reflow as it enlarges.
const frameStyle = computed(() => {
  const scale = textSize.value / 100
  return {
    width: `${100 / scale}%`,
    height: `${100 / scale}%`,
    transform: `scale(${scale})`,
  }
})
</script>

<style scoped>
/* The report is a standalone light page (white background, its own colours) in both
   themes; the frame gives it the white canvas it was designed for. */
.safe-report { width: 100%; height: 100%; min-height: 60vh; border: 0; background: white; }

/* Keep the flex layout inside the root: both report hosts apply their own display
   and sizing rules to the root component. The controls must stay above its scroller. */
.safe-report-shell {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.report-text-controls {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.16);
  color: rgb(var(--v-theme-on-surface));
  background: rgb(var(--v-theme-surface));
  font-size: 14px;
  line-height: 1.4;
}

.report-text-label { margin-right: 4px; }
.report-text-controls output { min-width: 3.5em; text-align: center; font-variant-numeric: tabular-nums; }
.report-text-controls button {
  min-width: 36px;
  min-height: 32px;
  padding: 4px 8px;
  border: 1px solid currentColor;
  border-radius: 4px;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.report-text-controls button:hover:not(:disabled) { background: rgba(var(--v-theme-on-surface), 0.08); }
.report-text-controls button:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
.report-text-controls button:disabled { opacity: 0.4; cursor: default; }

.report-frame-viewport { position: relative; flex: 1 1 0; min-height: 0; overflow: hidden; }
.report-frame {
  position: absolute;
  top: 0;
  left: 0;
  display: block;
  border: 0;
  background: white;
  transform-origin: top left;
}
</style>
