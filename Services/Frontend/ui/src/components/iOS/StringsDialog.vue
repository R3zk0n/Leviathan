<template>
  <v-dialog :model-value="dialog" @update:model-value="closeDialog" max-width="1200px" persistent>
    <v-card class="modern-strings-dialog" :class="{ 'dark-theme': isDark }">
      <v-card-title class="headline d-flex align-center">
        <v-icon class="mr-2">mdi-text-search</v-icon>
        Dumped Strings Analysis
        <v-spacer></v-spacer>
        <v-btn icon variant="text" @click="closeDialog">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text class="pa-0">
        <v-tabs v-model="activeTab" class="modern-tabs" color="primary" slider-color="primary" grow>
          <v-tab value="all" class="modern-tab">
            <v-icon start>mdi-text</v-icon>
            All Strings
            <v-chip v-if="strings.length" size="small" class="ml-2">{{ strings.length }}</v-chip>
          </v-tab>
          <v-tab value="filtered" class="modern-tab">
            <v-icon start>mdi-filter</v-icon>
            Filtered
            <v-chip v-if="filteredStrings.length" size="small" class="ml-2">{{ filteredStrings.length }}</v-chip>
          </v-tab>
          <v-tab value="urls" class="modern-tab">
            <v-icon start>mdi-web</v-icon>
            URLs
            <v-chip v-if="urlStrings.length" size="small" class="ml-2">{{ urlStrings.length }}</v-chip>
          </v-tab>
          <v-tab value="paths" class="modern-tab">
            <v-icon start>mdi-folder</v-icon>
            File Paths
            <v-chip v-if="pathStrings.length" size="small" class="ml-2">{{ pathStrings.length }}</v-chip>
          </v-tab>
        </v-tabs>

        <v-divider></v-divider>

        <div class="strings-content">
          <!-- Search and Filter Controls -->
          <div class="search-controls pa-4">
            <v-text-field
              v-model="searchQuery"
              label="Search strings..."
              prepend-inner-icon="mdi-magnify"
              variant="outlined"
              density="compact"
              clearable
              hide-details
              class="mb-3"
            ></v-text-field>

            <div class="filter-chips">
              <v-chip-group v-model="activeFilters" multiple>
                <v-chip filter variant="outlined" size="small" value="min-length">
                  <v-icon start>mdi-ruler</v-icon>
                  Min Length (10+)
                </v-chip>
                <v-chip filter variant="outlined" size="small" value="printable">
                  <v-icon start>mdi-format-text</v-icon>
                  Printable Only
                </v-chip>
                <v-chip filter variant="outlined" size="small" value="no-spaces">
                  <v-icon start>mdi-space-station</v-icon>
                  No Spaces
                </v-chip>
                <v-chip filter variant="outlined" size="small" value="unique">
                  <v-icon start>mdi-check-decagram</v-icon>
                  Unique Only
                </v-chip>
              </v-chip-group>
            </div>
          </div>

          <v-tabs-window v-model="activeTab" class="strings-window">
            <!-- All Strings Tab -->
            <v-tabs-window-item value="all" class="tab-content">
              <div class="strings-container">
                <div v-if="displayedAllStrings.length" class="strings-list">
                  <v-card
                    v-for="(string, index) in displayedAllStrings"
                    :key="index"
                    class="string-item mb-2"
                    elevation="1"
                    @click="copyToClipboard(string)"
                  >
                    <v-card-text class="string-content">
                      <div class="string-index">#{{ index + 1 }}</div>
                      <code class="string-value">{{ string }}</code>
                      <div class="string-meta">
                        <v-chip size="x-small" color="info">{{ string.length }} chars</v-chip>
                        <v-btn icon size="small" variant="text" @click.stop="copyToClipboard(string)">
                          <v-icon size="16">mdi-content-copy</v-icon>
                        </v-btn>
                      </div>
                    </v-card-text>
                  </v-card>
                </div>
                <div v-else-if="loading" class="loading-state">
                  <v-progress-circular indeterminate color="primary" size="48"></v-progress-circular>
                  <p class="mt-4">Loading strings...</p>
                </div>
                <div v-else class="empty-state">
                  <v-icon size="64" color="grey">mdi-text-search</v-icon>
                  <h3 class="mt-4 text-grey">No strings found</h3>
                </div>
              </div>
            </v-tabs-window-item>

            <!-- Filtered Strings Tab -->
            <v-tabs-window-item value="filtered" class="tab-content">
              <div class="strings-container">
                <div v-if="filteredStrings.length" class="strings-list">
                  <v-card
                    v-for="(string, index) in filteredStrings"
                    :key="index"
                    class="string-item mb-2"
                    elevation="1"
                    @click="copyToClipboard(string)"
                  >
                    <v-card-text class="string-content">
                      <div class="string-index">#{{ index + 1 }}</div>
                      <code class="string-value">{{ string }}</code>
                      <div class="string-meta">
                        <v-chip size="x-small" color="success">{{ string.length }} chars</v-chip>
                        <v-btn icon size="small" variant="text" @click.stop="copyToClipboard(string)">
                          <v-icon size="16">mdi-content-copy</v-icon>
                        </v-btn>
                      </div>
                    </v-card-text>
                  </v-card>
                </div>
                <div v-else class="empty-state">
                  <v-icon size="64" color="grey">mdi-filter</v-icon>
                  <h3 class="mt-4 text-grey">No filtered strings found</h3>
                  <p class="text-grey-darken-1">Try adjusting your filter criteria</p>
                </div>
              </div>
            </v-tabs-window-item>

            <!-- URLs Tab -->
            <v-tabs-window-item value="urls" class="tab-content">
              <div class="strings-container">
                <div v-if="urlStrings.length" class="strings-list">
                  <v-card
                    v-for="(string, index) in urlStrings"
                    :key="index"
                    class="string-item mb-2 url-item"
                    elevation="1"
                    @click="copyToClipboard(string)"
                  >
                    <v-card-text class="string-content">
                      <div class="string-index">#{{ index + 1 }}</div>
                      <code class="string-value url-value">{{ string }}</code>
                      <div class="string-meta">
                        <v-chip size="x-small" color="primary">URL</v-chip>
                        <v-btn icon size="small" variant="text" @click.stop="copyToClipboard(string)">
                          <v-icon size="16">mdi-content-copy</v-icon>
                        </v-btn>
                      </div>
                    </v-card-text>
                  </v-card>
                </div>
                <div v-else class="empty-state">
                  <v-icon size="64" color="grey">mdi-web</v-icon>
                  <h3 class="mt-4 text-grey">No URLs found</h3>
                </div>
              </div>
            </v-tabs-window-item>

            <!-- Paths Tab -->
            <v-tabs-window-item value="paths" class="tab-content">
              <div class="strings-container">
                <div v-if="pathStrings.length" class="strings-list">
                  <v-card
                    v-for="(string, index) in pathStrings"
                    :key="index"
                    class="string-item mb-2 path-item"
                    elevation="1"
                    @click="copyToClipboard(string)"
                  >
                    <v-card-text class="string-content">
                      <div class="string-index">#{{ index + 1 }}</div>
                      <code class="string-value path-value">{{ string }}</code>
                      <div class="string-meta">
                        <v-chip size="x-small" color="orange">Path</v-chip>
                        <v-btn icon size="small" variant="text" @click.stop="copyToClipboard(string)">
                          <v-icon size="16">mdi-content-copy</v-icon>
                        </v-btn>
                      </div>
                    </v-card-text>
                  </v-card>
                </div>
                <div v-else class="empty-state">
                  <v-icon size="64" color="grey">mdi-folder</v-icon>
                  <h3 class="mt-4 text-grey">No file paths found</h3>
                </div>
              </div>
            </v-tabs-window-item>
          </v-tabs-window>
        </div>
      </v-card-text>

      <v-card-actions class="modern-actions">
        <v-btn
          color="secondary"
          variant="tonal"
          prepend-icon="mdi-download"
          @click="exportStrings"
          :disabled="!strings.length"
        >
          Export All
        </v-btn>
        <v-btn
          color="info"
          variant="tonal"
          prepend-icon="mdi-table-search"
          @click="showStatistics"
          :disabled="!strings.length"
        >
          Statistics
        </v-btn>
        <v-spacer></v-spacer>
        <v-btn color="primary" variant="elevated" @click="closeDialog">
          Close
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { ref, computed, watch } from 'vue';
import { useStore } from 'vuex';

