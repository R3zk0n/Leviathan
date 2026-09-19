<template>
  <v-dialog :model-value="dialog" @update:model-value="closeDialog" max-width="1000px" persistent>
    <v-card class="modern-card" :class="isDark ? 'theme--dark' : 'theme--light'">
      <v-card-title class="headline d-flex align-center">
        <v-icon class="mr-2">mdi-information-outline</v-icon>
        iOS Binary Information
        <v-spacer></v-spacer>
        <v-btn icon variant="text" @click="closeDialog">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text class="pa-0">
        <v-tabs
          :model-value="tab"
          @update:model-value="updateTab"
          class="modern-tabs"
          color="primary"
          slider-color="primary"
          grow
        >
          <v-tab value="info" class="modern-tab">
            <v-icon start>mdi-information</v-icon>
            App Info
          </v-tab>
          <v-tab value="file-info" class="modern-tab">
            <v-icon start>mdi-file-document</v-icon>
            File Info
          </v-tab>
          <v-tab value="segments" class="modern-tab">
            <v-icon start>mdi-view-module</v-icon>
            Segments
          </v-tab>
          <v-tab value="load-commands" class="modern-tab">
            <v-icon start>mdi-library</v-icon>
            Dylib Load
          </v-tab>
          <v-tab value="sections" class="modern-tab">
            <v-icon start>mdi-code-braces</v-icon>
            Sections
          </v-tab>
          <v-tab value="encryption-info" class="modern-tab">
            <v-icon start>mdi-shield-lock</v-icon>
            Encryption
          </v-tab>
          <v-tab value="deep-links" class="modern-tab">
            <v-icon start>mdi-link-variant</v-icon>
            Deep Links
            <v-chip v-if="totalLinksCount > 0" size="x-small" color="primary" variant="tonal" class="ml-1">{{ totalLinksCount }}</v-chip>
          </v-tab>
        </v-tabs>

        <v-divider></v-divider>

        <v-tabs-window :model-value="tab" @update:model-value="updateTab" class="modern-content">
          <v-tabs-window-item value="info" class="tab-content">
            <div v-if="!loading" class="content-wrapper">
              <div v-if="Object.keys(content).length" class="info-grid">
                <!-- Main Info Card -->
                <v-card class="info-card main-info" elevation="2">
                  <v-card-title class="card-header">
                    <v-icon class="card-icon">mdi-application</v-icon>
                    Binary Overview
                  </v-card-title>
                  <v-card-text class="pa-4">
                    <div class="info-row">
                      <span class="info-label">Filename</span>
                      <v-chip color="primary" variant="tonal" size="small">{{ content['Filename'] }}</v-chip>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Architecture</span>
                      <v-chip color="secondary" variant="outlined" size="small">{{ content.Architecture }}</v-chip>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Endianness</span>
                      <span class="info-value">{{ content.Endianness }}</span>
                    </div>
                  </v-card-text>
                </v-card>

                <!-- Security Info Card -->
                <v-card class="info-card security-info" elevation="2">
                  <v-card-title class="card-header">
                    <v-icon class="card-icon">mdi-security</v-icon>
                    Security Details
                  </v-card-title>
                  <v-card-text class="pa-4">
                    <div class="info-row">
                      <span class="info-label">Signing Identity</span>
                      <v-chip
                        :color="content['Signing Identity'] ? 'success' : 'warning'"
                        variant="tonal"
                        size="small"
                        class="text-truncate"
                        style="max-width: 200px;"
                      >
                        {{ content['Signing Identity'] || 'Not Available' }}
                      </v-chip>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Team ID</span>
                      <v-chip
                        :color="content['Team ID'] ? 'success' : 'warning'"
                        variant="tonal"
                        size="small"
                      >
                        {{ content['Team ID'] || 'Not Available' }}
                      </v-chip>
                    </div>
                    <div class="info-row encryption-row">
                      <span class="info-label">Encryption Status</span>
                      <div class="encryption-indicator">
                        <v-icon
                          :color="encryptedStatus ? 'error' : 'success'"
                          :icon="encryptedStatus ? 'mdi-shield-lock' : 'mdi-shield-check'"
                          class="mr-2"
                        ></v-icon>
                        <v-chip
                          :color="encryptedStatus ? 'error' : 'success'"
                          variant="tonal"
                          size="small"
                        >
                          {{ encryptedStatus ? 'Encrypted' : 'Not Encrypted' }}
                        </v-chip>
                      </div>
                    </div>
                  </v-card-text>
                </v-card>

                <!-- Memory Info Card -->
                <v-card class="info-card memory-info" elevation="2">
                  <v-card-title class="card-header">
                    <v-icon class="card-icon">mdi-memory</v-icon>
                    Memory Layout
                  </v-card-title>
                  <v-card-text class="pa-4">
                    <div class="info-row">
                      <span class="info-label">Virtual Base</span>
                      <code class="memory-address">{{ content['Virtual Base'] }}</code>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Virtual Address</span>
                      <code class="memory-address highlighted">{{ content['Virtual Address'] }}</code>
                    </div>
                  </v-card-text>
                </v-card>
              </div>
              <div v-else class="empty-state">
                <v-icon size="64" color="grey">mdi-information-outline</v-icon>
                <h3 class="mt-4 text-grey">No information available</h3>
                <p class="text-grey-darken-1">Binary information could not be loaded</p>
              </div>
            </div>
            <div v-else class="loading-state">
              <v-progress-circular indeterminate color="primary" size="48"></v-progress-circular>
              <p class="mt-4">Loading binary information...</p>
            </div>
          </v-tabs-window-item>

          <v-tabs-window-item value="file-info" class="tab-content">
            <div v-if="!loading" class="content-wrapper">
              <div v-if="fileInfo && Object.keys(fileInfo).length">
                <v-card class="hash-card" elevation="2">
                  <v-card-title class="card-header">
                    <v-icon class="card-icon">mdi-fingerprint</v-icon>
                    File Hashes & Information
                  </v-card-title>
                  <v-card-text class="pa-4">
                    <div class="hash-grid">
                      <div class="hash-item">
                        <div class="hash-label">
                          <v-icon size="20" class="mr-2">mdi-key-variant</v-icon>
                          SHA1
                        </div>
                        <code class="hash-value selectable">{{ fileInfo.SHA1 }}</code>
                        <v-btn icon size="small" variant="text" @click="copyToClipboard(fileInfo.SHA1)">
                          <v-icon size="18">mdi-content-copy</v-icon>
                        </v-btn>
                      </div>

                      <div class="hash-item">
                        <div class="hash-label">
                          <v-icon size="20" class="mr-2">mdi-shield-key</v-icon>
                          SHA256
                        </div>
                        <code class="hash-value selectable">{{ fileInfo.SHA256 }}</code>
                        <v-btn icon size="small" variant="text" @click="copyToClipboard(fileInfo.SHA256)">
                          <v-icon size="18">mdi-content-copy</v-icon>
                        </v-btn>
                      </div>

                      <div class="hash-item">
                        <div class="hash-label">
                          <v-icon size="20" class="mr-2">mdi-lock</v-icon>
                          MD5
                        </div>
                        <code class="hash-value selectable">{{ fileInfo.MD5 }}</code>
                        <v-btn icon size="small" variant="text" @click="copyToClipboard(fileInfo.MD5)">
                          <v-icon size="18">mdi-content-copy</v-icon>
                        </v-btn>
                      </div>

                      <div class="hash-item">
                        <div class="hash-label">
                          <v-icon size="20" class="mr-2">mdi-file-outline</v-icon>
                          Binary Size
                        </div>
                        <v-chip color="info" variant="tonal">{{ fileInfo['Binary Size'] }}</v-chip>
                      </div>
                    </div>
                  </v-card-text>
                </v-card>
              </div>
              <div v-else class="empty-state">
                <v-icon size="64" color="grey">mdi-file-document-outline</v-icon>
                <h3 class="mt-4 text-grey">No file information available</h3>
              </div>
            </div>
            <div v-else class="loading-state">
              <v-progress-circular indeterminate color="primary" size="48"></v-progress-circular>
              <p class="mt-4">Loading file information...</p>
            </div>
          </v-tabs-window-item>

          <v-tabs-window-item value="segments" class="tab-content">
            <div v-if="!loading" class="content-wrapper">
              <div v-if="segments.length" class="code-content">
                <v-card elevation="2">
                  <v-card-title class="card-header">
                    <v-icon class="card-icon">mdi-view-module</v-icon>
                    Memory Segments
                  </v-card-title>
                  <v-card-text class="pa-0">
                    <div class="code-container">
                      <pre v-for="(segment, index) in segments" :key="index" class="segment-item">{{ segment }}</pre>
                    </div>
                  </v-card-text>
                </v-card>
              </div>
              <div v-else class="empty-state">
                <v-icon size="64" color="grey">mdi-view-module</v-icon>
                <h3 class="mt-4 text-grey">No segments information available</h3>
              </div>
            </div>
            <div v-else class="loading-state">
              <v-progress-circular indeterminate color="primary" size="48"></v-progress-circular>
              <p class="mt-4">Loading segments...</p>
            </div>
          </v-tabs-window-item>

          <v-tabs-window-item value="load-commands" class="tab-content">
            <div v-if="!loading" class="content-wrapper">
              <div v-if="loadCommands.length" class="code-content">
                <v-card elevation="2">
                  <v-card-title class="card-header">
                    <v-icon class="card-icon">mdi-library</v-icon>
                    Dynamic Library Load Commands
                  </v-card-title>
                  <v-card-text class="pa-0">
                    <div class="code-container">
                      <pre v-for="(command, index) in loadCommands" :key="index" class="command-item">{{ command }}</pre>
                    </div>
                  </v-card-text>
                </v-card>
              </div>
              <div v-else class="empty-state">
                <v-icon size="64" color="grey">mdi-library</v-icon>
                <h3 class="mt-4 text-grey">No load commands available</h3>
              </div>
            </div>
            <div v-else class="loading-state">
              <v-progress-circular indeterminate color="primary" size="48"></v-progress-circular>
              <p class="mt-4">Loading load commands...</p>
            </div>
          </v-tabs-window-item>

          <v-tabs-window-item value="sections" class="tab-content">
            <div v-if="!loading" class="content-wrapper">
              <div v-if="sections.length" class="code-content">
                <v-card elevation="2">
                  <v-card-title class="card-header">
                    <v-icon class="card-icon">mdi-code-braces</v-icon>
                    Binary Sections
                  </v-card-title>
                  <v-card-text class="pa-0">
                    <div class="code-container">
                      <pre v-for="(section, index) in sections" :key="index" class="section-item"><code>{{ section }}</code></pre>
                    </div>
                  </v-card-text>
                </v-card>
              </div>
              <div v-else class="empty-state">
                <v-icon size="64" color="grey">mdi-code-braces</v-icon>
                <h3 class="mt-4 text-grey">No sections information available</h3>
              </div>
            </div>
            <div v-else class="loading-state">
              <v-progress-circular indeterminate color="primary" size="48"></v-progress-circular>
              <p class="mt-4">Loading sections...</p>
            </div>
          </v-tabs-window-item>

          <v-tabs-window-item value="encryption-info" class="tab-content">
            <div v-if="!loading" class="content-wrapper">
              <div v-if="encryptionInfo.length" class="code-content">
                <v-card elevation="2">
                  <v-card-title class="card-header">
                    <v-icon class="card-icon">mdi-shield-lock</v-icon>
                    Encryption Information
                  </v-card-title>
                  <v-card-text class="pa-0">
                    <div class="code-container">
                      <pre v-for="(info, index) in encryptionInfo" :key="index" class="encryption-item">{{ info }}</pre>
                    </div>
                  </v-card-text>
                </v-card>
              </div>
              <div v-else class="empty-state">
                <v-icon size="64" color="grey">mdi-shield-lock</v-icon>
                <h3 class="mt-4 text-grey">No encryption information available</h3>
              </div>
            </div>
            <div v-else class="loading-state">
              <v-progress-circular indeterminate color="primary" size="48"></v-progress-circular>
              <p class="mt-4">Loading encryption info...</p>
            </div>
          </v-tabs-window-item>

          <v-tabs-window-item value="deep-links" class="tab-content">
            <div v-if="!loading" class="content-wrapper">
              <div v-if="hasLinks" class="links-grid">
                <!-- URL Schemes -->
                <v-card v-if="deepLinks.url_schemes.length" class="info-card" elevation="2">
                  <v-card-title class="card-header">
                    <v-icon class="card-icon">mdi-cellphone-link</v-icon>
                    URL Schemes
                    <v-chip size="x-small" color="primary" variant="tonal" class="ml-2">{{ deepLinks.url_schemes.length }}</v-chip>
                  </v-card-title>
                  <v-card-text class="pa-0">
                    <div class="links-list">
                      <div v-for="(scheme, index) in deepLinks.url_schemes" :key="'scheme-' + index" class="link-item">
                        <div class="link-header">
                          <v-chip color="primary" variant="tonal" size="small" class="mr-2">
                            <v-icon start size="14">mdi-link</v-icon>
                            {{ scheme.schemes.join(', ') }}://
                          </v-chip>
                          <v-chip v-if="scheme.role" :color="scheme.role === 'Editor' ? 'success' : 'info'" variant="outlined" size="x-small">
                            {{ scheme.role }}
                          </v-chip>
                        </div>
                        <div v-if="scheme.name" class="link-detail">
                          <span class="detail-label">Name:</span>
                          <span class="detail-value">{{ scheme.name }}</span>
                        </div>
                      </div>
                    </div>
                  </v-card-text>
                </v-card>

                <!-- Universal Links -->
                <v-card v-if="deepLinks.universal_links.length" class="info-card" elevation="2">
                  <v-card-title class="card-header">
                    <v-icon class="card-icon">mdi-web</v-icon>
                    Universal Links (Associated Domains)
                    <v-chip size="x-small" color="secondary" variant="tonal" class="ml-2">{{ deepLinks.universal_links.length }}</v-chip>
                  </v-card-title>
                  <v-card-text class="pa-0">
                    <div class="links-list">
                      <div v-for="(link, index) in deepLinks.universal_links" :key="'ulink-' + index" class="link-item">
                        <div class="link-header">
                          <v-chip
                            :color="link.service === 'applinks' ? 'success' : link.service === 'webcredentials' ? 'warning' : 'info'"
                            variant="tonal"
                            size="small"
                            class="mr-2"
                          >
                            <v-icon start size="14">{{ link.service === 'applinks' ? 'mdi-open-in-app' : link.service === 'webcredentials' ? 'mdi-key' : 'mdi-tag' }}</v-icon>
                            {{ link.service }}
                          </v-chip>
                          <code class="domain-value">{{ link.domain }}</code>
                        </div>
                        <div class="link-detail">
                          <span class="detail-label">Raw:</span>
                          <code class="detail-value mono">{{ link.raw }}</code>
                        </div>
                      </div>
                    </div>
                  </v-card-text>
                </v-card>

                <!-- Queried Schemes -->
                <v-card v-if="deepLinks.queried_schemes.length" class="info-card queried-card" elevation="2">
                  <v-card-title class="card-header">
                    <v-icon class="card-icon">mdi-magnify</v-icon>
                    Queried Schemes (LSApplicationQueriesSchemes)
                    <v-chip size="x-small" color="warning" variant="tonal" class="ml-2">{{ deepLinks.queried_schemes.length }}</v-chip>
                  </v-card-title>
                  <v-card-text class="pa-4">
                    <div class="schemes-chips">
                      <v-chip
                        v-for="(qs, index) in deepLinks.queried_schemes"
                        :key="'qs-' + index"
                        color="warning"
                        variant="tonal"
                        size="small"
                        class="ma-1"
                      >
                        <v-icon start size="14">mdi-open-in-app</v-icon>
                        {{ qs }}://
                      </v-chip>
                    </div>
                  </v-card-text>
                </v-card>
              </div>
              <div v-else class="empty-state">
                <v-icon size="64" color="grey">mdi-link-variant-off</v-icon>
                <h3 class="mt-4 text-grey">No deep links found</h3>
                <p class="text-grey-darken-1">This binary has no URL schemes, universal links, or queried schemes</p>
              </div>
            </div>
            <div v-else class="loading-state">
              <v-progress-circular indeterminate color="primary" size="48"></v-progress-circular>
              <p class="mt-4">Loading deep links...</p>
            </div>
          </v-tabs-window-item>
        </v-tabs-window>
      </v-card-text>

      <v-card-actions class="modern-actions">
        <v-btn
          color="secondary"
          variant="tonal"
          @click="dumpStrings(file)"
          :disabled="loading"
          prepend-icon="mdi-text"
        >
          Dump Strings
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
import { mapState } from 'vuex';

