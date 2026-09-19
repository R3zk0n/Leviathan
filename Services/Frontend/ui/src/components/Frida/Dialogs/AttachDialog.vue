<template>
  <v-dialog v-model="dialogModel" max-width="400px">
    <v-card>
      <v-card-title>Attach to Device</v-card-title>
      <v-card-text>
        <v-text-field
          v-model="localPidInput"
          label="Enter PID"
          type="number"
          :rules="[v => !!v || 'PID is required']"
        ></v-text-field>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="primary" text @click="closeDialog">Cancel</v-btn>
        <v-btn color="primary" @click="attach" :loading="attaching">Attach</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  modelValue: Boolean,
  deviceId: String,
  attaching: Boolean
});

const emit = defineEmits(['update:modelValue', 'attach']);

const localPidInput = ref('');

const dialogModel = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const closeDialog = () => {
  dialogModel.value = false;
  localPidInput.value = '';
};

const attach = () => {
  if (localPidInput.value) {
    emit('attach', {
      deviceId: props.deviceId,
      pid: parseInt(localPidInput.value)
    });
    localPidInput.value = '';
  }
};
</script>
