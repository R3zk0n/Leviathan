<template>
  <div :class="isDark ? 'theme--dark' : 'theme--light'">
    <!-- Android Applications Table -->
    <v-card class="mb-5" :class="isDark ? 'theme--dark' : 'theme--light'">
      <v-data-table
        v-model:expanded="expandedAndroid"
        :headers="androidHeaders"
        :items="sortedAndroidItems"
        :search="searchQuery"
        item-value="application"
        show-expand
        :class="isDark ? 'theme--dark' : 'theme--light'"
      >
        <template v-slot:top>
          <v-toolbar flat :class="isDark ? 'theme--dark' : 'theme--light'" class="upload-toolbar">
            <v-toolbar-title>Android Apps</v-toolbar-title>
            <v-divider class="mx-4" inset vertical></v-divider>
            <v-spacer></v-spacer>

            <!-- Upload and search section for Android -->
            <div class="upload-section">
              <v-file-input
                v-model="selectedAndroidFile"
                accept=".apk"
                label="Select APK"
                prepend-icon="mdi-android"
                variant="outlined"
                density="compact"
                hide-details
                class="file-input"
                :class="isDark ? 'file-input--dark' : ''"
              />
              <v-btn
                @click="uploadAndroidFile"
                :disabled="!selectedAndroidFile"
                :loading="androidUploading"
                color="blue"
                variant="elevated"
                class="upload-btn"
              >
                <v-icon left>mdi-upload</v-icon>
              </v-btn>
              <v-text-field
                v-model="searchQuery"
                prepend-inner-icon="mdi-magnify"
                label="Search..."
                single-line
                hide-details
                clearable
                density="compact"
                variant="outlined"
                class="search-field"
                :class="isDark ? 'file-input--dark' : ''"
              ></v-text-field>
            </div>
          </v-toolbar>
        </template>

        <template v-slot:item.icon="{ item }">
          <v-icon v-if="item.application.endsWith('.apk')">mdi-android</v-icon>
        </template>

        <!-- Clickable User column header for sorting -->
        <template v-slot:header.system_app="{ column }">
          <div
            class="d-flex align-center justify-center clickable-header"
            @click="toggleUserSort"
            style="cursor: pointer; user-select: none;"
          >
            <span>{{ column.title }}</span>
            <v-icon small class="ml-1" v-if="userSortOrder === 'system'">mdi-arrow-up</v-icon>
            <v-icon small class="ml-1" v-else-if="userSortOrder === 'normal'">mdi-arrow-down</v-icon>
            <v-icon small class="ml-1" v-else style="opacity: 0.3;">mdi-swap-vertical</v-icon>
          </div>
        </template>

        <!-- Clickable Scan Status column header for sorting by vulnerability count -->
        <template v-slot:header.scan_status="{ column }">
          <div
            class="d-flex align-center justify-center clickable-header"
            @click="toggleVulnSort"
            style="cursor: pointer; user-select: none;"
          >
            <span>{{ column.title }}</span>
            <v-icon small class="ml-1" v-if="!vulnSortAsc">mdi-arrow-down</v-icon>
            <v-icon small class="ml-1" v-else>mdi-arrow-up</v-icon>
          </div>
        </template>

        <!-- User/UID classification column -->
        <template v-slot:item.system_app="{ item }">
          <v-tooltip bottom>
            <template v-slot:activator="{ on, attrs }">
              <v-chip
                :color="getAndroidUserClass(item.application).color"
                small
                label
                v-bind="attrs"
                v-on="on"
              >
                <v-icon left small>{{ getAndroidUserClass(item.application).icon }}</v-icon>
                {{ getAndroidUserClass(item.application).label }}
              </v-chip>
            </template>
            <span>{{ getAndroidUserClass(item.application).tooltip }}</span>
          </v-tooltip>
        </template>

        <!-- Updated scan_status template to use store getters -->
        <template v-slot:item.scan_status="{ item }">
          <div class="scan-status-container">
            <v-tooltip bottom>
              <template v-slot:activator="{ on, attrs }">
                <div v-bind="attrs" v-on="on" class="d-flex align-center">
                  <!-- Always check active scan state first -->
                  <template v-if="isScanning(item.application)">
                    <!-- Indeterminate spinner when progress is 0 (waiting/pending), otherwise show progress -->
                    <v-progress-circular
                      :indeterminate="getScanProgress(item.application) === 0"
                      :value="getScanProgress(item.application)"
                      :size="24"
                      :width="3"
                      color="info"
                      class="mr-2"
                    >
                      <template v-if="getScanProgress(item.application) > 0">
                        {{ Math.round(getScanProgress(item.application)) }}
                      </template>
                    </v-progress-circular>
                  </template>

                  <!-- Only show completed status if NOT actively scanning -->
                  <template v-else>
                    <v-icon
                      :color="getScanStatusColor(item)"
                      class="mr-2"
                    >
                      {{ getScanStatusIcon(item) }}
                    </v-icon>

                    <!-- Vulnerability count badge -->
                    <v-chip
                      v-if="item.scanData && item.scanData.status === 'completed'"
                      :color="getVulnerabilityColor(item)"
                      small
                      class="ml-1"
                    >
                      {{ getVulnerabilityCount(item) }}
                    </v-chip>
                  </template>
                </div>
              </template>
              <span>{{ getScanTooltip(item) }}</span>
            </v-tooltip>
          </div>
        </template>

        <!-- Updated scan button to check store state and show stop button when scanning -->
        <template v-slot:item.scan="{ item }">
          <div v-if="item" class="d-flex align-center gap-1">
            <!-- Start Scan Button -->
            <v-btn
              v-if="!isScanning(item.application)"
              @click.stop.prevent="ScanApp(item.application)"
              icon
              :class="isDark ? 'btn-dark' : ''"
            >
              <v-icon>mdi-magnify</v-icon>
            </v-btn>

            <!-- Stop Scan Button (shown when scanning) -->
            <v-btn
              v-else
              @click.stop.prevent="stopScanApp(item.application)"
              icon
              color="error"
              :class="isDark ? 'btn-dark' : ''"
            >
              <v-icon>mdi-stop-circle</v-icon>
            </v-btn>
          </div>
        </template>

        <!-- Rest of the templates remain the same -->
        <template v-slot:item.activities="{ item }">
          <v-menu offset-y>
            <template v-slot:activator="{ on, props }">
              <v-btn
                icon
                v-bind="props"
                v-on="on"
                :class="isDark ? 'btn-dark' : ''"
                :loading="item.isLoadingActivities"
                :disabled="item.isLoadingActivities"
              >
                <v-icon>mdi-view-list</v-icon>
              </v-btn>
            </template>
            <v-list max-width="200">
              <v-list-item @click="viewActivities(item.application, 'exported')">
                <v-list-item-title>Exported Activities</v-list-item-title>
              </v-list-item>
              <v-list-item @click="viewActivities(item.application, 'non_exported')">
                <v-list-item-title>Non Exported Activities</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </template>

        <template v-slot:item.scan_app="{ item }">
          <div class="d-flex align-center">
            <v-tooltip
              :text="item.isDecompiled
                ? `Decompiled with ${item.lastEngine || 'jadx'}`
                : `Decompile with ${decompilerEngine}`"
              location="top"
            >
              <template v-slot:activator="{ props }">
                <v-btn
                  v-bind="props"
                  @click="decompileItem(item)"
                  :loading="item.isDecompiling"
                  :disabled="item.isDecompiling || item.isDecompiled"
                  :class="isDark ? 'btn-dark' : ''"
                >
                  <v-icon v-if="!item.isDecompiling" :color="item.isDecompiled ? 'success' : undefined">
                    {{ item.isDecompiled ? 'mdi-check-circle-outline' : 'mdi-application-brackets-outline' }}
                  </v-icon>
                  <template v-slot:loader>
                    <v-progress-circular indeterminate></v-progress-circular>
                  </template>
                </v-btn>
              </template>
            </v-tooltip>

            <!-- Per-app override: re-run with an explicit engine (force=true) -->
            <v-menu offset-y>
              <template v-slot:activator="{ props }">
                <v-btn
                  icon
                  size="small"
                  variant="text"
                  v-bind="props"
                  :disabled="item.isDecompiling"
                  :class="isDark ? 'btn-dark' : ''"
                >
                  <v-icon size="small">mdi-menu-down</v-icon>
                </v-btn>
              </template>
              <v-list density="compact" min-width="220">
                <v-list-subtitle v-if="item.lastEngine" class="px-4 pt-2">
                  Last decompiled with: {{ item.lastEngine }}
                </v-list-subtitle>
                <v-list-item @click="decompileItem(item, { engine: 'jadx', force: true })">
                  <v-list-item-title>Re-decompile with JADX</v-list-item-title>
                </v-list-item>
                <v-list-item @click="decompileItem(item, { engine: 'vineflower', force: true, resources: decompilerResources })">
                  <v-list-item-title>Re-decompile with Vineflower</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </div>
        </template>

        <template v-slot:item.results="{ item }">
          <v-btn icon @click="viewResults(item.application)" :class="isDark ? 'btn-dark' : ''">
            <v-icon>mdi-database-search</v-icon>
          </v-btn>
        </template>

        <template v-slot:item.services="{ item }">
          <v-menu offset-y>
            <template v-slot:activator="{ on, props }">
              <v-btn
                icon
                v-bind="props"
                v-on="on"
                :class="isDark ? 'btn-dark' : ''"
                :loading="item.isLoadingServices"
                :disabled="item.isLoadingServices"
              >
                <v-icon>mdi-view-carousel</v-icon>
              </v-btn>
            </template>
            <v-list max-width="200">
              <v-list-item @click="viewServices(item.application, 'exported')">
                <v-list-item-title>Exported Services</v-list-item-title>
              </v-list-item>
              <v-list-item @click="viewServices(item.application, 'non_exported')">
                <v-list-item-title>Non Exported Services</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </template>

        <template v-slot:item.providers="{ item }">
          <v-btn
            icon
            @click="viewProviders(item.application)"
            :class="isDark ? 'btn-dark' : ''"
            :loading="item.isLoadingProviders"
            :disabled="item.isLoadingProviders"
          >
            <v-icon>mdi-database</v-icon>
          </v-btn>
        </template>

        <template v-slot:item.receivers="{ item }">
          <v-menu offset-y>
            <template v-slot:activator="{ on, props }">
              <v-btn
                icon
                v-bind="props"
                v-on="on"
                :class="isDark ? 'btn-dark' : ''"
                :loading="item.isLoadingReceivers"
                :disabled="item.isLoadingReceivers"
              >
                <v-icon>mdi-bell-ring</v-icon>
              </v-btn>
            </template>
            <v-list max-width="200">
              <v-list-item @click="viewReceivers(item.application, 'exported')">
                <v-list-item-title>Exported Receivers</v-list-item-title>
              </v-list-item>
              <v-list-item @click="viewReceivers(item.application, 'non_exported')">
                <v-list-item-title>Non Exported Receivers</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </template>

        <template v-slot:item.manifest="{ item }">
          <v-btn icon @click="viewManifest(item.application)" :class="isDark ? 'btn-dark' : ''">
            <v-icon>mdi-xml</v-icon>
          </v-btn>
        </template>

        <template v-slot:item.permissions="{ item }">
          <v-btn icon @click="viewPermissions(item.application)" :class="isDark ? 'btn-dark' : ''">
            <v-icon>mdi-key-plus</v-icon>
          </v-btn>
        </template>

        <template v-slot:item.recon="{ item }">
          <v-btn icon @click="openReconDialog(item)" :class="isDark ? 'btn-dark' : ''">
            <v-icon>mdi-file-search</v-icon>
          </v-btn>
        </template>

        <template v-slot:item.delete="{ item }">
          <v-btn color="red" @click="deleteItem(item)"><v-icon>mdi-delete</v-icon></v-btn>
        </template>

        <template v-slot:expanded-row="{ columns, item }">
          <tr>
            <td :colspan="columns.length" class="expanded-row">
              <div v-if="expandedItemData[item.application]" class="expanded-content">
                <div class="expanded-row-content">
                  <div class="expanded-field"><strong>App Version:</strong> {{ expandedItemData[item.application].appVersion }}</div>
                  <div class="expanded-field"><strong>Package Name:</strong> {{ expandedItemData[item.application].packageName }}</div>
                  <div class="expanded-field"><strong>SDK Version:</strong> {{ expandedItemData[item.application].sdkVersion }}</div>
                  <div class="expanded-field"><strong>Debuggable:</strong> {{ expandedItemData[item.application].debuggable }}</div>
                  <div class="expanded-field"><strong>Main Activity:</strong> {{ expandedItemData[item.application].MainActivity }}</div>
                  <div class="expanded-field">
                    <strong>User:</strong>
                    <span :class="getAndroidUserClass(item.application).tier > 0 ? 'system-uid-highlight' : ''">
                      <v-icon v-if="getAndroidUserClass(item.application).tier > 0"
                              small :color="getAndroidUserClass(item.application).color" class="mr-1">
                        {{ getAndroidUserClass(item.application).icon }}
                      </v-icon>
                      {{ expandedItemData[item.application].AndroidUser || 'None' }}
                    </span>
                  </div>
                </div>
              </div>
              <div v-else>Loading...</div>
            </td>
          </tr>
        </template>
      </v-data-table>
    </v-card>

    <!-- iOS Applications Table remains the same -->
    <v-card :class="isDark ? 'theme--dark' : 'theme--light'">
      <v-data-table
        v-model:expanded="expandedIos"
        :headers="iosHeaders"
        :items="sortedIosItems"
        :search="searchQuery"
        item-value="application"
        show-expand
        :class="isDark ? 'theme--dark' : 'theme--light'"
      >
        <template v-slot:top>
          <v-toolbar flat :class="isDark ? 'theme--dark' : 'theme--light'" class="upload-toolbar">
            <v-toolbar-title>iOS Apps</v-toolbar-title>
            <v-divider class="mx-4" inset vertical></v-divider>
            <v-spacer></v-spacer>

            <!-- Upload and search section for iOS -->
            <div class="upload-section">
              <v-file-input
                v-model="selectedIosFile"
                accept=".ipa"
                label="Select IPA"
                prepend-icon="mdi-apple"
                variant="outlined"
                density="compact"
                hide-details
                class="file-input"
                :class="isDark ? 'file-input--dark' : ''"
              />
              <v-btn
                @click="uploadIosFile"
                :disabled="!selectedIosFile"
                :loading="iosUploading"
                color="blue"
                variant="elevated"
                class="upload-btn"
              >
                <v-icon left>mdi-upload</v-icon>
              </v-btn>
              <v-text-field
                v-model="searchQuery"
                prepend-inner-icon="mdi-magnify"
                label="Search..."
                single-line
                hide-details
                clearable
                density="compact"
                variant="outlined"
                class="search-field"
                :class="isDark ? 'file-input--dark' : ''"
              ></v-text-field>
            </div>
          </v-toolbar>
        </template>

        <template v-slot:item.icon="{ item }">
          <v-icon v-if="item.application.endsWith('.ipa')">mdi-apple</v-icon>
        </template>

        <template v-slot:item.plist="{ item }">
          <v-btn icon @click="viewPlist(item.application)" :class="isDark ? 'btn-dark' : ''">
            <v-icon>mdi-file-document</v-icon>
          </v-btn>
        </template>

        <template v-slot:item.permissions="{ item }">
          <v-btn icon @click="viewPermissions(item.application, 'ios')" :class="isDark ? 'btn-dark' : ''">
            <v-icon>mdi-key-plus</v-icon>
          </v-btn>
        </template>

        <template v-slot:item.entitlements="{ item }">
          <v-btn icon @click="viewEntitlements(item.application)" :class="isDark ? 'btn-dark' : ''">
            <v-icon>mdi-certificate-outline</v-icon>
          </v-btn>
        </template>

        <template v-slot:item.binary="{ item }">
          <v-menu offset-y>
            <template v-slot:activator="{ on, props }">
              <v-btn
                icon
                v-bind="props"
                v-on="on"
                :class="isDark ? 'btn-dark' : ''"
              >
                <v-icon>mdi-package-variant-closed</v-icon>
              </v-btn>
            </template>
            <v-list max-width="200">
              <v-list-item @click="viewInfo(item.application)" :disabled="item.isLoadingInfo">
                <v-list-item-title>
                  <v-progress-circular
                    v-if="item.isLoadingInfo"
                    indeterminate
                    size="16"
                    class="mr-2"
                  ></v-progress-circular>
                  Information
                </v-list-item-title>
              </v-list-item>
              <v-list-item @click="viewBinary(item.application, 'exports')" :disabled="item.isLoadingExports">
                <v-list-item-title>Exports</v-list-item-title>
              </v-list-item>
              <v-list-item @click="viewBinary(item.application, 'imports')" :disabled="item.isLoadingImports">
                <v-list-item-title>Imports</v-list-item-title>
              </v-list-item>
              <v-list-item @click="viewSymbols(item.application)" :disabled="item.isLoadingSymbols">
                <v-list-item-title>Symbols</v-list-item-title>
              </v-list-item>
              <v-list-item @click="viewFunctions(item.application)" :disabled="item.isLoadingFunctions">
                <v-list-item-title>Functions</v-list-item-title>
              </v-list-item>
              <v-list-item @click="viewDecompiledClasses(item.application)" :disabled="item.isLoadingClasses">
                <v-list-item-title>Classes</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </template>

        <template v-slot:item.delete="{ item }">
          <v-btn color="red" @click="deleteItem(item)"><v-icon>mdi-delete</v-icon></v-btn>
        </template>

        <template v-slot:expanded-row="{ columns, item }">
          <tr>
            <td :colspan="columns.length" class="expanded-row">
              <div v-if="expandedItemData[item.application]" class="expanded-content">
                <div class="expanded-row-content">
                  <div class="expanded-field"><strong>Supported Platforms:</strong> {{ expandedItemData[item.application].CFBundleSupportedPlatforms.join(', ') }}</div>
                  <div class="expanded-field"><strong>Bundle Identifier:</strong> {{ expandedItemData[item.application].CFBundleIdentifier }}</div>
                  <div class="expanded-field"><strong>Bundle Name:</strong> {{ expandedItemData[item.application].CFBundleName }}</div>
                  <div class="expanded-field"><strong>Minimum OS Version:</strong> {{ expandedItemData[item.application].MinimumOSVersion }}</div>
                </div>
              </div>
              <div v-else>Loading...</div>
            </td>
          </tr>
        </template>
      </v-data-table>
    </v-card>

    <!-- Scan Progress removed as it's now integrated into the table -->

    <!-- All dialogs remain the same -->
    <v-dialog v-model="decompileLoading" persistent max-width="300">
      <v-card :class="isDark ? 'theme--dark' : 'theme--light'">
        <v-card-text>
          <v-container>
            <v-row justify="center">
              <v-col class="text-center">
                <v-progress-circular
                  indeterminate
                  color="primary"
                ></v-progress-circular>
                <div>Decompiling application...</div>
              </v-col>
            </v-row>
          </v-container>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- Rest of the dialogs remain the same -->
    <providers-dialog
      :dialog="providersDialog"
      :tab="providersTab"
      :providersList="providersList"
      :filename="currentFilename"
      :open-code-viewer="openCodeViewer"
      @update:dialog="providersDialog = $event"
      @update:tab="providersTab = $event"
    />

    <receivers-dialog
      :dialog="receiversDialog"
      :tab="receiversTab"
      :filename="currentFilename"
      :open-code-viewer="openCodeViewer"
      :receiversList="receiversList"
      @update:dialog="receiversDialog = $event"
      @update:tab="receiversTab = $event"
    />

    <classes-section
      :dialog="classesDialog"
      :objc-content="objcClasses"
      :swift-content="swiftClasses"
      @update:dialog="classesDialog = $event"
    />

    <info-section
      :dialog="infoDialog"
      :content="infoContent"
      :segments="segmentsContent"
      :load-commands="loadCommandsContent"
      :sections="sectionsContent"
      :tab="infoTab"
      :file="currentFile"
      :file-info="fileInfo"
      :encryption-info="encryptionInfo"
      :deep-links="deepLinks"
      :loading="loadingStates.info"
      @update:dialog="infoDialog = $event"
      @update:tab="infoTab = $event"
      @dump-strings="dumpStrings"
    />

    <functions-dialog
      :dialog="functionsDialog"
      :functions="functionsList"
      :filename="currentFilename"
      @update:dialog="functionsDialog = $event"
    />

    <v-dialog v-model="exportsDialog" max-width="800px">
      <v-card :class="isDark ? 'theme--dark' : 'theme--light'">
        <v-card-title class="headline">Exports</v-card-title>
        <v-card-text>
          <div v-highlight>
            <pre class="language-json"><code>{{ jsonData }}</code></pre>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" @click="exportsDialog = false" :class="isDark ? 'btn-dark' : ''">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="importsDialog" max-width="800px">
      <v-card :class="isDark ? 'theme--dark' : 'theme--light'">
        <v-card-title class="headline">Imports</v-card-title>
        <v-card-text>
          <div v-highlight>
            <pre class="language-json"><code>{{ jsonDataImports }}</code></pre>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" @click="importsDialog = false" :class="isDark ? 'btn-dark' : ''">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="stringsDialog" max-width="1000px" persistent>
      <v-card :class="isDark ? 'theme--dark' : 'theme--light'">
        <v-card-title class="headline d-flex align-center">
          <v-icon class="mr-2">mdi-text-search</v-icon>
          Dumped Strings
          <v-spacer></v-spacer>
          <v-btn icon variant="text" @click="stringsDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>

        <v-card-text>
          <div v-if="stringsContent.length">
            <!-- Search field -->
            <v-text-field
              v-model="stringSearchQuery"
              label="Search strings..."
              prepend-inner-icon="mdi-magnify"
              variant="outlined"
              density="compact"
              clearable
              class="mb-4 strings-search-field"
              :class="isDark ? 'theme--dark' : 'theme--light'"
            ></v-text-field>

            <!-- String count and pagination -->
            <div class="d-flex align-center mb-4">
              <v-chip color="info">
                {{ filteredStringContent.length }} of {{ stringsContent.length }} strings
              </v-chip>
              <v-spacer></v-spacer>
              <v-select
                v-model="stringsPerPage"
                :items="[25, 50, 100, 200]"
                label="Items per page"
                variant="outlined"
                density="compact"
                style="max-width: 150px;"
                class="strings-select"
                :class="isDark ? 'theme--dark' : 'theme--light'"
              ></v-select>
            </div>

            <!-- Pagination -->
            <v-pagination
              v-if="totalPages > 1"
              v-model="currentPage"
              :length="totalPages"
              :total-visible="5"
              class="mb-4 strings-pagination"
              :class="isDark ? 'theme--dark' : 'theme--light'"
            ></v-pagination>

            <!-- Strings list (paginated) -->
            <div class="strings-container" :class="isDark ? 'theme--dark' : 'theme--light'">
              <div v-for="(string, index) in paginatedStrings" :key="actualIndex(index)" class="string-item mb-2">
                <v-card
                  elevation="1"
                  class="pa-3 string-card"
                  :class="isDark ? 'theme--dark' : 'theme--light'"
                  @click="copyStringToClipboard(string)"
                >
                  <div class="d-flex align-center">
                    <span class="string-index mr-3" :class="isDark ? 'theme--dark' : 'theme--light'">#{{ actualIndex(index) }}</span>
                    <code class="string-value flex-grow-1" :class="isDark ? 'theme--dark' : 'theme--light'">{{ string }}</code>
                    <v-chip size="small" color="secondary" class="ml-2">{{ string.length }} chars</v-chip>
                    <v-btn icon size="small" variant="text" @click.stop="copyStringToClipboard(string)">
                      <v-icon size="16">mdi-content-copy</v-icon>
                    </v-btn>
                  </div>
                </v-card>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-8 strings-loading" :class="isDark ? 'theme--dark' : 'theme--light'">
            <v-progress-circular indeterminate color="primary" size="48"></v-progress-circular>
            <p class="mt-4">Loading strings...</p>
          </div>
        </v-card-text>

        <v-card-actions class="strings-actions" :class="isDark ? 'theme--dark' : 'theme--light'">
          <v-btn
            color="secondary"
            variant="tonal"
            prepend-icon="mdi-download"
            @click="exportAllStrings"
            :disabled="!stringsContent.length"
          >
            Export All
          </v-btn>
          <v-spacer></v-spacer>
          <v-btn color="primary" variant="elevated" @click="stringsDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <manifest-dialog
      :dialog="manifestDialog"
      :filename="currentFilename"
      @update:dialog="manifestDialog = $event"
    />

    <v-dialog v-model="plistDialog" max-width="800px">
      <v-card :class="isDark ? 'theme--dark' : 'theme--light'">
        <v-card-title class="headline">Plist</v-card-title>
        <v-card-text>
          <div v-highlight>
            <pre class="language-xml"><code>{{ plistContent }}</code></pre>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" @click="plistDialog = false" :class="isDark ? 'btn-dark' : ''">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

     <PermissionsDialog
    :permissionsDialog="permissionsDialog"
    :permissionsContent="permissionsContent"
    :appId="permissionsAppId"
    :isDark="isDark"
    @update:permissionsDialog="permissionsDialog = $event"
  />

    <v-dialog v-model="entitlementsDialog" max-width="800px">
      <v-card :class="isDark ? 'theme--dark' : 'theme--light'">
        <v-card-title class="headline">Entitlements</v-card-title>
        <v-card-text>
          <div v-highlight>
            <pre class="language-xml"><code>{{ entitlementsContent }}</code></pre>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" @click="entitlementsDialog = false" :class="isDark ? 'btn-dark' : ''">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar
      v-model="snackbar"
      :color="snackbarColor"
      :timeout="5000"
    >
      {{ snackbarText }}

      <template v-slot:actions>
        <v-btn
          color="white"
          text
          @click="snackbar = false"
        >
          Close
        </v-btn>
      </template>
    </v-snackbar>

    <activities-dialog
      :dialog="activitiesDialog"
      :tab="activitiesTab"
      :filename="currentFilename"
      :open-code-viewer="openCodeViewer"
      @update:dialog="activitiesDialog = $event"
      @update:tab="activitiesTab = $event"
    />

    <services-dialog
      :dialog="servicesDialog"
      :tab="servicesTab"
      :servicesList="servicesList"
      :filename="currentFilename"
      :open-code-viewer="openCodeViewer"
      @update:dialog="servicesDialog = $event"
      @update:tab="servicesTab = $event"
    />

    <ReconDialog
      :dialog="reconDialogVisible"
      :filename="currentReconApp"
      @update:dialog="reconDialogVisible = $event"
    />

    <SymbolsDialog
      :dialog="symbolsDialog"
      :symbols="symbolsList"
      :filename="currentFilename"
      @update:dialog="symbolsDialog = $event"
      @update:symbols="symbolsList = $event"
    />

    <CodeViewerDialog
      v-model="codeViewerDialog"
      :code="codeViewerContent"
      :isDark="isDark"
      :title="'Code Viewer: ' + codeViewerComponentName"
    />

    <v-dialog :model-value="loading" persistent max-width="300">
      <v-card :class="isDark ? 'theme--dark' : 'theme--light'">
        <v-card-text>
          <v-container>
            <v-row justify="center">
              <v-col class="text-center">
                <v-progress-circular
                  indeterminate
                  color="primary"
                ></v-progress-circular>
                <div>Uploading file...</div>
              </v-col>
            </v-row>
          </v-container>
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-dialog v-model="codeViewerDialog" fullscreen hide-overlay transition="dialog-bottom-transition">
      <v-card>
        <v-toolbar dark color="primary">
          <v-btn icon dark @click="codeViewerDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
          <v-toolbar-title>Code Viewer: {{ codeViewerComponentName }}</v-toolbar-title>
        </v-toolbar>
        <v-card-text>
          <CodeViewer :code="codeViewerContent" :isDark="isDark" />
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>


