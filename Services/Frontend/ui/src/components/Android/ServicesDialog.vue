<template>
  <v-dialog :model-value="dialog" @update:model-value="closeDialog" max-width="1000px">
    <v-card :class="isDark ? 'theme--dark' : 'theme--light'">
      <v-card-title class="headline d-flex align-center gap-2">
        Services
      </v-card-title>

      <v-card-subtitle class="pb-0 pt-2">
        <v-text-field
          v-model="search"
          label="Search services..."
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
        <v-tabs v-model="localTab" background-color="primary" direction="vertical">
          <v-tab prepend-icon="mdi-export" value="exported">
            Exported
            <v-chip size="x-small" class="ml-1" color="error" variant="tonal">{{ services.exported.length }}</v-chip>
          </v-tab>
          <v-tab prepend-icon="mdi-lock-outline" value="non_exported">
            Non-Exported
            <v-chip size="x-small" class="ml-1" variant="tonal">{{ services.non_exported.length }}</v-chip>
          </v-tab>
        </v-tabs>

        <v-snackbar v-model="snackbar" :timeout="3000" :color="snackbarColor">
          {{ snackbarText }}
        </v-snackbar>

        <v-tabs-window v-model="localTab">
          <!-- ── Exported ── -->
          <v-tabs-window-item value="exported">
            <v-card flat>
              <v-card-text>
                <div class="mb-2 text-caption text-medium-emphasis">
                  Showing {{ filteredExportedServices.length }} of {{ services.exported.length }} exported services
                  <span v-if="quickFilter !== 'all'"> · filtered by <strong>{{ activeFilterLabel }}</strong></span>
                </div>

                <div v-if="filteredExportedAll.length === 0" class="text-center pa-6 text-medium-emphasis">
                  <v-icon size="36" class="mb-2">mdi-filter-off-outline</v-icon>
                  <div>No services match the current filter.</div>
                </div>

                <v-expansion-panels v-else variant="accordion">
                  <v-expansion-panel v-for="service in filteredExportedServices" :key="service.name">
                    <v-expansion-panel-title :expand-icon="hasDetails(service) ? undefined : ''">
                      <div class="d-flex align-center w-100 gap-2" style="min-width:0;">
                        <v-btn variant="text" icon size="small" @click.stop="getFileAndService(service)" :disabled="!decompiledServices.has(service.name)">
                          <v-icon size="18" :color="decompiledServices.has(service.name) ? 'primary' : 'grey'">mdi-xml</v-icon>
                        </v-btn>
                        <v-tooltip :text="service.name" location="top">
                          <template v-slot:activator="{ props }">
                            <span v-bind="props" class="component-name text-body-2">{{ service.name }}</span>
                          </template>
                        </v-tooltip>
                        <v-spacer></v-spacer>
                        <div class="d-flex align-center gap-1 flex-shrink-0">
                          <v-chip v-if="hasIntentFilters(service)" size="x-small" color="primary" variant="tonal">
                            <v-icon start size="12">mdi-filter-variant</v-icon>
                            {{ service.intentFilters.length }}
                          </v-chip>
                        </div>
                      </div>
                    </v-expansion-panel-title>
                    <v-expansion-panel-text v-if="hasDetails(service)">
                      <v-expansion-panels variant="accordion" class="mt-2">
                        <v-expansion-panel v-if="hasIntentFilters(service)">
                          <v-expansion-panel-title>
                            <v-icon class="mr-2" size="18">mdi-filter-variant</v-icon>
                            Intent Filters ({{ service.intentFilters.length }})
                          </v-expansion-panel-title>
                          <v-expansion-panel-text>
                            <intent-filters :filters="service.intentFilters"></intent-filters>
                          </v-expansion-panel-text>
                        </v-expansion-panel>
                        <v-expansion-panel v-if="service.manifestSnippet">
                          <v-expansion-panel-title>
                            <v-icon class="mr-2" size="18">mdi-code-tags</v-icon>
                            Manifest Declaration
                          </v-expansion-panel-title>
                          <v-expansion-panel-text>
                            <div v-highlight>
                              <pre class="language-xml manifest-code"><code>{{ service.manifestSnippet }}</code></pre>
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
          </v-tabs-window-item>

          <!-- ── Non-Exported ── -->
          <v-tabs-window-item value="non_exported">
            <v-card flat>
              <v-card-text>
                <div class="mb-2 text-caption text-medium-emphasis">
                  Showing {{ filteredNonExportedServices.length }} of {{ services.non_exported.length }} non-exported services
                  <span v-if="quickFilter !== 'all'"> · filtered by <strong>{{ activeFilterLabel }}</strong></span>
                </div>

                <div v-if="filteredNonExportedAll.length === 0" class="text-center pa-6 text-medium-emphasis">
                  <v-icon size="36" class="mb-2">mdi-filter-off-outline</v-icon>
                  <div>No services match the current filter.</div>
                </div>

                <v-expansion-panels v-else variant="accordion">
                  <v-expansion-panel v-for="service in filteredNonExportedServices" :key="service.name">
                    <v-expansion-panel-title :expand-icon="hasDetails(service) ? undefined : ''">
                      <div class="d-flex align-center w-100 gap-2" style="min-width:0;">
                        <v-btn variant="text" icon size="small" @click.stop="getFileAndService(service)" :disabled="!decompiledServices.has(service.name)">
                          <v-icon size="18" :color="decompiledServices.has(service.name) ? 'primary' : 'grey'">mdi-xml</v-icon>
                        </v-btn>
                        <v-tooltip :text="service.name" location="top">
                          <template v-slot:activator="{ props }">
                            <span v-bind="props" class="component-name text-body-2">{{ service.name }}</span>
                          </template>
                        </v-tooltip>
                        <v-spacer></v-spacer>
                        <div class="d-flex align-center gap-1 flex-shrink-0">
                          <v-chip v-if="hasIntentFilters(service)" size="x-small" color="primary" variant="tonal">
                            <v-icon start size="12">mdi-filter-variant</v-icon>
                            {{ service.intentFilters.length }}
                          </v-chip>
                        </div>
                      </div>
                    </v-expansion-panel-title>
                    <v-expansion-panel-text v-if="hasDetails(service)">
                      <v-expansion-panels variant="accordion" class="mt-2">
                        <v-expansion-panel v-if="hasIntentFilters(service)">
                          <v-expansion-panel-title>
                            <v-icon class="mr-2" size="18">mdi-filter-variant</v-icon>
                            Intent Filters ({{ service.intentFilters.length }})
                          </v-expansion-panel-title>
                          <v-expansion-panel-text>
                            <intent-filters :filters="service.intentFilters"></intent-filters>
                          </v-expansion-panel-text>
                        </v-expansion-panel>
                        <v-expansion-panel v-if="service.manifestSnippet">
                          <v-expansion-panel-title>
                            <v-icon class="mr-2" size="18">mdi-code-tags</v-icon>
                            Manifest Declaration
                          </v-expansion-panel-title>
                          <v-expansion-panel-text>
                            <div v-highlight>
                              <pre class="language-xml manifest-code"><code>{{ service.manifestSnippet }}</code></pre>
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
          </v-tabs-window-item>
        </v-tabs-window>
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
import IntentFilters from "@/components/Filters/IntentFilters.vue";
import axios from 'axios';

