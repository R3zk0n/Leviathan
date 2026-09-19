<template>
  <v-container :class="{ 'theme--dark': isDark, 'theme--light': !isDark }">
    <!-- Loading State -->
    <v-row v-if="loading" justify="center" align="center" style="height: 80vh;">
      <v-col cols="12" class="text-center">
        <v-progress-circular
          indeterminate
          color="primary"
          size="64"
        ></v-progress-circular>
        <div class="mt-4 text-body-1">Loading settings...</div>
      </v-col>
    </v-row>

    <!-- Error State -->
    <v-row v-else-if="error" justify="center" align="center" style="height: 80vh;">
      <v-col cols="12" class="text-center">
        <v-alert
          type="error"
          icon="mdi-alert-circle"
          prominent
          border="left"
        >
          {{ error }}
          <template v-slot:append>
            <v-btn color="error" @click="initializeComponent">Retry</v-btn>
          </template>
        </v-alert>
      </v-col>
    </v-row>

    <!-- Content State -->
    <template v-else>
      <v-card class="mx-auto" max-width="1400" :class="{ 'theme--dark': isDark, 'theme--light': !isDark }">
        <v-card-title class="text-h4 text-center">Engine Settings</v-card-title>
        <v-card-text>
          <v-row>
            <!-- Vertical Tabs -->
            <v-col cols="12" md="3">
              <v-tabs
                v-model="activeTab"
                direction="vertical"
                color="primary"
                :disabled="saving || engineConfig.loading || engineConfig.saving"
                class="engine-settings-tabs"
                density="comfortable"
              >
                <v-tab :value="'settings'">
                  <v-icon class="mr-2">mdi-tune</v-icon>
                  Settings
                </v-tab>
                <v-tab :value="'engineConfig'">
                  <v-icon class="mr-2">mdi-file-cog</v-icon>
                  EngineConfig.json5
                </v-tab>
                <v-tab v-if="chainReconEnabled" :value="'permissions'" @click="loadPermissionsMap">
                  <v-icon class="mr-2">mdi-key-chain</v-icon>
                  Chain Recon
                </v-tab>
              </v-tabs>
            </v-col>

            <!-- Tab Content -->
            <v-col cols="12" md="9">
              <v-window v-model="activeTab" class="engine-settings-window">
                <!-- Settings tab (existing form) -->
                <v-window-item :value="'settings'">
                  <v-form @submit.prevent="debouncedSaveSettings" :disabled="saving">
                    <v-row>
                      <!-- Basic Settings Column -->
                      <v-col cols="12" md="6">
                        <v-card-subtitle class="text-h6 mb-3">Basic Configuration</v-card-subtitle>

                        <v-text-field
                          v-model="localSettings.apkPath"
                          label="APK Path *"
                          required
                          :disabled="saving"
                          :dark="isDark"
                          hint="Absolute path to the app to be scanned"
                          persistent-hint
                        ></v-text-field>

                        <v-text-field
                          v-model="localSettings.outPath"
                          label="Output Path *"
                          required
                          :disabled="saving"
                          :dark="isDark"
                          hint="Directory for scan results"
                          persistent-hint
                        ></v-text-field>

                        <!-- Rule Path Selector -->
                        <v-select
                          v-model="localSettings.rulePath"
                          :items="availableDirectories"
                          label="Rule Directory *"
                          :loading="loadingDirectories"
                          :disabled="saving || loadingDirectories"
                          :dark="isDark"
                          persistent-hint
                          hint="Select a directory to view its rules"
                          @update:model-value="fetchRules"
                        >
                          <template v-slot:append-inner>
                            <v-progress-circular
                              v-if="loadingDirectories"
                              indeterminate
                              size="20"
                              color="primary"
                            ></v-progress-circular>
                          </template>
                        </v-select>

                        <!-- Rules Selector -->
                        <v-select
                          v-model="selectedRules"
                          :items="availableRules"
                          label="Rules *"
                          placeholder="Select rules"
                          :loading="loadingRules"
                          :disabled="saving || loadingRules"
                          multiple
                          chips
                          item-title="text"
                          item-value="value"
                          return-object
                          :dark="isDark"
                          hint="Comma-separated list of scanning rules"
                          persistent-hint
                        >
                          <template v-slot:prepend-item>
                            <v-list-item
                              ripple
                              @click="toggleAllRules"
                              :disabled="saving || loadingRules"
                            >
                              <v-list-item-action>
                                <v-icon :color="selectedRules.length > 0 ? 'indigo darken-4' : ''">
                                  {{ icon }}
                                </v-icon>
                              </v-list-item-action>
                              <v-list-item-content>
                                <v-list-item-title>
                                  {{ selectedRules.length === availableRules.length ? 'Deselect All' : 'Select All' }}
                                </v-list-item-title>
                              </v-list-item-content>
                            </v-list-item>
                            <v-divider class="mt-2"></v-divider>
                          </template>
                          <template v-slot:append-inner>
                            <v-progress-circular
                              v-if="loadingRules"
                              indeterminate
                              size="20"
                              color="primary"
                            ></v-progress-circular>
                          </template>
                        </v-select>

                        <!-- Path Configuration -->
                        <v-text-field
                          v-model="localSettings.sdkPath"
                          label="SDK Path (Optional)"
                          :disabled="saving"
                          :dark="isDark"
                          hint="Android framework directory path (leave empty for default)"
                          persistent-hint
                          placeholder="/appshark_engine/appshark/tools/platforms"
                          clearable
                          @click:clear="clearOptionalField('sdkPath')"
                        ></v-text-field>

                        <v-text-field
                          v-model="localSettings.toolsPath"
                          label="Tools Path (Optional)"
                          :disabled="saving"
                          :dark="isDark"
                          hint="Directory containing jadx and platforms (leave empty for default)"
                          persistent-hint
                          placeholder="/appshark_engine/appshark/tools"
                          clearable
                          @click:clear="clearOptionalField('toolsPath')"
                        ></v-text-field>
                      </v-col>

                      <!-- Analysis Settings Column -->
                      <v-col cols="12" md="6">
                        <v-card-subtitle class="text-h6 mb-3">Analysis Configuration</v-card-subtitle>

                        <v-select
                          v-model="localSettings.debugRule"
                          :items="availableRules"
                          label="Debug Rule (Optional)"
                          placeholder="Select a specific rule to debug"
                          :disabled="saving || loadingRules"
                          :loading="loadingRules"
                          :dark="isDark"
                          item-title="text"
                          item-value="value"
                          hint="Specific rule to debug (leave empty to debug all rules)"
                          persistent-hint
                          clearable
                          @click:clear="clearOptionalField('debugRule')"
                        >
                          <template v-slot:append-inner>
                            <v-progress-circular
                              v-if="loadingRules"
                              indeterminate
                              size="20"
                              color="primary"
                            ></v-progress-circular>
                          </template>
                          <template v-slot:no-data>
                            <v-list-item>
                              <v-list-item-title>
                                {{ loadingRules ? 'Loading rules...' : 'Select a rule directory first to load rules' }}
                              </v-list-item-title>
                            </v-list-item>
                          </template>
                        </v-select>

                        <v-select
                          v-model="localSettings.logLevel"
                          :items="logLevelOptions"
                          label="Log Level"
                          :disabled="saving"
                          :dark="isDark"
                          item-title="title"
                          item-value="value"
                          hint="Controls verbosity of logging output"
                          persistent-hint
                        ></v-select>

                        <v-text-field
                          v-model.number="localSettings.maxPointerAnalyzeTime"
                          label="Max Pointer Analyze Time (seconds)"
                          type="number"
                          :disabled="saving"
                          :dark="isDark"
                          hint="Timeout for pointer analysis phase"
                          persistent-hint
                          clearable
                        ></v-text-field>

                        <v-text-field
                          v-model.number="localSettings.maxThread"
                          label="Max Threads"
                          type="number"
                          min="1"
                          max="16"
                          :disabled="saving"
                          :dark="isDark"
                          hint="Parallelism level for analysis (default: 2)"
                          persistent-hint
                          clearable
                        ></v-text-field>

                        <v-text-field
                          v-model.number="localSettings.ruleMaxAnalyzer"
                          label="Rule Max Analyzer"
                          type="number"
                          :disabled="saving"
                          :dark="isDark"
                          hint="Maximum analyzers per rule (default: 5000)"
                          persistent-hint
                          clearable
                        ></v-text-field>

                        <v-text-field
                          v-model.number="localSettings.maxPathLength"
                          label="Max Path Length"
                          type="number"
                          :disabled="saving"
                          :dark="isDark"
                          hint="Maximum path length from source to sink"
                          persistent-hint
                          clearable
                        ></v-text-field>
                      </v-col>
                    </v-row>

                    <!-- Decompiler Engine Row -->
                    <v-row class="mt-4">
                      <v-col cols="12">
                        <v-card-subtitle class="text-h6 mb-3">Decompiler Engine</v-card-subtitle>
                        <v-row align="center">
                          <v-col cols="12" sm="6" md="4">
                            <v-select
                              v-model="decompilerEngine"
                              :items="decompilerEngineOptions"
                              label="Default Decompiler"
                              item-title="title"
                              item-value="value"
                              :dark="isDark"
                              hint="Applied to new decompile jobs unless overridden per app"
                              persistent-hint
                            ></v-select>

                            <v-switch
                              v-if="decompilerEngine === 'vineflower'"
                              v-model="decompilerResources"
                              label="Extract resources"
                              :disabled="saving"
                              :dark="isDark"
                              color="primary"
                              class="mt-2"
                              hint="Also decode resources (manifest, strings.xml) so secret scanning covers them. Slower. JADX always includes resources."
                              persistent-hint
                            ></v-switch>
                          </v-col>
                          <v-col cols="12" sm="6" md="8">
                            <v-alert
                              type="info"
                              variant="tonal"
                              density="compact"
                              class="mb-0"
                            >
                              Vineflower uses dex2jar and produces Java-only output (no resources);
                              useful when JADX mis-parses.
                            </v-alert>
                          </v-col>
                        </v-row>
                      </v-col>
                    </v-row>

                    <!-- Feature Toggles Row -->
                    <v-row class="mt-4">
                      <v-col cols="12">
                        <v-card-subtitle class="text-h6 mb-3">Feature Configuration</v-card-subtitle>
                        <v-row>
                          <v-col cols="12" sm="6" md="4">
                            <v-switch
                              v-model="localSettings.javaSource"
                              label="Java Source Code"
                              :disabled="saving"
                              :dark="isDark"
                              color="primary"
                              hint="Display decompiled Java code in results"
                              persistent-hint
                            ></v-switch>
                          </v-col>
                          <v-col cols="12" sm="6" md="4">
                            <v-switch
                              v-model="localSettings.partialResultsEnabled"
                              label="Partial Results Mode"
                              :disabled="saving"
                              :dark="isDark"
                              color="warning"
                              hint="Show partial findings if results.json is missing (accessibility may be unknown)"
                              persistent-hint
                            ></v-switch>
                          </v-col>
                          <v-col cols="12" sm="6" md="4">
                            <v-switch
                              v-model="localSettings.javaSourceHighlighting"
                              label="Java Source Highlighting"
                              :disabled="saving || !localSettings.javaSource"
                              :dark="isDark"
                              color="primary"
                              hint="Enable syntax highlighting in Java source code (requires Java Source)"
                              persistent-hint
                            ></v-switch>
                          </v-col>
                          <v-col cols="12" sm="6" md="4">
                            <v-switch
                              v-model="localSettings.verboseRuleLogging"
                              label="Verbose Rule Logging"
                              :disabled="saving"
                              :dark="isDark"
                              color="info"
                              hint="Enable detailed logging for rule processing and taint flow analysis"
                              persistent-hint
                            ></v-switch>
                          </v-col>
                          <v-col cols="12" sm="6" md="4">
                            <v-switch
                              v-model="localSettings.callBackEnhance"
                              label="Callback Enhancement"
                              :disabled="saving"
                              :dark="isDark"
                              color="primary"
                              hint="Directly call anonymous class overridden functions"
                              persistent-hint
                            ></v-switch>
                          </v-col>
                          <v-col cols="12" sm="6" md="4">
                            <v-switch
                              v-model="localSettings.supportFragment"
                              label="Fragment Support"
                              :disabled="saving"
                              :dark="isDark"
                              color="primary"
                              hint="Process Fragment lifecycle functions"
                              persistent-hint
                            ></v-switch>
                          </v-col>
                          <v-col cols="12" sm="6" md="4">
                            <v-switch
                              v-model="localSettings.wholeProcessMode"
                              label="Whole Process Mode"
                              :disabled="saving"
                              :dark="isDark"
                              color="warning"
                              hint="Full program analysis (slower but more thorough)"
                              persistent-hint
                            ></v-switch>
                          </v-col>
                          <v-col cols="12" sm="6" md="4">
                            <v-switch
                              v-model="localSettings.skipAnalyzeNonRelatedMethods"
                              label="Skip Non-Related Methods"
                              :disabled="saving"
                              :dark="isDark"
                              color="primary"
                              hint="Skip methods unrelated to source/sink"
                              persistent-hint
                            ></v-switch>
                          </v-col>
                          <v-col cols="12" sm="6" md="4">
                            <v-switch
                              v-model="localSettings.skipPointerPropagationForLibraryMethod"
                              label="Skip Library Pointer Propagation"
                              :disabled="saving"
                              :dark="isDark"
                              color="primary"
                              hint="Skip pointer propagation for library methods"
                              persistent-hint
                            ></v-switch>
                          </v-col>
                          <v-col cols="12" sm="6" md="4">
                            <v-switch
                              v-model="localSettings.selectivePrimeTaint"
                              label="Selective Prime Taint"
                              :disabled="saving"
                              :dark="isDark"
                              color="primary"
                              hint="Track taint through object-to-String getters (e.g. uri.getLastPathSegment()); still blocks String-to-String soup. Finds more (e.g. ContentProvider path traversal) with no losses. Off = upstream behavior."
                              persistent-hint
                            ></v-switch>
                          </v-col>
                          <v-col cols="12" sm="6" md="4">
                            <v-switch
                              v-model="localSettings.checkPermission"
                              label="Check Permissions"
                              :disabled="saving"
                              :dark="isDark"
                              color="primary"
                              hint="Check exported component permissions during analysis"
                              persistent-hint
                            ></v-switch>
                          </v-col>
                          <v-col cols="12" sm="6" md="4">
                            <v-switch
                              v-model="chainReconEnabled"
                              label="Chain Recon"
                              :dark="isDark"
                              color="warning"
                              hint="Cross-app permission map for chaining bugs across apps/OEMs/vendors that share a signature permission. Adds a 'Chain Recon' tab."
                              persistent-hint
                            ></v-switch>
                          </v-col>
                        </v-row>
                      </v-col>
                    </v-row>

                    <!-- Action Buttons -->
                    <v-card-actions class="justify-center mt-6">
                      <v-btn
                        color="success"
                        type="submit"
                        class="mr-4"
                        :loading="saving"
                        :disabled="saving || isScanning"
                        :dark="isDark"
                        size="large"
                      >
                        <v-icon left>mdi-content-save</v-icon>
                        Save Settings
                      </v-btn>
                      <v-btn
                        color="primary"
                        @click="runAnalysis"
                        :loading="isScanning"
                        :disabled="saving || isScanning"
                        :dark="isDark"
                        size="large"
                      >
                        <v-icon left>{{ isScanning ? 'mdi-loading mdi-spin' : 'mdi-radar' }}</v-icon>
                        {{ isScanning ? 'Scanning...' : 'Bulk Scan Analysis' }}
                      </v-btn>
                      <v-btn
                        color="info"
                        @click="resetToDefaults"
                        :disabled="saving || isScanning"
                        :dark="isDark"
                        variant="outlined"
                      >
                        <v-icon left>mdi-restore</v-icon>
                        Reset Defaults
                      </v-btn>
                    </v-card-actions>

                    <!-- Scan Progress -->
                    <v-row v-if="isScanning" class="mt-4">
                      <v-col cols="12" class="text-center">
                        <v-progress-circular
                          :model-value="scanProgress"
                          color="primary"
                          size="64"
                        >
                          {{ Math.round(scanProgress) }}%
                        </v-progress-circular>
                        <div class="mt-2">
                          Scanned {{ scannedApks }} out of {{ totalApks }} APKs
                        </div>
                      </v-col>
                    </v-row>
                  </v-form>
                </v-window-item>

                <!-- EngineConfig.json5 tab -->
                <v-window-item :value="'engineConfig'">
                  <v-row>
                    <v-col cols="12" md="3">
                      <v-tabs
                        v-model="engineConfigUiTab"
                        direction="vertical"
                        color="primary"
                        class="engine-settings-tabs"
                        density="compact"
                      >
                        <v-tab :value="'overview'">
                          <v-icon class="mr-2">mdi-view-dashboard</v-icon>
                          Overview
                        </v-tab>
                        <v-tab :value="'ignore'">
                          <v-icon class="mr-2">mdi-cancel</v-icon>
                          IgnoreList
                        </v-tab>
                        <v-tab :value="'library'">
                          <v-icon class="mr-2">mdi-book-open-page-variant</v-icon>
                          Library
                        </v-tab>
                        <v-tab :value="'callback'">
                          <v-icon class="mr-2">mdi-call-split</v-icon>
                          Callback
                        </v-tab>
                        <v-tab :value="'raw'">
                          <v-icon class="mr-2">mdi-code-json</v-icon>
                          Raw
                        </v-tab>
                      </v-tabs>
                    </v-col>

                    <v-col cols="12" md="9">
                      <v-card variant="tonal" class="mb-4">
                        <v-card-text>
                          <div class="d-flex flex-wrap align-center justify-space-between">
                            <div>
                              <div class="text-subtitle-1 font-weight-medium">EngineConfig.json5</div>
                              <div class="text-body-2 text-medium-emphasis">
                                Path: <code>{{ engineConfig.path }}</code>
                              </div>
                              <div class="text-body-2 text-medium-emphasis" v-if="engineConfig.hash">
                                Loaded hash: <code>{{ engineConfig.hash }}</code>
                              </div>
                            </div>

                            <div class="d-flex ga-2 mt-2 mt-md-0">
                              <v-btn
                                variant="outlined"
                                color="primary"
                                :loading="engineConfig.loading"
                                :disabled="engineConfig.loading || engineConfig.saving"
                                @click="loadEngineConfig"
                              >
                                <v-icon left>mdi-refresh</v-icon>
                                Reload
                              </v-btn>
                              <v-btn
                                color="success"
                                :loading="engineConfig.saving"
                                :disabled="engineConfig.loading || engineConfig.saving || !engineConfig.dirty"
                                @click="saveEngineConfig"
                              >
                                <v-icon left>mdi-content-save</v-icon>
                                Save
                              </v-btn>
                              <v-btn
                                variant="outlined"
                                color="info"
                                :disabled="engineConfig.loading || engineConfig.saving || !engineConfig.dirty"
                                @click="resetEngineConfig"
                              >
                                <v-icon left>mdi-restore</v-icon>
                                Reset
                              </v-btn>
                            </div>
                          </div>

                          <v-alert
                            v-if="engineConfig.parseError"
                            type="warning"
                            variant="tonal"
                            class="mt-4"
                            title="Config parse warning"
                          >
                            {{ engineConfig.parseError }}
                          </v-alert>

                          <v-alert
                            v-if="engineConfig.error"
                            type="error"
                            variant="tonal"
                            class="mt-4"
                            title="Config error"
                          >
                            {{ engineConfig.error }}
                          </v-alert>

                          <v-alert
                            v-if="engineConfig.savedMessage"
                            type="success"
                            variant="tonal"
                            class="mt-4"
                            title="Saved"
                          >
                            {{ engineConfig.savedMessage }}
                          </v-alert>
                        </v-card-text>
                      </v-card>

                      <v-window v-model="engineConfigUiTab">
                        <v-window-item :value="'overview'">
                          <v-card>
                            <v-card-text>
                              <v-row>
                                <v-col cols="12" md="4">
                                  <v-card variant="outlined">
                                    <v-card-text>
                                      <div class="text-subtitle-2">IgnoreList entries</div>
                                      <div class="text-h5">{{ engineConfigModel.ignore.packageNames.length }}</div>
                                    </v-card-text>
                                  </v-card>
                                </v-col>
                                <v-col cols="12" md="4">
                                  <v-card variant="outlined">
                                    <v-card-text>
                                      <div class="text-subtitle-2">Callback classes</div>
                                      <div class="text-h5">{{ engineConfigModel.callbackClassCount }}</div>
                                    </v-card-text>
                                  </v-card>
                                </v-col>
                                <v-col cols="12" md="4">
                                  <v-card variant="outlined">
                                    <v-card-text>
                                      <div class="text-subtitle-2">Dirty</div>
                                      <div class="text-h5">{{ engineConfig.dirty ? 'Yes' : 'No' }}</div>
                                    </v-card-text>
                                  </v-card>
                                </v-col>
                              </v-row>

                              <v-alert variant="tonal" type="info" class="mt-4">
                                Use the left menu to edit common sections (IgnoreList / Callback). For anything else, use the Raw tab.
                              </v-alert>
                            </v-card-text>
                          </v-card>
                        </v-window-item>

                        <v-window-item :value="'ignore'">
                          <v-card>
                            <v-card-text>
                              <div class="d-flex flex-wrap align-center justify-space-between ga-2">
                                <v-text-field
                                  v-model="ignoreSearch"
                                  label="Search packages"
                                  prepend-inner-icon="mdi-magnify"
                                  density="compact"
                                  hide-details
                                  style="max-width: 420px"
                                ></v-text-field>
                                <div class="d-flex ga-2">
                                  <v-btn variant="outlined" color="primary" @click="addIgnorePackage">
                                    <v-icon left>mdi-plus</v-icon>
                                    Add
                                  </v-btn>
                                  <v-btn variant="outlined" color="error" :disabled="!engineConfigModel.ignore.selected.length" @click="removeSelectedIgnore">
                                    <v-icon left>mdi-delete</v-icon>
                                    Remove selected
                                  </v-btn>
                                </div>
                              </div>

                              <v-data-table
                                :items="filteredIgnorePackages"
                                :headers="ignoreHeaders"
                                item-value="value"
                                show-select
                                v-model="engineConfigModel.ignore.selected"
                                class="mt-3"
                                density="compact"
                              ></v-data-table>
                            </v-card-text>
                          </v-card>
                        </v-window-item>

                        <v-window-item :value="'library'">
                          <v-card>
                            <v-card-text>
                              <div class="d-flex flex-wrap align-center justify-space-between ga-2">
                                <v-text-field
                                  v-model="librarySearch"
                                  label="Search library prefixes"
                                  prepend-inner-icon="mdi-magnify"
                                  density="compact"
                                  hide-details
                                  style="max-width: 420px"
                                ></v-text-field>
                                <div class="d-flex ga-2">
                                  <v-btn variant="outlined" color="primary" @click="addLibraryPrefix">
                                    <v-icon left>mdi-plus</v-icon>
                                    Add
                                  </v-btn>
                                  <v-btn variant="outlined" color="error" :disabled="!engineConfigModel.library.selected.length" @click="removeSelectedLibrary">
                                    <v-icon left>mdi-delete</v-icon>
                                    Remove selected
                                  </v-btn>
                                </div>
                              </div>

                              <v-alert type="info" variant="tonal" class="mt-3">
                                Toggle prefixes on/off to quickly include/exclude libraries during analysis. Disabled items are kept in the config as <code>//</code> commented lines so you can re-enable them later.
                              </v-alert>

                              <v-data-table
                                :items="filteredLibraryPrefixes"
                                :headers="libraryHeaders"
                                item-value="value"
                                show-select
                                v-model="engineConfigModel.library.selected"
                                class="mt-3"
                                density="compact"
                              >
                                <template #item.enabled="{ item }">
                                  <v-switch
                                    v-model="item.enabled"
                                    density="compact"
                                    hide-details
                                    color="primary"
                                    @update:model-value="() => toggleLibraryPrefix(item.value, item.enabled)"
                                  ></v-switch>
                                </template>
                                <template #item.value="{ item }">
                                  <span class="engine-mono">{{ item.value }}</span>
                                </template>
                              </v-data-table>
                            </v-card-text>
                          </v-card>
                        </v-window-item>

                        <v-window-item :value="'callback'">
                          <v-card>
                            <v-card-text>
                              <v-text-field
                                v-model="callbackSearch"
                                label="Search callback classes"
                                prepend-inner-icon="mdi-magnify"
                                density="compact"
                                hide-details
                                style="max-width: 420px"
                              ></v-text-field>

                              <v-expansion-panels class="mt-3" variant="accordion">
                                <v-expansion-panel
                                  v-for="cls in filteredCallbackClasses"
                                  :key="cls.className"
                                >
                                  <v-expansion-panel-title>
                                    <div class="d-flex align-center justify-space-between" style="width: 100%">
                                      <div class="text-body-1">{{ cls.className }}</div>
                                      <v-chip size="small" variant="tonal">{{ cls.methods.length }} methods</v-chip>
                                    </div>
                                  </v-expansion-panel-title>
                                  <v-expansion-panel-text>
                                    <v-list density="compact">
                                      <v-list-item v-for="m in cls.methods" :key="m">
                                        <v-list-item-title class="engine-mono">{{ m }}</v-list-item-title>
                                      </v-list-item>
                                    </v-list>
                                  </v-expansion-panel-text>
                                </v-expansion-panel>
                              </v-expansion-panels>
                            </v-card-text>
                          </v-card>
                        </v-window-item>

                        <v-window-item :value="'raw'">
                          <v-card>
                            <v-card-text>
                              <v-textarea
                                v-model="engineConfig.content"
                                :rows="26"
                                auto-grow
                                :disabled="engineConfig.loading || engineConfig.saving"
                                label="EngineConfig.json5 (JSON5 text)"
                                hint="Edits are saved as-is. Comments are preserved. Server validates JSON5 syntax before writing."
                                persistent-hint
                                spellcheck="false"
                                class="engine-config-textarea"
                              ></v-textarea>
                            </v-card-text>
                          </v-card>
                        </v-window-item>
                      </v-window>
                    </v-col>
                  </v-row>
                </v-window-item>

                <!-- Chain Recon: cross-app permission map -->
                <v-window-item v-if="chainReconEnabled" :value="'permissions'">
                  <v-card variant="tonal" class="mb-4">
                    <v-card-text>
                      <div class="d-flex align-center justify-space-between flex-wrap gap-2">
                        <div>
                          <div class="text-h6">Cross-app permission map</div>
                          <div class="text-caption opacity-80">
                            Which scanned apps declare / require each permission — for chaining bugs across apps that share a (signature) permission.
                            <strong>{{ permMap.length }}</strong> permissions across <strong>{{ permAppCount }}</strong> scanned apps.
                          </div>
                        </div>
                        <div class="d-flex align-center gap-2">
                          <v-chip size="small" color="warning" variant="tonal">{{ permChainableCount }} chain candidates</v-chip>
                          <v-switch v-model="permChainableOnly" label="Chainable only" density="compact" hide-details color="warning" />
                          <v-btn size="small" variant="text" :loading="permLoading" @click="loadPermissionsMap(true)">
                            <v-icon start>mdi-refresh</v-icon>Refresh
                          </v-btn>
                        </div>
                      </div>
                    </v-card-text>
                  </v-card>

                  <v-alert v-if="permError" type="error" variant="tonal" class="mb-4">{{ permError }}</v-alert>

                  <v-table density="comfortable" class="perm-table" v-if="filteredPermMap.length">
                    <thead>
                      <tr>
                        <th>Permission</th>
                        <th>Protection level</th>
                        <th>3rd-party holdable</th>
                        <th>Declared by</th>
                        <th>Required by (components)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="p in filteredPermMap" :key="p.name" :class="{ 'chain-row': p.chainable }">
                        <td>
                          <v-icon v-if="p.chainable" size="x-small" color="warning" class="mr-1">mdi-link-variant</v-icon>
                          <code class="perm-name">{{ p.name }}</code>
                        </td>
                        <td>
                          <v-chip size="x-small" :color="protColor(p.protection_level)" variant="tonal">{{ p.protection_level }}</v-chip>
                        </td>
                        <td>
                          <v-icon size="small" :color="p.third_party_holdable ? 'error' : 'success'">
                            {{ p.third_party_holdable ? 'mdi-lock-open-variant' : 'mdi-shield-check' }}
                          </v-icon>
                        </td>
                        <td>
                          <div v-for="a in p.declared_by" :key="a" class="text-caption">{{ shortPkg(a) }}</div>
                          <span v-if="!p.declared_by.length" class="text-caption opacity-60">— (external / framework)</span>
                        </td>
                        <td>
                          <div v-for="r in p.required_by" :key="r.app" class="text-caption">
                            {{ shortPkg(r.app) }} <span class="opacity-70">×{{ r.components }}</span>
                            <v-chip v-if="r.accessible" size="x-small" color="error" variant="tonal" class="ml-1">{{ r.accessible }} exported</v-chip>
                          </div>
                          <span v-if="!p.required_by.length" class="text-caption opacity-60">—</span>
                        </td>
                      </tr>
                    </tbody>
                  </v-table>
                  <div v-else-if="!permLoading" class="text-center pa-6 opacity-70">
                    {{ permChainableOnly ? 'No cross-app chain candidates among scanned apps yet — scan more apps from the same vendor.' : 'No permission data. Scan some apps first.' }}
                  </div>
                </v-window-item>
              </v-window>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>
    </template>

    <!-- Snackbar -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="3000"
      location="top"
    >
      {{ snackbar.text }}
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

