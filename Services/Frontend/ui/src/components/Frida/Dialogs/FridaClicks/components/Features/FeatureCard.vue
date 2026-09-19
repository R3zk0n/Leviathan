<template>
  <div class="feature-card" :class="{ 'monitor-card': isMonitor }">
    <div class="feature-header">
      <div class="feature-info">
        <v-icon
          size="small"
          class="mr-2"
          :color="active ? activeColor : iconColor"
        >
          {{ active && isMonitor ? activeIcon : icon }}
        </v-icon>
        <span class="feature-name">{{ title }}</span>
        <v-chip
          v-if="chipText"
          size="x-small"
          class="ml-2"
          :color="active ? activeColor : chipColor"
        >
          {{ chipText }}
        </v-chip>
        <v-chip
          v-if="active && statusText"
          size="x-small"
          class="ml-2"
          :color="statusColor"
        >
          {{ statusText }}
        </v-chip>
      </div>
      <div class="feature-actions">
        <slot name="actions">
          <v-switch
            v-if="isToggleable"
            v-model="localActive"
            density="compact"
            hide-details
            :disabled="disabled"
            :color="activeColor"
          />
        </slot>
      </div>
    </div>

    <div v-if="$slots.description || description" class="feature-description">
      <slot name="description">{{ description }}</slot>
    </div>

    <div v-if="$slots.default && (showOutput || !isToggleable)" class="feature-output">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: 'mdi-cog'
  },
  activeIcon: {
    type: String,
    default: ''
  },
  iconColor: {
    type: String,
    default: 'grey'
  },
  activeColor: {
    type: String,
    default: 'green'
  },
  chipText: {
    type: String,
    default: ''
  },
  chipColor: {
    type: String,
    default: 'grey'
  },
  statusText: {
    type: String,
    default: ''
  },
  statusColor: {
    type: String,
    default: 'green'
  },
  isToggleable: {
    type: Boolean,
    default: false
  },
  isMonitor: {
    type: Boolean,
    default: false
  },
  active: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  showOutput: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:active', 'toggle'])

const localActive = ref(props.active)

watch(() => props.active, (newVal) => {
  localActive.value = newVal
})

watch(localActive, (newVal) => {
  emit('update:active', newVal)
  emit('toggle', newVal)
})
</script>

<style scoped>
.feature-card {
  background: linear-gradient(145deg, #1e1e1e 0%, #1a1a1a 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  margin-bottom: 16px;
  padding: 20px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.feature-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(88, 166, 255, 0.4), transparent);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.feature-card:hover {
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.05);
}

.feature-card:hover::before {
  opacity: 1;
}

.monitor-card {
  border-color: rgba(76, 175, 80, 0.3);
  background: linear-gradient(145deg, #0a2a0f 0%, #1e1e1e 100%);
}

.monitor-card::before {
  background: linear-gradient(90deg, transparent, rgba(76, 175, 80, 0.4), transparent);
}

.feature-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.feature-info {
  display: flex;
  align-items: center;
  flex: 1;
}

.feature-name {
  font-size: 15px;
  font-weight: 600;
  color: #ffffff;
}

.feature-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.feature-description {
  font-size: 13px;
  color: #bbb;
  margin-bottom: 16px;
  line-height: 1.5;
  font-style: italic;
}

.feature-output {
  margin-top: 16px;
  background: linear-gradient(145deg, #141414 0%, #0f0f0f 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.3);
}
</style>
