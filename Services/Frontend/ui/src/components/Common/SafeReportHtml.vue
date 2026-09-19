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
  <iframe
    class="safe-report"
    title="Vulnerability details"
    sandbox=""
    referrerpolicy="no-referrer"
    :srcdoc="srcdoc"
  />
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ content: { type: String, default: '' } })

// Only a policy is prepended; the report itself is passed through byte for byte.
// A policy can only be tightened by later <meta> tags, never loosened, so the report
// cannot undo it. It allows the page's inline styles and nothing else: no script and no
// network, which also stops the report's CDN stylesheet/script links from phoning out.
const POLICY = '<!doctype html><meta charset="utf-8">'
  + '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; '
  + 'style-src \'unsafe-inline\'; form-action \'none\'; base-uri \'none\'">'

const srcdoc = computed(() => POLICY + props.content)
</script>

<style scoped>
/* The report is a standalone light page (white background, its own colours) in both
   themes; the frame gives it the white canvas it was designed for. */
.safe-report { width: 100%; min-height: 60vh; border: 0; background: white; }
</style>
