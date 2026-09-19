<template>
  <v-dialog :model-value="dialog" @update:model-value="updateDialog" max-width="900px" persistent>
    <v-card class="modern-card" :class="isDark ? 'theme--dark' : 'theme--light'">
      <v-card-title class="headline d-flex align-center">
        <v-icon class="mr-2">mdi-function</v-icon>
        Binary Functions
        <v-spacer></v-spacer>
        <v-chip color="info" variant="tonal" class="mr-4">
          {{ totalFunctions }} total functions
        </v-chip>
        <v-btn icon variant="text" @click="closeDialog">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text class="pa-0">
        <div class="search-container pa-4">
          <v-text-field
            v-model="search"
            label="Search functions..."
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            density="compact"
            clearable
            class="functions-search"
            :class="isDark ? 'theme--dark' : 'theme--light'"
            hide-details
          ></v-text-field>
        </div>

        <v-divider></v-divider>

        <div v-if="loading" class="loading-state">
          <v-progress-circular indeterminate color="primary" size="48"></v-progress-circular>
          <p class="mt-4">Loading functions...</p>
        </div>

        <div v-else class="functions-content">
          <!-- Function count and pagination controls -->
          <div class="d-flex align-center pa-4 pb-0">
            <v-chip color="secondary" variant="outlined" size="small">
              {{ filteredFunctions.length }} of {{ totalFunctions }} functions
            </v-chip>
            <v-spacer></v-spacer>
            <v-select
              v-model="pageSize"
              :items="[25, 50, 100, 200]"
              label="Per page"
              variant="outlined"
              density="compact"
              style="max-width: 120px;"
              class="functions-select"
              :class="isDark ? 'theme--dark' : 'theme--light'"
              hide-details
            ></v-select>
          </div>

          <!-- Functions list -->
          <div class="functions-list pa-4">
            <div v-for="(func, index) in paginatedFunctions" :key="index" class="function-item mb-2">
              <v-card
                elevation="1"
                class="function-card pa-3"
                :class="isDark ? 'theme--dark' : 'theme--light'"
                @click="goToDecompiler(func.address)"
              >
                <div class="d-flex align-center">
                  <div class="function-info flex-grow-1">
                    <!-- Named function: show the symbol NAME as the primary label,
                         with the raw address as a smaller subtitle. Falls back to
                         address-first for stripped / unnamed functions. -->
                    <template v-if="func.name">
                      <div class="function-name-primary">
                        <v-icon size="18" class="mr-2" color="primary">mdi-function-variant</v-icon>
                        <span class="name-text-primary" :class="isDark ? 'theme--dark' : 'theme--light'">
                          {{ func.name }}
                        </span>
                        <v-chip size="x-small" color="success" variant="tonal" class="ml-2">
                          {{ func.type || 'FUNC' }}
                        </v-chip>
                      </div>
                      <div class="function-address-sub mt-1">
                        <v-icon size="14" class="mr-1" color="grey">mdi-map-marker</v-icon>
                        <code class="address-code address-code--sub" :class="isDark ? 'theme--dark' : 'theme--light'">
                          {{ formatAddress(func.address) }}
                        </code>
                      </div>
                    </template>
                    <template v-else>
                      <div class="function-address">
                        <v-icon size="18" class="mr-2" color="primary">mdi-map-marker</v-icon>
                        <code class="address-code" :class="isDark ? 'theme--dark' : 'theme--light'">
                          {{ formatAddress(func.address) }}
                        </code>
                        <v-chip size="x-small" color="success" variant="tonal" class="ml-2">
                          {{ func.type || 'FUNC' }}
                        </v-chip>
                      </div>
                    </template>
                  </div>
                  <div class="function-actions">
                    <v-btn
                      icon
                      size="small"
                      variant="text"
                      color="primary"
                      @click.stop="copyAddress(func.address)"
                    >
                      <v-icon size="18">mdi-content-copy</v-icon>
                    </v-btn>
                    <v-btn
                      icon
                      size="small"
                      variant="text"
                      color="primary"
                      @click="goToDecompiler(func.address)"
                    >
                      <v-icon size="18">mdi-arrow-right</v-icon>
                    </v-btn>
                  </div>
                </div>
              </v-card>
            </div>
          </div>

          <!-- Pagination -->
          <div class="pa-4 pt-0" v-if="totalDisplayPages > 1">
            <v-pagination
              v-model="currentDisplayPage"
              :length="totalDisplayPages"
              :total-visible="7"
              class="functions-pagination"
              :class="isDark ? 'theme--dark' : 'theme--light'"
            ></v-pagination>
          </div>
        </div>
      </v-card-text>

      <v-card-actions class="modern-actions" :class="isDark ? 'theme--dark' : 'theme--light'">
        <v-btn
          color="secondary"
          variant="tonal"
          prepend-icon="mdi-download"
          @click="exportFunctions"
          :disabled="!functions.length"
        >
          Export List
        </v-btn>
        <v-spacer></v-spacer>
        <v-btn color="primary" variant="elevated" @click="closeDialog">
          Close
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- Success snackbar for copy -->
    <v-snackbar
      v-model="copySnackbar"
      timeout="2000"
      color="success"
    >
      Address copied to clipboard!
    </v-snackbar>
  </v-dialog>
