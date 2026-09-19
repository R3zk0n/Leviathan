<template>
  <v-container :class="{ 'theme--dark': isDark, 'theme--light': !isDark }">
    <v-row>
      <v-col>
        <h1 class="text-h4 mb-4">Scan Results for {{ currentApplication }}</h1>
        <v-btn @click="goBack" color="primary" class="mb-4">Back to Dashboard</v-btn>
        <v-tooltip bottom>
          <template v-slot:activator="{ on, attrs }">
            <v-btn
              icon
              v-bind="attrs"
              v-on="on"
              @click="openGeneratePDF"
              :class="isDark ? 'btn-dark' : ''"
            >
              <v-icon>mdi-file-pdf-box</v-icon>
            </v-btn>
          </template>
          <span>Generate PDF Report</span>
        </v-tooltip>
        <v-tooltip location="bottom">
          <template v-slot:activator="{ props }">
            <v-switch
              v-bind="props"
              v-model="showPartial"
              label="Partial results"
              color="warning"
              density="compact"
              hide-details
              inset
              class="d-inline-flex align-center ml-4"
            ></v-switch>
          </template>
          <span>Show findings from an incomplete/interrupted scan (results_partial.json) so you can research while the full scan re-runs. Not a completed result.</span>
        </v-tooltip>
      </v-col>
    </v-row>

    <v-row v-if="applicationResults && isPartialResults">
      <v-col>
        <v-alert type="warning" variant="tonal">
          Partial results mode is enabled. Findings are based on HTML artifacts only, so
          accessibility may be shown as UNKNOWN and false-positive marking is disabled.
        </v-alert>
      </v-col>
    </v-row>

    <v-row v-if="loading">
      <v-col class="text-center">
        <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
        <div class="mt-4">Loading scan results...</div>
      </v-col>
    </v-row>

    <v-row v-else-if="error">
      <v-col>
        <v-alert type="error">{{ error }}</v-alert>
      </v-col>
    </v-row>

    <template v-else-if="applicationResults">
      <v-row>
        <v-col>
          <v-card :class="{ 'theme--dark': isDark, 'theme--light': !isDark }" class="mb-4">
            <v-card-title>App Information</v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12" sm="6" md="4" v-for="(value, key) in applicationResults.app_info" :key="key">
                  <strong>{{ key }}:</strong> {{ value }}
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-row>
        <v-col>
          <v-card :class="{ 'theme--dark': isDark, 'theme--light': !isDark }" class="mb-4">
            <v-card-title>Manifest Risks</v-card-title>
            <v-card-text>
              <v-chip
                v-for="(value, key) in applicationResults.manifest_risks || {}"
                :key="key"
                :color="value ? 'error' : 'success'"
                class="ma-2"
              >
                {{ key }}: {{ value ? 'Yes' : 'No' }}
              </v-chip>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-row>
        <v-col>
          <v-card :class="{ 'theme--dark': isDark, 'theme--light': !isDark }" class="mb-4">
            <v-card-title>Issues Identified</v-card-title>
            <v-card-text>
              <v-chip
                v-for="(count, issue) in issuesIdentified"
                :key="issue"
                :color="getIssueColor(count)"
                class="ma-2"
              >
                {{ issue }}: {{ count }}
              </v-chip>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-row>
        <v-col>
          <v-card :class="{ 'theme--dark': isDark, 'theme--light': !isDark }">
            <v-card-title class="d-flex align-center">
              <span>Security Issues</span>
              <v-spacer></v-spacer>
              <v-tooltip bottom>
                <template v-slot:activator="{ props }">
                  <v-btn
                    v-bind="props"
                    size="small"
                    variant="tonal"
                    class="mr-2"
                    @click="expandAllPanels"
                    :disabled="!hasAnyFindings"
                  >
                    <v-icon start>mdi-unfold-more-horizontal</v-icon>
                    Expand all
                  </v-btn>
                </template>
                <span>Expand all categories and issue groups</span>
              </v-tooltip>

              <v-tooltip bottom>
                <template v-slot:activator="{ props }">
                  <v-btn
                    v-bind="props"
                    size="small"
                    variant="tonal"
                    class="mr-3"
                    @click="collapseAllPanels"
                    :disabled="!hasAnyFindings"
                  >
                    <v-icon start>mdi-unfold-less-horizontal</v-icon>
                    Collapse all
                  </v-btn>
                </template>
                <span>Collapse all categories and issue groups</span>
              </v-tooltip>

              <v-chip size="small" color="primary" variant="tonal">{{ totalFilteredFindings }} findings</v-chip>
            </v-card-title>
            <v-divider></v-divider>
            <v-tabs v-model="activeTab" color="primary" density="compact">
              <v-tab value="findings">
                Findings
                <v-chip size="x-small" color="primary" variant="tonal" class="ml-2">{{ totalFilteredFindings }}</v-chip>
              </v-tab>
              <v-tab v-if="!isPartialResults" value="false-positives">
                False Positives
                <v-chip v-if="suppressedCount > 0" size="x-small" color="warning" variant="tonal" class="ml-2">{{ suppressedCount }}</v-chip>
              </v-tab>
            </v-tabs>
            <v-divider></v-divider>
            <v-card-text>
              <v-tabs-window v-model="activeTab">
                <v-tabs-window-item value="findings" :eager="true">
                  <v-row dense class="mb-4 align-center report-toolbar">
                    <v-col cols="12" md="4">
                      <v-select
                        v-model="itemsPerPage"
                        :items="itemsPerPageOptions"
                        label="Per page"
                        variant="outlined"
                        density="compact"
                        hide-details
                      />
                    </v-col>
                    <v-col cols="12" md="8" class="d-flex flex-wrap align-center justify-md-end gap-2">
                      <v-btn-toggle
                        v-model="exportFilter"
                        mandatory
                        :class="{ 'dark-theme': isDark }"
                      >
                        <v-btn value="All">ALL</v-btn>
                        <v-btn value="ACCESSIBLE">ACCESSIBLE</v-btn>
                        <v-btn value="PROTECTED">PROTECTED</v-btn>
                      </v-btn-toggle>
                    </v-col>
                  </v-row>

                  <div v-if="isLoadingVulnerabilities" class="text-center my-4">
                    <v-progress-circular indeterminate color="primary" size="32"></v-progress-circular>
                    <div class="mt-2">Loading vulnerability data...</div>
                  </div>

                  <v-expansion-panels v-else v-model="openCategoryPanels" multiple>
                    <v-expansion-panel
                      v-for="(categoryIssues, category, categoryIndex) in groupedSecurityIssues"
                      :key="category"
                      :class="{ 'theme--dark': isDark, 'theme--light': !isDark }"
                      :value="categoryIndex"
                    >
                      <v-expansion-panel-title>
                        {{ category }}
                        <template v-slot:actions>
                          <v-chip
                            :color="getMostSevereCategoryColor(categoryIssues)"
                            class="ml-2"
                          >
                            {{ getCategoryVulnerabilityCount(categoryIssues) }}
                          </v-chip>
                        </template>
                      </v-expansion-panel-title>
                      <v-expansion-panel-text>
                        <v-expansion-panels
                          v-model="openIssuePanelsByCategory[category]"
                          multiple
                        >
                          <security-issue-panel
                            v-for="(issue, index) in categoryIssues"
                            :key="`${category}-${issue.name}-${index}`"
                            :issue="issue"
                            :panel-value="index"
                            :is-dark="isDark"
                            :app-name="currentApplication"
                            :items-per-page="itemsPerPage"
                            :filtered-count="getTotalFilteredVulnerabilities(issue)"
                            :export-filter="exportFilter"
                            :allow-suppress="!isPartialResults"
                            @page-change="(page) => handlePageChange(issue, page)"
                            @view-details="viewVulnerabilityDetails"
                            @view-code="viewVulnerabilityCode"
                            @view-split-view="viewSplitView"
                            @suppression-changed="(e) => handleSuppressionChanged(e, issue)"
                            @show-snackbar="showSnackbar"
                          />
                        </v-expansion-panels>
                      </v-expansion-panel-text>
                    </v-expansion-panel>
                  </v-expansion-panels>
                </v-tabs-window-item>

                <v-tabs-window-item value="false-positives">
                  <div v-if="suppressedCount === 0" class="text-center pa-8">
                    <v-icon size="64" color="grey">mdi-check-circle-outline</v-icon>
                    <div class="mt-4 text-grey">No false positives marked</div>
                  </div>
                  <v-container v-else class="vulnerability-container">
                    <vulnerability-details
                      v-for="({ vuln, issue: fpIssue }, fpIndex) in suppressedVulnerabilities"
                      :key="`fp-${vuln.id}-${fpIndex}`"
                      :vulnerability="vuln"
                      :index="fpIndex"
                      :isDark="isDark"
                      :appName="currentApplication"
                      :allow-suppress="!isPartialResults"
                      @view-details="viewVulnerabilityDetails"
                      @view-code="viewVulnerabilityCode"
                      @view-split-view="viewSplitView"
                      @suppression-changed="(e) => handleSuppressionChanged(e, fpIssue)"
                      @show-snackbar="showSnackbar"
                    />
                  </v-container>
                </v-tabs-window-item>
              </v-tabs-window>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>

    <v-row v-else>
      <v-col>
        <v-alert type="info">No results available for this application.</v-alert>
      </v-col>
    </v-row>

    <Generate
      v-model="generatePDFDialog"
      :application="currentApplication"
      :scan-results="applicationResults"
    />

    <SplitView
      v-model="splitViewDialog"
      :vulnerability-details-html="splitViewVulnerabilityDetailsHtml"
      :isDark="isDark"
    />

    <!-- Updated vulnerability details dialog -->
    <v-dialog
      v-model="vulnerabilityDetailsDialog"
      fullscreen
      hide-overlay
      :retain-focus="false"
      style="background-color: transparent !important;"
    >
      <v-card class="vuln-details-card" style="opacity: 1 !important;">
        <v-toolbar class="vuln-details-toolbar" dark color="primary">
          <v-btn icon dark @click="vulnerabilityDetailsDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
          <v-toolbar-title>Vulnerability Details</v-toolbar-title>
          <v-spacer></v-spacer>
        </v-toolbar>
        <v-card-text class="vuln-details-content pa-0" style="opacity: 1 !important;">
          <SafeReportHtml
            :content="vulnerabilityDetailsContent"
            class="vulnerability-details-content"
          />
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="snackbar.timeout"
    >
      {{ snackbar.message }}
      <template v-slot:actions>
        <v-btn
          color="white"
          text
          @click="snackbar.show = false"
        >
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup>
import SafeReportHtml from '@/components/Common/SafeReportHtml.vue';
import { ref, computed, onMounted, watch, reactive } from 'vue';
import { useStore } from 'vuex';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import VulnerabilityDetails from "@/components/Android/Vulnerabilities/VulnerabilityDetails.vue";
import SecurityIssuePanel from "@/components/Android/Vulnerabilities/SecurityIssuePanel.vue";
import SplitView from "@/components/Android/Vulnerabilities/SplitView.vue";
import Generate from "@/components/Viewers/Generate.vue";
import { classifyAccess } from "@/utils/componentAccess";
import { resolveComponentName } from '@/utils/componentNameResolver';