<script>
import { ref, computed, onMounted, watch, nextTick, onUnmounted } from 'vue';
import { useStore } from 'vuex';
import axios from 'axios';

// Tiny self-contained debounce. Avoids pulling in the full `lodash` package
// (which isn't even a direct dependency and was forcing Vite to discover a
// new pre-bundled module on first navigation to this page → full-page reload).
function debounce (fn, wait = 250) {
  let t = null;
  const debounced = (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn(...args);
    }, wait);
  };
  debounced.cancel = () => {
    if (t) clearTimeout(t);
    t = null;
  };
  return debounced;
}

// Create API instance with default config
const api = axios.create({
  baseURL: import.meta.env.VITE_APP_API_URL,
  timeout: 30000
});

// Cache for API responses
const apiCache = new Map();

// Constants
const LOG_LEVEL_OPTIONS = [
  { title: 'Debug (0)', value: '0' },
  { title: 'Info (1) - Default', value: '1' },
  { title: 'Warn (2)', value: '2' },
  { title: 'Error (3)', value: '3' },
];

const BASE_RULES_PATH = '/appshark_engine/appshark/config/rules';

// Default settings with all AppShark parameters
const DEFAULT_SETTINGS = {
  apkPath: '/appshark_engine/appshark/uploads/',
  outPath: 'out',
  rulePath: BASE_RULES_PATH,
  debugRule: '', // Optional - will be filtered out if empty
  logLevel: '1',
  javaSource: true,
  javaSourceHighlighting: false, // New: Enable syntax highlighting in Java source
  verboseRuleLogging: false, // New: Enable verbose logging for rule processing
  maxPointerAnalyzeTime: 600,
  maxThread: 2,
  sdkPath: '', // Optional - will be filtered out if empty
  toolsPath: '', // Optional - will be filtered out if empty
  callBackEnhance: false,
  supportFragment: false,
  ruleMaxAnalyzer: 5000,
  maxPathLength: 100,
  wholeProcessMode: false,
  skipAnalyzeNonRelatedMethods: false,
  skipPointerPropagationForLibraryMethod: true,
  selectivePrimeTaint: false, // engine-vr: track taint through object->String getters; off = upstream behavior
  checkPermission: false, // Check exported component permissions during analysis
  partialResultsEnabled: false // Allow partial results when results.json is missing
};

