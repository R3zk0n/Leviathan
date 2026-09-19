<template>
  <v-container class="pa-0">
    <v-card :class="{ 'theme--dark': isDark, 'theme--light': !isDark }" class="fill-height devices-card">
      <v-card-title :class="textColorClass" class="text-h5 d-flex align-center devices-header">
        Frida Devices
        <v-spacer></v-spacer>

        <v-btn icon @click="refreshDevices" class="mr-2" :loading="refreshing" title="Refresh Devices">
          <v-icon>mdi-refresh</v-icon>
        </v-btn>

        <!-- Existing Remote Attach Button -->
        <v-btn color="primary" variant="elevated" @click="openRemoteAttachDialog" title="Remote Attach">
          Remote Attach
        </v-btn>
      </v-card-title>

      <v-divider />
      <v-card-text>
        <v-alert v-if="error" type="error" dismissible @click:close="error = null">
          {{ error }}
        </v-alert>
        <v-progress-linear v-if="refreshing && !loading" indeterminate color="primary" class="mb-3" />
        <v-skeleton-loader v-if="loading" type="article, article, article"></v-skeleton-loader>

        <template v-else>
          <v-row class="mb-2" align="center">
            <v-col cols="12" md="6">
              <v-text-field
                v-model="deviceSearch"
                label="Search devices"
                prepend-inner-icon="mdi-magnify"
                variant="outlined"
                density="compact"
                hide-details
                clearable
                :dark="isDark"
              />
            </v-col>
            <v-col cols="12" md="6" class="d-flex justify-end align-center">
              <v-btn-toggle
                v-model="deviceTypeFilter"
                mandatory
                class="mr-2 device-type-toggle"
                :class="{ 'device-type-toggle--dark': isDark, 'device-type-toggle--light': !isDark }"
              >
                <v-btn size="small" value="all">All</v-btn>
                <v-btn size="small" value="local">Local</v-btn>
                <v-btn size="small" value="remote">Remote</v-btn>
              </v-btn-toggle>
              <v-chip variant="tonal" class="ml-2">{{ filteredDevices.length }} shown</v-chip>
            </v-col>
          </v-row>

          <template v-if="filteredDevices.length">
            <v-list :class="{ 'theme--dark': isDark, 'theme--light': !isDark }" class="devices-list">
              <v-list-item v-for="device in filteredDevices" :key="device.id" :class="listItemClass">
              <v-list-item-icon class="mr-3 my-2">
                <v-icon :color="getDeviceColor(device.type)">{{ getDeviceIcon(device.type) }}</v-icon>
              </v-list-item-icon>

              <v-list-item-content>
                <v-list-item-title :class="textColorClass">{{ device.name }}</v-list-item-title>
                <v-list-item-subtitle :class="textColorClass">
                  ID: {{ device.id }} | OS: {{ device.os }} | User: {{ device.user || 'N/A' }}
                </v-list-item-subtitle>
              </v-list-item-content>

              <v-spacer></v-spacer>

              <v-list-item-action class="d-flex flex-row align-center device-actions">
                <v-chip :color="getDeviceColor(device.type)" class="mr-2" size="small" variant="flat">
                  {{ device.type }}
                </v-chip>
                <v-btn
                  v-if="device.type !== 'remote'"
                  color="primary"
                  variant="tonal"
                  size="small"
                  @click="attachToDevice(device)"
                  class="mr-2"
                  :loading="device.attaching"
                >
                  <v-icon left>mdi-link-variant</v-icon>
                  Attach
                </v-btn>
                <v-btn color="secondary" variant="tonal" size="small" @click="listProcesses(device)" class="mr-2">
                  <v-icon left>mdi-format-list-bulleted</v-icon>
                  List Processes
                </v-btn>
                <v-btn color="success" variant="tonal" size="small" @click="openSpawnAppDialog(device)" class="mr-2">
                  <v-icon left>mdi-rocket-launch</v-icon>
                  Spawn App
                </v-btn>
                <v-btn
                  v-if="device.type === 'remote'"
                  color="error"
                  variant="tonal"
                  size="small"
                  @click="detachFromDevice(device)"
                  :loading="device.detaching"
                >
                  <v-icon left>mdi-link-off</v-icon>
                  Detach
                </v-btn>
              </v-list-item-action>
            </v-list-item>
          </v-list>
          </template>

          <div v-else class="empty-state pa-8 text-center">
            <v-icon size="56" class="mb-3" :color="isDark ? 'grey-lighten-1' : 'grey-darken-1'">mdi-devices</v-icon>
            <div class="text-h6 mb-1" :class="textColorClass">No Frida devices found</div>
            <div class="text-body-2 mb-4" :class="textColorClass">Try refreshing or remote attach.</div>
            <v-btn color="primary" variant="tonal" @click="refreshDevices" :loading="refreshing">
              <v-icon left>mdi-refresh</v-icon>
              Refresh
            </v-btn>
          </div>
        </template>
      </v-card-text>
    </v-card>

    <RemoteAttachDialog
      v-model="remoteAttachDialog"
      :attaching="attaching"
      @attach="attachToRemoteDevice"
    />
    <SpawnAppDialog
      v-model="spawnAppDialog"
      :device="selectedDeviceForSpawn"
      :session-id="sessionId"
      @spawned="spawnAndAttachToApp"
      @error="(errorMsg) => snackbar = { show: true, text: errorMsg, color: 'error' }"
    />

    <FridaREPLDialog
      v-model="replDialog"
      :device-id="selectedDevice ? selectedDevice.id : ''"
      :device-name="selectedDevice ? selectedDevice.name : ''"
      :session-id="sessionId"
      :pid="selectedPid"
      :os-type="selectedDevice ? selectedDevice.os : 'Unknown'"
      :paused="spawnPaused"
    />

    <DownloadProgressDialog
      :show="downloadDialog"
      @update:show="downloadDialog = $event"
      :file-name="downloadFileName"
      :file-type="downloadFileType"
      :progress="downloadProgress"
      :bytes-received="downloadBytesReceived"
      :total-bytes="downloadTotalBytes"
    />

    <!-- Processes List Dialog -->
    <v-dialog v-model="processesDialog" fullscreen hide-overlay transition="dialog-bottom-transition">
      <v-card :class="{ 'theme--dark': isDark, 'theme--light': !isDark }">
        <v-toolbar :color="isDark ? 'grey darken-3' : 'primary'">
          <v-btn icon @click="processesDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
          <v-toolbar-title>
            <v-card-title class="headline">Running Processes on {{ selectedDevice ? selectedDevice.name : '' }} ({{ selectedDevice ? selectedDevice.os : 'Unknown' }})</v-card-title>
          </v-toolbar-title>
          <v-spacer></v-spacer>
          <v-btn-toggle v-model="processFilter" mandatory class="mr-2">
            <v-btn small value="all">
              <v-icon left small>mdi-apps</v-icon>
              All
            </v-btn>
            <v-btn small value="user">
              <v-icon left small>mdi-account</v-icon>
              User Apps
            </v-btn>
            <v-btn small value="system">
              <v-icon left small>mdi-shield</v-icon>
              System
            </v-btn>
          </v-btn-toggle>
          <v-text-field
            v-model="searchQuery"
            append-icon="mdi-magnify"
            label="Search processes"
            single-line
            hide-details
            :dark="isDark"
            style="max-width: 300px;"
          ></v-text-field>
          <v-btn icon @click="refreshProcesses" class="ml-2">
            <v-icon>mdi-refresh</v-icon>
          </v-btn>
        </v-toolbar>

        <!-- Loading spinner -->
        <v-container v-if="loadingProcesses" class="d-flex justify-center align-center" style="height: 300px;">
          <v-progress-circular indeterminate color="primary" :size="70" :width="7"></v-progress-circular>
        </v-container>

        <v-list v-else :class="{ 'theme--dark': isDark, 'theme--light': !isDark }" class="processes-list">
          <v-list-item
            v-for="process in filteredProcesses"
            :key="process.pid"
            :class="['process-list-item', listItemClass]"
            @mouseenter="process.hover = true"
            @mouseleave="process.hover = false"
          >
            <!-- Enhanced icon section with larger icons -->
            <v-list-item-avatar size="48" class="mr-4 my-3">
              <!-- Display image if icon is a base64 data URL -->
              <div
                v-if="process.icon && process.icon.startsWith('data:image/')"
                class="process-icon-container-large"
              >
                <img
                  :src="process.icon"
                  alt="Process Icon"
                  class="process-icon-image-large"
                  @error="handleIconError(process)"
                />
              </div>
              <!-- Display Material Design icon if it's an MDI icon name -->
              <v-icon
                v-else-if="process.icon && process.icon.startsWith('mdi-')"
                :color="getProcessColor(process)"
                size="48"
              >
                {{ process.icon }}
              </v-icon>
              <!-- Default fallback icon -->
              <v-icon
                v-else
                :color="getProcessColor(process)"
                size="48"
              >
                mdi-application
              </v-icon>
            </v-list-item-avatar>

            <v-list-item-content>
              <v-list-item-title :class="textColorClass" class="text-subtitle-1 font-weight-medium mb-1">
                {{ process.name }}
              </v-list-item-title>
              <v-list-item-subtitle :class="textColorClass" class="text-body-2">
                {{ process.identifier }}
              </v-list-item-subtitle>
              <v-list-item-subtitle :class="textColorClass" class="text-caption mt-1 d-flex align-center">
                <span class="mr-3">PID: {{ process.pid }}</span>
                <span v-if="process.user" class="mr-2">User: {{ process.user }}</span>
                <v-chip
                  v-if="isSystemUser(process.user)"
                  x-small
                  :color="isDark ? 'cyan darken-1' : 'indigo darken-2'"
                  dark
                >
                  SYSTEM
                </v-chip>
              </v-list-item-subtitle>
            </v-list-item-content>

            <v-list-item-action class="d-flex flex-row align-center my-0">
              <v-btn color="primary" small @click="attachToProcess(process)" class="mr-2">
                <v-icon left small>mdi-link-variant</v-icon>
                ATTACH
              </v-btn>
              <v-btn color="secondary" small @click="pullFromProcess(process)">
                <v-icon left small>mdi-download</v-icon>
                PULL
              </v-btn>
            </v-list-item-action>
          </v-list-item>
        </v-list>
      </v-card>
    </v-dialog>

    <!-- Snackbar for messages -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="3000">
      {{ snackbar.text }}
      <template v-slot:action="{ attrs }">
        <v-btn text v-bind="attrs" @click="snackbar.show = false">Close</v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useStore } from 'vuex';
