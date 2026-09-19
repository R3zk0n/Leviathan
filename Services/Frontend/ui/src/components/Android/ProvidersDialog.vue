<template>
  <v-dialog :model-value="dialog" @update:model-value="closeDialog" max-width="1000px">
    <v-card :class="isDark ? 'theme--dark' : 'theme--light'">
      <v-card-title class="headline d-flex align-center gap-2">
        Providers
        <v-chip v-if="unprotectedCount > 0" size="small" color="error" variant="tonal" class="ml-2">
          <v-icon start size="14">mdi-shield-off-outline</v-icon>
          {{ unprotectedCount }} Unprotected
        </v-chip>
      </v-card-title>

      <v-card-subtitle class="pb-0 pt-2">
        <v-text-field
          v-model="search"
          label="Search providers..."
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          hide-details
          clearable
          class="mb-2"
        ></v-text-field>
        <div class="d-flex flex-wrap gap-2 mb-2">
          <v-chip
            v-for="f in quickFilters"
            :key="f.value"
            :color="quickFilter === f.value ? 'primary' : undefined"
            :variant="quickFilter === f.value ? 'flat' : 'outlined'"
            size="small"
            clickable
            @click="quickFilter = f.value; currentPage = 1"
          >
            <v-icon v-if="f.icon" start size="14">{{ f.icon }}</v-icon>
            {{ f.label }}
            <span class="ml-1 opacity-60">({{ f.count }})</span>
          </v-chip>
        </div>
      </v-card-subtitle>

      <div class="d-flex flex-row">
        <v-tabs :model-value="tab" @update:model-value="updateTab" background-color="primary" direction="vertical">
          <v-tab prepend-icon="mdi-database-plus" value="exported">
            Exported
            <v-chip size="x-small" class="ml-1" color="error" variant="tonal">{{ providers.exported.length }}</v-chip>
          </v-tab>
          <v-tab prepend-icon="mdi-database" value="non_exported">
            Non-Exported
            <v-chip size="x-small" class="ml-1" variant="tonal">{{ providers.non_exported.length }}</v-chip>
          </v-tab>
        </v-tabs>

        <v-snackbar v-model="snackbar" :timeout="3000" :color="snackbarColor">
          {{ snackbarText }}
        </v-snackbar>

        <v-window :model-value="tab" @update:model-value="updateTab">
          <!-- ── Exported ── -->
          <v-window-item value="exported">
            <v-card flat>
              <v-card-text>
                <div class="mb-2 text-caption text-medium-emphasis">
                  Showing {{ filteredExportedProviders.length }} of {{ providers.exported.length }} exported providers
                  <span v-if="quickFilter !== 'all'"> · filtered by <strong>{{ activeFilterLabel }}</strong></span>
                </div>

                <div v-if="filteredExportedAll.length === 0" class="text-center pa-6 text-medium-emphasis">
                  <v-icon size="36" class="mb-2">mdi-filter-off-outline</v-icon>
                  <div>No providers match the current filter.</div>
                </div>

                <v-expansion-panels v-else variant="accordion">
                  <v-expansion-panel v-for="provider in filteredExportedProviders" :key="provider.name">
                    <v-expansion-panel-title :expand-icon="hasDetails(provider) ? undefined : ''">
                      <div class="d-flex align-center w-100 gap-2" style="min-width:0;">
                        <v-btn variant="text" icon size="small" @click.stop="getFileAndProvider(provider)" :disabled="!decompiledProviders.has(provider.name)">
                          <v-icon size="18" :color="decompiledProviders.has(provider.name) ? 'primary' : 'grey'">mdi-xml</v-icon>
                        </v-btn>
                        <v-tooltip :text="provider.name" location="top">
                          <template v-slot:activator="{ props }">
                            <span v-bind="props" class="component-name text-body-2">{{ provider.name }}</span>
                          </template>
                        </v-tooltip>
                        <v-spacer></v-spacer>
                        <div class="d-flex align-center gap-1 flex-shrink-0">
                          <v-chip v-if="isUnprotected(provider)" size="x-small" color="error" variant="flat">
                            <v-icon start size="12">mdi-shield-off-outline</v-icon>
                            NO PERMS
                          </v-chip>
                          <v-chip v-if="provider.authorities" size="x-small" color="info" variant="tonal">
                            <v-icon start size="12">mdi-database</v-icon>
                            {{ provider.authorities }}
                          </v-chip>
                          <v-chip v-if="provider.grantUriPermissions" size="x-small" color="warning" variant="tonal">
                            <v-icon start size="12">mdi-key-variant</v-icon>
                            GRANT URI
                          </v-chip>
                        </div>
                      </div>
                    </v-expansion-panel-title>
                    <v-expansion-panel-text v-if="hasDetails(provider)">
                      <v-expansion-panels variant="accordion" class="mt-2">
                        <v-expansion-panel v-if="provider.authorities || provider.readPermission || provider.writePermission || provider.metaData?.resource">
                          <v-expansion-panel-title>
                            <v-icon class="mr-2" size="18">mdi-shield-account</v-icon>
                            Provider Information
                          </v-expansion-panel-title>
                          <v-expansion-panel-text>
                            <provider-filters :providers="[provider]"></provider-filters>
                          </v-expansion-panel-text>
                        </v-expansion-panel>
                        <v-expansion-panel v-if="provider.manifestSnippet">
                          <v-expansion-panel-title>
                            <v-icon class="mr-2" size="18">mdi-code-tags</v-icon>
                            Manifest Declaration
                          </v-expansion-panel-title>
                          <v-expansion-panel-text>
                            <div v-highlight>
                              <pre class="language-xml manifest-code"><code>{{ provider.manifestSnippet }}</code></pre>
                            </div>
                          </v-expansion-panel-text>
                        </v-expansion-panel>
                      </v-expansion-panels>
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                </v-expansion-panels>

                <v-pagination v-if="totalExportedPages > 1" v-model="currentPage" :length="totalExportedPages" :total-visible="7" class="mt-4"></v-pagination>
              </v-card-text>
            </v-card>
          </v-window-item>

          <!-- ── Non-Exported ── -->
          <v-window-item value="non_exported">
            <v-card flat>
              <v-card-text>
                <div class="mb-2 text-caption text-medium-emphasis">
                  Showing {{ filteredNonExportedProviders.length }} of {{ providers.non_exported.length }} non-exported providers
                  <span v-if="quickFilter !== 'all'"> · filtered by <strong>{{ activeFilterLabel }}</strong></span>
                </div>

                <div v-if="filteredNonExportedAll.length === 0" class="text-center pa-6 text-medium-emphasis">
                  <v-icon size="36" class="mb-2">mdi-filter-off-outline</v-icon>
                  <div>No providers match the current filter.</div>
                </div>

                <v-expansion-panels v-else variant="accordion">
                  <v-expansion-panel v-for="provider in filteredNonExportedProviders" :key="provider.name">
                    <v-expansion-panel-title :expand-icon="hasDetails(provider) ? undefined : ''">
                      <div class="d-flex align-center w-100 gap-2" style="min-width:0;">
                        <v-btn variant="text" icon size="small" @click.stop="getFileAndProvider(provider)" :disabled="!decompiledProviders.has(provider.name)">
                          <v-icon size="18" :color="decompiledProviders.has(provider.name) ? 'primary' : 'grey'">mdi-xml</v-icon>
                        </v-btn>
                        <v-tooltip :text="provider.name" location="top">
                          <template v-slot:activator="{ props }">
                            <span v-bind="props" class="component-name text-body-2">{{ provider.name }}</span>
                          </template>
                        </v-tooltip>
                        <v-spacer></v-spacer>
                        <div class="d-flex align-center gap-1 flex-shrink-0">
                          <v-chip v-if="isUnprotected(provider)" size="x-small" color="error" variant="flat">
                            <v-icon start size="12">mdi-shield-off-outline</v-icon>
                            NO PERMS
                          </v-chip>
                          <v-chip v-if="provider.authorities" size="x-small" color="info" variant="tonal">
                            <v-icon start size="12">mdi-database</v-icon>
                            {{ provider.authorities }}
                          </v-chip>
                          <v-chip v-if="provider.grantUriPermissions" size="x-small" color="warning" variant="tonal">
                            <v-icon start size="12">mdi-key-variant</v-icon>
                            GRANT URI
                          </v-chip>
                        </div>
                      </div>
                    </v-expansion-panel-title>
                    <v-expansion-panel-text v-if="hasDetails(provider)">
                      <v-expansion-panels variant="accordion" class="mt-2">
                        <v-expansion-panel v-if="provider.authorities || provider.readPermission || provider.writePermission || provider.metaData?.resource">
                          <v-expansion-panel-title>
                            <v-icon class="mr-2" size="18">mdi-shield-account</v-icon>
                            Provider Information
                          </v-expansion-panel-title>
                          <v-expansion-panel-text>
                            <provider-filters :providers="[provider]"></provider-filters>
                          </v-expansion-panel-text>
                        </v-expansion-panel>
                        <v-expansion-panel v-if="provider.manifestSnippet">
                          <v-expansion-panel-title>
                            <v-icon class="mr-2" size="18">mdi-code-tags</v-icon>
                            Manifest Declaration
                          </v-expansion-panel-title>
                          <v-expansion-panel-text>
                            <div v-highlight>
                              <pre class="language-xml manifest-code"><code>{{ provider.manifestSnippet }}</code></pre>
                            </div>
                          </v-expansion-panel-text>
                        </v-expansion-panel>
                      </v-expansion-panels>
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                </v-expansion-panels>

                <v-pagination v-if="totalNonExportedPages > 1" v-model="currentPage" :length="totalNonExportedPages" :total-visible="7" class="mt-4"></v-pagination>
              </v-card-text>
            </v-card>
          </v-window-item>
        </v-window>
      </div>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="primary" @click="closeDialog">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue';
