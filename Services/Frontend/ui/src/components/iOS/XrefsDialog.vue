<template>
  <v-dialog
    :model-value="modelValue"
    max-width="620"
    scrollable
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card class="xrefs-card" :class="isDark ? 'theme--dark' : 'theme--light'">
      <v-card-title class="d-flex align-center py-2 px-4">
        <v-icon class="mr-2" color="primary" size="20">mdi-source-branch</v-icon>
        <span class="xrefs-title">Cross-references</span>
        <v-chip v-if="!loading && !error" size="x-small" variant="tonal" color="primary" class="ml-2">
          {{ xrefs.length }}
        </v-chip>
        <v-spacer />
        <v-btn icon variant="text" size="small" @click="$emit('update:modelValue', false)">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <div class="xrefs-subtitle px-4 pb-2">
        to <code class="xrefs-target">{{ target?.label || target?.address }}</code>
        <span v-if="target?.label" class="xrefs-target-addr">{{ target?.address }}</span>
      </div>

      <v-divider />

      <v-card-text class="xrefs-body pa-0">
        <div v-if="loading || building" class="text-center pa-6">
          <v-progress-circular indeterminate color="primary" size="26" width="3" />
          <div v-if="building" class="caption mt-2">
            Building the cross-reference index for this binary…
            <div class="xrefs-build-note mt-1">First time only — cached afterward, then instant.</div>
          </div>
          <div v-else class="caption mt-2">Scanning binary for references…</div>
        </div>

        <div v-else-if="error" class="pa-4 xrefs-error">
          {{ error }}
          <v-btn size="x-small" variant="text" color="primary" class="mt-1" @click="fetchXrefs">Retry</v-btn>
        </div>

        <div v-else-if="!xrefs.length" class="pa-6 text-center xrefs-empty">
          <v-icon size="28" class="mb-1">mdi-magnify-close</v-icon>
          <div>No <em>direct</em> references found.</div>
          <div v-if="isObjcMethod" class="caption mt-2 xrefs-empty-note">
            This looks like an Obj-C method. Its callers are almost always
            <strong>message sends</strong> (<code>objc_msgSend</code>) with a runtime
            receiver — static analysis can't resolve those to a specific class, so
            they don't show up here. This does <em>not</em> mean it's uncalled.
          </div>
          <div v-else class="caption mt-1">
            It may only be called externally, dynamically, or via the shared cache.
          </div>
        </div>

        <div v-else class="xrefs-list">
          <div
            v-for="(x, i) in xrefs"
            :key="i"
            class="xref-row"
            title="Jump to this reference"
            @click="goTo(x)"
          >
            <v-icon size="14" class="mr-2 xref-arrow">mdi-arrow-top-right</v-icon>
            <div class="xref-main">
              <span class="xref-fn">{{ x.caller_func_name || formatAddress(x.caller_func_start_address) }}</span>
              <span class="xref-site">call&nbsp;at&nbsp;{{ formatAddress(x.caller_addr) }}</span>
            </div>
          </div>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup>
/**
 * XrefsDialog — lists every code location that references a given address
 * (cross-references), from the backend's strongarm-backed xref database.
 *
 *   props:  modelValue (open), filename, target {address, label}, isDark
 *   emits:  update:modelValue, navigate({ func, addr })
 *             func = calling function start (load it), addr = exact call site.
 */
import { ref, computed, watch, onUnmounted } from 'vue';
import axios from 'axios';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  filename:   { type: String,  default: '' },
  target:     { type: Object,  default: null },  // { address, label }
  isDark:     { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue', 'navigate']);

const xrefs = ref([]);
const loading = ref(false);
const building = ref(false);   // Obj-C index building for the first time
const error = ref('');

// A message-send target — either an explicit selector (from a disassembly
// annotation) or a "Class::selector" method label. Both use the cached msgsend
// index; functions/imports fall through to live calls_to.
const targetSelector = computed(() => {
  if (props.target?.selector) return props.target.selector;
  const label = props.target?.label || '';
  return label.includes('::') ? label.slice(label.indexOf('::') + 2) : '';
});
const isObjcMethod = computed(() => !!targetSelector.value);

const base = () => import.meta.env.VITE_APP_API_URL || '';

const formatAddress = (addr) => {
  if (addr === undefined || addr === null) return '';
  if (typeof addr === 'string') {
    const parsed = parseInt(addr, 16);
    return isNaN(parsed) ? addr : `0x${parsed.toString(16)}`;
  }
  return `0x${addr.toString(16)}`;
};

let pollTimer = null;
const stopPolling = () => { if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; } };

