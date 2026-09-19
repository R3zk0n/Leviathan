<template>
  <div v-show="visible" ref="hookDialog" class="movable-dialog" :style="dialogStyle">
    <div class="dialog-header vss-movable">
      Frida Hooks
      <span class="message-counter">({{ hooksList.length }}/{{ maxMessages }})</span>
      <v-spacer></v-spacer>

      <!-- Enhanced performance controls -->
      <v-tooltip bottom>
        <template v-slot:activator="{ on, attrs }">
          <v-btn
            icon
            small
            @click="togglePause"
            class="mr-1"
            :color="isPaused ? 'orange' : 'default'"
            v-bind="attrs"
            v-on="on"
          >
            <v-icon>{{ isPaused ? 'mdi-play' : 'mdi-pause' }}</v-icon>
          </v-btn>
        </template>
        <span>{{ isPaused ? 'Resume' : 'Pause' }} monitoring</span>
      </v-tooltip>

      <v-tooltip bottom>
        <template v-slot:activator="{ on, attrs }">
          <v-btn
            icon
            small
            @click="toggleAutoScroll"
            class="mr-1"
            :color="autoScroll ? 'green' : 'default'"
            v-bind="attrs"
            v-on="on"
          >
            <v-icon>mdi-arrow-down-bold</v-icon>
          </v-btn>
        </template>
        <span>{{ autoScroll ? 'Disable' : 'Enable' }} auto-scroll (scroll up to disable)</span>
      </v-tooltip>

      <!-- New export button -->
      <v-tooltip bottom>
        <template v-slot:activator="{ on, attrs }">
          <v-btn
            icon
            small
            @click="exportLogs"
            class="mr-1"
            v-bind="attrs"
            v-on="on"
          >
            <v-icon>mdi-download</v-icon>
          </v-btn>
        </template>
        <span>Export raw logs</span>
      </v-tooltip>

      <v-btn icon small @click="clearHooks" class="mr-2">
        <v-icon>mdi-delete</v-icon>
      </v-btn>
      <v-btn icon small @click="$emit('close')">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </div>

    <div class="dialog-content">
      <div class="hooks-scrollable" ref="hooksContent" @scroll="onScroll">
        <!-- Scroll position indicator -->
        <div v-if="!isAtBottom && !autoScroll" class="scroll-indicator">
          <v-btn
            small
            fab
            color="primary"
            @click="scrollToBottomManual"
            class="scroll-to-bottom-btn"
            title="Scroll to bottom"
          >
            <v-icon small>mdi-chevron-down</v-icon>
          </v-btn>
          <div class="scroll-position">
            {{ Math.round(scrollPercentage) }}%
          </div>
        </div>

        <!-- Virtual scrolling window -->
        <div class="virtual-container" :style="{ height: totalHeight + 'px' }">
          <div
            class="visible-content"
            :style="{ transform: `translateY(${offsetY}px)` }"
          >
            <div
              v-for="(hook, index) in visibleHooks"
              :key="hook.id"
              class="hook-message"
              :style="{ height: itemHeight + 'px' }"
            >
              <pre class="raw-content">{{ hook.content }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Enhanced status bar -->
    <div class="status-bar">
      <span class="status-text">
        Messages/sec: {{ formattedRate }}
        | Buffer: {{ isPaused ? 'PAUSED' : 'ACTIVE' }}
        | Scroll: {{ autoScroll ? 'AUTO' : 'MANUAL' }}
        | {{ formattedMemory }}MB
        <span v-if="!isAtBottom" class="scroll-info">
          | Scroll: {{ Math.round(scrollPercentage) }}%
        </span>
      </span>
      <v-spacer></v-spacer>
      <span class="keyboard-shortcuts" title="Keyboard shortcuts: Home/End, Page Up/Down, Ctrl+Space (pause)">
        ⌨️ Home|End|PgUp|PgDn|Ctrl+Space
      </span>
    </div>

    <div class="resizer-handle"></div>
  </div>
</template>

<script>
import EventSource from '@/utils/authenticatedEventSource'
import { ref, onMounted, onUnmounted, reactive, watch, nextTick, computed } from 'vue';

export default {
  name: 'MovableFridaHooks',
  props: {
    visible: Boolean,
    sessionId: String,
  },
  emits: ['close'],
  setup(props, { emit }) {
    const hookDialog = ref(null);
    const hooksContent = ref(null);

    // Performance settings
    const maxMessages = ref(2000); // Increased for security research
    const batchSize = ref(25); // Smaller batches for better responsiveness
    const batchInterval = ref(50); // Faster processing
    const itemHeight = ref(80); // Increased height for better readability
    const visibleBuffer = ref(3); // Reduced buffer for better performance

    // State
    const hooksList = ref([]);
    const pendingMessages = ref([]);
    const isPaused = ref(false);
    const autoScroll = ref(true);
    const scrollTop = ref(0);
    const containerHeight = ref(300);
    const isAtBottom = ref(true);
    const scrollPercentage = ref(100);
    const totalMemoryUsage = ref(0);

    // Performance tracking
    const messageCount = ref(0);
    const lastSecondStart = ref(Date.now());
    const messagesPerSecond = ref(0);

    let eventSource = null;
    let batchTimer = null;
    let messageId = 0;

    const dialogSize = reactive({
      width: 700,
      height: 500,
      top: 100,
      left: window.innerWidth - 720,
    });

    const dialogStyle = reactive({
      position: 'fixed',
      zIndex: 9999,
      top: `${dialogSize.top}px`,
      left: `${dialogSize.left}px`,
      width: `${dialogSize.width}px`,
      height: `${dialogSize.height}px`,
    });

    // Computed props
    const formattedRate = computed(() => messagesPerSecond.value.toFixed(1));
    const formattedMemory = computed(() => (totalMemoryUsage.value / 1024 / 1024).toFixed(1));

    // Virtual scrolling calculations
    const totalHeight = computed(() => hooksList.value.length * itemHeight.value);

    const visibleStartIndex = computed(() => {
      return Math.max(0, Math.floor(scrollTop.value / itemHeight.value) - visibleBuffer.value);
    });

    const visibleEndIndex = computed(() => {
      const maxVisible = Math.ceil(containerHeight.value / itemHeight.value);
      return Math.min(
        hooksList.value.length,
        visibleStartIndex.value + maxVisible + visibleBuffer.value * 2
      );
    });

    const visibleHooks = computed(() => {
      return hooksList.value.slice(visibleStartIndex.value, visibleEndIndex.value);
    });

    const offsetY = computed(() => {
      return visibleStartIndex.value * itemHeight.value;
    });

    // Raw message processing - NO JSON formatting corruption
    const processRawMessage = (message) => {
      // Extract raw content without any JSON processing that corrupts XPC data
      let content = message;

      // Only unescape newlines that were escaped for SSE transport
      if (typeof content === 'string') {
        content = content.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
      }

      return {
        id: messageId++,
        content: content, // Pure raw content - no timestamps, no processing
        timestamp: Date.now(),
        size: content.length
      };
    };

    const processPendingMessages = () => {
      if (isPaused.value || pendingMessages.value.length === 0) {
        return;
      }

      const batch = pendingMessages.value.splice(0, batchSize.value);
      const processedBatch = batch.map(processRawMessage);

      // Add to hooks list and maintain size limit
      hooksList.value.push(...processedBatch);

      if (hooksList.value.length > maxMessages.value) {
        const excess = hooksList.value.length - maxMessages.value;
        hooksList.value.splice(0, excess);
      }

      // Update memory usage
      totalMemoryUsage.value = hooksList.value.reduce((total, hook) => total + hook.size, 0);

      // Update performance metrics
      messageCount.value += batch.length;
      const now = Date.now();
      if (now - lastSecondStart.value >= 1000) {
        messagesPerSecond.value = messageCount.value;
        messageCount.value = 0;
        lastSecondStart.value = now;
      }

      // Auto-scroll if enabled and user hasn't manually scrolled
      if (autoScroll.value) {
        nextTick(() => {
          scrollToBottom();
        });
      }
    };

    const setupBatchProcessing = () => {
      if (batchTimer) {
        clearInterval(batchTimer);
      }
      batchTimer = setInterval(processPendingMessages, batchInterval.value);
    };

    // FIXED: Remove all JSON processing that corrupts raw data
    const appendToHooksList = (message) => {
      // Add raw message directly without any processing, timestamps, or JSON parsing
      pendingMessages.value.push(message);
    };

    const onScroll = () => {
      if (hooksContent.value) {
        scrollTop.value = hooksContent.value.scrollTop;
        containerHeight.value = hooksContent.value.clientHeight;

        // Calculate scroll percentage
        const { scrollTop: currentScrollTop, scrollHeight, clientHeight } = hooksContent.value;
        const maxScroll = scrollHeight - clientHeight;
        scrollPercentage.value = maxScroll > 0 ? (currentScrollTop / maxScroll) * 100 : 100;

        // Check if we're at the bottom
        const tolerance = 100;
        isAtBottom.value = scrollHeight - currentScrollTop - clientHeight < tolerance;

        // Disable auto-scroll if user scrolls up manually
        if (!isAtBottom.value && autoScroll.value) {
          autoScroll.value = false;
          console.log('Auto-scroll disabled - user scrolled up');
        }
      }
    };

    const scrollToBottom = () => {
      if (hooksContent.value && autoScroll.value) {
        requestAnimationFrame(() => {
          if (hooksContent.value) {
            hooksContent.value.scrollTop = hooksContent.value.scrollHeight;
          }
        });
      }
    };

    const scrollToBottomManual = () => {
      if (hooksContent.value) {
        hooksContent.value.scrollTo({
          top: hooksContent.value.scrollHeight,
          behavior: 'smooth'
        });

        setTimeout(() => {
          autoScroll.value = true;
          isAtBottom.value = true;
          scrollPercentage.value = 100;
        }, 500);
      }
    };

    const togglePause = () => {
      isPaused.value = !isPaused.value;
      if (!isPaused.value) {
        processPendingMessages();
      }
    };

    const toggleAutoScroll = () => {
      autoScroll.value = !autoScroll.value;
      if (autoScroll.value) {
        nextTick(() => {
          scrollToBottomManual();
        });
      }
    };

    const clearHooks = () => {
      hooksList.value = [];
      pendingMessages.value = [];
      messageCount.value = 0;
      messagesPerSecond.value = 0;
      totalMemoryUsage.value = 0;
      scrollPercentage.value = 100;
      isAtBottom.value = true;
    };

    // New export functionality
    const exportLogs = () => {
      const content = hooksList.value.map(hook => hook.content).join('\n');
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `frida-raw-${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    const setupHooksListener = () => {
      if (eventSource) {
        eventSource.close();
      }
      const sessionIdForHooks = props.sessionId || 'default';
      const url = `${import.meta.env.VITE_APP_API_URL}/frida/hooks/${sessionIdForHooks}`;
      console.log("Setting up SSE connection to:", url);
      eventSource = new EventSource(url);

      eventSource.onopen = () => {
        console.log("SSE connection opened");
        appendToHooksList("# SSE connection opened");
      };

      eventSource.onmessage = (event) => {
        appendToHooksList(event.data);
      };

      eventSource.onerror = (error) => {
        console.error("SSE Error:", error);
        appendToHooksList(`# SSE Error: ${error.type}`);
        setTimeout(() => {
          if (props.visible) {
            setupHooksListener();
          }
        }, 3000);
      };
    };

    const updateDialogStyle = () => {
      dialogStyle.top = `${dialogSize.top}px`;
      dialogStyle.left = `${dialogSize.left}px`;
      dialogStyle.width = `${dialogSize.width}px`;
      dialogStyle.height = `${dialogSize.height}px`;
    };

    watch(() => props.visible, (newValue) => {
      console.log("Visibility changed:", newValue);
      if (newValue) {
        setupHooksListener();
        setupBatchProcessing();
      } else {
        if (eventSource) {
          console.log("Closing SSE connection");
          eventSource.close();
        }
        if (batchTimer) {
          clearInterval(batchTimer);
        }
      }
    });

    onMounted(() => {
      console.log("MovableFridaHooks mounted");
      if (props.visible) {
        setupHooksListener();
        setupBatchProcessing();
      }

      // Add keyboard shortcuts
      const handleKeydown = (e) => {
        if (!props.visible) return;

        const activeElement = document.activeElement;
        const isInputFocused = activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.contentEditable === 'true'
        );

        if (!isInputFocused) {
          switch (e.key) {
            case 'Home':
              e.preventDefault();
              if (hooksContent.value) {
                hooksContent.value.scrollTop = 0;
                autoScroll.value = false;
              }
              break;
            case 'End':
              e.preventDefault();
              scrollToBottomManual();
              break;
            case 'PageUp':
              e.preventDefault();
              if (hooksContent.value) {
                hooksContent.value.scrollTop -= hooksContent.value.clientHeight * 0.8;
                autoScroll.value = false;
              }
              break;
            case 'PageDown':
              e.preventDefault();
              if (hooksContent.value) {
                hooksContent.value.scrollTop += hooksContent.value.clientHeight * 0.8;
              }
              break;
            case ' ':
              if (e.ctrlKey) {
                e.preventDefault();
                togglePause();
              }
              break;
          }
        }
      };

      document.addEventListener('keydown', handleKeydown);

      // Update container height
      if (hooksContent.value) {
        containerHeight.value = hooksContent.value.clientHeight;
      }

      const el = hookDialog.value;
      let isDragging = false;
      let isResizing = false;
      let startX, startY, startWidth, startHeight, startLeft, startTop;

      const onMouseDown = (e) => {
        if (e.target.closest('.vss-movable')) {
          isDragging = true;
          startX = e.clientX;
          startY = e.clientY;
          startLeft = dialogSize.left;
          startTop = dialogSize.top;
        } else if (e.target.closest('.resizer-handle')) {
          isResizing = true;
          startX = e.clientX;
          startY = e.clientY;
          startWidth = dialogSize.width;
          startHeight = dialogSize.height;
        }
        if (isDragging || isResizing) {
          e.preventDefault();
        }
      };

      const onMouseMove = (e) => {
        if (isDragging) {
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          dialogSize.left = Math.max(0, Math.min(window.innerWidth - dialogSize.width, startLeft + dx));
          dialogSize.top = Math.max(0, Math.min(window.innerHeight - dialogSize.height, startTop + dy));
          updateDialogStyle();
        } else if (isResizing) {
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          dialogSize.width = Math.max(400, Math.min(window.innerWidth - dialogSize.left, startWidth + dx));
          dialogSize.height = Math.max(300, Math.min(window.innerHeight - dialogSize.top, startHeight + dy));
          updateDialogStyle();

          // Update container height after resize
          nextTick(() => {
            if (hooksContent.value) {
              containerHeight.value = hooksContent.value.clientHeight;
            }
          });
        }
      };

      const onMouseUp = () => {
        isDragging = false;
        isResizing = false;
      };

      document.addEventListener('mousedown', onMouseDown);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);

      onUnmounted(() => {
        document.removeEventListener('mousedown', onMouseDown);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('keydown', handleKeydown);
        if (eventSource) {
          eventSource.close();
        }
        if (batchTimer) {
          clearInterval(batchTimer);
        }
      });
    });

    onUnmounted(() => {
      console.log("MovableFridaHooks unmounted");
      if (eventSource) {
        eventSource.close();
      }
      if (batchTimer) {
        clearInterval(batchTimer);
      }
    });

    return {
      hookDialog,
      hooksContent,
      hooksList,
      dialogStyle,
      clearHooks,
      exportLogs,
      togglePause,
      toggleAutoScroll,
      scrollToBottomManual,
      isPaused,
      autoScroll,
      messagesPerSecond,
      maxMessages,
      visibleHooks,
      totalHeight,
      offsetY,
      itemHeight,
      onScroll,
      isAtBottom,
      scrollPercentage,
      formattedRate,
      formattedMemory,
    };
  },
};
</script>

