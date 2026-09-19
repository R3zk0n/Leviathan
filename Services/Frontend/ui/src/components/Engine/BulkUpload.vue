<template>
  <v-container class="bulk-upload">
    <v-card class="pa-4" rounded="lg" elevation="2" :class="isDark ? 'theme--dark' : 'theme--light'">
      <div class="d-flex align-center justify-space-between flex-wrap gap-2">
        <div>
          <div class="text-h6 font-weight-medium">Bulk Upload</div>
          <div class="text-body-2 text-medium-emphasis">
            Drag and drop files or browse to select.
          </div>
        </div>

        <div class="d-flex align-center gap-2">
          <v-chip v-if="files.length" size="small" variant="tonal" color="primary">
            {{ files.length }} file{{ files.length > 1 ? 's' : '' }}
          </v-chip>
          <v-btn variant="text" color="error" :disabled="loading || !files.length" @click="clearFiles">
            Clear
          </v-btn>
          <v-btn color="primary" :loading="loading" :disabled="loading || files.length === 0" @click="uploadFiles">
            Upload
          </v-btn>
        </div>
      </div>

      <v-divider class="my-4" />

      <!-- Drag & Drop Zone -->
      <div
        class="drop-zone"
        :class="{ 'drag-over': isDragging }"
        tabindex="0"
        role="button"
        aria-label="Upload files"
        @keydown.enter.prevent="triggerBrowse"
        @keydown.space.prevent="triggerBrowse"
        @dragover.prevent="isDragging = true"
        @dragleave="isDragging = false"
        @drop="handleDrop"
        @click="triggerBrowse"
      >
        <div class="drop-inner">
          <v-icon size="32" class="mb-2" color="primary">mdi-tray-arrow-up</v-icon>
          <div class="text-subtitle-1 font-weight-medium">Drop APK/IPA files here</div>
          <div class="text-body-2 text-medium-emphasis">or click to browse</div>
          <div class="text-caption text-medium-emphasis mt-2">Accepted: .apk, .ipa</div>
        </div>

        <!-- Real file picker (hidden visually, used for multi-select browse) -->
        <v-file-input
          ref="fileInput"
          v-model="pickedFiles"
          class="sr-only"
          multiple
          label="Select APK/IPA files"
          accept=".apk, .ipa"
          @update:modelValue="onPickedFiles"
        />
      </div>

      <!-- File List with Progress -->
      <v-card v-if="files.length" class="mt-4" variant="outlined" rounded="lg" :class="isDark ? 'theme--dark' : 'theme--light'">
        <v-card-title class="d-flex align-center justify-space-between">
          <span class="text-subtitle-1">Upload queue</span>
          <span class="text-caption text-medium-emphasis">{{ summaryText }}</span>
        </v-card-title>

        <v-card-text class="pt-0">
          <v-list density="compact">
            <v-list-item v-for="(file, index) in files" :key="file.key">
              <template #prepend>
                <v-avatar size="28" variant="tonal" :color="file.type === 'audit' ? 'primary' : 'secondary'">
                  <v-icon size="18">{{ file.type === 'audit' ? 'mdi-android' : 'mdi-apple' }}</v-icon>
                </v-avatar>
              </template>

              <v-list-item-title class="d-flex align-center">
                <span class="file-name" :title="file.name">{{ file.name }}</span>
                <v-chip class="ml-2" size="x-small" variant="tonal" :color="file.type === 'audit' ? 'primary' : 'secondary'">
                  {{ file.type }}
                </v-chip>
                <span class="ml-2 text-caption text-medium-emphasis">{{ formatFileSize(file.size) }}</span>
              </v-list-item-title>

              <v-list-item-subtitle>
                <div v-if="uploadProgress[file.key] !== undefined" class="mt-2">
                  <v-progress-linear
                    :model-value="uploadProgress[file.key]"
                    color="primary"
                    height="6"
                    rounded
                  />
                </div>

                <v-alert
                  v-if="uploadMessages[file.key]"
                  :type="uploadMessages[file.key].startsWith('Error') ? 'error' : 'success'"
                  class="mt-2"
                  density="compact"
                  variant="tonal"
                >
                  {{ uploadMessages[file.key] }}
                </v-alert>
              </v-list-item-subtitle>

              <template #append>
                <v-btn
                  icon
                  variant="text"
                  color="error"
                  :disabled="loading"
                  :aria-label="`Remove ${file.name}`"
                  @click="removeFile(index)"
                >
                  <v-icon>mdi-close</v-icon>
                </v-btn>
              </template>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>

      <v-alert v-else class="mt-4" variant="tonal" type="info" density="comfortable">
        No files selected yet.
      </v-alert>

      <!-- Upload Progress Dialog (theme-aware) -->
      <v-dialog v-model="showUploadDialog" persistent max-width="520">
        <v-card :class="isDark ? 'theme--dark' : 'theme--light'">
          <v-card-title class="d-flex align-center justify-space-between">
            <span>Uploading…</span>
            <span class="text-caption text-medium-emphasis">{{ summaryText }}</span>
          </v-card-title>
          <v-card-text>
            <div class="text-body-2 text-medium-emphasis">
              {{ currentUploadingName || 'Preparing…' }}
            </div>
            <v-progress-linear class="mt-3" :model-value="overallProgress" height="8" rounded color="primary" />
          </v-card-text>
        </v-card>
      </v-dialog>
    </v-card>
  </v-container>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useStore } from 'vuex';
