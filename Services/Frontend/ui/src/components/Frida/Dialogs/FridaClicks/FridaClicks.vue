<template>
  <div v-show="visible" ref="dialogRef" class="movable-dialog" :style="dialogStyle">
    <!-- Header -->
    <div class="dialog-header vss-movable">
      {{ title }}
      <span class="session-info">[{{ sessionId || 'default' }}]</span>
      <v-spacer></v-spacer>

      <!-- Header controls -->
      <v-tooltip location="bottom">
        <template v-slot:activator="{ props }">
          <v-btn icon size="small" @click="collapseAll" class="mr-1" v-bind="props">
            <v-icon>mdi-collapse-all</v-icon>
          </v-btn>
        </template>
        <span>Collapse all sections</span>
      </v-tooltip>

      <v-tooltip location="bottom">
        <template v-slot:activator="{ props }">
          <v-btn icon size="small" @click="expandAll" class="mr-1" v-bind="props">
            <v-icon>mdi-expand-all</v-icon>
          </v-btn>
        </template>
        <span>Expand all sections</span>
      </v-tooltip>

      <v-tooltip location="bottom">
        <template v-slot:activator="{ props }">
          <v-btn icon size="small" @click="refreshAgent" class="mr-1" v-bind="props" :loading="isRefreshing">
            <v-icon>mdi-refresh</v-icon>
          </v-btn>
        </template>
        <span>Refresh agent connection</span>
      </v-tooltip>

      <!-- Font Size Controls -->
      <v-divider vertical class="mx-2" style="opacity: 0.3"></v-divider>

      <v-tooltip location="bottom">
        <template v-slot:activator="{ props }">
          <v-btn
            icon
            size="small"
            @click="decreaseFontSize"
            class="mr-1"
            v-bind="props"
            :disabled="fontSize <= minFontSize"
          >
            <v-icon>mdi-minus</v-icon>
          </v-btn>
        </template>
        <span>Decrease font size (Ctrl+-)</span>
      </v-tooltip>

      <v-chip size="small" color="blue" class="mx-1">
        {{ fontSize }}px
      </v-chip>

      <v-tooltip location="bottom">
        <template v-slot:activator="{ props }">
          <v-btn
            icon
            size="small"
            @click="increaseFontSize"
            class="mr-1"
            v-bind="props"
            :disabled="fontSize >= maxFontSize"
          >
            <v-icon>mdi-plus</v-icon>
          </v-btn>
        </template>
        <span>Increase font size (Ctrl++)</span>
      </v-tooltip>

      <v-tooltip location="bottom">
        <template v-slot:activator="{ props }">
          <v-btn
            icon
            size="small"
            @click="resetFontSize"
            class="mr-1"
            v-bind="props"
          >
            <v-icon>mdi-format-size</v-icon>
          </v-btn>
        </template>
        <span>Reset font size (Ctrl+0)</span>
      </v-tooltip>

      <v-btn icon size="small" @click="$emit('close')" class="mr-1">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </div>

    <!-- Agent Status Bar -->
    <div class="agent-status-bar" :class="{
      'error': agentError,
      'warning': !agentLoaded && !agentError,
      'success': agentLoaded
    }">
      <div class="agent-status-content">
        <v-icon
          size="small"
          :color="agentLoaded ? 'green' : agentError ? 'red' : 'orange'"
          class="mr-2"
          :class="{ 'rotating': agentLoading }"
        >
          {{ agentLoaded ? 'mdi-check-circle' : agentError ? 'mdi-alert-circle' : agentLoading ? 'mdi-loading' : 'mdi-circle-outline' }}
        </v-icon>

        <span v-if="agentLoading" class="status-text" :style="dynamicFontStyle">
          Loading Frida agent...
        </span>
        <span v-else-if="agentError" class="status-text error" :style="dynamicFontStyle">
          Agent Error: {{ agentError }}
        </span>
        <span v-else-if="agentLoaded" class="status-text success" :style="dynamicFontStyle">
          Agent loaded and ready
        </span>
        <span v-else class="status-text warning" :style="dynamicFontStyle">
          Frida agent not loaded
        </span>

        <v-spacer></v-spacer>

        <v-btn
          v-if="!agentLoaded && !agentLoading"
          size="small"
          color="primary"
          @click="loadAgent"
          :disabled="!deviceId || !pid"
        >
          Load Agent
        </v-btn>

        <v-btn
          v-if="agentLoaded"
          size="small"
          color="error"
          @click="unloadAgent"
          :loading="agentUnloading"
        >
          Unload
        </v-btn>
      </div>
    </div>

    <!-- Main Content -->
    <div class="dialog-content">
      <div class="sections-container" ref="sectionsContent">
        <!-- iOS Section -->
        <div class="platform-section">
          <div class="platform-header" @click="toggleSection('ios')">
            <v-icon class="section-icon" :class="{ rotated: expandedSections.ios }">
              mdi-chevron-right
            </v-icon>
            <v-icon class="platform-icon">mdi-apple</v-icon>
            <span class="platform-title" :style="dynamicTitleFontStyle">iOS</span>
            <v-chip size="small" class="ml-2" :color="getActiveCount('ios') > 0 ? 'green' : 'grey'">
              {{ getActiveCount('ios') }} active
            </v-chip>
          </div>

          <div v-show="expandedSections.ios" class="platform-content">

            <!-- Frida Section -->
            <div class="category-section">
              <div class="category-header" @click="toggleCategory('ios', 'frida')">
                <v-icon class="category-icon" :class="{ rotated: expandedCategories.ios?.frida }">
                  mdi-chevron-right
                </v-icon>
                <v-icon class="feature-icon">mdi-bug</v-icon>
                <span class="category-title" :style="dynamicHeaderFontStyle">Frida</span>
                <v-chip size="x-small" class="ml-2" :color="getCategoryStatus('ios', 'frida').color">
                  {{ getCategoryStatus('ios', 'frida').text }}
                </v-chip>
              </div>

              <div v-show="expandedCategories.ios?.frida" class="category-content">
                <!-- Frida Version -->
                <div class="feature-card">
                  <div class="feature-header">
                    <div class="feature-info">
                      <v-icon size="small" class="mr-2" color="cyan">mdi-information-outline</v-icon>
                      <span class="feature-name" :style="dynamicHeaderFontStyle">Frida Version</span>
                      <v-chip size="x-small" class="ml-2" color="cyan">INFO</v-chip>
                    </div>
                    <div class="feature-actions">
                      <v-btn
                        size="small"
                        @click="executeInfoFeature('ios', 'frida', 'fridaVersion')"
                        :loading="loadingFeatures.ios?.frida?.fridaVersion"
                        color="cyan"
                        variant="outlined"
                      >
                        Execute
                      </v-btn>
                    </div>
                  </div>
                  <div class="feature-description" :style="dynamicFontStyle">
                    Get current Frida version and runtime information
                  </div>

                  <FridaVersionDisplay
                    v-if="featureOutputs.ios?.frida?.fridaVersion"
                    :output-data="featureOutputs.ios.frida.fridaVersion"
                    platform="ios"
                    category="frida"
                    feature="fridaVersion"
                    :loading="loadingFeatures.ios?.frida?.fridaVersion"
                    :font-size="fontSize"
                    @copy="copyToClipboard"
                    @clear="clearFeatureOutput"
                    @refresh="executeInfoFeature"
                  />
                </div>

                <!-- Runtime Bridges -->
                <div class="feature-card">
                  <div class="feature-header">
                    <div class="feature-info">
                      <v-icon size="small" class="mr-2" color="teal">mdi-bridge</v-icon>
                      <span class="feature-name" :style="dynamicHeaderFontStyle">Runtime Bridges</span>
                      <v-chip size="x-small" class="ml-2" color="teal">RUNTIME</v-chip>
                    </div>
                    <div class="feature-actions">
                      <v-btn
                        size="small"
                        @click="executeInfoFeature('ios', 'frida', 'loadedBridges')"
                        :loading="loadingFeatures.ios?.frida?.loadedBridges"
                        color="teal"
                        variant="outlined"
                      >
                        Execute
                      </v-btn>
                      <v-btn
                        v-if="featureOutputs.ios?.frida?.loadedBridges"
                        size="small"
                        icon
                        @click="copyToClipboard(featureOutputs.ios?.frida?.loadedBridges)"
                        color="grey"
                      >
                        <v-icon size="small">mdi-content-copy</v-icon>
                      </v-btn>
                    </div>
                  </div>
                  <div class="feature-description" :style="dynamicFontStyle">
                    Check available runtime bridges (ObjC, Java) and their status
                  </div>

                  <div v-if="featureOutputs.ios?.frida?.loadedBridges" class="feature-output">
                    <div class="output-header">
                      <span :style="dynamicFontStyle">Available Bridges</span>
                      <div class="output-actions">
                        <v-btn size="x-small" variant="text" @click="clearFeatureOutput('ios', 'frida', 'loadedBridges')">
                          <v-icon size="small">mdi-delete</v-icon>
                          Clear
                        </v-btn>
                        <v-btn size="x-small" variant="text" @click="executeInfoFeature('ios', 'frida', 'loadedBridges')">
                          <v-icon size="small">mdi-refresh</v-icon>
                          Refresh
                        </v-btn>
                      </div>
                    </div>
                    <div class="output-content">
                      <pre class="output-text" :style="dynamicFontStyle">{{ formatDeviceOutput(featureOutputs.ios?.frida?.loadedBridges) }}</pre>
                    </div>
                  </div>
                </div>

                <!-- Debug Info -->
                <div class="feature-card debug-card">
                  <div class="feature-header">
                    <div class="feature-info">
                      <v-icon size="small" class="mr-2" color="orange">mdi-bug</v-icon>
                      <span class="feature-name" :style="dynamicHeaderFontStyle">Debug Information</span>
                      <v-chip size="x-small" class="ml-2" color="orange">DEBUG</v-chip>
                    </div>
                    <div class="feature-actions">
                      <v-btn
                        size="small"
                        @click="executeDebugInfo()"
                        :loading="debugLoading"
                        color="orange"
                        variant="outlined"
                      >
                        Get Debug Info
                      </v-btn>
                      <v-btn
                        v-if="debugInfo"
                        size="small"
                        icon
                        @click="copyToClipboard(debugInfo)"
                        color="grey"
                      >
                        <v-icon size="small">mdi-content-copy</v-icon>
                      </v-btn>
                    </div>
                  </div>
                  <div class="feature-description" :style="dynamicFontStyle">
                    Get comprehensive debug information including available functions and imports
                  </div>

                  <div v-if="debugInfo" class="feature-output">
                    <div class="output-header">
                      <span :style="dynamicFontStyle">Debug Information</span>
                      <div class="output-actions">
                        <v-btn size="x-small" variant="text" @click="debugInfo = null">
                          <v-icon size="small">mdi-delete</v-icon>
                          Clear
                        </v-btn>
                      </div>
                    </div>
                    <div class="output-content">
                      <pre class="output-text" :style="dynamicFontStyle">{{ formatDeviceOutput(debugInfo) }}</pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- iOS Device Info Section -->
            <div class="category-section">
              <div class="category-header" @click="toggleCategory('ios', 'deviceInfo')">
                <v-icon class="category-icon" :class="{ rotated: expandedCategories.ios?.deviceInfo }">
                  mdi-chevron-right
                </v-icon>
                <v-icon class="feature-icon">mdi-cellphone-information</v-icon>
                <span class="category-title" :style="dynamicHeaderFontStyle">Device Info</span>
                <v-chip size="x-small" class="ml-2" :color="getCategoryStatus('ios', 'deviceInfo').color">
                  {{ getCategoryStatus('ios', 'deviceInfo').text }}
                </v-chip>
              </div>

              <div v-show="expandedCategories.ios?.deviceInfo" class="category-content">
                <!-- iOS Device Info -->
                <div class="feature-card">
                  <div class="feature-header">
                    <div class="feature-info">
                      <v-icon size="small" class="mr-2" color="blue">mdi-apple</v-icon>
                      <span class="feature-name" :style="dynamicHeaderFontStyle">iOS Device Information</span>
                      <v-chip size="x-small" class="ml-2" color="blue">DEVICE</v-chip>
                    </div>
                    <div class="feature-actions">
                      <v-btn
                        size="small"
                        @click="executeInfoFeature('ios', 'deviceInfo', 'iOSDeviceInfo')"
                        :loading="loadingFeatures.ios?.deviceInfo?.iOSDeviceInfo"
                        color="blue"
                        variant="outlined"
                        :disabled="!agentLoaded"
                      >
                        Get Device Info
                      </v-btn>
                      <v-btn
                        v-if="featureOutputs.ios?.deviceInfo?.iOSDeviceInfo"
                        size="small"
                        icon
                        @click="copyToClipboard(featureOutputs.ios?.deviceInfo?.iOSDeviceInfo)"
                        color="grey"
                      >
                        <v-icon size="small">mdi-content-copy</v-icon>
                      </v-btn>
                    </div>
                  </div>
                  <div class="feature-description" :style="dynamicFontStyle">
                    Get comprehensive iOS device information including hardware, OS version, battery, and app bundle details
                  </div>

                  <div v-if="featureOutputs.ios?.deviceInfo?.iOSDeviceInfo" class="feature-output">
                    <div class="output-header">
                      <span :style="dynamicFontStyle">Device Information</span>
                      <div class="output-actions">
                        <v-btn size="x-small" variant="text" @click="clearFeatureOutput('ios', 'deviceInfo', 'iOSDeviceInfo')">
                          <v-icon size="small">mdi-delete</v-icon>
                          Clear
                        </v-btn>
                        <v-btn size="x-small" variant="text" @click="executeInfoFeature('ios', 'deviceInfo', 'iOSDeviceInfo')">
                          <v-icon size="small">mdi-refresh</v-icon>
                          Refresh
                        </v-btn>
                      </div>
                    </div>
                    <div class="output-content">
                      <div v-if="parsediOSDeviceInfo && Object.keys(parsediOSDeviceInfo).length > 0" class="app-info">
                        <div class="info-grid">
                          <div class="info-item" v-for="(value, key) in parsediOSDeviceInfo" :key="key">
                            <span class="info-label" :style="dynamicFontStyle">{{ formatLabel(key) }}</span>
                            <span class="info-value" :style="dynamicFontStyle">{{ value }}</span>
                          </div>
                        </div>
                      </div>
                      <pre v-else class="output-text" :style="dynamicFontStyle">{{ formatDeviceOutput(featureOutputs.ios?.deviceInfo?.iOSDeviceInfo) }}</pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- iOS Filesystem Section -->
            <div class="category-section">
              <div class="category-header" @click="toggleCategory('ios', 'filesystem')">
                <v-icon class="category-icon" :class="{ rotated: expandedCategories.ios?.filesystem }">
                  mdi-chevron-right
                </v-icon>
                <v-icon class="feature-icon">mdi-folder-multiple</v-icon>
                <span class="category-title" :style="dynamicHeaderFontStyle">Filesystem Browser</span>
                <v-chip size="x-small" class="ml-2" :color="getCategoryStatus('ios', 'filesystem').color">
                  {{ getCategoryStatus('ios', 'filesystem').text }}
                </v-chip>
              </div>

              <div v-show="expandedCategories.ios?.filesystem" class="category-content">
                <!-- Filesystem Browser Component -->
                <div class="feature-card filesystem-card">
                  <div class="feature-header">
                    <div class="feature-info">
                      <v-icon size="small" class="mr-2" :color="features.ios.filesystem.browser ? 'blue' : 'grey'">
                        {{ features.ios.filesystem.browser ? 'mdi-folder-open' : 'mdi-folder' }}
                      </v-icon>
                      <span class="feature-name" :style="dynamicHeaderFontStyle">iOS Filesystem Browser</span>
                      <v-chip size="x-small" class="ml-2" :color="features.ios.filesystem.browser ? 'blue' : 'grey'">
                        {{ features.ios.filesystem.browser ? 'ACTIVE' : 'INACTIVE' }}
                      </v-chip>
                      <v-chip
                        v-if="features.ios.filesystem.monitoring"
                        size="x-small"
                        class="ml-2"
                        color="green"
                      >
                        MONITORING
                      </v-chip>
                    </div>
                    <v-switch
                      v-model="features.ios.filesystem.browser"
                      density="compact"
                      hide-details
                      @update:model-value="onFilesystemBrowserToggle"
                      :disabled="!agentLoaded"
                      color="blue"
                    ></v-switch>
                  </div>
                  <div class="feature-description" :style="dynamicFontStyle">
                    Advanced iOS filesystem browser with real-time monitoring, file operations, and comprehensive directory exploration capabilities
                  </div>

                  <div v-if="features.ios.filesystem.browser" class="feature-output">
                    <div class="output-header">
                      <div class="header-left">
                        <span class="filesystem-title" :style="dynamicHeaderFontStyle">iOS Filesystem Browser</span>
                        <v-chip
                          v-if="filesystemStats.totalFiles > 0"
                          size="x-small"
                          color="blue"
                          class="ml-2"
                        >
                          {{ filesystemStats.totalFiles }} files
                        </v-chip>
                        <v-chip
                          v-if="filesystemStats.totalDirectories > 0"
                          size="x-small"
                          color="green"
                          class="ml-2"
                        >
                          {{ filesystemStats.totalDirectories }} folders
                        </v-chip>
                      </div>
                      <div class="output-actions">
                        <v-btn
                          size="small"
                          variant="text"
                          @click="resetFilesystemBrowser"
                          icon
                        >
                          <v-icon size="small">mdi-refresh</v-icon>
                          <v-tooltip activator="parent" location="bottom">Reset Browser</v-tooltip>
                        </v-btn>

                        <v-btn
                          size="small"
                          variant="text"
                          @click="exportFilesystemData"
                          :disabled="!features.ios.filesystem.browser"
                          icon
                        >
                          <v-icon size="small">mdi-download</v-icon>
                          <v-tooltip activator="parent" location="bottom">Export Data</v-tooltip>
                        </v-btn>
                      </div>
                    </div>

                    <div class="output-content">
                      <Browser
                        :agent-loaded="agentLoaded"
                        :session-id="sessionId"
                        :device-id="deviceId"
                        :pid="pid"
                        :font-size="fontSize"
                        @show-notification="handleNotification"
                        @update:monitoring="onFilesystemMonitoringUpdate"
                        @stats-update="updateFilesystemStats"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- App Information Section -->
            <div class="category-section">
              <div class="category-header" @click="toggleCategory('ios', 'app')">
                <v-icon class="category-icon" :class="{ rotated: expandedCategories.ios?.app }">
                  mdi-chevron-right
                </v-icon>
                <v-icon class="feature-icon">mdi-application</v-icon>
                <span class="category-title" :style="dynamicHeaderFontStyle">App Information</span>
                <v-chip size="x-small" class="ml-2" :color="getCategoryStatus('ios', 'app').color">
                  {{ getCategoryStatus('ios', 'app').text }}
                </v-chip>
              </div>

              <div v-show="expandedCategories.ios?.app" class="category-content">
                <!-- Basic App Info -->
                <div class="feature-card">
                  <div class="feature-header">
                    <div class="feature-info">
                      <v-icon size="small" class="mr-2" color="orange">mdi-information-outline</v-icon>
                      <span class="feature-name" :style="dynamicHeaderFontStyle">Basic App Information</span>
                      <v-chip size="x-small" class="ml-2" color="orange">INFO</v-chip>
                    </div>
                    <div class="feature-actions">
                      <v-btn
                        size="small"
                        @click="executeInfoFeature('ios', 'appInfo', 'basicInfo')"
                        :loading="loadingFeatures.ios?.appInfo?.basicInfo"
                        color="orange"
                        variant="outlined"
                      >
                        Get App Info
                      </v-btn>
                      <v-btn
                        v-if="featureOutputs.ios?.appInfo?.basicInfo"
                        size="small"
                        icon
                        @click="copyToClipboard(parsedAppInfo)"
                        color="grey"
                      >
                        <v-icon size="small">mdi-content-copy</v-icon>
                      </v-btn>
                    </div>
                  </div>
                  <div class="feature-description" :style="dynamicFontStyle">
                    Extract basic application information and metadata
                  </div>

                  <div v-if="featureOutputs.ios?.appInfo?.basicInfo" class="feature-output">
                    <div class="output-header">
                      <span :style="dynamicFontStyle">Application Information</span>
                      <div class="output-actions">
                        <v-btn size="x-small" variant="text" @click="clearFeatureOutput('ios', 'appInfo', 'basicInfo')">
                          <v-icon size="small">mdi-delete</v-icon>
                          Clear
                        </v-btn>
                        <v-btn size="x-small" variant="text" @click="refreshAppInfo">
                          <v-icon size="small">mdi-refresh</v-icon>
                          Refresh
                        </v-btn>
                      </div>
                    </div>
                    <div class="output-content">
                      <div class="app-info" v-if="parsedAppInfo && Object.keys(parsedAppInfo).length > 0">
                        <div class="info-grid">
                          <div class="info-item" v-for="(value, key) in parsedAppInfo" :key="key" v-if="key !== '_rawData' && value !== 'N/A'">
                            <span class="info-label" :style="dynamicFontStyle">{{ formatLabel(key) }}</span>
                            <span class="info-value" :style="dynamicFontStyle">{{ value }}</span>
                          </div>
                        </div>
                      </div>
                      <pre v-else class="output-text" :style="dynamicFontStyle">{{ formatDeviceOutput(featureOutputs.ios?.appInfo?.basicInfo) }}</pre>
                    </div>
                  </div>
                </div>

                <!-- Method Tracing -->
                <div class="feature-card monitor-card">
                  <div class="feature-header">
                    <div class="feature-info">
                      <v-icon size="small" class="mr-2" :color="features.ios.appInfo.methodTracing ? 'green' : 'grey'">
                        {{ features.ios.appInfo.methodTracing ? 'mdi-record-circle' : 'mdi-record-circle-outline' }}
                      </v-icon>
                      <span class="feature-name" :style="dynamicHeaderFontStyle">Method Tracing</span>
                      <v-chip size="x-small" class="ml-2" :color="features.ios.appInfo.methodTracing ? 'green' : 'grey'">
                        {{ features.ios.appInfo.methodTracing ? 'LOGGING' : 'INACTIVE' }}
                      </v-chip>
                    </div>
                    <v-switch
                      v-model="features.ios.appInfo.methodTracing"
                      density="compact"
                      hide-details
                      @update:model-value="onFeatureToggle('ios', 'appInfo', 'methodTracing', 'logging')"
                      :disabled="!agentLoaded"
                      color="green"
                    ></v-switch>
                  </div>
                  <div class="feature-description" :style="dynamicFontStyle">
                    Trace method calls and function invocations in real-time
                  </div>

                  <div v-if="features.ios.appInfo.methodTracing && featureOutputs.ios?.appInfo?.methodTracing" class="feature-output">
                    <div class="output-header">
                      <span :style="dynamicFontStyle">Live Method Calls ({{ getOutputLineCount('ios', 'appInfo', 'methodTracing') }} lines)</span>
                      <div class="output-actions">
                        <v-btn size="x-small" variant="text" @click="clearFeatureOutput('ios', 'appInfo', 'methodTracing')">
                          <v-icon size="small">mdi-delete</v-icon>
                          Clear
                        </v-btn>
                        <v-btn size="x-small" variant="text" @click="pauseLogging('ios', 'appInfo', 'methodTracing')">
                          <v-icon size="small">{{ loggingPaused['ios-appInfo-methodTracing'] ? 'mdi-play' : 'mdi-pause' }}</v-icon>
                          {{ loggingPaused['ios-appInfo-methodTracing'] ? 'Resume' : 'Pause' }}
                        </v-btn>
                      </div>
                    </div>
                    <div class="output-content">
                      <pre class="output-text live-output" ref="methodTracingOutput" :style="dynamicFontStyle">{{ featureOutputs.ios.appInfo.methodTracing }}</pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <!-- iOS Filesystem Section -->
            <div class="category-section">
              <div class="category-header" @click="toggleCategory('ios', 'filesystem')">
                <v-icon class="category-icon" :class="{ rotated: expandedCategories.ios?.filesystem }">
                  mdi-chevron-right
                </v-icon>
                <v-icon class="feature-icon">mdi-folder-multiple</v-icon>
                <span class="category-title" :style="dynamicHeaderFontStyle">Filesystem Browser</span>
                <v-chip size="x-small" class="ml-2" :color="getCategoryStatus('ios', 'filesystem').color">
                  {{ getCategoryStatus('ios', 'filesystem').text }}
                </v-chip>
              </div>

              <div v-show="expandedCategories.ios?.filesystem" class="category-content">
                <!-- Filesystem Browser Component -->
                <div class="feature-card filesystem-card">
                  <div class="feature-header">
                    <div class="feature-info">
                      <v-icon size="small" class="mr-2" :color="features.ios.filesystem.browser ? 'blue' : 'grey'">
                        {{ features.ios.filesystem.browser ? 'mdi-folder-open' : 'mdi-folder' }}
                      </v-icon>
                      <span class="feature-name" :style="dynamicHeaderFontStyle">iOS Filesystem Browser</span>
                      <v-chip size="x-small" class="ml-2" :color="features.ios.filesystem.browser ? 'blue' : 'grey'">
                        {{ features.ios.filesystem.browser ? 'ACTIVE' : 'INACTIVE' }}
                      </v-chip>
                      <v-chip
                        v-if="features.ios.filesystem.monitoring"
                        size="x-small"
                        class="ml-2"
                        color="green"
                      >
                        MONITORING
                      </v-chip>
                    </div>
                    <v-switch
                      v-model="features.ios.filesystem.browser"
                      density="compact"
                      hide-details
                      @update:model-value="onFilesystemBrowserToggle"
                      :disabled="!agentLoaded"
                      color="blue"
                    ></v-switch>
                  </div>
                  <div class="feature-description" :style="dynamicFontStyle">
                    Advanced iOS filesystem browser with real-time monitoring, file operations, and comprehensive directory exploration capabilities
                  </div>

                  <div v-if="features.ios.filesystem.browser" class="feature-output">
                    <div class="output-header">
                      <div class="header-left">
                        <span class="filesystem-title" :style="dynamicHeaderFontStyle">iOS Filesystem Browser</span>
                        <v-chip
                          v-if="filesystemStats.totalFiles > 0"
                          size="x-small"
                          color="blue"
                          class="ml-2"
                        >
                          {{ filesystemStats.totalFiles }} files
                        </v-chip>
                        <v-chip
                          v-if="filesystemStats.totalDirectories > 0"
                          size="x-small"
                          color="green"
                          class="ml-2"
                        >
                          {{ filesystemStats.totalDirectories }} folders
                        </v-chip>
                      </div>
                      <div class="output-actions">
                        <v-btn
                          size="small"
                          variant="text"
                          @click="resetFilesystemBrowser"
                          icon
                        >
                          <v-icon size="small">mdi-refresh</v-icon>
                          <v-tooltip activator="parent" location="bottom">Reset Browser</v-tooltip>
                        </v-btn>

                        <v-btn
                          size="small"
                          variant="text"
                          @click="exportFilesystemData"
                          :disabled="!features.ios.filesystem.browser"
                          icon
                        >
                          <v-icon size="small">mdi-download</v-icon>
                          <v-tooltip activator="parent" location="bottom">Export Data</v-tooltip>
                        </v-btn>
                      </div>
                    </div>

                    <div class="output-content">
                      <Browser
                        :agent-loaded="agentLoaded"
                        :session-id="sessionId"
                        :device-id="deviceId"
                        :pid="pid"
                        :font-size="fontSize"
                        @show-notification="handleNotification"
                        @update:monitoring="onFilesystemMonitoringUpdate"
                        @stats-update="updateFilesystemStats"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- App Information Section -->
            <div class="category-section">
              <div class="category-header" @click="toggleCategory('ios', 'app')">
                <v-icon class="category-icon" :class="{ rotated: expandedCategories.ios?.app }">
                  mdi-chevron-right
                </v-icon>
                <v-icon class="feature-icon">mdi-application</v-icon>
                <span class="category-title" :style="dynamicHeaderFontStyle">App Information</span>
                <v-chip size="x-small" class="ml-2" :color="getCategoryStatus('ios', 'app').color">
                  {{ getCategoryStatus('ios', 'app').text }}
                </v-chip>
              </div>

              <div v-show="expandedCategories.ios?.app" class="category-content">
                <!-- Basic App Info -->
                <div class="feature-card">
                  <div class="feature-header">
                    <div class="feature-info">
                      <v-icon size="small" class="mr-2" color="orange">mdi-information-outline</v-icon>
                      <span class="feature-name" :style="dynamicHeaderFontStyle">Basic App Information</span>
                      <v-chip size="x-small" class="ml-2" color="orange">INFO</v-chip>
                    </div>
                    <div class="feature-actions">
                      <v-btn
                        size="small"
                        @click="executeInfoFeature('ios', 'appInfo', 'basicInfo')"
                        :loading="loadingFeatures.ios?.appInfo?.basicInfo"
                        color="orange"
                        variant="outlined"
                      >
                        Get App Info
                      </v-btn>
                      <v-btn
                        v-if="featureOutputs.ios?.appInfo?.basicInfo"
                        size="small"
                        icon
                        @click="copyToClipboard(parsedAppInfo)"
                        color="grey"
                      >
                        <v-icon size="small">mdi-content-copy</v-icon>
                      </v-btn>
                    </div>
                  </div>
                  <div class="feature-description" :style="dynamicFontStyle">
                    Extract basic application information and metadata
                  </div>

                  <div v-if="featureOutputs.ios?.appInfo?.basicInfo" class="feature-output">
                    <div class="output-header">
                      <span :style="dynamicFontStyle">Application Information</span>
                      <div class="output-actions">
                        <v-btn size="x-small" variant="text" @click="clearFeatureOutput('ios', 'appInfo', 'basicInfo')">
                          <v-icon size="small">mdi-delete</v-icon>
                          Clear
                        </v-btn>
                        <v-btn size="x-small" variant="text" @click="refreshAppInfo">
                          <v-icon size="small">mdi-refresh</v-icon>
                          Refresh
                        </v-btn>
                      </div>
                    </div>
                    <div class="output-content">
                      <div class="app-info" v-if="parsedAppInfo && Object.keys(parsedAppInfo).length > 0">
                        <div class="info-grid">
                          <div class="info-item" v-for="(value, key) in parsedAppInfo" :key="key" v-if="key !== '_rawData' && value !== 'N/A'">
                            <span class="info-label" :style="dynamicFontStyle">{{ formatLabel(key) }}</span>
                            <span class="info-value" :style="dynamicFontStyle">{{ value }}</span>
                          </div>
                        </div>
                      </div>
                      <pre v-else class="output-text" :style="dynamicFontStyle">{{ formatDeviceOutput(featureOutputs.ios?.appInfo?.basicInfo) }}</pre>
                    </div>
                  </div>
                </div>

                <!-- Method Tracing -->
                <div class="feature-card monitor-card">
                  <div class="feature-header">
                    <div class="feature-info">
                      <v-icon size="small" class="mr-2" :color="features.ios.appInfo.methodTracing ? 'green' : 'grey'">
                        {{ features.ios.appInfo.methodTracing ? 'mdi-record-circle' : 'mdi-record-circle-outline' }}
                      </v-icon>
                      <span class="feature-name" :style="dynamicHeaderFontStyle">Method Tracing</span>
                      <v-chip size="x-small" class="ml-2" :color="features.ios.appInfo.methodTracing ? 'green' : 'grey'">
                        {{ features.ios.appInfo.methodTracing ? 'LOGGING' : 'INACTIVE' }}
                      </v-chip>
                    </div>
                    <v-switch
                      v-model="features.ios.appInfo.methodTracing"
                      density="compact"
                      hide-details
                      @update:model-value="onFeatureToggle('ios', 'appInfo', 'methodTracing', 'logging')"
                      :disabled="!agentLoaded"
                      color="green"
                    ></v-switch>
                  </div>
                  <div class="feature-description" :style="dynamicFontStyle">
                    Trace method calls and function invocations in real-time
                  </div>

                  <div v-if="features.ios.appInfo.methodTracing && featureOutputs.ios?.appInfo?.methodTracing" class="feature-output">
                    <div class="output-header">
                      <span :style="dynamicFontStyle">Live Method Calls ({{ getOutputLineCount('ios', 'appInfo', 'methodTracing') }} lines)</span>
                      <div class="output-actions">
                        <v-btn size="x-small" variant="text" @click="clearFeatureOutput('ios', 'appInfo', 'methodTracing')">
                          <v-icon size="small">mdi-delete</v-icon>
                          Clear
                        </v-btn>
                        <v-btn size="x-small" variant="text" @click="pauseLogging('ios', 'appInfo', 'methodTracing')">
                          <v-icon size="small">{{ loggingPaused['ios-appInfo-methodTracing'] ? 'mdi-play' : 'mdi-pause' }}</v-icon>
                          {{ loggingPaused['ios-appInfo-methodTracing'] ? 'Resume' : 'Pause' }}
                        </v-btn>
                      </div>
                    </div>
                    <div class="output-content">
                      <pre class="output-text live-output" ref="methodTracingOutput" :style="dynamicFontStyle">{{ featureOutputs.ios.appInfo.methodTracing }}</pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <!-- Network Section -->
            <div class="category-section">
              <div class="category-header" @click="toggleCategory('ios', 'network')">
                <v-icon class="category-icon" :class="{ rotated: expandedCategories.ios?.network }">
                  mdi-chevron-right
                </v-icon>
                <v-icon class="feature-icon">mdi-web</v-icon>
                <span class="category-title" :style="dynamicHeaderFontStyle">Network Security Monitor</span>
                <v-chip size="x-small" class="ml-2" :color="getCategoryStatus('ios', 'network').color">
                  {{ getCategoryStatus('ios', 'network').text }}
                </v-chip>
              </div>

              <div v-show="expandedCategories.ios?.network" class="category-content">
                <!-- Network Monitor Control -->
                <div class="feature-card network-card">
                  <div class="feature-header">
                    <div class="feature-info">
                      <v-icon size="small" class="mr-2" :color="features.ios.network.networkMonitor ? 'green' : 'grey'">
                        {{ features.ios.network.networkMonitor ? 'mdi-record-circle' : 'mdi-record-circle-outline' }}
                      </v-icon>
                      <span class="feature-name" :style="dynamicHeaderFontStyle">HTTP/HTTPS Security Monitor</span>
                      <v-chip size="x-small" class="ml-2" :color="features.ios.network.networkMonitor ? 'blue' : 'grey'">
                        {{ features.ios.network.networkMonitor ? 'MONITORING' : 'INACTIVE' }}
                      </v-chip>
                      <v-chip size="x-small" class="ml-2" :color="networkStats.totalRequests > 0 ? 'green' : 'grey'" v-if="features.ios.network.networkMonitor">
                        {{ networkStats.totalRequests }} requests
                      </v-chip>
                      <v-chip
                        v-if="features.ios.network.networkMonitor && securityStats.highRisk > 0"
                        size="x-small"
                        class="ml-2"
                        color="error"
                      >
                        {{ securityStats.highRisk }} HIGH RISK
                      </v-chip>
                    </div>
                    <v-switch
                      v-model="features.ios.network.networkMonitor"
                      density="compact"
                      hide-details
                      @update:model-value="onNetworkMonitorToggle"
                      :disabled="!agentLoaded"
                      color="blue"
                    ></v-switch>
                  </div>
                  <div class="feature-description" :style="dynamicFontStyle">
                    Advanced security monitoring for HTTP/HTTPS requests with real-time threat detection, PII analysis, and vulnerability assessment
                  </div>

                  <!-- Network monitoring content here -->
                  <div v-if="features.ios.network.networkMonitor" class="feature-output">
                    <div class="output-header">
                      <div class="header-left">
                        <span class="requests-count" :style="dynamicFontStyle">Network Requests</span>
                        <v-btn
                          size="x-small"
                          variant="text"
                          @click="toggleNetworkView"
                          class="ml-2"
                        >
                          {{ showParsedNetwork ? 'Show Raw' : 'Show Parsed' }}
                        </v-btn>
                      </div>
                      <div class="output-actions">
                        <v-text-field
                          v-model="networkSearch"
                          density="compact"
                          hide-details
                          single-line
                          placeholder="Search..."
                          prepend-inner-icon="mdi-magnify"
                          class="search-field mr-2"
                          clearable
                        ></v-text-field>

                        <v-select
                          v-model="securityFilter"
                          :items="securityFilterOptions"
                          density="compact"
                          hide-details
                          class="filter-select mr-2"
                          style="max-width: 150px"
                        ></v-select>

                        <v-select
                          v-model="methodFilter"
                          :items="methodFilterOptions"
                          density="compact"
                          hide-details
                          class="filter-select mr-2"
                          style="max-width: 120px"
                        ></v-select>

                        <v-btn size="small" variant="text" @click="clearNetworkFilters" icon>
                          <v-icon size="small">mdi-filter-off</v-icon>
                          <v-tooltip activator="parent" location="bottom">Clear Filters</v-tooltip>
                        </v-btn>

                        <v-btn size="small" variant="text" @click="clearNetworkData" icon>
                          <v-icon size="small">mdi-delete</v-icon>
                          <v-tooltip activator="parent" location="bottom">Clear Data</v-tooltip>
                        </v-btn>

                        <v-btn size="small" variant="text" @click="exportNetworkData" icon>
                          <v-icon size="small">mdi-download</v-icon>
                          <v-tooltip activator="parent" location="bottom">Export Analysis</v-tooltip>
                        </v-btn>
                      </div>
                    </div>

                    <div class="output-content">
                      <!-- Parsed Network View - Implementation would continue here -->
                      <div v-if="showParsedNetwork" class="enhanced-requests-list">
                        <!-- iOS Network monitoring UI content -->
                        <!-- Keeping abbreviated for space -->
                      </div>

                      <!-- Raw Network View -->
                      <div v-else class="raw-network-view">
                        <pre class="output-text network-output" ref="networkMonitorOutput" :style="dynamicFontStyle">{{ featureOutputs.ios.network.networkMonitor }}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Cryptography Section -->
            <div class="category-section">
              <div class="category-header" @click="toggleCategory('ios', 'crypto')">
                <v-icon class="category-icon" :class="{ rotated: expandedCategories.ios?.crypto }">
                  mdi-chevron-right
                </v-icon>
                <v-icon class="feature-icon">mdi-lock</v-icon>
                <span class="category-title" :style="dynamicHeaderFontStyle">Cryptography Security Monitor</span>
                <v-chip size="x-small" class="ml-2" :color="getCategoryStatus('ios', 'crypto').color">
                  {{ getCategoryStatus('ios', 'crypto').text }}
                </v-chip>
              </div>

              <div v-show="expandedCategories.ios?.crypto" class="category-content">
                <CryptoMonitor
                  :agent-loaded="agentLoaded"
                  :session-id="sessionId"
                  :device-id="deviceId"
                  :pid="pid"
                  :font-size="fontSize"
                  @update:monitoring="onCryptoMonitorToggle"
                  @show-notification="handleNotification"
                />
              </div>
            </div>

            <!-- System Section -->
            <div class="category-section">
              <div class="category-header" @click="toggleCategory('ios', 'system')">
                <v-icon class="category-icon" :class="{ rotated: expandedCategories.ios?.system }">
                  mdi-chevron-right
                </v-icon>
                <v-icon class="feature-icon">mdi-cellphone</v-icon>
                <span class="category-title" :style="dynamicHeaderFontStyle">System</span>
                <v-chip size="x-small" class="ml-2" :color="getCategoryStatus('ios', 'system').color">
                  {{ getCategoryStatus('ios', 'system').text }}
                </v-chip>
              </div>

              <div v-show="expandedCategories.ios?.system" class="category-content">
                <!-- iOS System features content -->
                <!-- Keeping abbreviated for space -->
              </div>
            </div>

          </div>
        </div>
        <!-- Android Section -->
        <div class="platform-section">
          <div class="platform-header" @click="toggleSection('android')">
            <v-icon class="section-icon" :class="{ rotated: expandedSections.android }">
              mdi-chevron-right
            </v-icon>
            <v-icon class="platform-icon">mdi-android</v-icon>
            <span class="platform-title" :style="dynamicTitleFontStyle">Android</span>
            <v-chip size="small" class="ml-2" :color="getActiveCount('android') > 0 ? 'green' : 'blue'">
              {{ getActiveCount('android') }} active
            </v-chip>
          </div>

          <div v-show="expandedSections.android" class="platform-content">

            <!-- Android Device Information Section -->
            <div class="category-section">
              <div class="category-header" @click="toggleCategory('android', 'deviceInfo')">
                <v-icon class="category-icon" :class="{ rotated: expandedCategories.android?.deviceInfo }">
                  mdi-chevron-right
                </v-icon>
                <v-icon class="feature-icon">mdi-information</v-icon>
                <span class="category-title" :style="dynamicHeaderFontStyle">Device Information</span>
                <v-chip size="x-small" class="ml-2" :color="getCategoryStatus('android', 'deviceInfo').color">
                  {{ getCategoryStatus('android', 'deviceInfo').text }}
                </v-chip>
              </div>

              <div v-show="expandedCategories.android?.deviceInfo" class="category-content">
                <!-- Android Device Information with DeviceInfo Component -->
                <div class="feature-card">
                  <div class="feature-header">
                    <div class="feature-info">
                      <v-icon size="small" class="mr-2" color="green">mdi-android</v-icon>
                      <span class="feature-name" :style="dynamicHeaderFontStyle">Android Device Information</span>
                      <v-chip size="x-small" class="ml-2" color="green">DEVICE</v-chip>
                    </div>
                    <div class="feature-actions">
                      <v-btn
                        size="small"
                        @click="executeAndroidDeviceFeature('androidVersion')"
                        :loading="loadingFeatures.android?.deviceInfo?.androidVersion"
                        color="green"
                        variant="outlined"
                      >
                        Get Device Info
                      </v-btn>
                    </div>
                  </div>
                  <div class="feature-description" :style="dynamicFontStyle">
                    Get comprehensive Android device information including version, hardware details, and system properties
                  </div>

                  <DeviceInfo
                    v-if="featureOutputs.android?.deviceInfo?.androidVersion"
                    :output-data="featureOutputs.android.deviceInfo.androidVersion"
                    platform="android"
                    category="deviceInfo"
                    feature="androidVersion"
                    :loading="loadingFeatures.android?.deviceInfo?.androidVersion"
                    :show-full-data="true"
                    :font-size="fontSize"
                    @copy="copyToClipboard"
                    @clear="clearFeatureOutput"
                    @refresh="executeAndroidDeviceFeature"
                  />
                </div>

                <!-- Frida Version for Android -->
                <div class="feature-card">
                  <div class="feature-header">
                    <div class="feature-info">
                      <v-icon size="small" class="mr-2" color="cyan">mdi-information-outline</v-icon>
                      <span class="feature-name" :style="dynamicHeaderFontStyle">Frida Version</span>
                      <v-chip size="x-small" class="ml-2" color="cyan">INFO</v-chip>
                    </div>
                    <div class="feature-actions">
                      <v-btn
                        size="small"
                        @click="executeInfoFeature('android', 'deviceInfo', 'fridaVersion')"
                        :loading="loadingFeatures.android?.deviceInfo?.fridaVersion"
                        color="cyan"
                        variant="outlined"
                      >
                        Get Version
                      </v-btn>
                    </div>
                  </div>
                  <div class="feature-description" :style="dynamicFontStyle">
                    Get current Frida version and runtime information
                  </div>

                  <FridaVersionDisplay
                    v-if="featureOutputs.android?.deviceInfo?.fridaVersion"
                    :output-data="featureOutputs.android.deviceInfo.fridaVersion"
                    platform="android"
                    category="deviceInfo"
                    feature="fridaVersion"
                    :loading="loadingFeatures.android?.deviceInfo?.fridaVersion"
                    :font-size="fontSize"
                    @copy="copyToClipboard"
                    @clear="clearFeatureOutput"
                    @refresh="executeInfoFeature"
                  />
                </div>
              </div>
            </div>

            <!-- Android Network Section with SSL Pinning -->
            <div class="category-section">
              <div class="category-header" @click="toggleCategory('android', 'network')">
                <v-icon class="category-icon" :class="{ rotated: expandedCategories.android?.network }">
                  mdi-chevron-right
                </v-icon>
                <v-icon class="feature-icon">mdi-web</v-icon>
                <span class="category-title" :style="dynamicHeaderFontStyle">Network Security Monitor</span>
                <v-chip size="x-small" class="ml-2" :color="getCategoryStatus('android', 'network').color">
                  {{ getCategoryStatus('android', 'network').text }}
                </v-chip>
              </div>

              <div v-show="expandedCategories.android?.network" class="category-content">
                <!-- SSL Pinning Monitor Control -->
                <div class="feature-card ssl-pinning-card">
                  <div class="feature-header">
                    <div class="feature-info">
                      <v-icon size="small" class="mr-2" :color="features.android.network.sslPinning ? 'purple' : 'grey'">
                        {{ features.android.network.sslPinning ? 'mdi-shield-lock' : 'mdi-shield-lock-outline' }}
                      </v-icon>
                      <span class="feature-name" :style="dynamicHeaderFontStyle">SSL/TLS Pinning Security Monitor</span>
                      <v-chip size="x-small" class="ml-2" :color="features.android.network.sslPinning ? 'purple' : 'grey'">
                        {{ features.android.network.sslPinning ? 'ACTIVE' : 'INACTIVE' }}
                      </v-chip>
                      <v-chip size="x-small" class="ml-2" :color="androidSSLStats.activeHooks > 0 ? 'green' : 'grey'" v-if="features.android.network.sslPinning">
                        {{ androidSSLStats.activeHooks }} hooks
                      </v-chip>
                      <v-chip
                        v-if="features.android.network.sslPinning && androidSSLStats.bypassedHooks > 0"
                        size="x-small"
                        class="ml-2"
                        color="orange"
                      >
                        {{ androidSSLStats.bypassedHooks }} bypassing
                      </v-chip>
                    </div>
                    <v-switch
                      v-model="features.android.network.sslPinning"
                      density="compact"
                      hide-details
                      @update:model-value="onAndroidSSLPinningToggle"
                      :disabled="!agentLoaded"
                      color="purple"
                    ></v-switch>
                  </div>
                  <div class="feature-description" :style="dynamicFontStyle">
                    Comprehensive SSL/TLS pinning detection and bypass with individual hook control for security research
                  </div>

                  <!-- SSL Pinning Component -->
                  <SSLPinning
                    v-if="features.android.network.sslPinning"
                    :output-data="featureOutputs.android.network.sslPinning"
                    :platform="'android'"
                    :category="'Network-Security'"
                    :feature="'sslPinning'"
                    :loading="loadingFeatures.android?.network?.sslPinning"
                    :session-id="sessionId"
                    @execute="handleSSLPinningExecute"
                    @copy="copyToClipboard"
                    @export="exportSSLPinningData"
                    @show-notification="handleNotification"
                  />
                </div>

                <!-- Network Monitor Control (existing) -->
                <div class="feature-card network-card">
                  <div class="feature-header">
                    <div class="feature-info">
                      <v-icon size="small" class="mr-2" :color="features.android.network.networkMonitor ? 'green' : 'grey'">
                        {{ features.android.network.networkMonitor ? 'mdi-record-circle' : 'mdi-record-circle-outline' }}
                      </v-icon>
                      <span class="feature-name" :style="dynamicHeaderFontStyle">HTTP/HTTPS Security Monitor</span>
                      <v-chip size="x-small" class="ml-2" :color="features.android.network.networkMonitor ? 'blue' : 'grey'">
                        {{ features.android.network.networkMonitor ? 'MONITORING' : 'INACTIVE' }}
                      </v-chip>
                      <v-chip size="x-small" class="ml-2" :color="androidNetworkStats.totalRequests > 0 ? 'green' : 'grey'" v-if="features.android.network.networkMonitor">
                        {{ androidNetworkStats.totalRequests }} requests
                      </v-chip>
                      <v-chip
                        v-if="features.android.network.networkMonitor && androidSecurityStats.highRisk > 0"
                        size="x-small"
                        class="ml-2"
                        color="error"
                      >
                        {{ androidSecurityStats.highRisk }} HIGH RISK
                      </v-chip>
                    </div>
                    <v-switch
                      v-model="features.android.network.networkMonitor"
                      density="compact"
                      hide-details
                      @update:model-value="onAndroidNetworkMonitorToggle"
                      :disabled="!agentLoaded"
                      color="blue"
                    ></v-switch>
                  </div>
                  <div class="feature-description" :style="dynamicFontStyle">
                    Advanced security monitoring for Android HTTP/HTTPS requests with real-time threat detection and library identification
                  </div>

                  <!-- Android Network monitoring content -->
                  <div v-if="features.android.network.networkMonitor" class="feature-output">
                    <!-- Network monitoring UI -->
                  </div>
                </div>
              </div>
            </div>

            <!-- Android IPC Section -->
            <div class="category-section">
              <div class="category-header" @click="toggleCategory('android', 'ipc')">
                <v-icon class="category-icon" :class="{ rotated: expandedCategories.android?.ipc }">
                  mdi-chevron-right
                </v-icon>
                <v-icon class="feature-icon">mdi-swap-horizontal</v-icon>
                <span class="category-title" :style="dynamicHeaderFontStyle">IPC Security Monitor</span>
                <v-chip size="x-small" class="ml-2" :color="getCategoryStatus('android', 'ipc').color">
                  {{ getCategoryStatus('android', 'ipc').text }}
                </v-chip>
              </div>

              <div v-show="expandedCategories.android?.ipc" class="category-content">
                <!-- IPC Monitor Control -->
                <div class="feature-card ipc-card">
                  <div class="feature-header">
                    <div class="feature-info">
                      <v-icon size="small" class="mr-2" :color="features.android.ipc.ipcMonitor ? 'purple' : 'grey'">
                        {{ features.android.ipc.ipcMonitor ? 'mdi-record-circle' : 'mdi-record-circle-outline' }}
                      </v-icon>
                      <span class="feature-name" :style="dynamicHeaderFontStyle">Android IPC Security Monitor</span>
                      <v-chip size="x-small" class="ml-2" :color="features.android.ipc.ipcMonitor ? 'purple' : 'grey'">
                        {{ features.android.ipc.ipcMonitor ? 'MONITORING' : 'INACTIVE' }}
                      </v-chip>
                      <v-chip size="x-small" class="ml-2" :color="androidIPCStats.totalEvents > 0 ? 'green' : 'grey'" v-if="features.android.ipc.ipcMonitor">
                        {{ androidIPCStats.totalEvents }} events
                      </v-chip>
                    </div>
                    <v-switch
                      v-model="features.android.ipc.ipcMonitor"
                      density="compact"
                      hide-details
                      @update:model-value="onAndroidIPCMonitorToggle"
                      :disabled="!agentLoaded"
                      color="purple"
                    ></v-switch>
                  </div>
                  <div class="feature-description" :style="dynamicFontStyle">
                    Monitor Android Inter-Process Communication including Intents, Broadcasts, Content Providers, Binder calls, and Service operations with real-time security analysis
                  </div>

                  <!-- IPC Monitor Component -->
                  <IPCMonitor
                    v-if="features.android.ipc.ipcMonitor"
                    :output-data="featureOutputs.android.ipc.ipcMonitor"
                    :platform="'android'"
                    :category="'ipc'"
                    :feature="'ipcMonitor'"
                    :loading="loadingFeatures.android?.ipc?.ipcMonitor"
                    :session-id="sessionId"
                    :font-size="fontSize"
                    @copy="copyToClipboard"
                    @clear="clearIPCEvents"
                    @refresh="refreshIPCMonitor"
                    @export="exportIPCData"
                    @start-monitoring="startIPCMonitoring"
                    @stop-monitoring="stopIPCMonitoring"
                    @show-notification="handleNotification"
                  />
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>

    <!-- Status Bar -->
    <div class="status-bar">
      <span class="status-text" :style="dynamicFontStyle">
        Agent: <span :class="{ 'status-success': agentLoaded, 'status-error': agentError, 'status-warning': !agentLoaded && !agentError }">
          {{ agentLoaded ? 'Loaded' : agentError ? 'Error' : 'Not Loaded' }}
        </span>
        | Active: {{ totalActiveFeatures }}
        | Platform: {{ currentPlatform }}
        | Status: {{ connectionStatus }}
      </span>
      <v-spacer></v-spacer>
      <span class="keyboard-shortcuts" title="Keyboard shortcuts: Ctrl+A (expand all), Ctrl+C (collapse all), Ctrl+/- (font size), Ctrl+0 (reset font)">
        ⌨Ctrl+A|C|+|-|0
      </span>
    </div>

    <!-- Resize Handle -->
    <div class="resizer-handle"></div>

    <!-- Snackbar for notifications -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="snackbar.timeout">
      {{ snackbar.message }}
      <template v-slot:actions>
        <v-btn variant="text" @click="snackbar.show = false">
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </div>
</template>


