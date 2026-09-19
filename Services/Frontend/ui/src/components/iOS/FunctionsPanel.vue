<template>
  <div
    class="panel-content function-list"
    :class="isDark ? 'theme--dark' : 'theme--light'"
  >
    <div v-if="loading" class="text-center pa-2">
      <v-progress-circular indeterminate color="primary" size="20" width="2" />
      <div class="caption mt-1">Loading functions...</div>
    </div>

    <div v-else-if="error" class="error-message pa-2 caption">
      {{ error }}
      <v-btn x-small text color="primary" class="mt-1" @click="fetchFunctions(true)">
        Retry
      </v-btn>
    </div>

    <template v-else>
      <div
        v-for="func in functions"
        :key="func"
        class="function-item"
        :class="{ 'selected-function': selectedFunction === func }"
        :title="symbols[func] ? `${symbols[func]}  (${func})` : func"
        @click="$emit('select', func)"
        @contextmenu.prevent="$emit('context-menu', { event: $event, address: func, label: symbols[func] || func })"
      >
        <div class="fn-line">
          <span v-if="symbols[func]" class="fn-symbol">{{ symbols[func] }}</span>
          <span
            class="fn-address"
            :class="{ 'fn-address--secondary': !!symbols[func] }"
          >{{ func }}</span>
        </div>
        <span v-if="isRebaseActive" class="function-address-rebased">
          ({{ formatRebasedAddress(func) }})
        </span>
      </div>

      <div v-if="!functions.length" class="fn-empty px-3 py-2">
        No functions found.
      </div>
    </template>
  </div>
</template>

<script setup>
/**
 * FunctionsPanel — the "Functions" list for the iOS decompiler.
 *
 * Second panel extracted from the [address].vue god-component. Self-contained:
 * fetches its own function list (+ optional symbol names) and only talks to the
 * parent through props/emits.
 *
 *   props:  filename, selectedFunction, isDark, isRebaseActive, rebaseOffset
 *   emits:  select(addressStr) -> parent should viewFunction(addressStr)
 *
 * Symbols: the backend response may include a `symbols` map {address: name}
 * (best-effort from the symbol table). When present we show the name as the
 * primary label with the address demoted to a secondary; otherwise we fall back
 * to the raw address, so this works with or without the backend enhancement.
 */
import { ref, onMounted, watch } from 'vue';
import axios from 'axios';

const props = defineProps({
  filename:        { type: String,  default: '' },
  selectedFunction:{ type: String,  default: '' },
  isDark:          { type: Boolean, default: false },
  isRebaseActive:  { type: Boolean, default: false },
  rebaseOffset:    { type: Number,  default: 0 },
});
defineEmits(['select', 'context-menu']);

const functions = ref([]);
const symbols = ref({});
const loading = ref(false);
const error = ref('');
const loadedFor = ref('');

// NOTE: duplicated from the parent for now; hoist to a shared useIosAddress()
// composable once a couple more panels are extracted.
const formatRebasedAddress = (addr) => {
  if (!props.isRebaseActive) return '';
  if (addr === undefined || addr === null) return '';
  let numericAddr = addr;
  if (typeof addr === 'string') {
    numericAddr = parseInt(addr, 16);
    if (isNaN(numericAddr)) return addr;
  }
  return `0x${(numericAddr + props.rebaseOffset).toString(16)}`;
};

const fetchFunctions = async (force = false) => {
  if (!props.filename) return;
  if (!force && loadedFor.value === props.filename && functions.value.length) return;

  loading.value = true;
  error.value = '';
  try {
    const response = await axios.get(
      `${import.meta.env.VITE_APP_API_URL}/ios/functions/${encodeURIComponent(props.filename)}`
    );
    functions.value = response.data.functions || [];
    symbols.value = response.data.symbols || {};
    loadedFor.value = props.filename;
  } catch (err) {
    console.error('Error fetching functions:', err);
    error.value = 'Error fetching functions';
    functions.value = [];
    symbols.value = {};
    loadedFor.value = '';
  } finally {
    loading.value = false;
  }
};

onMounted(() => fetchFunctions());
watch(() => props.filename, () => fetchFunctions());
</script>

<style scoped>
/*
 * Layout classes copied from the parent [address].vue so the panel renders
 * identically while decoupled. Hoist the shared set into one stylesheet once
 * 2-3 panels are extracted. The fn-* rules are owned here.
 */
.panel-content {
  padding: 8px 0;
  max-height: 400px;
  overflow-y: auto;
  overflow-x: hidden;
}
.theme--dark .panel-content { background-color: #1e1e1e; }
.theme--light .panel-content { background-color: #ffffff; }

.function-list {
  padding: 0 8px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.function-item {
  padding: 4px 8px;
  margin-bottom: 1px;
  cursor: pointer;
  border-radius: 3px;
  border-left: 2px solid transparent;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: calc(var(--dynamic-font-size, 12px) * 0.85);
  transition: all 0.15s;
}
.function-item:hover { background-color: rgba(99, 102, 241, 0.05); }
.theme--dark .function-item:hover { background-color: rgba(99, 102, 241, 0.08); }

.selected-function {
  background-color: rgba(99, 102, 241, 0.12);
  border-left-color: #6366f1;
}
.theme--dark .selected-function { background-color: rgba(99, 102, 241, 0.18); }

/* Symbol name (primary) + address (secondary) */
.fn-line {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.fn-symbol {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.theme--dark .fn-symbol { color: #e5e7eb; }
.theme--light .fn-symbol { color: #1f2937; }

.fn-address { flex-shrink: 0; }
.theme--dark .fn-address { color: #a78bfa; }
.theme--light .fn-address { color: #7c3aed; font-weight: 600; }
/* When a symbol name is present, the address becomes a dim secondary label. */
.fn-address--secondary {
  font-size: calc(var(--dynamic-font-size, 12px) * 0.8);
  opacity: 0.6;
  font-weight: 400;
}
.theme--dark .fn-address--secondary { color: #9ca3af; }
.theme--light .fn-address--secondary { color: #6b7280; }

.function-address-rebased {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: calc(var(--dynamic-font-size, 12px) * 0.65);
  opacity: 0.7;
  margin-left: 4px;
}
.theme--dark .function-address-rebased { color: #10b981; }
.theme--light .function-address-rebased { color: #166534; font-weight: 600; }

.error-message {
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 500;
}
.theme--dark .error-message {
  background-color: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.fn-empty {
  font-size: 11px;
  opacity: 0.7;
}
</style>