</template>

<script>
import { mapState } from 'vuex';
import axios from 'axios';

export default {
  name: 'FunctionsDialog',
  props: {
    dialog: {
      type: Boolean,
      required: true
    },
    filename: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      loading: true,
      search: '',
      functions: [],
      symbolMap: {},
      currentPage: 1,
      pageSize: 50,
      totalPages: 0,
      totalFunctions: 0,
      currentDisplayPage: 1,
      copySnackbar: false
    };
  },
  computed: {
    ...mapState(['isDark']),

    formattedFunctions() {
      return this.functions.map(func => {
        if (typeof func === 'string') {
          // Simple string address: prefer the backend's symbol name for it.
          return {
            address: func,
            name: this.symbolMap[func] || this.extractFunctionName(func),
            type: 'FUNC'
          };
        } else if (typeof func === 'object') {
          const address = func.address || func.addr || func;
          return {
            address,
            name: func.name || func.symbol || this.symbolMap[address] || this.extractFunctionName(address),
            type: func.type || 'FUNC'
          };
        }
        return {
          address: func,
          name: this.symbolMap[func] || null,
          type: 'FUNC'
        };
      });
    },

    filteredFunctions() {
      if (!this.search) {
        return this.formattedFunctions;
      }
      const query = this.search.toLowerCase();
      return this.formattedFunctions.filter(func =>
        func.address.toLowerCase().includes(query) ||
        (func.name && func.name.toLowerCase().includes(query))
      );
    },

    totalDisplayPages() {
      return Math.ceil(this.filteredFunctions.length / this.pageSize);
    },

    paginatedFunctions() {
      const start = (this.currentDisplayPage - 1) * this.pageSize;
      const end = start + this.pageSize;
      return this.filteredFunctions.slice(start, end);
    }
  },

  watch: {
    dialog(val) {
      if (val) {
        this.fetchFunctions();
        this.currentDisplayPage = 1;
      }
    },

    search() {
      this.currentDisplayPage = 1;
    },

    pageSize() {
      this.currentDisplayPage = 1;
    }
  },

  methods: {
    closeDialog() {
      this.$emit('update:dialog', false);
    },

    updateDialog(value) {
      this.$emit('update:dialog', value);
    },

    formatAddress(address) {
      // Format address for better readability
      if (!address) return 'N/A';

      // Handle different address formats
      const cleanAddr = address.toString().toLowerCase();

      if (cleanAddr.startsWith('0x')) {
        // Already has 0x prefix
        return cleanAddr.toUpperCase();
      } else {
        // Add 0x prefix and ensure proper formatting
        return `0x${cleanAddr}`.toUpperCase();
      }
    },

    extractFunctionName(address) {
      // Try to extract meaningful names from addresses
      if (!address) return null;

      const addr = address.toString();
      // Check if it looks like it has a symbol name
      if (addr.includes('_') || addr.includes('.')) {
        return addr;
      }

      return null; // No meaningful name found
    },

    async copyAddress(address) {
      try {
        await navigator.clipboard.writeText(address);
        this.copySnackbar = true;
      } catch (err) {
        console.error('Failed to copy address:', err);
      }
    },

    goToDecompiler(address) {
      this.$router.push({ path: `/iOS/Decompiler/${this.filename}/${address}` });
      this.closeDialog();
    },

    exportFunctions() {
      const functionsList = this.filteredFunctions.map(func =>
        `${func.address}${func.name && func.name !== func.address ? ' - ' + func.name : ''}`
      ).join('\n');

      const blob = new Blob([functionsList], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `functions_${this.filename}_${Date.now()}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },

    async fetchFunctions() {
      this.loading = true;
      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/ios/functions/${this.filename}`, {
          params: {
            page: this.currentPage,
            page_size: this.pageSize
          }
        });

        if (response.data) {
          if (Array.isArray(response.data.functions)) {
            this.functions = response.data.functions;
            // address -> symbol name map (backend ships names for named functions)
            this.symbolMap = response.data.symbols || {};
            this.totalFunctions = response.data.total || response.data.functions.length;
          } else if (Array.isArray(response.data)) {
            // Handle case where response.data is directly the functions array
            this.functions = response.data;
            this.symbolMap = {};
            this.totalFunctions = response.data.length;
          } else {
            console.error('Functions data format not recognized:', response.data);
            this.functions = [];
            this.symbolMap = {};
            this.totalFunctions = 0;
          }
        } else {
          console.error('No data received from functions API');
          this.functions = [];
          this.symbolMap = {};
          this.totalFunctions = 0;
        }
      } catch (err) {
        console.error('Error fetching functions:', err);
        this.functions = [];
        this.symbolMap = {};
        this.totalFunctions = 0;
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>

<style scoped>
/* Modern Card Styling */
.modern-card {
  border-radius: 16px !important;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08) !important;
}

/* Header Styling */
.headline {
  font-weight: 600 !important;
  font-size: 1.25rem !important;
}

/* Search Container */
.search-container {
  background-color: rgba(0, 0, 0, 0.02);
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
}

/* Functions Content */
.functions-content {
  max-height: 500px;
  overflow-y: auto;
}

.functions-list {
  min-height: 200px;
}

/* Function Items */
.function-item {
  transition: all 0.2s ease;
}

.function-card {
  border-radius: 12px !important;
  border: 1px solid transparent;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

.function-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12) !important;
}

