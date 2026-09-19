<template>
  <v-container :class="isDark ? 'theme--dark' : 'theme--light'">
    <v-row justify="center">
      <v-col cols="auto">
        <v-btn
          @click="checkEngineStatus"
          :loading="isLoadingEngine"
          :disabled="isLoadingEngine"
          :class="isDark ? 'btn-dark' : 'btn-light'"
          height="72"
          min-width="164"
          prepend-icon="mdi-engine"
        >
          Check Engine Status
        </v-btn>
      </v-col>
      <v-col cols="auto">
        <v-btn
          @click="checkJadxStatus"
          :loading="isLoadingJadx"
          :disabled="isLoadingJadx"
          :class="isDark ? 'btn-dark' : 'btn-light'"
          height="72"
          min-width="164"
          prepend-icon="mdi-code-braces"
        >
          Check JADX Version
        </v-btn>
      </v-col>
      <v-col cols="auto">
        <v-btn
          @click="checkTrufflehogVersion"
          :loading="isLoadingTrufflehog"
          :disabled="isLoadingTrufflehog"
          :class="isDark ? 'btn-dark' : 'btn-light'"
          height="72"
          min-width="164"
          prepend-icon="mdi-magnify"
        >
          Check TruffleHog Version
        </v-btn>
      </v-col>
      <v-col cols="auto">
        <v-btn
          @click="checkMcpStatus"
          :loading="isLoadingMcp"
          :disabled="isLoadingMcp"
          :class="isDark ? 'btn-dark' : 'btn-light'"
          height="72"
          min-width="164"
          prepend-icon="mdi-server-network"
        >
          Check MCP Status
        </v-btn>
      </v-col>
      <v-col cols="auto">
        <v-btn
          @click="checkAgentsStatus"
          :loading="isLoadingAgents"
          :disabled="isLoadingAgents"
          :class="isDark ? 'btn-dark' : 'btn-light'"
          height="72"
          min-width="164"
          prepend-icon="mdi-robot"
        >
          Check Agents Status
        </v-btn>
      </v-col>
    </v-row>

    <!-- Status Display Section -->
    <v-row justify="center" class="mt-5">
      <v-col cols="12" md="8">
        <v-card :class="isDark ? 'theme--dark' : 'theme--light'" elevation="2">
          <v-card-title class="text-center">Engine Status</v-card-title>
          <v-card-text>
            <v-list :class="isDark ? 'theme--dark' : 'theme--light'">
              <v-list-item v-if="engineStatus">
                <v-list-item-content>
                  <v-list-item-title>Engine Status</v-list-item-title>
                  <v-list-item-subtitle>
                    <v-chip
                      :color="engineStatus === 'Error' ? 'error' : 'success'"
                      small
                    >
                      {{ engineStatus }}
                    </v-chip>
                  </v-list-item-subtitle>
                </v-list-item-content>
              </v-list-item>
              <v-list-item v-if="jadxVersion">
                <v-list-item-content>
                  <v-list-item-title>JADX Version</v-list-item-title>
                  <v-list-item-subtitle>
                    <v-chip
                      :color="jadxVersion === 'Error' ? 'error' : 'success'"
                      small
                    >
                      {{ jadxVersion }}
                    </v-chip>
                  </v-list-item-subtitle>
                </v-list-item-content>
              </v-list-item>
              <v-list-item v-if="trufflehogVersion">
                <v-list-item-content>
                  <v-list-item-title>TruffleHog Version</v-list-item-title>
                  <v-list-item-subtitle>
                    <v-chip
                      :color="trufflehogVersion === 'Error' ? 'error' : 'success'"
                      small
                    >
                      {{ trufflehogVersion }}
                    </v-chip>
                  </v-list-item-subtitle>
                </v-list-item-content>
              </v-list-item>
              <v-list-item v-if="mcpStatus">
                <v-list-item-content>
                  <v-list-item-title>MCP Server</v-list-item-title>
                  <v-list-item-subtitle>
                    <v-chip :color="mcpStatus === 'Error' ? 'error' : 'success'" small>
                      {{ mcpStatus }}
                    </v-chip>
                  </v-list-item-subtitle>
                </v-list-item-content>
              </v-list-item>
              <v-list-item v-if="agentsStatus">
                <v-list-item-content>
                  <v-list-item-title>Agents</v-list-item-title>
                  <v-list-item-subtitle>
                    <v-chip :color="agentsStatus === 'Error' ? 'error' : 'success'" small>
                      {{ agentsStatus }}
                    </v-chip>
                  </v-list-item-subtitle>
                </v-list-item-content>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row justify="center" class="mt-5">
      <JADX/>
    </v-row>

    <!-- Snackbar for notifications -->
    <v-snackbar
      v-model="snackbar"
      :timeout="3000"
      :color="snackbarColor"
    >
      {{ snackbarMessage }}
      <template v-slot:actions>
        <v-btn
          color="white"
          text
          @click="snackbar = false"
        >
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, watch } from 'vue';
import axios from 'axios';
import { useStore } from 'vuex';
import JADX from "@/components/Engine/JADX.vue";