// Setup
const store = useStore();
const route = useRoute();
const router = useRouter();

// Core state variables
const currentApplication = computed(() => store.getters.getCurrentApplication);
const isDark = computed(() => store.state.isDark);
const applicationResults = ref(null);
const loading = ref(true);
const error = ref(null);
const isLoadingVulnerabilities = ref(false);
const isPartialResults = computed(() => applicationResults.value?.partial === true);

// Per-view toggle: request the backend to reshape results_partial.json when no completed
// scan exists yet, so findings can be researched while the full scan re-runs.
const showPartial = ref(false);
watch(showPartial, () => {
  if (currentApplication.value) fetchResults();
});
const itemsPerPage = ref(10);
const itemsPerPageOptions = [10, 25, 50, 100];
const exportFilter = ref('All');
const activeTab = ref('findings');

// Stable cache of reactive issue objects keyed by `${category}::${name}`.
// Persists across computed recomputes so pagination state is never wiped by
// unrelated reactive mutations (e.g. toggling suppressed on a vulnerability).
const issueCache = new Map();

// Expansion state (report view)
const openCategoryPanels = ref([]);
const openIssuePanelsByCategory = ref({});

// Dialog controls
const vulnerabilityDetailsDialog = ref(false);
const vulnerabilityDetailsContent = ref('');
const splitViewDialog = ref(false);
const splitViewVulnerabilityDetailsHtml = ref('');
const generatePDFDialog = ref(false);

