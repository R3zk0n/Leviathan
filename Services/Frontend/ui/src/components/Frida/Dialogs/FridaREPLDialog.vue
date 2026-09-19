<template>
  <v-dialog v-model="dialog" fullscreen hide-overlay transition="dialog-bottom-transition">
    <v-card class="d-flex flex-column frida-repl" dark>
      <v-toolbar color="primary" dense>
        <v-btn icon @click="closeDialog">
          <v-icon>mdi-close</v-icon>
        </v-btn>
        <v-toolbar-title>Frida REPL - {{ deviceName }} - OS: {{ osType }}</v-toolbar-title>
        <v-spacer></v-spacer>

        <!-- Agent Controls -->
        <v-btn
          v-if="isPaused"
          text
          @click="resumeApp"
          class="mr-2"
          color="warning"
        >
          <v-icon left>mdi-play</v-icon>
          Resume app
        </v-btn>

        <v-btn
          text
          @click="loadInitREPL"
          class="mr-2"
          :loading="isLoadingREPL"
          :disabled="isLoadingREPL"
          color="info"
        >
          <v-icon left>mdi-console</v-icon>
          {{ replInitialized ? 'Reload bridges' : 'Load bridges' }}
        </v-btn>

        <v-switch
          v-model="autoLoadBridges"
          density="compact"
          hide-details
          color="info"
          class="mr-3"
          label="Auto-load"
          title="Automatically load the device's Java/ObjC bridges when the REPL opens"
        />

        <v-btn
          text
          @click="loadAgent"
          class="mr-2"
          :loading="isLoadingAgent"
          :disabled="isLoadingAgent || agentLoaded"
          color="success"
        >
          <v-icon left>mdi-puzzle</v-icon>
          {{ agentLoaded ? 'Agent Loaded' : 'Load Agent' }}
        </v-btn>

        <v-btn text @click="clearTerminal" class="mr-2">
          <v-icon left>mdi-delete</v-icon>
          Clear ({{ terminalLineCount }})
        </v-btn>

        <v-btn
          text
          @click="killRunningScripts"
          class="mr-2"
          :loading="isKillingScripts"
          :disabled="isKillingScripts || !hasActiveScripts"
          color="error"
        >
          <v-icon left>mdi-stop-circle</v-icon>
          Kill Scripts
        </v-btn>

        <FridaInfoDropdown
          :device-id="deviceId"
          :pid="pid"
          :session-id="sessionId"
        />

        <!-- Font Size Controls -->
        <v-divider vertical class="mx-2" />
        <div class="d-flex align-center font-controls">
          <v-btn icon @click="decreaseFonts" :disabled="!canDecreaseFonts" :title="'Decrease font size'">
            <v-icon>mdi-format-font-size-decrease</v-icon>
          </v-btn>
          <v-btn icon @click="resetFonts" :title="'Reset font size'">
            <v-icon>mdi-format-font-size</v-icon>
          </v-btn>
          <v-btn icon @click="increaseFonts" :disabled="!canIncreaseFonts" :title="'Increase font size'">
            <v-icon>mdi-format-font-size-increase</v-icon>
          </v-btn>
          <span class="caption ml-2">{{ terminalFontSize }}px / {{ monacoFontSize }}px</span>
        </div>

        <!-- Enhanced Hooks Button with Activity Indicator -->
        <v-btn
          text
          @click="toggleHooksDialog"
          class="ml-2"
          :color="(useNewVersion ? showFridaClicks : showHooksDialog) ? 'primary' : (activeFeatureCount > 0 ? 'success' : '')"
        >
          <v-badge
            :value="activeFeatureCount > 0"
            :content="activeFeatureCount"
            color="green"
            overlap
          >
            <v-icon left>{{ (useNewVersion ? showFridaClicks : showHooksDialog) ? 'mdi-eye-off' : 'mdi-eye' }}</v-icon>
          </v-badge>
          {{ (useNewVersion ? showFridaClicks : showHooksDialog) ? 'Hide' : 'Hooks' }}
          <v-chip
            x-small
            class="ml-2"
            :color="activeFeatureCount > 0 ? 'green' : 'grey'"
            v-if="activeFeatureCount > 0"
          >
            {{ activeFeatureCount }} active
          </v-chip>
        </v-btn>
      </v-toolbar>

      <!-- Main REPL Container - Single scroll area -->
      <div class="repl-main-container">
        <!-- Terminal Output Area -->
        <div
          ref="terminal"
          class="terminal pa-4"
          :style="{ '--terminal-font-size': terminalFontSize + 'px' }"
          @scroll="handleTerminalScroll"
        >
          <div class="terminal-content">{{ visibleTerminalContent }}</div>
        </div>

        <!-- Command Input Area (Fixed) -->
        <div class="repl-input pa-3">
          <div class="d-flex align-center">
            <label for="frida-command-input" class="prompt mr-2">[{{ deviceName }}::PID::{{ pid }}]{{ replInitialized ? ' (REPL)' : '' }}{{ agentLoaded ? ' (Agent)' : '' }}-> </label>
            <input
              id="frida-command-input"
              ref="commandInput"
              v-model="command"
              @keydown="handleKeyDown"
              type="text"
              class="command-input flex-grow-1"
              placeholder="Enter Frida command or 'help' for assistance"
              :disabled="isExecutingCommand"
              autocomplete="off"
            />
            <v-btn
              @click="sendCommand"
              color="primary"
              small
              class="ml-2"
              :loading="isExecutingCommand"
              :disabled="!command.trim() || isExecutingCommand"
            >
              Execute
            </v-btn>
          </div>
        </div>

        <!-- Enhanced Resizer Bar -->
        <div
          class="resizer-bar"
          @mousedown="startResize"
          @touchstart="startResize"
          @dblclick="handleResizerDoubleClick"
          :class="{ 'resizing': isResizing }"
        >
          <div class="resizer-handle">
            <div class="handle-icon"></div>
          </div>
        </div>

        <!-- Scripting Panel (Fixed at bottom) -->
        <div class="scripting-section" :style="{ height: `${editorHeight + 50}px`, maxHeight: 'calc(50vh - 60px)' }">
          <!-- Control Bar -->
          <div class="script-controls pa-2">
            <div class="controls-bar">
              <!-- Left: Mode + IntelliSense status -->
              <div class="controls-group">
                <v-btn-toggle v-model="executionMode" mandatory dense class="mode-toggle">
                  <v-btn x-small value="direct" :disabled="!agentLoaded">
                    <v-icon left x-small>mdi-flash</v-icon>
                    Direct
                  </v-btn>
                  <v-btn x-small value="agent" :disabled="!agentLoaded">
                    <v-icon left x-small>mdi-puzzle</v-icon>
                    Agent
                  </v-btn>
                </v-btn-toggle>

                <!-- IntelliSense Status Pill -->
                <div
                  class="intellisense-pill"
                  :class="{
                    'is-loading': isLoadingTypings,
                    'is-ready': typingsLoaded && !isLoadingTypings,
                    'is-idle': !typingsLoaded && !isLoadingTypings
                  }"
                  @click="loadFridaTypings"
                  :title="typingsLoaded ? 'IntelliSense active — click to reload' : 'Click to load IntelliSense'"
                >
                  <span class="pill-dot"></span>
                  <span class="pill-label">
                    <template v-if="isLoadingTypings">Loading hints...</template>
                    <template v-else-if="typingsLoaded">IntelliSense</template>
                    <template v-else>No IntelliSense</template>
                  </span>
                  <v-icon v-if="typingsLoaded && !isLoadingTypings" x-small class="pill-reload-icon">mdi-refresh</v-icon>
                </div>
              </div>

              <!-- Right: Action buttons -->
              <div class="controls-group">
                <v-btn @click="runScript" color="primary" x-small :loading="isRunningScript" :disabled="isRunningScript || !hasScriptContent" class="action-btn">
                  <v-icon left x-small>mdi-play</v-icon>
                  RUN
                </v-btn>
                <v-btn @click="testAgentFeatures" color="warning" x-small :loading="isTestingAgent" :disabled="!agentLoaded || isTestingAgent" class="action-btn">
                  <v-icon left x-small>mdi-test-tube</v-icon>
                  TEST
                </v-btn>
              </div>
            </div>
          </div>

          <!-- Monaco Editor (Fixed height) with IntelliSense glow -->
          <div
            class="monaco-wrapper"
            :class="{ 'intellisense-active': typingsLoaded }"
            :style="{ height: `${editorHeight}px`, maxHeight: 'calc(50vh - 110px)' }"
          >
            <!-- Welcome overlay — fades out on first interaction -->
            <transition name="overlay-fade">
              <div v-if="showEditorOverlay" class="editor-welcome-overlay" @click="dismissEditorOverlay">
                <div class="overlay-content">
                  <div class="overlay-title">
                    <v-icon color="white" class="mr-2">mdi-code-braces</v-icon>
                    Frida Script Editor
                  </div>
                  <div class="overlay-shortcuts">
                    <div class="shortcut-row">
                      <kbd>Ctrl</kbd> + <kbd>Space</kbd>
                      <span>Trigger autocomplete</span>
                    </div>
                    <div class="shortcut-row">
                      <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Space</kbd>
                      <span>Parameter hints</span>
                    </div>
                    <div class="shortcut-row">
                      <kbd>Ctrl</kbd> + <kbd>D</kbd>
                      <span>Duplicate line</span>
                    </div>
                    <div class="shortcut-row">
                      <kbd>Ctrl</kbd> + <kbd>/</kbd>
                      <span>Toggle comment</span>
                    </div>
                  </div>
                  <div class="overlay-hint">Click or start typing to dismiss</div>
                </div>
              </div>
            </transition>
            <MonacoEditor
              ref="monacoEditor"
              v-model="scriptContent"
              language="javascript"
              theme="vs-dark"
              :height="'100%'"
              :options="optimizedMonacoOptions"
              @run="runScript"
            />
          </div>
        </div>
      </div>

      <!-- Hook Activity Status Bar -->
      <v-card
        v-if="activeFeatureCount > 0"
        class="hook-status-bar pa-2"
        color="rgba(76, 175, 80, 0.1)"
        outlined
      >
        <div class="d-flex align-center">
          <v-icon small color="green" class="mr-2">mdi-record-circle</v-icon>
          <span class="caption">
            {{ activeFeatureCount }} active hook{{ activeFeatureCount > 1 ? 's' : '' }} running
          </span>
          <v-spacer></v-spacer>
          <v-btn
            x-small
            text
            color="green"
            @click="openHooksDialog">
            View Details
          </v-btn>
        </div>
      </v-card>

      <!-- Hook Activity Notifications -->
      <v-snackbar
        v-model="hookActivitySnackbar"
        timeout="3000"
        color="success"
        bottom
        right
        shaped
      >
        <v-icon left>mdi-hook</v-icon>
        {{ hookActivityMessage }}
        <template v-slot:action="{ attrs }">
          <v-btn
            color="white"
            text
            v-bind="attrs"
            @click="hookActivitySnackbar = false"
          >
            Close
          </v-btn>
        </template>
      </v-snackbar>
    </v-card>

      <FridaClicksContainer
      v-if="useNewVersion"
      :visible="showFridaClicks"
      :title="'Frida Agent Control Panel'"
      :session-id="sessionId"
      :device-id="deviceId"
      :pid="pid"
      @close="showFridaClicks = false"
    />

    <!-- FridaClicks Dialog -->
    <FridaClicks
      :visible="showHooksDialog"
      :session-id="sessionId"
      :device-id="deviceId"
      :pid="pid"
      :title="`Frida Agent Control Panel - ${deviceName}`"
      @close="showHooksDialog = false"
      @feature-toggle="onFeatureToggle"
    />
  </v-dialog>