import axios from 'axios';
import RemoteAttachDialog from './Dialogs/RemoteAttachDialog.vue';
import FridaREPLDialog from './Dialogs/FridaREPLDialog.vue';
import SpawnAppDialog from "@/components/Frida/Dialogs/SpawnAppDialog.vue";
import DownloadProgressDialog from "@/components/Frida/Dialogs/DownloadProgressDialog.vue";
import { newSessionId } from '@/utils/frida';

const apiUrl = import.meta.env.VITE_APP_API_URL || window.location.origin;

// Store and UI variables
const store = useStore();
const isDark = computed(() => store.state.isDark);
const downloadFileType = ref('File');

const REQUEST_TIMEOUT_MS = 12_000;

const formatAxiosErrorMessage = (err, fallbackMessage) => {
  if (err?.code === 'ECONNABORTED') {
    return 'Request timed out. Please try again.';
  }

  const status = err?.response?.status;
  const apiMessage = err?.response?.data?.message || err?.response?.data?.error;

  if (status === 503) {
    return apiMessage || 'Frida service is unavailable (503). Please ensure the backend/Frida service is running.';
  }

  if (apiMessage) {
    return apiMessage;
  }

  return fallbackMessage;
};

// Frida devices state
const devices = ref([]);
const loading = ref(true);
const refreshing = ref(false);
const error = ref(null);
const remoteAttachDialog = ref(false);
const selectedDevice = ref(null);
const spawnAppDialog = ref(false);
const selectedDeviceForSpawn = ref(null);
const attaching = ref(false);
const snackbar = ref({ show: false, text: '', color: 'success' });
const processesDialog = ref(false);
const processes = ref([]);
const searchQuery = ref('');
const processFilter = ref('all');
const replDialog = ref(false);
// Overwritten on every attach/spawn with a fresh id; seeded so it's never 'default'.
const sessionId = ref(newSessionId());
// True only for a spawn-gated (paused) spawn, so the REPL defers auto-init + shows Resume.
const spawnPaused = ref(false);
const selectedPid = ref(null);
const loadingProcesses = ref(false);
const downloadDialog = ref(false);
const downloadProgress = ref(0);
const downloadFileName = ref('');
const downloadBytesReceived = ref(0);
const downloadTotalBytes = ref(0);

