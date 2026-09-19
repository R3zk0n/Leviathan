<template>
  <v-expansion-panel
    :class="{ 'theme--dark': isDark, 'theme--light': !isDark }"
    :value="panelValue"
  >
    <v-expansion-panel-title>
      {{ issue.name }}
      <template #actions>
        <v-chip :color="severityColor" class="ml-2">{{ filteredCount }}</v-chip>
      </template>
    </v-expansion-panel-title>

    <v-expansion-panel-text>
      <p><strong>Detail:</strong> {{ issue.detail }}</p>
      <p><strong>Model:</strong> {{ issue.model }}</p>
      <v-divider class="my-4" />
      <h3 class="text-h6 mb-2">Vulnerabilities ({{ filteredCount }})</h3>

      <div v-if="filteredCount > itemsPerPage" class="pagination-wrapper my-4">
        <v-pagination
          v-model="issue.currentPage"
          :length="pageCount"
          :disabled="issue.isLoadingPage"
          color="primary"
          :total-visible="5"
          @update:model-value="(page) => $emit('page-change', page)"
        />
      </div>

      <v-fade-transition>
        <div v-if="issue.isLoadingPage" class="text-center my-4 loading-indicator">
          <v-progress-circular indeterminate color="secondary" size="24" />
          <div class="mt-2">Loading page data...</div>
        </div>

        <v-container
          v-else
          :key="`${issue.name}-${issue.currentPage}-${exportFilter}`"
          class="vuln-container"
          :style="containerStyle"
        >
          <vulnerability-details
            v-for="(vuln, vulnIndex) in issue.paginatedVulnerabilities"
            :key="`${issue.name}-${issue.currentPage}-${vulnIndex}`"
            :vulnerability="vuln"
            :index="(issue.currentPage - 1) * itemsPerPage + vulnIndex"
            :isDark="isDark"
            :appName="appName"
            :allow-suppress="allowSuppress"
            @view-details="$emit('view-details', $event)"
            @view-code="$emit('view-code', $event)"
            @view-split-view="$emit('view-split-view', $event)"
            @suppression-changed="$emit('suppression-changed', $event)"
            @show-snackbar="$emit('show-snackbar', $event)"
          />

          <div
            v-if="issue.paginatedVulnerabilities.length === 0"
            class="text-center pa-4 empty-state"
          >
            <v-icon large color="grey lighten-1" class="mb-2">mdi-alert-circle-outline</v-icon>
            <p>No vulnerabilities match the current filter criteria</p>
          </div>
        </v-container>
      </v-fade-transition>

      <div v-if="filteredCount > itemsPerPage" class="pagination-wrapper my-4">
        <v-pagination
          v-model="issue.currentPage"
          :length="pageCount"
          :disabled="issue.isLoadingPage"
          color="primary"
          :total-visible="5"
          @update:model-value="(page) => $emit('page-change', page)"
        />
      </div>
    </v-expansion-panel-text>
  </v-expansion-panel>
</template>

<script setup>
import { computed } from 'vue';
import VulnerabilityDetails from './VulnerabilityDetails.vue';

const props = defineProps({
  issue:        { type: Object,  required: true },
  panelValue:   { type: Number,  required: true },
  isDark:       { type: Boolean, default: false },
  appName:      { type: String,  default: '' },
  itemsPerPage: { type: Number,  default: 10 },
  filteredCount:{ type: Number,  default: 0 },
  exportFilter: { type: String,  default: 'All' },
  allowSuppress:{ type: Boolean, default: true },
});

defineEmits([
  'page-change',
  'view-details',
  'view-code',
  'view-split-view',
  'suppression-changed',
  'show-snackbar',
]);

const pageCount = computed(() =>
  Math.max(1, Math.ceil(props.filteredCount / props.itemsPerPage))
);

const containerStyle = computed(() => ({
  backgroundColor: props.isDark ? '#1E1E1E' : '#FFFFFF',
  color:           props.isDark ? '#F5F5F5' : '#333333',
  transition:      'opacity 0.3s ease',
}));

const severityColor = computed(() => {
  const sev = props.issue.possibility;
  if (!sev) return 'grey';
  const n = parseInt(sev);
  if (isNaN(n)) {
    switch (String(sev).toLowerCase()) {
      case 'high':   return 'error';
      case 'medium': return 'warning';
      case 'low':    return 'info';
      default:       return 'grey';
    }
  }
  if (n === 2) return 'error';
  if (n === 1) return 'warning';
  return 'info';
});
</script>

<style scoped>
.vuln-container {
  transition: opacity 0.3s ease;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
}

.loading-indicator {
  padding: 20px;
  border-radius: 8px;
}
</style>