// Obj-C method → cached msgsend index. Returns 200 (ready) or 202 (still building);
// while building we poll until it's ready. Built once per binary, then instant.
const fetchMsgSendXrefs = async () => {
  const selector = targetSelector.value;
  const url = `${base()}/ios/xrefs/${encodeURIComponent(props.filename)}/msgsend/${encodeURIComponent(selector)}`;
  const resp = await axios.get(url);
  if (resp.data?.ready) {
    xrefs.value = resp.data.xrefs || [];
    building.value = false;
    loading.value = false;
  } else {
    building.value = true;
    loading.value = false;
    stopPolling();
    pollTimer = setTimeout(fetchMsgSendXrefs, 2500);
  }
};

// Function / import → instant live calls_to.
const fetchDirectXrefs = async () => {
  const url = `${base()}/disas/disassemble/ios/${encodeURIComponent(props.filename)}/xrefs/${props.target.address}`;
  const resp = await axios.get(url);
  xrefs.value = resp.data?.xrefs || [];
  loading.value = false;
};

const fetchXrefs = async () => {
  if (!props.filename || !props.target?.address) return;
  stopPolling();
  loading.value = true;
  building.value = false;
  error.value = '';
  xrefs.value = [];
  try {
    if (isObjcMethod.value) await fetchMsgSendXrefs();
    else await fetchDirectXrefs();
  } catch (e) {
    error.value = e?.response?.data?.message || e?.message || 'Failed to compute cross-references.';
    loading.value = false;
    building.value = false;
  }
};

const goTo = (x) => {
  emit('navigate', { func: x.caller_func_start_address, addr: x.caller_addr });
  emit('update:modelValue', false);
};

// Fetch when the dialog opens with a target (or the target changes); stop polling on close.
watch(
  () => [props.modelValue, props.target?.address],
  ([open]) => { if (open) fetchXrefs(); else stopPolling(); }
);

onUnmounted(stopPolling);
</script>

<style scoped>
.xrefs-title { font-size: 15px; font-weight: 600; }
.xrefs-subtitle { font-size: 12px; opacity: 0.85; }
.xrefs-target {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-weight: 600;
}
.xrefs-target-addr {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 11px;
  opacity: 0.6;
  margin-left: 6px;
}
.xrefs-body { max-height: 55vh; }
.xrefs-error { color: #ef4444; font-size: 13px; }
.xrefs-build-note { font-size: 11px; opacity: 0.6; }
.xrefs-empty { opacity: 0.75; font-size: 13px; }
.xrefs-empty-note {
  max-width: 460px;
  margin: 0 auto;
  line-height: 1.5;
  opacity: 0.9;
  text-align: left;
}
.xrefs-empty-note code {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.95em;
}

.xrefs-list { padding: 4px 0; }
.xref-row {
  display: flex;
  align-items: center;
  padding: 7px 16px;
  cursor: pointer;
  border-left: 2px solid transparent;
  transition: background-color 0.12s ease;
}
.xref-row:hover {
  background-color: rgba(99, 102, 241, 0.1);
  border-left-color: #6366f1;
}
.xref-arrow { opacity: 0.6; }
.xref-main { display: flex; flex-direction: column; min-width: 0; }
.xref-fn {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.xref-site {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 11px;
  opacity: 0.65;
}
.theme--dark .xref-fn { color: #e5e7eb; }
.theme--light .xref-fn { color: #1f2937; }
</style>