export default {
  name: 'StringsDialog',
  props: {
    dialog: Boolean,
    strings: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  setup(props, { emit }) {
    const store = useStore();
    const activeTab = ref('all');
    const searchQuery = ref('');
    const activeFilters = ref([]);

    const closeDialog = () => {
      emit('update:dialog', false);
    };

    // URL detection regex
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
    const pathRegex = /(?:\/[a-zA-Z0-9._-]+)+\/?|[a-zA-Z]:\\(?:[^\\\/:*?"<>|\r\n]+\\)*[^\\\/:*?"<>|\r\n]*/g;

    // Computed filtered strings
    const filteredStrings = computed(() => {
      let result = [...props.strings];

      // Apply search filter
      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        result = result.filter(str => str.toLowerCase().includes(query));
      }

      // Apply active filters
      if (activeFilters.value.includes('min-length')) {
        result = result.filter(str => str.length >= 10);
      }

      if (activeFilters.value.includes('printable')) {
        result = result.filter(str => /^[\x20-\x7E]*$/.test(str));
      }

      if (activeFilters.value.includes('no-spaces')) {
        result = result.filter(str => !str.includes(' '));
      }

      if (activeFilters.value.includes('unique')) {
        result = [...new Set(result)];
      }

      return result;
    });

    // URL strings
    const urlStrings = computed(() => {
      const urls = [];
      props.strings.forEach(str => {
        const matches = str.match(urlRegex);
        if (matches) {
          urls.push(...matches);
        }
      });
      return [...new Set(urls)];
    });

    // Path strings
    const pathStrings = computed(() => {
      const paths = [];
      props.strings.forEach(str => {
        const matches = str.match(pathRegex);
        if (matches) {
          paths.push(...matches.filter(match => match.length > 3));
        }
      });
      return [...new Set(paths)];
    });

    // Displayed strings for "All" tab (with search applied)
    const displayedAllStrings = computed(() => {
      if (!searchQuery.value) return props.strings;

      const query = searchQuery.value.toLowerCase();
      return props.strings.filter(str => str.toLowerCase().includes(query));
    });

    // Copy to clipboard functionality
    const copyToClipboard = async (text) => {
      try {
        await navigator.clipboard.writeText(text);
        // You can add a toast notification here if available
      } catch (err) {
        console.error('Failed to copy: ', err);
      }
    };

    // Export functionality
    const exportStrings = () => {
      const currentStrings = getCurrentTabStrings();
      const content = currentStrings.join('\n');
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `strings_${activeTab.value}_${Date.now()}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

    // Get current tab strings
    const getCurrentTabStrings = () => {
      switch (activeTab.value) {
        case 'filtered':
          return filteredStrings.value;
        case 'urls':
          return urlStrings.value;
        case 'paths':
          return pathStrings.value;
        default:
          return displayedAllStrings.value;
      }
    };

    // Show statistics
    const showStatistics = () => {
      const stats = {
        total: props.strings.length,
        unique: new Set(props.strings).size,
        averageLength: props.strings.reduce((sum, str) => sum + str.length, 0) / props.strings.length,
        urls: urlStrings.value.length,
        paths: pathStrings.value.length,
        filtered: filteredStrings.value.length
      };

      emit('show-statistics', stats);
    };

    return {
      activeTab,
      searchQuery,
      activeFilters,
      closeDialog,
      filteredStrings,
      urlStrings,
      pathStrings,
      displayedAllStrings,
      copyToClipboard,
      exportStrings,
      showStatistics,
      isDark: computed(() => store.state.isDark)
    };
  }
};
</script>

<style scoped>
/* Modern Card Styling */
.modern-strings-dialog {
  border-radius: 16px !important;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08) !important;
}

/* Header Styling */
.headline {
  font-weight: 600 !important;
  font-size: 1.25rem !important;
}

/* Modern Tabs */
.modern-tabs {
  background: rgb(248, 250, 252) !important;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.dark-theme .modern-tabs {
  background: rgb(30, 41, 59) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.modern-tab {
  font-weight: 500 !important;
  text-transform: none !important;
  letter-spacing: 0 !important;
  padding: 12px 20px !important;
}

/* Content Areas */
.strings-content {
  min-height: 500px;
  max-height: 600px;
}

.strings-window {
  height: 500px;
  overflow-y: auto;
}

.tab-content {
  padding: 0 !important;
}

.strings-container {
  padding: 0 24px 24px 24px;
  height: 100%;
  overflow-y: auto;
}

/* Search Controls */
.search-controls {
  background: rgba(248, 250, 252, 0.5);
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.dark-theme .search-controls {
  background: rgba(30, 41, 59, 0.5);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* String Items */
.string-item {
  border-radius: 8px !important;
  border: 1px solid rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
  cursor: pointer;
}

.string-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
}

.dark-theme .string-item {
  background: rgba(51, 65, 85, 0.6) !important;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.string-content {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px !important;
}

.string-index {
  font-size: 0.75rem;
  color: rgb(107, 114, 128);
  min-width: 40px;
  font-weight: 600;
}

.dark-theme .string-index {
  color: rgb(156, 163, 175);
}

.string-value {
  flex: 1;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9rem;
  color: rgb(51, 65, 85);
  word-break: break-word;
  line-height: 1.4;
}

.dark-theme .string-value {
  color: rgb(203, 213, 225);
}

.url-value {
  color: rgb(59, 130, 246) !important;
}

.dark-theme .url-value {
  color: rgb(96, 165, 250) !important;
}

.path-value {
  color: rgb(245, 101, 101) !important;
}

.dark-theme .path-value {
  color: rgb(248, 113, 113) !important;
}

.string-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Special Item Types */
.url-item {
  border-left: 3px solid rgb(59, 130, 246) !important;
}

.path-item {
  border-left: 3px solid rgb(245, 101, 101) !important;
}

/* Loading and Empty States */
.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
  color: rgb(107, 114, 128);
}

.dark-theme .loading-state,
.dark-theme .empty-state {
  color: rgb(156, 163, 175);
}

/* Modern Actions */
.modern-actions {
  background: rgb(248, 250, 252);
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  padding: 20px 24px !important;
}

.dark-theme .modern-actions {
  background: rgba(30, 41, 59, 0.8);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

/* Scrollbar Styling */
.strings-window::-webkit-scrollbar,
.strings-container::-webkit-scrollbar {
  width: 6px;
}

.strings-window::-webkit-scrollbar-track,
.strings-container::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.02);
}

.strings-window::-webkit-scrollbar-thumb,
.strings-container::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}

.strings-window::-webkit-scrollbar-thumb:hover,
.strings-container::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.15);
}

.dark-theme .strings-window::-webkit-scrollbar-track,
.dark-theme .strings-container::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.02);
}

.dark-theme .strings-window::-webkit-scrollbar-thumb,
.dark-theme .strings-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
}

.dark-theme .strings-window::-webkit-scrollbar-thumb:hover,
.dark-theme .strings-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.15);
}
</style>