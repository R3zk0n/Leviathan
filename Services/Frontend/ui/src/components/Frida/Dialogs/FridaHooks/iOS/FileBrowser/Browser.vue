<template>
  <div class="file-browser">
    <!-- Header / Toolbar -->
    <div class="browser-header">
      <div class="nav-controls">
        <v-btn icon size="small" @click="navigateBack" :disabled="pathHistory.length === 0">
          <v-icon>mdi-arrow-left</v-icon>
        </v-btn>
        <v-btn icon size="small" @click="navigateToParent" :disabled="!currentPath || currentPath === '/'">
          <v-icon>mdi-arrow-up</v-icon>
        </v-btn>
        <v-btn icon size="small" @click="navigateToHome" :disabled="!appPaths || appPaths.length === 0">
          <v-icon>mdi-home</v-icon>
        </v-btn>
        <v-btn icon size="small" @click="refreshCurrentDirectory" :loading="loading">
          <v-icon>mdi-refresh</v-icon>
        </v-btn>
      </div>

      <!-- Path input -->
      <v-text-field
        v-model="editablePath"
        variant="outlined"
        density="compact"
        hide-details
        class="path-field"
        @keyup.enter="navigateToPath(editablePath)"
      >
        <template v-slot:prepend-inner>
          <v-icon size="small">mdi-folder</v-icon>
        </template>
      </v-text-field>

      <v-text-field
        v-model="searchTerm"
        placeholder="Filter..."
        variant="outlined"
        density="compact"
        hide-details
        clearable
        class="filter-field"
        style="max-width: 200px;"
      >
        <template v-slot:prepend-inner>
          <v-icon size="small">mdi-filter</v-icon>
        </template>
      </v-text-field>

      <!-- Action buttons -->
      <v-btn size="small" variant="outlined" @click="showSearchPanel = !showSearchPanel">
        <v-icon start>mdi-magnify</v-icon>
        <span class="fb-btn-label">Search</span>
      </v-btn>
      <v-btn size="small" variant="outlined" @click="showUploadDialog = true">
        <v-icon start>mdi-upload</v-icon>
        <span class="fb-btn-label">Upload</span>
      </v-btn>
      <v-btn size="small" variant="outlined" @click="showCreateDirDialog = true">
        <v-icon start>mdi-folder-plus</v-icon>
        <span class="fb-btn-label">New Dir</span>
      </v-btn>

      <v-spacer />

      <!-- View toggle -->
      <v-btn-toggle v-model="viewMode" mandatory variant="outlined" density="compact">
        <v-btn value="list" size="small"><v-icon>mdi-view-list</v-icon></v-btn>
        <v-btn value="grid" size="small"><v-icon>mdi-view-grid</v-icon></v-btn>
      </v-btn-toggle>

      <v-menu>
        <template v-slot:activator="{ props: menuProps }">
          <v-btn icon size="small" v-bind="menuProps">
            <v-icon>mdi-dots-vertical</v-icon>
          </v-btn>
        </template>
        <v-list density="compact">
          <v-list-item @click="showHidden = !showHidden">
            <template v-slot:prepend>
              <v-icon>{{ showHidden ? 'mdi-eye-off' : 'mdi-eye' }}</v-icon>
            </template>
            <v-list-item-title>{{ showHidden ? 'Hide' : 'Show' }} hidden files</v-list-item-title>
          </v-list-item>
          <v-list-item @click="selectAll">
            <template v-slot:prepend><v-icon>mdi-select-all</v-icon></template>
            <v-list-item-title>Select All</v-list-item-title>
          </v-list-item>
          <v-list-item @click="clearSelection">
            <template v-slot:prepend><v-icon>mdi-selection-off</v-icon></template>
            <v-list-item-title>Clear Selection</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </div>

    <!-- Breadcrumb -->
    <div class="breadcrumb-bar" v-if="currentPath">
      <v-breadcrumbs :items="breadcrumbItems" density="compact">
        <template v-slot:prepend>
          <v-icon size="small">mdi-folder-open</v-icon>
        </template>
      </v-breadcrumbs>
    </div>

    <!-- Quick Access -->
    <div class="quick-access" v-if="quickAccessPaths.length > 0">
      <v-chip-group>
        <v-chip
          v-for="qp in quickAccessPaths"
          :key="qp.path"
          @click="navigateToPath(qp.path)"
          :color="qp.color"
          variant="outlined"
          size="small"
        >
          <v-icon start size="small">{{ qp.icon }}</v-icon>
          {{ qp.name }}
        </v-chip>
      </v-chip-group>
    </div>

    <!-- Search Panel -->
    <v-expand-transition>
      <div v-if="showSearchPanel" class="search-panel">
        <v-card variant="outlined" class="pa-3">
          <div class="d-flex align-center gap-2 mb-2">
            <v-text-field
              v-model="searchBasePath"
              :placeholder="currentPath || '/'"
              label="Base Path"
              variant="outlined"
              density="compact"
              hide-details
              style="max-width: 300px;"
            />
            <v-text-field
              v-model="searchPattern"
              placeholder="*.db"
              label="Pattern"
              variant="outlined"
              density="compact"
              hide-details
              style="max-width: 200px;"
              @keyup.enter="searchFiles"
            />
            <v-text-field
              v-model.number="searchMaxDepth"
              label="Depth"
              type="number"
              variant="outlined"
              density="compact"
              hide-details
              style="max-width: 80px;"
            />
            <v-btn color="primary" @click="searchFiles" :loading="searchLoading" size="small">
              <v-icon start>mdi-magnify</v-icon> Search
            </v-btn>
            <v-btn size="small" variant="text" @click="showSearchPanel = false">
              <v-icon>mdi-close</v-icon>
            </v-btn>
          </div>
          <!-- Presets -->
          <div class="d-flex gap-1 flex-wrap">
            <v-chip
              v-for="preset in searchPresets"
              :key="preset.pattern"
              size="x-small"
              variant="outlined"
              @click="searchPattern = preset.pattern; searchFiles()"
            >
              {{ preset.label }}
            </v-chip>
          </div>
          <!-- Search Results -->
          <div v-if="searchResults.length > 0" class="search-results mt-3">
            <div class="text-caption text-grey mb-1">
              {{ searchResults.length }} results{{ searchTruncated ? ' (truncated)' : '' }}
            </div>
            <v-list density="compact" class="search-results-list">
              <v-list-item
                v-for="sr in searchResults"
                :key="sr.path"
                @click="sr.isDirectory ? navigateToPath(sr.path) : openFileViewer(sr)"
                class="search-result-item"
              >
                <template v-slot:prepend>
                  <v-icon :color="getFileIconColor(sr)" size="small">{{ getFileIcon(sr) }}</v-icon>
                </template>
                <v-list-item-title class="text-body-2">{{ sr.name }}</v-list-item-title>
                <v-list-item-subtitle class="text-caption">{{ sr.path }}</v-list-item-subtitle>
                <template v-slot:append>
                  <span class="text-caption text-grey">{{ sr.isDirectory ? '—' : formatFileSize(sr.size) }}</span>
                </template>
              </v-list-item>
            </v-list>
          </div>
        </v-card>
      </div>
    </v-expand-transition>

    <!-- Selection Actions Bar -->
    <div class="selection-bar" v-if="selectedItems.size > 0">
      <v-card variant="outlined" class="pa-2">
        <div class="d-flex align-center">
          <span class="text-body-2">{{ selectedItems.size }} item(s) selected</span>
          <v-spacer />
          <v-btn size="small" @click="downloadMultipleFiles" :disabled="selectedFiles.length === 0">
            <v-icon start>mdi-download</v-icon> Download Selected
          </v-btn>
          <v-btn size="small" @click="clearSelection" variant="outlined" class="ml-2">Clear</v-btn>
        </div>
      </v-card>
    </div>

    <!-- Truncation Warning -->
    <v-alert v-if="truncated" type="warning" density="compact" class="mb-3" variant="tonal">
      Directory has more than 500 entries. Showing first {{ directoryContents.length }} of {{ totalEntries }}.
    </v-alert>

    <!-- Loading -->
    <div v-if="loading" class="loading-container">
      <v-progress-circular indeterminate color="primary" size="48" />
      <div class="mt-3 text-body-1">Loading directory...</div>
    </div>

    <!-- File List View -->
    <div v-else-if="viewMode === 'list' && filteredAndSortedItems.length > 0" class="file-list">
      <v-data-table
        :headers="listHeaders"
        :items="filteredAndSortedItems"
        item-key="path"
        class="filesystem-table"
        density="compact"
        show-select
        v-model="selectedTableItems"
        @click:row="(event, { item }) => handleItemClick(item)"
      >
        <!-- Clickable sort headers driven by the composable (keeps directories-first) -->
        <template v-slot:header.name="{ column }">
          <button type="button" class="fb-sort-btn" @click="toggleSort('name')">
            {{ column.title }}
            <v-icon size="14" v-if="sortBy === 'name'">{{ sortOrder === 'asc' ? 'mdi-arrow-up' : 'mdi-arrow-down' }}</v-icon>
          </button>
        </template>
        <template v-slot:header.size="{ column }">
          <button type="button" class="fb-sort-btn" @click="toggleSort('size')">
            {{ column.title }}
            <v-icon size="14" v-if="sortBy === 'size'">{{ sortOrder === 'asc' ? 'mdi-arrow-up' : 'mdi-arrow-down' }}</v-icon>
          </button>
        </template>
        <template v-slot:header.modified="{ column }">
          <button type="button" class="fb-sort-btn" @click="toggleSort('modified')">
            {{ column.title }}
            <v-icon size="14" v-if="sortBy === 'date'">{{ sortOrder === 'asc' ? 'mdi-arrow-up' : 'mdi-arrow-down' }}</v-icon>
          </button>
        </template>

        <template v-slot:item.name="{ item }">
          <div class="d-flex align-center">
            <v-icon :color="getFileIconColor(item)" class="mr-2" size="small">
              {{ getFileIcon(item) }}
            </v-icon>
            <div>
              <div class="d-flex align-center gap-1">
                <span class="font-weight-medium">{{ item.name }}</span>
                <v-icon
                  v-if="getSecurityFlag(item)"
                  :color="getSecurityFlag(item).risk === 'high' ? 'red' : 'orange'"
                  size="x-small"
                >
                  mdi-shield-alert
                </v-icon>
                <v-chip
                  v-if="getSecurityFlag(item)"
                  :color="getSecurityFlag(item).risk === 'high' ? 'red' : 'orange'"
                  size="x-small"
                  variant="tonal"
                >
                  {{ getSecurityFlag(item).label }}
                </v-chip>
              </div>
            </div>
          </div>
        </template>

        <template v-slot:item.size="{ item }">
          {{ item.isDirectory ? '—' : formatFileSize(item.size) }}
        </template>

        <template v-slot:item.modified="{ item }">
          {{ formatDate(item.modified || item.modificationDate) }}
        </template>

        <template v-slot:item.permissions="{ item }">
          <span v-if="item.permissions" class="text-caption font-weight-medium" style="font-family: monospace;">
            {{ formatPermissions(item.permissions) }}
          </span>
          <span v-else class="text-grey text-caption">—</span>
        </template>

        <template v-slot:item.actions="{ item }">
          <v-menu>
            <template v-slot:activator="{ props: menuProps }">
              <v-btn icon size="x-small" variant="text" v-bind="menuProps" @click.stop>
                <v-icon size="small">mdi-dots-vertical</v-icon>
              </v-btn>
            </template>
            <v-list density="compact">
              <v-list-item v-if="!item.isDirectory" @click="openFileViewer(item)">
                <template v-slot:prepend><v-icon size="small">mdi-eye</v-icon></template>
                <v-list-item-title>View</v-list-item-title>
              </v-list-item>
              <v-list-item v-if="!item.isDirectory" @click="downloadFile(item)">
                <template v-slot:prepend><v-icon size="small">mdi-download</v-icon></template>
                <v-list-item-title>Download</v-list-item-title>
              </v-list-item>
              <v-list-item @click="confirmDelete = item; showDeleteConfirm = true">
                <template v-slot:prepend><v-icon size="small" color="red">mdi-delete</v-icon></template>
                <v-list-item-title class="text-red">Delete</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </template>
      </v-data-table>
    </div>

    <!-- Grid View -->
    <div v-else-if="viewMode === 'grid' && filteredAndSortedItems.length > 0" class="file-grid">
      <v-card
        v-for="item in filteredAndSortedItems"
        :key="item.path"
        class="file-card"
        :class="{ 'selected': selectedItems.has(item.path), 'security-flagged': getSecurityFlag(item) }"
        @click="handleItemClick(item)"
        @contextmenu="handleContextMenu($event, item)"
        hover
      >
        <v-card-text class="text-center pa-3">
          <v-icon :color="getFileIconColor(item)" size="40" class="mb-2">
            {{ getFileIcon(item) }}
          </v-icon>
          <div class="file-name">{{ item.name }}</div>
          <div class="text-caption text-grey">
            {{ item.isDirectory ? 'Folder' : formatFileSize(item.size) }}
          </div>
          <v-icon
            v-if="getSecurityFlag(item)"
            :color="getSecurityFlag(item).risk === 'high' ? 'red' : 'orange'"
            size="x-small"
            class="security-badge"
          >
            mdi-shield-alert
          </v-icon>
        </v-card-text>
        <v-checkbox
          :model-value="selectedItems.has(item.path)"
          @update:model-value="(v) => handleItemSelect(item, v)"
          class="file-checkbox"
          density="compact"
          hide-details
          @click.stop
        />
      </v-card>
    </div>

    <!-- Empty State -->
    <div v-else-if="!loading && directoryContents.length === 0" class="empty-state">
      <v-icon size="64" color="grey">mdi-folder-open</v-icon>
      <div class="mt-3 text-h6">Empty Directory</div>
      <div class="text-body-2 text-grey">This directory contains no files or folders</div>
      <v-btn color="primary" @click="refreshCurrentDirectory" class="mt-3" size="small">
        <v-icon start>mdi-refresh</v-icon> Refresh
      </v-btn>
    </div>

    <!-- No matches for the active filter (directory has items, but none pass the filter/hidden rules) -->
    <div
      v-else-if="!loading && directoryContents.length > 0 && filteredAndSortedItems.length === 0"
      class="empty-state"
    >
      <v-icon size="64" color="grey">mdi-file-search-outline</v-icon>
      <div class="mt-3 text-h6">No matching items</div>
      <div class="text-body-2 text-grey" v-if="searchTerm">Nothing matches "{{ searchTerm }}"</div>
      <div class="text-body-2 text-grey" v-else>All {{ directoryContents.length }} item(s) are hidden</div>
      <v-btn v-if="searchTerm" color="primary" @click="searchTerm = ''" class="mt-3" size="small" variant="text">
        <v-icon start>mdi-close</v-icon> Clear filter
      </v-btn>
      <v-btn v-else color="primary" @click="showHidden = true" class="mt-3" size="small" variant="text">
        <v-icon start>mdi-eye</v-icon> Show hidden files
      </v-btn>
    </div>

    <!-- Status bar -->
    <div class="status-bar" v-if="!loading">
      <span class="text-caption text-grey">
        {{ filteredAndSortedItems.length }} items
        <span v-if="platform"> | {{ platform }}</span>
        <span v-if="truncated"> | Truncated</span>
      </span>
    </div>

    <!-- ===== DIALOGS ===== -->

    <!-- File Viewer Dialog -->
    <v-dialog v-model="showFileViewer" max-width="900" scrollable class="fb-dialog-overlay">
      <v-card v-if="selectedFile" class="file-viewer-card fb-dialog-card">
        <v-card-title class="d-flex align-center pa-3">
          <v-icon :color="getFileIconColor(selectedFile)" class="mr-2" size="small">
            {{ getFileIcon(selectedFile) }}
          </v-icon>
          <span class="text-body-1 font-weight-medium">{{ selectedFile.name }}</span>
          <v-chip v-if="getSecurityFlag(selectedFile)" :color="getSecurityFlag(selectedFile).risk === 'high' ? 'red' : 'orange'" size="x-small" class="ml-2" variant="tonal">
            {{ getSecurityFlag(selectedFile).label }}
          </v-chip>
          <v-spacer />
          <v-btn icon size="small" variant="text" @click="showFileViewer = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>

        <v-divider />

        <v-card-text class="pa-4">
          <!-- File metadata -->
          <v-row dense>
            <v-col cols="12">
              <div class="info-label">Path</div>
              <div class="info-value">{{ selectedFile.path }}</div>
            </v-col>
            <v-col cols="4">
              <div class="info-label">Size</div>
              <div class="info-value">{{ formatFileSize(selectedFile.size) }}</div>
            </v-col>
            <v-col cols="4">
              <div class="info-label">Modified</div>
              <div class="info-value">{{ formatDate(selectedFile.modified || selectedFile.modificationDate) }}</div>
            </v-col>
            <v-col cols="4">
              <div class="info-label">Permissions</div>
              <div class="info-value">{{ formatPermissions(selectedFile.permissions || fileInfo?.posixPermissions) }}</div>
            </v-col>
            <v-col cols="4" v-if="fileInfo?.owner">
              <div class="info-label">Owner</div>
              <div class="info-value">{{ fileInfo.owner }}{{ fileInfo.group ? ':' + fileInfo.group : '' }}</div>
            </v-col>
            <v-col cols="4" v-if="fileInfo?.protection">
              <div class="info-label">Protection</div>
              <div class="info-value">{{ fileInfo.protection }}</div>
            </v-col>
          </v-row>

          <v-divider class="my-3" />

          <!-- File Content -->
          <div v-if="fileContent && fileEncoding === 'utf-8'">
            <div class="text-caption text-grey mb-1">Content</div>
            <pre class="file-content-pre">{{ fileContent }}</pre>
          </div>
          <div v-else-if="fileContent && fileEncoding === 'base64'">
            <div class="text-caption text-grey mb-1">Binary file — showing hex preview</div>
            <pre class="file-content-pre hex-preview">{{ hexPreview }}</pre>
          </div>
          <div v-else-if="!loadingFileContent" class="text-center py-6 text-grey">
            Click "Read Content" to load the file
          </div>
          <v-progress-linear v-if="loadingFileContent" indeterminate color="primary" class="my-3" />
        </v-card-text>

        <v-card-actions class="pa-3">
          <v-btn color="primary" @click="readFileContent(selectedFile)" :loading="loadingFileContent" size="small">
            <v-icon start>mdi-file-eye</v-icon> Read Content
          </v-btn>
          <span class="text-caption text-grey ml-1" v-if="selectedFile.size">{{ formatFileSize(selectedFile.size) }}</span>
          <v-btn color="success" @click="downloadFile(selectedFile)" size="small">
            <v-icon start>mdi-download</v-icon> Download
          </v-btn>
          <v-btn color="error" @click="confirmDelete = selectedFile; showDeleteConfirm = true; showFileViewer = false" size="small" variant="outlined">
            <v-icon start>mdi-delete</v-icon> Delete
          </v-btn>
          <v-spacer />
          <v-btn @click="showFileViewer = false" size="small">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Upload Dialog -->
    <v-dialog v-model="showUploadDialog" max-width="500" class="fb-dialog-overlay">
      <v-card class="upload-dialog-card fb-dialog-card">
        <v-card-title class="pa-3">
          <v-icon class="mr-2">mdi-upload</v-icon>
          Upload File
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-4">
          <v-text-field
            v-model="uploadDestination"
            label="Destination path"
            :placeholder="currentPath ? currentPath + '/filename.txt' : '/path/to/file'"
            variant="outlined"
            density="compact"
            hint="Full path including filename"
            persistent-hint
          />
          <v-file-input
            ref="fileInputRef"
            label="Choose file"
            variant="outlined"
            density="compact"
            class="mt-3"
            @change="handleFileSelect"
            show-size
          />
          <div class="text-center text-caption text-grey my-2">— or —</div>
          <v-textarea
            v-model="uploadBase64"
            label="Paste base64 data"
            variant="outlined"
            density="compact"
            rows="3"
            auto-grow
          />
        </v-card-text>
        <v-card-actions class="pa-3">
          <v-spacer />
          <v-btn @click="showUploadDialog = false" size="small">Cancel</v-btn>
          <v-btn color="primary" @click="doUpload" :loading="uploadLoading" size="small"
            :disabled="!uploadDestination || (!uploadFileData && !uploadBase64)">
            <v-icon start>mdi-upload</v-icon> Upload
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Create Directory Dialog -->
    <v-dialog v-model="showCreateDirDialog" max-width="400" class="fb-dialog-overlay">
      <v-card class="fb-dialog-card">
        <v-card-title class="pa-3">
          <v-icon class="mr-2">mdi-folder-plus</v-icon>
          New Directory
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-4">
          <div class="text-caption text-grey mb-2">Creating in: {{ currentPath }}</div>
          <v-text-field
            v-model="newDirName"
            label="Directory name"
            variant="outlined"
            density="compact"
            autofocus
            @keyup.enter="createDirectory"
          />
        </v-card-text>
        <v-card-actions class="pa-3">
          <v-spacer />
          <v-btn @click="showCreateDirDialog = false" size="small">Cancel</v-btn>
          <v-btn color="primary" @click="createDirectory" :loading="createDirLoading" :disabled="!newDirName" size="small">
            Create
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="showDeleteConfirm" max-width="400" class="fb-dialog-overlay">
      <v-card v-if="confirmDelete" class="fb-dialog-card">
        <v-card-title class="pa-3 text-red">
          <v-icon class="mr-2" color="red">mdi-delete-alert</v-icon>
          Confirm Delete
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-4">
          Are you sure you want to delete <strong>{{ confirmDelete.name }}</strong>?
          <div class="text-caption text-grey mt-1">{{ confirmDelete.path }}</div>
        </v-card-text>
        <v-card-actions class="pa-3">
          <v-spacer />
          <v-btn @click="showDeleteConfirm = false" size="small">Cancel</v-btn>
          <v-btn color="error" @click="doDelete" size="small">
            <v-icon start>mdi-delete</v-icon> Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Context Menu -->
    <v-menu
      v-model="showContextMenu"
      :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
      absolute
      offset-y
    >
      <v-list v-if="contextMenuItem" density="compact">
        <v-list-item v-if="!contextMenuItem.isDirectory" @click="openFileViewer(contextMenuItem)">
          <template v-slot:prepend><v-icon size="small">mdi-eye</v-icon></template>
          <v-list-item-title>View</v-list-item-title>
        </v-list-item>
        <v-list-item v-if="!contextMenuItem.isDirectory" @click="downloadFile(contextMenuItem)">
          <template v-slot:prepend><v-icon size="small">mdi-download</v-icon></template>
          <v-list-item-title>Download</v-list-item-title>
        </v-list-item>
        <v-list-item @click="confirmDelete = contextMenuItem; showDeleteConfirm = true">
          <template v-slot:prepend><v-icon size="small" color="red">mdi-delete</v-icon></template>
          <v-list-item-title class="text-red">Delete</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { usePentestBrowser } from './Browser.js'

