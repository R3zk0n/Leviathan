<!-- CodeViewerDialog.vue -->
<template>
  <v-dialog
    v-model="dialogModel"
    fullscreen
    hide-overlay
    transition="dialog-bottom-transition"
  >
    <v-card>
      <v-toolbar dark color="primary">
        <v-btn icon dark @click="closeDialog">
          <v-icon>mdi-close</v-icon>
        </v-btn>
        <v-toolbar-title>{{ title }}</v-toolbar-title>
      </v-toolbar>
      <v-card-text class="pa-0 fill-height">
        <CodeViewer :code="code" :isDark="isDark" />
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { computed } from 'vue';
import CodeViewer from '@/components/Android/CodeViewer.vue';

const props = defineProps({
  modelValue: Boolean,
  code: String,
  isDark: Boolean,
  title: {
    type: String,
    default: 'Code Viewer'
  }
});

const emit = defineEmits(['update:modelValue']);

const dialogModel = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const closeDialog = () => {
  emit('update:modelValue', false);
};
</script>
