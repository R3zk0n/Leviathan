<!-- ReconDialog.vue -->
<template>
  <v-dialog :model-value="dialog" @update:model-value="closeDialog" max-width="800px">
    <v-card :class="isDark ? 'theme--dark' : 'theme--light'">
      <v-card-title class="headline">Recon Information: {{ filename }}</v-card-title>

      <v-card-text>
        <!-- Loading Spinner -->
        <v-container v-if="loading" class="d-flex justify-center align-center" style="height: 200px;">
          <v-progress-circular indeterminate color="primary"></v-progress-circular>
          <span class="ml-2">Decompiling and Getting Information for {{ filename }}...</span>
        </v-container>

        <!-- Tabs and Data -->
        <v-tabs v-model="mainTab" :class="isDark ? 'theme--dark' : 'theme--light'" v-if="!loading">
          <v-tab value="file-info">
            <v-icon start>mdi-file-document-outline</v-icon>
            FILE INFORMATION
          </v-tab>
          <v-tab value="libraries">
            <v-icon start>mdi-bookshelf</v-icon>
            LIBRARIES
          </v-tab>
          <v-tab value="keys">
            <v-icon start>mdi-key-variant</v-icon>
            KEYS
          </v-tab>
          <v-tab value="classes">
            <v-icon start>mdi-book-variant</v-icon>
            CLASSES
          </v-tab>
        </v-tabs>

        <v-window v-model="mainTab" v-if="!loading">
          <!-- File Info Tab -->
          <v-window-item value="file-info">
            <v-tabs v-model="fileInfoTab" class="mt-4">
              <v-tab value="general-info">GENERAL INFO</v-tab>
              <v-tab value="android-info">ANDROID INFORMATION</v-tab>
              <v-tab value="android-scheme">ANDROID SCHEMES<v-icon class="ml-2">mdi-link-variant</v-icon></v-tab>
            </v-tabs>

            <v-window v-model="fileInfoTab">
              <!-- General Info Tab Content -->
              <v-window-item value="general-info">
                <v-list dense v-if="reconData">
                  <v-list-item>
                    <v-list-item-title>
                      <strong>Binary Size:</strong> {{ reconData.bin_size }}
                    </v-list-item-title>
                  </v-list-item>
                  <v-list-item>
                    <v-list-item-title>
                      <strong>SHA1:</strong> {{ reconData.sha1 }}
                    </v-list-item-title>
                  </v-list-item>
                  <v-list-item>
                    <v-list-item-title>
                      <strong>SHA256:</strong> {{ reconData.sha256 }}
                    </v-list-item-title>
                  </v-list-item>
                  <v-list-item>
                    <v-list-item-title>
                      <strong>MD5:</strong> {{ reconData.md5 }}
                    </v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-window-item>

              <!-- Android Info Tab -->
              <v-window-item value="android-info">
                <v-list dense v-if="reconData && reconData.androidInfo">
                  <v-list-item v-for="(value, key) in reconData.androidInfo"
                              :key="key"
                              v-if="key !== 'schemes' && key !== 'frameworkIcon'">
                    <v-list-item-title>
                      <strong>{{ formatAndroidInfoKey(key) }}:</strong>
                      {{ formatAndroidInfoValue(key, value) }}
                      <v-icon v-if="key === 'framework'" class="ml-2">
                        {{ reconData.androidInfo.frameworkIcon }}
                      </v-icon>
                    </v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-window-item>

              <!-- Android Scheme Tab -->
              <v-window-item value="android-scheme">
                <v-card flat class="mt-2">
                  <v-card-text>
                    <v-list dense v-if="uniqueSchemes.length > 0">
                      <v-list-item v-for="[scheme, count] in uniqueSchemes" :key="scheme">
                        <div class="d-flex flex-row align-center">
                          <v-chip class="mr-3" color="primary" size="small" label>
                            {{ count }}
                          </v-chip>
                          <code class="scheme-text">{{ scheme }}</code>
                        </div>
                      </v-list-item>
                    </v-list>
                    <v-alert v-else type="info" text="No Android schemes found" class="mt-2"></v-alert>
                  </v-card-text>
                </v-card>
              </v-window-item>
            </v-window>
          </v-window-item>

          <!-- Libraries Tab -->
          <v-window-item value="libraries">
            <v-expansion-panels v-if="reconData && reconData.libraries">
              <v-expansion-panel v-for="(libs, arch) in reconData.libraries" :key="arch">
                <v-expansion-panel-title>
                  {{ arch }}
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <v-list v-if="libs.length > 0">
                    <v-list-item v-for="lib in libs" :key="lib">
                      <div class="d-flex align-center">
                        {{ lib }}
                        <v-btn variant="text" icon size="small" class="ml-2" @click="downloadLibrary(arch, lib)">
                          <v-icon>mdi-download</v-icon>
                        </v-btn>
                      </div>
                    </v-list-item>
                  </v-list>
                  <v-alert v-else type="info" text="No libraries found for this architecture" class="mt-2"></v-alert>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-window-item>

          <!-- Keys Tab -->
          <v-window-item value="keys">
            <div class="d-flex flex-column pa-4">
              <!-- Trufflehog Scan Button -->
              <div class="mb-4">
                <div class="d-flex flex-row">
                  <v-btn
                    color="warning"
                    :loading="scanningSecrets"
                    :disabled="scanningSecrets"
                    @click="scanForSecrets"
                    class="mb-2"
                    prepend-icon="mdi-shield-search"
                  >
                    {{ scanningSecrets ? 'Scanning for Secrets...' : 'Scan for Secrets' }}
                  </v-btn>

                  <!-- Debug Button -->
                  <v-btn
                      color="info"
                      variant="outlined"
                      @click="testScan"
                      :disabled="scanningSecrets"
                      prepend-icon="mdi-test-tube"
                      class="ml-2"
                    >
                      Test TruffleHog
                    </v-btn>
                  </div>

                <!-- Scan Progress -->
                <v-alert
                  v-if="scanningSecrets && !secretScanResults"
                  type="info"
                  variant="tonal"
                  class="mt-4"
                >
                  Scanning for secrets in decompiled files...
                </v-alert>

                <!-- Results Alert -->
                <v-alert
                  v-if="secretScanResults && !secretScanResults.fromDatabase"
                  :type="secretScanResults.secrets.length > 0 ? 'warning' : 'success'"
                  variant="tonal"
                  class="mt-4"
                >
                  {{ secretScanResults.secrets.length > 0
                    ? `Found ${secretScanResults.secrets.length} potential secrets`
                    : 'No secrets found' }}
                </v-alert>

                <!-- Manual Save Button -->
                <div v-if="secretScanResults?.secrets?.length > 0 && !secretScanResults.fromDatabase" class="mt-4 mb-4 d-flex justify-end">
                  <v-btn
                    color="success"
                    @click="saveSecretResults"
                    prepend-icon="mdi-content-save"
                  >
                    Save Secrets to Database
                  </v-btn>
                </div>

                <!-- Secrets Panel -->
                <v-expansion-panels v-if="secretScanResults?.secrets?.length > 0" class="mt-4">
                  <v-expansion-panel
                    v-for="(secret, index) in secretScanResults.secrets"
                    :key="index"
                  >
                    <template v-slot:title>
                      <div class="d-flex align-center">
                        <v-icon :color="secret.verified ? 'error' : 'warning'" class="mr-2">
                          {{ secret.verified ? 'mdi-alert-circle' : 'mdi-alert' }}
                        </v-icon>
                        <div class="d-flex flex-column">
                          <div class="d-flex align-center">
                            <span class="text-subtitle-2">{{ secret.type || 'Unknown Type' }}</span>
                            <v-chip
                              size="small"
                              :color="secret.verified ? 'error' : 'warning'"
                              variant="outlined"
                              class="ml-2"
                            >
                              {{ secret.verified ? 'Verified' : 'Potential' }}
                            </v-chip>
                            <v-chip
                              v-if="secretScanResults.fromDatabase"
                              size="small"
                              color="info"
                              variant="outlined"
                              class="ml-2"
                            >
                              From Database
                            </v-chip>
                          </div>
                          <span class="text-caption text-grey">{{ secret.file }}</span>
                        </div>
                      </div>
                    </template>
                    <v-expansion-panel-text>
                      <v-card flat>
                        <v-card-text>
                          <div class="secret-details">
                            <!-- Secret Value Section -->
                            <v-card class="mb-3" variant="outlined">
                              <v-card-title class="text-subtitle-1">Secret Details</v-card-title>
                              <v-card-text>
                                <div class="mb-2">
                                  <strong>Redacted Value:</strong>
                                  <code class="secret-value ml-2">{{ secret.redacted_value || secret.value }}</code>
                                </div>
                                <div class="mb-2">
                                  <strong>Raw Value:</strong>
                                  <code class="secret-value ml-2">{{ secret.raw_value }}</code>
                                </div>
                                <div v-if="secret.description" class="mb-2">
                                  <strong>Description:</strong>
                                  <div class="mt-1 text-body-2">{{ secret.description }}</div>
                                </div>
                                <div v-if="secret.scan_date" class="mb-2">
                                  <strong>First Discovered:</strong>
                                  <div class="mt-1 text-body-2">{{ new Date(secret.scan_date).toLocaleString() }}</div>
                                </div>
                              </v-card-text>
                            </v-card>

                            <!-- Location Details -->
                            <v-card class="mb-3" variant="outlined">
                              <v-card-title class="text-subtitle-1">Location Details</v-card-title>
                              <v-card-text>
                                <div v-if="secret.file" class="mb-2">
                                  <strong>File:</strong> {{ secret.file }}
                                </div>
                                <div v-if="secret.line" class="mb-2">
                                  <strong>Line:</strong> {{ secret.line }}
                                </div>
                                <div class="mb-2">
                                  <strong>Source:</strong> {{ secret.source_name }}
                                </div>
                              </v-card-text>
                            </v-card>

                            <!-- Verification Details -->
                            <v-card
                              variant="outlined"
                              :color="secret.verified ? 'error' : 'warning'"
                              :class="['verification-card', secret.verified ? 'bg-error-subtle' : 'bg-warning-subtle']"
                            >
                              <v-card-title class="text-subtitle-1">Verification Status</v-card-title>
                              <v-card-text>
                                <div class="mb-2">
                                  <strong>Status:</strong>
                                  <v-chip
                                    size="small"
                                    :color="secret.verified ? 'error' : 'warning'"
                                    class="ml-2"
                                  >
                                    {{ secret.verified ? 'Verified' : 'Unverified' }}
                                  </v-chip>
                                </div>
                                <div v-if="secret.verification_error" class="mt-2">
                                  <strong>Verification Note:</strong>
                                  <div class="mt-1 text-body-2">{{ secret.verification_error }}</div>
                                </div>
                                <div v-if="secret.verification_cached" class="mt-2">
                                  <v-chip size="small" color="info" class="mr-2">Cached Result</v-chip>
                                </div>
                              </v-card-text>
                            </v-card>

                            <!-- Technical Details -->
                            <v-expansion-panels class="mt-3">
                              <v-expansion-panel>
                                <v-expansion-panel-title>Technical Details</v-expansion-panel-title>
                                <v-expansion-panel-text>
                                  <div class="technical-details">
                                    <div class="mb-2">
                                      <strong>Detector Type:</strong> {{ secret.detector_type }}
                                    </div>
                                    <div class="mb-2">
                                      <strong>Source Type:</strong> {{ secret.source_type }}
                                    </div>
                                    <div class="mb-2">
                                      <strong>Decoder:</strong> {{ secret.decoder_name }}
                                    </div>
                                  </div>
                                </v-expansion-panel-text>
                              </v-expansion-panel>
                            </v-expansion-panels>
                          </div>
                        </v-card-text>
                      </v-card>
                    </v-expansion-panel-text>
                  </v-expansion-panel>
                </v-expansion-panels>
              </div>

              <!-- Original Keys List -->
              <v-divider class="mb-4"></v-divider>
              <div class="keys-section">
                <h3 class="text-h6 mb-4">Extracted Keys and Secrets</h3>

                <!-- Original Keys from Recon -->
                <div v-if="reconData && reconData.keys && Object.keys(reconData.keys).length > 0" class="mb-6">
                  <div class="d-flex align-center mb-3">
                    <v-icon color="primary" class="mr-2">mdi-key</v-icon>
                    <span class="text-subtitle-1">Static App Keys</span>
                  </div>
                  <v-list>
                    <v-list-item v-for="(value, key) in reconData.keys" :key="key">
                      <v-list-item-title><strong>{{ key }}:</strong></v-list-item-title>
                      <v-list-item-subtitle>{{ value }}</v-list-item-subtitle>
                    </v-list-item>
                  </v-list>
                </div>

                <!-- No Keys or Secrets Found -->
                <v-alert
                  v-if="(!reconData || !reconData.keys || Object.keys(reconData.keys).length === 0) &&
                        (!savedSecrets || savedSecrets.length === 0) &&
                        (!secretScanResults || secretScanResults.secrets.length === 0)"
                  type="info"
                  variant="tonal"
                  class="mt-2"
                >
                  No keys or secrets found in the application. Try scanning for secrets above.
                </v-alert>
              </div>
            </div>
          </v-window-item>

          <!-- Classes Tab -->
          <v-window-item value="classes">
            <v-list v-if="reconData && reconData.classes">
              <v-list-item v-for="className in reconData.classes" :key="className">
                <v-list-item-title>{{ className }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-window-item>
        </v-window>
      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="primary" @click="closeDialog">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { mapState, mapGetters } from 'vuex';
import axios from 'axios';
import { engineApi } from '@/services';

export default {
  name: 'ReconDialog',

  props: {
    dialog: Boolean,
    filename: {
      type: String,
      required: true
    }
  },

  data() {
    return {
      mainTab: 'file-info',
      fileInfoTab: 'general-info',
      loading: false,
      reconData: null,
      error: null,
      scanningSecrets: false,
      secretScanResults: null,
      secretScanTaskId: null,
      secretScanPollingInterval: null,
      secretScanRetries: 0,
      maxRetries: 3,
      savedSecrets: [] // To store previously saved secrets from the database
    };
  },

  computed: {
    ...mapState(['isDark']),
    ...mapGetters(['decompilerEngine', 'decompilerResources']),
    uniqueSchemes() {
      if (!this.reconData?.androidInfo?.schemes) return [];

      const schemeCount = new Map();
      this.reconData.androidInfo.schemes.forEach(scheme => {
        schemeCount.set(scheme, (schemeCount.get(scheme) || 0) + 1);
      });

      return Array.from(schemeCount.entries()).sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
      });
    }
  },

  watch: {
    dialog(newVal) {
      if (newVal) {
        this.resetDialog();
        this.fetchReconData();
      }
    }
  },

  beforeUnmount() {
    this.clearPollingInterval();
  },

  methods: {
    formatAndroidInfoKey(key) {
      return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
    },

    formatAndroidInfoValue(key, value) {
      if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
      }
      return value;
    },

    closeDialog() {
      this.clearPollingInterval();
      this.$emit('update:dialog', false);
    },

    clearPollingInterval() {
      if (this.secretScanPollingInterval) {
        clearInterval(this.secretScanPollingInterval);
        this.secretScanPollingInterval = null;
      }
    },

    resetDialog() {
      this.reconData = null;
      this.mainTab = 'file-info';
      this.fileInfoTab = 'general-info';
      this.loading = false;
      this.error = null;
      this.secretScanResults = null;
      this.clearPollingInterval();
      this.secretScanTaskId = null;
      this.secretScanRetries = 0;
      this.savedSecrets = [];
    },

    async fetchReconData() {
      this.loading = true;
      this.error = null;
      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/audit/recon/${this.filename}`);
        this.reconData = response.data;

        // After getting the recon data, fetch any previously saved secrets
        await this.fetchSavedSecrets();
      } catch (error) {
        console.error('Error fetching recon data:', error);
        this.error = 'Failed to fetch reconnaissance data. Please try again.';
        this.$emit('show-snackbar', {
          text: 'Error fetching recon data: ' + (error.response?.data?.message || error.message),
          color: 'error'
        });
      } finally {
        this.loading = false;
      }
    },

    // Method to fetch previously saved secrets for the app
    async fetchSavedSecrets() {
  try {
    // First try to get the app info from database to get the actual package name
    const appDetailsResponse = await axios.get(
      `${import.meta.env.VITE_APP_API_URL}/audit/details/${this.filename}`
    );

    // Extract the package name from the app details response
    let packageName = null;
    if (appDetailsResponse.data && appDetailsResponse.data.packageName) {
      packageName = appDetailsResponse.data.packageName;
      console.log(`Retrieved package name from database: ${packageName}`);
    } else {
      // Fallback to filename without extension
      packageName = this.filename.replace('.apk', '');
      console.log(`Using filename as fallback package name: ${packageName}`);
    }

    console.log(`Fetching saved secrets for package: ${packageName}`);

    const response = await axios.get(
      `${import.meta.env.VITE_APP_API_URL}/database/app-secrets/${packageName}`
    );

    if (response.data && response.data.length > 0) {
      // Transform saved secrets to match the expected format
      this.savedSecrets = response.data.map(secret => ({
        type: secret.secret_type,
        description: secret.description,
        redacted_value: secret.redacted_value,
        raw_value: secret.raw_value,
        file: secret.file_path,
        line: secret.secret_line,
        source_name: secret.source_name,
        source_type: secret.source_type,
        detector_type: secret.detector_type,
        decoder_name: secret.decoder_name,
        verified: secret.is_verified,
        verification_error: secret.verification_error,
        verification_cached: secret.verification_cached,
        scan_date: secret.scan_date
      }));

      console.log(`Found ${this.savedSecrets.length} previously saved secrets`);

      // Display a message to the user if we found saved secrets
      this.$emit('show-snackbar', {
        text: `Loaded ${this.savedSecrets.length} previously discovered secrets`,
        color: 'info'
      });

      // Pre-populate the secretScanResults with saved data
      if (!this.secretScanResults) {
        this.secretScanResults = {
          secrets: this.savedSecrets,
          fromDatabase: true
        };
      }
    } else {
      console.log('No saved secrets found for this package');
      this.savedSecrets = [];
    }
  } catch (error) {
    console.error('Error fetching saved secrets:', error);
    this.savedSecrets = [];
  }
},

    // Method to save the current scan results to the database
async saveSecretResults() {
  if (!this.secretScanResults || !this.secretScanResults.secrets ||
      this.secretScanResults.secrets.length === 0) {
    console.log('No secrets to save');
    return;
  }

  try {
    // First try to get the app info from database to get the actual package name
    const appDetailsResponse = await axios.get(
      `${import.meta.env.VITE_APP_API_URL}/audit/details/${this.filename}`
    );

    // Extract the package name from the app details response
    let packageName = null;
    if (appDetailsResponse.data && appDetailsResponse.data.packageName) {
      packageName = appDetailsResponse.data.packageName;
      console.log(`Retrieved package name from database: ${packageName}`);
    } else {
      // Fallback to filename without extension
      packageName = this.filename.replace('.apk', '');
      console.log(`Using filename as fallback package name: ${packageName}`);
    }

    if (!packageName) {
      console.log('Package name not available, cannot save secrets');
      console.log('Available filename:', this.filename);
      this.$emit('show-snackbar', {
        text: 'Could not save secrets: Package name not available',
        color: 'error'
      });
      return;
    }

    console.log(`Saving ${this.secretScanResults.secrets.length} secrets for package: ${packageName}`);

    // Process detector_type to ensure it's a string
    const processedSecrets = this.secretScanResults.secrets.map(secret => ({
      ...secret,
      detector_type: String(secret.detector_type || '')
    }));

    await axios.post(
      `${import.meta.env.VITE_APP_API_URL}/database/app-secrets/${packageName}`,
      { secrets: processedSecrets }
    );

    this.$emit('show-snackbar', {
      text: `Successfully saved ${this.secretScanResults.secrets.length} secrets to database`,
      color: 'success'
    });

    // Update the flag to indicate these are now saved
    this.secretScanResults.fromDatabase = true;
  } catch (error) {
    console.error('Error saving secrets to database:', error);
    this.$emit('show-snackbar', {
      text: `Error saving secrets: ${error.response?.data?.error || error.message}`,
      color: 'error'
    });
  }
},

    async scanForSecrets() {
      if (!this.filename) return;

      this.scanningSecrets = true;
      this.secretScanResults = null;
      this.secretScanRetries = 0;

      try {
        const response = await axios.post(
          `${import.meta.env.VITE_APP_API_URL}/engine/trufflehog/scan/${this.filename}`
        );

        if (response.data?.output?.task_id) {
          this.secretScanTaskId = response.data.output.task_id;
          this.startPolling();
        } else {
          throw new Error(response.data?.message || 'Failed to start scan');
        }
      } catch (error) {
        console.error('Error scanning for secrets:', error);
        this.handleScanError(error);
      }
    },

    startPolling() {
      this.clearPollingInterval();
      this.secretScanPollingInterval = setInterval(() => this.checkScanStatus(), 2000);
    },

    async checkScanStatus() {
      if (!this.secretScanTaskId) {
        this.clearPollingInterval();
        return;
      }

      try {
        const response = await axios.get(
          `${import.meta.env.VITE_APP_API_URL}/engine/trufflehog/scan/status/${this.secretScanTaskId}`
        );

        const responseData = response.data;
        console.log('Raw status response:', responseData);

        // Task completed successfully with findings
        if (responseData?.message === "Trufflehog Scan Complete" &&
            responseData?.output?.status === 'success') {

          this.clearPollingInterval();

          // Show debugging info in console
          console.log('Complete response structure:', JSON.stringify(responseData, null, 2));
          console.log('Output structure:', JSON.stringify(responseData.output, null, 2));
          console.log('Result structure:', responseData.output.result ?
              JSON.stringify(responseData.output.result, null, 2) : 'No result object');

          let findings = [];

          // Try multiple possible paths to findings
          if (responseData.output?.result?.findings) {
            findings = responseData.output.result.findings;
            console.log('Found findings in output.result.findings', findings);
          }
          else if (responseData.output?.result?.result?.findings) {
            findings = responseData.output.result.result.findings;
            console.log('Found findings in output.result.result.findings', findings);
          }
          else if (responseData.output?.findings) {
            findings = responseData.output.findings;
            console.log('Found findings in output.findings', findings);
          }
          else {
            console.warn('No findings found in response');
            // Try to extract raw result for debugging
            console.log('Raw result:', responseData.output?.result || 'No result');
          }

          this.scanningSecrets = false;

          if (findings && findings.length > 0) {
            console.log('Processing findings:', findings);

            // Call our new method to handle scan results
            this.handleScanResults({ findings });

            // Focus on the KEYS tab to make sure results are visible
            this.mainTab = 'keys';

            this.$emit('show-snackbar', {
              text: `Found ${findings.length} potential secrets`,
              color: 'warning'
            });
          } else {
            // Even with no findings, show the scan completed
            this.secretScanResults = { secrets: [], fromDatabase: false };
            this.$emit('show-snackbar', {
              text: 'No secrets found in the application',
              color: 'success'
            });
          }
        }
        // Task failed
        else if (responseData?.output?.status === 'error') {
          this.clearPollingInterval();
          this.scanningSecrets = false;

          console.error('Scan failed with error:', responseData.output.error);
          this.$emit('show-snackbar', {
            text: `Error scanning for secrets: ${responseData.output.error || 'Unknown error'}`,
            color: 'error'
          });
        }
        // Still in progress
        else if (responseData?.message === "Trufflehog Scan In Progress") {
          console.log('Scan still in progress...');
        }
        // Unexpected state
        else {
          console.log('Unexpected response state:', responseData);
          // If we've been polling for too long, give up
          this.secretScanRetries++;
          if (this.secretScanRetries > 15) { // ~30 seconds with 2s polling
            this.clearPollingInterval();
            this.scanningSecrets = false;
            this.$emit('show-snackbar', {
              text: 'Scan timed out or returned unexpected result',
              color: 'warning'
            });
          }
        }
      } catch (error) {
        console.error('Error checking scan status:', error);
        this.handleScanError(error);
      }
    },

   handleScanError(error) {
      this.secretScanRetries++;

      if (this.secretScanRetries >= this.maxRetries) {
        this.clearPollingInterval();
        this.$emit('show-snackbar', {
          text: 'Error scanning for secrets: ' + (error.response?.data?.message || error.message),
          color: 'error'
        });
        this.scanningSecrets = false;
      }
    },

    // Updated handleScanResults method to also save results
    handleScanResults(result) {
      const findings = result.findings || [];
      console.log('Processing findings:', findings);

      // Normalize findings to handle both array and single object cases
      const normalizedFindings = Array.isArray(findings) ? findings : [findings];
      console.log('Normalized findings:', normalizedFindings);

      this.secretScanResults = {
        secrets: normalizedFindings.map(finding => {
          console.log('Processing finding:', finding);
          return {
            type: finding.type || finding.DetectorName || 'Unknown',
            description: finding.description || finding.DetectorDescription || 'No description available',
            redacted_value: finding.Redacted || finding.redacted_value || finding.value,
            raw_value: finding.Raw || finding.raw_value,
            file: finding.file || (finding.SourceMetadata?.Data?.Filesystem?.file || '').replace('/tmp/decompiled/', ''),
            line: finding.line || finding.SourceMetadata?.Data?.Filesystem?.line,
            source_name: finding.source_name || finding.SourceName,
            source_type: finding.source_type || finding.SourceType,
            detector_type: finding.detector_type || finding.DetectorType,
            detector_name: finding.detector_name || finding.DetectorName,
            decoder_name: finding.decoder_name || finding.DecoderName,
            verified: finding.verified || finding.Verified || false,
            verification_error: finding.verification_error || finding.VerificationError,
            verification_cached: finding.verification_cached || finding.VerificationFromCache || false
          };
        }),
        fromDatabase: false // This indicates these are newly discovered secrets
      };

      console.log('Processed results:', this.secretScanResults);

      this.$emit('show-snackbar', {
        text: findings.length > 0
          ? `Found ${findings.length} potential secrets`
          : 'No secrets found in the application',
        color: findings.length > 0 ? 'warning' : 'success'
      });

      this.scanningSecrets = false;

      // If we found secrets, automatically save them to the database
      if (findings.length > 0) {
        this.saveSecretResults();
      }
    },

    async debugScanChain() {
      if (!this.secretScanTaskId) {
        console.warn('No task ID available for debugging');
        return;
      }

      try {
        // Call both debug endpoints for maximum information
        const debugResponse = await axios.get(
          `${import.meta.env.VITE_APP_API_URL}/engine/trufflehog/scan/debug/${this.secretScanTaskId}`
        );

        const chainDebugResponse = await axios.get(
          `${import.meta.env.VITE_APP_API_URL}/engine/trufflehog/scan/chain-debug/${this.secretScanTaskId}`
        );

        console.log('Standard debug info:', debugResponse.data);
        console.log('Chain debug info:', chainDebugResponse.data);

        // Look for subtask results
        const subtasks = chainDebugResponse.data?.tasks || {};
        const subtaskResults = [];

        // Extract all subtask results
        for (const [key, task] of Object.entries(subtasks)) {
          if (key.startsWith('subtask_') && task.result) {
            subtaskResults.push(task.result);

            // If we find a successful subtask with findings, use it
            if (task.result.status === 'success' && (task.result.result?.findings || task.result.findings)) {
              const findings = task.result.result?.findings || task.result.findings || [];

              if (findings.length > 0) {
                this.handleScanResults({ findings });
                this.$emit('show-snackbar', {
                  text: `Found ${findings.length} secrets from subtask ${task.id}`,
                  color: 'success'
                });
                return;
              }
            }
          }
        }

        // If no suitable subtask results were found
        this.$emit('show-snackbar', {
          text: 'Debug info logged to console',
          color: 'info'
        });
      } catch (error) {
        console.error('Error debugging scan chain:', error);
        this.$emit('show-snackbar', {
          text: 'Error debugging scan',
          color: 'error'
        });
      }
    },

    async testScan() {
      if (!this.filename) return;

      this.$emit('show-snackbar', {
        text: 'Running TruffleHog scan test directly...',
        color: 'info'
      });

      try {
        // First, make sure the file is decompiled (using the preferred engine)
        await engineApi.decompile(this.filename, { engine: this.decompilerEngine, resources: this.decompilerResources });

        // Get the decompiled path and run TruffleHog directly (simulating what the task would do)
        const decompilePath = `/tmp/decompiled/${this.filename}`;

        // Simulate a finding for testing purposes
        const testFinding = {
          type: "Test Finding",
          description: "This is a test finding to verify TruffleHog integration",
          value: "https://username:password@example.com",
          raw_value: "https://username:password@example.com",
          redacted_value: "https://username:********@example.com",
          file: "test_file.txt",
          line: 42,
          source_name: "TruffleHog Test",
          source_type: "Test",
          detector_type: "URI",
          detector_name: "TruffleHog Test Detector",
          decoder_name: "PLAIN",
          verified: true,
          verification_error: null,
          verification_cached: false
        };

        // Process the test finding
        this.handleScanResults({
          findings: [testFinding]
        });

        this.$emit('show-snackbar', {
          text: 'TruffleHog test completed successfully with test data',
          color: 'success'
        });
      } catch (error) {
        console.error('Error in test scan:', error);
        this.$emit('show-snackbar', {
          text: 'Error in test scan: ' + (error.response?.data?.message || error.message),
          color: 'error'
        });
      }
    },

    async downloadLibrary(arch, lib) {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_APP_API_URL}/audit/download-library/${this.filename}/${arch}/${lib}`,
          { responseType: 'blob' }
        );

        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', lib.split('/').pop());
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error downloading library:', error);
        this.$emit('show-snackbar', {
          text: 'Error downloading library: ' + (error.response?.data?.message || error.message),
          color: 'error'
        });
      }
    }
  }
};
</script>