<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import axios from 'axios'
import CryptoMonitor from "@/components/Frida/Dialogs/FridaHooks/iOS/Crypto/CryptoMonitor.vue";
import Browser from "@/components/Frida/Dialogs/FridaHooks/iOS/FileBrowser/Browser.vue";
import FridaVersionDisplay from "@/components/Frida/Dialogs/FridaHooks/Unified/FridaVersionDisplay.vue";
import DeviceInfo from "@/components/Frida/Dialogs/FridaHooks/Android/DeviceInfo.vue";
import IPCMonitor from "@/components/Frida/Dialogs/FridaHooks/Android/IPCMonitor.vue";
import SSLPinning from "@/components/Frida/Dialogs/FridaHooks/Android/SSLPinning.vue";

// Props
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: 'Frida Agent Control Panel'
  },
  sessionId: {
    type: String,
    default: ''
  },
  deviceId: {
    type: String,
    default: ''
  },
  pid: {
    type: Number,
    default: null
  }
})

// Emits
const emit = defineEmits(['close', 'feature-toggle'])

// Template refs
const dialogRef = ref(null)
const sectionsContent = ref(null)
const systemMonitorOutput = ref(null)
const methodTracingOutput = ref(null)
const networkMonitorOutput = ref(null)
const androidNetworkMonitorOutput = ref(null)