// Device filtering (UX)
const deviceSearch = ref('');
const deviceTypeFilter = ref('all');

const filteredDevices = computed(() => {
  const query = (deviceSearch.value || '').trim().toLowerCase();
  return devices.value
    .filter(device => (deviceTypeFilter.value === 'all' ? true : device.type === deviceTypeFilter.value))
    .filter(device => {
      if (!query) return true;
      const haystack = [device.name, device.id, device.os, device.user, device.type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
});

// Computed properties
const textColorClass = computed(() => ({
  'white--text': isDark.value,
  'black--text': !isDark.value
}));

const listItemClass = computed(() => ({
  'theme--dark': isDark.value,
  'theme--light': !isDark.value
}));

const filteredProcesses = computed(() => {
  let filtered = processes.value;

  // Apply process type filter (all/user/system)
  if (processFilter.value === 'system') {
    filtered = filtered.filter(process => isSystemUser(process.user));
  } else if (processFilter.value === 'user') {
    filtered = filtered.filter(process => !isSystemUser(process.user));
  }

  // Apply search filter
  if (searchQuery.value) {
    filtered = filtered.filter(process =>
      process.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      process.pid.toString().includes(searchQuery.value) ||
      (process.identifier && process.identifier.toLowerCase().includes(searchQuery.value.toLowerCase())) ||
      (process.user && process.user.toLowerCase().includes(searchQuery.value.toLowerCase()))
    );
  }

  return filtered;
});

// Device management functions
let fetchDevicesPromise = null;
const fetchDevices = async ({ showLoading = true } = {}) => {
  if (fetchDevicesPromise) return fetchDevicesPromise;

  if (showLoading) {
    loading.value = true;
  }
  error.value = null;

  fetchDevicesPromise = (async () => {
    try {
      const response = await axios.get(`${apiUrl}/frida/list`, {
        timeout: REQUEST_TIMEOUT_MS
      });
      devices.value = (response.data.devices || []).map(device => ({
        ...device,
        attached: device.type === 'remote',
        attaching: false,
        detaching: false,
        osType: device.os
      }));
    } catch (err) {
      console.error('Error fetching Frida devices:', err);
      error.value = formatAxiosErrorMessage(err, 'Failed to fetch Frida devices. Please try again.');
    } finally {
      if (showLoading) {
        loading.value = false;
      }
      fetchDevicesPromise = null;
    }
  })();

  return fetchDevicesPromise;
};

const refreshDevices = async () => {
  refreshing.value = true;
  try {
    await fetchDevices({ showLoading: false });
    snackbar.value = { show: true, text: 'Device list refreshed', color: 'success' };
  } catch (err) {
    snackbar.value = { show: true, text: 'Failed to refresh device list', color: 'error' };
  } finally {
    refreshing.value = false;
  }
};

// Icon and color helper functions
const getDeviceIcon = (type) => {
  switch (type) {
    case 'local': return 'mdi-desktop-classic';
    case 'remote': return 'mdi-remote-desktop';
    default: return 'mdi-devices';
  }
};

const handleIconError = (process) => {
  console.warn(`Failed to load icon for process: ${process.name}`);
  // Set icon to default MDI icon on error
  process.icon = 'mdi-application';
};

const getDeviceColor = (type) => {
  switch (type) {
    case 'local': return 'primary';
    case 'remote': return 'secondary';
    default: return 'grey';
  }
};

const getProcessColor = (process) => {
  return 'primary';
};

const isSystemUser = (user) => {
  if (!user) return false;

  // Common Android/iOS system users
  const systemUsers = [
    'root', 'system', 'radio', 'bluetooth', 'nfc', 'shell',
    'wifi', 'media', 'audioserver', 'cameraserver', 'keystore',
    'drm', 'gps', 'media_rw', 'nobody', 'mobile', 'daemon'
  ];

  // Check if user is in system users list (case-insensitive)
  return systemUsers.some(sysUser => user.toLowerCase() === sysUser);
};

// Device interaction methods
const detachFromDevice = async (device) => {
  device.detaching = true;
  try {
    const response = await axios.post(
      `${apiUrl}/frida/detach`,
      { device_id: device.id },
      { timeout: REQUEST_TIMEOUT_MS }
    );
    if (response.data.status === 'success') {
      snackbar.value = { show: true, text: `Successfully detached from device ${device.name}`, color: 'success' };
      setTimeout(async () => {
        await refreshDevices();
      }, 1000);
    } else {
      throw new Error(response.data.message);
    }
  } catch (err) {
    console.error('Error detaching from device:', err);
    snackbar.value = { show: true, text: formatAxiosErrorMessage(err, `Failed to detach: ${err.message}`), color: 'error' };
  } finally {
    device.detaching = false;
  }
};

const openRemoteAttachDialog = () => {
  console.log('Opening remote attach dialog');
  remoteAttachDialog.value = true;
};

const attachToRemoteDevice = async ({ host, port }) => {
  console.log(`Attempting to attach to remote device: ${host}:${port}`);
  attaching.value = true;
  try {
    const response = await axios.post(
      `${apiUrl}/frida/attach-remote`,
      { host, port },
      { timeout: REQUEST_TIMEOUT_MS }
    );
    console.log('Remote attach response:', response.data);
    if (response.data.status === 'success') {
      snackbar.value = { show: true, text: `Successfully attached to remote device ${host}:${port}`, color: 'success' };
      remoteAttachDialog.value = false;
      await refreshDevices();
    } else {
      throw new Error(response.data.message);
    }
  } catch (err) {
    console.error('Error attaching to remote device:', err);
    const timeoutMsg = 'Remote attach timed out. Please check the IP/port and try again.';
    const message = err?.code === 'ECONNABORTED'
      ? timeoutMsg
      : formatAxiosErrorMessage(err, `Failed to attach: ${err.message}`);
    snackbar.value = { show: true, text: message, color: 'error' };
  } finally {
    attaching.value = false;
  }
};

const listProcesses = async (device) => {
  selectedDevice.value = device;
  processesDialog.value = true;
  loadingProcesses.value = true;
  try {
    const response = await axios.get(`${apiUrl}/frida/applications/${device.id}`, {
      timeout: REQUEST_TIMEOUT_MS
    });
    if (response.data.status === 'success') {
      processes.value = response.data.processes.map(process => ({
        ...process,
        icon: process.icon || null,
        hover: false
      }));
    } else {
      throw new Error(response.data.message);
    }
  } catch (err) {
    console.error('Error fetching processes:', err);
    snackbar.value = { show: true, text: formatAxiosErrorMessage(err, `Failed to fetch processes: ${err.message}`), color: 'error' };
    processesDialog.value = false;
  } finally {
    loadingProcesses.value = false;
  }
};

const refreshProcesses = async () => {
  if (!selectedDevice.value) return;
  loadingProcesses.value = true;
  try {
    const response = await axios.get(`${apiUrl}/frida/applications/${selectedDevice.value.id}`, {
      timeout: REQUEST_TIMEOUT_MS
    });
    if (response.data.status === 'success') {
      processes.value = response.data.processes.map(process => ({
        ...process,
        icon: process.icon || null,
        hover: false
      }));
      snackbar.value = { show: true, text: 'Process list refreshed', color: 'success' };
    } else {
      throw new Error(response.data.message);
    }
  } catch (err) {
    console.error('Error refreshing processes:', err);
    snackbar.value = { show: true, text: formatAxiosErrorMessage(err, `Failed to refresh processes: ${err.message}`), color: 'error' };
  } finally {
    loadingProcesses.value = false;
  }
};

const attachToDevice = async (device, pid = null) => {
  device.attaching = true;
  try {
    const response = await axios.post(
      `${apiUrl}/frida/attach`,
      { device_id: device.id, pid: pid },
      { timeout: REQUEST_TIMEOUT_MS }
    );
    if (response.data.status === 'success') {
      snackbar.value = { show: true, text: `Successfully attached to ${pid ? 'process' : 'device'} ${pid || device.name}`, color: 'success' };
      device.attached = true;
      // /frida/attach doesn't mint an id; generate one client-side so execute + the
      // hook stream share one real session (never 'default', which collided across
      // attaches and left the SSE guard falsy so the stream never opened).
      sessionId.value = response.data.session_id || newSessionId();
      selectedDevice.value = device;
      selectedPid.value = pid;
      spawnPaused.value = false;  // attach targets an already-running process
      replDialog.value = true;
    } else {
      throw new Error(response.data.message);
    }
  } catch (err) {
    console.error('Error attaching:', err);
    snackbar.value = { show: true, text: formatAxiosErrorMessage(err, `Failed to attach: ${err.message}`), color: 'error' };
  } finally {
    device.attaching = false;
  }
};

const openSpawnAppDialog = (device) => {
  selectedDeviceForSpawn.value = device;
  spawnAppDialog.value = true;
};

const spawnAndAttachToApp = async (spawnInfo) => {
  try {
    console.log('Spawn info:', spawnInfo);
    snackbar.value = { show: true, text: `Successfully spawned app with PID: ${spawnInfo.pid}`, color: 'success' };

    selectedDevice.value = devices.value.find(d => d.id === spawnInfo.deviceId);
    selectedPid.value = spawnInfo.pid;
    sessionId.value = spawnInfo.sessionId;
    spawnPaused.value = spawnInfo.paused === true;

    replDialog.value = true;
  } catch (err) {
    console.error('Error in spawn and attach:', err);
    snackbar.value = { show: true, text: `Failed to spawn app: ${err.message}`, color: 'error' };
  }
};

const pullFromProcess = async (process) => {
  console.log('Pulling from process:', process);
  try {
    downloadFileName.value = process.name;
    downloadFileType.value = 'File';
    downloadProgress.value = 0;
    downloadBytesReceived.value = 0;
    downloadTotalBytes.value = 0;
    downloadDialog.value = true;

    const pullResponse = await axios.post(
      `${apiUrl}/frida/pull`,
      {
        device_id: selectedDevice.value.id,
        pid: process.pid,
        os_type: selectedDevice.value.os,
      },
      { timeout: REQUEST_TIMEOUT_MS }
    );

    if (pullResponse.data.status === 'success' && pullResponse.data.download_id) {
      downloadFileType.value = pullResponse.data.file_type;
      const downloadUrl = `${apiUrl}/frida/download/${pullResponse.data.download_id}`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      const [identifier] = Object.keys(pullResponse.data.file);
      link.download = `${identifier}.${pullResponse.data.file_type.toLowerCase()}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      snackbar.value = {
        show: true,
        text: `Successfully pulled ${pullResponse.data.file_type}`,
        color: 'success',
        timeout: 5000
      };
    } else {
      throw new Error(pullResponse.data.message || 'Unknown error occurred during pull operation');
    }
  } catch (err) {
    console.error('Error pulling from process:', err);
    snackbar.value = {
      show: true,
      text: formatAxiosErrorMessage(err, `Failed to pull from process: ${err.response?.data?.message || err.message}`),
      color: 'error',
      timeout: 5000
    };
  } finally {
    setTimeout(() => {
      downloadDialog.value = false;
    }, 1000);
  }
};

const attachToProcess = async (process) => {
  if (!selectedDevice.value) return;
  try {
    await attachToDevice(selectedDevice.value, process.pid);
    processesDialog.value = false;
  } catch (err) {
    console.error('Error attaching to process:', err);
    snackbar.value = { show: true, text: `Failed to attach to process: ${err.message}`, color: 'error' };
  }
};

// Lifecycle hooks
onMounted(() => {
  fetchDevices({ showLoading: true });
});
</script>

<style scoped>

.devices-card {
  border-radius: 16px;
}

.devices-header {
  padding-top: 20px;
  padding-bottom: 16px;
}

.devices-list {
  padding: 8px;
}

/* Card-like device rows */
.devices-list :deep(.v-list-item) {
  border-radius: 12px;
  margin: 6px 4px;
  border: 1px solid transparent;
  transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
}

.theme--light .devices-list :deep(.v-list-item) {
  background: #ffffff;
  border-color: rgba(0, 0, 0, 0.10);
}

.theme--dark .devices-list :deep(.v-list-item) {
  background: #1f1f1f;
  border-color: rgba(255, 255, 255, 0.10);
}

.devices-list :deep(.v-list-item:hover) {
  transform: translateY(-1px);
}

.theme--light .devices-list :deep(.v-list-item:hover) {
  border-color: rgba(25, 118, 210, 0.35);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
}

.theme--dark .devices-list :deep(.v-list-item:hover) {
  border-color: rgba(25, 118, 210, 0.45);
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.35);
}

.device-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.empty-state {
  border-radius: 14px;
}

.theme--light .empty-state {
  background: #fafafa;
  border: 1px dashed rgba(0, 0, 0, 0.15);
}

.theme--dark .empty-state {
  background: rgba(255, 255, 255, 0.04);
  border: 1px dashed rgba(255, 255, 255, 0.14);
}

/* Enhanced process list styles - matching app theme */
.processes-list {
  padding: 8px;
  background-color: transparent;
}

.theme--light .processes-list {
  background-color: #fafafa;
}

.theme--dark .processes-list {
  background-color: #1E1E1E;
}

.process-list-item {
  border-radius: 8px;
  margin-bottom: 4px;
  padding: 12px 16px !important;
  transition: all 0.2s ease;
  min-height: 80px;
  border: 1px solid transparent;
}

.theme--light .process-list-item {
  background-color: #ffffff;
  border-color: #e0e0e0;
}

.theme--dark .process-list-item {
  background-color: #2a2a2a;
  border-color: #424242;
}

.process-list-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.theme--dark .process-list-item:hover {
  background-color: #333333;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
}

.theme--light .process-list-item:hover {
  background-color: #f5f5f5;
  border-color: #1976d2;
}

/* Large icon container for 48px icons */
.process-icon-container-large {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 8px;
  overflow: hidden;
}

.process-icon-image-large {
  width: 48px;
  height: 48px;
  object-fit: contain;
  border-radius: 8px;
  background-color: transparent;
}

/* Device filter toggle (All/Local/Remote) */
.device-type-toggle {
  border-radius: 10px;
  overflow: hidden;
}

.device-type-toggle--light {
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.12);
}

.device-type-toggle--dark {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.14);
}

/* Ensure toggle button labels/icons stay readable in dark mode */
.device-type-toggle--dark :deep(.v-btn) {
  background: transparent;
  color: rgba(255, 255, 255, 0.85);
}

.device-type-toggle--dark :deep(.v-btn .v-btn__content),
.device-type-toggle--dark :deep(.v-btn .v-icon) {
  color: inherit;
}

.device-type-toggle--dark :deep(.v-btn + .v-btn) {
  border-left: 1px solid rgba(255, 255, 255, 0.10);
}

.device-type-toggle--dark :deep(.v-btn--active) {
  background: rgba(25, 118, 210, 0.35);
  color: rgba(255, 255, 255, 0.95);
}

.device-type-toggle--dark :deep(.v-btn--active .v-btn__overlay) {
  opacity: 0;
}

.device-type-toggle--light :deep(.v-btn--active) {
  background: rgba(25, 118, 210, 0.12);
}

/* Legacy small icon support (kept for compatibility) */
.process-icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.process-icon-image {
  width: 24px;
  height: 24px;
  object-fit: contain;
  border-radius: 2px;
  background-color: transparent;
}

/* Ensure consistent icon sizing */
.v-list-item-icon {
  min-width: 24px !important;
  width: 24px !important;
  height: 24px !important;
}

.v-list-item-icon .v-icon {
  font-size: 20px;
}

.theme--dark.v-card {
  background-color: #121212;
}

.theme--dark .v-list {
  background-color: #1E1E1E;
}

.theme--light .v-list {
  background-color: #FFFFFF;
}

.theme--dark .v-list-item {
  border-bottom-color: rgba(255, 255, 255, 0.12);
}

.theme--light .v-list-item {
  border-bottom-color: rgba(0, 0, 0, 0.12);
}

.fill-height {
  height: 100%;
}

.white--text {
  color: white !important;
}

.black--text {
  color: black !important;
}

.v-list-item-avatar {
  min-width: 24px !important;
  width: 24px !important;
  height: 24px !important;
}

.v-list-item-avatar .v-icon {
  font-size: 20px;
}

.v-list-item-avatar .v-image {
  border-radius: 2px;
}

.v-list-item {
  padding: 4px 16px;
}

.v-list-item__content {
  padding: 4px 0;
}

.v-list-item__title {
  font-size: 14px !important;
  line-height: 1.2 !important;
}

.v-list-item__subtitle {
  font-size: 12px !important;
}

.v-btn.x-small {
  font-size: 10px;
  height: 24px;
  min-width: 50px;
  padding: 0 8px;
}

.success--text {
  color: #4caf50 !important;
}

.warning--text {
  color: #ff9800 !important;
}

.error--text {
  color: #f44336 !important;
}

.process-icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