const props = defineProps({
  agentLoaded: { type: Boolean, default: false },
  sessionId: { type: String, default: 'default' },
  deviceId: { type: String, default: '' },
  pid: { type: Number, default: null },
  fontSize: { type: Number, default: 14 },
  lazyLoad: { type: Boolean, default: false }
})

const emit = defineEmits(['show-notification', 'stats-update'])

const {
  currentPath, pathHistory, directoryContents, loading, testing,
  searchTerm, selectedItems, selectedTableItems, viewMode, showHidden, sortBy, sortOrder,
  appPaths, platform, totalEntries, truncated,
  selectedFile, showFileViewer, fileContent, fileEncoding, loadingFileContent, fileInfo,
  showSearchPanel, searchPattern, searchBasePath, searchMaxDepth, searchResults,
  searchLoading, searchTruncated, searchPresets,
  showUploadDialog, uploadLoading,
  showCreateDirDialog, newDirName, createDirLoading,
  showContextMenu, contextMenuX, contextMenuY, contextMenuItem,

  breadcrumbItems, quickAccessPaths, filteredAndSortedItems, selectedFiles, listHeaders,

  navigateBack, navigateToParent, navigateToHome, refreshCurrentDirectory,
  navigateToPath, handleItemClick, handleItemSelect, handleContextMenu,
  readFileContent, downloadFile, downloadMultipleFiles,
  uploadFile, deleteItem, createDirectory, searchFiles,
  selectAll, clearSelection, showItemActions, openFileViewer, toggleSort,
  getFileIcon, getFileIconColor, getSecurityFlag, formatFileSize, formatDate, formatPermissions,
} = usePentestBrowser(props, emit)