// Notifications
const snackbar = ref({
  show: false,
  message: '',
  color: 'info',
  timeout: 5000
});

// Cache of component status from DB/batch endpoint
// Key: fully qualified component name (string)
// Value: { exported:boolean|null, accessible:boolean|null, has_intent_filters:boolean|null }
const componentStatusCache = ref({});

const getComponentNameFromEntryMethod = (entryMethod, fallbackComponentName = '') => {
  const resolved = resolveComponentName(entryMethod, fallbackComponentName);
  return resolved.primary || '';
};

// Core logic
// Computed values for displaying data
const issuesIdentified = computed(() => {
  if (!applicationResults.value || !applicationResults.value.security_issues) return {};
  return applicationResults.value.security_issues.reduce((acc, issue) => {
    if (!acc[issue.category]) {
      acc[issue.category] = 0;
    }
    acc[issue.category] += (issue.vulnerabilities ? issue.vulnerabilities.length : 0);
    return acc;
  }, {});
});

const normalizeVulnerabilities = (vulns) =>
  (Array.isArray(vulns) ? vulns : []).map(vuln => ({
    ...vuln,
    exported:           typeof vuln?.exported           === 'boolean' ? vuln.exported           : undefined,
    accessible:         typeof vuln?.accessible         === 'boolean' ? vuln.accessible         : undefined,
    has_intent_filters: typeof vuln?.has_intent_filters === 'boolean' ? vuln.has_intent_filters : undefined,
  }));

const groupedSecurityIssues = computed(() => {
  if (!applicationResults.value?.security_issues) return {};

  const groups = {};
  for (const issue of applicationResults.value.security_issues) {
    if (!groups[issue.category]) groups[issue.category] = [];

    const cacheKey = `${issue.category}::${issue.name}`;

    if (!issueCache.has(cacheKey)) {
      issueCache.set(cacheKey, reactive({
        ...issue,
        vulnerabilities: normalizeVulnerabilities(issue.vulnerabilities),
        currentPage: 1,
        isLoadingPage: false,
        paginatedVulnerabilities: [],
      }));
    } else {
      // Recompute triggered (e.g. suppressed flag mutated): refresh vuln data
      // but preserve pagination state so the user stays on their current page.
      issueCache.get(cacheKey).vulnerabilities = normalizeVulnerabilities(issue.vulnerabilities);
    }

    groups[issue.category].push(issueCache.get(cacheKey));
  }
  return groups;
});

