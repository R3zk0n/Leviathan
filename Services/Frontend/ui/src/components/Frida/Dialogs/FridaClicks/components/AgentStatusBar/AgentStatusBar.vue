<template>
  <div class="agent-status-bar" :class="{ error: agentError, disconnected: agentDisconnected }">
    <!-- Disconnect / Crash Banner -->
    <div v-if="agentDisconnected" class="disconnect-banner">
      <div class="disconnect-content">
        <div class="disconnect-info">
          <v-icon color="error" class="disconnect-icon pulse">mdi-connection</v-icon>
          <div class="disconnect-text">
            <span class="disconnect-title">Session Lost</span>
            <span class="disconnect-reason">{{ disconnectReason || 'Process crashed or connection lost' }}</span>
          </div>
        </div>
        <div class="disconnect-actions">
          <v-btn
            size="small"
            color="warning"
            variant="flat"
            @click="$emit('reconnect')"
            :loading="agentLoading"
            :disabled="agentLoading"
            class="reconnect-btn"
          >
            <v-icon start>mdi-refresh</v-icon>
            Reconnect
          </v-btn>
          <v-btn
            size="small"
            variant="text"
            color="grey"
            @click="$emit('dismiss-disconnect')"
          >
            Dismiss
          </v-btn>
        </div>
      </div>
    </div>

    <!-- Normal Status Bar -->
    <div class="status-content">
      <div class="status-info">
        <v-icon class="status-icon" :color="statusColor">
          {{ statusIcon }}
        </v-icon>
        <span class="status-text">
          <strong>Agent Status:</strong>
          {{ statusText }}
        </span>
        <v-chip v-if="agentLoaded" size="x-small" color="success" class="ml-2">
          Session: {{ sessionId }}
        </v-chip>
        <v-chip v-if="pid" size="x-small" color="blue" class="ml-2">
          PID: {{ pid }}
        </v-chip>
      </div>
      <div class="status-actions">
        <v-btn
          v-if="!agentLoaded && !agentDisconnected"
          size="small"
          color="success"
          variant="flat"
          @click="$emit('load-agent')"
          :loading="agentLoading"
          :disabled="agentLoading"
        >
          <v-icon start>mdi-puzzle</v-icon>
          Load Agent
        </v-btn>
        <v-btn
          v-else-if="agentLoaded"
          size="small"
          color="error"
          variant="text"
          @click="$emit('unload-agent')"
          :loading="agentLoading"
        >
          <v-icon start>mdi-close</v-icon>
          Unload
        </v-btn>
      </div>
    </div>
    <div v-if="agentError && !agentDisconnected" class="error-message">
      <v-icon size="small" class="mr-1">mdi-alert</v-icon>
      {{ agentError }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  agentLoaded: {
    type: Boolean,
    required: true
  },
  agentLoading: {
    type: Boolean,
    default: false
  },
  agentError: {
    type: String,
    default: null
  },
  agentDisconnected: {
    type: Boolean,
    default: false
  },
  disconnectReason: {
    type: String,
    default: null
  },
  sessionId: {
    type: String,
    required: true
  },
  deviceId: {
    type: String,
    required: true
  },
  pid: {
    type: Number,
    required: true
  }
})

defineEmits(['load-agent', 'unload-agent', 'reconnect', 'dismiss-disconnect'])

const statusColor = computed(() => {
  if (props.agentDisconnected) return 'error'
  if (props.agentError) return 'error'
  if (props.agentLoaded) return 'success'
  if (props.agentLoading) return 'warning'
  return 'grey'
})

const statusIcon = computed(() => {
  if (props.agentDisconnected) return 'mdi-connection'
  if (props.agentError) return 'mdi-alert-circle'
  if (props.agentLoaded) return 'mdi-check-circle'
  if (props.agentLoading) return 'mdi-loading mdi-spin'
  return 'mdi-circle-outline'
})

const statusText = computed(() => {
  if (props.agentDisconnected) return 'Disconnected'
  if (props.agentError) return 'Error'
  if (props.agentLoaded) return 'Connected and Ready'
  if (props.agentLoading) return 'Loading...'
  return 'Not Connected'
})
</script>

<style scoped>
.agent-status-bar {
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding: 12px 20px;
  transition: all 0.3s ease;
}

.agent-status-bar.error {
  background: rgba(244, 67, 54, 0.1);
  border-bottom-color: rgba(244, 67, 54, 0.3);
}

.agent-status-bar.disconnected {
  background: rgba(244, 67, 54, 0.05);
  border-bottom-color: rgba(244, 67, 54, 0.2);
}

/* Disconnect banner */
.disconnect-banner {
  margin-bottom: 10px;
  padding: 12px 16px;
  background: rgba(244, 67, 54, 0.12);
  border: 1px solid rgba(244, 67, 54, 0.25);
  border-radius: 8px;
}

.disconnect-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.disconnect-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.disconnect-icon.pulse {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.disconnect-text {
  display: flex;
  flex-direction: column;
}

.disconnect-title {
  font-size: 14px;
  font-weight: 600;
  color: #ef5350;
}

.disconnect-reason {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 1px;
}

.disconnect-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.reconnect-btn {
  text-transform: none;
  font-weight: 600;
}

/* Normal status bar */
.status-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-icon {
  font-size: 20px;
}

.status-icon.mdi-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.status-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
}

.status-text strong {
  font-weight: 500;
  margin-right: 4px;
}

.error-message {
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(244, 67, 54, 0.1);
  border-radius: 6px;
  color: #ff5252;
  font-size: 13px;
  display: flex;
  align-items: center;
}

.status-actions {
  display: flex;
  gap: 8px;
}
</style>