import axios from 'axios';

const store = useStore();
const isDark = computed(() => store.getters?.isDark);

const isDragging = ref(false);
const files = ref([]);
const uploadProgress = ref({});
const uploadMessages = ref({});
const loading = ref(false);

const fileInput = ref(null);
const pickedFiles = ref([]);

const showUploadDialog = ref(false);
const currentUploadingKey = ref('');

const currentUploadingName = computed(() => {
  const item = files.value.find(f => f.key === currentUploadingKey.value);
  return item?.name || '';
});

const overallProgress = computed(() => {
  const keys = Object.keys(uploadProgress.value);
  if (!keys.length) return 0;
  const sum = keys.reduce((acc, k) => acc + (Number(uploadProgress.value[k]) || 0), 0);
  return Math.round(sum / keys.length);
});

const triggerBrowse = () => {
  const el = fileInput.value?.$el;
  const input = el?.querySelector?.('input[type="file"]');
  input?.click?.();
};

const summaryText = computed(() => {
  const total = files.value.length;
  const succeeded = Object.values(uploadMessages.value).filter(m => typeof m === 'string' && !m.startsWith('Error')).length;
  const failed = Object.values(uploadMessages.value).filter(m => typeof m === 'string' && m.startsWith('Error')).length;
  const parts = [];
  if (succeeded) parts.push(`${succeeded} success`);
  if (failed) parts.push(`${failed} failed`);
  return `${total} total${parts.length ? ' • ' + parts.join(' • ') : ''}`;
});

const onPickedFiles = (newValue) => {
  // Vuetify returns an array of File objects (or empty)
  if (!newValue || (Array.isArray(newValue) && newValue.length === 0)) return;
  const list = Array.isArray(newValue) ? newValue : [newValue];
  processFiles(list);

  // Reset so selecting the same files again triggers
  pickedFiles.value = [];
};

const handleDrop = (event) => {
  event.preventDefault();
  isDragging.value = false;

  const dropped = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : [];
  if (dropped.length) {
    processFiles(dropped);
  }
};

