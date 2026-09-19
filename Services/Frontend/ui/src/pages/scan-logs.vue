<template>
  <v-container :class="isDark ? 'theme--dark' : 'theme--light'">
    <v-row>
      <v-col cols="12">
        <v-card :class="isDark ? 'theme--dark' : 'theme--light'" elevation="2">
          <v-card-title class="d-flex align-center justify-space-between flex-wrap gap-2">
            <div class="d-flex align-center">
              <v-icon class="mr-2">mdi-text-box-search-outline</v-icon>
              Scan Logs
              <v-chip v-if="logPolling" color="success" size="x-small" class="ml-3">
                <v-icon start size="x-small">mdi-circle</v-icon>
                Live
              </v-chip>
            </div>

            <div class="d-flex align-center flex-wrap gap-2">
              <v-select
                v-model="logSource"
                :items="[{ title: 'Latest scan log', value: 'container' }, { title: 'Browse scans', value: 'scan' }]"
                item-title="title"
                item-value="value"
                density="compact"
                variant="outlined"
                hide-details
                style="min-width: 180px; max-width: 200px"
                @update:modelValue="onSourceChange"
              />
              <v-select
                v-if="logSource === 'scan'"
                v-model="logScanName"
                :items="availableScans"
                label="Select scan"
                density="compact"
                variant="outlined"
                hide-details
                :loading="scansLoading"
                no-data-text="No scans found"
                style="min-width: 220px; max-width: 320px"
                @update:modelValue="fetchLogs"
              />
              <v-btn
                v-if="logSource === 'scan'"
                icon="mdi-refresh"
                size="small"
                variant="text"
                :loading="scansLoading"
                title="Refresh scan list"
                @click="loadAvailableScans"
              />
              <v-select
                v-model="tailLines"
                :items="[100, 200, 300, 500, 1000]"
                label="Lines"
                density="compact"
                variant="outlined"
                hide-details
                style="max-width: 100px"
              />
              <v-btn
                :color="logPolling ? 'warning' : 'primary'"
                variant="tonal"
                size="small"
                :prepend-icon="logPolling ? 'mdi-pause' : 'mdi-play'"
                @click="toggleLogPolling"
              >
                {{ logPolling ? 'Pause' : 'Live' }}
              </v-btn>
              <v-btn variant="tonal" size="small" prepend-icon="mdi-refresh" @click="fetchLogs" :loading="logLoading">
                Refresh
              </v-btn>
              <v-btn variant="tonal" size="small" prepend-icon="mdi-trash-can-outline" @click="logContent = ''">
                Clear
              </v-btn>
            </div>
          </v-card-title>

          <v-divider />

          <v-card-text class="pa-0">
            <pre
              ref="logPre"
              class="log-output"
              :class="isDark ? 'log-output--dark' : 'log-output--light'"
            >{{ logContent || '— no output yet. Select a source and press Refresh or Live —' }}</pre>
          </v-card-text>

          <v-card-actions class="px-4 py-2">
            <span class="text-caption opacity-60">
              {{ logSource === 'container' ? 'Most recent scan log (auto-detected)' : `Scan: ${logScanName || '(none selected)'}` }}
              · last {{ tailLines }} lines · polls every 4s when live
            </span>
            <v-spacer />
            <v-btn variant="text" size="small" prepend-icon="mdi-arrow-down" @click="scrollToBottom">
              Bottom
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref, watch, nextTick, onUnmounted } from 'vue';
import axios from 'axios';
import { useStore } from 'vuex';

const store = useStore();
const isDark = ref(store.state.isDark);
watch(() => store.state.isDark, v => { isDark.value = v; });

const logSource = ref('container');
const logScanName = ref('');
const availableScans = ref([]);
const scansLoading = ref(false);
const tailLines = ref(300);
const logContent = ref('');
const logLoading = ref(false);
const logPolling = ref(false);
const logPre = ref(null);
let pollInterval = null;

const scrollToBottom = async () => {
  await nextTick();
  if (logPre.value) logPre.value.scrollTop = logPre.value.scrollHeight;
};

const loadAvailableScans = async () => {
  scansLoading.value = true;
  try {
    const resp = await axios.get(`${import.meta.env.VITE_APP_API_URL}/engine/scan/list`);
    availableScans.value = resp.data.scans || [];
    if (availableScans.value.length && !logScanName.value) {
      logScanName.value = availableScans.value[0];
    }
  } catch (e) {
    availableScans.value = [];
  } finally {
    scansLoading.value = false;
  }
};

const onSourceChange = (val) => {
  logContent.value = '';
  if (val === 'scan') loadAvailableScans();
};

const fetchLogs = async () => {
  logLoading.value = true;
  try {
    let url;
    if (logSource.value === 'container') {
      url = `${import.meta.env.VITE_APP_API_URL}/engine/container-logs?tail=${tailLines.value}`;
    } else {
      if (!logScanName.value) { logLoading.value = false; return; }
      url = `${import.meta.env.VITE_APP_API_URL}/engine/scan/logs/${encodeURIComponent(logScanName.value)}?tail=${tailLines.value}`;
    }
    const resp = await axios.get(url);
    logContent.value = resp.data.content || '';
    scrollToBottom();
  } catch (e) {
    logContent.value = `Error: ${e?.response?.data?.error || e.message}`;
  } finally {
    logLoading.value = false;
  }
};

const toggleLogPolling = () => {
  if (logPolling.value) {
    clearInterval(pollInterval);
    pollInterval = null;
    logPolling.value = false;
  } else {
    logPolling.value = true;
    fetchLogs();
    pollInterval = setInterval(fetchLogs, 4000);
  }
};

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval);
});
</script>

<style scoped>
.log-output {
  font-family: 'Fira Mono', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.6;
  padding: 16px;
  margin: 0;
  height: 65vh;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.log-output--dark {
  background: #0d0d0d;
  color: #c8f0a0;
}

.log-output--light {
  background: #1e1e1e;
  color: #d4d4d4;
}

.theme--dark {
  background-color: #121212;
  color: #ffffff;
}

.theme--light {
  background-color: #ffffff;
  color: #000000;
}
</style>