</template>

<script setup>
import EventSource from '@/utils/authenticatedEventSource'
import { ref, onMounted, watch, nextTick, computed, onUnmounted } from 'vue';
import { useStore } from 'vuex';
import axios from 'axios';
import MonacoEditor from "@/components/Frida/Dialogs/MonacoEditor.vue";
import FridaInfoDropdown from "@/components/Frida/Dialogs/FridaInfoDropdown.vue";
import FridaClicks from "@/components/Frida/Dialogs/FridaClicks/FridaClicks.vue";
import FridaClicksContainer from "@/components/Frida/Dialogs/FridaClicks/FridaClicksContainer.vue";

// Performance constants
const MAX_TERMINAL_LINES = 1000;
const BATCH_UPDATE_DELAY = 16; // ~60fps
const RESIZE_THROTTLE = 16;
const VISIBLE_LINES = 200; // Virtual scrolling

const props = defineProps({
  modelValue: Boolean,
  deviceId: String,
  deviceName: String,
  sessionId: String,
  pid: Number,
  osType: {
    type: String,
    default: 'Unknown',
    validator: (value) => ['iOS', 'Android', 'Unknown'].includes(value)
  },
  applicationName: String,
  // True when the target was spawn-gated (spawned paused). Auto-init is deferred
  // until the user clicks Resume, so hooks/bridges can be set up before the app runs.
  paused: Boolean,
});

const emit = defineEmits(['update:modelValue']);

const store = useStore();
const isDark = computed(() => store.state.isDark);
const useNewVersion = ref(true)

const dialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

// UI refs
const terminal = ref(null);
const commandInput = ref(null);
const monacoEditor = ref(null);

// Wait for Monaco editor internal instance to be ready (avoids "Editor not initialized" race)
const waitForEditor = (timeoutMs = 3000) => {
  return new Promise((resolve, reject) => {
    // Already ready
    if (monacoEditor.value?.editor?.value || monacoEditor.value?.editor) {
      return resolve(true);
    }
    const interval = 100;
    let elapsed = 0;
    const check = setInterval(() => {
      elapsed += interval;
      if (monacoEditor.value?.editor?.value || monacoEditor.value?.editor) {
        clearInterval(check);
        resolve(true);
      } else if (elapsed >= timeoutMs) {
        clearInterval(check);
        reject(new Error('Editor did not initialize within timeout'));
      }
    }, interval);
  });
};

// State
const command = ref('');
const commandHistory = ref([]);
const historyIndex = ref(-1);
const scriptingPanel = ref([]);
const showHooksDialog = ref(false);     // This controls the OLD FridaClicks
const showFridaClicks = ref(false);     // ADD THIS - This controls the NEW FridaClicksContainer


// Hook activity tracking
const activeFeatureCount = ref(0);
const hookActivitySnackbar = ref(false);
const hookActivityMessage = ref('');

// Optimized terminal state
const terminalContent = ref([]);
const pendingTerminalUpdates = ref([]);
let updateTimeout = null;
let resizeTimeout = null;
let eventSource = null;
// Hook-stream (SSE) status. EventSource reconnects on its own for transient
// drops (using the server's `retry:` hint); we only track whether we're
// mid-reconnect so we can tell the user once, not on every retry tick.
let hooksReconnecting = false;

// Virtual scrolling state
const terminalScrollTop = ref(0);
const terminalHeight = ref(0);

// Performance optimized computed properties
const terminalLineCount = computed(() => terminalContent.value.length);
const visibleTerminalContent = computed(() => {
  if (terminalContent.value.length <= VISIBLE_LINES) {
    return terminalContent.value.join('\n');
  }

  // Show last VISIBLE_LINES for performance
  const start = Math.max(0, terminalContent.value.length - VISIBLE_LINES);
  return terminalContent.value.slice(start).join('\n');
});

const hasScriptContent = computed(() => {
  return scriptContent.value && scriptContent.value.trim().length > 0;
});

const hasActiveScripts = computed(() => {
  return agentLoaded.value || replInitialized.value;
});



// Script execution state
const isRunningScript = ref(false);
const isExecutingCommand = ref(false);
const isKillingScripts = ref(false);
const scriptContent = ref(`// Frida script editor
//   • Autocomplete: type Java. / ObjC. / Interceptor. / Memory. (Ctrl+Space)
//   • Run this script: Ctrl+Enter or RUN · quick one-liners: the command bar above
`);

