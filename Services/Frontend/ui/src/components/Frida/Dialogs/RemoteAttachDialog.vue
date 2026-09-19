<template>
  <v-dialog v-model="dialog" max-width="400px">
    <v-card>
      <v-card-title>Remote Attach</v-card-title>
      <v-card-text>
        <v-form @submit.prevent="attachToRemote">
          <v-text-field
            v-model="host"
            label="Hostname or IP Address"
            :rules="[v => !!v || 'Host is required', v => isValidHost(v) || 'Invalid hostname or IP format']"
            required
          ></v-text-field>
          <v-text-field
            v-model="port"
            label="Port"
            type="number"
            :rules="[v => !!v || 'Port is required', v => (v > 0 && v < 65536) || 'Invalid port number']"
            required
          ></v-text-field>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="primary" text @click="dialog = false">Cancel</v-btn>
        <v-btn color="primary" @click="attachToRemote" :loading="attaching">Attach</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  modelValue: Boolean,
  attaching: Boolean
});

const emit = defineEmits(['update:modelValue', 'attach']);

const host = ref('');
const port = ref('');

const dialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const isValidHost = (value) => {
  // Simple regex for IP address or domain name validation
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
  return ipRegex.test(value) || domainRegex.test(value);
};

const attachToRemote = () => {
  if (host.value && port.value) {
    const data = { host: host.value, port: port.value };
    console.log('Sending data:', data);  // Debug log
    emit('attach', data);
  }
};
</script>