// ===== FONT SIZE MANAGEMENT =====
const fontSize = ref(12) // Default font size
const minFontSize = 10
const maxFontSize = 20
const fontSizeStep = 1

// Computed properties for dynamic font styles
const dynamicFontStyle = computed(() => ({
  fontSize: `${fontSize.value}px`,
  lineHeight: `${fontSize.value * 1.6}px`
}))

const dynamicHeaderFontStyle = computed(() => ({
  fontSize: `${fontSize.value + 2}px`,
  lineHeight: `${(fontSize.value + 2) * 1.5}px`
}))

const dynamicTitleFontStyle = computed(() => ({
  fontSize: `${fontSize.value + 4}px`,
  lineHeight: `${(fontSize.value + 4) * 1.5}px`
}))

// Font size control functions
const increaseFontSize = () => {
  if (fontSize.value < maxFontSize) {
    fontSize.value = Math.min(fontSize.value + fontSizeStep, maxFontSize)
    showNotification(`Font size increased to ${fontSize.value}px`, 'info', 2000)
    saveFontPreference()
  } else {
    showNotification('Maximum font size reached', 'warning', 2000)
  }
}

const decreaseFontSize = () => {
  if (fontSize.value > minFontSize) {
    fontSize.value = Math.max(fontSize.value - fontSizeStep, minFontSize)
    showNotification(`Font size decreased to ${fontSize.value}px`, 'info', 2000)
    saveFontPreference()
  } else {
    showNotification('Minimum font size reached', 'warning', 2000)
  }
}

const resetFontSize = () => {
  fontSize.value = 12
  showNotification('Font size reset to default', 'info', 2000)
  saveFontPreference()
}

// Save font preference to localStorage
const saveFontPreference = () => {
  try {
    localStorage.setItem('fridaClicks_fontSize', fontSize.value.toString())
  } catch (e) {
    console.warn('Unable to save font preference:', e)
  }
}

// Load font preference
const loadFontPreference = () => {
  try {
    const saved = localStorage.getItem('fridaClicks_fontSize')
    if (saved) {
      fontSize.value = Math.min(Math.max(parseInt(saved), minFontSize), maxFontSize)
    }
  } catch (e) {
    console.warn('Unable to load font preference:', e)
  }
}

// ===== iOS NETWORK MONITORING STATE =====
const networkRequests = ref([])
const expandedRequests = ref(new Set())
const showParsedNetwork = ref(true)
const networkSearch = ref('')
const securityFilter = ref('ALL')
const methodFilter = ref('ALL')
const activeRequestTab = reactive({})

// iOS Network statistics
const networkStats = reactive({
  totalRequests: 0,
  methodBreakdown: {
    GET: 0,
    POST: 0,
    PUT: 0,
    DELETE: 0,
    PATCH: 0,
    OPTIONS: 0,
    HEAD: 0,
    CONNECT: 0,
    TRACE: 0,
    OTHER: 0
  }
})

// iOS Security statistics
const securityStats = reactive({
  highRisk: 0,
  mediumRisk: 0,
  lowRisk: 0,
  authRequests: 0,
  piiRequests: 0,
  insecureRequests: 0
})

// ===== ANDROID NETWORK MONITORING STATE =====
const androidNetworkRequests = ref([])
const expandedAndroidRequests = ref(new Set())
const showAndroidParsedNetwork = ref(true)
const androidNetworkSearch = ref('')
const androidSecurityFilter = ref('ALL')
const androidMethodFilter = ref('ALL')
const activeAndroidRequestTab = reactive({})

// Android Network Statistics
const androidNetworkStats = reactive({
  totalRequests: 0,
  methodBreakdown: {
    GET: 0,
    POST: 0,
    PUT: 0,
    DELETE: 0,
    PATCH: 0,
    OPTIONS: 0,
    HEAD: 0,
    CONNECT: 0,
    TRACE: 0,
    OTHER: 0
  }
})

// Android Security Statistics
const androidSecurityStats = reactive({
  highRisk: 0,
  mediumRisk: 0,
  lowRisk: 0,
  authRequests: 0,
  piiRequests: 0,
  insecureRequests: 0
})

// ===== ANDROID IPC MONITORING STATE =====
const androidIPCStats = reactive({
  totalEvents: 0,
  byType: {
    intent: 0,
    broadcast: 0,
    content_provider: 0,
    binder: 0,
    service: 0
  }
})

// ===== ANDROID SSL PINNING STATE =====
const androidSSLStats = reactive({
  totalHooks: 0,
  activeHooks: 0,
  bypassedHooks: 0,
  totalEvents: 0
})

// Dialog positioning and sizing
const dialogSize = reactive({
  width: 1000,
  height: 800,
  top: 50,
  left: window.innerWidth - 1020,
})

const dialogStyle = reactive({
  position: 'fixed',
  zIndex: 9999,
  top: `${dialogSize.top}px`,
  left: `${dialogSize.left}px`,
  width: `${dialogSize.width}px`,
  height: `${dialogSize.height}px`,
})

// Agent state
const agentLoaded = ref(false)
const agentLoading = ref(false)
const agentUnloading = ref(false)
const agentError = ref(null)

// UI state
const isRefreshing = ref(false)
const loggingPaused = reactive({})

// Debug state
const debugLoading = ref(false)
const debugInfo = ref(null)

// Snackbar for notifications
const snackbar = reactive({
  show: false,
  message: '',
  color: 'info',
  timeout: 3000
})

// Section expansion state
const expandedSections = reactive({
  ios: true,
  android: false,
})

const expandedCategories = reactive({
  ios: {
    frida: true,
    deviceInfo: true,
    crypto: false,
    app: true,
    network: true,
    system: true,
    filesystem: true,
  },
  android: {
    frida: false,
    deviceInfo: true,
    ipc: true,
    app: false,
    network: true,
    system: false,
  },
})

// Feature toggles
const features = reactive({
  ios: {
    system: {
      systemMonitor: false,
    },
    crypto : {
      cryptoMonitor: false,
    },
    deviceInfo: {},
    filesystem: {
      browser: false,
      monitoring: false,
    },
    appInfo: {
      methodTracing: false,
    },
    network: {
      networkMonitor: false,
      sslPinning: false,
    },
  },
  android: {
    system: {
      systemMonitor: false,
    },
    deviceInfo: {
      androidVersion: null,
      fridaVersion: null,
    },
    ipc: {
      ipcMonitor: false,
    },
    appInfo: {
      methodTracing: false,
    },
    network: {
      networkMonitor: false,
      sslPinning: false,
    },
  },
})

// Feature outputs
const featureOutputs = reactive({
  ios: {
    frida: {
      fridaVersion: null,
      loadedBridges: null,
    },
    deviceInfo: {
      iOSDeviceInfo: null,
    },
    appInfo: {
      basicInfo: null,
      methodTracing: '',
    },
    network: {
      networkMonitor: '',
      sslPinning: null,
    },
    system: {
      getBatteryLevel: null,
      getBatteryState: null,
      getDeviceName: null,
      getDeviceModel: null,
      getDeviceScreenResolution: null,
      getDeviceOrientation: null,
      getCompleteDeviceInfo: null,
      systemMonitor: '',
    },
  },
  android: {
    frida: {},
    deviceInfo: {
      androidVersion: null,
      fridaVersion: null,
    },
    ipc: {
      ipcMonitor: null,
    },
    appInfo: {},
    network: {
      networkMonitor: '',
      sslPinning: null,
    },
    system: {},
  },
})

// Loading states
const loadingFeatures = reactive({
  ios: {
    frida: {
      fridaVersion: false,
      loadedBridges: false,
    },
    deviceInfo: {
      iOSDeviceInfo: false,
    },
    appInfo: {
      basicInfo: false,
    },
    system: {
      getBatteryLevel: false,
      getBatteryState: false,
      getDeviceName: false,
      getDeviceModel: false,
      getDeviceScreenResolution: false,
      getDeviceOrientation: false,
      getCompleteDeviceInfo: false,
    },
  },
  android: {
    frida: {},
    network: {
      networkMonitor: false,
      sslPinning: false,
    },
    deviceInfo: {
      androidVersion: false,
      fridaVersion: false,
    },
    ipc: {
      ipcMonitor: false,
    },
    appInfo: {},
    system: {},
  },
})

let eventSources = new Map()

