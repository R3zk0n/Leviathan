<template>
  <v-container :class="isDark ? 'theme--dark' : 'theme--light'">

    <v-row class="mb-4">
      <v-col cols="12">
        <div class="d-flex align-center">
          <v-icon size="28" class="mr-3" color="primary">mdi-robot</v-icon>
          <div>
            <div class="text-h5 font-weight-bold">Agents</div>
            <div class="text-caption text-medium-emphasis">
              Agentic audit pipelines — Claude autonomously validates scan findings
            </div>
          </div>
        </div>
      </v-col>
    </v-row>

    <!-- Action buttons -->
    <v-row justify="center">
      <v-col cols="auto">
        <v-btn
          @click="checkAgentStatus"
          :loading="isLoadingStatus"
          :disabled="isLoadingStatus"
          :class="isDark ? 'btn-dark' : 'btn-light'"
          height="72"
          min-width="164"
          prepend-icon="mdi-robot"
        >
          Check Agent Status
        </v-btn>
      </v-col>
      <v-col cols="auto">
        <v-btn
          @click="runAuditAgent"
          :loading="isLoadingAudit"
          :disabled="isLoadingAudit || !selectedScanId"
          :class="isDark ? 'btn-dark' : 'btn-light'"
          height="72"
          min-width="164"
          prepend-icon="mdi-play-circle-outline"
        >
          Run Audit Agent
        </v-btn>
      </v-col>
    </v-row>

    <!-- Status card -->
    <v-row justify="center" class="mt-5">
      <v-col cols="12" md="8">
        <v-card :class="isDark ? 'theme--dark' : 'theme--light'" elevation="2">
          <v-card-title class="text-center">Agent Status</v-card-title>
          <v-card-text>
            <v-list :class="isDark ? 'theme--dark' : 'theme--light'">
              <v-list-item v-if="agentStatus">
                <v-list-item-title>Agent Runner</v-list-item-title>
                <v-list-item-subtitle>
                  <v-chip :color="agentStatus === 'Error' ? 'error' : 'success'" size="small">
                    {{ agentStatus }}
                  </v-chip>
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item v-if="lastRunStatus">
                <v-list-item-title>Last Run</v-list-item-title>
                <v-list-item-subtitle>
                  <v-chip :color="lastRunStatus === 'Error' ? 'error' : 'primary'" size="small">
                    {{ lastRunStatus }}
                  </v-chip>
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Run configuration -->
    <v-row justify="center" class="mt-4">
      <v-col cols="12" md="8">
        <v-card :class="isDark ? 'theme--dark' : 'theme--light'" elevation="2">
          <v-card-title>
            <v-icon class="mr-2">mdi-tune</v-icon>
            Run Configuration
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="selectedScanId"
                  label="Scan ID"
                  placeholder="Enter scan ID to audit"
                  density="compact"
                  variant="outlined"
                  prepend-inner-icon="mdi-identifier"
                  type="number"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-select
                  v-model="auditMode"
                  :items="auditModes"
                  item-title="label"
                  item-value="value"
                  label="Audit Mode"
                  density="compact"
                  variant="outlined"
                  prepend-inner-icon="mdi-robot-outline"
                />
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12">
                <v-select
                  v-model="selectedCategories"
                  :items="vulnCategories"
                  label="Limit to categories (optional)"
                  density="compact"
                  variant="outlined"
                  multiple
                  chips
                  closable-chips
                  prepend-inner-icon="mdi-filter-outline"
                />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Agent output -->
    <v-row justify="center" class="mt-4" v-if="agentOutput">
      <v-col cols="12" md="8">
        <v-card :class="isDark ? 'theme--dark' : 'theme--light'" elevation="2">
          <v-card-title class="d-flex align-center justify-space-between">
            <span>
              <v-icon class="mr-2">mdi-text-box-outline</v-icon>
              Agent Output
            </span>
            <v-btn variant="text" size="small" prepend-icon="mdi-trash-can-outline" @click="agentOutput = ''">
              Clear
            </v-btn>
          </v-card-title>
          <v-divider />
          <v-card-text class="pa-0">
            <pre class="output-pre pa-4">{{ agentOutput }}</pre>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Pipeline overview -->
    <v-row justify="center" class="mt-4">
      <v-col cols="12" md="8">
        <v-card :class="isDark ? 'theme--dark' : 'theme--light'" elevation="2">
          <v-card-title>
            <v-icon class="mr-2">mdi-transit-connection-variant</v-icon>
            Audit Pipeline
          </v-card-title>
          <v-card-text>
            <v-timeline density="compact" side="end">
              <v-timeline-item
                v-for="step in pipelineSteps"
                :key="step.label"
                :dot-color="step.color"
                size="small"
              >
                <div class="text-subtitle-2">{{ step.label }}</div>
                <div class="text-caption text-medium-emphasis">{{ step.description }}</div>
              </v-timeline-item>
            </v-timeline>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-snackbar v-model="snackbar" :timeout="3000" :color="snackbarColor">
      {{ snackbarMessage }}
      <template v-slot:actions>
        <v-btn color="white" variant="text" @click="snackbar = false">Close</v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, watch } from 'vue';