const processFiles = (fileList) => {
  const selectedFiles = Array.from(fileList).filter(file =>
    file?.name && (file.name.toLowerCase().endsWith('.apk') || file.name.toLowerCase().endsWith('.ipa'))
  );

  const toQueueItem = (file) => ({
    key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(16).slice(2)}`,
    file,
    name: file.name,
    size: file.size,
    type: file.name.toLowerCase().endsWith('.apk') ? 'audit' : 'ios'
  });

  files.value = [
    ...files.value,
    ...selectedFiles.map(toQueueItem)
  ];

  for (const f of files.value) {
    if (uploadProgress.value[f.key] === undefined) {
      uploadProgress.value[f.key] = 0;
    }
  }
};

const removeFile = (index) => {
  const fileKey = files.value[index].key;
  delete uploadProgress.value[fileKey];
  delete uploadMessages.value[fileKey];
  files.value.splice(index, 1);
};

const clearFiles = () => {
  files.value = [];
  uploadProgress.value = {};
  uploadMessages.value = {};
};

const uploadFiles = async () => {
  loading.value = true;
  showUploadDialog.value = true;

  for (const fileObj of files.value) {
    currentUploadingKey.value = fileObj.key;
    await uploadFile(fileObj);
  }

  currentUploadingKey.value = '';
  showUploadDialog.value = false;
  loading.value = false;
};

const uploadFile = async (fileObj) => {
  const formData = new FormData();
  formData.append('file', fileObj.file);

  try {
    await axios.post(`${import.meta.env.VITE_APP_API_URL}/audit/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: { type: fileObj.type },
      onUploadProgress: (progressEvent) => {
        const total = progressEvent.total || fileObj.size || 1;
        uploadProgress.value[fileObj.key] = Math.round((progressEvent.loaded * 100) / total);
      }
    });

    uploadMessages.value[fileObj.key] = 'Upload successful!';
  } catch (error) {
    uploadMessages.value[fileObj.key] = `Error: ${error.response?.data?.message || 'Upload failed'}`;
  }
};

const formatFileSize = (size) => {
  if (size < 1024) return size + ' B';
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
  if (size < 1024 * 1024 * 1024) return (size / (1024 * 1024)).toFixed(1) + ' MB';
  return (size / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
};
</script>

<style scoped>
.bulk-upload {
  max-width: 980px;
}

.gap-2 {
  gap: 8px;
}

.drop-zone {
  border: 2px dashed rgba(25, 118, 210, 0.45);
  border: 2px dashed rgb(var(--v-theme-primary, 25 118 210) / 45%);
  border-radius: 14px;
  padding: 28px;
  cursor: pointer;
  transition: border-color 0.2s ease, background-color 0.2s ease, transform 0.15s ease;
  background: rgba(255, 255, 255, 0.7);
  outline: none;
}

.theme--dark .drop-zone {
  background: rgba(255, 255, 255, 0.05);
}

.drop-zone:focus-visible {
  border-color: rgba(25, 118, 210, 0.9);
  border-color: rgb(var(--v-theme-primary, 25 118 210) / 90%);
  box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.2);
  box-shadow: 0 0 0 3px rgb(var(--v-theme-primary, 25 118 210) / 20%);
}

.drop-zone.drag-over {
  background-color: rgba(25, 118, 210, 0.08);
  background-color: rgb(var(--v-theme-primary, 25 118 210) / 8%);
  border-color: rgba(25, 118, 210, 0.9);
  border-color: rgb(var(--v-theme-primary, 25 118 210) / 90%);
  transform: translateY(-1px);
}

.drop-inner {
  text-align: center;
}

.file-name {
  max-width: 420px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
}

/* Visually hide the entire file input widget, not just the native input */
.sr-only {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

.theme--dark {
  background-color: #1E1E1E !important;
  color: #FFFFFF !important;
}

.theme--dark :deep(.text-medium-emphasis),
.theme--dark :deep(.text-body-2),
.theme--dark :deep(.text-caption),
.theme--dark :deep(.text-subtitle-1) {
  color: rgba(255, 255, 255, 0.7) !important;
}

.theme--dark :deep(.text-h6),
.theme--dark :deep(.text-subtitle-2),
.theme--dark :deep(.text-body-1) {
  color: rgba(255, 255, 255, 0.87) !important;
}

.theme--light {
  background-color: #FFFFFF !important;
  color: #000000 !important;
}

@media (max-width: 600px) {
  .drop-zone {
    padding: 18px;
  }

  .file-name {
    max-width: 220px;
  }
}
</style>