export default {
  name: 'InfoSection',
  props: {
    dialog: Boolean,
    content: {
      type: Object,
      required: true,
      default: () => ({})
    },
    segments: {
      type: Array,
      required: true,
      default: () => []
    },
    loadCommands: {
      type: Array,
      required: true,
      default: () => []
    },
    sections: {
      type: Array,
      required: true,
      default: () => []
    },
    fileInfo: {
      type: Object,
      required: true,
      default: () => ({})
    },
    encryptionInfo: {
      type: Array,
      required: true,
      default: () => []
    },
    deepLinks: {
      type: Object,
      default: () => ({ url_schemes: [], universal_links: [], queried_schemes: [] })
    },
    tab: {
      type: String,
      required: true
    },
    file: {
      type: String,
      required: true
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      encryptedStatus: null // To store the encryption status
    };
  },
  computed: {
    ...mapState(['isDark']),
    hasLinks() {
      return this.deepLinks.url_schemes.length > 0 ||
        this.deepLinks.universal_links.length > 0 ||
        this.deepLinks.queried_schemes.length > 0;
    },
    totalLinksCount() {
      return this.deepLinks.url_schemes.length +
        this.deepLinks.universal_links.length +
        this.deepLinks.queried_schemes.length;
    }
  },
  watch: {
    dialog(newVal) {
      if (newVal) {
        this.updateEncryptedStatus();
      }
    },
    encryptionInfo: {
      handler(newVal) {
        this.updateEncryptedStatus();
      },
      deep: true
    }
  },
  methods: {
    closeDialog() {
      this.$emit('update:dialog', false);
    },
    updateTab(value) {
      this.$emit('update:tab', value);
    },
    dumpStrings(file) {
      this.$emit('dump-strings', file);
    },
    updateEncryptedStatus() {
      console.log('Updating encrypted status');
      if (this.encryptionInfo.length > 0) {
        const cryptId = this.encryptionInfo[0].cryptid;
        this.encryptedStatus = cryptId === 1;
      } else {
        this.encryptedStatus = false; // Default value if no encryption info is found
      }
    },
    async copyToClipboard(text) {
      try {
        await navigator.clipboard.writeText(text);
      } catch (err) {
        console.error('Failed to copy: ', err);
      }
    }
  },
  mounted() {
    console.log('Info Section Mounted');
    console.log('Content:', this.content); // Log the content object to debug
    console.log('Encrypted:', this.encryptionInfo); // Log the encrypted status to debug
    this.updateEncryptedStatus();
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

/* Info Grid Layout */
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.info-grid .memory-info {
  grid-column: 1 / -1;
}

@media (max-width: 768px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
}

/* Info Cards */
.info-card {
  border-radius: 12px !important;
  border: 1px solid rgba(0, 0, 0, 0.05);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.info-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15) !important;
}

.card-header {
  padding: 16px 20px !important;
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 600 !important;
  font-size: 1rem !important;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.card-icon {
  color: rgb(99, 102, 241) !important;
}

/* Info Rows */
.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.info-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.info-label {
  font-weight: 500;
  display: flex;
  align-items: center;
  min-width: 120px;
}

.info-value {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-weight: 500;
}

/* Memory Addresses */
.memory-address {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  background: rgba(99, 102, 241, 0.1);
  color: rgb(67, 56, 202);
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
}

.memory-address.highlighted {
  background: rgba(236, 72, 153, 0.15);
  color: rgb(190, 24, 93);
}

/* Encryption Row */
.encryption-row {
  background: rgba(16, 185, 129, 0.02);
  padding: 16px 0 !important;
  border-radius: 8px;
  margin: 8px 0;
}

.encryption-indicator {
  display: flex;
  align-items: center;
}

/* Hash Grid */
.hash-grid {
  display: grid;
  gap: 20px;
}

.hash-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.hash-label {
  display: flex;
  align-items: center;
  font-weight: 600;
  min-width: 80px;
}

.hash-value {
  flex: 1;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.85rem;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  word-break: break-all;
}

.selectable {
  user-select: all;
  cursor: text;
}

/* Code Containers */
.code-content {
  padding: 0;
}

.code-container {
  max-height: 400px;
  overflow-y: auto;
  border-radius: 0 0 12px 12px;
}

.segment-item,
.command-item,
.section-item,
.encryption-item {
  margin: 0;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.segment-item:last-child,
.command-item:last-child,
.section-item:last-child,
.encryption-item:last-child {
  border-bottom: none;
}

/* Deep Links */
.links-grid {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.links-grid .queried-card {
  grid-column: 1 / -1;
}

.links-list {
  max-height: 300px;
  overflow-y: auto;
}

.link-item {
  padding: 14px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.link-item:last-child {
  border-bottom: none;
}

.link-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.link-detail {
  margin-top: 8px;
  padding-left: 8px;
  font-size: 0.85rem;
}

.detail-label {
  font-weight: 500;
  margin-right: 8px;
  color: rgba(0, 0, 0, 0.6);
}

.detail-value.mono {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.85rem;
}

.domain-value {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9rem;
  font-weight: 600;
  background: rgba(99, 102, 241, 0.1);
  color: rgb(67, 56, 202);
  padding: 4px 10px;
  border-radius: 6px;
}

.schemes-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
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
}

/* Content Areas */
.modern-content {
  min-height: 500px;
  max-height: 600px;
  overflow-y: auto;
}

.tab-content {
  padding: 0 !important;
}

.content-wrapper {
  padding: 24px;
}

.modern-actions {
  padding: 20px 24px !important;
}

/* Standard Theme Classes */
.theme--dark .v-card,
.theme--dark .v-card-title,
.theme--dark .v-card-text,
.theme--dark .v-tabs,
.theme--dark .v-window,
.theme--dark .v-window-item,
.theme--dark .modern-content,
.theme--dark .tab-content,
.theme--dark .content-wrapper {
  background-color: #1e1e1e;
  color: #ffffff;
}

.theme--light .v-card,
.theme--light .v-card-title,
.theme--light .v-card-text,
.theme--light .v-tabs,
.theme--light .v-window,
.theme--light .v-window-item,
.theme--light .modern-content,
.theme--light .tab-content,
.theme--light .content-wrapper {
  background-color: #ffffff;
  color: #000000;
}

/* Dark Theme Specific Adjustments */
.theme--dark .info-card {
  background-color: #2d2d2d;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.theme--dark .card-header {
  background-color: #262626;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.theme--dark .info-row {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.theme--dark .hash-item {
  background-color: #2d2d2d;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.theme--dark .hash-value {
  background-color: #1e1e1e;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.theme--dark .code-container {
  background-color: #1e1e1e;
}

.theme--dark .segment-item,
.theme--dark .command-item,
.theme--dark .section-item,
.theme--dark .encryption-item {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.theme--dark .modern-actions {
  background-color: #262626;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.theme--dark .link-item {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.theme--dark .detail-label {
  color: rgba(255, 255, 255, 0.5);
}

.theme--dark .domain-value {
  background: rgba(99, 102, 241, 0.2);
  color: rgb(165, 180, 252);
}

.theme--dark .memory-address {
  background: rgba(99, 102, 241, 0.2);
  color: rgb(165, 180, 252);
}

.theme--dark .memory-address.highlighted {
  background: rgba(236, 72, 153, 0.2);
  color: rgb(244, 114, 182);
}

/* Light Theme Specific Adjustments */
.theme--light .info-card {
  background-color: #ffffff;
}

.theme--light .card-header {
  background-color: #f8fafc;
}

.theme--light .hash-item {
  background-color: rgba(248, 250, 252, 0.5);
}

.theme--light .hash-value {
  background-color: #ffffff;
}

.theme--light .code-container {
  background-color: #f8fafc;
}

.theme--light .modern-actions {
  background-color: #f8fafc;
}
</style>