import { useStore } from 'vuex';
import ProviderFilters from "@/components/Filters/ProviderFilters.vue";
import axios from 'axios';

export default {
  name: 'ProvidersDialog',
  components: { ProviderFilters },
  props: {
    dialog: Boolean,
    tab: String,
    filename: String,
    openCodeViewer: { type: Function, required: true },
  },
  setup(props, { emit }) {
    const store = useStore();
    const search = ref('');
    const snackbar = ref(false);
    const snackbarText = ref('');
    const snackbarColor = ref('error');
    const providers = ref({ exported: [], non_exported: [] });
    const decompiledProviders = ref(new Set());
    const quickFilter = ref('all');
    const currentPage = ref(1);
    const itemsPerPage = ref(50);

    const closeDialog = () => emit('update:dialog', false);
    const updateTab = (value) => emit('update:tab', value);

    const showSnackbar = (message, color = 'error') => {
      snackbarText.value = message;
      snackbarColor.value = color;
      snackbar.value = true;
    };

    const isUnprotected = (p) => !p.readPermission && !p.writePermission && !p.metaData?.resource;
    const hasGrantUri = (p) => !!p.grantUriPermissions;
    const hasDetails = (p) => !!(p.authorities || p.readPermission || p.writePermission || p.metaData?.resource || p.manifestSnippet);

    const providerPriority = (p) => {
      if (isUnprotected(p)) return 2;
      if (hasGrantUri(p)) return 1;
      return 0;
    };

    function buildFiltered(list) {
      let result = list;
      if (search.value) {
        const q = search.value.toLowerCase();
        result = result.filter(p => p.name.toLowerCase().includes(q) || (p.authorities || '').toLowerCase().includes(q));
      }
      if (quickFilter.value === 'unprotected') result = result.filter(isUnprotected);
      else if (quickFilter.value === 'granturi') result = result.filter(hasGrantUri);
      return [...result].sort((a, b) => {
        const pd = providerPriority(b) - providerPriority(a);
        return pd !== 0 ? pd : a.name.localeCompare(b.name);
      });
    }

    const filteredExportedAll = computed(() => buildFiltered(providers.value.exported));
    const filteredNonExportedAll = computed(() => buildFiltered(providers.value.non_exported));

    const filteredExportedProviders = computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage.value;
      return filteredExportedAll.value.slice(start, start + itemsPerPage.value);
    });
    const filteredNonExportedProviders = computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage.value;
      return filteredNonExportedAll.value.slice(start, start + itemsPerPage.value);
    });

    const totalExportedPages = computed(() => Math.ceil(filteredExportedAll.value.length / itemsPerPage.value));
    const totalNonExportedPages = computed(() => Math.ceil(filteredNonExportedAll.value.length / itemsPerPage.value));

    const unprotectedCount = computed(() =>
      providers.value.exported.filter(isUnprotected).length +
      providers.value.non_exported.filter(isUnprotected).length
    );

    const quickFilters = computed(() => {
      const src = props.tab === 'exported' ? providers.value.exported : providers.value.non_exported;
      return [
        { value: 'all',         label: 'All',              icon: null,                    count: src.length },
        { value: 'unprotected', label: 'No Permissions',   icon: 'mdi-shield-off-outline', count: src.filter(isUnprotected).length },
        { value: 'granturi',    label: 'Grant URI Perms',  icon: 'mdi-key-variant',        count: src.filter(hasGrantUri).length },
      ];
    });

    const activeFilterLabel = computed(() =>
      quickFilters.value.find(f => f.value === quickFilter.value)?.label ?? ''
    );

    const getFileAndProvider = async (provider) => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/engine/decompiled/${props.filename}/${provider.name}`);
        if (response.data?.java_code) {
          await store.dispatch('setCodeViewerData', { code: response.data.java_code, filename: props.filename, componentName: provider.name });
          props.openCodeViewer();
        } else {
          showSnackbar('No code available for this provider.', 'warning');
        }
      } catch {
        showSnackbar('An error occurred while fetching the code.');
      }
    };

    const checkBatchStatus = async (names) => {
      try {
        const response = await axios.post(
          `${import.meta.env.VITE_APP_API_URL}/engine/decompiled/${props.filename}/batch-status`,
          { items: names }
        );
        if (response.data?.status) {
          const confirmed = new Set();
          for (const [name, exists] of Object.entries(response.data.status)) {
            if (exists) confirmed.add(name);
          }
          decompiledProviders.value = confirmed;
        }
      } catch { /* silently degrade */ }
    };

    const fetchProviders = async () => {
      if (!props.filename) return;
      decompiledProviders.value = new Set();
      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/audit/providers/${props.filename}`);
        providers.value = response.data;
        const names = [...providers.value.exported, ...providers.value.non_exported].map(p => p.name);
        if (names.length) await checkBatchStatus(names);
      } catch {
        showSnackbar('Error fetching providers', 'error');
      }
    };

    onMounted(fetchProviders);
    watch(() => props.filename, fetchProviders);
    watch(() => props.dialog, (v) => { if (v) fetchProviders(); });
    watch([search, quickFilter, () => props.tab], () => { currentPage.value = 1; });

    return {
      search, quickFilter, quickFilters, activeFilterLabel, unprotectedCount,
      closeDialog, updateTab, getFileAndProvider,
      isDark: computed(() => store.state.isDark),
      providers, decompiledProviders,
      filteredExportedAll, filteredNonExportedAll,
      filteredExportedProviders, filteredNonExportedProviders,
      totalExportedPages, totalNonExportedPages,
      snackbar, snackbarText, snackbarColor,
      currentPage, itemsPerPage,
      isUnprotected, hasGrantUri, hasDetails,
    };
  },
};
</script>