// Local UI state
const editablePath = ref('')
const showDeleteConfirm = ref(false)
const confirmDelete = ref(null)
const uploadDestination = ref('')
const uploadBase64 = ref('')
const uploadFileData = ref(null)

// Sync editable path with current path
watch(currentPath, (val) => {
  editablePath.value = val
})

// Hex preview for binary files
const hexPreview = computed(() => {
  if (!fileContent.value || fileEncoding.value !== 'base64') return ''
  try {
    const raw = atob(fileContent.value.substring(0, 2048)) // First ~1.5KB
    let hex = ''
    let ascii = ''
    let result = ''
    for (let i = 0; i < raw.length; i++) {
      const byte = raw.charCodeAt(i)
      hex += byte.toString(16).padStart(2, '0') + ' '
      ascii += (byte >= 32 && byte <= 126) ? raw[i] : '.'
      if ((i + 1) % 16 === 0) {
        result += `${(i - 15).toString(16).padStart(8, '0')}  ${hex} |${ascii}|\n`
        hex = ''
        ascii = ''
      }
    }
    if (hex) {
      result += `${(raw.length - hex.split(' ').filter(Boolean).length).toString(16).padStart(8, '0')}  ${hex.padEnd(48)} |${ascii}|\n`
    }
    return result
  } catch {
    return '[Unable to decode binary content]'
  }
})

