<template>
  <div
    class="panel-content crypto-panel"
    :class="isDark ? 'theme--dark' : 'theme--light'"
  >
    <div class="d-flex align-center justify-space-between px-3 pt-2">
      <div class="text-caption" :class="isDark ? 'theme--dark' : 'theme--light'">
        Static crypto scan
      </div>
      <v-btn
        size="x-small"
        variant="text"
        color="primary"
        :loading="cryptoLoading"
        @click.stop="fetchCrypto(true)"
      >
        Refresh
      </v-btn>
    </div>

    <div v-if="cryptoLoading" class="text-center pa-2">
      <v-progress-circular indeterminate color="primary" size="20" width="2" />
      <div class="caption mt-1">Loading crypto findings...</div>
    </div>

    <div v-else-if="cryptoError" class="error-message pa-2 caption">
      {{ cryptoError }}
      <v-btn x-small text color="primary" @click="fetchCrypto(true)" class="mt-1">
        Retry
      </v-btn>
    </div>

    <template v-else>
      <v-text-field
        v-model="cryptoQuery"
        dense
        hide-details
        prepend-inner-icon="mdi-magnify"
        placeholder="Search crypto..."
        class="search-field mb-1 mt-1"
        clearable
        flat
        single-line
        outlined
        height="28"
      />

      <div class="d-flex flex-wrap ga-2 mb-2 px-3">
        <v-chip size="x-small" variant="tonal" color="primary">
          {{ cryptoModel.summary.total }} total
        </v-chip>
        <v-chip size="x-small" variant="tonal" color="info">
          {{ cryptoModel.summary.functions }} functions
        </v-chip>
        <v-chip size="x-small" variant="tonal" color="success">
          {{ cryptoModel.summary.calls }} calls
        </v-chip>
      </div>

      <div class="methods-container">
        <div
          v-for="fn in filteredCryptoFunctions"
          :key="fn.symbol"
          class="class-section"
        >
          <!-- Function Header (styled like Methods' class header) -->
          <div
            class="class-header"
            @click.stop="toggleCryptoFunctionExpanded(fn.symbol)"
          >
            <v-icon size="14" class="mr-1">
              {{ isCryptoFunctionExpanded(fn.symbol) ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
            </v-icon>
            <span class="class-name">{{ fn.symbol }}</span>
            <span class="method-count">{{ fn.calls.length }}</span>
          </div>

          <!-- Callsites (styled like Methods' method items) -->
          <div v-if="isCryptoFunctionExpanded(fn.symbol)" class="method-items">
            <div
              v-for="c in fn.calls"
              :key="String(c.caller_addr)"
              class="method-item"
              @click.stop="jumpToCryptoCall(c)"
            >
              <div class="method-content">
                <span class="method-selector">callsite</span>
                <span class="method-address">{{ formatAddress(c.caller_addr) }}</span>
                <span v-if="isRebaseActive" class="method-address-rebased">
                  ({{ formatRebasedAddress(c.caller_addr) }})
                </span>
              </div>

              <!-- Static key preview (best-effort; only for crypto calls) -->
              <div
                v-if="c.static_key"
                class="crypto-key mt-1"
                @contextmenu.prevent="c.static_key.hex && copyStaticKey(c.static_key.hex)"
              >
                <template v-if="c.static_key.type === 'IMMEDIATE' && c.static_key.hex">
                  <div class="crypto-key-line">
                    <span class="crypto-key-label">static key</span>
                    <code class="crypto-key-addr">{{ c.static_key.address }}</code>
                    <span class="crypto-key-size">({{ c.static_key.size }} bytes)</span>
                    <v-icon
                      size="13"
                      class="crypto-key-copy ml-1"
                      title="Copy static key (or right-click the key)"
                      @click.stop="copyStaticKey(c.static_key.hex)"
                    >mdi-content-copy</v-icon>
                  </div>
                  <code
                    class="crypto-key-hex crypto-key-hex--copyable"
                    title="Click to copy full key"
                    @click.stop="copyStaticKey(c.static_key.hex)"
                  >{{ c.static_key.hex }}</code>
                </template>
                <template v-else>
                  <div class="crypto-key-line">
                    <span class="crypto-key-label">static key</span>
                    <span class="crypto-key-miss">
                      ({{ c.static_key.register }}={{ c.static_key.type }}{{ c.static_key.value ? (': ' + c.static_key.value) : '' }})
                    </span>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>

        <div v-if="!filteredCryptoFunctions.length" class="crypto-empty px-3 py-2">
          No crypto functions found.
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
/**
 * CryptoPanel — the "Static crypto scan" panel for the iOS decompiler.
 *
 * First step of decomposing the pages/iOS/Decompiler/[filename]/[address].vue
 * god-component. Self-contained: owns its own fetch + state and only talks to
 * the parent through a small props/emits contract.
 *
 *   props:  filename, isDark, isRebaseActive, rebaseOffset
 *   emits:  navigate(addressStr) -> parent should viewFunction(addressStr)
 *           copied(message)       -> parent should show a copy confirmation
 */
import { ref, reactive, computed, onMounted, watch } from 'vue';
import axios from 'axios';

const props = defineProps({
  filename:       { type: String,  default: '' },
  isDark:         { type: Boolean, default: false },
  isRebaseActive: { type: Boolean, default: false },
  rebaseOffset:   { type: Number,  default: 0 },
});
const emit = defineEmits(['navigate', 'copied']);

// ── State ──────────────────────────────────────────────────────────────────
const cryptoQuery = ref('');
const cryptoLoading = ref(false);
const cryptoError = ref('');
const cryptoLoadedFor = ref('');
const cryptoRaw = ref(null);

// Expanded state for crypto functions (match Methods panel UX)
const expandedCryptoFunctions = reactive({});

const cryptoModel = reactive({
  summary: {
    total: 0,
    functions: 0,
    calls: 0,
  },
  functions: [],
});

const filteredCryptoFunctions = computed(() => {
  const q = (cryptoQuery.value || '').toLowerCase();
  const items = cryptoModel.functions || [];
  if (!q) return items;

  return items
    .map(fn => ({
      ...fn,
      calls: (fn.calls || []).filter(c => String(c.caller_addr ?? '').toLowerCase().includes(q))
    }))
    .filter(fn => fn.symbol.toLowerCase().includes(q) || (fn.calls || []).length > 0);
});

const isCryptoFunctionExpanded = (symbol) => !!expandedCryptoFunctions[symbol];
const toggleCryptoFunctionExpanded = (symbol) => {
  expandedCryptoFunctions[symbol] = !expandedCryptoFunctions[symbol];
};

// ── Address formatting ───────────────────────────────────────────────────────
// NOTE: duplicated from the parent for now. Once 2-3 panels are extracted, hoist
// these into a shared useIosAddress(isRebaseActive, rebaseOffset) composable.
const formatAddress = (addr) => {
  if (addr === undefined || addr === null) return '';
  if (typeof addr === 'string') {
    const parsed = parseInt(addr, 16);
    if (isNaN(parsed)) return addr;
    return `0x${parsed.toString(16)}`;
  }
  return `0x${addr.toString(16)}`;
};

const formatRebasedAddress = (addr) => {
  if (!props.isRebaseActive) return '';
  if (addr === undefined || addr === null) return '';

  let numericAddr = addr;
  if (typeof addr === 'string') {
    numericAddr = parseInt(addr, 16);
    if (isNaN(numericAddr)) return addr;
  }

  const rebasedAddr = numericAddr + props.rebaseOffset;
  return `0x${rebasedAddr.toString(16)}`;
};

// ── Data fetch ───────────────────────────────────────────────────────────────
const normalizeCryptoResponse = (payload) => {
  // Expected backend shape:
  // { symbol: "_CCCrypt", calls: [{caller_addr, destination_addr}, ...] }
  const root = payload?.result ?? payload?.data ?? payload ?? {};

  const functions = [];
  if (typeof root.symbol === 'string' && Array.isArray(root.calls)) {
    functions.push({
      symbol: root.symbol,
      calls: root.calls
        .filter(c => c && c.caller_addr !== null && c.caller_addr !== undefined)
        .map(c => ({
          caller_addr: c.caller_addr,
          caller_function_start: c.caller_function_start ?? null,
          caller_func_start_address: c.caller_func_start_address ?? null,
          destination_addr: c.destination_addr,
          static_key: c.static_key ?? null,
        }))
    });
  }

  cryptoModel.functions = functions;
  cryptoModel.summary.functions = functions.length;
  cryptoModel.summary.calls = functions.reduce((acc, fn) => acc + (fn.calls?.length || 0), 0);
  cryptoModel.summary.total = cryptoModel.summary.calls;

  // Initialize expanded state and default-expand the first function for convenience
  functions.forEach((fn, idx) => {
    if (expandedCryptoFunctions[fn.symbol] === undefined) {
      expandedCryptoFunctions[fn.symbol] = idx === 0;
    }
  });
};

const fetchCrypto = async (force = false) => {
  if (!props.filename) return;

  // Avoid refetching unless requested or filename changed.
  if (!force && cryptoLoadedFor.value === props.filename && cryptoRaw.value) return;

  cryptoLoading.value = true;
  cryptoError.value = '';

  try {
    const url = `${import.meta.env.VITE_APP_API_URL}/ios/crypto/${encodeURIComponent(props.filename)}`;
    const resp = await axios.get(url);

    cryptoRaw.value = resp?.data ?? null;
    cryptoLoadedFor.value = props.filename;

    normalizeCryptoResponse(resp?.data);
  } catch (e) {
    cryptoError.value = e?.response?.data?.message || e?.message || 'Failed to load crypto findings.';
    cryptoRaw.value = null;
    cryptoLoadedFor.value = '';

    cryptoModel.functions = [];
    cryptoModel.summary.total = 0;
    cryptoModel.summary.functions = 0;
    cryptoModel.summary.calls = 0;
  } finally {
    cryptoLoading.value = false;
  }
};

// ── Navigation + copy ────────────────────────────────────────────────────────
// Crypto-specific navigation: open the full caller function if available.
const jumpToCryptoCall = (call) => {
  if (!call) return;
  const target = call.caller_function_start || call.caller_func_start_address || call.caller_addr;
  if (!target) return;
  emit('navigate', formatAddress(target));
};

// Copy a detected static crypto key. Uses the full hex value (c.static_key.hex),
// not the CSS-truncated preview shown in the panel — the whole point for RE.
const copyStaticKey = async (hex) => {
  if (!hex) return;
  try {
    await navigator.clipboard.writeText(hex);
    emit('copied', 'Static key copied to clipboard!');
  } catch (err) {
    console.error('Failed to copy static key:', err);
  }
};

// The panel only mounts when the user opens it (parent v-if), so fetch on mount;
// refetch if the binary changes while the panel stays open.
onMounted(() => fetchCrypto());
watch(() => props.filename, () => fetchCrypto());
</script>

<style scoped>
/*
 * NOTE: the layout classes below (panel-content / search-field / class-* / method-*)
 * are copied from the parent [address].vue so this panel renders identically while
 * decoupled. Once 2-3 panels are extracted, hoist the shared set into one stylesheet
 * both import. The crypto-key* rules are owned here (crypto-only).
 */
.panel-content {
  padding: 8px 0;
  max-height: 400px;
  overflow-y: auto;
  overflow-x: hidden;
}
.theme--dark .panel-content { background-color: #1e1e1e; }
.theme--light .panel-content { background-color: #ffffff; }

.search-field {
  margin: 8px 12px 12px 12px;
  font-size: 12px;
}
.theme--dark .search-field {
  --v-field-bg: #2d2d2d;
  --v-theme-surface: #2d2d2d;
}
.theme--light .search-field {
  --v-field-bg: #ffffff;
  --v-theme-surface: #ffffff;
}

.methods-container { padding: 0 8px; }
.class-section { margin-bottom: 6px; }

.class-header {
  padding: 6px 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  border-radius: 4px;
  transition: background-color 0.15s;
  user-select: none;
}
.theme--dark .class-header { background-color: rgba(255, 255, 255, 0.02); }
.theme--light .class-header { background-color: rgba(0, 0, 0, 0.02); }
.class-header:hover { background-color: rgba(99, 102, 241, 0.08); }
.theme--dark .class-header:hover { background-color: rgba(99, 102, 241, 0.12); }

.class-name {
  font-weight: 600;
  font-size: calc(var(--dynamic-font-size, 12px) * 0.9);
  margin-right: auto;
}
.theme--dark .class-name { color: #818cf8; }
.theme--light .class-name { color: #1e40af; }

.method-count {
  font-size: calc(var(--dynamic-font-size, 12px) * 0.75);
  opacity: 0.8;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: 600;
}
.theme--dark .method-count {
  background-color: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}
.theme--light .method-count {
  background-color: rgba(0, 0, 0, 0.08);
  color: rgba(0, 0, 0, 0.7);
}

.method-items {
  margin-left: 16px;
  padding-left: 8px;
  margin-top: 4px;
  border-left: 1px solid rgba(99, 102, 241, 0.2);
}

.method-item {
  padding: 4px 8px;
  margin-bottom: 1px;
  cursor: pointer;
  font-size: 11px;
  border-radius: 3px;
  border-left: 2px solid transparent;
  transition: all 0.15s;
}
.method-item:hover { background-color: rgba(99, 102, 241, 0.05); }
.theme--dark .method-item:hover { background-color: rgba(99, 102, 241, 0.08); }

.method-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.method-selector {
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 8px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: calc(var(--dynamic-font-size, 12px) * 0.85);
  font-weight: 500;
}
.theme--dark .method-selector { color: #e5e7eb; }
.theme--light .method-selector { color: #1f2937; }

.method-address {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: calc(var(--dynamic-font-size, 12px) * 0.7);
  opacity: 0.8;
}
.theme--dark .method-address { color: #a78bfa; }
.theme--light .method-address { color: #7c3aed; font-weight: 600; }

.method-address-rebased {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: calc(var(--dynamic-font-size, 12px) * 0.65);
  opacity: 0.7;
  margin-left: 4px;
}
.theme--dark .method-address-rebased { color: #10b981; }
.theme--light .method-address-rebased { color: #166534; font-weight: 600; }

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

.crypto-empty {
  font-size: 11px;
  opacity: 0.7;
}

/* ── Static key display (crypto-only) ─────────────────────────────────────── */
.crypto-key { padding-top: 2px; }

.crypto-key-line {
  display: flex;
  gap: 6px;
  align-items: baseline;
  flex-wrap: wrap;
}

.crypto-key-label {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  opacity: 0.85;
}

.crypto-key-addr,
.crypto-key-hex {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 10px;
}

.crypto-key-hex {
  display: block;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  opacity: 0.9;
}

/* Copy affordances for the detected static key */
.crypto-key-copy {
  cursor: pointer;
  opacity: 0.55;
  vertical-align: middle;
  transition: opacity 0.15s ease;
}
.crypto-key-copy:hover { opacity: 1; }
.crypto-key-hex--copyable { cursor: pointer; }
.crypto-key-hex--copyable:hover {
  opacity: 1;
  text-decoration: underline;
}

.crypto-key-size,
.crypto-key-miss {
  font-size: 10px;
  opacity: 0.75;
}

.theme--dark .crypto-key-addr,
.theme--dark .crypto-key-hex { color: #34d399; }
.theme--light .crypto-key-addr,
.theme--light .crypto-key-hex { color: #166534; }
.theme--dark .crypto-key-label { color: #a78bfa; }
.theme--light .crypto-key-label { color: #7c3aed; }
</style>