export default {
  name: 'EngineSettings',
  setup() {
    const store = useStore();
    const isDark = computed(() => store.state.isDark);

    // Global decompiler-engine preference (frontend-persisted via Vuex + localStorage).
    // Writes go through the store action so the choice sticks across reloads.
    const decompilerEngine = computed({
      get: () => store.getters.decompilerEngine,
      set: (val) => store.dispatch('setDecompilerEngine', val)
    });
    const decompilerEngineOptions = [
      { title: 'JADX (default)', value: 'jadx' },
      { title: 'Vineflower', value: 'vineflower' }
    ];
    // Vineflower-only: also decode resources so secret scanning covers them.
    const decompilerResources = computed({
      get: () => store.getters.decompilerResources,
      set: (val) => store.dispatch('setDecompilerResources', val)
    });

    // State management with refs
    const loading = ref(true);
    const saving = ref(false);
    const error = ref(null);
    const loadingRules = ref(false);
    const loadingDirectories = ref(false);
    const isScanning = ref(false);
    const scanProgress = ref(0);
    const totalApks = ref(0);
    const scannedApks = ref(0);
    const selectedRules = ref([]);
    const availableRules = ref([]);
    const availableDirectories = ref([BASE_RULES_PATH]);
    const logLevelOptions = ref(LOG_LEVEL_OPTIONS);

    const activeTab = ref('settings');

    // Chain Recon — cross-app permission map (feature toggle, frontend-persisted)
    const chainReconEnabled = ref(localStorage.getItem('chainReconEnabled') === 'true');
    watch(chainReconEnabled, (on) => {
      try { localStorage.setItem('chainReconEnabled', on ? 'true' : 'false'); } catch (e) { /* ignore */ }
      if (!on && activeTab.value === 'permissions') activeTab.value = 'settings';
    });

    const permMap = ref([]);
    const permAppCount = ref(0);
    const permLoading = ref(false);
    const permError = ref(null);
    const permChainableOnly = ref(false);
    const permLoaded = ref(false);

    const permChainableCount = computed(() => permMap.value.filter(p => p.chainable).length);
    const filteredPermMap = computed(() =>
      permChainableOnly.value ? permMap.value.filter(p => p.chainable) : permMap.value
    );

    const shortPkg = (pkg) => {
      if (!pkg) return pkg;
      const parts = pkg.split('.');
      return parts.length > 2 ? parts.slice(-2).join('.') : pkg;
    };
    const protColor = (lvl) => {
      if (!lvl) return 'grey';
      const l = String(lvl).toLowerCase();
      if (l.includes('signature') || l.includes('system') || l.includes('privileged') || l.includes('internal')) return 'success';
      if (l.includes('dangerous')) return 'warning';
      return 'grey';
    };
    const loadPermissionsMap = async (force = false) => {
      if (permLoaded.value && !force) return;
      permLoading.value = true;
      permError.value = null;
      try {
        const { data } = await api.get('/database/permissions-map');
        permMap.value = data.permissions || [];
        permAppCount.value = data.app_count || 0;
        permLoaded.value = true;
      } catch (e) {
        permError.value = e?.response?.data?.message || e.message || 'Failed to load permission map';
      } finally {
        permLoading.value = false;
      }
    };

    const engineConfig = ref({
      loading: false,
      saving: false,
      path: '/appshark_engine/appshark/config/EngineConfig.json5',
      hash: '',
      content: '',
      originalContent: '',
      parseError: '',
      error: '',
      savedMessage: '',
      dirty: false
    });

    // EngineConfig UI helpers/state
    const engineConfigUiTab = ref('overview');
    const ignoreSearch = ref('');
    const callbackSearch = ref('');
    const librarySearch = ref('');

    const ignoreHeaders = [
      { title: 'Package name', key: 'value' }
    ];

    const libraryHeaders = [
      { title: 'Enabled', key: 'enabled', width: 110 },
      { title: 'Prefix', key: 'value' }
    ];

    const engineConfigModel = ref({
      ignore: {
        packageNames: [],
        selected: []
      },
      callback: {
        classes: []
      },
      library: {
        prefixes: [],
        selected: []
      },
      callbackClassCount: 0
    });

    const rebuildEngineConfigModel = () => {
      const text = engineConfig.value.content || '';

      // IgnoreList.PackageName
      const pkgMatch = text.match(/IgnoreList\s*:\s*\{[\s\S]*?"PackageName"\s*:\s*\[([\s\S]*?)]/m);
      const pkgBody = pkgMatch ? pkgMatch[1] : '';
      const pkgs = (pkgBody.match(/"([^"]+)"/g) || []).map(s => s.slice(1, -1));

      // Callback.param (best-effort)
      const cbParamMatch = text.match(/Callback\s*:\s*\{[\s\S]*?"param"\s*:\s*\{([\s\S]*?)}\s*(?:,\s*"enhanceIgnore"\s*:|})/m);
      const cbBody = cbParamMatch ? (cbParamMatch[1] || '') : '';
      const classRegex = /"([^"]+)"\s*:\s*\[([\s\S]*?)]/g;
      const classes = [];
      let m;
      while ((m = classRegex.exec(cbBody)) !== null) {
        const className = m[1];
        const methodsBody = m[2] || '';
        const methods = (methodsBody.match(/"([^"]+)"/g) || []).map(s => s.slice(1, -1));
        classes.push({ className, methods });
      }

      // Library.Package prefixes (best-effort)
      // Supports enabled items in the array and disabled items persisted as commented lines: // "android."
      const libMatch = text.match(/Library\s*:\s*\{[\s\S]*?"Package"\s*:\s*\[([\s\S]*?)]/m);
      const libBody = libMatch ? (libMatch[1] || '') : '';
      const libLines = libBody.split(/\r?\n/);
      const libItems = [];
      for (const line of libLines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Disabled (commented) line
        const disabled = trimmed.startsWith('//');
        const lineToParse = disabled ? trimmed.replace(/^\/\//, '').trim() : trimmed;
        const sMatch = lineToParse.match(/"([^"]+)"/);
        if (!sMatch) continue;
        libItems.push({ value: sMatch[1], enabled: !disabled });
      }

      engineConfigModel.value.ignore.packageNames = pkgs;
      engineConfigModel.value.ignore.selected = [];
      engineConfigModel.value.callback.classes = classes;
      engineConfigModel.value.callbackClassCount = classes.length;
      engineConfigModel.value.library.prefixes = libItems;
      engineConfigModel.value.library.selected = [];
    };

    const filteredIgnorePackages = computed(() => {
      const q = (ignoreSearch.value || '').toLowerCase();
      return engineConfigModel.value.ignore.packageNames
        .filter(p => !q || p.toLowerCase().includes(q))
        .map(p => ({ value: p }));
    });

    const filteredCallbackClasses = computed(() => {
      const q = (callbackSearch.value || '').toLowerCase();
      return (engineConfigModel.value.callback.classes || [])
        .filter(c => !q || c.className.toLowerCase().includes(q));
    });

    const filteredLibraryPrefixes = computed(() => {
      const q = (librarySearch.value || '').toLowerCase();
      return (engineConfigModel.value.library.prefixes || [])
        .filter(p => !q || (p.value || '').toLowerCase().includes(q));
    });

    const applyIgnorePackagesToRaw = () => {
      const pkgs = engineConfigModel.value.ignore.packageNames;
      const formatted = pkgs.map(p => `      "${p}"`).join(',\n');
      const re = /(IgnoreList\s*:\s*\{[\s\S]*?"PackageName"\s*:\s*\[)([\s\S]*?)(]\s*,?)/m;
      if (re.test(engineConfig.value.content || '')) {
        engineConfig.value.content = (engineConfig.value.content || '').replace(re, `$1\n${formatted}\n    $3`);
      }
    };

    const addIgnorePackage = () => {
      const value = (prompt('Add package to IgnoreList.PackageName') || '').trim();
      if (!value) return;
      if (engineConfigModel.value.ignore.packageNames.includes(value)) return;
      engineConfigModel.value.ignore.packageNames.push(value);
      applyIgnorePackagesToRaw();
    };

    const removeSelectedIgnore = () => {
      const selected = new Set(engineConfigModel.value.ignore.selected || []);
      if (selected.size === 0) return;
      engineConfigModel.value.ignore.packageNames = engineConfigModel.value.ignore.packageNames.filter(p => !selected.has(p));
      engineConfigModel.value.ignore.selected = [];
      applyIgnorePackagesToRaw();
    };

    const applyLibraryPackagesToRaw = () => {
      const items = engineConfigModel.value.library.prefixes || [];
      const formatted = items
        .map(it => {
          const line = `      "${it.value}"`;
          return it.enabled ? line : `      // ${line}`;
        })
        .join(',\n');

      const re = /(Library\s*:\s*\{[\s\S]*?"Package"\s*:\s*\[)([\s\S]*?)(]\s*,?)/m;
      if (re.test(engineConfig.value.content || '')) {
        engineConfig.value.content = (engineConfig.value.content || '').replace(re, `$1\n${formatted}\n    $3`);
      }
    };

    const addLibraryPrefix = () => {
      const value = (prompt('Add library prefix (e.g. "android.")') || '').trim();
      if (!value) return;

      const existing = (engineConfigModel.value.library.prefixes || []).find(it => it.value === value);
      if (existing) {
        // If it exists but is disabled, just enable it.
        existing.enabled = true;
      } else {
        engineConfigModel.value.library.prefixes.push({ value, enabled: true });
      }
      applyLibraryPackagesToRaw();
    };

    const removeSelectedLibrary = () => {
      const selected = new Set(engineConfigModel.value.library.selected || []);
      if (selected.size === 0) return;
      engineConfigModel.value.library.prefixes = (engineConfigModel.value.library.prefixes || []).filter(it => !selected.has(it.value));
      engineConfigModel.value.library.selected = [];
      applyLibraryPackagesToRaw();
    };

    const toggleLibraryPrefix = (prefix, enabled) => {
      const item = (engineConfigModel.value.library.prefixes || []).find(it => it.value === prefix);
      if (!item) return;
      item.enabled = !!enabled;
      applyLibraryPackagesToRaw();
    };

    // Form state with all parameters
    const localSettings = ref({ ...DEFAULT_SETTINGS });

    // Notifications
    const snackbar = ref({
      show: false,
      text: '',
      color: 'success'
    });

    // Computed properties
    const selectedRulesString = computed(() =>
      selectedRules.value?.map(rule => rule.value).join(', ') || ''
    );

    const icon = computed(() => {
      if (!selectedRules.value || !availableRules.value) return 'mdi-checkbox-blank-outline';
      if (selectedRules.value.length === availableRules.value.length) return 'mdi-close-box';
      if (selectedRules.value.length > 0) return 'mdi-minus-box';
      return 'mdi-checkbox-blank-outline';
    });

    // API helpers
    const fetchWithCache = async (endpoint, params = null) => {
      const cacheKey = `${endpoint}${params ? JSON.stringify(params) : ''}`;

      if (apiCache.has(cacheKey)) {
        return apiCache.get(cacheKey);
      }

      try {
        const response = await api.get(endpoint, { params });
        apiCache.set(cacheKey, response.data);
        setTimeout(() => apiCache.delete(cacheKey), 300000); // 5 minute cache
        return response.data;
      } catch (error) {
        throw error;
      }
    };

    // UI helpers
    const showSnackbar = (text, color = 'success') => {
      snackbar.value = { show: true, text, color };
    };

    const updateScanProgress = (completed, total) => {
      nextTick(() => {
        scannedApks.value = completed;
        totalApks.value = total;
        scanProgress.value = (completed / total) * 100;
      });
    };

    // Helper to completely remove keys with empty/null/undefined values
    const cleanSettingsData = (data) => {
      const cleaned = {};

      Object.entries(data).forEach(([key, value]) => {
        // Only include the key-value pair if the value is meaningful
        if (value !== null &&
            value !== undefined &&
            value !== '' &&
            !(typeof value === 'string' && value.trim() === '') &&
            !Number.isNaN(value)) {

          // For boolean values, always include them (even if false)
          if (typeof value === 'boolean') {
            cleaned[key] = value;
          }
          // For numbers, make sure they're valid and finite
          else if (typeof value === 'number' && isFinite(value)) {
            cleaned[key] = value;
          }
          // For strings, make sure they have content after trimming
          else if (typeof value === 'string' && value.trim().length > 0) {
            cleaned[key] = value;
          }
        }
      });

      // Debug log to see what keys were removed
      const removedKeys = Object.keys(data).filter(key => !(key in cleaned));
      if (removedKeys.length > 0) {
        console.log('Removed empty/null keys from config:', removedKeys);
      }

      return cleaned;
    };

    // Actions
    const toggleAllRules = () => {
      selectedRules.value = selectedRules.value.length === availableRules.value.length
        ? []
        : [...availableRules.value];
    };

    const resetToDefaults = () => {
      localSettings.value = { ...DEFAULT_SETTINGS };
      selectedRules.value = [];
      showSnackbar('Settings reset to defaults (save to apply changes)', 'info');
    };

    // Method to clear specific optional fields
    const clearOptionalField = (fieldName) => {
      localSettings.value[fieldName] = '';
      showSnackbar(`${fieldName} cleared (save to apply changes)`, 'info');
    };

    const debouncedSaveSettings = debounce(async () => {
      if (saving.value) return;

      saving.value = true;
      try {
        // Create settings data with all possible fields
        const settingsData = {
          apkPath: localSettings.value.apkPath,
          out: localSettings.value.outPath,
          rulePath: localSettings.value.rulePath,
          rules: selectedRulesString.value,
          debugRule: localSettings.value.debugRule,
          logLevel: parseInt(localSettings.value.logLevel ?? 1),
          javaSource: localSettings.value.javaSource !== undefined ? localSettings.value.javaSource : true,
          javaSourceHighlighting: localSettings.value.javaSourceHighlighting !== undefined ? localSettings.value.javaSourceHighlighting : false,
          verboseRuleLogging: localSettings.value.verboseRuleLogging !== undefined ? localSettings.value.verboseRuleLogging : false,
          maxPointerAnalyzeTime: parseInt(localSettings.value.maxPointerAnalyzeTime ?? 600),
          maxThread: parseInt(localSettings.value.maxThread ?? 2),
          sdkPath: localSettings.value.sdkPath,
          toolsPath: localSettings.value.toolsPath,
          callBackEnhance: localSettings.value.callBackEnhance !== undefined ? localSettings.value.callBackEnhance : false,
          supportFragment: localSettings.value.supportFragment !== undefined ? localSettings.value.supportFragment : false,
          ruleMaxAnalyzer: parseInt(localSettings.value.ruleMaxAnalyzer ?? 5000),
          maxPathLength: parseInt(localSettings.value.maxPathLength ?? 100),
          wholeProcessMode: localSettings.value.wholeProcessMode !== undefined ? localSettings.value.wholeProcessMode : false,
          skipAnalyzeNonRelatedMethods: localSettings.value.skipAnalyzeNonRelatedMethods !== undefined ? localSettings.value.skipAnalyzeNonRelatedMethods : false,
          skipPointerPropagationForLibraryMethod: localSettings.value.skipPointerPropagationForLibraryMethod !== undefined ? localSettings.value.skipPointerPropagationForLibraryMethod : true,
          selectivePrimeTaint: localSettings.value.selectivePrimeTaint !== undefined ? localSettings.value.selectivePrimeTaint : false,
          checkPermission: localSettings.value.checkPermission !== undefined ? localSettings.value.checkPermission : false,
          partialResultsEnabled: localSettings.value.partialResultsEnabled === true
        };

        // Remove keys with empty/null/undefined values completely
        const cleanedSettings = cleanSettingsData(settingsData);

        console.log('Sending cleaned settings (empty keys removed):', cleanedSettings);
        await api.post('/engine/settings', cleanedSettings);
        showSnackbar('Settings saved successfully');
      } catch (error) {
        console.error('Settings save error:', error);
        showSnackbar('Failed to save settings', 'error');
      } finally {
        saving.value = false;
      }
    }, 500);

    const runAnalysis = async () => {
      if (isScanning.value) return;

      isScanning.value = true;
      scanProgress.value = 0;
      scannedApks.value = 0;

      try {
        // Create analysis data with all possible fields
        const analysisData = {
          apkPath: localSettings.value.apkPath,
          out: localSettings.value.outPath,
          rulePath: localSettings.value.rulePath,
          rules: selectedRulesString.value,
          uploadedOnly: true,
          debugRule: localSettings.value.debugRule,
          logLevel: parseInt(localSettings.value.logLevel ?? 1),
          javaSource: localSettings.value.javaSource !== undefined ? localSettings.value.javaSource : true,
          javaSourceHighlighting: localSettings.value.javaSourceHighlighting !== undefined ? localSettings.value.javaSourceHighlighting : false,
          verboseRuleLogging: localSettings.value.verboseRuleLogging !== undefined ? localSettings.value.verboseRuleLogging : false,
          maxPointerAnalyzeTime: parseInt(localSettings.value.maxPointerAnalyzeTime ?? 600),
          maxThread: parseInt(localSettings.value.maxThread ?? 2),
          sdkPath: localSettings.value.sdkPath,
          toolsPath: localSettings.value.toolsPath,
          callBackEnhance: localSettings.value.callBackEnhance !== undefined ? localSettings.value.callBackEnhance : false,
          supportFragment: localSettings.value.supportFragment !== undefined ? localSettings.value.supportFragment : false,
          ruleMaxAnalyzer: parseInt(localSettings.value.ruleMaxAnalyzer ?? 5000),
          maxPathLength: parseInt(localSettings.value.maxPathLength ?? 100),
          wholeProcessMode: localSettings.value.wholeProcessMode !== undefined ? localSettings.value.wholeProcessMode : false,
          skipAnalyzeNonRelatedMethods: localSettings.value.skipAnalyzeNonRelatedMethods !== undefined ? localSettings.value.skipAnalyzeNonRelatedMethods : false,
          skipPointerPropagationForLibraryMethod: localSettings.value.skipPointerPropagationForLibraryMethod !== undefined ? localSettings.value.skipPointerPropagationForLibraryMethod : true,
          selectivePrimeTaint: localSettings.value.selectivePrimeTaint !== undefined ? localSettings.value.selectivePrimeTaint : false,
          checkPermission: localSettings.value.checkPermission !== undefined ? localSettings.value.checkPermission : false
        };

        // Remove keys with empty/null/undefined values completely
        const cleanedAnalysisData = cleanSettingsData(analysisData);

        console.log('Sending cleaned analysis data (empty keys removed):', cleanedAnalysisData);
        const { data } = await api.post('/engine/run', cleanedAnalysisData);

        const scans = Array.isArray(data.scans)
          ? data.scans
          : (Array.isArray(data.results) ? data.results : []);

        if (scans.length) {
          totalApks.value = scans.length;

          for (let i = 0; i < scans.length; i++) {
            await nextTick();
            updateScanProgress(i + 1, totalApks.value);
            await new Promise(resolve => setTimeout(resolve, 100)); // Prevent UI freeze
          }

          const started = Number(data.started || 0);
          const queued = Number(data.queued || 0);
          const alreadyRunning = Number(data.already_running || 0);
          showSnackbar(`Bulk scan queued. Started: ${started}, Queued: ${queued}, Already running: ${alreadyRunning}`);
        } else if (data?.message) {
          showSnackbar(data.message, 'info');
        } else {
          showSnackbar('No APKs were queued for scanning', 'info');
        }
      } catch (error) {
        console.error('Analysis error:', error);
        const backendMessage = error?.response?.data?.error || error?.response?.data?.message;
        showSnackbar(backendMessage || 'Analysis failed', 'error');
      } finally {
        isScanning.value = false;
      }
    };

    // Directory and Rules fetching
    const fetchDirectories = async () => {
      loadingDirectories.value = true;
      try {
        const response = await api.get('/engine/directories');
        if (Array.isArray(response.data.directories)) {
          // Include the base path and all subdirectories as separate options
          const directoryOptions = [
            BASE_RULES_PATH, // Base path
            ...response.data.directories.map(dir => `${BASE_RULES_PATH}/${dir}`) // Subdirectories
          ];

          // Remove duplicates if any
          availableDirectories.value = [...new Set(directoryOptions)];
        }
      } catch (error) {
        console.error('Directory fetch error:', error);
        showSnackbar('Failed to fetch rule directories', 'error');
      } finally {
        loadingDirectories.value = false;
      }
    };

    const fetchRules = async () => {
      if (!localSettings.value.rulePath) return;

      loadingRules.value = true;
      selectedRules.value = []; // Clear selected rules when directory changes
      availableRules.value = []; // Clear available rules to show loading state

      try {
        const data = await fetchWithCache('/engine/rules', {
          rulePath: localSettings.value.rulePath
        });

        if (Array.isArray(data.rules)) {
          availableRules.value = data.rules
            .filter(rule => rule.endsWith('.json'))
            .map(rule => ({
              text: rule, // Display name
              value: rule  // Value used when saving
            }));
        }
      } catch (error) {
        console.error('Rules fetch error:', error);
        showSnackbar('Failed to fetch rules', 'error');
      } finally {
        loadingRules.value = false;
      }
    };

    const loadEngineConfig = async () => {
      engineConfig.value.loading = true;
      engineConfig.value.error = '';
      engineConfig.value.savedMessage = '';

      try {
        const data = await fetchWithCache('/engine/engine-config');
        engineConfig.value.path = data.path || engineConfig.value.path;
        engineConfig.value.hash = data.hash || '';
        engineConfig.value.content = data.content || '';
        engineConfig.value.originalContent = data.content || '';
        engineConfig.value.parseError = data.parseError || '';
        engineConfig.value.dirty = false;

        rebuildEngineConfigModel();
      } catch (e) {
        console.error('Engine config load error:', e);
        engineConfig.value.error = 'Failed to load EngineConfig.json5';
      } finally {
        engineConfig.value.loading = false;
      }
    };

    const resetEngineConfig = () => {
      engineConfig.value.content = engineConfig.value.originalContent;
      engineConfig.value.error = '';
      engineConfig.value.savedMessage = '';
      engineConfig.value.dirty = false;
    };

    const saveEngineConfig = async () => {
      if (engineConfig.value.saving) return;
      engineConfig.value.saving = true;
      engineConfig.value.error = '';
      engineConfig.value.savedMessage = '';

      try {
        const resp = await api.put('/engine/engine-config', {
          content: engineConfig.value.content,
          hash: engineConfig.value.hash
        });

        if (resp?.data?.success) {
          engineConfig.value.hash = resp.data.hash || engineConfig.value.hash;
          engineConfig.value.originalContent = engineConfig.value.content;
          engineConfig.value.dirty = false;
          engineConfig.value.savedMessage = resp.data.message || 'Saved successfully';
          showSnackbar('EngineConfig.json5 saved successfully', 'success');
          // Clear cached GET so reload is fresh
          apiCache.delete('/engine/engine-config');
        } else {
          engineConfig.value.error = resp?.data?.message || 'Failed to save EngineConfig.json5';
        }
      } catch (e) {
        const status = e?.response?.status;
        const message = e?.response?.data?.message || e?.message || 'Failed to save EngineConfig.json5';
        if (status === 409) {
          engineConfig.value.error = `${message} (Conflict: reload and try again)`;
        } else {
          engineConfig.value.error = message;
        }
        showSnackbar('Failed to save EngineConfig.json5', 'error');
      } finally {
        engineConfig.value.saving = false;
      }
    };

    // Initialize component
    const initializeComponent = async () => {
      loading.value = true;
      error.value = null;

      try {
        // Fetch directories first
        await fetchDirectories();

        // Then fetch settings and rules in parallel
        const settingsResult = await fetchWithCache('/engine/settings');

        // Update local settings from API response
        if (settingsResult) {
          // Preserve current path if not found in the response
          const rulePath = settingsResult.rulePath || localSettings.value.rulePath;

          // Map backend field names to frontend field names
          const mappedSettings = { ...settingsResult };
          if (settingsResult.out !== undefined) {
            mappedSettings.outPath = settingsResult.out;
            delete mappedSettings.out; // Remove the backend field name
          }

          // Update the local settings object, preserving defaults for missing values
          localSettings.value = {
            ...DEFAULT_SETTINGS,
            ...mappedSettings,
            rulePath: rulePath // Ensure rulePath is set correctly
          };

          // Fetch rules based on the selected path
          await fetchRules();

          // Set selected rules if they exist in settings
          if (settingsResult.rules) {
            const savedRulesArray = settingsResult.rules
              .split(',')
              .map(rule => rule.trim());

            selectedRules.value = availableRules.value
              .filter(rule => savedRulesArray.includes(rule.value));
          }
        }
      } catch (err) {
        console.error('Initialization error:', err);
        error.value = err.response?.data?.message || 'Failed to initialize settings. Please try again.';
        showSnackbar('Initialization failed', 'error');
      } finally {
        loading.value = false;
      }
    };

    watch(
      () => engineConfig.value.content,
      () => {
        engineConfig.value.dirty = engineConfig.value.content !== engineConfig.value.originalContent;
        // Keep the UI view reasonably fresh when editing raw.
        rebuildEngineConfigModel();
      }
    );

    // Watch for changes to rule path and update rules accordingly
    watch(() => localSettings.value.rulePath, (newPath) => {
      if (newPath) {
        fetchRules();
      }
    });

    // Lifecycle hooks
    onMounted(() => {
      initializeComponent();
    });

    onUnmounted(() => {
      apiCache.clear();
      debouncedSaveSettings.cancel();
    });

    // Return all necessary refs, computed properties, and methods
    return {
      // State
      loading,
      saving,
      error,
      loadingRules,
      loadingDirectories,
      isScanning,
      scanProgress,
      totalApks,
      scannedApks,
      selectedRules,
      availableRules,
      availableDirectories,
      logLevelOptions,
      localSettings,
      snackbar,
      isDark,
      decompilerEngine,
      decompilerEngineOptions,
      decompilerResources,
      activeTab,
      engineConfig,

      // Chain Recon — cross-app permission map
      chainReconEnabled,
      permMap,
      permAppCount,
      permLoading,
      permError,
      permChainableOnly,
      permChainableCount,
      filteredPermMap,
      loadPermissionsMap,
      shortPkg,
      protColor,

      // Computed
      selectedRulesString,
      icon,
      engineConfigUiTab,
      ignoreSearch,
      callbackSearch,
      librarySearch,
      ignoreHeaders,
      libraryHeaders,
      engineConfigModel,
      filteredIgnorePackages,
      filteredCallbackClasses,
      filteredLibraryPrefixes,

      // Methods
      toggleAllRules,
      resetToDefaults,
      clearOptionalField,
      debouncedSaveSettings,
      runAnalysis,
      initializeComponent,
      showSnackbar,
      fetchDirectories,
      fetchRules,
      cleanSettingsData,
      loadEngineConfig,
      saveEngineConfig,
      resetEngineConfig,
      addIgnorePackage,
      removeSelectedIgnore,
      addLibraryPrefix,
      removeSelectedLibrary,
      toggleLibraryPrefix
    };
  }
};
</script>

<style scoped>
.theme--dark {
  background-color: #1E1E1E;
  color: #FFFFFF;
}

.theme--light {
  background-color: #FFFFFF;
  color: #000000;
}

.v-container {
  min-height: 100vh;
  padding-top: 1rem;
  padding-bottom: 1rem;
}

.v-card {
  transition: all 0.3s ease;
}

.v-form {
  margin-top: 1rem;
}

/* Feature toggles grid */
.v-switch {
  margin-bottom: 0.5rem;
}

/* Optimize transitions */
.v-enter-active,
.v-leave-active {
  transition: opacity 0.15s ease;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}

/* Optimize memory usage for fixed elements */
.v-progress-circular {
  will-change: transform;
}

/* Optimize paint operations */
.v-btn {
  transform: translateZ(0);
}

/* Improved spacing for hint text */
.v-text-field .v-messages,
.v-select .v-messages,
.v-switch .v-messages {
  min-height: 14px;
}

/* Better visual separation */
.v-card-subtitle {
  border-bottom: 1px solid rgba(0,0,0,0.12);
  padding-bottom: 8px;
  margin-bottom: 16px;
}

.theme--dark .v-card-subtitle {
  border-bottom-color: rgba(255,255,255,0.12);
}

.engine-settings-tabs {
  border-right: 1px solid rgba(0,0,0,0.12);
}

.theme--dark .engine-settings-tabs {
  border-right-color: rgba(255,255,255,0.12);
}

.engine-config-textarea :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  line-height: 1.45;
}

.engine-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.perm-table :deep(td),
.perm-table :deep(th) {
  vertical-align: top;
}
.perm-name {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  word-break: break-all;
}
.perm-table :deep(tr.chain-row) {
  background: rgba(255, 167, 38, 0.10);
}
</style>