// Agent state
const agentLoaded = ref(false);
const isLoadingAgent = ref(false);
const isTestingAgent = ref(false);
const executionMode = ref('direct');
const javaBridgeLoaded = ref(false);

// REPL initialization state
const replInitialized = ref(false);
const isLoadingREPL = ref(false);
// One-step attach: auto-load the OS-matched Java/ObjC bridges when the REPL opens,
// so the user doesn't have to click first. Remembered per-browser; turn it off for
// a lean raw-JS attach (native-only target, or a sensitive process).
const AUTO_LOAD_BRIDGES_KEY = 'frida.autoLoadBridges';
const autoLoadBridges = ref((() => {
  try { return localStorage.getItem(AUTO_LOAD_BRIDGES_KEY) !== 'false'; } catch { return true; }
})());
watch(autoLoadBridges, (v) => {
  try { localStorage.setItem(AUTO_LOAD_BRIDGES_KEY, v ? 'true' : 'false'); } catch { /* ignore */ }
});
// The session id the bridges were last initialized for: reopening the SAME live
// session re-subscribes the stream without a redundant re-init, while a NEW attach
// (different id) resets stale flags and auto-inits.
let lastInitSessionId = null;
// Mirrors the `paused` prop per open; while true the target is spawn-gated and
// auto-init is deferred until Resume.
const isPaused = ref(false);

// Resizing state
const isResizing = ref(false);
const editorHeight = ref(200);
const minEditorHeight = 100;
const maxEditorHeight = 400;
const previousEditorHeight = ref(200);

// Monaco options optimized for performance
const optimizedMonacoOptions = ref({
  scrollBeyondLastLine: false,
  minimap: { enabled: false },
  wordWrap: 'on',
  automaticLayout: false, // Manual control for performance
  fontSize: 16, // Reduced from 18
  lineHeight: 20,
  scrollbar: {
    vertical: 'auto',
    horizontal: 'auto',
    useShadows: false,
    verticalScrollbarSize: 10,
    horizontalScrollbarSize: 10
  },
  renderWhitespace: 'none',
  renderControlCharacters: false,
  disableLayerHinting: true,
  renderLineHighlight: 'none'
});

// Typing hints
// MonacoEditor exposes these via defineExpose and Vue unwraps the refs on the parent
// side, so read them WITHOUT `.value` (the old `.value` on a boolean was always
// undefined -> the pill was stuck on "No IntelliSense" while typings were loaded).
const isLoadingTypings = computed(() => monacoEditor.value?.isLoadingTypings || false);
const typingsLoaded = computed(() => monacoEditor.value?.typingsLoaded || false);

// Editor welcome overlay — shown until first interaction
const showEditorOverlay = ref(true);
const dismissEditorOverlay = () => { showEditorOverlay.value = false; };

// Dismiss overlay on first editor content change
watch(() => scriptContent.value, () => {
  if (showEditorOverlay.value) showEditorOverlay.value = false;
}, { once: true });

// Feature toggle handler
const onFeatureToggle = (featureData) => {
  const { platform, category, feature, enabled, type } = featureData;

  // Update active feature count
  if (enabled) {
    activeFeatureCount.value++;
    hookActivityMessage.value = `${platform} ${category} ${feature} activated`;
    hookActivitySnackbar.value = true;

    // Log to terminal
    appendToTerminal(`Hook activated: ${platform}.${category}.${feature}`);
  } else {
    activeFeatureCount.value = Math.max(0, activeFeatureCount.value - 1);
    hookActivityMessage.value = `${platform} ${category} ${feature} deactivated`;
    hookActivitySnackbar.value = true;

    // Log to terminal
    appendToTerminal(`Hook deactivated: ${platform}.${category}.${feature}`);
  }

  // Log additional info for logging type features
  if (type === 'logging' && enabled) {
    appendToTerminal(`Real-time logging started for ${feature}`);
  }
};

// Font size controls
const DEFAULT_TERMINAL_FONT_SIZE = 14;
const DEFAULT_MONACO_FONT_SIZE = 16;

const terminalFontSize = ref(DEFAULT_TERMINAL_FONT_SIZE);
const monacoFontSize = ref(DEFAULT_MONACO_FONT_SIZE);

const MIN_TERMINAL_FONT_SIZE = 10;
const MAX_TERMINAL_FONT_SIZE = 22;
const MIN_MONACO_FONT_SIZE = 10;
const MAX_MONACO_FONT_SIZE = 26;

const canDecreaseFonts = computed(() => {
  return terminalFontSize.value > MIN_TERMINAL_FONT_SIZE || monacoFontSize.value > MIN_MONACO_FONT_SIZE;
});

const canIncreaseFonts = computed(() => {
  return terminalFontSize.value < MAX_TERMINAL_FONT_SIZE || monacoFontSize.value < MAX_MONACO_FONT_SIZE;
});

const applyMonacoFontSize = () => {
  // Keep options reactive; also try to update the underlying editor if exposed.
  optimizedMonacoOptions.value = {
    ...optimizedMonacoOptions.value,
    fontSize: monacoFontSize.value,
  };

  // If Monaco instance is available and supports updateOptions, apply immediately.
  try {
    if (monacoEditor.value?.editor?.updateOptions) {
      monacoEditor.value.editor.updateOptions({ fontSize: monacoFontSize.value });
    }
  } catch (e) {
    // ignore
  }

  triggerMonacoLayout();
};

const decreaseFonts = () => {
  terminalFontSize.value = Math.max(MIN_TERMINAL_FONT_SIZE, terminalFontSize.value - 1);
  monacoFontSize.value = Math.max(MIN_MONACO_FONT_SIZE, monacoFontSize.value - 1);
  applyMonacoFontSize();
};

const increaseFonts = () => {
  terminalFontSize.value = Math.min(MAX_TERMINAL_FONT_SIZE, terminalFontSize.value + 1);
  monacoFontSize.value = Math.min(MAX_MONACO_FONT_SIZE, monacoFontSize.value + 1);
  applyMonacoFontSize();
};

const resetFonts = () => {
  terminalFontSize.value = DEFAULT_TERMINAL_FONT_SIZE;
  monacoFontSize.value = DEFAULT_MONACO_FONT_SIZE;
  applyMonacoFontSize();
};

// Ensure Monaco picks up the initial configured font size
watch(monacoEditor, () => {
  applyMonacoFontSize();
});

// Optimized terminal functions
const appendToTerminal = (text) => {
  // Add to pending updates instead of immediate DOM manipulation
  pendingTerminalUpdates.value.push(text);

  // Batch DOM updates for better performance
  if (updateTimeout) {
    clearTimeout(updateTimeout);
  }

  updateTimeout = setTimeout(() => {
    flushTerminalUpdates();
  }, BATCH_UPDATE_DELAY);
};

const flushTerminalUpdates = () => {
  if (pendingTerminalUpdates.value.length === 0) return;

  // Add all pending updates to content array
  terminalContent.value.push(...pendingTerminalUpdates.value);

  // Limit terminal history to prevent memory/performance issues
  if (terminalContent.value.length > MAX_TERMINAL_LINES) {
    terminalContent.value = terminalContent.value.slice(-MAX_TERMINAL_LINES);
  }

  // Update DOM efficiently using textContent for security and performance
  if (terminal.value) {
    const terminalContentEl = terminal.value.querySelector('.terminal-content');
    if (terminalContentEl) {
      terminalContentEl.textContent = visibleTerminalContent.value;
    }

    // Scroll to bottom
    nextTick(() => {
      terminal.value.scrollTop = terminal.value.scrollHeight;
    });
  }

  // Clear pending updates
  pendingTerminalUpdates.value = [];
  updateTimeout = null;
};

const clearTerminal = () => {
  terminalContent.value = [];
  pendingTerminalUpdates.value = [];
  if (updateTimeout) {
    clearTimeout(updateTimeout);
    updateTimeout = null;
  }
  if (terminal.value) {
    const terminalContentEl = terminal.value.querySelector('.terminal-content');
    if (terminalContentEl) {
      terminalContentEl.textContent = '';
    }
  }
};