// Filesystem stats
const filesystemStats = reactive({
  totalFiles: 0,
  totalDirectories: 0,
  operationsPerSecond: 0,
  totalOperations: 0
})


// ===== COMPUTED PROPERTIES =====

// iOS Computed properties
const uniqueDomains = computed(() => {
  const domains = new Set()
  networkRequests.value.forEach(req => {
    try {
      if (req.url && req.url !== 'unknown') {
        const url = new URL(req.url)
        domains.add(url.hostname)
      }
    } catch (e) {
      const match = req.url?.match(/https?:\/\/([^\/]+)/)
      if (match) {
        domains.add(match[1])
      }
    }
  })
  return Array.from(domains)
})

const filteredNetworkRequests = computed(() => {
  let filtered = networkRequests.value;

  if (networkSearch.value) {
    const search = networkSearch.value.toLowerCase();
    filtered = filtered.filter(req =>
      req.url.toLowerCase().includes(search) ||
      JSON.stringify(req.headers).toLowerCase().includes(search) ||
      (req.body && req.body.toLowerCase().includes(search)) ||
      (req.responseBody && req.responseBody.toLowerCase().includes(search))
    );
  }

  if (methodFilter.value !== 'ALL') {
    filtered = filtered.filter(req => req.method === methodFilter.value);
  }

  if (securityFilter.value !== 'ALL') {
    filtered = filtered.filter(req => {
      const security = getSecurityRisk(req);
      switch (securityFilter.value) {
        case 'HIGH': return security.risk === 'HIGH';
        case 'MEDIUM': return security.risk === 'MEDIUM';
        case 'LOW': return security.risk === 'LOW';
        case 'NONE': return security.risk === 'NONE';
        case 'AUTH': return hasAuthHeaders(req);
        case 'PII': return hasPII(req);
        case 'INSECURE': return req.url.startsWith('http://');
        default: return true;
      }
    });
  }

  return filtered;
})

// Android Computed properties
const androidUniqueDomains = computed(() => {
  const domains = new Set()
  androidNetworkRequests.value.forEach(req => {
    try {
      if (req.url && req.url !== 'unknown') {
        const url = new URL(req.url)
        domains.add(url.hostname)
      }
    } catch (e) {
      const match = req.url?.match(/https?:\/\/([^\/]+)/)
      if (match) {
        domains.add(match[1])
      }
    }
  })
  return Array.from(domains)
})

const androidUniqueLibraries = computed(() => {
  const libraries = new Set()
  androidNetworkRequests.value.forEach(req => {
    if (req.library) {
      libraries.add(req.library)
    }
  })
  return Array.from(libraries)
})

const filteredAndroidNetworkRequests = computed(() => {
  let filtered = androidNetworkRequests.value;

  if (androidNetworkSearch.value) {
    const search = androidNetworkSearch.value.toLowerCase();
    filtered = filtered.filter(req =>
      req.url.toLowerCase().includes(search) ||
      JSON.stringify(req.headers).toLowerCase().includes(search) ||
      (req.body && req.body.toLowerCase().includes(search)) ||
      (req.responseBody && req.responseBody.toLowerCase().includes(search)) ||
      (req.library && req.library.toLowerCase().includes(search))
    );
  }

  if (androidMethodFilter.value !== 'ALL') {
    filtered = filtered.filter(req => req.method === androidMethodFilter.value);
  }

  if (androidSecurityFilter.value !== 'ALL') {
    filtered = filtered.filter(req => {
      const security = getSecurityRisk(req);
      switch (androidSecurityFilter.value) {
        case 'HIGH': return security.risk === 'HIGH';
        case 'MEDIUM': return security.risk === 'MEDIUM';
        case 'LOW': return security.risk === 'LOW';
        case 'NONE': return security.risk === 'NONE';
        case 'AUTH': return hasAuthHeaders(req);
        case 'PII': return hasPII(req);
        case 'INSECURE': return req.url.startsWith('http://');
        default: return true;
      }
    });
  }

  return filtered;
})

// Filter options
const securityFilterOptions = [
  { title: 'All Requests', value: 'ALL' },
  { title: 'High Risk', value: 'HIGH' },
  { title: 'Medium Risk', value: 'MEDIUM' },
  { title: 'Low Risk', value: 'LOW' },
  { title: 'No Risk', value: 'NONE' },
  { title: 'Has Auth', value: 'AUTH' },
  { title: 'Has PII', value: 'PII' },
  { title: 'Insecure HTTP', value: 'INSECURE' }
]

const methodFilterOptions = [
  { title: 'All Methods', value: 'ALL' },
  { title: 'GET', value: 'GET' },
  { title: 'POST', value: 'POST' },
  { title: 'PUT', value: 'PUT' },
  { title: 'DELETE', value: 'DELETE' },
  { title: 'PATCH', value: 'PATCH' },
  { title: 'OPTIONS', value: 'OPTIONS' }
]

// General computed properties
const getActiveCount = (platform) => {
  let count = 0
  Object.values(features[platform]).forEach(category => {
    Object.values(category).forEach(feature => {
      if (feature) count++
    })
  })
  return count
}

const totalActiveFeatures = computed(() => {
  let count = 0
  Object.keys(features).forEach(platform => {
    count += getActiveCount(platform)
  })
  return count
})

const currentPlatform = computed(() => {
  if (getActiveCount('ios') > 0) return 'iOS'
  if (getActiveCount('android') > 0) return 'Android'
  return 'None'
})

const connectionStatus = computed(() => {
  if (!agentLoaded.value) return 'No Agent'
  return totalActiveFeatures.value > 0 ? 'Active' : 'Ready'
})

// Parse battery info
const parsedBatteryInfo = computed(() => {
  const output = featureOutputs.ios?.system?.getBatteryLevel
  if (!output) return null

  try {
    let data = output
    if (typeof output === 'string') {
      data = JSON.parse(output)
    }

    if (data.data && data.data.data) {
      data = data.data.data
    } else if (data.data) {
      data = data.data
    }

    let batteryLevel = data.percentage || (data.level ? Math.round(data.level * 100) : 0)

    let batteryState = 'Unknown'
    if (data.batteryState) {
      batteryState = data.batteryState
    } else if (data.state) {
      batteryState = data.state
    } else if (data.isUnknown === false) {
      batteryState = 'Normal'
    }

    return {
      level: batteryLevel,
      state: batteryState,
      stateClass: batteryState === 'Charging' ? 'charging' : batteryState === 'Full' ? 'full' : 'normal',
      timestamp: data.timestamp || null,
      isUnknown: data.isUnknown || false
    }
  } catch (error) {
    console.error('Error parsing battery info:', error)
    return null
  }
})

// Parse app info
const parsedAppInfo = computed(() => {
  try {
    const basicInfoData = featureOutputs.ios?.appInfo?.basicInfo

    if (!basicInfoData) {
      return {}
    }

    let appData = basicInfoData

    if (typeof basicInfoData === 'object' && basicInfoData !== null) {
      if (basicInfoData.success && basicInfoData.data && basicInfoData.data.data) {
        appData = basicInfoData.data.data
      } else if (basicInfoData.data && typeof basicInfoData.data === 'object') {
        appData = basicInfoData.data
      } else {
        appData = basicInfoData
      }

      return {
        appName: appData.appName || appData.name || 'N/A',
        bundleId: appData.appIdentifier || appData.bundleId || appData.identifier || 'N/A',
        version: appData.appVersion || appData.version || 'N/A',
        build: appData.appBuild || appData.build || appData.buildNumber || 'N/A',
        executable: appData.appExecutableName || appData.executable || appData.executableName || 'N/A',
        appPath: appData.appPath || appData.path || 'N/A',
        resourcesPath: appData.appResourcesPath || appData.resourcesPath || 'N/A',
        executablePath: appData.appExecutablePath || appData.executablePath || 'N/A',
        displayName: appData.displayName || appData.appDisplayName || 'N/A',
        bundlePath: appData.bundlePath || 'N/A',
        dataPath: appData.dataPath || appData.appDataPath || 'N/A',
        documentsPath: appData.documentsPath || appData.appDocumentsPath || 'N/A',
        libraryPath: appData.libraryPath || appData.appLibraryPath || 'N/A',
        tmpPath: appData.tmpPath || appData.appTmpPath || 'N/A',
        architecture: appData.architecture || appData.arch || 'N/A',
        platform: appData.platform || 'N/A',
        sdkVersion: appData.sdkVersion || appData.sdk || 'N/A',
        minimumOSVersion: appData.minimumOSVersion || appData.minOSVersion || 'N/A',
        teamIdentifier: appData.teamIdentifier || appData.teamID || 'N/A',
        _rawData: appData
      }
    }

    if (typeof basicInfoData === 'string') {
      const parsed = JSON.parse(basicInfoData)
      return {
        appName: parsed.appName || parsed.name || 'N/A',
        bundleId: parsed.appIdentifier || parsed.bundleId || 'N/A',
        version: parsed.appVersion || parsed.version || 'N/A',
        build: parsed.appBuild || parsed.build || 'N/A',
        executable: parsed.appExecutableName || parsed.executable || 'N/A',
        appPath: parsed.appPath || parsed.path || 'N/A',
        _rawData: parsed
      }
    }

  } catch (e) {
    console.warn('Error parsing app info:', e)
    console.log('Raw data:', featureOutputs.ios?.appInfo?.basicInfo)

    const output = featureOutputs.ios?.appInfo?.basicInfo || ''
    if (typeof output === 'string') {
      return {
        bundleId: extractValue(output, 'Bundle ID'),
        version: extractValue(output, 'Version'),
        executable: extractValue(output, 'Executable'),
        appName: extractValue(output, 'App Name'),
        _rawData: output
      }
    }
  }

  return {}
})

// Parse iOS device info from getiOSDeviceInfo RPC call
const parsediOSDeviceInfo = computed(() => {
  try {
    const raw = featureOutputs.ios?.deviceInfo?.iOSDeviceInfo
    if (!raw) return {}

    let data = raw
    if (typeof raw === 'object' && raw !== null) {
      if (raw.success && raw.data) {
        data = raw.data
      } else if (raw.data) {
        data = raw.data
      }
    } else if (typeof raw === 'string') {
      data = JSON.parse(raw)
      if (data.data) data = data.data
    }

    const result = {}
    if (data.name) result.deviceName = data.name
    if (data.systemName) result.system = `${data.systemName} ${data.systemVersion || ''}`
    else if (data.systemVersion) result.systemVersion = data.systemVersion
    if (data.model) result.model = data.model
    if (data.localizedModel) result.localizedModel = data.localizedModel
    if (data.identifierForVendor) result.vendorId = data.identifierForVendor
    if (data.bundleIdentifier) result.bundleId = data.bundleIdentifier
    if (data.appVersion) result.appVersion = `${data.appVersion}${data.buildVersion ? ` (${data.buildVersion})` : ''}`
    if (data.processorCount) result.processors = data.processorCount
    if (data.physicalMemory) result.memory = `${(data.physicalMemory / (1024 * 1024 * 1024)).toFixed(1)} GB`
    if (data.batteryLevel !== undefined) result.battery = `${Math.round(data.batteryLevel * 100)}%`
    if (data.orientation) result.orientation = data.orientation

    return Object.keys(result).length > 0 ? result : data
  } catch (e) {
    console.warn('Error parsing iOS device info:', e)
    return {}
  }
})

// ===== HELPER FUNCTIONS =====

const extractValue = (text, key) => {
  const regex = new RegExp(`${key}:\\s*(.+?)(?:\\n|$)`, 'i')
  const match = text.match(regex)
  return match ? match[1].trim() : null
}

const showNotification = (message, color = 'info', timeout = 3000) => {
  snackbar.message = message
  snackbar.color = color
  snackbar.timeout = timeout
  snackbar.show = true
}

const getOutputLineCount = (platform, category, feature) => {
  const output = featureOutputs[platform]?.[category]?.[feature] || ''
  return output.split('\n').length - 1
}

const formatDeviceOutput = (data) => {
  if (!data) return 'No data available'

  try {
    let actualData = data
    if (typeof data === 'object' && data.success !== undefined) {
      if (data.data && typeof data.data === 'object') {
        actualData = data.data
      }
    }

    if (typeof actualData === 'object') {
      return JSON.stringify(actualData, null, 2)
    } else {
      return String(actualData)
    }
  } catch (error) {
    return `Error formatting output: ${error.message}\n\nRaw data: ${data}`
  }
}

const formatLabel = (key) => {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
}

const getBatteryLevelClass = (level) => {
  if (level >= 60) return 'high'
  if (level >= 30) return 'medium'
  if (level >= 15) return 'low'
  return 'critical'
}

// ===== SECURITY ANALYSIS FUNCTIONS =====