const categoryKeys = computed(() => Object.keys(groupedSecurityIssues.value || {}));
const hasAnyFindings = computed(() => totalFilteredFindings.value > 0);

// Helper functions
const showSnackbar = ({ message, color = 'info', timeout = 5000 }) => {
  snackbar.value = {
    show: true,
    message,
    color,
    timeout
  };
};

// --- Access filter helpers ---
// Prefer DB-derived status (componentStatusCache) when possible.
const getEffectiveStatusForVuln = (vuln) => {
  const componentName = getComponentNameFromEntryMethod(vuln?.entry_method, vuln?.component_name);
  const cached = componentName ? componentStatusCache.value?.[componentName] : null;

  // Exported can come from multiple sources depending on scan age.
  // - New scans may have vuln.exported
  // - AppShark raw details include details.Manifest.exported
  const exportedFromVuln =
    typeof vuln?.exported === 'boolean'
      ? vuln.exported
      : (typeof vuln?.details?.Manifest?.exported === 'boolean' ? vuln.details.Manifest.exported : null);

  const accessibleFromVuln = typeof vuln?.accessible === 'boolean' ? vuln.accessible : null;
  const hasIntentFiltersFromVuln = typeof vuln?.has_intent_filters === 'boolean' ? vuln.has_intent_filters : null;

  // If we have cached DB/audit status, merge it with vuln-derived signals.
  // Never let UNKNOWN/null cache values hide a definite exported=true signal.
  if (cached && typeof cached === 'object') {
    const merged = {
      exported:
        exportedFromVuln === true
          ? true
          : (typeof cached.exported === 'boolean' ? cached.exported : exportedFromVuln),
      accessible:
        typeof cached.accessible === 'boolean' ? cached.accessible : accessibleFromVuln,
      has_intent_filters:
        typeof cached.has_intent_filters === 'boolean' ? cached.has_intent_filters : hasIntentFiltersFromVuln,
    };

    // Additional safety: if ANY source says exported=true, treat exported as true.
    if (merged.exported !== true && exportedFromVuln === true) merged.exported = true;

    return merged;
  }

  // No cached status; use vuln fields (including AppShark details fallback)
  return {
    exported: exportedFromVuln,
    accessible: accessibleFromVuln,
    has_intent_filters: hasIntentFiltersFromVuln,
  };
};

const getAccessStatus = (vuln) => {
  const st = getEffectiveStatusForVuln(vuln);

  // Critical invariant for security triage:
  // If exported is explicitly true, the component is externally reachable regardless of whether
  // the backend could compute `accessible` (e.g., unknown component type).
  if (st && st.exported === true) return 'ACCESSIBLE';

  return classifyAccess(st);
};

const getIssueColor = (count) => {
  if (count >= 5) return 'error';
  if (count >= 2) return 'warning';
  return 'info';
};


const getMostSevereCategoryColor = (issues) => {
  if (!issues || !Array.isArray(issues) || issues.length === 0) return 'info';

  const severities = issues
    .filter(issue => issue)
    .map(issue => issue.possibility)
    .filter(s => s);

  if (severities.includes('2') || severities.includes('high')) return 'error';
  if (severities.includes('1') || severities.includes('medium')) return 'warning';
  return 'info';
};

const matchesExportFilter = (vuln) => {
  if (exportFilter.value === 'All') return true;

  const status = getAccessStatus(vuln);
  if (exportFilter.value === 'ACCESSIBLE') return status === 'ACCESSIBLE';
  if (exportFilter.value === 'PROTECTED') return status === 'PROTECTED';
  return true;
};

const getFilteredSourceVulnerabilities = (issue) => {
  const vulns = Array.isArray(issue?.vulnerabilities) ? issue.vulnerabilities : [];
  return vulns.filter(v => {
    if (v?.suppressed) return false;
    return matchesExportFilter(v);
  });
};

const suppressedVulnerabilities = computed(() => {
  const issues = applicationResults.value?.security_issues;
  if (!Array.isArray(issues)) return [];
  const result = [];
  for (const issue of issues) {
    const vulns = Array.isArray(issue?.vulnerabilities) ? issue.vulnerabilities : [];
    for (const v of vulns) {
      if (v?.suppressed) result.push({ vuln: v, issue });
    }
  }
  return result;
});

const totalFilteredFindings = computed(() => {
  const issues = applicationResults.value?.security_issues;
  if (!Array.isArray(issues)) return 0;
  return issues.reduce((sum, issue) => sum + getTotalFilteredVulnerabilities(issue), 0);
});

const suppressedCount = computed(() => {
  const issues = applicationResults.value?.security_issues;
  if (!Array.isArray(issues)) return 0;
  return issues.reduce((sum, issue) => {
    const vulns = Array.isArray(issue?.vulnerabilities) ? issue.vulnerabilities : [];
    return sum + vulns.filter(v => v?.suppressed).length;
  }, 0);
});

