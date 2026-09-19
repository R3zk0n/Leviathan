<template>
  <div class="dialog-header" @mousedown="$emit('mousedown', $event)">
    <v-icon class="drag-icon">mdi-drag</v-icon>
    <v-icon class="header-icon">mdi-api</v-icon>
    <span class="header-title">{{ title }}</span>
    <v-spacer />
    <v-btn
      icon
      size="small"
      variant="text"
      @click="$emit('minimize')"
    >
      <v-icon size="small">mdi-minus</v-icon>
    </v-btn>
    <v-btn
      icon
      size="small"
      variant="text"
      @click="$emit('maximize')"
    >
      <v-icon size="small">mdi-window-maximize</v-icon>
    </v-btn>
    <v-btn
      icon
      size="small"
      variant="text"
      @click="$emit('close')"
    >
      <v-icon size="small">mdi-close</v-icon>
    </v-btn>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: 'Frida Agent Control Panel'
  }
})

defineEmits(['mousedown', 'minimize', 'maximize', 'close'])
</script>

<style scoped>
.dialog-header {
  background: linear-gradient(135deg, #2d2d2d 0%, #242424 100%);
  padding: 16px 20px;
  cursor: move;
  display: flex;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  user-select: none;
  transition: all 0.3s ease;
}

.dialog-header:hover {
  background: linear-gradient(135deg, #333333 0%, #2a2a2a 100%);
}

.drag-icon {
  margin-right: 12px;
  color: #666;
  font-size: 20px;
}

.header-icon {
  margin-right: 16px;
  color: #58a6ff;
  font-size: 24px;
}

.header-title {
  font-size: 18px;
  font-weight: 500;
  color: #ffffff;
  letter-spacing: 0.5px;
}
</style>