const getSecurityRisk = (request) => {
  let riskScore = 0;
  let findings = [];

  // Check for sensitive headers
  const sensitiveHeaders = ['authorization', 'x-session-id', 'x-api-key', 'cookie', 'x-auth-token'];
  Object.keys(request.headers || {}).forEach(header => {
    if (sensitiveHeaders.some(sensitive => header.toLowerCase().includes(sensitive))) {
      riskScore += 2;
      findings.push(`Sensitive header: ${header}`);
    }
  });

  // Check for PII in body
  const piiPatterns = [
    /email.*["\']([^"']+@[^"']+)["\']/,
    /phone.*["\']([+\d\s-()]+)["\']/,
    /ssn.*["\'](\d{3}-\d{2}-\d{4})["\']/,
    /password.*["\']([^"']+)["\']/
  ];

  const bodyText = request.body || '';
  piiPatterns.forEach(pattern => {
    if (pattern.test(bodyText)) {
      riskScore += 3;
      findings.push('PII detected in request body');
    }
  });

  // Check response for sensitive data
  const responseText = request.responseBody || '';
  piiPatterns.forEach(pattern => {
    if (pattern.test(responseText)) {
      riskScore += 3;
      findings.push('PII detected in response body');
    }
  });

  // Check for unencrypted HTTP
  if (request.url.startsWith('http://')) {
    riskScore += 5;
    findings.push('Unencrypted HTTP connection');
  }

  // Check for error responses
  if (request.error) {
    riskScore += 1;
    findings.push('Network error occurred');
  }

  return {
    score: Math.min(riskScore, 10),
    risk: riskScore >= 7 ? 'HIGH' : riskScore >= 4 ? 'MEDIUM' : riskScore >= 1 ? 'LOW' : 'NONE',
    findings
  };
}

const getSecurityRiskColor = (request) => {
  const risk = getSecurityRisk(request).risk;
  switch (risk) {
    case 'HIGH': return 'error';
    case 'MEDIUM': return 'warning';
    case 'LOW': return 'orange';
    default: return 'success';
  }
}

const hasAuthHeaders = (request) => {
  const authHeaders = ['authorization', 'x-session-id', 'x-api-key', 'cookie', 'x-auth-token'];
  return Object.keys(request.headers || {}).some(header =>
    authHeaders.some(auth => header.toLowerCase().includes(auth))
  );
}

const hasPII = (request) => {
  const piiPatterns = [
    /email.*["\']([^"']+@[^"']+)["\']/,
    /phone.*["\']([+\d\s-()]+)["\']/,
    /ssn.*["\'](\d{3}-\d{2}-\d{4})["\']/,
    /password.*["\']([^"']+)["\']/
  ];

  const text = (request.body || '') + (request.responseBody || '');
  return piiPatterns.some(pattern => pattern.test(text));
}

const isSensitiveHeader = (key) => {
  const sensitiveHeaders = ['authorization', 'x-session-id', 'x-api-key', 'cookie', 'x-auth-token', 'x-csrf-token'];
  return sensitiveHeaders.some(sensitive => key.toLowerCase().includes(sensitive));
}

const maskSensitiveData = (value, key) => {
  return value;
}

const getDomain = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

const getPath = (url) => {
  try {
    return new URL(url).pathname;
  } catch {
    return '/';
  }
}

const getDomainRiskColor = (domain) => {
  if (domain.includes('analytics') || domain.includes('tracking')) return 'warning';
  if (domain.includes('ads') || domain.includes('doubleclick')) return 'orange';
  return 'blue';
}

const isDomainSuspicious = (domain) => {
  const suspiciousKeywords = ['tracking', 'analytics', 'ads', 'doubleclick', 'googletagmanager'];
  return suspiciousKeywords.some(keyword => domain.includes(keyword));
}

const getMethodColor = (method) => {
  const colors = {
    GET: 'green',
    POST: 'blue',
    PUT: 'orange',
    DELETE: 'red',
    PATCH: 'purple',
    OPTIONS: 'grey',
    HEAD: 'cyan',
    CONNECT: 'teal',
    TRACE: 'pink',
    OTHER: 'brown'
  }
  return colors[method] || 'grey'
}

const getMethodColorHex = (method) => {
  const colors = {
    GET: '#4CAF50',
    POST: '#2196F3',
    PUT: '#FF9800',
    DELETE: '#F44336',
    PATCH: '#9C27B0',
    OPTIONS: '#607D8B',
    HEAD: '#00BCD4',
    OTHER: '#795548'
  };
  return colors[method] || '#9E9E9E';
}

const getStatusColor = (statusCode) => {
  if (!statusCode) return 'grey'

  if (statusCode >= 200 && statusCode < 300) return 'green'
  if (statusCode >= 300 && statusCode < 400) return 'blue'
  if (statusCode >= 400 && statusCode < 500) return 'orange'
  if (statusCode >= 500) return 'red'
  return 'grey'
}

const getEnhancedRequestClass = (request) => {
  const classes = [`method-${(request.method || 'unknown').toLowerCase()}`];
  const security = getSecurityRisk(request);

  if (request.error) classes.push('has-error');
  if (request.responseBody || request.statusCode) classes.push('has-response');
  if (request.body) classes.push('has-request-body');
  if (security.risk === 'HIGH') classes.push('high-risk');
  if (security.risk === 'MEDIUM') classes.push('medium-risk');

  return classes;
}

// Android-specific helper functions
const getLibraryColor = (library) => {
  const colors = {
    'OkHttp': 'green',
    'HttpURLConnection': 'blue',
    'Volley': 'orange',
    'Retrofit': 'purple',
    'Unknown': 'grey'
  }
  return colors[library] || 'grey'
}

const getLibraryIcon = (library) => {
  const icons = {
    'OkHttp': 'mdi-network',
    'HttpURLConnection': 'mdi-lan',
    'Volley': 'mdi-flash',
    'Retrofit': 'mdi-api',
    'Unknown': 'mdi-help-circle'
  }
  return icons[library] || 'mdi-help-circle'
}

const formatTimestamp = (timestamp) => {
  try {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch (e) {
    return timestamp || 'Invalid'
  }
}

const formatBytes = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const formatJsonBody = (body) => {
  if (!body) return ''

  try {
    const parsed = JSON.parse(body)
    return JSON.stringify(parsed, null, 2)
  } catch (e) {
    try {
      const decoded = decodeURIComponent(body)
      if (decoded !== body) {
        return decoded
      }
    } catch (e2) {
      // Not URL encoded either
    }

    return body
  }
}


// ===== SECTION MANAGEMENT =====

const toggleSection = (section) => {
  expandedSections[section] = !expandedSections[section]
}

const toggleCategory = (section, category) => {
  if (!expandedCategories[section]) {
    expandedCategories[section] = {}
  }
  expandedCategories[section][category] = !expandedCategories[section][category]
}

const getCategoryStatus = (section, category) => {
  if (category === 'frida') {
    return {
      color: 'blue',
      text: 'Available'
    }
  }

  if (category === 'network') {
    const networkActive = features[section][category]?.networkMonitor || false
    const sslActive = features[section][category]?.sslPinning || false

    if (networkActive || sslActive) {
      return {
        color: networkActive && sslActive ? 'purple' : 'blue',
        text: networkActive && sslActive ? 'Multiple Active' :
              networkActive ? 'Network Monitoring' : 'SSL Monitoring'
      }
    }
    return {
      color: 'grey',
      text: 'Available'
    }
  }

  if (category === 'ipc') {
    const isActive = features[section][category]?.ipcMonitor || false
    return {
      color: isActive ? 'purple' : 'grey',
      text: isActive ? 'Monitoring' : 'Available'
    }
  }

  if (category === 'filesystem') {
    const browserActive = features[section][category]?.browser || false
    const monitoringActive = features[section][category]?.monitoring || false

    if (browserActive || monitoringActive) {
      return {
        color: 'blue',
        text: browserActive && monitoringActive ? 'Active + Monitoring' :
               browserActive ? 'Browser Active' : 'Monitoring'
      }
    }
    return {
      color: 'grey',
      text: 'Available'
    }
  }

  if (category === 'crypto') {
    const isActive = features[section][category]?.cryptoMonitor || false
    return {
      color: isActive ? 'purple' : 'grey',
      text: isActive ? 'Monitoring' : 'Available'
    }
  }

  const isActive = Object.values(features[section][category] || {}).some(v => v)
  return {
    color: isActive ? 'green' : 'blue',
    text: isActive ? 'Active' : 'Available'
  }
}

const collapseAll = () => {
  Object.keys(expandedSections).forEach(section => {
    expandedSections[section] = false
  })
  Object.keys(expandedCategories).forEach(section => {
    Object.keys(expandedCategories[section]).forEach(category => {
      expandedCategories[section][category] = false
    })
  })
}

const expandAll = () => {
  Object.keys(expandedSections).forEach(section => {
    expandedSections[section] = true
  })
  Object.keys(expandedCategories).forEach(section => {
    Object.keys(expandedCategories[section]).forEach(category => {
      expandedCategories[section][category] = true
    })
  })
}

// ===== AGENT MANAGEMENT =====

const loadAgent = async () => {
  if (agentLoading.value || agentLoaded.value) return

  agentLoading.value = true
  agentError.value = null

  try {
    const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/load-agent`, {
      device_id: props.deviceId,
      pid: props.pid,
      session_id: props.sessionId || 'default',
    })

    if (response.data.status === 'success') {
      agentLoaded.value = true
      showNotification('Frida agent loaded successfully', 'success')
    } else {
      throw new Error(response.data.message || 'Failed to load agent')
    }
  } catch (error) {
    console.error('Error loading agent:', error)
    agentError.value = error.response?.data?.message || error.message
    showNotification(`Failed to load agent: ${agentError.value}`, 'error', 5000)
  } finally {
    agentLoading.value = false
  }
}

const unloadAgent = async () => {
  if (!agentLoaded.value) return

  agentUnloading.value = true

  try {
    const activeFeatures = []
    Object.keys(features).forEach(platform => {
      Object.keys(features[platform]).forEach(category => {
        Object.keys(features[platform][category]).forEach(feature => {
          if (features[platform][category][feature]) {
            activeFeatures.push({ platform, category, feature })
          }
        })
      })
    })

    for (const { platform, category, feature } of activeFeatures) {
      features[platform][category][feature] = false
      await stopLoggingFeature(platform, category, feature)
    }

    // Reset both iOS and Android network stats
    networkStats.totalRequests = 0
    Object.keys(networkStats.methodBreakdown).forEach(method => {
      networkStats.methodBreakdown[method] = 0
    })
    updateSecurityStats()

    androidNetworkStats.totalRequests = 0
    Object.keys(androidNetworkStats.methodBreakdown).forEach(method => {
      androidNetworkStats.methodBreakdown[method] = 0
    })
    updateAndroidSecurityStats()

    // Reset Android IPC stats
    androidIPCStats.totalEvents = 0
    Object.keys(androidIPCStats.byType).forEach(type => {
      androidIPCStats.byType[type] = 0
    })

    // Reset Android SSL stats
    androidSSLStats.totalHooks = 0
    androidSSLStats.activeHooks = 0
    androidSSLStats.bypassedHooks = 0
    androidSSLStats.totalEvents = 0

    const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/unload-agent`, {
      session_id: props.sessionId || 'default',
    })

    if (response.data.status === 'success') {
      agentLoaded.value = false
      agentError.value = null
      showNotification('Agent unloaded successfully', 'success')
    } else {
      throw new Error(response.data.message || 'Failed to unload agent')
    }
  } catch (error) {
    console.error('Error unloading agent:', error)
    showNotification(`Failed to unload agent: ${error.message}`, 'error')
  } finally {
    agentUnloading.value = false
  }
}

const refreshAgent = async () => {
  isRefreshing.value = true
  try {
    eventSources.forEach((source, key) => {
      source.close()
    })
    eventSources.clear()

    showNotification('Agent refreshed successfully', 'success')
  } catch (error) {
    console.error('Error refreshing agent:', error)
    showNotification('Failed to refresh agent', 'error')
  } finally {
    isRefreshing.value = false
  }
}


// ===== FEATURE EXECUTION =====

const executeInfoFeature = async (platform, category, feature) => {
  if (!agentLoaded.value) {
    await loadAgent()
    if (!agentLoaded.value) {
      showNotification('Cannot execute feature: Agent not loaded', 'error')
      return
    }
  }

  loadingFeatures[platform][category][feature] = true

  try {
    const featureMap = {
      'ios.frida.fridaVersion': 'frida_version',
      'ios.frida.loadedBridges': 'frida_loaded_bridges',
      'ios.deviceInfo.iOSDeviceInfo': 'getiOSDeviceInfo',
      'ios.appInfo.basicInfo': 'basic_ios_info',
      'android.deviceInfo.fridaVersion': 'frida_version',
      'android.deviceInfo.loadedBridges': 'frida_loaded_bridges',
    }

    const featureKey = `${platform}.${category}.${feature}`
    const rpcMethod = featureMap[featureKey]

    if (rpcMethod) {
      const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
        session_id: props.sessionId || 'default',
        command: `${rpcMethod}()`,
      })

      if (response.data.status === 'success') {
        const result = response.data.result || response.data.output || 'Feature executed successfully'
        featureOutputs[platform][category][feature] = result

        console.log(`Feature ${platform}.${category}.${feature} result:`, result)
        showNotification(`${feature} executed successfully`, 'success')
      } else {
        const errorMsg = `Error: ${response.data.message}`
        featureOutputs[platform][category][feature] = errorMsg
        showNotification(errorMsg, 'error')
      }
    } else {
      showNotification(`Feature ${feature} not mapped to agent RPC`, 'warning')
      console.warn(`No RPC mapping found for ${featureKey}`)
    }
  } catch (error) {
    console.error('Error executing feature:', error)
    const errorMsg = `Error: ${error.response?.data?.message || error.message}`
    featureOutputs[platform][category][feature] = errorMsg
    showNotification(errorMsg, 'error')
  } finally {
    loadingFeatures[platform][category][feature] = false
  }
}

const executeSystemMonitorFeature = async (feature) => {
  if (!agentLoaded.value) {
    await loadAgent()
    if (!agentLoaded.value) {
      showNotification('Cannot execute feature: Agent not loaded', 'error')
      return
    }
  }

  if (!loadingFeatures.ios.system[feature]) {
    loadingFeatures.ios.system[feature] = false
  }

  loadingFeatures.ios.system[feature] = true

  try {
    const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
      session_id: props.sessionId || 'default',
      command: `${feature}()`,
    })

    if (response.data.status === 'success') {
      const result = response.data.result || response.data.output || 'Feature executed successfully'
      featureOutputs.ios.system[feature] = result

      console.log(`Feature ios.system.${feature} result:`, result)
      showNotification(`${feature} executed successfully`, 'success')
    } else {
      const errorMsg = `Error: ${response.data.message}`
      featureOutputs.ios.system[feature] = errorMsg
      showNotification(errorMsg, 'error')
    }
  } catch (error) {
    console.error('Error executing system monitor feature:', error)
    const errorMsg = `Error: ${error.response?.data?.message || error.message}`
    featureOutputs.ios.system[feature] = errorMsg
    showNotification(errorMsg, 'error')
  } finally {
    loadingFeatures.ios.system[feature] = false
  }
}

const executeAndroidDeviceFeature = async (feature) => {
  const featureName = typeof feature === 'string' ? feature : 'androidVersion';

  if (!agentLoaded.value) {
    await loadAgent()
    if (!agentLoaded.value) {
      showNotification('Cannot execute feature: Agent not loaded', 'error')
      return
    }
  }

  if (!loadingFeatures.android.deviceInfo[featureName]) {
    loadingFeatures.android.deviceInfo[featureName] = false
  }

  loadingFeatures.android.deviceInfo[featureName] = true

  try {
    const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
      session_id: props.sessionId || 'default',
      command: `${featureName === 'androidVersion' ? 'getAndroidDeviceInfo' : featureName}()`,
    })

    if (response.data.status === 'success') {
      const result = response.data.result || response.data.output || 'Feature executed successfully'
      featureOutputs.android.deviceInfo[featureName] = result

      console.log(`Feature android.deviceInfo.${featureName} result:`, result)
      showNotification(`${featureName} executed successfully`, 'success')
    } else {
      const errorMsg = `Error: ${response.data.message}`
      featureOutputs.android.deviceInfo[featureName] = errorMsg
      showNotification(errorMsg, 'error')
    }
  } catch (error) {
    console.error('Error executing Android device feature:', error)
    const errorMsg = `Error: ${error.response?.data?.message || error.message}`
    featureOutputs.android.deviceInfo[featureName] = errorMsg
    showNotification(errorMsg, 'error')
  } finally {
    loadingFeatures.android.deviceInfo[featureName] = false
  }
}

const executeDebugInfo = async () => {
  if (!agentLoaded.value) {
    await loadAgent()
    if (!agentLoaded.value) {
      showNotification('Cannot get debug info: Agent not loaded', 'error')
      return
    }
  }

  debugLoading.value = true
  debugInfo.value = null

  try {
    const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
      session_id: props.sessionId || 'default',
      command: 'debugInfo()',
    })

    if (response.data.status === 'success') {
      debugInfo.value = response.data.result || response.data.output
      showNotification('Debug info retrieved successfully', 'success')
    } else {
      const errorMsg = `Debug info failed: ${response.data.message}`
      debugInfo.value = { error: errorMsg }
      showNotification(errorMsg, 'error')
    }
  } catch (error) {
    console.error('Error getting debug info:', error)
    const errorMsg = `Error: ${error.response?.data?.message || error.message}`
    debugInfo.value = { error: errorMsg }
    showNotification(errorMsg, 'error')
  } finally {
    debugLoading.value = false
  }
}

const refreshAppInfo = async () => {
  await executeInfoFeature('ios', 'appInfo', 'basicInfo')
}


// ===== ANDROID SSL PINNING FUNCTIONS =====

const onAndroidSSLPinningToggle = async (enabled) => {
  if (enabled && !agentLoaded.value) {
    await loadAgent()
    if (!agentLoaded.value) {
      features.android.network.sslPinning = false
      showNotification('Cannot start SSL Pinning monitor: Agent not loaded', 'error')
      return
    }
  }

  try {
    if (enabled) {
      // Discover SSL hooks first
      await executeSSLPinningFeature('discoverSSLHooks')
      showNotification('SSL Pinning monitor activated', 'success')
    } else {
      // Disable all hooks when toggling off
      await executeSSLPinningFeature('disableAllSSLHooks')
      showNotification('SSL Pinning monitor deactivated', 'info')
    }
  } catch (error) {
    console.error('Error toggling SSL Pinning monitor:', error)
    features.android.network.sslPinning = !enabled
    showNotification(`Error toggling SSL Pinning monitor: ${error.message}`, 'error')
  }
}

const executeSSLPinningFeature = async (method, ...args) => {
  try {
    const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
      session_id: props.sessionId || 'default',
      command: args.length > 0 ? `${method}(${args.map(a => JSON.stringify(a)).join(', ')})` : `${method}()`,
    })

    if (response.data.status === 'success') {
      const result = response.data.result || response.data.output

      // Update stats if we got hook status
      if (method === 'getSSLHookStatus' && result?.stats) {
        androidSSLStats.totalHooks = result.stats.totalHooks || 0
        androidSSLStats.activeHooks = result.stats.enabledHooks || 0
        androidSSLStats.bypassedHooks = result.hooks?.filter(h => h.bypassActive).length || 0
      }

      return result
    } else {
      throw new Error(response.data.message || 'Failed to execute SSL Pinning feature')
    }
  } catch (error) {
    console.error('Error executing SSL Pinning feature:', error)
    throw error
  }
}

const handleSSLPinningExecute = async (method, ...args) => {
  loadingFeatures.android.network.sslPinning = true
  try {
    const result = await executeSSLPinningFeature(method, ...args)

    // Update output data for certain methods
    if (['getSSLHookStatus', 'getSSLEvents'].includes(method)) {
      featureOutputs.android.network.sslPinning = result
    }

    return result
  } catch (error) {
    showNotification(`SSL Pinning error: ${error.message}`, 'error')
    throw error
  } finally {
    loadingFeatures.android.network.sslPinning = false
  }
}

const exportSSLPinningData = (data) => {
  try {
    const exportData = {
      exportInfo: {
        timestamp: new Date().toISOString(),
        sessionId: props.sessionId,
        deviceId: props.deviceId,
        pid: props.pid,
        platform: 'android'
      },
      ...data
    }

    const dataStr = JSON.stringify(exportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `android_ssl_pinning_analysis_${props.sessionId}_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showNotification('SSL Pinning analysis exported successfully', 'success')
  } catch (error) {
    console.error('SSL Pinning export error:', error)
    showNotification('Failed to export SSL Pinning data', 'error')
  }
}


// ===== FEATURE MANAGEMENT =====

const onFeatureToggle = async (platform, category, feature, type) => {
  const isEnabled = features[platform][category][feature]

  if (isEnabled && !agentLoaded.value) {
    await loadAgent()
    if (!agentLoaded.value) {
      features[platform][category][feature] = false
      showNotification('Cannot start feature: Agent not loaded', 'error')
      return
    }
  }

  emit('feature-toggle', {
    platform,
    category,
    feature,
    enabled: isEnabled,
    type
  })

  try {
    if (type === 'logging') {
      if (isEnabled) {
        await startLoggingFeature(platform, category, feature)
        showNotification(`Started ${feature} logging`, 'success')
      } else {
        await stopLoggingFeature(platform, category, feature)
        showNotification(`Stopped ${feature} logging`, 'info')
      }
    }
  } catch (error) {
    console.error(`Error toggling feature ${platform}.${category}.${feature}:`, error)
    features[platform][category][feature] = !isEnabled
    showNotification(`Error toggling ${feature}: ${error.message}`, 'error')
  }
}

const startLoggingFeature = async (platform, category, feature) => {
  const eventSourceKey = `${platform}-${category}-${feature}`

  if (eventSources.has(eventSourceKey)) {
    eventSources.get(eventSourceKey).close()
    eventSources.delete(eventSourceKey)
  }

  try {
    const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/start-feature`, {
      session_id: props.sessionId || 'default',
      device_id: props.deviceId,
      pid: props.pid,
      platform,
      category,
      feature,
    })

    if (response.data.status === 'success') {
      const eventSource = new EventSource(
        `${import.meta.env.VITE_APP_API_URL}/frida/feature-stream/${props.sessionId || 'default'}/${platform}/${category}/${feature}`
      )

      eventSource.onmessage = (event) => {
        if (!loggingPaused[eventSourceKey]) {
          if (!featureOutputs[platform][category][feature]) {
            featureOutputs[platform][category][feature] = ''
          }
          featureOutputs[platform][category][feature] += event.data + '\n'

          const lines = featureOutputs[platform][category][feature].split('\n')
          if (lines.length > 2000) {
            featureOutputs[platform][category][feature] = lines.slice(-2000).join('\n')
          }

          nextTick(() => {
            if (methodTracingOutput.value && feature === 'methodTracing') {
              methodTracingOutput.value.scrollTop = methodTracingOutput.value.scrollHeight
            }
            if (systemMonitorOutput.value && feature === 'systemMonitor') {
              systemMonitorOutput.value.scrollTop = systemMonitorOutput.value.scrollHeight
            }
            if (networkMonitorOutput.value && feature === 'networkMonitor') {
              networkMonitorOutput.value.scrollTop = networkMonitorOutput.value.scrollHeight
            }
          })
        }
      }

      eventSource.onerror = (error) => {
        console.error(`EventSource error for ${eventSourceKey}:`, error)
        setTimeout(() => {
          if (features[platform][category][feature]) {
            startLoggingFeature(platform, category, feature)
          }
        }, 3000)
      }

      eventSources.set(eventSourceKey, eventSource)
    }
  } catch (error) {
    console.error(`Error starting feature ${eventSourceKey}:`, error)
    throw error
  }
}

const stopLoggingFeature = async (platform, category, feature) => {
  const eventSourceKey = `${platform}-${category}-${feature}`

  if (eventSources.has(eventSourceKey)) {
    eventSources.get(eventSourceKey).close()
    eventSources.delete(eventSourceKey)
  }

  try {
    await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/stop-feature`, {
      session_id: props.sessionId || 'default',
      platform,
      category,
      feature,
    })
  } catch (error) {
    console.error(`Error stopping feature ${eventSourceKey}:`, error)
  }
}

const pauseLogging = (platform, category, feature) => {
  const eventSourceKey = `${platform}-${category}-${feature}`
  loggingPaused[eventSourceKey] = !loggingPaused[eventSourceKey]

  const action = loggingPaused[eventSourceKey] ? 'paused' : 'resumed'
  showNotification(`Logging ${action} for ${feature}`, 'info')
}

const clearFeatureOutput = (platform, category, feature) => {
  featureOutputs[platform][category][feature] = ''
  showNotification(`Cleared ${feature} output`, 'info')
}

// ===== FILESYSTEM FUNCTIONS =====

const onFilesystemBrowserToggle = async (enabled) => {
  if (enabled && !agentLoaded.value) {
    await loadAgent()
    if (!agentLoaded.value) {
      features.ios.filesystem.browser = false
      showNotification('Cannot start filesystem browser: Agent not loaded', 'error')
      return
    }
  }

  try {
    if (enabled) {
      showNotification('Filesystem browser activated', 'success')
    } else {
      showNotification('Filesystem browser deactivated', 'info')
    }
  } catch (error) {
    console.error('Error toggling filesystem browser:', error)
    features.ios.filesystem.browser = !enabled
    showNotification(`Error toggling filesystem browser: ${error.message}`, 'error')
  }
}

const onFilesystemMonitoringUpdate = (monitoring) => {
  features.ios.filesystem.monitoring = monitoring
}

const updateFilesystemStats = (stats) => {
  Object.assign(filesystemStats, stats)
}

const exportFilesystemData = () => {
  try {
    const exportData = {
      exportInfo: {
        timestamp: new Date().toISOString(),
        sessionId: props.sessionId,
        deviceId: props.deviceId,
        pid: props.pid,
        platform: 'ios'
      },
      statistics: {
        ...filesystemStats
      }
    }

    const dataStr = JSON.stringify(exportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ios_filesystem_analysis_${props.sessionId}_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showNotification('Filesystem analysis exported successfully', 'success')
  } catch (error) {
    console.error('Filesystem export error:', error)
    showNotification('Failed to export filesystem data', 'error')
  }
}

const resetFilesystemBrowser = () => {
  filesystemStats.totalFiles = 0
  filesystemStats.totalDirectories = 0
  filesystemStats.totalOperations = 0
  showNotification('Filesystem browser reset', 'info')
}

// ===== CRYPTO FUNCTIONS =====

const onCryptoMonitorToggle = (monitoring) => {
  features.ios.crypto.cryptoMonitor = monitoring
}

// ===== SYSTEM MONITOR FUNCTIONS =====

const onSystemMonitorToggle = async (enabled) => {
  if (enabled && !agentLoaded.value) {
    await loadAgent()
    if (!agentLoaded.value) {
      features.ios.system.systemMonitor = false
      showNotification('Cannot start system monitoring: Agent not loaded', 'error')
      return
    }
  }

  try {
    if (enabled) {
      await startSystemMonitoring()
      showNotification('System monitoring started', 'success')
    } else {
      await stopSystemMonitoring()
      showNotification('System monitoring stopped', 'info')
    }
  } catch (error) {
    console.error('Error toggling system monitoring:', error)
    features.ios.system.systemMonitor = !enabled
    showNotification(`Error toggling system monitoring: ${error.message}`, 'error')
  }
}

const startSystemMonitoring = async () => {
  const eventSourceKey = 'ios-system-systemMonitor'

  if (eventSources.has(eventSourceKey)) {
    eventSources.get(eventSourceKey).close()
    eventSources.delete(eventSourceKey)
  }

  try {
    const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/start-feature`, {
      session_id: props.sessionId || 'default',
      device_id: props.deviceId,
      pid: props.pid,
      platform: 'ios',
      category: 'system',
      feature: 'systemMonitor',
    })

    if (response.data.status === 'success') {
      const eventSource = new EventSource(
        `${import.meta.env.VITE_APP_API_URL}/frida/feature-stream/${props.sessionId || 'default'}/ios/system/systemMonitor`
      )

      eventSource.onmessage = (event) => {
        if (!loggingPaused[eventSourceKey]) {
          if (!featureOutputs.ios.system.systemMonitor) {
            featureOutputs.ios.system.systemMonitor = ''
          }
          featureOutputs.ios.system.systemMonitor += event.data + '\n'

          const lines = featureOutputs.ios.system.systemMonitor.split('\n')
          if (lines.length > 500) {
            featureOutputs.ios.system.systemMonitor = lines.slice(-500).join('\n')
          }

          nextTick(() => {
            if (systemMonitorOutput.value) {
              systemMonitorOutput.value.scrollTop = systemMonitorOutput.value.scrollHeight
            }
          })
        }
      }

      eventSource.onerror = (error) => {
        console.error(`EventSource error for ${eventSourceKey}:`, error)
        showNotification('System monitoring connection error - attempting to reconnect...', 'warning')

        setTimeout(() => {
          if (features.ios.system.systemMonitor) {
            console.log('Attempting to reconnect system monitoring...')
            startSystemMonitoring()
          }
        }, 3000)
      }

      eventSources.set(eventSourceKey, eventSource)
    } else {
      throw new Error(response.data.message || 'Failed to start system monitoring')
    }
  } catch (error) {
    console.error(`Error starting system monitoring:`, error)
    throw error
  }
}