const handleFileSelect = (event) => {
  const files = event?.target?.files
  if (files && files.length > 0) {
    uploadFileData.value = files[0]
    if (!uploadDestination.value) {
      uploadDestination.value = currentPath.value
        ? (currentPath.value.endsWith('/') ? currentPath.value : currentPath.value + '/') + files[0].name
        : '/' + files[0].name
    }
  }
}

const doUpload = async () => {
  if (uploadFileData.value) {
    await uploadFile(uploadDestination.value, uploadFileData.value)
  } else if (uploadBase64.value) {
    await uploadFile(uploadDestination.value, uploadBase64.value)
  }
  uploadDestination.value = ''
  uploadBase64.value = ''
  uploadFileData.value = null
}

const doDelete = async () => {
  if (confirmDelete.value) {
    await deleteItem(confirmDelete.value)
    showDeleteConfirm.value = false
    confirmDelete.value = null
  }
}
</script>

<style scoped>
.file-browser {
  padding: 16px;
  background: linear-gradient(145deg, #1a1a1a 0%, #121212 100%);
  border-radius: 8px;
  color: #fff;
  min-height: 500px;
  /* Query container so the toolbar can adapt to the resizable WINDOW's width
     (not the viewport, which media queries would use). */
  container-type: inline-size;
}

/* Clickable column-header sort buttons (table sorting is composable-driven). */
.fb-sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
  text-transform: none;
}
.fb-sort-btn:hover { color: #58a6ff; }

.fb-btn-label { margin-left: 2px; }

/* Collapse toolbar button labels to icons when the panel gets narrow. */
@container (max-width: 700px) {
  .fb-btn-label { display: none; }
  .filter-field { max-width: 150px !important; }
  :deep(.browser-header .v-btn .v-icon--start) { margin-inline-end: 0; }
}
@container (max-width: 520px) {
  .path-field { min-width: 100%; }
}

.browser-header {
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.nav-controls {
  display: flex;
  gap: 4px;
}

.path-field {
  flex: 1;
  min-width: 200px;
  font-family: 'SF Mono', monospace;
  font-size: 12px;
}

.filter-field {
  font-size: 12px;
}

.breadcrumb-bar {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 6px;
  padding: 4px 12px;
  margin-bottom: 12px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.quick-access {
  margin-bottom: 12px;
}

.search-panel {
  margin-bottom: 12px;
}

.search-results-list {
  max-height: 250px;
  overflow-y: auto;
  background: transparent !important;
}

.search-result-item {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.selection-bar {
  margin-bottom: 12px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 250px;
  color: #888;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 250px;
  color: #888;
  text-align: center;
}

.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.file-card {
  background: rgba(255, 255, 255, 0.04) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  cursor: pointer;
  position: relative;
  min-height: 120px;
  transition: all 0.2s ease;
}

.file-card:hover {
  transform: translateY(-1px);
  border-color: rgba(255, 255, 255, 0.15) !important;
}

.file-card.selected {
  border-color: #58a6ff !important;
  background: rgba(88, 166, 255, 0.1) !important;
}

.file-card.security-flagged {
  border-color: rgba(255, 152, 0, 0.4) !important;
}

.file-name {
  font-size: 12px;
  font-weight: 500;
  word-break: break-word;
  line-height: 1.3;
  max-height: 2.6em;
  overflow: hidden;
}

.file-checkbox {
  position: absolute;
  top: 4px;
  left: 4px;
}

.security-badge {
  position: absolute;
  top: 8px;
  right: 8px;
}

.status-bar {
  margin-top: 8px;
  padding: 4px 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.filesystem-table {
  background: transparent !important;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.info-label {
  font-size: 11px;
  color: #888;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}

.info-value {
  font-size: 13px;
  color: #fff;
  font-family: 'SF Mono', monospace;
  word-break: break-all;
}

.file-content-pre {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 12px;
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.5;
  max-height: 400px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  color: #e6e6e6;
}

.hex-preview {
  font-size: 11px;
  line-height: 1.4;
  color: #8be9fd;
}

.file-viewer-card,
.upload-dialog-card {
  background: linear-gradient(145deg, #2a2a2a 0%, #1e1e1e 100%) !important;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.gap-1 { gap: 4px; }
.gap-2 { gap: 8px; }

/* Vuetify overrides */
:deep(.v-data-table) {
  background: transparent !important;
  color: #fff !important;
}

:deep(.v-data-table-header) {
  background: rgba(255, 255, 255, 0.04) !important;
}

:deep(.v-data-table__tr:hover) {
  background: rgba(255, 255, 255, 0.03) !important;
}

:deep(.v-data-table__tr) {
  cursor: pointer;
}

:deep(.v-breadcrumbs) {
  color: #e6e6e6 !important;
  padding: 0;
}

/* Translucent surface for the IN-PANEL cards only.
   NOTE: must NOT be a bare `.v-card` — that also matched the teleported dialog
   cards and, winning by source-order over `.file-viewer-card`, made them
   see-through (the background table bled through). Dialog cards are styled
   opaque in the non-scoped block below. */
:deep(.search-panel .v-card),
:deep(.selection-bar .v-card) {
  background: rgba(255, 255, 255, 0.02) !important;
  color: #fff !important;
}

@media (max-width: 768px) {
  .browser-header {
    flex-direction: column;
    gap: 8px;
  }
  .path-field {
    min-width: 100%;
  }
  .file-grid {
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  }
}
</style>

<!--
  NON-scoped styles.
  The File Browser dialogs are Vuetify <v-dialog>s that teleport their content to
  `body > .v-overlay-container`, and the app's Vuetify theme defaults to LIGHT
  (no theme is configured; the dark look is a custom `.theme--dark` class, not
  Vuetify's theme). So scoped styles + Vuetify's default light surface can't be
  relied on to keep these cards dark/opaque. We key everything off the
  component-unique `.fb-dialog-*` classes so nothing leaks to other dialogs.
-->
<style>
/* Opaque, dark dialog card — beats Vuetify's themed `.v-card` surface via the
   compound selector + !important, so the background table can never bleed through. */
.fb-dialog-card.v-card {
  background: #1e1e1e !important;
  background-image: linear-gradient(145deg, #2a2a2a 0%, #1e1e1e 100%) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  /* Non-important so Vuetify text utilities (.text-grey/.text-caption) and the
     scoped .info-label/.info-value colors still win for muted/labelled text. */
  color: #e6e6e6;
}

.fb-dialog-card.v-card .v-card-title,
.fb-dialog-card.v-card .v-card-item,
.fb-dialog-card.v-card .v-card-text,
.fb-dialog-card.v-card .v-card-actions {
  background: transparent !important;
}

/* Make the modal backdrop actually perceptible over the already-dark UI behind it. */
.fb-dialog-overlay > .v-overlay__scrim {
  background: #000 !important;
  opacity: 0.6 !important;
}
</style>
