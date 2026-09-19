<template>
  <v-container v-if="hasFilters" class="pa-0">
    <v-expansion-panels :class="isDark ? 'theme--dark' : 'theme--light'">
      <v-expansion-panel
        v-for="(filter, index) in nonEmptyFilters"
        :key="filterKey(filter)"
        :value="index"
      >
        <v-expansion-panel-title>
          <div class="d-flex align-center gap-2 w-100">
            <v-icon color="primary" size="18">mdi-code-brackets</v-icon>
            <span>{{ getFilterName(filter) || `Intent Filter ${index + 1}` }}</span>
            <v-spacer></v-spacer>
            <!-- Inline signal badges on the panel title -->
            <v-chip
              v-if="filterIsBrowsable(filter)"
              size="x-small"
              color="warning"
              variant="flat"
              class="font-weight-medium"
            >
              <v-icon start size="12">mdi-web</v-icon>
              BROWSABLE
            </v-chip>
            <v-chip
              v-if="getUniqueItems(filter.schemes).length || (filter.host && filter.host.length)"
              size="x-small"
              color="info"
              variant="tonal"
            >
              <v-icon start size="12">mdi-link</v-icon>
              {{ buildUriPreview(filter) || 'URI' }}
            </v-chip>
          </div>
        </v-expansion-panel-title>

        <v-expansion-panel-text>
          <v-card flat :class="isDark ? 'theme--dark' : 'theme--light'">
            <v-card-text class="pa-2">

              <!-- Reconstructed URI pattern (if scheme or host present) -->
              <div v-if="buildUriPreview(filter)" class="mb-3">
                <v-row no-gutters align="center" class="mb-1">
                  <v-col cols="auto">
                    <v-icon icon="mdi-link-variant" color="info" size="small" class="mr-2"></v-icon>
                  </v-col>
                  <v-col>
                    <span class="text-subtitle-2 font-weight-bold">URI Pattern</span>
                  </v-col>
                </v-row>
                <v-chip
                  v-for="uri in buildAllUriPatterns(filter)"
                  :key="uri"
                  class="ma-1 font-mono"
                  size="small"
                  color="info"
                  variant="tonal"
                >{{ uri }}</v-chip>
              </div>

              <!-- Actions -->
              <template v-for="(section, sectionKey) in sections" :key="sectionKey">
                <div v-if="getUniqueItems(filter[sectionKey]).length" class="mb-3">
                  <v-row no-gutters align="center" class="mb-1">
                    <v-col cols="auto">
                      <v-icon :icon="section.icon" color="primary" size="small" class="mr-2"></v-icon>
                    </v-col>
                    <v-col>
                      <span class="text-subtitle-2 font-weight-bold">{{ section.title }}</span>
                    </v-col>
                  </v-row>
                  <template v-for="item in getUniqueItems(filter[sectionKey])" :key="item">
                    <!-- BROWSABLE category gets special treatment -->
                    <v-chip
                      v-if="sectionKey === 'categories' && item === BROWSABLE"
                      class="ma-1"
                      size="small"
                      color="warning"
                      variant="flat"
                    >
                      <v-icon start size="14">mdi-web</v-icon>
                      {{ item }}
                    </v-chip>
                    <v-chip
                      v-else
                      class="ma-1"
                      size="small"
                      color="primary"
                      :variant="isDark ? 'flat' : 'outlined'"
                    >{{ item }}</v-chip>
                  </template>
                </div>
              </template>

              <!-- Hosts -->
              <div v-if="filter.host && filter.host.length" class="mb-3">
                <v-row no-gutters align="center" class="mb-1">
                  <v-col cols="auto">
                    <v-icon icon="mdi-server" color="primary" size="small" class="mr-2"></v-icon>
                  </v-col>
                  <v-col>
                    <span class="text-subtitle-2 font-weight-bold">Hosts</span>
                  </v-col>
                </v-row>
                <v-chip
                  v-for="host in getUniqueItems(filter.host)"
                  :key="host"
                  class="ma-1"
                  size="small"
                  color="primary"
                  :variant="isDark ? 'flat' : 'outlined'"
                >{{ host }}</v-chip>
              </div>

            </v-card-text>
          </v-card>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </v-container>
  <v-container v-else class="pa-0">
    <v-alert type="info" text="No intent filters found." variant="tonal"></v-alert>
  </v-container>