import axios from 'axios';
import { useStore } from 'vuex';

const store = useStore();
const isDark = ref(store.state.isDark);

const agentStatus   = ref('');
const lastRunStatus = ref('');
const agentOutput   = ref('');
const selectedScanId      = ref('');
const selectedCategories  = ref([]);
const auditMode     = ref('full');
const isLoadingStatus = ref(false);
const isLoadingAudit  = ref(false);
const snackbar        = ref(false);
const snackbarMessage = ref('');
const snackbarColor   = ref('success');

const auditModes = [
  { label: 'Full audit — all vulnerabilities', value: 'full' },
  { label: 'Triage only — exported components', value: 'triage' },
  { label: 'False positive sweep', value: 'fp_sweep' },
];

const vulnCategories = ['Crypto', 'IPC', 'SQL', 'FileAbuse', 'Network', 'Logging', 'Intent'];

const pipelineSteps = [
  { label: 'Fetch scan summary',       description: 'get_scan_summary → overview of findings',              color: 'primary' },
  { label: 'Load manifest context',    description: 'get_manifest_context → exported components, permissions', color: 'primary' },
  { label: 'Iterate vulnerabilities',  description: 'get_vulnerabilities → prioritise by accessibility',     color: 'primary' },
  { label: 'Analyse taint trace',      description: 'get_taint_trace → call stack + Jimple IR + Java source', color: 'primary' },
  { label: 'Write verdict',            description: 'validate_vulnerability → TRUE_POSITIVE / FALSE_POSITIVE', color: 'success' },
];

const showSnackbar = (message, color = 'success') => {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  snackbar.value = true;
};

const checkAgentStatus = async () => {
  isLoadingStatus.value = true;
  try {
    const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/engine/agents/status`);
    agentStatus.value = response.data?.message ?? 'Online';
    showSnackbar(`Agent runner: ${agentStatus.value}`);
  } catch {
    agentStatus.value = 'Error';
    showSnackbar('Agent runner unreachable', 'error');
  } finally {
    isLoadingStatus.value = false;
  }
};

const runAuditAgent = async () => {
  if (!selectedScanId.value) return;
  isLoadingAudit.value = true;
  agentOutput.value = '';
  try {
    const payload = {
      scan_id: parseInt(selectedScanId.value),
      mode: auditMode.value,
      categories: selectedCategories.value.length ? selectedCategories.value : null,
    };
    const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/engine/agents/run`, payload);
    lastRunStatus.value = response.data?.status ?? 'Started';
    agentOutput.value   = JSON.stringify(response.data, null, 2);
    showSnackbar('Audit agent started');
  } catch (error) {
    lastRunStatus.value = 'Error';
    agentOutput.value   = error.response?.data?.message ?? 'Failed to start agent';
    showSnackbar('Failed to start audit agent', 'error');
  } finally {
    isLoadingAudit.value = false;
  }
};

watch(() => store.state.isDark, (newVal) => { isDark.value = newVal; });
</script>

<style scoped>
.theme--dark  { background-color: #121212; color: #ffffff; }
.theme--light { background-color: #ffffff; color: #000000; }
.btn-dark  { background-color: #424242; color: #ffffff; }
.btn-light { background-color: #f5f5f5; color: #000000; }
.output-pre {
  font-family: monospace;
  font-size: 0.82rem;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 400px;
  overflow-y: auto;
}
</style>