const handleTerminalScroll = (event) => {
  terminalScrollTop.value = event.target.scrollTop;
};

// Monaco editor functions

const triggerMonacoLayout = () => {
  if (monacoEditor.value) {
    // Try the new layout method first, fallback to editor.layout()
    if (monacoEditor.value.layout) {
      monacoEditor.value.layout();
    } else if (monacoEditor.value.editor && monacoEditor.value.editor.layout) {
      requestAnimationFrame(() => {
        monacoEditor.value.editor.layout();
      });
    }
  }
};

const loadFridaTypings = async () => {
  try {
    // Ensure editor is ready
    if (!monacoEditor.value?.editor) {
      try {
        await waitForEditor();
      } catch {
        // Not a problem — MonacoEditor auto-loads typings on mount now
        appendToTerminal('[REPL] Editor initializing — typings will auto-load');
        return;
      }
    }

    // Base typings (GUM + Java bridge + ObjC bridge) are now bundled locally
    // and auto-loaded by MonacoEditor on mount. Just ensure they're loaded.
    if (!monacoEditor.value?.typingsLoaded) {
      appendToTerminal('[REPL] Loading Frida typing hints...');
      await monacoEditor.value.loadFridaTypings();
    }

    appendToTerminal('[REPL] IntelliSense ready — Frida GUM + Java + ObjC typings loaded');

    // Load additional platform-specific runtime bridges from backend (optional enhancement)
    const osTypeLower = props.osType?.toLowerCase() || '';
    const bridgesToLoad = [];

    if (osTypeLower.includes('android') || osTypeLower.includes('linux')) {
      bridgesToLoad.push({ url: '/frida/bridges/java.js', filename: 'java-bridge-runtime.js', label: 'Java runtime bridge' });
    } else if (osTypeLower.includes('ios') || osTypeLower.includes('darwin')) {
      bridgesToLoad.push({ url: '/frida/bridges/objc.js', filename: 'objc-bridge-runtime.js', label: 'ObjC runtime bridge' });
    } else {
      bridgesToLoad.push(
        { url: '/frida/bridges/java.js', filename: 'java-bridge-runtime.js', label: 'Java runtime bridge' },
        { url: '/frida/bridges/objc.js', filename: 'objc-bridge-runtime.js', label: 'ObjC runtime bridge' }
      );
    }

    for (const bridge of bridgesToLoad) {
      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}${bridge.url}`);
        if (response.data.status === 'success' && response.data.content) {
          monacoEditor.value.loadCustomTypings(response.data.content, bridge.filename);
          appendToTerminal(`[REPL] + ${bridge.label} loaded (${response.data.size || '?'} bytes)`);
        }
      } catch (e) {
        // Non-critical — base typings are already loaded
        console.warn(`[REPL] Optional ${bridge.label} not available:`, e.message);
      }
    }

    appendToTerminal('[REPL] Try typing "Java.", "ObjC.", "Interceptor.", or "Memory." for autocomplete');
  } catch (error) {
    console.error('[REPL] Error in loadFridaTypings:', error);
    appendToTerminal(`[REPL] Warning: typing hints error — ${error.message}`);
    appendToTerminal('[REPL] Code execution still works, autocomplete may be limited');
  }
};

// Dialog functions
const closeDialog = () => {
  dialog.value = false;
};

const toggleHooksDialog = () => {
  if (useNewVersion.value) {
    showFridaClicks.value = !showFridaClicks.value;
  } else {
    showHooksDialog.value = !showHooksDialog.value;
  }
};

const openHooksDialog = () => {
  if (useNewVersion.value) {
    showFridaClicks.value = true;
  } else {
    showHooksDialog.value = true;
  }
};

// Optimized resize handling
const startResize = (event) => {
  isResizing.value = true;
  event.preventDefault();

  document.body.classList.add('resizing');

  const startY = event.type === 'mousedown' ? event.clientY : event.touches[0].clientY;
  const startHeight = editorHeight.value;

  const optimizedMoveHandler = (e) => {
    if (!isResizing.value) return;

    const currentY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;
    const diff = startY - currentY;
    const newHeight = startHeight + diff;

    const constrainedHeight = Math.min(
      Math.max(newHeight, minEditorHeight),
      maxEditorHeight
    );

    // Only update if height actually changed to prevent unnecessary renders
    if (editorHeight.value !== constrainedHeight) {
      editorHeight.value = constrainedHeight;

      // Debounce Monaco layout updates for smoother dragging
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }

      resizeTimeout = setTimeout(() => {
        triggerMonacoLayout();
        resizeTimeout = null;
      }, 10); // Reduced from RESIZE_THROTTLE for more responsive feedback
    }
  };

  const stopResize = () => {
    isResizing.value = false;
    document.body.classList.remove('resizing');
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
      resizeTimeout = null;
    }
    document.removeEventListener('mousemove', optimizedMoveHandler);
    document.removeEventListener('touchmove', optimizedMoveHandler);
    document.removeEventListener('mouseup', stopResize);
    document.removeEventListener('touchend', stopResize);

    // Final layout trigger
    triggerMonacoLayout();
  };

  document.addEventListener('mousemove', optimizedMoveHandler);
  document.addEventListener('touchmove', optimizedMoveHandler, { passive: false });
  document.addEventListener('mouseup', stopResize);
  document.addEventListener('touchend', stopResize);
};

const handleResizerDoubleClick = () => {
  if (editorHeight.value > minEditorHeight) {
    previousEditorHeight.value = editorHeight.value;
    editorHeight.value = minEditorHeight;
  } else {
    editorHeight.value = previousEditorHeight.value || 300;
  }
  triggerMonacoLayout();
};

// REPL initialization management
const loadInitREPL = async () => {
  isLoadingREPL.value = true;
  appendToTerminal('[REPL] Initializing REPL with bundled bridges...');

  try {
    const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/repl/init`, {
      device_id: props.deviceId,
      pid: props.pid,
      session_id: props.sessionId || 'default',
      os_type: props.osType,
      use_bundled_agent: true
    });

    if (response.data.status === 'success') {
      replInitialized.value = true;
      lastInitSessionId = props.sessionId;
      const runtimeInfo = response.data.runtime_info || {};
      const messages = response.data.messages || [];

      // Display all initialization messages from backend
      messages.forEach(msg => appendToTerminal(msg));

      appendToTerminal('[REPL] REPL initialization complete');
      appendToTerminal('[REPL] Session ID: ' + response.data.session_id);
      appendToTerminal('[REPL] Platform: ' + (runtimeInfo.platform || 'unknown'));
      appendToTerminal('[REPL] Architecture: ' + (runtimeInfo.arch || 'unknown'));

      if (runtimeInfo.java) {
        appendToTerminal('[REPL] Java bridge ready - type "Java." for autocomplete');
      }
      if (runtimeInfo.objc) {
        appendToTerminal('[REPL] ObjC bridge ready - type "ObjC." for autocomplete');
      }

      appendToTerminal('[REPL] REPL is ready! You can now execute commands with full bridge support.');
    } else {
      appendToTerminal(`[REPL] Failed to initialize: ${response.data.message}`);
    }
  } catch (error) {
    appendToTerminal(`[REPL] Error initializing: ${error.message}`);
    appendToTerminal('[REPL] Tip: Make sure frida_tools is installed in the backend container');
  } finally {
    isLoadingREPL.value = false;
  }
};