/* Function Info */
.function-info {
  min-width: 0; /* Allow flex item to shrink */
}

.function-address {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.address-code {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9rem;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 6px;
  word-break: break-all;
}

.function-name {
  display: flex;
  align-items: center;
}

.name-text {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.85rem;
  font-weight: 500;
}

/* Named-function primary label: name shown first, address as a subtitle below. */
.function-name-primary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.name-text-primary {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.95rem;
  font-weight: 600;
  word-break: break-word;
}

.theme--dark .name-text-primary {
  color: #ffffff;
}

.theme--light .name-text-primary {
  color: #111827;
}

.function-address-sub {
  display: flex;
  align-items: center;
}

.address-code--sub {
  font-size: 0.78rem;
  font-weight: 500;
  opacity: 0.85;
}

/* Function Actions */
.function-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

/* Actions Bar */
.modern-actions {
  padding: 20px 24px !important;
}

/* Standard Theme Classes */
.theme--dark .v-card,
.theme--dark .v-card-title,
.theme--dark .v-card-text,
.theme--dark .functions-content,
.theme--dark .search-container {
  background-color: #1e1e1e;
  color: #ffffff;
}

.theme--light .v-card,
.theme--light .v-card-title,
.theme--light .v-card-text,
.theme--light .functions-content,
.theme--light .search-container {
  background-color: #ffffff;
  color: #000000;
}

/* Dark Theme Specific Styling */
.theme--dark .search-container {
  background-color: rgba(255, 255, 255, 0.02);
}

.theme--dark .function-card {
  background-color: #2d2d2d !important;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.theme--dark .function-card:hover {
  background-color: #363636 !important;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3) !important;
}

.theme--dark .address-code {
  background-color: rgba(99, 102, 241, 0.15);
  color: rgb(165, 180, 252);
  border: 1px solid rgba(99, 102, 241, 0.2);
}

.theme--dark .name-text {
  color: rgba(255, 255, 255, 0.8);
}

.theme--dark .functions-search {
  --v-field-bg: #2d2d2d;
  --v-theme-surface: #2d2d2d;
}

.theme--dark .functions-search .v-field__input {
  color: #ffffff;
}

.theme--dark .functions-select {
  --v-field-bg: #2d2d2d;
  --v-theme-surface: #2d2d2d;
}

.theme--dark .functions-select .v-field__input {
  color: #ffffff;
}

.theme--dark .functions-pagination {
  --v-theme-surface: #2d2d2d;
}

.theme--dark .functions-pagination .v-btn {
  color: #ffffff;
}

.theme--dark .modern-actions {
  background-color: #262626;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.theme--dark .loading-state {
  color: #ffffff;
}

/* Light Theme Specific Styling */
.theme--light .search-container {
  background-color: rgba(0, 0, 0, 0.02);
}

.theme--light .function-card {
  background-color: #ffffff !important;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.theme--light .function-card:hover {
  background-color: #f8fafc !important;
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12) !important;
}

.theme--light .address-code {
  background-color: rgba(99, 102, 241, 0.1);
  color: rgb(67, 56, 202);
  border: 1px solid rgba(99, 102, 241, 0.15);
}

.theme--light .name-text {
  color: rgba(0, 0, 0, 0.7);
}

.theme--light .functions-search {
  --v-field-bg: #ffffff;
  --v-theme-surface: #ffffff;
}

.theme--light .functions-search .v-field__input {
  color: #000000;
}

.theme--light .functions-select {
  --v-field-bg: #ffffff;
  --v-theme-surface: #ffffff;
}

.theme--light .functions-select .v-field__input {
  color: #000000;
}

.theme--light .functions-pagination {
  --v-theme-surface: #ffffff;
}

.theme--light .functions-pagination .v-btn {
  color: #000000;
}

.theme--light .modern-actions {
  background-color: #f8fafc;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.theme--light .loading-state {
  color: #000000;
}

/* Responsive Design */
@media (max-width: 768px) {
  .function-address {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .function-actions {
    margin-top: 8px;
  }

  .modern-actions {
    flex-direction: column;
    gap: 12px;
  }

  .modern-actions .v-spacer {
    display: none;
  }
}

/* Scrollbar Styling */
.functions-content::-webkit-scrollbar {
  width: 6px;
}

.functions-content::-webkit-scrollbar-track {
  background: transparent;
}

.functions-content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.theme--dark .functions-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
}
</style>
