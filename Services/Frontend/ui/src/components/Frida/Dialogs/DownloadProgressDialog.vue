<template>
  <v-dialog :modelValue="show" @update:modelValue="$emit('update:show', $event)" max-width="400" persistent>
    <v-card>
      <v-card-title>
        <v-icon class="mr-2">mdi-download</v-icon>
        Downloading {{ fileType }}
      </v-card-title>
      <v-card-text>
        <p class="mb-2">{{ fileName }}</p>
        <v-progress-linear
          :model-value="progress"
          color="primary"
          height="20"
          rounded
        >
          <template v-slot:default>
            {{ progress }}%
          </template>
        </v-progress-linear>
        <p class="mt-2 text-caption" v-if="bytesReceived > 0">
          {{ formatBytes(bytesReceived) }} / {{ formatBytes(totalBytes) }}
        </p>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup>
defineProps({
  show: {
    type: Boolean,
    default: false
  },
  fileName: {
    type: String,
    default: ''
  },
  fileType: {
    type: String,
    default: 'File'
  },
  progress: {
    type: Number,
    default: 0
  },
  bytesReceived: {
    type: Number,
    default: 0
  },
  totalBytes: {
    type: Number,
    default: 0
  }
})

defineEmits(['update:show'])

const formatBytes = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>