<style scoped>
.movable-dialog {
  background-color: #2d2d2d;
  color: #ffffff;
  border-radius: 4px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dialog-header {
  background-color: #1e1e1e;
  padding: 8px 12px;
  font-weight: bold;
  cursor: move;
  display: flex;
  align-items: center;
  min-height: 40px;
}

.message-counter {
  font-size: 12px;
  color: #888;
  margin-left: 8px;
}

.dialog-content {
  flex-grow: 1;
  overflow: hidden;
  position: relative;
}

.hooks-scrollable {
  height: 100%;
  overflow-y: auto;
  position: relative;
  scrollbar-width: thick;
  scrollbar-color: #666666 #1a1a1a;
}

/* Enhanced scrollbar for better visibility and manual scrolling */
.hooks-scrollable::-webkit-scrollbar {
  width: 16px;
}

.hooks-scrollable::-webkit-scrollbar-track {
  background: #1a1a1a;
  border-radius: 8px;
  border: 1px solid #333333;
}

.hooks-scrollable::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #666666 0%, #444444 100%);
  border-radius: 8px;
  border: 2px solid #1a1a1a;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.1);
}

.hooks-scrollable::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #777777 0%, #555555 100%);
  cursor: pointer;
}

.hooks-scrollable::-webkit-scrollbar-thumb:active {
  background: linear-gradient(180deg, #888888 0%, #666666 100%);
}

.hooks-scrollable::-webkit-scrollbar-corner {
  background: #1a1a1a;
  border: 1px solid #333333;
}

.virtual-container {
  position: relative;
  width: 100%;
}

.visible-content {
  position: relative;
  width: 100%;
}

.hook-message {
  padding: 8px 12px;
  border-bottom: 1px solid #3a3a3a;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'Cascadia Code', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.4;
  overflow: hidden;
  box-sizing: border-box;
}

.raw-content {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: break-word;
  font-family: inherit;
  font-size: inherit;
  color: #ffffff;
  background-color: transparent;
}

/* Scroll indicator overlay */
.scroll-indicator {
  position: absolute;
  bottom: 20px;
  right: 20px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.scroll-to-bottom-btn {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
  transition: transform 0.2s ease !important;
}

.scroll-to-bottom-btn:hover {
  transform: translateY(-2px) !important;
}

.scroll-position {
  background: rgba(0, 0, 0, 0.8);
  color: #ffffff;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 10px;
  font-family: monospace;
  border: 1px solid #333333;
  backdrop-filter: blur(4px);
}

.status-bar {
  background-color: #1a1a1a;
  padding: 4px 12px;
  font-size: 11px;
  color: #888;
  border-top: 1px solid #3a3a3a;
  display: flex;
  align-items: center;
}

.status-text {
  font-family: monospace;
}

.scroll-info {
  color: #58a6ff;
  font-weight: 500;
}

.keyboard-shortcuts {
  font-size: 9px;
  color: #484f58;
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.keyboard-shortcuts:hover {
  opacity: 1;
  color: #7d8590;
}

.resizer-handle {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 10px;
  height: 10px;
  cursor: se-resize;
  background-color: #1e1e1e;
}

.resizer-handle::before {
  content: '';
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 5px;
  height: 5px;
  border-right: 2px solid #ffffff;
  border-bottom: 2px solid #ffffff;
}

/* Button styling */
.v-btn--icon {
  color: #cccccc !important;
}

.v-btn--icon:hover {
  background-color: rgba(255, 255, 255, 0.1) !important;
}
</style>