const ensureIssuePanelsState = () => {
  const next = { ...openIssuePanelsByCategory.value };
  for (const category of categoryKeys.value) {
    if (!Array.isArray(next[category])) {
      next[category] = [];
    }
  }
  // Prune removed categories
  for (const key of Object.keys(next)) {
    if (!categoryKeys.value.includes(key)) {
      delete next[key];
    }
  }
  openIssuePanelsByCategory.value = next;
};

watch(categoryKeys, () => {
  ensureIssuePanelsState();
}, { immediate: true });

const expandAllPanels = () => {
  // Open all categories
  openCategoryPanels.value = categoryKeys.value.map((_, idx) => idx);

  // Open all issue panels per category
  const next = { ...openIssuePanelsByCategory.value };
  for (const category of categoryKeys.value) {
    const issues = groupedSecurityIssues.value?.[category] || [];
    next[category] = Array.isArray(issues) ? issues.map((_, idx) => idx) : [];
  }
  openIssuePanelsByCategory.value = next;
};

const collapseAllPanels = () => {
  openCategoryPanels.value = [];
  const next = { ...openIssuePanelsByCategory.value };
  for (const category of categoryKeys.value) {
    next[category] = [];
  }
  openIssuePanelsByCategory.value = next;
};

const getTotalFilteredVulnerabilities = (issue) => {
  if (!issue || !issue.vulnerabilities) return 0;

  return getFilteredSourceVulnerabilities(issue).length;
};

const getCategoryVulnerabilityCount = (issues) => {
  if (!issues || !Array.isArray(issues)) return 0;
  return issues.reduce((total, issue) => total + getTotalFilteredVulnerabilities(issue), 0);
};

// False positive suppression handler
const handleSuppressionChanged = async ({ id, suppressed, note }, issue) => {
  // Update the vulnerability's suppressed field in the local data so the
  // filter reacts immediately without a full re-fetch.
  const allIssues = applicationResults.value?.security_issues;
  if (Array.isArray(allIssues)) {
    for (const si of allIssues) {
      const vulns = Array.isArray(si?.vulnerabilities) ? si.vulnerabilities : [];
      const target = vulns.find(v => v?.id === id);
      if (target) {
        target.suppressed = suppressed;
        target.suppression_note = note;
        break;
      }
    }
  }
  // Reload the current page so the suppressed item is removed (or restored)
  // without changing the user's page position.
  if (issue) {
    await loadVulnerabilities(issue, issue.currentPage);
  }
};

// API interaction functions

// Batch API call to check multiple components at once
const fetchComponentStatusBatch = async (componentNames, appName) => {
  if (!componentNames || componentNames.length === 0 || !appName) {
    return {};
  }

  try {
    const apiUrl = `${import.meta.env.VITE_APP_API_URL || ''}/audit/component-status-batch/${appName}`;

    const response = await axios.post(apiUrl, {
      components: componentNames
    });

    // Returns object like: { "com.example.MainActivity": { exported: true, ... }, ... }
    return response.data || {};
  } catch {
    return {};
  }
};

// --- DB-driven hydration ---
// Collect component names from all vulnerabilities in the scan results.
const collectAllComponentNames = () => {
  const issues = applicationResults.value?.security_issues;
  if (!Array.isArray(issues)) return [];

  const set = new Set();
  for (const issue of issues) {
    const vulns = Array.isArray(issue?.vulnerabilities) ? issue.vulnerabilities : [];
    for (const v of vulns) {
      const name = getComponentNameFromEntryMethod(v?.entry_method, v?.component_name);
      if (name) set.add(name);
    }
  }
  return Array.from(set);
};

const normalizeStatusPayload = (status) => {
  // Treat missing as unknown
  if (!status) {
    return { exported: null, accessible: null, has_intent_filters: null };
  }

  // Some backends mark unresolved lookups with type: 'UNKNOWN'.
  // Do NOT discard explicit booleans (e.g. exported=true) just because type is UNKNOWN.
  // We only treat fields as unknown when they are not explicit booleans.
  return {
    exported: typeof status.exported === 'boolean' ? status.exported : null,
    accessible: typeof status.accessible === 'boolean' ? status.accessible : null,
    has_intent_filters: typeof status.has_intent_filters === 'boolean' ? status.has_intent_filters : null,
  };
};

const hydrateComponentStatusCache = async () => {
  const allNames = collectAllComponentNames();
  if (!allNames.length || !currentApplication.value) return;

  // Fetch only missing names
  const missing = allNames.filter(n => !componentStatusCache.value[n]);
  if (!missing.length) return;

  // Chunk to keep request sizes reasonable
  const chunkSize = 500;
  for (let i = 0; i < missing.length; i += chunkSize) {
    const chunk = missing.slice(i, i + chunkSize);
    // eslint-disable-next-line no-await-in-loop
    const batchResults = await fetchComponentStatusBatch(chunk, currentApplication.value);

    for (const name of chunk) {
      const raw = batchResults?.[name];
      componentStatusCache.value[name] = normalizeStatusPayload(raw);
    }
  }
};