</template>

<script>
import { computed } from 'vue';
import { useStore } from 'vuex';

const BROWSABLE = 'android.intent.category.BROWSABLE';

export default {
  props: ['filters'],
  setup(props) {
    const store = useStore();
    const isDark = computed(() => store.state.isDark);

    const hasFilters = computed(() =>
      props.filters &&
      Array.isArray(props.filters) &&
      props.filters.length > 0 &&
      props.filters.some(isNonEmptyFilter)
    );

    const nonEmptyFilters = computed(() => props.filters.filter(isNonEmptyFilter));

    function isNonEmptyFilter(filter) {
      return Object.values(filter).some(v => Array.isArray(v) && v.length > 0);
    }

    function getFilterName(filter) {
      return filter.metaData?.name ?? null;
    }

    function getUniqueItems(items) {
      if (!Array.isArray(items)) return [];
      return [...new Set(items)];
    }

    function filterIsBrowsable(filter) {
      return filter.categories?.includes(BROWSABLE) ?? false;
    }

    /** Build a short preview string like "https://" or "myapp://" */
    function buildUriPreview(filter) {
      const schemes = getUniqueItems(filter.schemes);
      const hosts = getUniqueItems(filter.host);
      if (!schemes.length && !hosts.length) return null;
      const scheme = schemes[0] ?? '*';
      const host = hosts[0] ?? (schemes.length ? '…' : null);
      return host ? `${scheme}://${host}` : `${scheme}://`;
    }

    /** Build all scheme × host combinations as URI strings */
    function buildAllUriPatterns(filter) {
      const schemes = getUniqueItems(filter.schemes);
      const hosts = getUniqueItems(filter.host);
      if (!schemes.length && !hosts.length) return [];
      if (!schemes.length) return hosts.map(h => `*://${h}`);
      if (!hosts.length) return schemes.map(s => `${s}://`);
      const patterns = [];
      for (const s of schemes) {
        for (const h of hosts) {
          patterns.push(`${s}://${h}`);
        }
      }
      return patterns;
    }

    function filterKey(filter) {
      return [
        getUniqueItems(filter.actions).join(','),
        getUniqueItems(filter.categories).join(','),
        getUniqueItems(filter.schemes).join(','),
        filter.host ? getUniqueItems(filter.host).join(',') : '',
        getUniqueItems(filter.mimeTypes).join(','),
        filter.metaData ? Object.keys(filter.metaData).join(',') : '',
      ].join('|');
    }

    return {
      isDark,
      hasFilters,
      nonEmptyFilters,
      getFilterName,
      getUniqueItems,
      filterIsBrowsable,
      buildUriPreview,
      buildAllUriPatterns,
      filterKey,
      BROWSABLE,
      sections: {
        actions:    { title: 'Actions',     icon: 'mdi-lightning-bolt' },
        categories: { title: 'Categories',  icon: 'mdi-shape' },
        schemes:    { title: 'URI Schemes', icon: 'mdi-link' },
        mimeTypes:  { title: 'MIME Types',  icon: 'mdi-file-outline' },
      },
    };
  },
};
</script>

<style scoped>
.font-mono {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
}
.theme--dark.v-expansion-panels,
.theme--dark .v-expansion-panel,
.theme--dark .v-card {
  background-color: #1e1e1e;
  color: #ffffff;
}
.theme--light.v-expansion-panels,
.theme--light .v-expansion-panel,
.theme--light .v-card {
  background-color: #ffffff;
  color: #000000;
}
.theme--dark .v-expansion-panel-title,
.theme--dark .v-expansion-panel-text {
  color: #ffffff;
}
.theme--light .v-expansion-panel-title,
.theme--light .v-expansion-panel-text {
  color: #000000;
}
</style>
