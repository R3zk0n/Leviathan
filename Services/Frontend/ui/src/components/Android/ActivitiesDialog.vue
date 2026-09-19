<template>
  <v-dialog :model-value="dialog" @update:model-value="closeDialog" max-width="1000px">
    <v-card :class="isDark ? 'theme--dark' : 'theme--light'">
      <v-card-title class="headline d-flex align-center gap-2">
        Activities
        <v-chip v-if="browsableCount > 0" size="small" color="warning" variant="tonal" class="ml-2">
          <v-icon start size="14">mdi-web</v-icon>
          {{ browsableCount }} Browsable
        </v-chip>
      </v-card-title>

      <v-card-subtitle class="pb-0 pt-2">
        <v-text-field
          v-model="search"
          label="Search activities..."
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          hide-details
          clearable
          class="mb-2"
        ></v-text-field>
        <!-- Quick filter chips -->
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

      <v-card-text v-if="loading">
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
        Loading activities...
      </v-card-text>

      <div v-else class="d-flex flex-row">
        <v-tabs :model-value="tab" @update:model-value="updateTab" background-color="primary" direction="vertical">
          <v-tab prepend-icon="mdi-export" value="exported">
            Exported
            <v-chip size="x-small" class="ml-1" color="error" variant="tonal">{{ activities.exported.length }}</v-chip>
          </v-tab>
          <v-tab prepend-icon="mdi-lock-outline" value="non_exported">
            Non-Exported
            <v-chip size="x-small" class="ml-1" variant="tonal">{{ activities.non_exported.length }}</v-chip>
          </v-tab>
        </v-tabs>

        <v-window :model-value="tab" @update:model-value="updateTab">
          <!-- ── Exported tab ── -->
          <v-window-item value="exported">
            <v-card flat>
              <v-card-text>
                <div class="mb-2 text-caption text-medium-emphasis">
                  Showing {{ filteredExportedActivities.length }} of {{ activities.exported.length }} exported activities
                  <span v-if="quickFilter !== 'all'"> · filtered by <strong>{{ activeFilterLabel }}</strong></span>
                </div>

                <div v-if="filteredExportedAll.length === 0" class="text-center pa-6 text-medium-emphasis">
                  <v-icon size="36" class="mb-2">mdi-filter-off-outline</v-icon>
                  <div>No activities match the current filter.</div>
                </div>

                <v-expansion-panels v-else variant="accordion">
                  <v-expansion-panel
                    v-for="activity in filteredExportedActivities"
                    :key="activity.name"
                    :value="activity.name"
                  >
                    <v-expansion-panel-title :expand-icon="hasDetails(activity) ? undefined : ''">
                      <div class="d-flex align-center w-100 gap-2" style="min-width:0;">
                        <v-btn
                          variant="text"
                          icon
                          size="small"
                          @click.stop="getFileAndActivity(activity)"
                          :disabled="!decompiledActivities.has(activity.name)"
                        >
                          <v-icon size="18" :color="decompiledActivities.has(activity.name) ? 'primary' : 'grey'">mdi-xml</v-icon>
                        </v-btn>

                        <v-tooltip :text="activity.name" location="top">
                          <template v-slot:activator="{ props }">
                            <span class="activity-name text-body-2" v-bind="props">{{ activity.name }}</span>
                          </template>
                        </v-tooltip>

                        <v-spacer></v-spacer>

                        <div class="d-flex align-center gap-1 flex-shrink-0">
                          <v-chip v-if="isBrowsable(activity)" size="x-small" color="warning" variant="flat">
                            <v-icon start size="12">mdi-web</v-icon>BROWSABLE
                          </v-chip>
                          <v-chip v-if="hasDeepLinks(activity) && !isBrowsable(activity)" size="x-small" color="info" variant="tonal">
                            <v-icon start size="12">mdi-link</v-icon>DEEP LINK
                          </v-chip>
                          <v-chip v-if="hasIntentFilters(activity)" size="x-small" color="primary" variant="tonal">
                            <v-icon start size="12">mdi-filter-variant</v-icon>
                            {{ activity.intentFilters.length }}
                          </v-chip>
                        </div>
                      </div>
                    </v-expansion-panel-title>

                    <v-expansion-panel-text v-if="hasDetails(activity)">
                      <v-expansion-panels variant="accordion" class="mt-2">
                        <v-expansion-panel v-if="hasIntentFilters(activity)">
                          <v-expansion-panel-title>
                            <v-icon class="mr-2" size="18">mdi-filter-variant</v-icon>
                            Intent Filters ({{ activity.intentFilters.length }})
                          </v-expansion-panel-title>
                          <v-expansion-panel-text>
                            <intent-filters :filters="activity.intentFilters"></intent-filters>
                          </v-expansion-panel-text>
                        </v-expansion-panel>

                        <v-expansion-panel v-if="activity.manifestSnippet">
                          <v-expansion-panel-title>
                            <v-icon class="mr-2" size="18">mdi-code-tags</v-icon>
                            Manifest Declaration
                          </v-expansion-panel-title>
                          <v-expansion-panel-text>
                            <div v-highlight>
                              <pre class="language-xml manifest-code"><code>{{ activity.manifestSnippet }}</code></pre>
                            </div>
                          </v-expansion-panel-text>
                        </v-expansion-panel>
                      </v-expansion-panels>
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                </v-expansion-panels>

                <v-pagination
                  v-if="totalExportedPages > 1"
                  v-model="currentPage"
                  :length="totalExportedPages"
                  :total-visible="7"
                  class="mt-4"
                ></v-pagination>
              </v-card-text>
            </v-card>
          </v-window-item>

          <!-- ── Non-Exported tab ── -->
          <v-window-item value="non_exported">
            <v-card flat>
              <v-card-text>
                <div class="mb-2 text-caption text-medium-emphasis">
                  Showing {{ filteredNonExportedActivities.length }} of {{ activities.non_exported.length }} non-exported activities
                  <span v-if="quickFilter !== 'all'"> · filtered by <strong>{{ activeFilterLabel }}</strong></span>
                </div>

                <div v-if="filteredNonExportedAll.length === 0" class="text-center pa-6 text-medium-emphasis">
                  <v-icon size="36" class="mb-2">mdi-filter-off-outline</v-icon>
                  <div>No activities match the current filter.</div>
                </div>

                <v-expansion-panels v-else variant="accordion">
                  <v-expansion-panel
                    v-for="activity in filteredNonExportedActivities"
                    :key="activity.name"
                    :value="activity.name"
                  >
                    <v-expansion-panel-title :expand-icon="hasDetails(activity) ? undefined : ''">
                      <div class="d-flex align-center w-100 gap-2" style="min-width:0;">
                        <v-btn
                          variant="text"
                          icon
                          size="small"
                          @click.stop="getFileAndActivity(activity)"
                          :disabled="!decompiledActivities.has(activity.name)"
                        >
                          <v-icon size="18" :color="decompiledActivities.has(activity.name) ? 'primary' : 'grey'">mdi-xml</v-icon>
                        </v-btn>

                        <v-tooltip :text="activity.name" location="top">
                          <template v-slot:activator="{ props }">
                            <span class="activity-name text-body-2" v-bind="props">{{ activity.name }}</span>
                          </template>
                        </v-tooltip>

                        <v-spacer></v-spacer>

                        <div class="d-flex align-center gap-1 flex-shrink-0">
                          <v-chip v-if="isBrowsable(activity)" size="x-small" color="warning" variant="flat">
                            <v-icon start size="12">mdi-web</v-icon>BROWSABLE
                          </v-chip>
                          <v-chip v-if="hasDeepLinks(activity) && !isBrowsable(activity)" size="x-small" color="info" variant="tonal">
                            <v-icon start size="12">mdi-link</v-icon>DEEP LINK
                          </v-chip>
                          <v-chip v-if="hasIntentFilters(activity)" size="x-small" color="primary" variant="tonal">
                            <v-icon start size="12">mdi-filter-variant</v-icon>
                            {{ activity.intentFilters.length }}
                          </v-chip>
                        </div>
                      </div>
                    </v-expansion-panel-title>

                    <v-expansion-panel-text v-if="hasDetails(activity)">
                      <v-expansion-panels variant="accordion" class="mt-2">
                        <v-expansion-panel v-if="hasIntentFilters(activity)">
                          <v-expansion-panel-title>
                            <v-icon class="mr-2" size="18">mdi-filter-variant</v-icon>
                            Intent Filters ({{ activity.intentFilters.length }})
                          </v-expansion-panel-title>
                          <v-expansion-panel-text>
                            <intent-filters :filters="activity.intentFilters"></intent-filters>
                          </v-expansion-panel-text>
                        </v-expansion-panel>

                        <v-expansion-panel v-if="activity.manifestSnippet">
                          <v-expansion-panel-title>
                            <v-icon class="mr-2" size="18">mdi-code-tags</v-icon>
                            Manifest Declaration
                          </v-expansion-panel-title>
                          <v-expansion-panel-text>
                            <div v-highlight>
                              <pre class="language-xml manifest-code"><code>{{ activity.manifestSnippet }}</code></pre>
                            </div>
                          </v-expansion-panel-text>
                        </v-expansion-panel>
                      </v-expansion-panels>
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                </v-expansion-panels>

                <v-pagination
                  v-if="totalNonExportedPages > 1"
                  v-model="currentPage"
                  :length="totalNonExportedPages"
                  :total-visible="7"
                  class="mt-4"
                ></v-pagination>
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
  <v-snackbar v-model="snackbar" :timeout="3000" color="error">
    {{ snackbarText }}
  </v-snackbar>