export default {
  name: 'ServicesDialog',
  components: { IntentFilters },
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
    const localTab = ref(props.tab || 'exported');
    const services = ref({ exported: [], non_exported: [] });
    const decompiledServices = ref(new Set());
    const quickFilter = ref('all');
    const currentPage = ref(1);
    const itemsPerPage = ref(50);

    const closeDialog = () => emit('update:dialog', false);

    const showSnackbar = (message, color = 'error') => {
      snackbarText.value = message;
      snackbarColor.value = color;
      snackbar.value = true;
    };

    const hasIntentFilters = (s) => s.intentFilters?.length > 0;
    const hasDetails = (s) => hasIntentFilters(s) || !!s.manifestSnippet;
    const servicePriority = (s) => hasIntentFilters(s) ? 1 : 0;

    function buildFiltered(list) {
      let result = list;
      if (search.value) {
        const q = search.value.toLowerCase();
        result = result.filter(s => s.name.toLowerCase().includes(q));
      }
      if (quickFilter.value === 'intentfilter') result = result.filter(hasIntentFilters);
      return [...result].sort((a, b) => {
        const pd = servicePriority(b) - servicePriority(a);
        return pd !== 0 ? pd : a.name.localeCompare(b.name);
      });
    }

    const filteredExportedAll = computed(() => buildFiltered(services.value.exported));
    const filteredNonExportedAll = computed(() => buildFiltered(services.value.non_exported));

    const filteredExportedServices = computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage.value;
      return filteredExportedAll.value.slice(start, start + itemsPerPage.value);
    });
    const filteredNonExportedServices = computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage.value;
      return filteredNonExportedAll.value.slice(start, start + itemsPerPage.value);
    });

    const totalExportedPages = computed(() => Math.ceil(filteredExportedAll.value.length / itemsPerPage.value));
    const totalNonExportedPages = computed(() => Math.ceil(filteredNonExportedAll.value.length / itemsPerPage.value));

    const quickFilters = computed(() => {
      const src = localTab.value === 'exported' ? services.value.exported : services.value.non_exported;
      return [
        { value: 'all',          label: 'All',                icon: null,                 count: src.length },
        { value: 'intentfilter', label: 'Has Intent Filter',  icon: 'mdi-filter-variant', count: src.filter(hasIntentFilters).length },
      ];
    });

    const activeFilterLabel = computed(() =>
      quickFilters.value.find(f => f.value === quickFilter.value)?.label ?? ''
    );

    const getFileAndService = async (service) => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/engine/decompiled/${props.filename}/${service.name}`);
        if (response.data?.java_code) {
          await store.dispatch('setCodeViewerData', { code: response.data.java_code, filename: props.filename, componentName: service.name });
          props.openCodeViewer();
        } else {
          showSnackbar('No code available for this service.', 'warning');
        }
      } catch (error) {
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
          decompiledServices.value = confirmed;
        }
      } catch { /* silently degrade */ }
    };

    const fetchServices = async () => {
      if (!props.filename) return;
      decompiledServices.value = new Set();
      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/audit/services/${props.filename}`);
        services.value = response.data;
        const names = [...services.value.exported, ...services.value.non_exported].map(s => s.name);
        if (names.length) await checkBatchStatus(names);
      } catch {
        showSnackbar('Error fetching services', 'error');
      }
    };

    onMounted(fetchServices);
    watch(() => props.filename, fetchServices);
    watch(() => props.dialog, (v) => { if (v) fetchServices(); });
    watch(() => props.tab, (v) => { localTab.value = v; });
    watch(localTab, (v) => emit('update:tab', v));
    watch([search, quickFilter, localTab], () => { currentPage.value = 1; });

    return {
      search, quickFilter, quickFilters, activeFilterLabel,
      closeDialog, getFileAndService,
      isDark: computed(() => store.state.isDark),
      services, decompiledServices,
      filteredExportedAll, filteredNonExportedAll,
      filteredExportedServices, filteredNonExportedServices,
      totalExportedPages, totalNonExportedPages,
      snackbar, snackbarText, snackbarColor,
      localTab, currentPage, itemsPerPage,
      hasIntentFilters, hasDetails,
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