const stopSystemMonitoring = async () => {
  const eventSourceKey = 'ios-system-systemMonitor'

  if (eventSources.has(eventSourceKey)) {
    eventSources.get(eventSourceKey).close()
    eventSources.delete(eventSourceKey)
  }

  try {
    await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/stop-feature`, {
      session_id: props.sessionId || 'default',
      platform: 'ios',
      category: 'system',
      feature: 'systemMonitor',
    })
  } catch (error) {
    console.error(`Error stopping system monitoring:`, error)
  }
}


// ===== iOS NETWORK MONITORING FUNCTIONS =====

const onNetworkMonitorToggle = async (enabled) => {
  if (enabled && !agentLoaded.value) {
    await loadAgent()
    if (!agentLoaded.value) {
      features.ios.network.networkMonitor = false
      showNotification('Cannot start network monitoring: Agent not loaded', 'error')
      return
    }
  }

  try {
    if (enabled) {
      await startNetworkMonitoring()
      showNotification('iOS network monitoring started', 'success')
    } else {
      await stopNetworkMonitoring()
      showNotification('iOS network monitoring stopped', 'info')
    }
  } catch (error) {
    console.error('Error toggling iOS network monitoring:', error)
    features.ios.network.networkMonitor = !enabled
    showNotification(`Error toggling iOS network monitoring: ${error.message}`, 'error')
  }
}

const startNetworkMonitoring = async () => {
  const eventSourceKey = 'ios-network-networkMonitor'

  if (eventSources.has(eventSourceKey)) {
    eventSources.get(eventSourceKey).close()
    eventSources.delete(eventSourceKey)
  }

  try {
    const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/start-feature`, {
      session_id: props.sessionId || 'default',
      device_id: props.deviceId,
      pid: props.pid,
      platform: 'ios',
      category: 'network',
      feature: 'networkMonitor',
    })

    if (response.data.status === 'success') {
      const eventSource = new EventSource(
        `${import.meta.env.VITE_APP_API_URL}/frida/feature-stream/${props.sessionId || 'default'}/ios/network/networkMonitor`
      )

      eventSource.onmessage = (event) => {
        if (!loggingPaused[eventSourceKey]) {
          console.log('iOS Raw event.data:', event.data)

          if (!featureOutputs.ios.network.networkMonitor) {
            featureOutputs.ios.network.networkMonitor = ''
          }
          featureOutputs.ios.network.networkMonitor += event.data + '\n'

          const lines = featureOutputs.ios.network.networkMonitor.split('\n')
          if (lines.length > 500) {
            featureOutputs.ios.network.networkMonitor = lines.slice(-500).join('\n')
          }

          let networkRequestData = null

          try {
            const data = JSON.parse(event.data)
            if (data.type === 'network_request') {
              networkRequestData = data
              console.log('iOS network request parsed:', data)
            }
          } catch (e) {
            console.log('iOS parsing failed:', e.message)
          }

          if (networkRequestData) {
            console.log('Processing iOS network request data:', networkRequestData)

            const networkRequest = {
              id: networkRequestData.id || `ios_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              timestamp: networkRequestData.timestamp || new Date().toISOString(),
              method: networkRequestData.method || 'UNKNOWN',
              url: networkRequestData.url || 'unknown',
              headers: networkRequestData.headers || {},
              body: networkRequestData.body || null,
              bodySize: networkRequestData.bodySize ? parseInt(networkRequestData.bodySize) : 0,
              statusCode: networkRequestData.statusCode || null,
              responseHeaders: networkRequestData.responseHeaders || {},
              responseBody: networkRequestData.responseBody || null,
              responseSize: networkRequestData.responseSize ? parseInt(networkRequestData.responseSize) : 0,
              error: networkRequestData.error || null
            }

            console.log('Adding iOS network request:', networkRequest)

            networkRequests.value.push(networkRequest)

            networkStats.totalRequests++
            const method = networkRequest.method || 'UNKNOWN'
            if (networkStats.methodBreakdown[method] !== undefined) {
              networkStats.methodBreakdown[method]++
            } else {
              networkStats.methodBreakdown['OTHER']++
            }

            console.log(`Successfully added iOS request. Total requests: ${networkRequests.value.length}`)

            if (networkRequests.value.length > 200) {
              networkRequests.value = networkRequests.value.slice(-200)
            }

            nextTick(() => {
              updateSecurityStats()
              console.log('iOS security stats updated')
            })
          }

          nextTick(() => {
            if (networkMonitorOutput.value) {
              networkMonitorOutput.value.scrollTop = networkMonitorOutput.value.scrollHeight
            }
          })
        }
      }

      eventSource.onerror = (error) => {
        console.error(`EventSource error for ${eventSourceKey}:`, error)
        showNotification('iOS network monitoring connection error - attempting to reconnect...', 'warning')

        setTimeout(() => {
          if (features.ios.network.networkMonitor) {
            console.log('Attempting to reconnect iOS network monitoring...')
            startNetworkMonitoring()
          }
        }, 3000)
      }

      eventSources.set(eventSourceKey, eventSource)
      console.log('iOS network monitoring EventSource started successfully')
    } else {
      throw new Error(response.data.message || 'Failed to start iOS network monitoring')
    }
  } catch (error) {
    console.error(`Error starting iOS network monitoring:`, error)
    throw error
  }
}

const stopNetworkMonitoring = async () => {
  const eventSourceKey = 'ios-network-networkMonitor'

  if (eventSources.has(eventSourceKey)) {
    eventSources.get(eventSourceKey).close()
    eventSources.delete(eventSourceKey)
  }

  try {
    await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/stop-feature`, {
      session_id: props.sessionId || 'default',
      platform: 'ios',
      category: 'network',
      feature: 'networkMonitor',
    })
  } catch (error) {
    console.error
  }
}

const toggleNetworkView = () => {
  showParsedNetwork.value = !showParsedNetwork.value
}

const clearNetworkData = () => {
  networkRequests.value = []
  featureOutputs.ios.network.networkMonitor = ''
  networkStats.totalRequests = 0
  Object.keys(networkStats.methodBreakdown).forEach(method => {
    networkStats.methodBreakdown[method] = 0
  })
  expandedRequests.value.clear()
  updateSecurityStats()
  showNotification('iOS network data cleared', 'info')
}

const exportNetworkData = () => {
  try {
    const exportData = {
      exportInfo: {
        timestamp: new Date().toISOString(),
        totalRequests: networkRequests.value.length,
        sessionId: props.sessionId,
        deviceId: props.deviceId,
        pid: props.pid,
        platform: 'ios'
      },
      statistics: {
        totalRequests: networkStats.totalRequests,
        methodBreakdown: { ...networkStats.methodBreakdown },
        securityStats: { ...securityStats },
        uniqueDomains: uniqueDomains.value,
        timeSpan: {
          first: networkRequests.value[0]?.timestamp,
          last: networkRequests.value[networkRequests.value.length - 1]?.timestamp
        }
      },
      requests: networkRequests.value.map(req => ({
        ...req,
        securityAnalysis: getSecurityRisk(req),
        body: req.body && req.body.length > 1000 ? req.body.substring(0, 1000) + '...[truncated]' : req.body,
        responseBody: req.responseBody && req.responseBody.length > 1000 ? req.responseBody.substring(0, 1000) + '...[truncated]' : req.responseBody
     }))
   }

   const dataStr = JSON.stringify(exportData, null, 2)
   const dataBlob = new Blob([dataStr], { type: 'application/json' })
   const url = URL.createObjectURL(dataBlob)
   const link = document.createElement('a')
   link.href = url
   link.download = `ios_security_network_analysis_${props.sessionId}_${new Date().toISOString().split('T')[0]}.json`
   document.body.appendChild(link)
   link.click()
   document.body.removeChild(link)
   URL.revokeObjectURL(url)
   showNotification('iOS security analysis exported successfully', 'success')
 } catch (error) {
   console.error('iOS export error:', error)
   showNotification('Failed to export iOS network data', 'error')
 }
}

const clearNetworkFilters = () => {
 networkSearch.value = ''
 securityFilter.value = 'ALL'
 methodFilter.value = 'ALL'
}

const updateSecurityStats = () => {
 const stats = {
   highRisk: 0,
   mediumRisk: 0,
   lowRisk: 0,
   authRequests: 0,
   piiRequests: 0,
   insecureRequests: 0
 }

 networkRequests.value.forEach(request => {
   const security = getSecurityRisk(request)

   switch (security.risk) {
     case 'HIGH': stats.highRisk++; break
     case 'MEDIUM': stats.mediumRisk++; break
     case 'LOW': stats.lowRisk++; break
   }

   if (hasAuthHeaders(request)) stats.authRequests++
   if (hasPII(request)) stats.piiRequests++
   if (request.url.startsWith('http://')) stats.insecureRequests++
 })

 Object.assign(securityStats, stats)
}

const toggleRequestDetails = (request) => {
 const requestId = request.id || request.timestamp
 if (expandedRequests.value.has(requestId)) {
   expandedRequests.value.delete(requestId)
   delete activeRequestTab[requestId]
 } else {
   expandedRequests.value.add(requestId)
   if (!activeRequestTab[requestId]) {
     activeRequestTab[requestId] = 'overview'
   }
 }
}

const handleTabChange = (requestId, newTab) => {
 console.log(`iOS tab changed for request ${requestId} to ${newTab}`)
}

const onAndroidNetworkMonitorToggle = async (enabled) => {
 if (enabled && !agentLoaded.value) {
   await loadAgent()
   if (!agentLoaded.value) {
     features.android.network.networkMonitor = false
     showNotification('Cannot start Android network monitoring: Agent not loaded', 'error')
     return
   }
 }

 try {
   if (enabled) {
     await startAndroidNetworkMonitoring()
     showNotification('Android network monitoring started', 'success')
   } else {
     await stopAndroidNetworkMonitoring()
     showNotification('Android network monitoring stopped', 'info')
   }
 } catch (error) {
   console.error('Error toggling Android network monitoring:', error)
   features.android.network.networkMonitor = !enabled
   showNotification(`Error toggling Android network monitoring: ${error.message}`, 'error')
 }
}

const startAndroidNetworkMonitoring = async () => {
 const eventSourceKey = 'android-network-networkMonitor'

 if (eventSources.has(eventSourceKey)) {
   eventSources.get(eventSourceKey).close()
   eventSources.delete(eventSourceKey)
 }

 try {
   const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/start-feature`, {
     session_id: props.sessionId || 'default',
     device_id: props.deviceId,
     pid: props.pid,
     platform: 'android',
     category: 'network',
     feature: 'networkMonitor',
   })

   if (response.data.status === 'success') {
     const eventSource = new EventSource(
       `${import.meta.env.VITE_APP_API_URL}/frida/feature-stream/${props.sessionId || 'default'}/android/network/networkMonitor`
     )

     eventSource.onmessage = (event) => {
       if (!loggingPaused[eventSourceKey]) {
         console.log('Android Raw event.data:', event.data)

         if (!featureOutputs.android.network.networkMonitor) {
           featureOutputs.android.network.networkMonitor = ''
         }
         featureOutputs.android.network.networkMonitor += event.data + '\n'

         const lines = featureOutputs.android.network.networkMonitor.split('\n')
         if (lines.length > 500) {
           featureOutputs.android.network.networkMonitor = lines.slice(-500).join('\n')
         }

         let networkRequestData = null

         try {
           const data = JSON.parse(event.data)
           if (data.type === 'network_request') {
             networkRequestData = data
             console.log('Android network request parsed:', data)
           }
         } catch (e) {
           console.log('Android parsing failed:', e.message)
         }

         if (networkRequestData) {
           console.log('Processing Android network request data:', networkRequestData)

           const androidNetworkRequest = {
             id: networkRequestData.id || `android_req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
             timestamp: networkRequestData.timestamp || new Date().toISOString(),
             method: networkRequestData.method || 'UNKNOWN',
             url: networkRequestData.url || 'unknown',
             headers: networkRequestData.headers || {},
             body: networkRequestData.body || null,
             bodySize: networkRequestData.bodySize ? parseInt(networkRequestData.bodySize) : 0,
             statusCode: networkRequestData.statusCode || null,
             responseHeaders: networkRequestData.responseHeaders || {},
             responseBody: networkRequestData.responseBody || null,
             responseSize: networkRequestData.responseSize ? parseInt(networkRequestData.responseSize) : 0,
             error: networkRequestData.error || null,
             library: networkRequestData.library || 'Unknown'
           }

           console.log('Adding Android network request:', androidNetworkRequest)

           androidNetworkRequests.value.push(androidNetworkRequest)

           androidNetworkStats.totalRequests++
           const method = androidNetworkRequest.method || 'UNKNOWN'
           if (androidNetworkStats.methodBreakdown[method] !== undefined) {
             androidNetworkStats.methodBreakdown[method]++
           } else {
             androidNetworkStats.methodBreakdown['OTHER']++
           }

           console.log(`Successfully added Android request. Total requests: ${androidNetworkRequests.value.length}`)

           if (androidNetworkRequests.value.length > 200) {
             androidNetworkRequests.value = androidNetworkRequests.value.slice(-200)
           }

           nextTick(() => {
             updateAndroidSecurityStats()
             console.log('Android security stats updated')
           })
         }

         nextTick(() => {
           if (androidNetworkMonitorOutput.value) {
             androidNetworkMonitorOutput.value.scrollTop = androidNetworkMonitorOutput.value.scrollHeight
           }
         })
       }
     }

     eventSource.onerror = (error) => {
       console.error(`EventSource error for ${eventSourceKey}:`, error)
       showNotification('Android network monitoring connection error - attempting to reconnect...', 'warning')

       setTimeout(() => {
         if (features.android.network.networkMonitor) {
           console.log('Attempting to reconnect Android network monitoring...')
           startAndroidNetworkMonitoring()
         }
       }, 3000)
     }

     eventSources.set(eventSourceKey, eventSource)
     console.log('Android network monitoring EventSource started successfully')
   } else {
     throw new Error(response.data.message || 'Failed to start Android network monitoring')
   }
 } catch (error) {
   console.error(`Error starting Android network monitoring:`, error)
   throw error
 }
}

const stopAndroidNetworkMonitoring = async () => {
 const eventSourceKey = 'android-network-networkMonitor'

 if (eventSources.has(eventSourceKey)) {
   eventSources.get(eventSourceKey).close()
   eventSources.delete(eventSourceKey)
 }

 try {
   await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/stop-feature`, {
     session_id: props.sessionId || 'default',
     platform: 'android',
     category: 'network',
     feature: 'networkMonitor',
   })
 } catch (error) {
   console.error(`Error stopping Android network monitoring:`, error)
 }
}

const toggleAndroidNetworkView = () => {
 showAndroidParsedNetwork.value = !showAndroidParsedNetwork.value
}

const clearAndroidNetworkData = () => {
 androidNetworkRequests.value = []
 featureOutputs.android.network.networkMonitor = ''
 androidNetworkStats.totalRequests = 0
 Object.keys(androidNetworkStats.methodBreakdown).forEach(method => {
   androidNetworkStats.methodBreakdown[method] = 0
 })
 expandedAndroidRequests.value.clear()
 updateAndroidSecurityStats()
 showNotification('Android network data cleared', 'info')

  if (features.android.network.sslPinning) {
    executeSSLPinningFeature('clearSSLEvents').then(() => {
      showNotification('SSL events cleared', 'info')
    }).catch(console.error)
  }
}

const exportAndroidNetworkData = () => {
 try {
   const exportData = {
     exportInfo: {
       timestamp: new Date().toISOString(),
       totalRequests: androidNetworkRequests.value.length,
       sessionId: props.sessionId,
       deviceId: props.deviceId,
       pid: props.pid,
       platform: 'android',
       sslPinning: featureOutputs.android.network.sslPinning,
       sslStats: { ...androidSSLStats }
     },
     statistics: {
       totalRequests: androidNetworkStats.totalRequests,
       methodBreakdown: { ...androidNetworkStats.methodBreakdown },
       securityStats: { ...androidSecurityStats },
       uniqueDomains: androidUniqueDomains.value,
       uniqueLibraries: androidUniqueLibraries.value,
       timeSpan: {
         first: androidNetworkRequests.value[0]?.timestamp,
         last: androidNetworkRequests.value[androidNetworkRequests.value.length - 1]?.timestamp
       }
     },
     requests: androidNetworkRequests.value.map(req => ({
       ...req,
       securityAnalysis: getSecurityRisk(req),
       body: req.body && req.body.length > 1000 ? req.body.substring(0, 1000) + '...[truncated]' : req.body,
       responseBody: req.responseBody && req.responseBody.length > 1000 ? req.responseBody.substring(0, 1000) + '...[truncated]' : req.responseBody
     }))
   }

   const dataStr = JSON.stringify(exportData, null, 2)
   const dataBlob = new Blob([dataStr], { type: 'application/json' })
   const url = URL.createObjectURL(dataBlob)
   const link = document.createElement('a')
   link.href = url
   link.download = `android_security_network_analysis_${props.sessionId}_${new Date().toISOString().split('T')[0]}.json`
   document.body.appendChild(link)
   link.click()
   document.body.removeChild(link)
   URL.revokeObjectURL(url)
   showNotification('Android security analysis exported successfully', 'success')
 } catch (error) {
   console.error('Android export error:', error)
   showNotification('Failed to export Android network data', 'error')
 }
}

const clearAndroidNetworkFilters = () => {
 androidNetworkSearch.value = ''
 androidSecurityFilter.value = 'ALL'
 androidMethodFilter.value = 'ALL'
}

const updateAndroidSecurityStats = () => {
 const stats = {
   highRisk: 0,
   mediumRisk: 0,
   lowRisk: 0,
   authRequests: 0,
   piiRequests: 0,
   insecureRequests: 0
 }

 androidNetworkRequests.value.forEach(request => {
   const security = getSecurityRisk(request)

   switch (security.risk) {
     case 'HIGH': stats.highRisk++; break
     case 'MEDIUM': stats.mediumRisk++; break
     case 'LOW': stats.lowRisk++; break
   }

   if (hasAuthHeaders(request)) stats.authRequests++
   if (hasPII(request)) stats.piiRequests++
   if (request.url.startsWith('http://')) stats.insecureRequests++
 })

 Object.assign(androidSecurityStats, stats)
}

const toggleAndroidRequestDetails = (request) => {
 const requestId = request.id || request.timestamp
 if (expandedAndroidRequests.value.has(requestId)) {
   expandedAndroidRequests.value.delete(requestId)
   delete activeAndroidRequestTab[requestId]
 } else {
   expandedAndroidRequests.value.add(requestId)
   if (!activeAndroidRequestTab[requestId]) {
     activeAndroidRequestTab[requestId] = 'overview'
   }
 }
}

const handleAndroidTabChange = (requestId, newTab) => {
 console.log(`Android tab changed for request ${requestId} to ${newTab}`)
}

// ===== ANDROID IPC MONITORING FUNCTIONS =====

const onAndroidIPCMonitorToggle = async (enabled) => {
  if (enabled && !agentLoaded.value) {
    await loadAgent()
    if (!agentLoaded.value) {
      features.android.ipc.ipcMonitor = false
      showNotification('Cannot start Android IPC monitoring: Agent not loaded', 'error')
      return
    }
  }

  try {
    if (enabled) {
      // Call the RPC method to start monitoring
      const rpcResponse = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
        session_id: props.sessionId || 'default',
        command: 'startIPCMonitoring()',
      })

      if (rpcResponse.data.status === 'success') {
        await startIPCMonitoring()
        showNotification('Android IPC monitoring started', 'success')
      } else {
        throw new Error(rpcResponse.data.message || 'Failed to start IPC monitoring via RPC')
      }
    } else {
      // Call the RPC method to stop monitoring
      const rpcResponse = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
        session_id: props.sessionId || 'default',
        command: 'stopIPCMonitoring()',
      })

      if (rpcResponse.data.status === 'success') {
        await stopIPCMonitoring()
        showNotification('Android IPC monitoring stopped', 'info')
      } else {
        throw new Error(rpcResponse.data.message || 'Failed to stop IPC monitoring via RPC')
      }
    }
  } catch (error) {
    console.error('Error toggling Android IPC monitoring:', error)
    features.android.ipc.ipcMonitor = !enabled
    showNotification(`Error toggling Android IPC monitoring: ${error.message}`, 'error')
  }
}

const startIPCMonitoring = async () => {
  loadingFeatures.android.ipc.ipcMonitor = true

  try {
    const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/start-feature`, {
      session_id: props.sessionId || 'default',
      device_id: props.deviceId,
      pid: props.pid,
      platform: 'android',
      category: 'ipc',
      feature: 'ipcMonitor',
    })

    if (response.data.status === 'success') {
      // Get initial data after starting
      try {
        const eventsResponse = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
          session_id: props.sessionId || 'default',
          command: 'getIPCEvents()',
        })

        const statsResponse = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
          session_id: props.sessionId || 'default',
          command: 'getIPCStatistics()',
        })

        if (eventsResponse.data.status === 'success' && statsResponse.data.status === 'success') {
          const events = eventsResponse.data.result || eventsResponse.data.output || []
          const statistics = statsResponse.data.result || statsResponse.data.output || {}

          const combinedData = {
            events: events,
            statistics: statistics,
            active: true,
            filters: {}
          }

          featureOutputs.android.ipc.ipcMonitor = combinedData
          updateIPCStats(combinedData)
        }
      } catch (error) {
        console.error('Error getting initial IPC data:', error)
      }
    } else {
      throw new Error(response.data.message || 'Failed to start IPC monitoring')
    }
  } catch (error) {
    console.error('Error starting IPC monitoring:', error)
    throw error
  } finally {
    loadingFeatures.android.ipc.ipcMonitor = false
  }
}