<script>
import { defineComponent, nextTick, ref } from 'vue';
import { mapState, mapActions, mapGetters } from 'vuex';
import { useRouter } from 'vue-router';

import axios from 'axios';
import { engineApi } from '@/services';
import 'vue-code-highlight/themes/prism-okaidia.css';
import IntentFilters from "@/components/Filters/IntentFilters.vue";
import InfoSection from "@/components/iOS/InfoSection.vue";
import ActivitiesDialog from "@/components/Android/ActivitiesDialog.vue";
import ReceiversDialog from "@/components/Android/ReceiversDialog.vue";
import FunctionsDialog from "@/components/iOS/FunctionsDialog.vue";
import ClassesSection from "@/components/iOS/ClassesSection.vue";
import ServicesDialog from "@/components/Android/ServicesDialog.vue";
import SymbolsDialog from "@/components/iOS/SymbolsDialog.vue";
import ProvidersDialog from "@/components/Android/ProvidersDialog.vue";
import ReconDialog from "@/components/Android/Recon/ReconDialog.vue";
import CodeViewer from "@/components/Android/CodeViewer.vue";
import BulkUpload from "@/components/Loaders/BulkUpload.vue";
import ManifestDialog from "@/components/Android/ManifestDialog.vue";
import PermissionsDialog from "@/components/Android/PermissionsDialog.vue";