// Resume a spawn-gated (paused) target, then auto-load bridges if enabled. This is
// the "instrument first, run second" flow: bridges/hooks can be set up while the
// process is suspended, then Resume lets it run with instrumentation already active.
const resumeApp = async () => {
  try {
    appendToTerminal('[Spawn] Resuming target…');
    const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/resume`, {
      device_id: props.deviceId,
      pid: props.pid,
    });
    if (response.data.status === 'success') {
      isPaused.value = false;
      appendToTerminal('[Spawn] Target resumed');
      if (autoLoadBridges.value && !replInitialized.value) {
        loadInitREPL();
      }
    } else {
      appendToTerminal(`[Spawn] Resume failed: ${response.data.message}`);
    }
  } catch (error) {
    appendToTerminal(`[Spawn] Resume error: ${error.message}`);
  }
};

// Agent management (keeping original logic but with optimized terminal updates)
const loadAgent = async () => {
  isLoadingAgent.value = true;
  appendToTerminal('Loading Frida agent...');

  try {
    const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/load-agent`, {
      device_id: props.deviceId,
      pid: props.pid,
      session_id: props.sessionId || 'default',
    });

    if (response.data.status === 'success') {
      agentLoaded.value = true;
      executionMode.value = 'agent';
      appendToTerminal('Agent loaded successfully');
      appendToTerminal('Agent session ID: ' + (response.data.session_id || props.sessionId));
      appendToTerminal('FridaClicks features are now available - click "Show Hooks" to access them');

      setTimeout(() => {
        testAgentFeatures();
      }, 1000);
    } else {
      appendToTerminal(`Failed to load agent: ${response.data.message}`);
    }
  } catch (error) {
    appendToTerminal(`Error loading agent: ${error.message}`);
  } finally {
    isLoadingAgent.value = false;
  }
};

const testAgentFeatures = async () => {
  if (!agentLoaded.value) {
    appendToTerminal('Agent not loaded');
    return;
  }

  isTestingAgent.value = true;
  appendToTerminal('Testing agent features...');

  const testCommands = [
    {
      name: 'ObjC Runtime Test',
      command: 'typeof ObjC !== "undefined" && ObjC.available ? "ObjC Available" : "ObjC Not Available"'
    },
    {
      name: 'Java Runtime Test',
      command: 'typeof Java !== "undefined" && Java.available ? "Java Available" : "Java Not Available"'
    },
    {
      name: 'Process Information',
      command: 'Process.id + " - " + Process.arch + " - " + Process.platform'
    }
  ];

  try {
    for (const test of testCommands) {
      appendToTerminal(`\n${test.name}:`);

      const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
        session_id: props.sessionId || 'default',
        command: test.command,
      });

      if (response.data.status === 'success') {
        appendToTerminal(`   Result: ${JSON.stringify(response.data.result)}`);
      } else {
        appendToTerminal(`   Error: ${response.data.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    appendToTerminal('\nAgent testing completed');
    appendToTerminal('Tip: Use the "Show Hooks" button to access advanced FridaClicks features');
  } catch (error) {
    appendToTerminal(`Error during agent testing: ${error.message}`);
  } finally {
    isTestingAgent.value = false;
  }
};

// Command execution (keeping original logic)

const sendCommand = async () => {
  if (!command.value.trim()) return;

  appendToTerminal(`[${props.deviceName}::PID::${props.pid}]${agentLoaded.value ? '(Agent)' : ''}-> ${command.value}`);
  commandHistory.value.push(command.value);
  historyIndex.value = commandHistory.value.length;

  if (command.value === 'help') {
    displayHelp();
  } else if (command.value === 'exit' || command.value === 'quit') {
    closeDialog();
  } else if (command.value === 'load-repl') {
    loadInitREPL();
  } else if (command.value === 'load-agent') {
    loadAgent();
  } else if (command.value === 'test-agent') {
    testAgentFeatures();
  } else if (command.value === 'show-hooks' || command.value === 'hooks') {
    appendToTerminal('Opening FridaClicks interface...');
    if (useNewVersion.value) {
      showFridaClicks.value = true;
    } else {
      showHooksDialog.value = true;
    }
  } else if (command.value === 'switch-version') { // ADD THIS NEW CONDITION
    // Close any open dialogs first
    showFridaClicks.value = false;
    showHooksDialog.value = false;

    // Toggle the version
    useNewVersion.value = !useNewVersion.value;
    appendToTerminal(`Switched to ${useNewVersion.value ? 'NEW' : 'OLD'} FridaClicks component`);
    appendToTerminal('Type "hooks" to open the FridaClicks interface');
  } else if (command.value === 'kill-scripts') {
    killRunningScripts();
  } else {
    isExecutingCommand.value = true;

    try {
      let response;

      if (agentLoaded.value && executionMode.value === 'agent') {
        response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
          session_id: props.sessionId || 'default',
          command: command.value,
        });
      } else {
        response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute`, {
          device_id: props.deviceId,
          session_id: props.sessionId || 'default',
          pid: props.pid,
          command: command.value,
        });
      }

      if (response.data.status === 'success') {
        const result = response.data.result;
        if (result !== undefined && result !== null && result !== '') {
          // The backend already formats result into a clean (often multi-line) string;
          // append it as-is. Only stringify genuine objects — stringifying a string
          // would render wrapping quotes and literal \n.
          appendToTerminal(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
        } else if (response.data.output) {
          appendToTerminal(response.data.output);
        } else {
          appendToTerminal('Command executed successfully');
        }
      } else {
        appendToTerminal(`Error: ${response.data.message}`);
        if (response.data.error) {
          appendToTerminal(`Details: ${response.data.error}`);
        }
      }
    } catch (error) {
      appendToTerminal(`Error: ${error.message}`);
    } finally {
      isExecutingCommand.value = false;
    }
  }

  command.value = '';
};

const handleKeyDown = (event) => {
  if (event.key === 'Enter') {
    sendCommand();
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    navigateHistory(-1);
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    navigateHistory(1);
  }
};

const navigateHistory = (direction) => {
  if (commandHistory.value.length === 0) return;

  historyIndex.value += direction;
  if (historyIndex.value < 0) historyIndex.value = 0;
  if (historyIndex.value > commandHistory.value.length) historyIndex.value = commandHistory.value.length;

  if (historyIndex.value === commandHistory.value.length) {
    command.value = '';
  } else {
    command.value = commandHistory.value[historyIndex.value];
  }
};

// Script execution functions (keeping original logic)
const runScript = async () => {
  if (!monacoEditor.value) {
    try {
      await waitForEditor();
    } catch {
      appendToTerminal('Error: Editor not initialized — open the scripting panel first');
      return;
    }
  }

  const scriptToRun = monacoEditor.value?.getValue() || scriptContent.value;

  isRunningScript.value = true;

  try {
    // If REPL is initialized, execute in REPL context (has Java/ObjC bridges)
    // Otherwise, run as standalone persistent script
    if (replInitialized.value) {
      appendToTerminal('[RUN] Executing in REPL context (with bridges)...');

      const response = await axios.post(
        `${import.meta.env.VITE_APP_API_URL}/frida/execute`,
        {
          device_id: props.deviceId,
          session_id: props.sessionId || 'default',
          pid: props.pid,
          command: scriptToRun,
        }
      );

      if (response.data.status === 'success') {
        if (response.data.result !== undefined) {
          appendToTerminal(response.data.result);
        } else if (response.data.output) {
          appendToTerminal(response.data.output);
        } else {
          appendToTerminal('[RUN] Script executed successfully');
        }
      } else {
        appendToTerminal(`[RUN] Error: ${response.data.message}`);
      }
    } else {
      // No REPL - run as standalone persistent script
      appendToTerminal('[RUN] Starting persistent script (can be killed with Kill Scripts button)...');
      appendToTerminal('[RUN] Tip: Use "Load Init REPL" for Java/ObjC bridge support');

      const response = await axios.post(
        `${import.meta.env.VITE_APP_API_URL}/frida/run_persistent_script`,
        {
          device_id: props.deviceId,
          session_id: props.sessionId || 'default',
          pid: props.pid,
          script: scriptToRun,
        }
      );

      if (response.data.status === 'success') {
        // Display immediate output if available (for quick expressions)
        if (response.data.output) {
          appendToTerminal(response.data.output);
        }

        appendToTerminal('[RUN] ' + response.data.message);

        // Only show "Script output will appear below" for long-running scripts
        if (!response.data.output || response.data.message.includes('long-running')) {
          appendToTerminal('[RUN] Ongoing output will appear below (use "Kill Scripts" to stop)');
        }
      } else {
        appendToTerminal(`[RUN] Error: ${response.data.message}`);
        if (response.data.error) {
          appendToTerminal(`[RUN] Details: ${response.data.error}`);
        }
      }
    }
  } catch (error) {
    appendToTerminal(`[RUN] Error running script: ${error.message}`);
  } finally {
    isRunningScript.value = false;
  }
};