const stopIPCMonitoring = async () => {
  try {
    await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/stop-feature`, {
      session_id: props.sessionId || 'default',
      platform: 'android',
      category: 'ipc',
      feature: 'ipcMonitor',
    })

    // Clear stats
    androidIPCStats.totalEvents = 0
    Object.keys(androidIPCStats.byType).forEach(type => {
      androidIPCStats.byType[type] = 0
    })
  } catch (error) {
    console.error('Error stopping IPC monitoring:', error)
  }
}

const clearIPCEvents = async () => {
  try {
    const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
      session_id: props.sessionId || 'default',
      command: 'clearIPCEvents()',
    })

    if (response.data.status === 'success') {
      // Update local state
      if (featureOutputs.android.ipc.ipcMonitor) {
        featureOutputs.android.ipc.ipcMonitor.events = []
        featureOutputs.android.ipc.ipcMonitor.statistics = {
          totalEvents: 0,
          byType: {
            intent: 0,
            broadcast: 0,
            content_provider: 0,
            binder: 0,
            service: 0
          }
        }
      }

      // Reset stats
      androidIPCStats.totalEvents = 0
      Object.keys(androidIPCStats.byType).forEach(type => {
        androidIPCStats.byType[type] = 0
      })

      showNotification('IPC events cleared', 'success')
    }
  } catch (error) {
    console.error('Error clearing IPC events:', error)
    showNotification('Failed to clear IPC events', 'error')
  }
}

const refreshIPCMonitor = async () => {
  if (!features.android.ipc.ipcMonitor) {
    await onAndroidIPCMonitorToggle(true)
  } else {
    loadingFeatures.android.ipc.ipcMonitor = true
    try {
      // Get current events
      const eventsResponse = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
        session_id: props.sessionId || 'default',
        command: 'getIPCEvents()',
      })

      // Get current statistics
      const statsResponse = await axios.post(`${import.meta.env.VITE_APP_API_URL}/frida/execute-with-agent`, {
        session_id: props.sessionId || 'default',
        command: 'getIPCStatistics()',
      })

      if (eventsResponse.data.status === 'success' && statsResponse.data.status === 'success') {
        const events = eventsResponse.data.result || eventsResponse.data.output || []
        const statistics = statsResponse.data.result || statsResponse.data.output || {}

        // Combine the data
        const combinedData = {
          events: events,
          statistics: statistics,
          active: features.android.ipc.ipcMonitor,
          filters: {}
        }

        featureOutputs.android.ipc.ipcMonitor = combinedData
        updateIPCStats(combinedData)
      }
    } catch (error) {
      console.error('Error refreshing IPC monitor:', error)
      showNotification('Failed to refresh IPC monitor', 'error')
    } finally {
      loadingFeatures.android.ipc.ipcMonitor = false
    }
  }
}

const updateIPCStats = (data) => {
  if (data && data.statistics) {
    androidIPCStats.totalEvents = data.statistics.totalEvents || 0
    if (data.statistics.byType) {
      Object.assign(androidIPCStats.byType, data.statistics.byType)
    }
  }
}

const exportIPCData = (data) => {
  try {
    const exportData = {
      exportInfo: {
        timestamp: new Date().toISOString(),
        sessionId: props.sessionId,
        deviceId: props.deviceId,
        pid: props.pid,
        platform: 'android'
      },
      ...data
    }

    const dataStr = JSON.stringify(exportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `android_ipc_analysis_${props.sessionId}_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showNotification('Android IPC analysis exported successfully', 'success')
  } catch (error) {
    console.error('Android IPC export error:', error)
    showNotification('Failed to export Android IPC data', 'error')
  }
}


const copyToClipboard = async (data) => {
 try {
   let text
   if (typeof data === 'object' && data !== null) {
     text = JSON.stringify(data, null, 2)
   } else {
     text = String(data)
   }

   await navigator.clipboard.writeText(text)
   showNotification('Copied to clipboard', 'success')
 } catch (error) {
   console.error('Failed to copy to clipboard:', error)

   try {
     const textArea = document.createElement('textarea')
     textArea.value = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data)
     document.body.appendChild(textArea)
     textArea.select()
     document.execCommand('copy')
     document.body.removeChild(textArea)
     showNotification('Copied to clipboard', 'success')
   } catch (fallbackError) {
     showNotification('Failed to copy to clipboard', 'error')
   }
 }
}

const handleNotification = ({ message, type }) => {
 showNotification(message, type)
}

const updateDialogStyle = () => {
 dialogStyle.top = `${dialogSize.top}px`
 dialogStyle.left = `${dialogSize.left}px`
 dialogStyle.width = `${dialogSize.width}px`
 dialogStyle.height = `${dialogSize.height}px`
}

const handleKeydown = (e) => {
 if (!props.visible) return

 if (e.ctrlKey || e.metaKey) {
   switch (e.key) {
     case 'a':
     case 'A':
       e.preventDefault()
       expandAll()
       break
     case 'c':
     case 'C':
       e.preventDefault()
       collapseAll()
       break
     case '=':
     case '+':
       e.preventDefault()
       increaseFontSize()
       break
     case '-':
     case '_':
       e.preventDefault()
       decreaseFontSize()
       break
     case '0':
       e.preventDefault()
       resetFontSize()
       break
   }
 }
}

// ===== WATCHERS =====

watch(() => props.visible, (newValue) => {
 if (newValue && props.deviceId && props.pid && !agentLoaded.value) {
   setTimeout(() => loadAgent(), 500)
 } else if (!newValue) {
   eventSources.forEach((source) => {
     source.close()
   })
   eventSources.clear()
 }
})

watch([() => props.deviceId, () => props.pid], ([deviceId, pid]) => {
 if (props.visible && deviceId && pid && !agentLoaded.value) {
   loadAgent()
 }
})

// Reset iOS network stats when network monitoring is disabled
watch(() => features.ios.network.networkMonitor, (enabled) => {
 if (!enabled) {
   networkStats.totalRequests = 0
   Object.keys(networkStats.methodBreakdown).forEach(method => {
     networkStats.methodBreakdown[method] = 0
   })
   networkRequests.value = []
   expandedRequests.value.clear()
   updateSecurityStats()
 }
})

// Reset Android network stats when network monitoring is disabled
watch(() => features.android.network.networkMonitor, (enabled) => {
 if (!enabled) {
   androidNetworkStats.totalRequests = 0
   Object.keys(androidNetworkStats.methodBreakdown).forEach(method => {
     androidNetworkStats.methodBreakdown[method] = 0
   })
   androidNetworkRequests.value = []
   expandedAndroidRequests.value.clear()
   updateAndroidSecurityStats()
 }
})

// Reset Android SSL stats when SSL pinning is disabled
watch(() => features.android.network.sslPinning, (enabled) => {
  if (!enabled) {
    androidSSLStats.totalHooks = 0
    androidSSLStats.activeHooks = 0
    androidSSLStats.bypassedHooks = 0
    androidSSLStats.totalEvents = 0
  }
})

// Watch for network requests changes to update security stats
watch(networkRequests, () => {
 updateSecurityStats()
}, { deep: true })

watch(androidNetworkRequests, () => {
 updateAndroidSecurityStats()
}, { deep: true })

// ===== LIFECYCLE =====

onMounted(() => {
  // Load font preference
  loadFontPreference()

  const el = dialogRef.value
  let isDragging = false
  let isResizing = false
  let startX, startY, startWidth, startHeight, startLeft, startTop

  // Performance optimizations
  let rafId = null

  // Add cursor styles to document when dragging
  const addDragStyles = () => {
    document.body.style.cursor = isDragging ? 'move' : isResizing ? 'se-resize' : ''
    document.body.style.userSelect = 'none'
    document.body.style.webkitUserSelect = 'none'
    document.body.style.msUserSelect = 'none'
  }

  const removeDragStyles = () => {
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    document.body.style.webkitUserSelect = ''
    document.body.style.msUserSelect = ''
  }

  const onMouseDown = (e) => {
    // Check if clicking on header for dragging
    if (e.target.closest('.vss-movable')) {
      isDragging = true
      startX = e.clientX
      startY = e.clientY
      startLeft = dialogSize.left
      startTop = dialogSize.top

      // Add visual feedback
      dialogRef.value.style.transition = 'none'
      dialogRef.value.style.opacity = '0.95'
      addDragStyles()
    } else if (e.target.closest('.resizer-handle')) {
      isResizing = true
      startX = e.clientX
      startY = e.clientY
      startWidth = dialogSize.width
      startHeight = dialogSize.height

      dialogRef.value.style.transition = 'none'
      addDragStyles()
    }

    if (isDragging || isResizing) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  const onMouseMove = (e) => {
    if (!isDragging && !isResizing) return

    e.preventDefault()

    // Cancel any pending animation frame
    if (rafId) {
      cancelAnimationFrame(rafId)
    }

    // Use requestAnimationFrame for smooth 60fps updates
    rafId = requestAnimationFrame(() => {
      if (isDragging) {
        const dx = e.clientX - startX
        const dy = e.clientY - startY

        // Calculate new position
        const newLeft = startLeft + dx
        const newTop = startTop + dy

        // Smooth constraint checking with window bounds
        const maxLeft = window.innerWidth - dialogSize.width
        const maxTop = window.innerHeight - dialogSize.height

        // Add some padding from edges
        const edgePadding = 20

        // Update the actual position values directly
        dialogSize.left = Math.max(edgePadding, Math.min(maxLeft - edgePadding, newLeft))
        dialogSize.top = Math.max(edgePadding, Math.min(maxTop - edgePadding, newTop))

        // Update the style directly
        updateDialogStyle()

      } else if (isResizing) {
        const dx = e.clientX - startX
        const dy = e.clientY - startY

        // Smooth resizing with constraints
        const newWidth = Math.max(600, Math.min(window.innerWidth - dialogSize.left - 20, startWidth + dx))
        const newHeight = Math.max(500, Math.min(window.innerHeight - dialogSize.top - 20, startHeight + dy))

        dialogSize.width = newWidth
        dialogSize.height = newHeight
        updateDialogStyle()
      }
    })
  }

  const onMouseUp = () => {
    if (isDragging) {
      // Restore opacity with smooth transition
      dialogRef.value.style.transition = 'opacity 0.2s ease'
      dialogRef.value.style.opacity = '1'
    }

    isDragging = false
    isResizing = false

    removeDragStyles()

    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  // Enhanced touch support for mobile devices
  const onTouchStart = (e) => {
    const touch = e.touches[0]
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: touch.clientX,
      clientY: touch.clientY,
      bubbles: true
    })
    e.target.dispatchEvent(mouseEvent)
  }

  const onTouchMove = (e) => {
    const touch = e.touches[0]
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: touch.clientX,
      clientY: touch.clientY,
      bubbles: true
    })
    e.target.dispatchEvent(mouseEvent)
  }

  const onTouchEnd = (e) => {
    const mouseEvent = new MouseEvent('mouseup', {
      bubbles: true
    })
    e.target.dispatchEvent(mouseEvent)
  }

  // Add event listeners
  document.addEventListener('mousedown', onMouseDown)
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  document.addEventListener('mouseleave', onMouseUp) // Handle mouse leaving window

  // Touch support
  if (dialogRef.value) {
    dialogRef.value.addEventListener('touchstart', onTouchStart, { passive: false })
    dialogRef.value.addEventListener('touchmove', onTouchMove, { passive: false })
    dialogRef.value.addEventListener('touchend', onTouchEnd, { passive: false })
  }

  document.addEventListener('keydown', handleKeydown)

  // Double-click header to center dialog
  const headerEl = dialogRef.value?.querySelector('.dialog-header')
  if (headerEl) {
    headerEl.addEventListener('dblclick', () => {
      const centerX = (window.innerWidth - dialogSize.width) / 2
      const centerY = (window.innerHeight - dialogSize.height) / 2

      // Smooth animation to center
      dialogRef.value.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      dialogSize.left = centerX
      dialogSize.top = centerY
      updateDialogStyle()

      setTimeout(() => {
        dialogRef.value.style.transition = ''
      }, 300)
    })
  }

  if (props.visible && props.deviceId && props.pid) {
    setTimeout(() => loadAgent(), 1000)
  }
})

onUnmounted(() => {
  eventSources.forEach((source) => {
    source.close()
  })
  eventSources.clear()

  document.removeEventListener('keydown', handleKeydown)
})

</script>
<style scoped>
/* Font scaling CSS variables */
.movable-dialog {
  --font-scale: 1;
}

