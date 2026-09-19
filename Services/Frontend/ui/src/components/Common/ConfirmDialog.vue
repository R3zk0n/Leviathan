<template>
  <v-dialog v-model="internalOpen" max-width="520" persistent>
    <v-card>
      <v-card-title class="text-h6">{{ title }}</v-card-title>
      <v-card-text>
        <div class="text-body-1">{{ message }}</div>
        <div
          v-if="details"
          class="text-body-2 mt-2"
          style="opacity: 0.8; white-space: pre-wrap;"
        >
          {{ details }}
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="cancel" :disabled="loading">{{ cancelText }}</v-btn>
        <v-btn :color="confirmColor" variant="elevated" @click="confirm" :loading="loading">
          {{ confirmText }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { defineComponent, computed } from 'vue';

export default defineComponent({
  name: 'ConfirmDialog',
  props: {
    modelValue: { type: Boolean, required: true },
    title: { type: String, default: 'Confirm' },
    message: { type: String, required: true },
    details: { type: String, default: '' },
    confirmText: { type: String, default: 'Confirm' },
    cancelText: { type: String, default: 'Cancel' },
    confirmColor: { type: String, default: 'error' },
    loading: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'confirm', 'cancel'],
  setup(props, { emit }) {
    const internalOpen = computed({
      get: () => props.modelValue,
      set: (v) => emit('update:modelValue', v),
    });

    const cancel = () => {
      emit('cancel');
      emit('update:modelValue', false);
    };

    const confirm = () => emit('confirm');

    return {
      internalOpen,
      cancel,
      confirm,
    };
  },
});
</script>
