<template>
  <div class="bulk-upload-container">
    <div class="d-flex align-center flex-wrap">
      <v-file-input
        v-model="selectedFiles"
        :accept="fileAccept"
        :label="inputLabel"
        multiple
        chips
        class="input-dark flex-grow-1 mr-2"
        :disabled="uploading"
        :loading="uploading"
        @change="handleFileSelect"
        prepend-icon="mdi-file-multiple"
        show-size
        :error-messages="selectionErrorMessages"
      >
        <template v-slot:selection="{ fileNames }">
          <template v-for="(fileName, index) in fileNames" :key="index">
            <v-chip v-if="index < 2" size="small" label color="primary" class="mr-1">
              {{ fileName }}
            </v-chip>
          </template>
          <span v-if="fileNames.length > 2" class="text-caption ml-2">
            +{{ fileNames.length - 2 }} more files
          </span>
        </template>
      </v-file-input>

      <div class="d-flex align-center">
        <v-btn
          @click="uploadFiles"
          :disabled="!canUpload"
          :loading="uploading"
          color="primary"
          class="ml-2"
          :class="isDark ? 'btn-dark' : ''"
        >
          <v-icon start>{{ uploading ? 'mdi-cloud-upload' : 'mdi-upload-multiple' }}</v-icon>
          {{ uploadButtonText }}
        </v-btn>

        <v-btn
          v-if="queue.length"
          variant="text"
          class="ml-2"
          :disabled="uploading"
          @click="clearQueue"
        >
          Clear
        </v-btn>
      </div>
    </div>

    <!-- Helpful inline hints -->
    <v-alert v-if="hintText" class="mt-2" density="compact" variant="tonal" type="info">
      {{ hintText }}
    </v-alert>

    <!-- Queue list -->
    <v-card v-if="queue.length" class="mt-3" variant="outlined" :class="isDark ? 'theme--dark' : 'theme--light'">
      <v-card-title class="d-flex align-center justify-space-between">
        <span>Files to upload</span>
        <span class="text-caption">
          {{ queueSummary }}
        </span>
      </v-card-title>

      <v-card-text class="pt-0">
        <v-list density="compact" class="queue-list">
          <v-list-item v-for="item in queue" :key="item.id" class="queue-item">
            <template v-slot:prepend>
              <v-icon :color="statusColor(item.status)">
                {{ statusIcon(item.status) }}
              </v-icon>
            </template>

            <v-list-item-title class="d-flex align-center">
              <span class="file-name" :title="item.name">{{ item.name }}</span>
              <v-chip
                v-if="item.validation?.reason"
                size="x-small"
                class="ml-2"
                color="warning"
                variant="tonal"
              >
                {{ item.validation.reason }}
              </v-chip>
            </v-list-item-title>

            <v-list-item-subtitle>
              <span class="text-caption">{{ formatFileSize(item.size) }}</span>
              <span v-if="item.error" class="text-caption error--text ml-2">— {{ item.error }}</span>
            </v-list-item-subtitle>

            <div v-if="item.status === 'uploading' || item.status === 'success' || item.status === 'failed'" class="mt-2">
              <v-progress-linear
                :model-value="item.progress"
                :color="item.status === 'success' ? 'success' : item.status === 'failed' ? 'error' : 'primary'"
                height="6"
                rounded
              />
            </div>

            <template v-slot:append>
              <div class="d-flex align-center">
                <v-btn
                  v-if="item.status === 'failed' && !uploading"
                  size="small"
                  variant="text"
                  color="primary"
                  class="mr-1"
                  @click="retryItem(item.id)"
                >
                  Retry
                </v-btn>

                <v-btn
                  icon
                  variant="text"
                  color="error"
                  :disabled="uploading && item.status === 'uploading'"
                  :aria-label="`Remove ${item.name}`"
                  @click="removeItem(item.id)"
                >
                  <v-icon>mdi-close</v-icon>
                </v-btn>
              </div>
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>

      <v-card-actions class="pt-0">
        <v-spacer />
        <v-btn
          v-if="hasFailed"
          variant="text"
          :disabled="uploading"
          @click="retryFailed"
        >
          Retry failed
        </v-btn>
        <v-btn
          variant="text"
          color="error"
          :disabled="uploading"
          @click="removeFailed"
        >
          Remove failed
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- Upload Progress Dialog -->
    <v-dialog v-model="uploading" persistent max-width="420">
      <v-card :class="isDark ? 'theme--dark' : 'theme--light'">
        <v-card-title>Uploading files</v-card-title>
        <v-card-text>
          <div class="text-center mb-4">
            <v-progress-circular
              :rotate="-90"
              :size="96"
              :width="10"
              :model-value="progress"
              color="primary"
            >
              {{ progress }}%
            </v-progress-circular>
          </div>

          <div class="text-center">
            <div class="text-body-1 mb-1 truncate">
              {{ currentFile || 'Preparing…' }}
            </div>
            <div class="text-body-2">
              Uploading {{ currentFileIndex }} of {{ totalFiles }}
            </div>
          </div>

          <v-progress-linear
            class="mt-4"
            :model-value="progress"
            color="primary"
            height="8"
            rounded
          />

          <div class="mt-4 text-caption">
            <div class="d-flex justify-space-between">
              <span>Successful:</span>
              <span class="success--text">{{ uploadResults.success.length }}</span>
            </div>
            <div class="d-flex justify-space-between">
              <span>Failed:</span>
              <span class="error--text">{{ uploadResults.failed.length }}</span>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- Results Dialog -->
    <v-dialog v-model="showResults" max-width="560">
      <v-card :class="isDark ? 'theme--dark' : 'theme--light'">
        <v-card-title>Upload results</v-card-title>
        <v-card-text>
          <v-alert
            v-if="uploadResults.failed.length && !uploadResults.success.length"
            type="error"
            density="compact"
            variant="tonal"
            class="mb-3"
          >
            All uploads failed. Expand the list below to see which files.
          </v-alert>
          <v-alert
            v-else-if="uploadResults.failed.length && uploadResults.success.length"
            type="warning"
            density="compact"
            variant="tonal"
            class="mb-3"
          >
            Some files uploaded, some failed.
          </v-alert>
          <v-alert
            v-else-if="uploadResults.success.length"
            type="success"
            density="compact"
            variant="tonal"
            class="mb-3"
          >
            All files uploaded successfully.
          </v-alert>

          <div v-if="uploadResults.success.length" class="mb-4">
            <div class="text-h6 success--text mb-2">
              Successful ({{ uploadResults.success.length }})
            </div>
            <v-list density="compact">
              <v-list-item v-for="file in uploadResults.success" :key="file">
                <template v-slot:prepend>
                  <v-icon color="success">mdi-check-circle</v-icon>
                </template>
                <v-list-item-title>{{ file }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </div>

          <div v-if="uploadResults.failed.length">
            <div class="text-h6 error--text mb-2">
              Failed ({{ uploadResults.failed.length }})
            </div>
            <v-list density="compact">
              <v-list-item v-for="file in uploadResults.failed" :key="file">
                <template v-slot:prepend>
                  <v-icon color="error">mdi-alert-circle</v-icon>
                </template>
                <v-list-item-title>{{ file }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" @click="closeResults">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'BulkUpload',

  props: {
    isDark: {
      type: Boolean,
      default: false
    },
    type: {
      type: String,
      required: true,
      validator: (value) => ['audit', 'ios'].includes(value)
    },
    onUploadComplete: {
      type: Function,
      default: () => {}
    }
  },

  data() {
    return {
      selectedFiles: null,
      uploading: false,
      showResults: false,
      progress: 0,
      currentFile: '',
      currentFileIndex: 0,
      totalFiles: 0,
      uploadResults: {
        success: [],
        failed: []
      },

      // Queue model
      queue: [],
      selectionErrorMessages: []
    };
  },

  computed: {
    fileType() {
      return this.type === 'ios' ? '.ipa' : '.apk';
    },

    fileAccept() {
      // keep strict accept according to selected type
      return this.fileType;
    },

    inputLabel() {
      const labelType = this.fileType.toUpperCase();
      return `Bulk Upload ${labelType}`;
    },

    hintText() {
      const ext = this.fileType.toUpperCase();
      if (!this.queue.length) {
        return `Select one or more ${ext} files. You can remove files from the queue before uploading.`;
      }
      if (!this.canUpload) {
        return `Fix the highlighted files before uploading (only ${ext} files are allowed).`;
      }
      return '';
    },

    canUpload() {
      if (this.uploading) return false;
      if (!this.queue.length) return false;
      return this.queue.every(i => i.status !== 'invalid') && this.queue.some(i => i.status === 'pending' || i.status === 'failed');
    },

    uploadButtonText() {
      if (this.uploading) return `Uploading ${this.progress}%`;
      const pendingCount = this.queue.filter(i => i.status === 'pending' || i.status === 'failed').length;
      return pendingCount ? `Upload ${pendingCount} File${pendingCount > 1 ? 's' : ''}` : 'Bulk Upload';
    },

    hasFailed() {
      return this.queue.some(i => i.status === 'failed');
    },

    queueSummary() {
      const total = this.queue.length;
      const pending = this.queue.filter(i => i.status === 'pending').length;
      const success = this.queue.filter(i => i.status === 'success').length;
      const failed = this.queue.filter(i => i.status === 'failed').length;
      const invalid = this.queue.filter(i => i.status === 'invalid').length;
      const parts = [];
      if (pending) parts.push(`${pending} pending`);
      if (success) parts.push(`${success} success`);
      if (failed) parts.push(`${failed} failed`);
      if (invalid) parts.push(`${invalid} invalid`);
      return `${total} total${parts.length ? ' • ' + parts.join(' • ') : ''}`;
    }
  },

  methods: {
    handleFileSelect(files) {
      try {
        this.selectionErrorMessages = [];

        if (!files) {
          this.selectedFiles = null;
          return;
        }

        // Handle FileList, Array, or single file
        let fileArray = [];
        if (files instanceof FileList) {
          fileArray = Array.from(files);
        } else if (Array.isArray(files)) {
          fileArray = files;
        } else {
          fileArray = files ? [files] : [];
        }

        const cleaned = fileArray.filter(Boolean);
        if (!cleaned.length) {
          this.selectedFiles = null;
          return;
        }

        // Append to queue (don’t drop already-selected files)
        this.addToQueue(cleaned);

        // reset selection input so selecting the same file again triggers change
        this.selectedFiles = null;
      } catch (error) {
        console.error('File selection error:', error);
        this.selectionErrorMessages = ['Could not read selected files.'];
        this.selectedFiles = null;
      }
    },

    addToQueue(files) {
      const allowedExt = this.fileType.toLowerCase();
      const newItems = [];

      for (const file of files) {
        const name = file?.name || 'unknown';
        const id = `${name}-${file?.size || 0}-${file?.lastModified || Date.now()}-${Math.random().toString(16).slice(2)}`;
        const lower = name.toLowerCase();

        const isAllowed = lower.endsWith(allowedExt);
        const validation = isAllowed ? { ok: true, reason: '' } : { ok: false, reason: `Only ${allowedExt} allowed` };

        newItems.push({
          id,
          file,
          name,
          size: file?.size ?? 0,
          status: validation.ok ? 'pending' : 'invalid',
          progress: 0,
          error: '',
          validation
        });
      }

      // De-dupe by (name + size + lastModified) to avoid accidental duplicates
      const signature = (item) => `${item.name}-${item.size}-${item.file?.lastModified || 0}`;
      const existing = new Set(this.queue.map(signature));
      const deduped = [];

      for (const item of newItems) {
        const sig = signature(item);
        if (existing.has(sig)) {
          this.selectionErrorMessages.push(`Skipped duplicate: ${item.name}`);
          continue;
        }
        existing.add(sig);
        deduped.push(item);
      }

      this.queue = [...this.queue, ...deduped];

      // If user selected some wrong extensions, give a single selection-level hint too
      const invalidCount = deduped.filter(i => i.status === 'invalid').length;
      if (invalidCount) {
        this.selectionErrorMessages.push(`Some files are not ${allowedExt.toUpperCase()} and won’t upload.`);
      }

      this.resetUploadState();
    },

    resetUploadState() {
      this.progress = 0;
      this.currentFile = '';
      this.currentFileIndex = 0;
      this.uploadResults = { success: [], failed: [] };
      this.showResults = false;
    },

    clearQueue() {
      if (this.uploading) return;
      this.queue = [];
      this.resetUploadState();
      this.selectionErrorMessages = [];
    },

    removeItem(id) {
      if (this.uploading) return;
      this.queue = this.queue.filter(i => i.id !== id);
    },

    retryItem(id) {
      if (this.uploading) return;
      this.queue = this.queue.map(i => {
        if (i.id !== id) return i;
        return { ...i, status: 'pending', progress: 0, error: '' };
      });
    },

    retryFailed() {
      if (this.uploading) return;
      this.queue = this.queue.map(i => (i.status === 'failed' ? { ...i, status: 'pending', progress: 0, error: '' } : i));
    },

    removeFailed() {
      if (this.uploading) return;
      this.queue = this.queue.filter(i => i.status !== 'failed');
    },

    statusIcon(status) {
      if (status === 'success') return 'mdi-check-circle';
      if (status === 'failed') return 'mdi-alert-circle';
      if (status === 'invalid') return 'mdi-alert';
      if (status === 'uploading') return 'mdi-cloud-upload';
      return 'mdi-file';
    },

    statusColor(status) {
      if (status === 'success') return 'success';
      if (status === 'failed') return 'error';
      if (status === 'invalid') return 'warning';
      if (status === 'uploading') return 'primary';
      return undefined;
    },

    formatFileSize(size) {
      if (size < 1024) return `${size} B`;
      if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
      if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
      return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    },

    getFriendlyError(error) {
      const status = error?.response?.status;
      const message = error?.response?.data?.message || error?.response?.data?.detail || error?.message;

      if (status === 413) return 'File too large.';
      if (status === 415) return 'Unsupported file type.';
      if (status === 401 || status === 403) return 'Not authorized.';
      if (error?.code === 'ECONNABORTED') return 'Upload timed out.';
      return message || 'Upload failed.';
    },

    async uploadFiles() {
      if (!this.canUpload) return;

      const itemsToUpload = this.queue.filter(i => i.status === 'pending');
      if (!itemsToUpload.length) return;

      this.uploading = true;
      this.totalFiles = itemsToUpload.length;

      try {
        // Reset results for this run
        this.uploadResults = { success: [], failed: [] };

        for (let i = 0; i < itemsToUpload.length; i++) {
          const item = itemsToUpload[i];

          this.currentFile = item.name;
          this.currentFileIndex = i + 1;

          // mark uploading
          this.queue = this.queue.map(q => (q.id === item.id ? { ...q, status: 'uploading', progress: 0, error: '' } : q));

          const formData = new FormData();
          formData.append('file', item.file);

          try {
            const response = await axios.post(
              `${import.meta.env.VITE_APP_API_URL}/audit/upload`,
              formData,
              {
                headers: { 'Content-Type': 'multipart/form-data' },
                params: { type: this.type },
                timeout: 30000,
                onUploadProgress: (progressEvent) => {
                  const total = progressEvent.total || item.size || 1;
                  const percentCompleted = Math.round((progressEvent.loaded * 100) / total);
                  this.queue = this.queue.map(q => (q.id === item.id ? { ...q, progress: percentCompleted } : q));
                }
              }
            );

            const ok = response.status === 201 || response.status === 200;
            if (ok) {
              this.uploadResults.success.push(item.name);
              this.queue = this.queue.map(q => (q.id === item.id ? { ...q, status: 'success', progress: 100 } : q));
            } else {
              this.uploadResults.failed.push(item.name);
              this.queue = this.queue.map(q => (q.id === item.id ? { ...q, status: 'failed', error: `Unexpected status: ${response.status}` } : q));
            }
          } catch (error) {
            const friendly = this.getFriendlyError(error);
            this.uploadResults.failed.push(item.name);
            this.queue = this.queue.map(q => (q.id === item.id ? { ...q, status: 'failed', error: friendly } : q));
          }

          this.progress = Math.round(((i + 1) / itemsToUpload.length) * 100);
        }

        this.showResults = true;

        if (this.uploadResults.success.length > 0) {
          this.onUploadComplete();
        }

        this.showUploadSummary();
      } catch (error) {
        console.error('Process error:', error);
        this.$emit('show-snackbar', {
          text: 'Error processing files',
          color: 'error'
        });
      } finally {
        this.uploading = false;
        this.currentFile = '';
      }
    },

    showUploadSummary() {
      const { success, failed } = this.uploadResults;
      const fileType = this.fileType.toUpperCase().substring(1);

      if (success.length && !failed.length) {
        this.$emit('show-snackbar', {
          text: `Successfully uploaded ${success.length} ${fileType} file${success.length > 1 ? 's' : ''}`,
          color: 'success'
        });
      } else if (failed.length && !success.length) {
        this.$emit('show-snackbar', {
          text: `Failed to upload ${failed.length} ${fileType} file${failed.length > 1 ? 's' : ''}`,
          color: 'error'
        });
      } else {
        this.$emit('show-snackbar', {
          text: `Uploaded ${success.length} ${fileType} file${success.length > 1 ? 's' : ''}, ${failed.length} failed`,
          color: 'warning'
        });
      }
    },

    closeResults() {
      this.showResults = false;
      this.resetUploadState();
    }
  }
};
</script>

<style scoped>
.bulk-upload-container {
  width: 100%;
}

.d-flex {
  display: flex !important;
}

.flex-wrap {
  flex-wrap: wrap;
}

.align-center {
  align-items: center !important;
}

.justify-space-between {
  justify-content: space-between !important;
}

.mr-1 {
  margin-right: 4px !important;
}

.mr-2 {
  margin-right: 8px !important;
}

.ml-2 {
  margin-left: 8px !important;
}

.mb-4 {
  margin-bottom: 16px !important;
}

.mt-2 {
  margin-top: 8px !important;
}

.mt-3 {
  margin-top: 12px !important;
}

.mt-4 {
  margin-top: 16px !important;
}

.flex-grow-1 {
  flex-grow: 1 !important;
}

.text-caption {
  font-size: 0.75rem !important;
}

.theme--dark {
  background-color: #1E1E1E !important;
  color: #FFFFFF !important;
}

.theme--light {
  background-color: #FFFFFF !important;
  color: #000000 !important;
}

.btn-dark {
  background-color: #424242 !important;
  color: #FFFFFF !important;
}

.success--text {
  color: #4CAF50 !important;
}

.error--text {
  color: #FF5252 !important;
}

.file-name {
  max-width: 340px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
}

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-list :deep(.v-list-item) {
  padding-top: 10px;
  padding-bottom: 10px;
}

@media (max-width: 600px) {
  .file-name {
    max-width: 220px;
  }
}
</style>