/* SSL Pinning Card */
.ssl-pinning-card {
  border-color: rgba(156, 39, 176, 0.3);
  background: linear-gradient(145deg, #1a0a2a 0%, #1e1e1e 100%);
}

.ssl-pinning-card::before {
  background: linear-gradient(90deg, transparent, rgba(156, 39, 176, 0.4), transparent);
}

.ssl-pinning-card .feature-output {
  background: linear-gradient(145deg, #1a0a2a 0%, #0f0f0f 100%);
  border: 1px solid rgba(156, 39, 176, 0.2);
}

.ssl-pinning-card .v-chip {
  font-family: 'SF Mono', monospace !important;
  font-weight: 600 !important;
}

/* IPC Monitor Card */
.ipc-card {
  border-color: rgba(156, 39, 176, 0.3);
  background: linear-gradient(145deg, #1a0a2a 0%, #1e1e1e 100%);
}

.ipc-card::before {
  background: linear-gradient(90deg, transparent, rgba(156, 39, 176, 0.4), transparent);
}

.ipc-card .feature-output {
  background: linear-gradient(145deg, #1a0a2a 0%, #0f0f0f 100%);
  border: 1px solid rgba(156, 39, 176, 0.2);
}

/* Library Analysis Styles for Android */
.library-analysis {
  margin-bottom: 24px;
}

.library-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.library-badge {
  font-weight: 600 !important;
  letter-spacing: 0.5px !important;
}

/* Filesystem Browser Card */
.filesystem-card {
  border-color: rgba(33, 150, 243, 0.3);
  background: linear-gradient(145deg, #0a1a2a 0%, #1e1e1e 100%);
}

.filesystem-card::before {
  background: linear-gradient(90deg, transparent, rgba(33, 150, 243, 0.4), transparent);
}

.filesystem-card .feature-output {
  background: linear-gradient(145deg, #0a1a2a 0%, #0f0f0f 100%);
  border: 1px solid rgba(33, 150, 243, 0.2);
}

.filesystem-title {
  font-size: 14px;
  font-weight: 600;
  color: #58a6ff;
}

.filesystem-card .v-chip {
  font-family: 'SF Mono', monospace !important;
  font-weight: 600 !important;
}

/* Main Dialog */
.movable-dialog {
  background: linear-gradient(145deg, #1a1a1a 0%, #121212 100%);
  color: #ffffff;
  border-radius: 16px;
  box-shadow:
    0 24px 96px rgba(0, 0, 0, 0.6),
    0 0 0 1px rgba(255, 255, 255, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  backdrop-filter: blur(16px);
  transition: box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.2s ease;
  will-change: transform; /* Optimize for animations */
}

.movable-dialog:hover {
  box-shadow:
    0 32px 128px rgba(0, 0, 0, 0.7),
    0 0 0 1px rgba(255, 255, 255, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

/* Enhanced header for better drag experience */
.dialog-header {
  background: linear-gradient(135deg, #1e1e1e 0%, #2a2a2a 100%);
  padding: 20px 24px;
  font-weight: 600;
  font-size: 16px;
  cursor: move;
  display: flex;
  align-items: center;
  min-height: 64px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  user-select: none;
  position: relative;
  transition: background 0.2s ease;
}

/* Visual feedback when hovering header */
.dialog-header:hover {
  background: linear-gradient(135deg, #242424 0%, #2e2e2e 100%);
}

/* Active dragging state */
.dialog-header:active {
  background: linear-gradient(135deg, #2a2a2a 0%, #333333 100%);
}

/* Enhanced resize handle */
.resizer-handle {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 20px;
  height: 20px;
  cursor: se-resize;
  background: linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.1) 100%);
  border-top-left-radius: 8px;
  transition: all 0.3s ease;
  z-index: 10;
}

.resizer-handle:hover {
  background: linear-gradient(135deg, transparent 0%, rgba(88, 166, 255, 0.3) 100%);
  width: 30px;
  height: 30px;
}

.resizer-handle::before {
  content: '';
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 10px;
  height: 10px;
  border-right: 2px solid rgba(255, 255, 255, 0.4);
  border-bottom: 2px solid rgba(255, 255, 255, 0.4);
  transition: all 0.3s ease;
}

.resizer-handle:hover::before {
  border-color: rgba(88, 166, 255, 0.8);
  right: 8px;
  bottom: 8px;
}

/* Prevent selection during drag */
.dialog-dragging {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

/* Add these keyframes for smooth animations */
@keyframes dialogSlideIn {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.movable-dialog {
  animation: dialogSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Smooth shadow transitions during drag */
@media (prefers-reduced-motion: no-preference) {
  .movable-dialog {
    transition: box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                opacity 0.2s ease,
                transform 0.1s ease-out;
  }
}

/* Header Styles */
.dialog-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
}

.session-info {
  font-size: 11px;
  color: #888;
  margin-left: 16px;
  font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
  background: rgba(255, 255, 255, 0.05);
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: font-size 0.2s ease;
}

/* Agent Status Bar */
.agent-status-bar {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding: 16px 24px;
  min-height: 56px;
  display: flex;
  align-items: center;
  transition: all 0.3s ease;
}

.agent-status-bar.success {
  background: linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(76, 175, 80, 0.05) 100%);
  border-bottom-color: rgba(76, 175, 80, 0.3);
}

.agent-status-bar.error {
  background: linear-gradient(135deg, rgba(244, 67, 54, 0.1) 0%, rgba(244, 67, 54, 0.05) 100%);
  border-bottom-color: rgba(244, 67, 54, 0.3);
}

.agent-status-bar.warning {
  background: linear-gradient(135deg, rgba(255, 152, 0, 0.1) 0%, rgba(255, 152, 0, 0.05) 100%);
  border-bottom-color: rgba(255, 152, 0, 0.3);
}

.agent-status-content {
  display: flex;
  align-items: center;
  width: 100%;
}

.status-text {
  font-size: 14px;
  font-weight: 500;
  transition: color 0.3s ease, font-size 0.2s ease, line-height 0.2s ease;
}

.status-text.error {
  color: #ff6b6b;
}

.status-text.warning {
  color: #ffa726;
}

.status-text.success {
  color: #4caf50;
}

.rotating {
  animation: spin 2s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Dialog Content */
.dialog-content {
  flex-grow: 1;
  overflow: hidden;
  position: relative;
  background: linear-gradient(180deg, #1a1a1a 0%, #121212 100%);
}

.sections-container {
  height: 100%;
  overflow-y: auto;
  padding: 20px;
}

/* Platform Sections */
.platform-section {
  margin-bottom: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
  background: rgba(255, 255, 255, 0.02);
}

.platform-section:hover {
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.03);
}

.platform-header {
  background: linear-gradient(135deg, #2a2a2a 0%, #333333 100%);
  padding: 20px 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
  position: relative;
}

.platform-header:hover {
  background: linear-gradient(135deg, #333333 0%, #3a3a3a 100%);
}

.platform-header::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
}

.section-icon {
  transition: transform 0.3s ease;
  margin-right: 16px;
  color: #888;
}

.section-icon.rotated {
  transform: rotate(90deg);
  color: #58a6ff;
}

.platform-icon {
  margin-right: 20px;
  color: #58a6ff;
  font-size: 24px;
}

.platform-title {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.5px;
  transition: font-size 0.2s ease, line-height 0.2s ease;
}

.platform-content {
  background: linear-gradient(180deg, #1a1a1a 0%, #161616 100%);
  padding: 16px;
}

/* Category Sections */
.category-section {
  margin-bottom: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.3s ease;
  background: rgba(255, 255, 255, 0.02);
}

.category-section:hover {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.03);
}

.category-header {
  background: linear-gradient(135deg, #262626 0%, #2d2d2d 100%);
  padding: 16px 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all 0.3s ease;
  border-left: 4px solid transparent;
}

.category-header:hover {
  background: linear-gradient(135deg, #333333 0%, #363636 100%);
  border-left-color: #58a6ff;
}

.category-icon {
  transition: all 0.3s ease;
  margin-right: 14px;
  font-size: 16px;
  color: #888;
}

.category-icon.rotated {
  transform: rotate(90deg);
  color: #ffa726;
}

.feature-icon {
  margin-right: 16px;
  color: #ffa726;
  font-size: 20px;
}

.category-title {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.3px;
  transition: font-size 0.2s ease, line-height 0.2s ease;
}

.category-content {
  background: linear-gradient(180deg, #161616 0%, #121212 100%);
  padding: 16px;
}

/* Feature Cards */
.feature-card {
  background: linear-gradient(145deg, #1e1e1e 0%, #1a1a1a 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  margin-bottom: 16px;
  padding: 20px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.feature-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(88, 166, 255, 0.4), transparent);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.feature-card:hover {
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.05);
}

.feature-card:hover::before {
  opacity: 1;
}

.debug-card {
  border-color: rgba(255, 152, 0, 0.3);
  background: linear-gradient(145deg, #2a1f0a 0%, #1e1e1e 100%);
}

.debug-card::before {
  background: linear-gradient(90deg, transparent, rgba(255, 152, 0, 0.4), transparent);
}

.monitor-card {
  border-color: rgba(76, 175, 80, 0.3);
  background: linear-gradient(145deg, #0a2a0f 0%, #1e1e1e 100%);
}

.monitor-card::before {
  background: linear-gradient(90deg, transparent, rgba(76, 175, 80, 0.4), transparent);
}

.network-card {
  border-color: rgba(33, 150, 243, 0.3);
  background: linear-gradient(145deg, #0a1a2a 0%, #1e1e1e 100%);
}

.network-card::before {
  background: linear-gradient(90deg, transparent, rgba(33, 150, 243, 0.4), transparent);
}

.feature-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.feature-info {
  display: flex;
  align-items: center;
  flex: 1;
}

.feature-name {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  transition: font-size 0.2s ease, line-height 0.2s ease;
}

.feature-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.feature-description {
  font-size: 13px;
  color: #bbb;
  margin-bottom: 16px;
  line-height: 1.5;
  font-style: italic;
  transition: font-size 0.2s ease, line-height 0.2s ease;
}

/* Feature Output */
.feature-output {
  margin-top: 20px;
  background: linear-gradient(145deg, #141414 0%, #0f0f0f 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.3);
}

.output-header {
  background: linear-gradient(135deg, #2a2a2a 0%, #2d2d2d 100%);
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  color: #ddd;
}

.output-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.output-content {
  background: linear-gradient(145deg, #0f0f0f 0%, #0a0a0a 100%);
}

.output-text {
  margin: 0;
  padding: 20px;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'Cascadia Code', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: #e6e6e6;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  overflow-y: auto;
  transition: font-size 0.2s ease, line-height 0.2s ease;
}

.live-output {
  background: linear-gradient(145deg, #0a1a0a 0%, #0a0a0a 100%);
  border: 1px solid rgba(76, 175, 80, 0.2);
}

/* Enhanced Info Displays */
.battery-info {
  padding: 20px;
}

.battery-metric {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  gap: 16px;
}

.metric-label {
  font-weight: 600;
  color: #4caf50;
  min-width: 80px;
  font-size: 14px;
  transition: font-size 0.2s ease;
}

.metric-value {
  font-family: 'SF Mono', monospace;
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  transition: font-size 0.2s ease;
}

.metric-value.charging {
  color: #4caf50;
}

.metric-value.full {
  color: #2196f3;
}

.metric-value.timestamp {
  color: #888;
  font-size: 12px;
}

.metric-value.warning {
  color: #ff9800;
}

.battery-bar {
  flex: 1;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.battery-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

/* Dynamic battery colors based on level */
.battery-info[data-level="high"] .battery-fill {
  background: linear-gradient(90deg, #4caf50 0%, #8bc34a 100%);
}

.battery-info[data-level="medium"] .battery-fill {
  background: linear-gradient(90deg, #ff9800 0%, #ffc107 100%);
}

.battery-info[data-level="low"] .battery-fill {
  background: linear-gradient(90deg, #f44336 0%, #ff5722 100%);
}

.battery-info[data-level="critical"] .battery-fill {
  background: linear-gradient(90deg, #d32f2f 0%, #f44336 100%);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.device-info {
  padding: 20px;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 12px;
  color: #888;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: font-size 0.2s ease;
}

.info-value {
  font-size: 14px;
  color: #ffffff;
  font-weight: 600;
  font-family: 'SF Mono', monospace;
  transition: font-size 0.2s ease;
}

/* Status Bar */
.status-bar {
  background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%);
  padding: 16px 24px;
  font-size: 12px;
  color: #888;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  min-height: 52px;
  position: relative;
}

.status-bar::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
}

.status-text {
  font-family: 'SF Mono', monospace;
  font-size: 12px;
  transition: font-size 0.2s ease;
}

.status-success {
  color: #4caf50;
  font-weight: 600;
}

.status-error {
  color: #f44336;
  font-weight: 600;
}

.status-warning {
  color: #ff9800;
  font-weight: 600;
}

.keyboard-shortcuts {
  font-size: 10px;
  color: #666;
  opacity: 0.7;
  transition: all 0.3s ease, font-size 0.2s ease;
  font-family: 'SF Mono', monospace;
}

.keyboard-shortcuts:hover {
  opacity: 1;
  color: #888;
  transform: scale(1.1);
}

.security-dashboard {
  padding: 20px;
  background: linear-gradient(145deg, #0a0a0a 0%, #111111 100%);
  border-radius: 12px;
  margin-bottom: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.security-overview {
  margin-bottom: 24px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
}

.security-metrics {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.metric-card {
  background: linear-gradient(145deg, #1a1a1a 0%, #2a2a2a 100%);
  border-radius: 8px;
  padding: 16px;
  min-width: 120px;
  text-align: center;
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.metric-card.high-risk {
  border-color: rgba(244, 67, 54, 0.3);
  background: linear-gradient(145deg, #2a0a0a 0%, #1a1a1a 100%);
}

.metric-card.medium-risk {
  border-color: rgba(255, 152, 0, 0.3);
  background: linear-gradient(145deg, #2a1f0a 0%, #1a1a1a 100%);
}

.metric-card.auth-found {
  border-color: rgba(255, 235, 59, 0.3);
  background: linear-gradient(145deg, #2a2a0a 0%, #1a1a1a 100%);
}

.metric-card.pii-found {
  border-color: rgba(156, 39, 176, 0.3);
  background: linear-gradient(145deg, #2a0a2a 0%, #1a1a1a 100%);
}

.metric-card.insecure {
  border-color: rgba(244, 67, 54, 0.3);
  background: linear-gradient(145deg, #2a0a0a 0%, #1a1a1a 100%);
}

.metric-value {
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
  line-height: 1;
}

.metric-label {
  font-size: 12px;
  color: #888;
  margin-top: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.metric-icon {
  position: absolute;
  top: 12px;
  right: 12px;
  opacity: 0.3;
}

/* Domain Analysis */
.domain-analysis {
  margin-bottom: 24px;
}

.domain-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* Method Breakdown */
.method-breakdown {
  margin-bottom: 24px;
}

.method-stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.method-stat {
  display: flex;
  align-items: center;
  gap: 12px;
}

.method-chip {
  min-width: 60px;
  justify-content: center;
}

.count {
  min-width: 30px;
  font-family: 'SF Mono', monospace;
  font-weight: 600;
  color: #ffffff;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

/* Enhanced Requests List */
.enhanced-requests-list {
  background: linear-gradient(145deg, #0a0a0a 0%, #111111 100%);
  border-radius: 12px;
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.requests-header {
  margin-bottom: 20px;
}

.request-count {
  font-size: 14px;
  color: #888;
  font-weight: 400;
}

.requests-container {
  max-height: 600px;
  overflow-y: auto;
}

/* Enhanced Request Items */
.enhanced-request-item {
  background: linear-gradient(145deg, #1a1a1a 0%, #252525 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  margin-bottom: 16px;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  position: relative;
}

.enhanced-request-item:hover {
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.enhanced-request-item.high-risk {
  border-left: 4px solid #f44336;
  background: linear-gradient(145deg, #2a1515 0%, #1a1a1a 100%);
}

.enhanced-request-item.medium-risk {
  border-left: 4px solid #ff9800;
  background: linear-gradient(145deg, #2a1f10 0%, #1a1a1a 100%);
}

.enhanced-request-item.has-error {
  border-left: 4px solid #f44336;
  background: linear-gradient(145deg, #2a0a0a 0%, #1a1a1a 100%);
}

/* Enhanced Request Header */
.enhanced-request-header {
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.request-main-info {
  flex: 1;
  min-width: 0;
}

.request-badges {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.method-badge, .status-badge, .error-badge, .security-badge {
  font-weight: 600 !important;
  letter-spacing: 0.5px !important;
}

.security-badge {
  font-size: 10px !important;
}

.request-url-section {
  margin-top: 8px;
}

.request-url {
  font-family: 'SF Mono', monospace;
  font-size: 14px;
  color: #e6e6e6;
  word-break: break-all;
  line-height: 1.4;
  margin-bottom: 8px;
  transition: font-size 0.2s ease;
}

.request-metadata {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #888;
}

.timestamp {
  font-family: 'SF Mono', monospace;
  transition: font-size 0.2s ease;
}

.size-info {
  font-family: 'SF Mono', monospace;
  transition: font-size 0.2s ease;
}

/* Security Indicators */
.security-indicators {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.indicator-icon {
  opacity: 0.8;
  transition: opacity 0.3s ease;
}

.indicator-icon:hover {
  opacity: 1;
}

.expand-arrow {
  transition: transform 0.3s ease;
  color: #888;
}

.expand-arrow.rotated {
  transform: rotate(180deg);
  color: #58a6ff;
}

/* Enhanced Request Details */
.enhanced-request-details {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: linear-gradient(145deg, #0f0f0f 0%, #1a1a1a 100%);
  animation: slideDown 0.3s ease-out;
}

/* Security Analysis Panel */
.security-analysis-panel {
  padding: 20px;
  background: linear-gradient(145deg, #1a1a1a 0%, #0f0f0f 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.detail-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #58a6ff;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
}

.security-findings {
  space-y: 12px;
}

.risk-score {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.risk-label {
  font-size: 14px;
  color: #888;
  font-weight: 500;
  transition: font-size 0.2s ease;
}

.findings-list {
  space-y: 8px;
}

.finding-item {
  display: flex;
  align-items: center;
  font-size: 13px;
  color: #ddd;
  margin-bottom: 8px;
  transition: font-size 0.2s ease;
}

.no-findings {
  display: flex;
  align-items: center;
  font-size: 13px;
  color: #4caf50;
  transition: font-size 0.2s ease;
}

/* Detail Tabs */
.detail-tabs {
  padding: 20px;
}

/* Tab styling improvements */
.detail-tabs .v-tabs {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  padding: 4px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.detail-tabs .v-tab {
  min-height: 36px !important;
  border-radius: 6px !important;
  margin: 0 2px !important;
  transition: all 0.3s ease !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  text-transform: none !important;
  letter-spacing: 0.3px !important;
}

.detail-tabs .v-tab:hover {
  background: rgba(255, 255, 255, 0.05) !important;
  transform: translateY(-1px);
}

.detail-tabs .v-tab--selected {
  background: linear-gradient(135deg, #58a6ff 0%, #4a9eff 100%) !important;
  color: #ffffff !important;
  box-shadow: 0 2px 8px rgba(88, 166, 255, 0.3);
}

/* Window content styling */
.detail-tabs .v-window {
  background: transparent;
  min-height: 200px;
}

.detail-tabs .v-window-item {
  padding: 16px 0;
}

/* Overview Tab */
.overview-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.overview-section {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.overview-title {
  font-size: 14px;
  font-weight: 600;
  color: #58a6ff;
  margin-bottom: 12px;
  transition: font-size 0.2s ease;
}

.info-pairs {
  space-y: 8px;
}

.info-pair {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.info-key {
  font-size: 13px;
  color: #888;
  font-weight: 500;
  transition: font-size 0.2s ease;
}

.info-value {
  font-size: 13px;
  color: #ffffff;
  font-family: 'SF Mono', monospace;
  word-break: break-word;
  text-align: right;
  max-width: 60%;
  transition: font-size 0.2s ease;
}

.error-text {
  color: #ff6b6b !important;
}

/* Headers Section */
.headers-section {
  space-y: 20px;
}

.header-group {
  margin-bottom: 20px;
}

.header-group-title {
  font-size: 14px;
  font-weight: 600;
  color: #58a6ff;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  transition: font-size 0.2s ease;
}

.enhanced-headers-list {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  max-height: 300px;
  overflow-y: auto;
}

.enhanced-header-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: background-color 0.3s ease;
}

.enhanced-header-item:last-child {
  border-bottom: none;
}

.enhanced-header-item:hover {
  background: rgba(255, 255, 255, 0.02);
}

.enhanced-header-item.sensitive-header {
  background: rgba(255, 152, 0, 0.05);
  border-left: 3px solid #ff9800;
}

.header-key {
  font-size: 12px;
  color: #2196f3;
  font-weight: 600;
  font-family: 'SF Mono', monospace;
  min-width: 0;
  max-width: 40%;
  word-break: break-word;
  display: flex;
  align-items: center;
  transition: font-size 0.2s ease;
}

.header-value {
  font-size: 12px;
  color: #ccc;
  font-family: 'SF Mono', monospace;
  word-break: break-all;
  text-align: right;
  max-width: 60%;
  transition: font-size 0.2s ease;
}

/* Body Sections */
.body-section, .response-section {
  space-y: 16px;
}

.body-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.body-title {
  font-size: 14px;
  font-weight: 600;
  color: #58a6ff;
  transition: font-size 0.2s ease;
}

.body-size {
  font-size: 12px;
  color: #888;
  font-family: 'SF Mono', monospace;
  transition: font-size 0.2s ease;
}

.enhanced-body-content {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
}

.body-text {
  padding: 16px;
  font-size: 12px;
  color: #e6e6e6;
  font-family: 'SF Mono', monospace;
  line-height: 1.5;
  max-height: 400px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  transition: font-size 0.2s ease, line-height 0.2s ease;
}

.no-response-body {
  padding: 40px;
  text-align: center;
  color: #888;
  font-style: italic;
}

/* Enhanced Control Bar */
.output-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, #2a2a2a 0%, #2d2d2d 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.header-left {
  display: flex;
  align-items: center;
}

.requests-count {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  transition: font-size 0.2s ease;
}

.output-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-field {
  max-width: 200px;
}

.filter-select {
  font-size: 12px;
}

/* Empty States */
.empty-state, .no-results {
  padding: 60px 20px;
  text-align: center;
  color: #888;
}

.empty-state h4, .no-results h4 {
  margin: 16px 0 8px;
  color: #aaa;
  font-weight: 600;
  transition: font-size 0.2s ease;
}

.empty-state p, .no-results p {
  margin-bottom: 16px;
  font-size: 14px;
  line-height: 1.6;
  transition: font-size 0.2s ease;
}

/* Raw Network View */
.raw-network-view {
  padding: 20px;
}

/* Apply font size transitions to all text elements */
.feature-name,
.feature-description,
.output-text,
.platform-title,
.category-title,
.info-label,
.metric-label,
.metric-value,
.status-text,
.session-info,
.keyboard-shortcuts {
  transition: font-size 0.2s ease, line-height 0.2s ease;
}

/* Vuetify Component Overrides */
.v-btn {
  text-transform: none !important;
  border-radius: 8px !important;
  font-weight: 500 !important;
}

.v-btn--variant-outlined {
  border-width: 1px !important;
}

.v-chip {
  font-size: 10px !important;
  font-weight: 600 !important;
  border-radius: 6px !important;
  letter-spacing: 0.5px !important;
}

.v-switch {
  flex: none;
}

.v-switch :deep(.v-selection-control) {
  min-height: auto;
}

.v-switch :deep(.v-selection-control__wrapper) {
  height: 24px;
}

/* Font Size Control Divider */
.dialog-header .v-divider {
  height: 24px;
}

/* Scrollbar Styling */
.sections-container::-webkit-scrollbar,
.output-text::-webkit-scrollbar,
.requests-container::-webkit-scrollbar,
.enhanced-headers-list::-webkit-scrollbar,
.body-text::-webkit-scrollbar {
  width: 6px;
}

.sections-container::-webkit-scrollbar-track,
.output-text::-webkit-scrollbar-track,
.requests-container::-webkit-scrollbar-track,
.enhanced-headers-list::-webkit-scrollbar-track,
.body-text::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.sections-container::-webkit-scrollbar-thumb,
.output-text::-webkit-scrollbar-thumb,
.requests-container::-webkit-scrollbar-thumb,
.enhanced-headers-list::-webkit-scrollbar-thumb,
.body-text::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%);
  border-radius: 3px;
}

.sections-container::-webkit-scrollbar-thumb:hover,
.output-text::-webkit-scrollbar-thumb:hover,
.requests-container::-webkit-scrollbar-thumb:hover,
.enhanced-headers-list::-webkit-scrollbar-thumb:hover,
.body-text::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.2) 100%);
}

/* Live output scrollbar */
.live-output::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(76, 175, 80, 0.4) 0%, rgba(76, 175, 80, 0.2) 100%);
}

.live-output::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(76, 175, 80, 0.6) 0%, rgba(76, 175, 80, 0.4) 100%);
}

/* Network output scrollbar */
.network-output::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(33, 150, 243, 0.4) 0%, rgba(33, 150, 243, 0.2) 100%);
}

.network-output::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(33, 150, 243, 0.6) 0%, rgba(33, 150, 243, 0.4) 100%);
}

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.feature-output {
  animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.category-content {
  animation: slideDown 0.3s ease-out;
}

.request-details {
  animation: slideDown 0.3s ease-out;
}

/* Animation */
@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    max-height: 2000px;
    transform: translateY(0);
  }
}

/* Request item hover effects */
@keyframes requestPulse {
  0% { box-shadow: 0 0 0 0 rgba(33, 150, 243, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(33, 150, 243, 0); }
  100% { box-shadow: 0 0 0 0 rgba(33, 150, 243, 0); }
}

.request-item.has-response:hover {
  animation: requestPulse 1.5s infinite;
}

/* Focus States for Accessibility */
.v-btn:focus {
  outline: 2px solid #58a6ff;
  outline-offset: 2px;
}

.feature-card:focus-within {
  border-color: #58a6ff;
  box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.2);
}

.request-item:focus {
  outline: 2px solid #58a6ff;
  outline-offset: 2px;
}

/* Loading States */
.v-btn--loading {
  pointer-events: none;
  opacity: 0.7;
}

/* Responsive Design */
@media (max-width: 1200px) {
  .movable-dialog {
    width: 90vw !important;
    max-width: 900px !important;
    left: 5vw !important;
  }

  .overview-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .security-metrics {
    justify-content: center;
  }

  .enhanced-request-header {
    flex-direction: column;
    gap: 16px;
  }

  .security-indicators {
    justify-content: flex-end;
    width: 100%;
  }
}

@media (max-width: 768px) {
  .dialog-header {
    padding: 16px 20px;
  }

  .agent-status-bar {
    padding: 12px 20px;
  }

  .sections-container {
    padding: 16px;
  }

  .feature-card {
    padding: 16px;
  }

  .info-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .output-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .output-actions {
    justify-content: space-between;
  }

  .search-field {
    max-width: none;
    flex: 1;
  }

  .info-pair {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .info-value {
    text-align: left;
    max-width: 100%;
  }

  .enhanced-header-item {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }

  .header-key, .header-value {
    max-width: 100%;
    text-align: left;
  }
}

/* Dark theme specific enhancements */
@media (prefers-color-scheme: dark) {
  .feature-card {
    box-shadow:
      0 4px 16px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  .network-stats {
    backdrop-filter: blur(12px);
    background: rgba(33, 150, 243, 0.15);
  }

  .request-item {
    backdrop-filter: blur(4px);
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .feature-card {
    border-width: 2px;
  }

  .request-item {
    border-width: 2px;
  }

  .header-key {
    color: #ffffff;
  }

  .header-value {
    color: #e0e0e0;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .feature-card,
  .request-item,
  .expand-icon,
  .method-chips .v-chip,
  .domain-chips .v-chip {
    transition: none;
  }

  .feature-output,
  .category-content,
  .request-details {
    animation: none;
  }

  .request-item.has-response:hover {
    animation: none;
  }
}
</style>







