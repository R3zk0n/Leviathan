<template>
  <iframe
    class="safe-report"
    title="Vulnerability details"
    sandbox=""
    referrerpolicy="no-referrer"
    :srcdoc="document"
  />
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ content: { type: String, default: '' } })
// The API returns passive allowlisted markup. A separate opaque-origin frame
// also prevents report content from accessing this application's credentials.
const document = computed(() => `<!doctype html><html><head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'">
<style>
body { font: 14px/1.5 system-ui,sans-serif; overflow-wrap: anywhere; padding: 12px; color: #222; background: #fff; }
pre { white-space: pre-wrap; background: #f4f5f7; padding: 12px; }
table { border-collapse: collapse; max-width: 100%; }
td,th { border: 1px solid #ddd; padding: 6px; text-align: left; }
</style></head><body>${props.content}</body></html>`)
</script>

<style scoped>
.safe-report { width: 100%; min-height: 60vh; border: 0; background: white; }
</style>