<style scoped>
.component-name {
  flex-grow: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 8px;
}
.theme--dark .v-card,
.theme--dark .v-card-subtitle,
.theme--dark .v-card-title,
.theme--dark .v-text-field,
.theme--dark .v-expansion-panel-title,
.theme--dark .v-expansion-panel-text { background-color: #1e1e1e; color: #ffffff; }
.theme--light .v-card,
.theme--light .v-card-subtitle,
.theme--light .v-card-title,
.theme--light .v-text-field,
.theme--light .v-expansion-panel-title,
.theme--light .v-expansion-panel-text { background-color: #ffffff; color: #000000; }
:deep(.v-expansion-panel-title__overlay) { display: none; }
.theme--dark :deep(.text-medium-emphasis),
.theme--dark :deep(.text-caption),
.theme--dark :deep(.text-body-2) {
  color: rgba(255, 255, 255, 0.7) !important;
}
.manifest-code {
  margin: 0; padding: 12px; border-radius: 4px;
  font-size: 13px; line-height: 1.6; white-space: pre;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  max-width: 100%; overflow-x: auto;
}
.theme--dark .manifest-code { background-color: #272822 !important; color: #f8f8f2; }
.theme--light .manifest-code { background-color: #fbfbfb !important; color: #abb2bf; border: 1px solid #e0e0e0; }
.theme--light .manifest-code code { color: #abb2bf !important; }
</style>