</template>

<script>
import { ref, computed, watch } from 'vue';
import { useStore } from 'vuex';
import IntentFilters from "@/components/Filters/IntentFilters.vue";
import axios from 'axios';

const BROWSABLE = 'android.intent.category.BROWSABLE';

export default {
  name: 'ActivitiesDialog',
  components: { IntentFilters },
  props: {
    dialog: Boolean,
    tab: String,
    filename: String,
    openCodeViewer: {
      type: Function,
      required: true
    },
  },
  setup(props, { emit }) {
    const store = useStore();
    const search = ref('');
    const snackbar = ref(false);
    const snackbarText = ref('');
    const activities = ref({ exported: [], non_exported: [] });
    const decompiledActivities = ref(new Set()); // whitelist — only filled when confirmed decompiled
    const loading = ref(true);
    const expanded = ref([]);
    const quickFilter = ref('all');
    const currentPage = ref(1);
    const itemsPerPage = ref(50);

    const closeDialog = () => emit('update:dialog', false);
    const updateTab = (value) => emit('update:tab', value);

    const showSnackbar = (message) => {
      snackbarText.value = message;
      snackbar.value = true;
    };

    // ── Activity helpers ──────────────────────────────────────────────────────
    const hasIntentFilters = (a) => a.intentFilters?.length > 0;
    const hasDetails = (a) => hasIntentFilters(a) || !!a.manifestSnippet;

    const isBrowsable = (a) =>
      a.intentFilters?.some(f => f.categories?.includes(BROWSABLE)) ?? false;

    const hasDeepLinks = (a) =>
      a.intentFilters?.some(f => (f.schemes?.length ?? 0) > 0 || (f.host?.length ?? 0) > 0) ?? false;

    const activityPriority = (a) => {
      if (isBrowsable(a)) return 3;
      if (hasDeepLinks(a)) return 2;
      if (hasIntentFilters(a)) return 1;
      return 0;
    };

    // ── Filter + sort pipeline ────────────────────────────────────────────────
    function buildFiltered(list) {
      let result = list;
      if (search.value) {
        const q = search.value.toLowerCase();
        result = result.filter(a => a.name.toLowerCase().includes(q));
      }
      if (quickFilter.value === 'browsable') result = result.filter(isBrowsable);
      else if (quickFilter.value === 'deeplink') result = result.filter(hasDeepLinks);
      else if (quickFilter.value === 'intentfilter') result = result.filter(hasIntentFilters);

      return [...result].sort((a, b) => {
        const pd = activityPriority(b) - activityPriority(a);
        return pd !== 0 ? pd : a.name.localeCompare(b.name);
      });
    }

    const filteredExportedAll = computed(() => buildFiltered(activities.value.exported));
    const filteredNonExportedAll = computed(() => buildFiltered(activities.value.non_exported));

    const filteredExportedActivities = computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage.value;
      return filteredExportedAll.value.slice(start, start + itemsPerPage.value);
    });
    const filteredNonExportedActivities = computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage.value;
      return filteredNonExportedAll.value.slice(start, start + itemsPerPage.value);
    });

    const totalExportedPages = computed(() =>
      Math.ceil(filteredExportedAll.value.length / itemsPerPage.value)
    );
    const totalNonExportedPages = computed(() =>
      Math.ceil(filteredNonExportedAll.value.length / itemsPerPage.value)
    );

    // ── Quick filter chips ────────────────────────────────────────────────────
    const browsableCount = computed(() =>
      activities.value.exported.filter(isBrowsable).length +
      activities.value.non_exported.filter(isBrowsable).length
    );

    const quickFilters = computed(() => {
      const src = props.tab === 'exported'
        ? activities.value.exported
        : activities.value.non_exported;
      return [
        { value: 'all',          label: 'All',                icon: null,                  count: src.length },
        { value: 'browsable',    label: 'Browsable',          icon: 'mdi-web',             count: src.filter(isBrowsable).length },
        { value: 'deeplink',     label: 'Deep Link',          icon: 'mdi-link',            count: src.filter(hasDeepLinks).length },
        { value: 'intentfilter', label: 'Has Intent Filter',  icon: 'mdi-filter-variant',  count: src.filter(hasIntentFilters).length },
      ];
    });

    const activeFilterLabel = computed(() =>
      quickFilters.value.find(f => f.value === quickFilter.value)?.label ?? ''
    );

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const getFileAndActivity = async (activity) => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_APP_API_URL}/engine/decompiled/${props.filename}/${activity.name}`
        );
        if (response.data?.java_code) {
          await store.dispatch('setCodeViewerData', {
            code: response.data.java_code,
            filename: props.filename,
            componentName: activity.name,
          });
          props.openCodeViewer();
        } else {
          showSnackbar('No code available for this activity.');
        }
      } catch (error) {
        if (error.response?.status === 500) {
          if (!failedActivities.value.includes(activity.name)) {
            failedActivities.value.push(activity.name);
          }
        }
        showSnackbar('An error occurred while fetching the code.');
      }
    };

    const checkActivitiesStatusBatch = async (activityNames) => {
      try {
        const response = await axios.post(
          `${import.meta.env.VITE_APP_API_URL}/engine/decompiled/${props.filename}/batch-status`,
          { items: activityNames }
        );
        if (response.data?.status) {
          const confirmed = new Set();
          for (const [name, exists] of Object.entries(response.data.status)) {
            if (exists) confirmed.add(name);
          }
          decompiledActivities.value = confirmed;
        }
      } catch {
        // silently degrade — icons stay greyed out (safe default)
      }
    };

    const fetchActivities = async () => {
      if (!props.filename) { loading.value = false; return; }
      loading.value = true;
      decompiledActivities.value = new Set();
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_APP_API_URL}/audit/activities/${props.filename}`
        );
        activities.value = response.data;
        const names = [
          ...activities.value.exported,
          ...activities.value.non_exported,
        ].map(a => a.name);
        if (names.length) await checkActivitiesStatusBatch(names);
      } catch {
        showSnackbar('Error fetching activities.');
      } finally {
        loading.value = false;
      }
    };

    watch(() => props.dialog, (v) => { if (v) fetchActivities(); });
    watch(() => props.filename, () => { if (props.dialog) fetchActivities(); });
    watch([search, quickFilter, () => props.tab], () => { currentPage.value = 1; });

    return {
      search,
      quickFilter,
      quickFilters,
      activeFilterLabel,
      browsableCount,
      closeDialog,
      updateTab,
      getFileAndActivity,
      isDark: computed(() => store.state.isDark),
      activities,
      filteredExportedAll,
      filteredNonExportedAll,
      filteredExportedActivities,
      filteredNonExportedActivities,
      totalExportedPages,
      totalNonExportedPages,
      decompiledActivities,
      loading,
      expanded,
      currentPage,
      itemsPerPage,
      snackbar,
      snackbarText,
      hasIntentFilters,
      hasDetails,
      isBrowsable,
      hasDeepLinks,
    };
  },
};
</script>

<style scoped>
.activity-name {
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
.theme--dark .v-expansion-panel-text {
  background-color: #1e1e1e;
  color: #ffffff;
}
.theme--light .v-card,
.theme--light .v-card-subtitle,
.theme--light .v-card-title,
.theme--light .v-text-field,
.theme--light .v-expansion-panel-title,
.theme--light .v-expansion-panel-text {
  background-color: #ffffff;
  color: #000000;
}
:deep(.v-expansion-panel-title__overlay) {
  display: none;
}
.theme--dark :deep(.text-medium-emphasis),
.theme--dark :deep(.text-caption),
.theme--dark :deep(.text-body-2) {
  color: rgba(255, 255, 255, 0.7) !important;
}
.manifest-code {
  margin: 0;
  padding: 12px;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  max-width: 100%;
  overflow-x: auto;
}
.theme--dark .manifest-code {
  background-color: #272822 !important;
  color: #f8f8f2;
}
.theme--light .manifest-code {
  background-color: #fbfbfb !important;
  color: #abb2bf;
  border: 1px solid #e0e0e0;
}
.theme--light .manifest-code code {
  color: #abb2bf !important;
}
</style>