const store = useStore();
const engineStatus = ref('');
const jadxVersion = ref('');
const trufflehogVersion = ref('');
const errorMessage = ref('');
const snackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('success');
const isDark = ref(store.state.isDark);

// Loading states
const isLoadingEngine = ref(false);
const isLoadingJadx = ref(false);
const isLoadingTrufflehog = ref(false);
const isLoadingMcp = ref(false);
const isLoadingAgents = ref(false);

const mcpStatus = ref('');
const agentsStatus = ref('');

const showSnackbar = (message, color = 'success') => {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  snackbar.value = true;
};

const checkEngineStatus = async () => {
  isLoadingEngine.value = true;
  try {
    const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/engine/status`);
    if (response.data && response.data.message) {
      engineStatus.value = response.data.message;
      showSnackbar(`Engine Status: ${response.data.message}`);
      errorMessage.value = '';
    } else {
      throw new Error('Invalid response format');
    }
  } catch (error) {
    console.error('Error fetching engine status:', error);
    errorMessage.value = 'Error fetching engine status';
    showSnackbar('Error fetching engine status', 'error');
    engineStatus.value = 'Error';
  } finally {
    isLoadingEngine.value = false;
  }
};

const checkJadxStatus = async () => {
  isLoadingJadx.value = true;
  try {
    const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/engine/version`);
    if (response.data && response.data.output) {
      jadxVersion.value = response.data.output;
      showSnackbar(`JADX Version: ${response.data.output}`);
    } else {
      throw new Error('Invalid response format');
    }
  } catch (error) {
    console.error('Error fetching JADX status:', error);
    jadxVersion.value = 'Error';
    showSnackbar('Error fetching JADX version', 'error');
  } finally {
    isLoadingJadx.value = false;
  }
};

const checkTrufflehogVersion = async () => {
  isLoadingTrufflehog.value = true;
  try {
    const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/engine/trufflehog/version`);
    console.log('Trufflehog response:', response.data); // Debug log

    // Handle the nested response structure
    if (response.data.output && response.data.output.version) {
      trufflehogVersion.value = response.data.output.version;
      showSnackbar(`TruffleHog Version: ${response.data.output.version}`);
    } else if (response.data.output && response.data.output.status === 'success') {
      // Alternative path if version is not directly available
      trufflehogVersion.value = 'Available';
      showSnackbar('TruffleHog is available');
    } else {
      throw new Error('Unexpected response format');
    }
  } catch (error) {
    console.error('Error fetching TruffleHog version:', error);
    trufflehogVersion.value = 'Error';
    showSnackbar('Error fetching TruffleHog version', 'error');
  } finally {
    isLoadingTrufflehog.value = false;
  }
};

const checkMcpStatus = async () => {
  isLoadingMcp.value = true;
  try {
    const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/engine/mcp/status`);
    mcpStatus.value = response.data?.message ?? 'Online';
    showSnackbar(`MCP Server: ${mcpStatus.value}`);
  } catch {
    mcpStatus.value = 'Error';
    showSnackbar('MCP server unreachable', 'error');
  } finally {
    isLoadingMcp.value = false;
  }
};

const checkAgentsStatus = async () => {
  isLoadingAgents.value = true;
  try {
    const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/engine/agents/status`);
    agentsStatus.value = response.data?.message ?? 'Online';
    showSnackbar(`Agents: ${agentsStatus.value}`);
  } catch {
    agentsStatus.value = 'Error';
    showSnackbar('Agents runner unreachable', 'error');
  } finally {
    isLoadingAgents.value = false;
  }
};

// Watch for dark mode changes
watch(() => store.state.isDark, (newVal) => {
  isDark.value = newVal;
});

// Auto-hide snackbar
watch(() => snackbar.value, (newVal) => {
  if (newVal) {
    setTimeout(() => {
      snackbar.value = false;
    }, 3000);
  }
});

// Initial status check on mount
checkEngineStatus();
</script>

<style scoped>
.error {
  color: red;
}


.theme--dark {
  background-color: #121212;
  color: #ffffff;
}

.theme--light {
  background-color: #ffffff;
  color: #000000;
}

.btn-dark {
  background-color: #424242;
  color: #ffffff;
}

.btn-light {
  background-color: #f5f5f5;
  color: #000000;
}

.v-card {
  margin-bottom: 20px;
}

.v-list-item {
  padding: 12px;
}

.v-list-item-title {
  font-weight: bold;
}

.v-btn {
  text-transform: none;
}

.v-chip {
  font-size: 0.875rem;
}
</style>