const handlePageChange = async (issue, page) => {
  await loadVulnerabilities(issue, page);
};

const loadVulnerabilities = async (issue, page) => {
  if (!issue) return;

  try {
    issue.isLoadingPage = true;
    if (page !== undefined) issue.currentPage = page;
    issue.paginatedVulnerabilities = [];

    if (!Array.isArray(issue.vulnerabilities)) issue.vulnerabilities = [];

    const filteredVulns = getFilteredSourceVulnerabilities(issue);
    const maxPage = Math.max(1, Math.ceil(filteredVulns.length / itemsPerPage.value));
    if (issue.currentPage > maxPage) issue.currentPage = 1;

    const start = (issue.currentPage - 1) * itemsPerPage.value;
    const pageSlice = filteredVulns.slice(start, start + itemsPerPage.value);

    // For old scans where the DB didn't store accessibility fields, do a batch
    // lookup for components that are missing from the cache.
    const needsBatch = [];
    for (const vuln of pageSlice) {
      if (!vuln) continue;
      const componentName = getComponentNameFromEntryMethod(vuln.entry_method, vuln?.component_name);
      if (!componentName || componentStatusCache.value[componentName]) continue;

      // If the vuln already carries boolean fields, warm the cache from them.
      const hasFields = typeof vuln.exported === 'boolean' ||
        typeof vuln.accessible === 'boolean' ||
        typeof vuln.has_intent_filters === 'boolean';
      if (hasFields) {
        componentStatusCache.value[componentName] = normalizeStatusPayload({
          exported: vuln.exported, accessible: vuln.accessible, has_intent_filters: vuln.has_intent_filters,
        });
      } else {
        needsBatch.push(componentName);
      }
    }

    if (needsBatch.length > 0) {
      const batchResults = await fetchComponentStatusBatch(needsBatch, currentApplication.value);
      for (const name of needsBatch) {
        componentStatusCache.value[name] = normalizeStatusPayload(batchResults[name]);
      }
    }

    issue.paginatedVulnerabilities = pageSlice
      .filter(Boolean)
      .map(vuln => ({
        ...vuln,
        name:        vuln.name        || issue.name  || 'Unnamed Vulnerability',
        severity:    vuln.severity    || 'Unknown',
        description: vuln.description || issue.detail || 'No description available',
        app_name:    currentApplication.value,
      }));

  } catch (err) {
    showSnackbar({ message: 'Error loading vulnerability data', color: 'error' });
  } finally {
    issue.isLoadingPage = false;
  }
};

const initializeVulnerabilities = async () => {
  try {
    isLoadingVulnerabilities.value = true;

    // Batch-fetch all component accessibility data up front so every subsequent
    // loadVulnerabilities call finds everything already in componentStatusCache.
    await hydrateComponentStatusCache();

    if (!groupedSecurityIssues.value) return;

    const allIssues = Object.values(groupedSecurityIssues.value).flat();
    allIssues.forEach(issue => { issue.currentPage = 1; });
    await Promise.all(allIssues.map(issue => loadVulnerabilities(issue)));
  } catch (err) {
    showSnackbar({ message: 'Error loading vulnerability data', color: 'error' });
  } finally {
    isLoadingVulnerabilities.value = false;
  }
};

const fetchResults = async () => {
  try {
    loading.value = true;
    error.value = null;
    issueCache.clear();

    if (!currentApplication.value) {
      error.value = 'No application selected';
      loading.value = false;
      return;
    }

    const apiUrl = `${import.meta.env.VITE_APP_API_URL || ''}/engine/scan/results/${currentApplication.value}${showPartial.value ? '?partial=true' : ''}`;
    const response = await axios.get(apiUrl);

    if (!response.data) throw new Error('No data received from server');

    applicationResults.value = response.data;
    loading.value = false;
    await initializeVulnerabilities();
  } catch (err) {
    error.value = 'Application hasn\'t been scanned - Please scan the app and try again.';
    loading.value = false;
  }
};

// User interaction functions
const openGeneratePDF = () => {
  generatePDFDialog.value = true;
};

const goBack = () => {
  router.push('/');
};

const viewVulnerabilityDetails = async ({ id, url }) => {
  if (!url) {
    showSnackbar({ message: 'Error: Missing vulnerability details URL', color: 'error' });
    return;
  }

  try {
    const urlParts = url.split('/');
    const fileName = urlParts[urlParts.length - 1];

    const apiUrl = `${import.meta.env.VITE_APP_API_URL || ''}/engine/vulnerability-details/${currentApplication.value}/${fileName}`;
    const response = await axios.get(apiUrl);

    if (!response.data || !response.data.content) {
      throw new Error('No content received from server');
    }

    vulnerabilityDetailsContent.value = response.data.content;
    vulnerabilityDetailsDialog.value = true;
  } catch (err) {
    showSnackbar({ message: 'Error fetching vulnerability details: ' + err.message, color: 'error' });
  }
};