const killRunningScripts = async () => {
  isKillingScripts.value = true;
  appendToTerminal('[KILL] Killing all running scripts...');

  try {
    const response = await axios.post(
      `${import.meta.env.VITE_APP_API_URL}/frida/kill_script`,
      {
        session_id: props.sessionId || 'default',
        script_type: 'all'
      }
    );

    if (response.data.status === 'success') {
      appendToTerminal(`[KILL] ${response.data.message}`);

      // Reset local state
      if (response.data.killed_repl) {
        replInitialized.value = false;
        appendToTerminal('[KILL] REPL session terminated (bridges unloaded)');
        appendToTerminal('[KILL] Tip: Use "Load Init REPL" to reload bridges');
      }

      if (response.data.unloaded_scripts) {
        if (response.data.unloaded_scripts.includes('run_script')) {
          appendToTerminal('[KILL] Monaco editor script stopped');
        }
        if (response.data.unloaded_scripts.includes('agent_script')) {
          agentLoaded.value = false;
          executionMode.value = 'direct';
          appendToTerminal('[KILL] Agent script unloaded');
        }
      }

      appendToTerminal('[KILL] You can now load new scripts');
    } else if (response.data.status === 'warning') {
      appendToTerminal(`[KILL] Warning: ${response.data.message}`);
    } else {
      appendToTerminal(`[KILL] Failed to kill scripts: ${response.data.message}`);
    }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      appendToTerminal('[KILL] Warning: No active scripts found for this session');
    } else {
      appendToTerminal(`[KILL] Error killing scripts: ${error.message}`);
    }
  } finally {
    isKillingScripts.value = false;
  }
};

const displayHelp = () => {
  // Determine which bridge is available based on OS type
  let bridgeStatus = '';
  if (props.osType?.toLowerCase() === 'android') {
    bridgeStatus = `
Platform Bridge:
  Java bridge automatically loaded
  - Java.* APIs available globally
  - Use: Java.perform(() => { ... })
  - Example: Java.use('android.app.Activity')
`;
  } else if (props.osType?.toLowerCase() === 'ios' || props.osType?.toLowerCase() === 'macos') {
    bridgeStatus = `
Platform Bridge:
  ObjC bridge automatically loaded
  - ObjC.* APIs available globally
  - Use: ObjC.classes, ObjC.protocols
  - Example: ObjC.classes.NSString
`;
  } else {
    bridgeStatus = `
Platform Bridge:
  Platform not detected - bridges may not be available
`;
  }

  const helpText = `
Frida REPL Commands:
  help          -> Displays this help message
  load-repl     -> Initialize REPL with bundled bridges (Java/ObjC)
  load-agent    -> Load the Frida agent (_agent.js)
  test-agent    -> Test agent functionality
  hooks         -> Open FridaClicks interface
  show-hooks    -> Open FridaClicks interface
  kill-scripts -> Kill all running scripts (monitor + agent)
  object?       -> Display information about 'object'
  exit/quit     -> Exit the REPL
${bridgeStatus}
REPL Initialization:
  ${replInitialized.value ? 'REPL is initialized with bridges' : 'REPL not initialized (use load-repl button or command)'}
  - Provides persistent session with Java/ObjC bridges
  - Dynamically loads bridges from frida_tools site-packages
  - Compatible with Frida 16.x.x+

Agent Features:
  ${agentLoaded.value ? 'Agent is loaded' : 'Agent not loaded (optional)'}
  - Advanced hooking capabilities
  - Script evaluation
  - Module loading
  - Enhanced debugging features

FridaClicks Features:
  ${agentLoaded.value ? 'Available after loading agent' : 'Requires agent to be loaded'}
  - iOS Crypto hooks
  - App information extraction
  - Network monitoring
  - Real-time logging
  - Click "Show Hooks" to access

Tips:
  - Platform bridges (Java/ObjC) are loaded automatically
  - Use Monaco editor for multi-line scripts
  - Agent is optional but enables advanced features
  - Type 'load-agent' for FridaClicks and enhanced capabilities

Performance Info:
  Terminal lines: ${terminalLineCount.value}/${MAX_TERMINAL_LINES}
  Virtual scrolling: ${terminalContent.value.length > VISIBLE_LINES ? 'Active' : 'Inactive'}
  Active hooks: ${activeFeatureCount.value}

More info at https://frida.re/docs/home/
`;
  appendToTerminal(helpText);
};

// Optimized EventSource handling
const setupHooksListener = () => {
  if (props.sessionId && !eventSource) {
    console.log(`[SSE] Connecting to /frida/hooks/${props.sessionId}`);
    eventSource = new EventSource(`${import.meta.env.VITE_APP_API_URL}/frida/hooks/${props.sessionId}`);

    eventSource.onopen = () => {
      console.log('[SSE] Connection opened');
      if (hooksReconnecting) {
        appendToTerminal('[SSE] hook stream reconnected');
        hooksReconnecting = false;
      }
    };

    eventSource.onmessage = (event) => {
      try {
        // Parse JSON data from SSE stream
        const message = JSON.parse(event.data);
        console.log('[SSE] Received message:', message);
        appendToTerminal(message);
      } catch (e) {
        // If parsing fails, just append raw data
        console.log('[SSE] Parse failed, using raw data:', event.data);
        appendToTerminal(event.data);
      }
    };

    eventSource.onerror = () => {
      // EventSource auto-reconnects on transient drops (readyState CONNECTING)
      // using the server's `retry:` hint. Because the backend keeps this session's
      // hook queue alive across the gap, anything emitted during the blip is
      // buffered and flushed on reconnect — no output is lost. Only intervene if
      // the browser has actually given up (readyState CLOSED). Calling close()
      // here on a transient error is what used to kill output for good.
      if (!eventSource) return;
      if (eventSource.readyState === EventSource.CONNECTING) {
        if (!hooksReconnecting) {
          hooksReconnecting = true;
          appendToTerminal('[SSE] hook stream dropped, reconnecting…');
        }
        return;
      }
      if (eventSource.readyState === EventSource.CLOSED) {
        eventSource.close();
        eventSource = null;
        hooksReconnecting = false;
        appendToTerminal('[SSE] hook stream closed — reopen the REPL to reconnect.');
      }
    };
  }
};

// Intentional teardown of the hook stream (dialog close / unmount / session
// change). A manual close() does not fire onerror, so nothing reconnects after it.
const closeHooksListener = () => {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  hooksReconnecting = false;
};

const focusInput = () => {
  nextTick(() => {
    if (commandInput.value) {
      commandInput.value.focus();
    }
  });
};

// Watchers
watch(() => dialog.value, (newValue) => {
  if (newValue) {
    isPaused.value = props.paused === true;

    // Reused across attaches: a different session id than we last initialized means a
    // new target -> clear stale REPL/agent flags so the UI doesn't claim the previous
    // device's bridges are loaded.
    if (props.sessionId !== lastInitSessionId) {
      replInitialized.value = false;
      agentLoaded.value = false;
    }

    // (Re)bind the hook stream to the CURRENT session.
    closeHooksListener();
    setupHooksListener();

    nextTick(() => {
      if (terminal.value) {
        terminal.value.scrollTop = terminal.value.scrollHeight;
      }
      focusInput();
      triggerMonacoLayout();
    });

    // One-step attach: auto-load the OS-matched bridges unless the user opted out,
    // the session is already initialized (reopen of a live session), or the target
    // is still spawn-gated (Resume handles init in that case).
    if (autoLoadBridges.value && props.deviceId && props.pid && !replInitialized.value && !isPaused.value) {
      loadInitREPL();
    }
  } else {
    // Dialog hidden -> stop the stream (no reconnect) until it reopens.
    closeHooksListener();
  }
});

watch(scriptingPanel, (newValue) => {
  if (newValue.includes(0)) {
    nextTick(() => {
      triggerMonacoLayout();
    });
  }
});

