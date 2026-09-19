<template>
  <v-container :class="isDark ? 'theme--dark' : 'theme--light'">

    <v-row class="mb-4">
      <v-col cols="12">
        <div class="d-flex align-center">
          <v-icon size="28" class="mr-3" color="primary">mdi-server-network</v-icon>
          <div>
            <div class="text-h5 font-weight-bold">MCP Server</div>
            <div class="text-caption text-medium-emphasis">
              Model Context Protocol — connect Claude to Leviathan scan data
            </div>
          </div>
        </div>
      </v-col>
    </v-row>

    <!-- Connection status row -->
    <v-row justify="center">
      <v-col cols="auto">
        <v-btn
          @click="checkMcpStatus"
          :loading="isLoadingStatus"
          :disabled="isLoadingStatus"
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
          @click="checkSseStatus"
          :loading="isLoadingSse"
          :disabled="isLoadingSse"
          :class="isDark ? 'btn-dark' : 'btn-light'"
          height="72"
          min-width="164"
          prepend-icon="mdi-antenna"
        >
          Check SSE Transport
        </v-btn>
      </v-col>
    </v-row>

    <!-- Status card -->
    <v-row justify="center" class="mt-5">
      <v-col cols="12" md="8">
        <v-card :class="isDark ? 'theme--dark' : 'theme--light'" elevation="2">
          <v-card-title class="text-center">MCP Status</v-card-title>
          <v-card-text>
            <v-list :class="isDark ? 'theme--dark' : 'theme--light'">
              <v-list-item v-if="mcpStatus">
                <v-list-item-title>MCP Server</v-list-item-title>
                <v-list-item-subtitle>
                  <v-chip :color="mcpStatus === 'Error' ? 'error' : 'success'" size="small">
                    {{ mcpStatus }}
                  </v-chip>
                </v-list-item-subtitle>
              </v-list-item>
              <v-list-item v-if="sseStatus">
                <v-list-item-title>SSE Transport (port 5003)</v-list-item-title>
                <v-list-item-subtitle>
                  <v-chip :color="sseStatus === 'Error' ? 'error' : 'success'" size="small">
                    {{ sseStatus }}
                  </v-chip>
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Tools reference card -->
    <v-row justify="center" class="mt-4">
      <v-col cols="12" md="8">
        <v-card :class="isDark ? 'theme--dark' : 'theme--light'" elevation="2">
          <v-card-title>
            <v-icon class="mr-2">mdi-tools</v-icon>
            Exposed Tools
          </v-card-title>
          <v-card-text>
            <v-list :class="isDark ? 'theme--dark' : 'theme--light'" density="compact">
              <v-list-item
                v-for="tool in mcpTools"
                :key="tool.name"
                :prepend-icon="tool.icon"
              >
                <v-list-item-title>{{ tool.name }}</v-list-item-title>
                <v-list-item-subtitle>{{ tool.description }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Connection snippets -->
    <v-row justify="center" class="mt-4">
      <v-col cols="12" md="8">
        <v-card :class="isDark ? 'theme--dark' : 'theme--light'" elevation="2">
          <v-card-title>
            <v-icon class="mr-2">mdi-connection</v-icon>
            Connection
          </v-card-title>
          <v-card-text>
            <div class="text-subtitle-2 mb-1">Claude Code / Claude Desktop (stdio)</div>
            <v-code class="mb-4 pa-2 code-block">
              docker exec -i leviathan-mcp-1 python leviathan_mcp_server.py
            </v-code>
            <div class="text-subtitle-2 mb-1">Agentic agents (SSE)</div>
            <v-code class="pa-2 code-block">
              http://localhost:5003/sse
            </v-code>
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

const mcpStatus = ref('');
const sseStatus = ref('');
const isLoadingStatus = ref(false);
const isLoadingSse = ref(false);
const snackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('success');

const mcpTools = [
  { name: 'list_apps',              icon: 'mdi-apps',               description: 'List all uploaded Android apps' },
  { name: 'get_scan_summary',       icon: 'mdi-chart-box-outline',  description: 'Scan overview, manifest risks, issue counts' },
  { name: 'get_vulnerabilities',    icon: 'mdi-bug-outline',        description: 'Vulnerability list with component context' },
  { name: 'get_taint_trace',        icon: 'mdi-transit-connection', description: 'Full call stack + Jimple IR + Java source' },
  { name: 'get_decompiled_class',   icon: 'mdi-file-code-outline',  description: 'JADX-decompiled source for any class' },
  { name: 'get_manifest_context',   icon: 'mdi-shield-account',     description: 'Exported components and permissions' },
  { name: 'get_app_secrets',        icon: 'mdi-key-outline',        description: 'Detected hardcoded secrets' },
  { name: 'validate_vulnerability', icon: 'mdi-check-decagram',     description: 'Write AI verdict back to the database' },
  { name: 'bulk_validate',          icon: 'mdi-check-all',          description: 'Validate multiple findings at once' },
];

const showSnackbar = (message, color = 'success') => {
  snackbarMessage.value = message;
  snackbarColor.value = color;
  snackbar.value = true;
};

const checkMcpStatus = async () => {
  isLoadingStatus.value = true;
  try {
    const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/engine/mcp/status`);
    mcpStatus.value = response.data?.message ?? 'Online';
    showSnackbar(`MCP Server: ${mcpStatus.value}`);
  } catch {
    mcpStatus.value = 'Error';
    showSnackbar('MCP server unreachable', 'error');
  } finally {
    isLoadingStatus.value = false;
  }
};

const checkSseStatus = async () => {
  isLoadingSse.value = true;
  try {
    const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/engine/mcp/sse-status`);
    sseStatus.value = response.data?.message ?? 'Online';
    showSnackbar(`SSE Transport: ${sseStatus.value}`);
  } catch {
    sseStatus.value = 'Error';
    showSnackbar('SSE transport unreachable', 'error');
  } finally {
    isLoadingSse.value = false;
  }
};

watch(() => store.state.isDark, (newVal) => { isDark.value = newVal; });
</script>

<style scoped>
.theme--dark  { background-color: #121212; color: #ffffff; }
.theme--light { background-color: #ffffff; color: #000000; }
.btn-dark  { background-color: #424242; color: #ffffff; }
.btn-light { background-color: #f5f5f5; color: #000000; }
.code-block { font-family: monospace; font-size: 0.82rem; background: rgba(0,0,0,0.06); border-radius: 4px; display: block; }
</style>
