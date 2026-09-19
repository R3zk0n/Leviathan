<template>
  <div class="status-bar">
    <div class="status-info">
      <v-chip size="x-small" :color="connectionStatus === 'Active' ? 'green' : 'grey'">
        <v-icon start size="x-small">mdi-circle</v-icon>
        {{ connectionStatus }}
      </v-chip>
      <span class="separator">•</span>
      <span class="info-text">{{ activeFeatures }} active features</span>
      <span class="separator">•</span>
      <span class="info-text">Platform: {{ currentPlatform }}</span>
    </div>

    <div class="status-actions">
      <v-btn
        size="x-small"
        variant="text"
        @click="$emit('expand-all')"
      >
        Expand All
      </v-btn>
      <v-btn
        size="x-small"
        variant="text"
        @click="$emit('collapse-all')"
      >
        Collapse All
      </v-btn>
      <v-divider vertical class="mx-2" />
      <v-btn
        icon
        size="x-small"
        variant="text"
        @click="$emit('decrease-font')"
      >
        <v-icon size="small">mdi-format-font-size-decrease</v-icon>
      </v-btn>
      <span class="font-size">{{ fontSize }}px</span>
      <v-btn
        icon
        size="x-small"
        variant="text"
        @click="$emit('increase-font')"
      >
        <v-icon size="small">mdi-format-font-size-increase</v-icon>
      </v-btn>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useStore } from 'vuex'

const store = useStore()

defineProps({
  activeFeatures: {
    type: Number,
    default: 0
  },
  currentPlatform: {
    type: String,
    default: 'None'
  },
  connectionStatus: {
    type: String,
    default: 'Ready'
  }
})

defineEmits(['expand-all', 'collapse-all', 'increase-font', 'decrease-font'])

const fontSize = computed(() => store.getters['frida/fontSize'])
</script>

<style scoped>
.status-bar {
  background: linear-gradient(180deg, #1a1a1a 0%, #161616 100%);
  padding: 8px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 12px;
}

.status-info {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #999;
}

.separator {
  color: #666;
}

.info-text {
  color: #b0b0b0;
}

.status-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.font-size {
  color: #888;
  font-size: 11px;
  padding: 0 4px;
}
</style>