// Reset active feature count when dialog closes
watch(() => showHooksDialog.value, (newValue) => {
  if (!newValue) {
    // Don't automatically reset - let FridaClicks manage its own state
    appendToTerminal('FridaClicks dialog closed');
  }
});

watch(() => showHooksDialog.value, (newValue) => {
  if (!newValue) {
    appendToTerminal('FridaClicks (old) dialog closed');
  }
});

watch(() => showFridaClicks.value, (newValue) => {
  if (!newValue) {
    appendToTerminal('FridaClicks (new) dialog closed');
  }
});

// Initialize REPL session with bridge loading
const initializeREPL = async () => {
  appendToTerminal('[REPL] Initializing session...');

  try {
    const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/repl/init`, {
      device_id: props.deviceId,
      session_id: props.sessionId || 'default',
      pid: props.pid,
      os_type: props.osType
    });

    if (response.data.status === 'success') {
      const runtimeInfo = response.data.runtime_info || {};
      const messages = response.data.messages || [];

      // Display all initialization messages from backend
      messages.forEach(msg => appendToTerminal(msg));

      appendToTerminal('[REPL] Initialization complete');
      appendToTerminal('[REPL] Platform: ' + (runtimeInfo.platform || 'unknown'));
      appendToTerminal('[REPL] Architecture: ' + (runtimeInfo.arch || 'unknown'));

      // MonacoEditor auto-loads Frida typings on mount (GUM + Java + ObjC)
      // Just show a tip about autocomplete
      if (runtimeInfo.java || props.osType?.toLowerCase() === 'android') {
        appendToTerminal('[REPL] Tip: Try typing "Java." to see Android autocomplete');
      }
      if (runtimeInfo.objc || props.osType?.toLowerCase() === 'ios' || props.osType?.toLowerCase() === 'macos') {
        appendToTerminal('[REPL] Tip: Try typing "ObjC." to see iOS/macOS autocomplete');
      }
      appendToTerminal('[REPL] IntelliSense ready - start typing to see suggestions');

      appendToTerminal('');
    } else {
      appendToTerminal('[REPL] Warning: ' + (response.data.message || 'Unknown issue'));
      appendToTerminal('[REPL] Basic Frida APIs are still available');
    }
  } catch (error) {
    appendToTerminal('[REPL] Error: ' + error.message);
    appendToTerminal('[REPL] Basic Frida APIs are still available');
    appendToTerminal('[REPL] Platform-specific bridges may not be available');
  }
};

// Lifecycle
onMounted(() => {
  appendToTerminal(`Frida REPL - bridges load automatically on attach.
  Autocomplete: type Java. / ObjC. / Interceptor. / Memory.  (Ctrl+Space)
  Run editor script: Ctrl+Enter or RUN    one-off expressions: the command bar above
  Commands: help  load-repl (reload bridges)  load-agent  hooks  exit
`);

  // Auto-init runs from the dialog-open watch (below) when "Auto-load" is on, so the
  // banner stays minimal; the real device/session/version details print via the
  // init messages on attach.

  focusInput();
  // Hook stream is (re)subscribed in the dialog-open watch below, so it always binds
  // to the CURRENT session (this dialog instance is mounted once and reused).
});

onUnmounted(() => {
  // Cleanup all timeouts and resources
  if (updateTimeout) {
    clearTimeout(updateTimeout);
  }
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
  }
  closeHooksListener();
  document.body.classList.remove('resizing');
});
</script>

<style scoped>
.frida-repl {
  background-color: #0d0d0f; /* OLED near-black */
  color: #ffffff;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.repl-main-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 48px);
  overflow: hidden;
  position: relative;
}

.terminal {
  font-family: var(--code-font);
  font-feature-settings: "liga" 0, "calt" 0; /* literal -> == != */
  font-variant-ligatures: none;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background-color: #0d0d0f; /* OLED near-black */
  color: #ffffff;
  font-size: var(--terminal-font-size, 14px); /*noinspection CssUnresolvedCustomProperty*/
  line-height: 1.5;
  flex: 1;
  min-height: 150px;
  overflow-y: auto;
  overflow-x: auto; /* allow horizontal scroll for long lines */
  scrollbar-gutter: stable both-edges; /* prevent layout shift when scrollbars appear */
  scrollbar-width: thin; /* Firefox */
  scrollbar-color: #555 #2a2a2a; /* Firefox */
}

.terminal-content {
  white-space: pre; /* keep alignment; rely on horizontal scroll instead of soft-wrapping */
  overflow-wrap: normal;
  word-break: normal;
}

/* Terminal scrollbars (Chromium/WebKit) */
.terminal::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.terminal::-webkit-scrollbar-track {
  background-color: #2a2a2a;
}

.terminal::-webkit-scrollbar-thumb {
  background-color: #555;
  border-radius: 8px;
  border: 2px solid #2a2a2a;
}

.terminal::-webkit-scrollbar-thumb:hover {
  background-color: #666;
}

/* Monaco wrapper: let Monaco handle its own scroll, but keep gutter stable */
.monaco-wrapper {
  scrollbar-gutter: stable both-edges;
}

/* Give Monaco scrollbars a consistent dark look (Monaco uses its own DOM) */
:deep(.monaco-scrollable-element) {
  scrollbar-gutter: stable both-edges;
  scrollbar-width: thin;
  scrollbar-color: rgba(170, 170, 170, 0.55) transparent;
}

:deep(.monaco-scrollable-element::-webkit-scrollbar) {
  width: 10px;
  height: 10px;
}

:deep(.monaco-scrollable-element::-webkit-scrollbar-thumb) {
  background: rgba(170, 170, 170, 0.45);
  border-radius: 8px;
}

:deep(.monaco-scrollable-element::-webkit-scrollbar-thumb:hover) {
  background: rgba(170, 170, 170, 0.6);
}

:deep(.monaco-scrollable-element::-webkit-scrollbar-track) {
  background: transparent;
}

.scripting-section {
  flex-shrink: 1;
  background-color: #252525;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-height: 60vh;
}

.script-controls {
  flex-shrink: 0;
  background-color: #2a2a2a;
  border-bottom: 1px solid #333;
}

/* Controls bar layout */
.controls-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.controls-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn {
  text-transform: none !important;
  letter-spacing: 0.02em !important;
}

/* IntelliSense Status Pill */
.intellisense-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px 3px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  user-select: none;
  border: 1px solid transparent;
}

.intellisense-pill.is-idle {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.45);
  border-color: rgba(255, 255, 255, 0.08);
}

.intellisense-pill.is-idle:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  border-color: rgba(255, 255, 255, 0.15);
}

.intellisense-pill.is-loading {
  background: rgba(33, 150, 243, 0.12);
  color: rgba(33, 150, 243, 0.9);
  border-color: rgba(33, 150, 243, 0.2);
}

.intellisense-pill.is-ready {
  background: rgba(76, 175, 80, 0.1);
  color: rgba(76, 175, 80, 0.95);
  border-color: rgba(76, 175, 80, 0.2);
}

.intellisense-pill.is-ready:hover {
  background: rgba(76, 175, 80, 0.18);
  border-color: rgba(76, 175, 80, 0.35);
}

.pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: background-color 0.3s ease;
}

.is-idle .pill-dot {
  background: rgba(255, 255, 255, 0.25);
}

.is-loading .pill-dot {
  background: #2196F3;
  animation: pill-pulse 1.2s ease-in-out infinite;
}

.is-ready .pill-dot {
  background: #4CAF50;
  box-shadow: 0 0 4px rgba(76, 175, 80, 0.5);
}

@keyframes pill-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.8); }
}

.pill-label {
  white-space: nowrap;
}

.pill-reload-icon {
  opacity: 0;
  transition: opacity 0.2s ease;
  font-size: 12px !important;
  margin-left: -2px;
}

.intellisense-pill.is-ready:hover .pill-reload-icon {
  opacity: 0.7;
}

/* Editor IntelliSense active glow */
.monaco-wrapper {
  flex: 1;
  overflow: hidden;
  position: relative;
  border-top: 2px solid transparent;
  transition: border-color 0.5s ease, box-shadow 0.5s ease;
}

.monaco-wrapper.intellisense-active {
  border-top-color: rgba(76, 175, 80, 0.35);
  box-shadow: inset 0 2px 8px rgba(76, 175, 80, 0.06);
}

/* Editor Welcome Overlay */
.editor-welcome-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(30, 30, 30, 0.88);
  backdrop-filter: blur(4px);
  cursor: pointer;
}

.overlay-content {
  text-align: center;
  max-width: 320px;
}

.overlay-title {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 16px;
}

.overlay-shortcuts {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.shortcut-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.shortcut-row span {
  margin-left: 8px;
  color: rgba(255, 255, 255, 0.45);
}

.shortcut-row kbd {
  display: inline-block;
  padding: 2px 6px;
  font-size: 11px;
  font-family: var(--code-font);
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06);
}

.overlay-hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
  font-style: italic;
}

/* Overlay fade transition */
.overlay-fade-enter-active {
  transition: opacity 0.3s ease;
}
.overlay-fade-leave-active {
  transition: opacity 0.5s ease;
}
.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}

.repl-input {
  background-color: #141416; /* OLED-consistent input bar */
  border-top: 1px solid #333;
  border-bottom: 1px solid #333;
  flex-shrink: 0;
  z-index: 1000;
  position: relative;
  min-height: 60px;
  pointer-events: auto !important;
  user-select: text !important;
  -webkit-user-select: text !important;
}

.repl-input * {
  user-select: text !important;
  -webkit-user-select: text !important;
  pointer-events: auto !important;
}

.prompt {
  color: #00ff00;
  font-weight: bold;
  font-family: var(--code-font);
  white-space: nowrap;
  font-size: var(--terminal-font-size, 14px); /*noinspection CssUnresolvedCustomProperty*/
}

.command-input {
  background-color: #0d0d0f; /* OLED near-black */
  border: 1px solid #444;
  border-radius: 4px;
  color: #ffffff;
  font-family: var(--code-font);
  font-feature-settings: "liga" 0, "calt" 0;
  font-variant-ligatures: none;
  font-size: var(--terminal-font-size, 14px); /*noinspection CssUnresolvedCustomProperty*/
  outline: none;
  width: 100%;
  padding: 8px 12px;
  pointer-events: auto;
  z-index: 100;
  position: relative;
}

.command-input:focus {
  border-color: #1976d2;
  background-color: #141416;
}

.command-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.command-input::placeholder {
  color: #888;
}

/* Hook Status Bar */
.hook-status-bar {
  border-top: 1px solid rgba(76, 175, 80, 0.3);
  background: rgba(76, 175, 80, 0.05);
}

/* Enhanced resizer bar styles - optimized for performance */
.resizer-bar {
  height: 12px;
  background-color: #2a2a2a;
  cursor: ns-resize;
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s ease; /* Reduced from 0.2s */
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  /* Performance optimization */
  contain: layout style paint;
  will-change: background-color;
}

.resizer-bar:hover {
  background-color: #333;
}

.resizer-bar.resizing {
  background-color: #0066cc;
}

.resizer-handle {
  position: relative;
  width: 60px;
  height: 4px;
  background-color: #555;
  border-radius: 2px;
  transition: all 0.15s ease; /* Reduced from 0.2s */
  contain: layout style;
}

.resizer-bar:hover .resizer-handle,
.resizer-bar.resizing .resizer-handle {
  background-color: #888;
  height: 6px;
}

.handle-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 30px;
  height: 2px;
  background-color: transparent;
}

.handle-icon::before,
.handle-icon::after {
  content: '';
  position: absolute;
  width: 30px;
  height: 2px;
  background-color: #aaa;
  left: 0;
  transition: all 0.15s ease; /* Reduced from 0.2s */
}

.handle-icon::before {
  top: -3px;
}

.handle-icon::after {
  top: 3px;
}

.resizer-bar:hover .handle-icon::before,
.resizer-bar:hover .handle-icon::after,
.resizer-bar.resizing .handle-icon::before,
.resizer-bar.resizing .handle-icon::after {
  background-color: #fff;
}

.scripting-panel {
  background-color: #252525;
  width: 100%;
  z-index: 5;
  /* Optimize rendering */
  contain: layout style;
}

.button-container {
  padding: 12px 16px;
  background-color: #2a2a2a;
  border-bottom: 1px solid #333;
  margin-bottom: 0;
  /* Performance optimization */
  contain: layout style;
}

.editor-wrapper {
  position: relative;
  width: 100%;
  border: none;
  border-radius: 0;
  margin-top: 0;
  /* Optimize rendering */
  contain: layout;
}

.editor-container {
  width: 100%;
  transition: height 0.15s ease-out; /* Reduced from 0.2s */
  min-height: 100px;
  max-height: 50vh;
  border: 1px solid #333;
  border-top: none;
  border-radius: 0 0 4px 4px;
  overflow: visible; /* Allow tooltips to extend beyond container */
  position: relative;
  /* Performance optimizations */
  contain: layout style;
  will-change: height;
}

.editor-container.min-height {
  border-color: #0066cc;
}

.editor-container.max-height {
  border-color: #cc6600;
}

.gap-2 {
  gap: 8px;
}

/* Performance-optimized responsive adjustments */
@media (max-width: 960px) {
  .button-container {
    padding: 8px 12px;
  }

  .button-container .v-btn {
    width: 100%;
    margin-bottom: 8px;
  }

  .button-container .v-btn:last-child {
    margin-bottom: 0;
  }

  .gap-2 {
    gap: 0;
    flex-direction: column;
    width: 100%;
  }

  .resizer-bar {
    height: 16px;
  }

  .resizer-handle {
    width: 80px;
    height: 6px;
  }

  .handle-icon::before,
  .handle-icon::after {
    width: 40px;
  }

  /* Respect user font size controls on mobile by not overriding font-size here */
  .terminal {
    line-height: 1.3;
  }

  /* (intentionally no mobile font-size override; user can control via toolbar) */
}

/* Button optimizations */
.v-btn:disabled {
  opacity: 0.6;
}

.v-btn .v-icon--left {
  margin-right: 8px;
}

/* Deep selectors - optimized */
:deep(.v-btn-toggle) {
  border-radius: 4px;
  overflow: hidden;
}

:deep(.v-btn-toggle .v-btn) {
  border-radius: 0;
  min-width: 80px;
}

:deep(.v-expansion-panel) {
  background-color: #252525 !important;
  max-width: 100%;
}

:deep(.v-expansion-panel-header) {
  padding: 8px 16px;
}

:deep(.v-btn) {
  text-transform: uppercase;
}

/* Monaco Editor optimizations */
:deep(.monaco-editor) {
  font-size: 16px !important; /* Reduced from 18px */
  /* Disable subpixel rendering for performance */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: auto;
}

:deep(.monaco-editor-dark) {
  background-color: #252525 !important;
}

/* Optimize Monaco scrollbars */
:deep(.monaco-scrollable-element > .scrollbar) {
  /* Reduce complexity of scrollbars */
  border-radius: 0;
  box-shadow: none;
}

/* Performance class for resizing state */
.resizing {
  user-select: none;
  /* Disable animations during resize for performance */
  * {
    transition: none !important;
    animation: none !important;
  }
}

/* Terminal performance optimizations */
/* (deduped: scrollbar styles defined earlier; keep only one source of truth) */

</style>

<style>
/* Global performance optimizations during resize */
body.resizing {
  cursor: ns-resize !important;
  user-select: none !important;
  -webkit-user-select: none !important;
}

body.resizing * {
  cursor: ns-resize !important;
  user-select: none !important;
  /* Disable all transitions during resize for maximum performance */
  transition: none !important;
  animation: none !important;
}

/* Reduce motion for users who prefer it */
@media (prefers-reduced-motion: reduce) {
  .terminal,
  .resizer-bar,
  .editor-container,
  .resizer-handle,
  .handle-icon::before,
  .handle-icon::after {
    transition: none !important;
    animation: none !important;
  }
}
</style>
