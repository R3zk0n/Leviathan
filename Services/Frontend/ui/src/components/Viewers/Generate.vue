<template>
  <div>
    <v-dialog v-model="dialog" max-width="500px" persistent>
      <v-card :theme="isDark ? 'dark' : 'light'">
        <v-card-title class="d-flex align-center">
          <span class="text-h5">Generate Report</span>
          <v-spacer></v-spacer>
          <v-btn
            icon
            @click="closeDialog"
            :disabled="loading"
          >
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>

        <v-card-text>
          <v-form ref="form" v-model="isFormValid" class="mt-4">
            <v-row>
              <v-col cols="12">
                <div class="text-subtitle-1 mb-2">Report Contents</div>
                <v-checkbox
                  v-model="includeAppInfo"
                  label="Include App Information"
                  density="comfortable"
                  :disabled="loading"
                  hide-details
                  class="mb-2"
                ></v-checkbox>
                <v-checkbox
                  v-model="includeManifestRisks"
                  label="Include Manifest Risks"
                  density="comfortable"
                  :disabled="loading"
                  hide-details
                  class="mb-2"
                ></v-checkbox>
                <v-checkbox
                  v-model="includeSecurityIssues"
                  label="Include Security Issues"
                  density="comfortable"
                  :disabled="loading"
                  hide-details
                  class="mb-2"
                ></v-checkbox>
              </v-col>

              <v-col cols="12">
                <div class="text-subtitle-1 mb-2">Rendering Options</div>
                <v-checkbox
                  v-model="enableJavascriptRendering"
                  label="Enable Javascript Rendering"
                  density="comfortable"
                  :disabled="loading"
                  class="mb-2"
                >
                  <template v-slot:message>
                    <span class="text-caption">
                      Enables interactive charts & graphs but increases generation time
                    </span>
                  </template>
                </v-checkbox>
              </v-col>

              <v-col cols="12" v-if="includeSecurityIssues">
                <div class="text-subtitle-1 mb-2">Security Issue Severities</div>
                <v-select
                  v-model="selectedSeverities"
                  :items="severityOptions"
                  label="Select Severities"
                  multiple
                  chips
                  density="comfortable"
                  :disabled="loading"
                  class="mb-2"
                ></v-select>
              </v-col>

              <v-col cols="12">
                <div class="text-subtitle-1 mb-2">File Options</div>
                <v-text-field
                  v-model="customFileName"
                  label="File Name"
                  density="comfortable"
                  :disabled="loading"
                  :rules="[v => !!v || 'File name is required']"
                  hint="The PDF will be saved with this name"
                  persistent-hint
                ></v-text-field>
              </v-col>
            </v-row>
          </v-form>

          <!-- Loading Overlay -->
          <v-overlay
            :model-value="loading"
            class="align-center justify-center"
            contained
            scrim="#000000"
            :opacity="0.7"
          >
            <v-card
              class="pa-4 text-center"
              width="300"
              :theme="isDark ? 'dark' : 'light'"
              elevation="0"
            >
              <v-progress-circular
                indeterminate
                color="primary"
                size="64"
              ></v-progress-circular>
              <div class="text-h6 mt-4">{{ loadingTitle }}</div>
              <div class="text-body-2 mt-2">{{ loadingMessage }}</div>
              <div v-if="progress > 0" class="mt-4">
                <v-progress-linear
                  v-model="progress"
                  color="primary"
                  height="8"
                  rounded
                ></v-progress-linear>
                <div class="text-caption mt-1">{{ progress }}% complete</div>
              </div>
            </v-card>
          </v-overlay>
        </v-card-text>

        <v-card-actions class="pa-4">
          <v-spacer></v-spacer>
          <v-btn
            variant="outlined"
            :disabled="loading"
            @click="closeDialog"
            class="mr-2"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            :loading="loading"
            :disabled="!isFormValid || loading"
            @click="generateReport"
          >
            Generate Report
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Success/Error Snackbar -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="3000"
      location="top"
    >
      {{ snackbar.text }}
      <template v-slot:actions>
        <v-btn
          color="white"
          variant="text"
          @click="snackbar.show = false"
        >
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useStore } from 'vuex';
import axios from 'axios';

const props = defineProps({
  modelValue: Boolean,
  application: String,
  scanResults: Object,
});

const emit = defineEmits(['update:modelValue']);

// Store setup
const store = useStore();
const isDark = computed(() => store.state.isDark);

// Form refs and state
const form = ref(null);
const isFormValid = ref(true);
const dialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

// Form data
const includeAppInfo = ref(true);
const includeManifestRisks = ref(true);
const includeSecurityIssues = ref(true);
const selectedSeverities = ref(['High', 'Medium', 'Low']);
const customFileName = ref('');
const enableJavascriptRendering = ref(false);

// Loading state
const loading = ref(false);
const progress = ref(0);
const loadingTitle = ref('');
const loadingMessage = ref('');

// Snackbar state
const snackbar = ref({
  show: false,
  text: '',
  color: 'success'
});

// Constants
const severityOptions = ['High', 'Medium', 'Low'];

// Methods
const showSnackbar = (text, color = 'success') => {
  snackbar.value = {
    show: true,
    text,
    color
  };
};

const closeDialog = () => {
  if (loading.value) return;
  dialog.value = false;
  resetForm();
};

const resetForm = () => {
  progress.value = 0;
  loadingTitle.value = '';
  loadingMessage.value = '';
  if (form.value) {
    form.value.resetValidation();
  }
};

const generateReport = async () => {
  if (!isFormValid.value) return;

  loading.value = true;
  progress.value = 0;
  loadingTitle.value = enableJavascriptRendering.value
    ? 'Rendering PDF'
    : 'Generating PDF';
  loadingMessage.value = enableJavascriptRendering.value
    ? 'Preparing interactive elements...'
    : 'Processing report data...';

  try {
    const response = await axios.post(
      `${import.meta.env.VITE_APP_API_URL}/generate/generate-report`,
      {
        application: props.application,
        includeAppInfo: includeAppInfo.value,
        includeManifestRisks: includeManifestRisks.value,
        includeSecurityIssues: includeSecurityIssues.value,
        selectedSeverities: selectedSeverities.value,
        customFileName: customFileName.value,
        scanResults: props.scanResults,
        enableJavascriptRendering: enableJavascriptRendering.value
      },
      {
        responseType: 'blob',
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.lengthComputable) {
            progress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            loadingMessage.value = enableJavascriptRendering.value
              ? 'Rendering interactive elements...'
              : 'Generating PDF...';
          }
        }
      }
    );

    // Create and trigger download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${customFileName.value}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    showSnackbar('PDF generated successfully');
    closeDialog();
  } catch (error) {
    console.error('Error generating PDF:', error);
    showSnackbar('Error generating PDF. Please try again.', 'error');
  } finally {
    loading.value = false;
    progress.value = 0;
    loadingTitle.value = '';
    loadingMessage.value = '';
  }
};

// Watchers
watch(() => dialog.value, (newValue) => {
  if (newValue) {
    customFileName.value = `${props.application}_scan_report`;
    if (form.value) {
      form.value.resetValidation();
    }
  }
});
</script>

<style scoped>
.v-overlay {
  border-radius: 8px;
}

.v-card {
  border-radius: 8px;
}

.loading-card {
  background: rgba(255, 255, 255, 0.9);
}

.dark .loading-card {
  background: rgba(30, 30, 30, 0.9);
}
</style>