const viewVulnerabilityCode = async ({ position, vulnerability, index }) => {
  try {
    if (typeof position !== 'string') {
      throw new Error('Invalid position format');
    }

    let filePath = position.split(':')[0];
    filePath = filePath.replace(/^</, '').replace(/\.java$/, '');
    const javaFile = filePath.replace(/\//g, '.');

    const apiUrl = `${import.meta.env.VITE_APP_API_URL || ''}/engine/decompiled/${currentApplication.value}/${javaFile}`;
    const response = await axios.get(apiUrl);

    if (!response.data || !response.data.java_code) {
      throw new Error('No code received from server');
    }

    await store.dispatch('setCodeViewerData', {
      code: response.data.java_code,
      filename: currentApplication.value,
      componentName: javaFile,
    });

    router.push({ name: 'CodeViewer' });
  } catch (err) {
    showSnackbar({ message: 'Error fetching code: ' + err.message, color: 'error' });
  }
};

const viewSplitView = async ({ position, vulnerability, index }) => {
  try {
    if (typeof position !== 'string') {
      throw new Error('Invalid position format');
    }

    let filePath = position.split(':')[0];
    filePath = filePath.replace(/^</, '').replace(/\.java$/, '');
    const javaFile = filePath.replace(/\//g, '.');

    const codeApiUrl = `${import.meta.env.VITE_APP_API_URL || ''}/engine/decompiled/${currentApplication.value}/${javaFile}`;
    const codeResponse = await axios.get(codeApiUrl);

    if (!vulnerability || !vulnerability.url) {
      throw new Error('Missing vulnerability data');
    }

    const detailsApiUrl = `${import.meta.env.VITE_APP_API_URL || ''}/engine/vulnerability-details/${currentApplication.value}/${vulnerability.url.split('/').pop()}`;
    const detailsResponse = await axios.get(detailsApiUrl);

    if (!codeResponse.data || !codeResponse.data.java_code || !detailsResponse.data) {
      throw new Error('Missing code or vulnerability details');
    }

    await store.dispatch('setCodeViewerData', {
      code: codeResponse.data.java_code,
      filename: currentApplication.value,
      componentName: javaFile,
    });

    splitViewVulnerabilityDetailsHtml.value = detailsResponse.data.content || '';
    splitViewDialog.value = true;
  } catch (err) {
    showSnackbar({ message: 'Error: ' + err.message, color: 'error' });
  }
};

// Watch for changes
watch(currentApplication, async (newValue, oldValue) => {
  if (newValue !== oldValue) {
    loading.value = true;
    error.value = null;
    applicationResults.value = null;
    issueCache.clear();
    componentStatusCache.value = {};
    await fetchResults();
  }
});

watch(isPartialResults, (val) => {
  if (val && activeTab.value !== 'findings') {
    activeTab.value = 'findings';
  }
});

// When the filter changes reload page-1 for every issue so counts and pages stay consistent.
watch(exportFilter, async () => {
  if (!groupedSecurityIssues.value) return;
  const allIssues = Object.values(groupedSecurityIssues.value).flat();
  await Promise.all(allIssues.map(issue => loadVulnerabilities(issue, 1)));
});

watch(itemsPerPage, () => {
  if (!groupedSecurityIssues.value) return;
  Object.values(groupedSecurityIssues.value).flat().forEach(issue => {
    issue.currentPage = 1;
    loadVulnerabilities(issue);
  });
});

// Lifecycle hooks
onMounted(async () => {
  try {
    // Make sure we have an application selected
    if (!currentApplication.value && route.params.application) {
      await store.dispatch('setCurrentApplication', route.params.application);
    }

    // Then fetch results
    await fetchResults();
  } catch (err) {
    error.value = 'Failed to initialize: ' + err.message;
    loading.value = false;
  }
});
</script>

<style scoped>
.vulnerability-container {
  background-color: v-bind("isDark ? '#1E1E1E' : '#FFFFFF'");
  color: v-bind("isDark ? '#F5F5F5' : '#333333'");
  transition: opacity 0.3s ease;
}

.dark-theme {
  background-color: #121212;
  color: #F5F5F5;
}

.dark-theme.v-card {
  background-color: #1E1E1E;
}

.dark-theme .v-card-title {
  color: #F5F5F5;
}

.dark-theme .v-btn {
  background-color: #333333;
  color: #F5F5F5;
}

.dark-theme .v-btn--active {
  background-color: #1976D2;
}

.dark-theme .v-expansion-panels {
  background-color: #1E1E1E;
}

.dark-theme .v-expansion-panel {
  background-color: #2C2C2C;
}

.dark-theme .v-chip {
  background-color: #333333;
  color: #F5F5F5;
}

/* Pagination styles */
.v-pagination {
  margin: 16px 0;
}

.v-pagination .v-btn {
  transition: transform 0.2s, background-color 0.2s;
}

.v-pagination .v-btn:hover {
  transform: translateY(-2px);
  background-color: rgba(25, 118, 210, 0.12);
}

.v-pagination .v-btn--active {
  transform: scale(1.1);
  font-weight: bold;
}

.theme--dark .v-pagination .v-btn:hover {
  background-color: rgba(100, 181, 246, 0.12);
}

/* Transition effects */
.v-fade-transition-enter-active,
.v-fade-transition-leave-active {
  transition: opacity 0.25s ease;
}

.v-fade-transition-enter-from,
.v-fade-transition-leave-to {
  opacity: 0;
}

/* Loading indicator styles */
.text-center.my-4 {
  padding: 20px;
  border-radius: 8px;
}

.theme--dark .text-center.my-4 {
  background-color: rgba(30, 30, 30, 0.5);
}

.theme--light .text-center.my-4 {
  background-color: rgba(245, 245, 245, 0.7);
}

/* Keep the toolbar visible and give the report all remaining dialog space. */
.v-card.vuln-details-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
}

.vuln-details-toolbar {
  flex: 0 0 auto;
}

.vuln-details-content {
  display: flex;
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.vuln-details-content .vulnerability-details-content {
  display: block;
  flex: 1 1 0;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 0;
  border-radius: 0;
  background: white;
}

/* Vulnerability details content */
.vulnerability-details-content {
  padding: 16px;
  border-radius: 4px;
  background-color: v-bind("isDark ? '#2c2c2c' : '#f9f9f9'");
  color: v-bind("isDark ? '#e0e0e0' : '#333333'");
  max-width: 100%;
  overflow-x: auto;
  font-family: 'Roboto Mono', monospace;
  line-height: 1.5;
}

/* Code blocks and source/sink styling */
.vulnerability-details-content pre,
.vulnerability-details-content code {
  font-family: 'Roboto Mono', 'Courier New', monospace;
  border-radius: 4px;
  padding: 8px;
  background-color: v-bind("isDark ? '#1E1E1E' : '#F5F5F5'");
  color: v-bind("isDark ? '#E0E0E0' : '#333333'");
  white-space: pre-wrap;
  word-break: break-word;
}

.vulnerability-details-content .entry-method,
.vulnerability-details-content .position {
  padding: 8px;
  margin: 8px 0;
  border-radius: 4px;
  background-color: v-bind("isDark ? '#2D2D44' : '#E8EAF6'");
}

.vulnerability-details-content .sink-highlight {
  background-color: v-bind("isDark ? '#4F2D2D' : '#FFEBEE'");
  color: v-bind("isDark ? '#EF9A9A' : '#B71C1C'");
  padding: 2px 4px;
  border-radius: 2px;
  display: inline-block;
}

.vulnerability-details-content .source-highlight {
  background-color: v-bind("isDark ? '#2D4F4F' : '#E0F7FA'");
  color: v-bind("isDark ? '#80DEEA' : '#00695C'");
  padding: 2px 4px;
  border-radius: 2px;
  display: inline-block;
}

.vulnerability-details-content .code-block {
  margin: 12px 0;
  border: 1px solid v-bind("isDark ? '#444444' : '#E0E0E0'");
  border-radius: 4px;
  overflow: hidden;
}

.vulnerability-details-content .code-block-header {
  padding: 8px 12px;
  background-color: v-bind("isDark ? '#252525' : '#EEEEEE'");
  border-bottom: 1px solid v-bind("isDark ? '#444444' : '#E0E0E0'");
  font-weight: 500;
}

/* Target section */
.vulnerability-details-content .target {
  background-color: v-bind("isDark ? '#2D3A2D' : '#E8F5E9'");
  padding: 8px;
  margin: 8px 0;
  border-radius: 4px;
}

/* Fix for keyword highlighting */
.vulnerability-details-content .keyword {
  color: v-bind("isDark ? '#C792EA' : '#7B1FA2'");
}

/* Section headings */
.vulnerability-details-content h3,
.vulnerability-details-content h4 {
  margin-top: 16px;
  margin-bottom: 8px;
  color: v-bind("isDark ? '#90CAF9' : '#1976D2'");
}

/* Fullscreen dialog */
.fullscreen-dialog {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: v-bind("isDark ? '#1E1E1E' : '#FFFFFF'");
  opacity: 1 !important;
}

.fullscreen-dialog-content {
  flex-grow: 1;
  overflow-y: auto;
  padding: 16px;
  opacity: 1 !important;
  background-color: v-bind("isDark ? '#1E1E1E' : '#FFFFFF'");
}

/* Make sure dialog doesn't have opacity transition */
.v-dialog {
  opacity: 1 !important;
}

.v-dialog.v-dialog--active {
  opacity: 1 !important;
}

/* Responsive styles */
@media (max-width: 600px) {
  .v-pagination {
    flex-wrap: wrap;
    justify-content: center;
  }

  .v-pagination .v-btn {
    margin: 2px;
  }

  .vulnerability-details-content {
    padding: 8px;
  }

  .vulnerability-details-content pre,
  .vulnerability-details-content code {
    font-size: 12px;
  }
}

.report-toolbar {
  padding-top: 8px;
}
</style>