<style scoped>
.theme--dark .v-card,
.theme--dark .v-card-title,
.theme--dark .v-card-text,
.theme--dark .v-tabs,
.theme--dark .v-window,
.theme--dark .v-window-item,
.theme--dark .v-list {
  background-color: #1e1e1e;
  color: #ffffff;
}

.theme--light .v-card,
.theme--light .v-card-title,
.theme--light .v-card-text,
.theme--light .v-tabs,
.theme--light .v-window,
.theme--light .v-window-item,
.theme--light .v-list {
  background-color: #ffffff;
  color: #000000;
}

.secret-value {
  font-family: 'Roboto Mono', monospace;
  font-size: 0.9rem;
  padding: 6px 10px;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.05);
  word-break: break-all;
  display: block;
  margin-top: 4px;
}

.context-box {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.9em;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}

.secret-details {
  font-size: 0.9em;
}

.verification-card {
  border-width: 2px !important;
}

.bg-error-subtle {
  background-color: rgba(var(--v-theme-error), 0.05) !important;
}

.bg-warning-subtle {
  background-color: rgba(var(--v-theme-warning), 0.05) !important;
}

.scheme-text {
  font-family: 'Roboto Mono', monospace;
  font-size: 0.9rem;
  background-color: rgba(128, 128, 128, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
  display: inline-block;
}

.keys-section {
  margin-top: 16px;
}

.theme--dark .secret-value {
  background-color: rgba(255, 255, 255, 0.05);
}

:deep(.theme--dark) .context-box {
  background-color: rgba(255, 255, 255, 0.05);
}

:deep(.theme--dark) .secret-value {
  background-color: rgba(255, 193, 7, 0.15);
}
</style>