import store from "@/store";

export default defineComponent({
  name: 'Dashboard',
  components: {
    IntentFilters,
    InfoSection,
    ActivitiesDialog,
    ReceiversDialog,
    ProvidersDialog,
    FunctionsDialog,
    ClassesSection,
    ServicesDialog,
    SymbolsDialog,
    CodeViewer,
    ReconDialog,
    BulkUpload,
    ManifestDialog,
    PermissionsDialog
  },
  data() {
    return {
      codeViewerDialog: false,
      searchQuery: '',

      androidHeaders: [
        { title: 'Icon', key: 'icon', sortable: false },
        { title: 'Application', key: 'application' },
        { title: 'Recon', key: 'recon', sortable: false },
        { title: 'Activities', key: 'activities', sortable: true },
        { title: 'Services', key: 'services', sortable: false },
        { title: 'Receivers', key: 'receivers', sortable: false },
        { title: 'Providers', key: 'providers', sortable: false },
        { title: 'Manifest', key: 'manifest', sortable: false },
        { title: 'Permissions', key: 'permissions', sortable: false },
        { title: 'Scan', key: 'scan', sortable: false },
        { title: 'Results', key: 'results', sortable: false },
        { title: 'Decompile', key: 'scan_app', sortable: true},
        { title: 'User', key: 'system_app', sortable: true, align: 'center' },
        { title: 'Scan Status', key: 'scan_status', sortable: false },
        { title: 'Delete', key: 'delete', sortable: false },
        { title: '', key: 'data-table-expand' },
      ],
      iosHeaders: [
        { title: 'Icon', key: 'icon', sortable: false },
        { title: 'Application', key: 'application' },
        { title: 'Plist', key: 'plist', sortable: false },
        { title: 'Permissions', key: 'permissions', sortable: false },
        { title: 'Entitlements', key: 'entitlements', sortable: false },
        { title: 'Binary', key: 'binary', sortable: false },
        { title: 'Delete', key: 'delete', sortable: false },
        { title: '', key: 'data-table-expand' },
      ],
      items: [],
      selectedFile: null,
      selectedAndroidFile: null,
      selectedIosFile: null,
      manifestDialog: false,
      permissionsDialog: false,
      permissionsAppId: '',
      activitiesDialog: false,
      servicesDialog: false,
      servicesTab: 'exported',
      reconDialogVisible: false,
      currentReconApp: null,
      servicesList: {
        exported: [],
        non_exported: [],
      },
      snackbar: false,
      iosUploading: false,
      androidUploading: false,
      snackbarText: '',
      snackbarColor: 'success',
      plistDialog: false,
      entitlementsDialog: false,
      jsonDialog: false,
      jsonDialogImports: false,
      infoDialog: false,
      classesDialog: false,
      objcClasses: '',
      swiftClasses: [],
      decompiledClassesContent: '',
      exportsDialog: false,
      stringsDialog: false,
      stringSearchQuery: '',
      currentPage: 1,
      stringsPerPage: 50,
      importsDialog: false,
      providersDialog: false,
      functionsDialog: false,
      receiversTab: 'exported',
      receiversDialog: false,
      decompileLoading: false,
      receiversList: {
        exported: [],
        non_exported: [],
      },
      activitiesTab: 'exported',
      providersTab: 'exported',
      currentFilename: '',
      activitiesList: {
        exported: [],
        non_exported: [],
      },
      providersList: {
        exported: [],
        non_exported: [],
      },
      functionsList: [],
      infoTab: 'info',
      permissionsContent: '',
      plistContent: '',
      entitlementsContent: '',
      symbolsDialog: false,
      symbolsList: [],
      activitiesType: '',
      intentFilters: [],
      selectedActivity: '',
      expandedItemData: {},
      expandedAndroid: [],
      expandedIos: [],
      loading: false,
      jsonData: null,
      jsonDataImports: null,
      infoContent: {
        Architecture: '',
        Encrypted: false,
        'Virtual Base': '',
        Endianness: '',
      },
      loadingStates: {
        info: false,
        binary: false,
        symbols: false,
        functions: false
      },
      segmentsContent: [],
      loadCommandsContent: [],
      sectionsContent: [],
      stringsContent: [],
      encryptionInfo: [],
      fileInfo: [],
      deepLinks: { url_schemes: [], universal_links: [], queried_schemes: [] },
      currentFile: '',
      editorCode: 'const a = 10;',
      snackbarMessage: '',
      editorOptions: {
        tabSize: 4,
        mode: 'text/javascript',
        theme: 'base16-dark',
        lineNumbers: true,
        line: true,
      },
      scanPollingIntervals: {}, // Store polling intervals
      activeScanRequests: {}, // Track active scan API requests to prevent duplicates
      backendScanSyncInterval: null,
      userSortOrder: 'none', // 'none', 'system', 'normal' - for User column sorting
      vulnSortAsc: false, // false = highest first (default), true = lowest first
    };
  },
  async created() {
    // Clear any leftover polling intervals from previous sessions
    Object.values(this.scanPollingIntervals).forEach(interval => {
      clearInterval(interval);
    });
    this.scanPollingIntervals = {};

    // Restore cached expandedItemData from localStorage for faster initial load
    try {
      const cachedItemData = localStorage.getItem('leviathan_expanded_item_data');
      if (cachedItemData) {
        this.expandedItemData = JSON.parse(cachedItemData);
      }
    } catch (e) {
      console.error('Error loading cached item data:', e);
    }

    this.fetchData();
    this.loadActiveScans();

    // Sync with backend truth so we don't lose scan indicators after refresh.
    await this.syncActiveScansFromBackend();

    // Wait a bit for store to be fully loaded
    await this.$nextTick();

    // Resume active scans with verification
    await this.resumeActiveScans();

    // Periodically reconcile backend active tasks (WAITING/PROCESSING) with local store.
    this.backendScanSyncInterval = setInterval(() => {
      this.syncActiveScansFromBackend();
    }, 10000);

    // Clean up expired scans periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredScans();
    }, 60000); // Every minute
  },

  beforeUnmount() {
    // Clean up polling intervals
    Object.values(this.scanPollingIntervals).forEach(interval => {
      clearInterval(interval);
    });
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.backendScanSyncInterval) {
      clearInterval(this.backendScanSyncInterval);
    }
  },

  computed: {
    ...mapState(['isDark']),
    ...mapState({
      codeViewerContent: state => state.codeViewerData?.code || '',
      codeViewerFilename: state => state.codeViewerData?.filename || '',
      codeViewerComponentName: state => state.codeViewerData?.componentName || ''
    }),
    ...mapGetters([
      'isScanning',
      'isScanFailed',
      'getFailedScanError',
      'getScanTaskId',
      'getActiveScanTaskId',
      'getScanByTaskId',
      'getActiveScanCount',
      'getAllActiveScans',
      'getScanProgress',
      'getRecentScanResult',
      'decompilerEngine',
      'decompilerResources'
    ]),
    androidItems() {
      return this.items.filter((item) => item.application.endsWith('.apk'));
    },
    iosItems() {
      return this.items.filter((item) => item.application.endsWith('.ipa'));
    },

    sortedAndroidItems() {
      const items = [...this.androidItems];
      items.sort((a, b) => {
        // First, apply user sort order if active
        if (this.userSortOrder !== 'none') {
          const aRank = this.getUserTierRank(a.application);
          const bRank = this.getUserTierRank(b.application);

          if (aRank !== bRank) {
            if (this.userSortOrder === 'system') {
              // higher tier first
              return bRank - aRank;
            }
            // normal-first means lower tier first
            return aRank - bRank;
          }
        }

        const aKey = this.getScanSortKey(a);
        const bKey = this.getScanSortKey(b);

        // higher priority first (scanning apps always on top)
        if (aKey.priority !== bKey.priority) return bKey.priority - aKey.priority;
        // vuln count sorting - direction based on vulnSortAsc
        if (aKey.vulns !== bKey.vulns) {
          return this.vulnSortAsc ? (aKey.vulns - bKey.vulns) : (bKey.vulns - aKey.vulns);
        }
        // stable tie-breaker
        return (a.application || '').localeCompare(b.application || '');
      });
      return items;
    },

    sortedIosItems() {
      // iOS doesn't currently have a vuln scan count in this table;
      // still keep deterministic ordering (name asc) and keep "scanning" (if ever used) pinned.
      const items = [...this.iosItems];
      items.sort((a, b) => {
        const aKey = this.getScanSortKey(a);
        const bKey = this.getScanSortKey(b);

        if (aKey.priority !== bKey.priority) return bKey.priority - aKey.priority;
        if (aKey.vulns !== bKey.vulns) return bKey.vulns - aKey.vulns;
        return (a.application || '').localeCompare(b.application || '');
      });
      return items;
    },

    filteredStringContent() {
      if (!this.stringSearchQuery || !this.stringsContent) {
        return this.stringsContent || [];
      }
      const query = this.stringSearchQuery.toLowerCase();
      return this.stringsContent.filter(str => str.toLowerCase().includes(query));
    },

    totalPages() {
      return Math.ceil(this.filteredStringContent.length / this.stringsPerPage);
    },

    paginatedStrings() {
      const start = (this.currentPage - 1) * this.stringsPerPage;
      const end = start + this.stringsPerPage;
      return this.filteredStringContent.slice(start, end);
    },
  },
  watch: {
    // Reset to page 1 when search query changes
    stringSearchQuery() {
      this.currentPage = 1;
    },
  },
  methods: {
    async uploadAndroidFile() {
      if (!this.selectedAndroidFile) return;

      this.androidUploading = true;
      const formData = new FormData();
      formData.append('file', this.selectedAndroidFile);

      try {
        await axios.post(`${import.meta.env.VITE_APP_API_URL}/audit/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          params: { type: 'audit' },
        });

        this.fetchData();
        this.selectedAndroidFile = null;
        this.showSnackbar('APK uploaded successfully', 'success');
      } catch (error) {
        console.error('Error uploading Android file:', error);
        this.showSnackbar('Failed to upload APK', 'error');
      } finally {
        this.androidUploading = false;
      }
    },

     async uploadIosFile() {
      if (!this.selectedIosFile) return;

      this.iosUploading = true;
      const formData = new FormData();
      formData.append('file', this.selectedIosFile);

      try {
        await axios.post(`${import.meta.env.VITE_APP_API_URL}/audit/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          params: { type: 'ios' },
        });

        this.fetchData();
        this.selectedIosFile = null;
        this.showSnackbar('IPA uploaded successfully', 'success');
      } catch (error) {
        console.error('Error uploading iOS file:', error);
        this.showSnackbar('Failed to upload IPA', 'error');
      } finally {
        this.iosUploading = false;
      }
    },
    openCodeViewer() {
      this.codeViewerDialog = true;
    },

    openReconDialog(item) {
      this.currentReconApp = item.application;
      this.reconDialogVisible = true;
    },

    showSnackbar(text, color = 'success') {
      this.snackbarText = text;
      this.snackbarColor = color;
      this.snackbar = true;
    },

    ...mapActions([
      'setTheme',
      'setCurrentApplication',
      'startScan',
      'completeScan',
      'failScan',
      'updateScanProgress',
      'updateScanTaskId',
      'loadActiveScans',
      'removeScan',
      'clearOldScanResults',
      'cleanupExpiredScans',
      'stopScan',
      'stopScanByFilename'
    ]),

    startInfoFetch(application) {
      if (!this.loadingStates[application]) {
        this.$set(this.loadingStates, application, {});
      }
      this.$set(this.loadingStates[application], 'info', true);
    },

    async fetchData() {
      try {
        // CRITICAL: Ensure store is loaded before proceeding
        await this.loadActiveScans();

        // Add a small delay to ensure store is fully initialized after route change
        await this.$nextTick();

        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/audit/files`);
        this.items = response.data.map(item => ({
          ...item,
          isDecompiling: false,
          isDecompiled: false,
          lastEngine: null, // engine the app was last decompiled with (from decompileCheck)
          isLoadingActivities: false,
          isLoadingServices: false,
          isLoadingReceivers: false,
          isLoadingProviders: false,
          isLoadingInfo: false,
          isLoadingExports: false,
          isLoadingImports: false,
          isLoadingSymbols: false,
          isLoadingFunctions: false,
          isLoadingClasses: false,
        }));

        // Process each item and apply cached scan data
        for (const item of this.items) {
          // Fetch item details
          await this.fetchItemDetails(item);

          // For APK files, check for scan data
          if (item.application.endsWith('.apk')) {
            // Check if actively scanning
            if (this.isScanning(item.application)) {
              item.scanData = {
                status: 'in_progress',
                vulnerabilityCount: 0
              };
              continue;
            }

            // IMPORTANT: Check cached results first
            const cachedResult = this.getRecentScanResult(item.application);
            console.log(`Checking cache for ${item.application}:`, cachedResult);

            if (cachedResult && cachedResult.result && cachedResult.result.security_issues_summary) {
              console.log(`Applying cached scan result for ${item.application}`, cachedResult.result.security_issues_summary);
              item.scanData = {
                status: 'completed',
                vulnerabilityCount: this.getTotalVulnerabilityCount(cachedResult.result.security_issues_summary),
                scanDate: cachedResult.result.scan_date || cachedResult.timestamp,
                issueCategories: Object.keys(cachedResult.result.security_issues_summary || {}).length,
                security_issues_summary: cachedResult.result.security_issues_summary
              };
              // Skip API call if we have cached data
              continue;
            }

            console.log(`No valid cache for ${item.application}, fetching from API`);

            // Only fetch from API if no cached data
            await this.fetchScanData(item);
          }
        }

        // Check decompile status for all APK items in parallel (non-blocking)
        const apkItems = this.items.filter(item => item.application.endsWith('.apk'));
        Promise.all(apkItems.map(async (item) => {
          try {
            const res = await engineApi.decompileCheck(item.application);
            item.isDecompiled = res.decompiled === true;
            item.lastEngine = res.engine || null;
          } catch {
            // ignore errors — button stays enabled
          }
        }));
      } catch (error) {
        console.error('Error fetching data:', error);
        this.showSnackbar('Error loading applications', 'error');
      }
    },

    async resumeActiveScans() {
      console.log('🟢 resumeActiveScans called');
      // Resume polling for any active scans
      const activeScans = this.getAllActiveScans;
      console.log('🟢 Active scans to check:', activeScans);
      const now = Date.now();
      const maxResumeAge = 30 * 60 * 1000; // Only resume polling for scans started in the last 30 minutes

      for (const scan of activeScans) {
        const scanAge = now - scan.startTime;
        const isValidTaskId = scan.taskId &&
                             scan.taskId !== 'pending' &&
                             !scan.taskId.startsWith('temp_');

        // Skip scans that aren't in progress or have invalid task IDs
        if (scan.status !== 'in_progress') {
          continue;
        }

        if (!isValidTaskId) {
          console.log(`Removing invalid scan: ${scan.taskId} for ${scan.filename}`);
          this.removeScan(scan.taskId);
          continue;
        }

        // For ALL in_progress scans (recent or old), check their actual status
        console.log(`Checking scan status for ${scan.filename} with task ID ${scan.taskId} (age: ${Math.round(scanAge / 1000)}s)`);

        let statusChecked = false;
        const shouldResumePoll = scanAge < maxResumeAge; // Only resume polling for recent scans

        // First try Celery task status endpoint
        try {
          const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/engine/scan/status/${scan.taskId}`);

          if (response.data.state === 'PENDING' || response.data.state === 'STARTED' || response.data.state === 'PROGRESS') {
            if (shouldResumePoll) {
              console.log(`Resuming scan for ${scan.filename} - state: ${response.data.state}`);
              this.pollScanStatus(scan.taskId, scan.filename);
            } else {
              console.log(`Scan ${scan.filename} still in progress but too old to resume polling`);
            }
            statusChecked = true;
          } else if (response.data.state === 'SUCCESS') {
            console.log(`Scan ${scan.taskId} completed, updating status`);
            this.completeScan({
              taskId: scan.taskId,
              result: response.data.result || {}
            });
            statusChecked = true;
          } else if (response.data.state === 'FAILURE') {
            console.log(`Scan ${scan.taskId} failed, updating status`);
            this.failScan({
              taskId: scan.taskId,
              error: response.data.error || 'Unknown error'
            });
            statusChecked = true;
          }
        } catch (error) {
          console.log(`Celery status check failed for ${scan.taskId}, trying GUID endpoint...`);
        }

        // If Celery endpoint didn't work, try GUID-based endpoint
        if (!statusChecked) {
          try {
            const guidResponse = await axios.get(`${import.meta.env.VITE_APP_API_URL}/engine/scan/status-by-guid/${scan.taskId}`);
            const data = guidResponse.data;

            console.log(`GUID status response for ${scan.filename}:`, data);

            if (data.state === 'QUEUED' || data.status === 'WAITING') {
              if (shouldResumePoll) {
                console.log(`Scan still queued for ${scan.filename}, resuming poll`);
                this.pollScanStatusByGUID(scan.taskId, scan.filename);
              } else {
                console.log(`Scan ${scan.filename} still queued but too old to resume polling`);
              }
            } else if (data.state === 'STARTED' || data.status === 'PROCESSING') {
              if (shouldResumePoll) {
                if (data.task_id) {
                  console.log(`Scan now processing with Celery ID ${data.task_id}, switching poll`);
                  this.updateScanTaskId({ oldTaskId: scan.taskId, newTaskId: data.task_id });
                  this.pollScanStatus(data.task_id, scan.filename);
                } else {
                  this.pollScanStatusByGUID(scan.taskId, scan.filename);
                }
              } else {
                console.log(`Scan ${scan.filename} still processing but too old to resume polling`);
              }
            } else if (data.state === 'SUCCESS' || data.status === 'FINISHED') {
              console.log(`Scan ${scan.taskId} completed (via GUID), updating status`);
              this.completeScan({
                taskId: scan.taskId,
                result: data.result || {}
              });
            } else if (data.state === 'FAILURE' || data.status === 'ERROR') {
              console.log(`Scan ${scan.taskId} failed (via GUID), updating status`);
              this.failScan({
                taskId: scan.taskId,
                error: data.error || 'Unknown error'
              });
            }
          } catch (guidError) {
            console.error(`Both status endpoints failed for ${scan.taskId}:`, guidError);
            // For old scans where both endpoints fail, mark as failed
            if (!shouldResumePoll) {
              console.log(`Marking old scan ${scan.taskId} as failed due to status check failure`);
              this.failScan({
                taskId: scan.taskId,
                error: 'Unable to retrieve scan status'
              });
            }
          }
        }
      }
    },

    async ScanApp(filename) {
      console.log(`🔵 ScanApp called for ${filename} at ${new Date().toISOString()}`);
      console.trace('ScanApp call stack');

      // Check if already scanning
      if (this.isScanning(filename)) {
        console.log(`Scan already in progress for ${filename}, ignoring duplicate request`);
        this.showSnackbar(`${filename} is already being scanned`, 'warning');
        return;
      }

      // Check if there's an active API request for this file
      if (this.activeScanRequests[filename]) {
        console.log(`API request already in flight for ${filename}, ignoring duplicate click`);
        return;
      }

      // Create temp task ID to prevent duplicate clicks
      const tempTaskId = `temp_${Date.now()}`;

      try {
        // Mark request as in-flight to block duplicates
        this.activeScanRequests[filename] = true;

        // Immediately mark as scanning to prevent duplicate clicks
        this.startScan({ taskId: tempTaskId, filename });

        // Start the scan
        const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/engine/scan/${filename}`);

        console.log('Scan started:', response.data);

        // Handle both immediate and queued scans
        if (response.data.status === 'queued') {
          // Scan is queued - use scan_guid for polling
          console.log(`Scan queued for ${filename} with GUID ${response.data.scan_guid}`);

          // Update store with scan_guid as the task ID temporarily
          this.removeScan(tempTaskId);
          this.startScan({ taskId: response.data.scan_guid, filename });

          // Wait for store to be fully updated before polling
          await this.$nextTick();

          // Show queue notification
          this.snackbarText = `Scan queued for ${filename} (position ${response.data.queue_position} in queue)`;
          this.snackbarColor = 'info';
          this.snackbar = true;

          // Start polling using scan_guid
          this.pollScanStatusByGUID(response.data.scan_guid, filename);
        } else {
          // Scan started immediately - use task_id
          console.log(`Scan started immediately for ${filename} with task ID ${response.data.task_id}`);

          // Update store with real task ID
          this.removeScan(tempTaskId);
          this.startScan({ taskId: response.data.task_id, filename });

          // Wait for store to be fully updated before polling
          await this.$nextTick();

          // Show a snackbar indicating that scan has started
          this.snackbarText = `Scan started for ${filename}. Results will be saved in ${response.data.output_dir}`;
          this.snackbarColor = 'info';
          this.snackbar = true;

          // Start polling for results
          this.pollScanStatus(response.data.task_id, filename);
        }

      } catch (error) {
        console.error('Error during scan:', error);

        // Remove temporary task on error
        this.removeScan(tempTaskId);

        // Check if it's a 409 conflict (scan already running)
        if (error.response && error.response.status === 409) {
          const existingTaskId = error.response.data.task_id;
          console.log(`Scan already running with task ID: ${existingTaskId}`);

          // Update store with the existing task ID
          this.startScan({ taskId: existingTaskId, filename });

          // Wait for store to be fully updated before polling
          await this.$nextTick();

          // Start polling for the existing task
          this.pollScanStatus(existingTaskId, filename);

          this.snackbarText = `Scan already in progress for ${filename}`;
          this.snackbarColor = 'warning';
        } else {
          this.snackbarText = `Error starting scan for ${filename}`;
          this.snackbarColor = 'error';
        }
        this.snackbar = true;
      } finally {
        // Clear the in-flight request flag
        delete this.activeScanRequests[filename];
      }
    },

    async stopScanApp(filename) {
      const taskId = this.getActiveScanTaskId(filename);
      if (!taskId) {
        this.showSnackbar('No active scan found for this application', 'warning');
        return;
      }

      try {
        // Resolve the identifier from the server record: queued GUIDs and Celery
        // IDs are both UUIDs, so their string shapes cannot distinguish them.
        const active = await axios.get(`${import.meta.env.VITE_APP_API_URL}/engine/scan-tasks/active`);
        const scan = active.data.active_scans.find(
          entry => entry.filename === filename &&
            (entry.guid === taskId || entry.celery_task_id === taskId)
        );
        if (!scan) {
          this.showSnackbar('This scan is no longer active', 'warning');
          return;
        }
        const response = await axios.post(
          `${import.meta.env.VITE_APP_API_URL}/engine/scan/stop/${encodeURIComponent(scan.guid)}`,
          { identifier_type: 'guid' }
        );
        if (response.data.status !== 'success') {
          this.showSnackbar(response.data.message || 'Failed to stop scan', 'error');
          return;
        }
        // Keep polling and local state intact until server cancellation succeeds.
        for (const id of new Set([taskId, scan.guid, scan.celery_task_id].filter(Boolean))) {
          if (this.scanPollingIntervals[id]) {
            clearInterval(this.scanPollingIntervals[id]);
            delete this.scanPollingIntervals[id];
          }
          this.removeScan(id);
        }
        this.showSnackbar(`Scan stopped for ${filename}`, 'success');

      } catch (error) {
        console.error('Error stopping scan:', error);
        this.showSnackbar('Error stopping scan', 'error');
      }
    },

    async fetchScanData(item) {
      try {
        // Only try to fetch scan data for APK files
        if (!item.application.endsWith('.apk')) return;

        // First check if there's an active scan for this app
        if (this.isScanning(item.application)) {
          // Don't fetch scan data if actively scanning
          item.scanData = {
            status: 'in_progress',
            vulnerabilityCount: 0
          };
          return;
        }

        // Then try to get the high-level scan summary
        const response = await axios.get(
          `${import.meta.env.VITE_APP_API_URL}/engine/scan/results/${item.application}/high-level`
        );

        if (response.data) {
          // Check one more time if scan started while we were fetching
          if (this.isScanning(item.application)) {
            item.scanData = {
              status: 'in_progress',
              vulnerabilityCount: 0
            };
            return;
          }

          item.scanData = {
            status: 'completed',
            vulnerabilityCount: this.getTotalVulnerabilityCount(response.data.security_issues_summary),
            scanDate: response.data.scan_date,
            issueCategories: Object.keys(response.data.security_issues_summary || {}).length,
            security_issues_summary: response.data.security_issues_summary // Store the full summary
          };
        }
      } catch (error) {
        console.error(`Error fetching scan data for ${item.application}:`, error);
        if (error.response && error.response.status === 404) {
          // No scan data found - this is normal for new uploads
          item.scanData = {
            status: 'not_found',
            vulnerabilityCount: 0
          };
        } else {
          // Actual error occurred
          item.scanData = {
            status: 'error',
            errorMessage: error.response?.data?.message || 'Unknown error'
          };
        }
      }
    },

    // Helper method to count total vulnerabilities
    getTotalVulnerabilityCount(securityIssuesSummary) {
      if (!securityIssuesSummary || typeof securityIssuesSummary !== 'object') return 0;

      let total = 0;
      for (const category in securityIssuesSummary) {
        if (securityIssuesSummary[category] && typeof securityIssuesSummary[category].count === 'number') {
          total += securityIssuesSummary[category].count;
        }
      }
      return total;
    },

    async viewResults(application) {
      try {
        await this.$store.dispatch('setCurrentApplication', application);
        this.$router.push({ name: 'Results', params: { application } });
      } catch (error) {
        console.error('Error navigating to results:', error);
        this.showSnackbar('Error loading results. Please try again.', 'error');
      }
    },

    async pollScanStatus(taskId, filename) {
      // Clear any existing polling for this task OR filename
      if (this.scanPollingIntervals[taskId]) {
        clearInterval(this.scanPollingIntervals[taskId]);
        delete this.scanPollingIntervals[taskId];
      }

      // Also clear any existing polling for this filename (in case of multiple tasks)
      for (const [key, interval] of Object.entries(this.scanPollingIntervals)) {
        const scan = this.getScanByTaskId(key);
        if (scan && scan.filename === filename && key !== taskId) {
          clearInterval(interval);
          delete this.scanPollingIntervals[key];
        }
      }

      let retryCount = 0;
      const maxRetries = 3;

      const pollInterval = setInterval(async () => {
        try {
          const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/engine/scan/status/${taskId}`);

          // Reset retry count on successful request
          retryCount = 0;

          if (response.data.state === 'SUCCESS') {
            console.log('Scan completed:', response.data.result);

            // IMPORTANT: Mark scan as complete FIRST to prevent race condition
            // Use a temporary completion to stop isScanning from returning true
            this.completeScan({
              taskId,
              result: {
                security_issues_summary: {},
                scan_date: new Date().toISOString()
              }
            });

            // Now fetch the full scan results from the backend
            const item = this.items.find(i => i.application === filename);
            if (item) {
              await this.fetchItemDetails(item);
              // Now fetchScanData won't see it as "in_progress"
              await this.fetchScanData(item);

              console.log('Scan data after fetch:', item.scanData);

              // Update the store with the actual complete data
              if (item.scanData && item.scanData.security_issues_summary) {
                const resultToCache = {
                  security_issues_summary: item.scanData.security_issues_summary,
                  scan_date: item.scanData.scanDate || new Date().toISOString(),
                  vulnerabilityCount: item.scanData.vulnerabilityCount,
                  issueCategories: item.scanData.issueCategories
                };
                console.log('Caching complete scan result:', resultToCache);
                this.completeScan({
                  taskId,
                  result: resultToCache
                });
              } else {
                console.warn('fetchScanData did not return security_issues_summary');
              }
            }

            this.snackbarText = `${filename} Scan Completed`;
            this.snackbarColor = 'success';
            this.snackbar = true;

            // Clear the polling interval
            clearInterval(this.scanPollingIntervals[taskId]);
            delete this.scanPollingIntervals[taskId];

          } else if (response.data.state === 'REVOKED') {
            // Scan was stopped by user
            this.removeScan(taskId);

            // Safety: if any other in-progress entries exist for this filename, stop them too
            if (typeof this.stopScanByFilename === 'function') {
              this.stopScanByFilename(filename);
            }

            this.snackbarText = `Scan stopped for ${filename}`;
            this.snackbarColor = 'info';
            this.snackbar = true;

            // Clear the polling interval
            clearInterval(this.scanPollingIntervals[taskId]);
            delete this.scanPollingIntervals[taskId];

          } else if (response.data.state === 'FAILURE') {
            this.failScan({ taskId, error: response.data.error });

            this.snackbarText = `Scan failed for ${filename}`;
            this.snackbarColor = 'error';
            this.snackbar = true;

            // Clear the polling interval
            clearInterval(this.scanPollingIntervals[taskId]);
            delete this.scanPollingIntervals[taskId];

          } else if (response.data.state === 'PROGRESS') {
            // Update progress if your backend supports it
            const progress = response.data.current / response.data.total * 100;
            this.updateScanProgress({ taskId, progress });
          }
          // PENDING state continues polling
        } catch (error) {
          console.error('Error polling scan status:', error);
          retryCount++;

          // If we've exceeded retry limit, stop polling
          if (retryCount >= maxRetries) {
            console.error(`Exceeded max retries (${maxRetries}) for task ${taskId}. Stopping polling.`);
            this.failScan({ taskId, error: 'Network error: exceeded retry limit' });
            clearInterval(this.scanPollingIntervals[taskId]);
            delete this.scanPollingIntervals[taskId];
          }
        }
      }, 3000); // Poll every 3 seconds (reduced from 5)

      this.scanPollingIntervals[taskId] = pollInterval;
    },

    async pollScanStatusByGUID(scanGuid, filename) {
      // Poll scan status using GUID - for queued scans that don't have a Celery task ID yet
      console.log(`Starting GUID-based polling for ${filename} with GUID ${scanGuid}`);

      // Clear any existing polling for this GUID
      if (this.scanPollingIntervals[scanGuid]) {
        clearInterval(this.scanPollingIntervals[scanGuid]);
        delete this.scanPollingIntervals[scanGuid];
      }

      // Also clear any existing polling for this filename
      for (const [key, interval] of Object.entries(this.scanPollingIntervals)) {
        const scan = this.getScanByTaskId(key);
        if (scan && scan.filename === filename && key !== scanGuid) {
          clearInterval(interval);
          delete this.scanPollingIntervals[key];
        }
      }

      let retryCount = 0;
      const maxRetries = 3;

      const pollInterval = setInterval(async () => {
        try {
          const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/engine/scan/status-by-guid/${scanGuid}`);

          // Reset retry count on successful request
          retryCount = 0;

          console.log(`GUID poll response for ${filename}:`, response.data);

          if (response.data.state === 'QUEUED') {
            // Still waiting in queue
            console.log(`Scan ${filename} still in queue (position ${response.data.queue_position})`);
            // Update progress or show queue position
            this.updateScanProgress({ taskId: scanGuid, progress: 0 });

          } else if (response.data.task_id) {
            // Scan has started and now has a Celery task ID!
            console.log(`Scan ${filename} started with task ID ${response.data.task_id}`);

            // Stop GUID-based polling
            clearInterval(this.scanPollingIntervals[scanGuid]);
            delete this.scanPollingIntervals[scanGuid];

            // Update store with real task ID
            this.removeScan(scanGuid);
            this.startScan({ taskId: response.data.task_id, filename });

            await this.$nextTick();

            // Switch to normal task ID polling
            this.pollScanStatus(response.data.task_id, filename);

          } else if (response.data.state === 'SUCCESS') {
            // Scan completed (edge case - scan completed before we could switch to task ID polling)
            console.log('Scan completed:', response.data.result);

            this.completeScan({
              taskId: scanGuid,
              result: {
                security_issues_summary: {},
                scan_date: new Date().toISOString()
              }
            });

            const item = this.items.find(i => i.application === filename);
            if (item) {
              await this.fetchItemDetails(item);
              await this.fetchScanData(item);

              if (item.scanData && item.scanData.security_issues_summary) {
                const resultToCache = {
                  security_issues_summary: item.scanData.security_issues_summary,
                  scan_date: item.scanData.scanDate || new Date().toISOString(),
                  vulnerabilityCount: item.scanData.vulnerabilityCount,
                  issueCategories: item.scanData.issueCategories
                };
                this.completeScan({
                  taskId: scanGuid,
                  result: resultToCache
                });
              }
            }

            this.snackbarText = `${filename} Scan Completed`;
            this.snackbarColor = 'success';
            this.snackbar = true;

            clearInterval(this.scanPollingIntervals[scanGuid]);
            delete this.scanPollingIntervals[scanGuid];

          } else if (response.data.state === 'FAILURE') {
            // Scan failed
            console.error('Scan failed:', response.data.error);

            this.failScan({
              taskId: scanGuid,
              error: response.data.error || 'Unknown error'
            });

            this.snackbarText = `Scan failed for ${filename}`;
            this.snackbarColor = 'error';
            this.snackbar = true;

            clearInterval(this.scanPollingIntervals[scanGuid]);
            delete this.scanPollingIntervals[scanGuid];
          }

        } catch (error) {
          retryCount++;
          console.error(`Error polling scan status (attempt ${retryCount}/${maxRetries}):`, error);

          if (retryCount >= maxRetries) {
            console.error('Max retries reached, stopping polling');

            this.failScan({
              taskId: scanGuid,
              error: 'Failed to poll scan status'
            });

            clearInterval(this.scanPollingIntervals[scanGuid]);
            delete this.scanPollingIntervals[scanGuid];

            this.snackbarText = `Error polling scan status for ${filename}`;
            this.snackbarColor = 'error';
            this.snackbar = true;
          }
        }
      }, 3000); // Poll every 3 seconds

      this.scanPollingIntervals[scanGuid] = pollInterval;
    },

    async fetchItemDetails(item) {
      // Skip API call if we already have cached data for this item
      if (this.expandedItemData[item.application] && !this.expandedItemData[item.application].error) {
        return;
      }

      try {
        const response = await axios.get(
          `${import.meta.env.VITE_APP_API_URL}/${item.application.endsWith('.ipa') ? 'ios' : 'audit'}/details/${item.application}`
        );
        this.expandedItemData[item.application] = response.data;
        // Persist to localStorage for navigation persistence
        this.saveExpandedItemDataToCache();
      } catch (error) {
        console.error('Error loading expanded item data:', error);
        this.expandedItemData[item.application] = { error: 'Error loading data' };
      }
    },

    saveExpandedItemDataToCache() {
      try {
        localStorage.setItem('leviathan_expanded_item_data', JSON.stringify(this.expandedItemData));
      } catch (e) {
        console.error('Error saving expanded item data to cache:', e);
      }
    },

    async deleteItem(item) {
      if (confirm('Are you sure you want to delete this item?')) {
        try {
          await axios.delete(`${import.meta.env.VITE_APP_API_URL}/audit/delete/${item.application}`);
          this.items = this.items.filter((i) => i !== item);
          console.log('Item deleted successfully');
          this.showSnackbar('Item deleted successfully', 'success');

        } catch (error) {
          console.error('Error deleting item:', error);
          this.showSnackbar('Error deleting item. Please try again.', 'error');
        }
      }
    },

    async uploadFile(type) {
      if (!this.selectedFile) {
        return;
      }
      const formData = new FormData();
      formData.append('file', this.selectedFile);
      this.loading = true; // Set loading to true
      try {
        await axios.post(`${import.meta.env.VITE_APP_API_URL}/audit/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          params: { type },
        });
        this.fetchData();
        this.selectedFile = null;
      } catch (error) {
        console.error('Error uploading file:', error);
      } finally {
        this.loading = false; // Set loading to false after upload
      }
    },

    async checkApi() {
      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/audit/hello`);
        alert(response.data.message);
      } catch (error) {
        console.error('Error checking API:', error);
      }
    },

    // Updated helper methods for the scan status column
    getScanStatusColor(item) {
      // Check if actively scanning
      if (this.isScanning(item.application)) return 'info';

      // Check if scan failed (from store's activeScans)
      if (this.isScanFailed(item.application)) return 'error';

      if (!item.scanData) return 'grey'; // No scan data

      if (item.scanData.status === 'completed') {
        // Color based on number of vulnerabilities
        if (item.scanData.vulnerabilityCount > 10) return 'error';
        if (item.scanData.vulnerabilityCount > 0) return 'warning';
        return 'success';
      }

      if (item.scanData.status === 'error') return 'error';

      return 'grey'; // Default color
    },

    getScanStatusIcon(item) {
      // Don't show icon if actively scanning (spinner is shown instead)
      if (this.isScanning(item.application)) return '';

      // Check if scan failed (from store's activeScans)
      if (this.isScanFailed(item.application)) return 'mdi-close-circle';

      if (!item.scanData) return 'mdi-help-circle'; // No scan data

      if (item.scanData.status === 'completed') {
        if (item.scanData.vulnerabilityCount > 0) return 'mdi-alert-circle';
        return 'mdi-check-circle';
      }

      if (item.scanData.status === 'error') return 'mdi-close-circle';

      return 'mdi-help-circle'; // Default icon
    },

    hasScanResults(item) {
      return item.scanData &&
             item.scanData.status === 'completed' &&
             item.scanData.vulnerabilityCount > 0;
    },

    getVulnerabilityCount(item) {
      if (!this.hasScanResults(item)) return 0;
      return item.scanData.vulnerabilityCount;
    },

    getVulnerabilityColor(item) {
      if (!this.hasScanResults(item)) return 'grey';

      const count = item.scanData.vulnerabilityCount;
      if (count > 10) return 'error';
      if (count > 5) return 'warning';
      return 'info';
    },

    getScanTooltip(item) {
        // Always check active scan state first
        if (this.isScanning(item.application)) {
          const progress = this.getScanProgress(item.application);
          if (progress === 0) {
            return 'Scan pending... waiting for engine';
          }
          return `Scan in progress... ${Math.round(progress)}%`;
        }

        // Check if scan failed (from store's activeScans)
        if (this.isScanFailed(item.application)) {
          const error = this.getFailedScanError(item.application);
          return `Scan failed: ${error || 'Unknown error'}`;
        }

        if (!item.scanData) return 'No scan performed';

        if (item.scanData.status === 'completed') {
          const count = item.scanData.vulnerabilityCount;
          if (count === 0) {
            return 'Scan completed. No vulnerabilities found.';
          }
          return `Scan completed. Found ${count} ${count === 1 ? 'vulnerability' : 'vulnerabilities'} across ${item.scanData.issueCategories} categories.`;
        }

        if (item.scanData.status === 'error') return `Scan failed: ${item.scanData.errorMessage || 'Unknown error'}`;

        if (item.scanData.status === 'in_progress') return 'Scan in progress...';

        if (item.scanData.status === 'not_found') return 'No scan has been performed yet';

        return 'No scan data available';
      },
    async viewDecompiledClasses(application) {
      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/ios/classes/${application}`);
        this.objcClasses = response.data.objc_classes;
        this.swiftClasses = response.data.swift_classes;
        this.classesDialog = true;
      } catch (error) {
        console.error('Error fetching decompiled classes:', error);
      }
    },

    async viewReceivers(filename, type) {
      const item = this.items.find(i => i.application === filename);
      if (item) {
        item.isLoadingReceivers = true;
      }
      try {
        this.currentFilename = filename;
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/audit/receivers/${filename}`);
        this.receiversList.exported = response.data.exported.map(name => ({
          name,
          intentFilters: response.data.intent_filters[name] || []
        }));
        this.receiversList.non_exported = response.data.non_exported.map(name => ({
          name,
          intentFilters: response.data.intent_filters[name] || []
        }));
        this.receiversTab = type;
        this.receiversDialog = true;
      } catch (error) {
        const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
        this.showSnackbar(`Error fetching receivers: ${errorMessage}`, 'error');
      } finally {
        if (item) {
          item.isLoadingReceivers = false;
        }
      }
    },

    async viewManifest(filename) {
      this.currentFilename = filename;
      this.manifestDialog = true;
    },

    async viewPermissions(filename, type = 'audit') {
      try {
        this.permissionsAppId = filename;
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/${type}/permissions/${filename}`);
        this.permissionsContent = JSON.stringify(response.data, null, 2);
        this.permissionsDialog = true;
      } catch (error) {
        console.error(`Error fetching ${type} permissions:`, error);
      }
    },

    async viewVulnerabilities(filename) {
      console.log('Navigating to vulnerabilities with filename:', filename);
      try {
        this.$router.push({ path: `/vulnerabilities/${filename}` });
      } catch (error) {
        console.error('Error Fetching Vulns: ', error);
      }
    },

    // opts: { engine?: 'jadx'|'vineflower', force?: boolean, resources?: boolean }
    // When engine is omitted, the global preference (store getter) is used, so the
    // default decompile button keeps working as JADX unless the user changed it.
    // resources defaults to the global preference; the backend ignores it for jadx.
    async decompileItem(item, opts = {}) {
      const engine = opts.engine || this.decompilerEngine;
      const force = opts.force === true;
      const resources = opts.resources !== undefined ? opts.resources : this.decompilerResources;
      try {
        console.log(`Decompiling item: ${item.application} (engine: ${engine}, force: ${force}, resources: ${resources})`);
        item.isDecompiling = true;
        if (force) {
          item.isDecompiled = false;
          item.lastEngine = null;
        }
        const data = await engineApi.decompile(item.application, { engine, force, resources });
        console.log('Decompile response:', data);

        this.snackbarText = `Decompilation started for ${item.application} (${engine})`;
        this.snackbarColor = 'info';
        this.snackbar = true;

        await this.pollDecompileStatus(data.task_id, item, engine);
      } catch (error) {
        console.error('Error decompiling item:', error);
        this.snackbarText = `Error starting decompilation for ${item.application}`;
        this.snackbarColor = 'error';
        this.snackbar = true;
      } finally {
        item.isDecompiling = false; // Reset the loading state
      }
    },

    async pollDecompileStatus(taskId, item, engine = null) {
      try {
        const data = await engineApi.decompileStatus(taskId);
        if (data.state === 'SUCCESS') {
          console.log('Decompilation completed:', data);
          item.isDecompiled = true;
          if (engine) item.lastEngine = engine;
          this.snackbarText = `${item.application} was decompiled successfully${engine ? ` (${engine})` : ''}`;
          this.snackbarColor = 'success';
          this.snackbar = true;
          // Refresh decompiled state from the backend marker so the app reflects
          // whatever engine was actually last used (authoritative engine/resources).
          try {
            const check = await engineApi.decompileCheck(item.application);
            item.isDecompiled = !!check.decompiled;
            if (check.engine) item.lastEngine = check.engine;
          } catch (e) {
            // non-fatal: item.isDecompiled / lastEngine already set from the known engine above
          }
        } else if (data.state === 'FAILURE') {
          console.error('Decompilation failed:', data);
          this.snackbarText = `Error decompiling ${item.application}: ${data.error}`;
          this.snackbarColor = 'error';
          this.snackbar = true;
        } else {
          // Still in progress, poll again after a delay
          await new Promise(resolve => setTimeout(resolve, 5000));
          await this.pollDecompileStatus(taskId, item, engine);
        }
      } catch (error) {
        console.error('Error polling decompile status:', error);
        this.snackbarText = `Error checking decompile status for ${item.application}`;
        this.snackbarColor = 'error';
        this.snackbar = true;
      } finally {
        item.isDecompiling = false; // Ensure loading state is reset
      }
    },

    async viewEntitlements(filename) {
      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/ios/entitlements/${filename}`);
        this.entitlementsContent = response.data.entitlements;
        this.entitlementsDialog = true;
      } catch (error) {
        console.error('Error fetching entitlements:', error);
      }
    },

    async viewPlist(filename) {
      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/ios/plist/${filename}`);
        this.plistContent = JSON.stringify(response.data.plist, null, 2);
        this.plistDialog = true;
      } catch (error) {
        console.error('Error fetching plist:', error);
      }
    },

    async viewServices(application, type) {
      const item = this.items.find(i => i.application === application);
      if (item) {
        item.isLoadingServices = true;
      }
      try {
        this.currentFilename = application;
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/audit/services/${application}`);
        this.servicesList = response.data;
        this.servicesTab = type;
        this.servicesDialog = true;
      } catch (error) {
        console.error('Error fetching services:', error);
        this.showSnackbar('Error fetching services - No Services found', 'error');
      } finally {
        if (item) {
          item.isLoadingServices = false;
        }
      }
    },

    async viewProviders(application) {
      const item = this.items.find(i => i.application === application);
      if (item) {
        item.isLoadingProviders = true;
      }
      try {
        this.currentFilename = application;
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/audit/providers/${application}`);
        this.providersList.exported = response.data.exported.map(name => ({
          name,
          ...response.data.providers[name]
        }));
        this.providersList.non_exported = response.data.non_exported.map(name => ({
          name,
          ...response.data.providers[name]
        }));
        this.providersDialog = true;
      } catch (error) {
        console.error('Error fetching providers', error);
        this.showSnackbar('Error fetching providers', 'error');
      } finally {
        if (item) {
          item.isLoadingProviders = false;
        }
      }
    },

    async viewActivities(application, type) {
      const item = this.items.find(i => i.application === application);
      if (item) {
        item.isLoadingActivities = true;
      }
      try {
        this.currentFilename = application;
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/audit/activities/${application}`);
        this.activitiesList.exported = response.data.exported.map(name => ({
          name,
          intentFilters: response.data.intent_filters[name] || []
        }));
        this.activitiesList.non_exported = response.data.non_exported.map(name => ({
          name,
          intentFilters: response.data.intent_filters[name] || []
        }));
        this.activitiesTab = type;
        this.activitiesDialog = true;
      } catch (error) {
        console.error('Error fetching activities:', error);
        this.showSnackbar('Error fetching activities', 'error');
      } finally {
        if (item) {
          item.isLoadingActivities = false;
        }
      }
    },

    async viewBinary(application, type) {
      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/ios/${type}/${application}`);
        if (type === 'exports') {
          this.jsonData = response.data.exports;
          this.exportsDialog = true;
        } else if (type === 'imports') {
          this.jsonDataImports = JSON.stringify(response.data.imports, null, 2); // Pretty-print JSON
          this.importsDialog = true;
        }
      } catch (error) {
        console.error(`Error fetching ${type} for ${application}:`, error);
      }
    },

    async viewInfo(filename) {
      const item = this.items.find(i => i.application === filename);
      if (item) {
        item.isLoadingInfo = true;
      }

      // Set loading state for the InfoSection component
      this.loadingStates.info = true;

      // Open dialog immediately with loading state
      this.currentFile = filename;
      this.infoDialog = true;

      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/ios/info/${filename}`);
        this.infoContent = response.data.info;
        this.fileInfo = response.data.file_info;
        this.encryptionInfo = response.data.encryption_info;
        this.segmentsContent = response.data.segments;
        this.loadCommandsContent = response.data.load_commands;
        this.sectionsContent = response.data.sections;
        this.deepLinks = response.data.links || { url_schemes: [], universal_links: [], queried_schemes: [] };
      } catch (error) {
        console.error('Error fetching info:', error);
        this.showSnackbar('Error fetching information', 'error');
      } finally {
        if (item) {
          item.isLoadingInfo = false;
        }
        // Clear loading state for InfoSection component
        this.loadingStates.info = false;
      }
    },

    async viewSymbols(filename) {
      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/ios/symbols/${filename}`);
        this.symbolsList = response.data;
        this.symbolsDialog = true;
      } catch (error) {
        console.error('Error fetching symbols:', error);
      }
    },

    async viewFunctions(filename) {
      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/ios/functions/${filename}`);
        this.functionsList = response.data.functions;
        this.currentFilename = filename;
        this.functionsDialog = true;
      } catch (error) {
        console.error('Error fetching functions:', error);
      }
    },

    async dumpStrings(filename) {
      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/ios/strings/${filename}`);
        this.stringsContent = response.data.strings;
        this.stringSearchQuery = ''; // Reset search
        this.currentPage = 1; // Reset pagination
        this.stringsDialog = true;
        nextTick(() => {
          Prism.highlightAll();
        });
      } catch (error) {
        console.error('Error dumping strings:', error);
      }
    },

    actualIndex(pageIndex) {
      return (this.currentPage - 1) * this.stringsPerPage + pageIndex + 1;
    },

    async copyStringToClipboard(text) {
      try {
        await navigator.clipboard.writeText(text);
      } catch (err) {
        console.error('Failed to copy: ', err);
      }
    },

    exportAllStrings() {
      const content = this.filteredStringContent.join('\n');
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `strings_${Date.now()}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },

    async syncActiveScansFromBackend() {
      try {
        const resp = await axios.get(`${import.meta.env.VITE_APP_API_URL}/engine/scan-tasks/active`);
        const active = resp?.data?.active_scans || [];

        // Ensure any backend-active scans are present in the store so isScanning() stays true.
        for (const t of active) {
          const filename = t.filename;
          // If already marked scanning locally, keep it.
          if (this.isScanning(filename)) continue;

          // Use best identifier: celery_task_id if known, else guid.
          const id = t.celery_task_id || t.guid;
          if (!id) continue;

          console.log(`[syncActiveScansFromBackend] restoring scan indicator for ${filename} (id=${id}, status=${t.status})`);

          // Mark as scanning locally. pollers will take over via resumeActiveScans().
          this.startScan({ taskId: id, filename });
        }
      } catch (e) {
        // Non-fatal (e.g., backend down during startup)
        console.warn('[syncActiveScansFromBackend] failed:', e?.message || e);
      }
    },

    // Helpers for classifying APK "user" based on parsed manifest/sharedUserId string.
    _androidUserString(filename) {
      const itemData = this.expandedItemData?.[filename];
      const val = itemData?.AndroidUser;
      return (typeof val === 'string' ? val : '').toLowerCase();
    },

    // Single classifier — returns { label, icon, color, tooltip, tier }
    // tier: 3=critical, 2=high, 1=elevated, 0=normal
    getAndroidUserClass(filename) {
      const u = this._androidUserString(filename);
      if (!u) return { label: 'Normal', icon: 'mdi-shield-check', color: 'success', tooltip: 'Standard app permissions', tier: 0 };

      const CLASSES = [
        // tier 3 — system-level privileges
        { match: ['uid.system', 'android.uid.system'],          label: 'System',       icon: 'mdi-shield-alert',       color: 'error',   tier: 3, tooltip: 'High-value target: Has system privileges' },
        { match: ['uid.phone', 'android.uid.phone'],            label: 'Phone',        icon: 'mdi-phone-lock',         color: 'error',   tier: 3, tooltip: 'Telephony UID: full access to call/SMS stack' },
        { match: ['uid.bluetooth', 'android.uid.bluetooth'],    label: 'Bluetooth',    icon: 'mdi-bluetooth',          color: 'error',   tier: 3, tooltip: 'Bluetooth stack UID: can control BT hardware' },
        { match: ['uid.nfc', 'android.uid.nfc'],                label: 'NFC',          icon: 'mdi-nfc',                color: 'error',   tier: 3, tooltip: 'NFC stack UID: direct NFC hardware access' },
        { match: ['uid.wifi', 'android.uid.wifi'],              label: 'WiFi',         icon: 'mdi-wifi-lock',          color: 'error',   tier: 3, tooltip: 'WiFi stack UID: can reconfigure network interfaces' },
        // tier 2 — elevated, non-system
        { match: ['uid.shell', 'android.uid.shell'],            label: 'Shell',        icon: 'mdi-console',            color: 'warning', tier: 2, tooltip: 'Shell UID: verify install/signing context' },
        { match: ['uid.audioserver', 'android.uid.audioserver'],label: 'Audio Server', icon: 'mdi-speaker',            color: 'warning', tier: 2, tooltip: 'Audio server UID: access to audio hardware' },
        { match: ['uid.cameraserver', 'android.uid.cameraserver'], label: 'Cam Server',icon: 'mdi-camera-lock',        color: 'warning', tier: 2, tooltip: 'Camera server UID: direct camera hardware access' },
        { match: ['uid.drm', 'android.uid.drm'],                label: 'DRM',          icon: 'mdi-lock-check',         color: 'warning', tier: 2, tooltip: 'DRM UID: access to protected content decryption' },
        { match: ['uid.gps', 'android.uid.gps'],                label: 'GPS',          icon: 'mdi-crosshairs-gps',     color: 'warning', tier: 2, tooltip: 'GPS UID: direct location hardware access' },
        { match: ['uid.cmhservice', 'android.uid.cmhservice'],  label: 'CMH Service',  icon: 'mdi-chip',               color: 'warning', tier: 2, tooltip: 'Vendor CMH service UID: OEM/modem privileged process' },
        // tier 1 — media/logging
        { match: ['uid.media', 'android.uid.media'],            label: 'Media',        icon: 'mdi-music',              color: 'info',    tier: 1, tooltip: 'Media UID: access to media framework surface' },
        { match: ['uid.log', 'android.uid.log'],                label: 'Log',          icon: 'mdi-text-box-outline',   color: 'info',    tier: 1, tooltip: 'Log UID: read access to system logs' },
      ];

      for (const cls of CLASSES) {
        if (cls.match.some(m => u.includes(m))) return cls;
      }
      return { label: 'Normal', icon: 'mdi-shield-check', color: 'success', tooltip: 'Standard app permissions', tier: 0 };
    },

    // Kept for backward compatibility with sort/rank logic
    isSystemApp(filename)  { return this.getAndroidUserClass(filename).tier === 3; },
    isShellApp(filename)   { const c = this.getAndroidUserClass(filename); return c.tier === 2 && c.label === 'Shell'; },
    isMediaApp(filename)   { const c = this.getAndroidUserClass(filename); return c.tier === 1 && c.label === 'Media'; },

    getUserTierRank(filename) {
      return this.getAndroidUserClass(filename).tier;
    },

    toggleUserSort() {
      // Cycle through: none -> system -> normal -> none
      if (this.userSortOrder === 'none') {
        this.userSortOrder = 'system';
      } else if (this.userSortOrder === 'system') {
        this.userSortOrder = 'normal';
      } else {
        this.userSortOrder = 'none';
      }
    },

    toggleVulnSort() {
      // Toggle between highest first (false) and lowest first (true)
      this.vulnSortAsc = !this.vulnSortAsc;
    },

    getScanSortKey(item) {
      const filename = item?.application;

      // If we ever show scanning status for this item, keep it on top.
      if (filename && this.isScanning(filename)) {
        return { priority: 3, vulns: 0 };
      }

      // Completed scans should be ranked by vuln count.
      const vulnCount = Number(item?.scanData?.vulnerabilityCount);
      const hasVulnCount = Number.isFinite(vulnCount);

      if (item?.scanData?.status === 'completed') {
        return { priority: 2, vulns: hasVulnCount ? vulnCount : 0 };
      }

      // Failed/error scans next
      if (item?.scanData?.status === 'error' || (filename && this.isScanFailed(filename))) {
        return { priority: 1, vulns: 0 };
      }

      // Not scanned / unknown last
      return { priority: 0, vulns: 0 };
    },
  }
});
</script>


<style scoped>
/* Clickable header styles */
.clickable-header {
  transition: opacity 0.2s ease;
}

.clickable-header:hover {
  opacity: 0.7;
}

/* String Dialog Improvements */
.string-item .v-card {
  transition: all 0.2s ease;
  cursor: pointer;
}

.string-item .v-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
}

.string-index {
  font-size: 0.8rem;
  color: #666;
  font-weight: bold;
  min-width: 40px;
}

.string-value {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9rem;
  word-break: break-word;
  line-height: 1.4;
}

.theme--dark {
  background-color: #121212;
  color: #ffffff;
}

.theme--light {
  background-color: #ffffff;
  color: #000000;
}

.expanded-row {
  padding: 0 !important;
}

.expanded-row-content {
  display: flex;
  justify-content: space-between;
  padding: 16px;
}

.expanded-field {
  margin-right: 16px;
}

.code-box {
  background-color: #272822;
  color: #a6e22e;
  padding: 8px;
  margin: 4px 0;
  border-radius: 4px;
  font-family: monospace;
  white-space: pre-wrap;
}

.btn-dark {
  background-color: #424242 !important;
  color: #ffffff !important;
}

.input-dark .v-input__control {
  background-color: #424242 !important;
  color: #ffffff !important;
}

.scan-status-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.system-uid-highlight {
  color: #ff5252;
  font-weight: bold;
}

/* Add smooth transitions for scan status */
.v-progress-circular {
  transition: all 0.3s ease;
}

.v-icon {
  transition: color 0.3s ease;
}

/* Clean upload toolbar styling */
.upload-toolbar {
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  min-height: 64px;
  padding: 0 24px;
}

.upload-toolbar.theme--dark {
  border-bottom-color: rgba(255, 255, 255, 0.12);
}

.section-title {
  font-weight: 600;
  font-size: 1.25rem;
}

.upload-section {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: nowrap;
}

.file-input {
  min-width: 240px;
  max-width: 280px;
}

.file-input--dark {
  --v-field-bg: #424242;
  --v-theme-surface: #424242;
}

.search-field {
  min-width: 180px;
  max-width: 220px;
}

.upload-btn {
  min-width: 140px;
  height: 40px;
  text-transform: none;
  font-weight: 500;
}

/* Fix horizontal scrollbar in data table */
:deep(.v-data-table) {
  overflow-x: hidden;
}

:deep(.v-data-table__wrapper) {
  overflow-x: auto;
  /* Show a modern thin scrollbar instead of fully hiding it */
  scrollbar-width: thin; /* Firefox */
  scrollbar-color: rgba(120, 120, 120, 0.55) transparent; /* Firefox */
}

/* WebKit scrollbar styling (Chrome/Safari/Edge) */
:deep(.v-data-table__wrapper::-webkit-scrollbar) {
  height: 10px;
}

:deep(.v-data-table__wrapper::-webkit-scrollbar-track) {
  background: transparent;
}

:deep(.v-data-table__wrapper::-webkit-scrollbar-thumb) {
  background-color: rgba(120, 120, 120, 0.55);
  border-radius: 999px;
  border: 2px solid transparent; /* creates padding around thumb */
  background-clip: content-box;
}

:deep(.v-data-table__wrapper::-webkit-scrollbar-thumb:hover) {
  background-color: rgba(120, 120, 120, 0.8);
}

/* Theme polish */
.theme--dark :deep(.v-data-table__wrapper) {
  scrollbar-color: rgba(200, 200, 200, 0.35) transparent;
}

.theme--dark :deep(.v-data-table__wrapper::-webkit-scrollbar-thumb) {
  background-color: rgba(200, 200, 200, 0.35);
}

.theme--dark :deep(.v-data-table__wrapper::-webkit-scrollbar-thumb:hover) {
  background-color: rgba(200, 200, 200, 0.55);
}

@media (max-width: 900px) {
  .upload-section {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    min-width: 200px;
  }

  .file-input {
    min-width: auto;
    max-width: none;
  }

  .upload-btn {
    align-self: stretch;
  }

  .search-field {
    min-width: 150px;
    max-width: 180px;
  }
}

@media (max-width: 600px) {
  .upload-toolbar {
    flex-direction: column;
    align-items: stretch;
    min-height: auto;
    padding: 16px;
  }

  .search-field {
    min-width: auto;
    max-width: none;
  }

  .section-title {
    margin-bottom: 12px;
  }

  .upload-section {
    width: 100%;
  }
}

/* Enhanced dark theme support */
.theme--dark .file-input {
  color: #ffffff;
}

.theme--dark .upload-btn {
  color: #ffffff;
}

/* Section separation styling */
.v-card.mb-5 {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
}

.theme--dark .v-card.mb-5 {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

/* Strings Dialog Dark/Light Theme Support */
.strings-container {
  max-height: 400px;
  overflow-y: auto;
  border-radius: 8px;
}

.theme--dark .strings-container {
  background-color: #1e1e1e;
}

.theme--light .strings-container {
  background-color: #ffffff;
}

.theme--dark .string-card {
  background-color: #2d2d2d !important;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.theme--light .string-card {
  background-color: #ffffff !important;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.theme--dark .string-card:hover {
  background-color: #363636 !important;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.theme--light .string-card:hover {
  background-color: #f8fafc !important;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.theme--dark .string-index {
  color: rgba(255, 255, 255, 0.7);
}

.theme--light .string-index {
  color: #666;
}

.theme--dark .string-value {
  color: #ffffff;
  background-color: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
}

.theme--light .string-value {
  color: #000000;
  background-color: rgba(248, 250, 252, 0.8);
  border: 1px solid rgba(0, 0, 0, 0.05);
  padding: 4px 8px;
  border-radius: 4px;
}

.theme--dark .strings-search-field {
  --v-field-bg: #2d2d2d;
  --v-theme-surface: #2d2d2d;
}

.theme--light .strings-search-field {
  --v-field-bg: #ffffff;
  --v-theme-surface: #ffffff;
}

.theme--dark .strings-search-field .v-field__input {
  color: #ffffff;
}

.theme--light .strings-search-field .v-field__input {
  color: #000000;
}

.theme--dark .strings-select {
  --v-field-bg: #2d2d2d;
  --v-theme-surface: #2d2d2d;
}

.theme--light .strings-select {
  --v-field-bg: #ffffff;
  --v-theme-surface: #ffffff;
}

.theme--dark .strings-select .v-field__input {
  color: #ffffff;
}

.theme--light .strings-select .v-field__input {
  color: #000000;
}

.theme--dark .strings-pagination {
  --v-theme-surface: #2d2d2d;
}

.theme--light .strings-pagination {
  --v-theme-surface: #ffffff;
}

.theme--dark .strings-pagination .v-btn {
  color: #ffffff;
}

.theme--light .strings-pagination .v-btn {
  color: #000000;
}

.theme--dark .strings-loading {
  color: #ffffff;
}

.theme--light .strings-loading {
  color: #000000;
}

.theme--dark .strings-actions {
  background-color: #262626;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.theme--light .strings-actions {
  background-color: #f8fafc;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

/* Fix horizontal scrollbar in data table */
:deep(.v-data-table) {
  overflow-x: hidden;
}

:deep(.v-data-table__wrapper) {
  overflow-x: auto;
  /* Show a modern thin scrollbar instead of fully hiding it */
  scrollbar-width: thin; /* Firefox */
  scrollbar-color: rgba(120, 120, 120, 0.55) transparent; /* Firefox */
}

/* WebKit scrollbar styling (Chrome/Safari/Edge) */
:deep(.v-data-table__wrapper::-webkit-scrollbar) {
  height: 10px;
}

:deep(.v-data-table__wrapper::-webkit-scrollbar-track) {
  background: transparent;
}

:deep(.v-data-table__wrapper::-webkit-scrollbar-thumb) {
  background-color: rgba(120, 120, 120, 0.55);
  border-radius: 999px;
  border: 2px solid transparent; /* creates padding around thumb */
  background-clip: content-box;
}

:deep(.v-data-table__wrapper::-webkit-scrollbar-thumb:hover) {
  background-color: rgba(120, 120, 120, 0.8);
}

/* Theme polish */
.theme--dark :deep(.v-data-table__wrapper) {
  scrollbar-color: rgba(200, 200, 200, 0.35) transparent;
}

.theme--dark :deep(.v-data-table__wrapper::-webkit-scrollbar-thumb) {
  background-color: rgba(200, 200, 200, 0.35);
}

.theme--dark :deep(.v-data-table__wrapper::-webkit-scrollbar-thumb:hover) {
  background-color: rgba(200, 200, 200, 0.55);
}
</style>
