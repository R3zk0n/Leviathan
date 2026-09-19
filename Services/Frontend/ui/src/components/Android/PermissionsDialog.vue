<template>
  <v-dialog v-model="dialogModel" max-width="950px" scrollable>
    <v-card :class="isDark ? 'theme--dark' : 'theme--light'">
      <!-- Header -->
      <v-card-title class="d-flex align-center pa-4">
        <v-icon class="mr-2" color="primary">mdi-shield-lock-outline</v-icon>
        <span class="text-h6">Permissions</span>
        <v-chip class="ml-3" size="small" color="primary" variant="outlined">
          {{ filteredPermissions.length }}
        </v-chip>
        <v-spacer></v-spacer>
        <v-btn icon variant="text" size="small" @click="dialogModel = false">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-divider></v-divider>

      <!-- Toolbar -->
      <v-toolbar flat density="compact" class="px-4" :class="isDark ? 'theme--dark' : 'theme--light'">
        <!-- Platform Toggle -->
        <v-btn-toggle v-model="platform" mandatory density="compact" class="mr-3">
          <v-btn value="android" size="small">
            <v-icon start size="small">mdi-android</v-icon>
            Android
          </v-btn>
          <v-btn value="ios" size="small">
            <v-icon start size="small">mdi-apple</v-icon>
            iOS
          </v-btn>
        </v-btn-toggle>

        <!-- Search -->
        <v-text-field
          v-model="searchQuery"
          prepend-inner-icon="mdi-magnify"
          placeholder="Search permissions..."
          density="compact"
          variant="outlined"
          hide-details
          clearable
          style="max-width: 300px;"
          class="mr-2"
          :class="isDark ? 'input-dark' : ''"
        ></v-text-field>

        <!-- Filter -->
        <v-select
          v-model="categoryFilter"
          :items="currentCategoryOptions"
          density="compact"
          variant="outlined"
          hide-details
          style="max-width: 180px;"
          class="mr-2"
          :class="isDark ? 'input-dark' : ''"
        ></v-select>

        <v-spacer></v-spacer>

        <!-- View Toggle -->
        <v-btn-toggle v-model="viewMode" mandatory density="compact" class="mr-2">
          <v-btn value="list" size="small">
            <v-icon>mdi-view-list</v-icon>
          </v-btn>
          <v-btn value="xml" size="small" v-if="platform === 'android'">
            <v-icon>mdi-xml</v-icon>
          </v-btn>
          <v-btn value="plist" size="small" v-if="platform === 'ios'">
            <v-icon>mdi-code-tags</v-icon>
          </v-btn>
          <v-btn value="json" size="small">
            <v-icon>mdi-code-json</v-icon>
          </v-btn>
        </v-btn-toggle>

        <!-- Copy Button -->
        <v-btn
          icon
          variant="text"
          size="small"
          @click="copyToClipboard"
          :disabled="filteredPermissions.length === 0"
          :class="isDark ? 'btn-dark' : ''"
        >
          <v-icon>mdi-content-copy</v-icon>
          <v-tooltip activator="parent" location="top">Copy</v-tooltip>
        </v-btn>
      </v-toolbar>

      <v-divider></v-divider>

      <!-- Content -->
      <v-card-text style="max-height: 550px; min-height: 400px;" class="pa-0">
        <!-- Loading State -->
        <div v-if="loading" class="text-center py-12">
          <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
          <p class="text-h6 mt-4" :class="isDark ? 'text-white' : 'text-black'">Loading {{ platform === 'ios' ? 'iOS' : 'Android' }} permissions...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="text-center py-12">
          <v-icon size="64" color="error">mdi-alert-circle</v-icon>
          <p class="text-h6 mt-4" :class="isDark ? 'text-white' : 'text-black'">Error loading permissions</p>
          <p class="text-body-2" :class="isDark ? 'text-grey-lighten-1' : 'text-grey-darken-1'">{{ error }}</p>
          <v-btn color="primary" variant="elevated" class="mt-4" @click="fetchPermissions">
            Retry
          </v-btn>
        </div>

        <!-- List View -->
        <div v-else-if="viewMode === 'list'" class="pa-4">
          <!-- Stats Chips -->
          <div class="mb-4 d-flex flex-wrap" style="gap: 8px;">
            <v-chip v-if="platform === 'android'" size="small" variant="flat" color="info">
              <v-icon start size="small">mdi-shield-check</v-icon>
              {{ standardCount }} Standard
            </v-chip>
            <v-chip v-if="platform === 'android'" size="small" variant="flat" color="success">
              <v-icon start size="small">mdi-package-variant</v-icon>
              {{ customCount }} Custom
            </v-chip>
            <v-chip v-if="dangerousCount > 0" size="small" variant="flat" color="warning">
              <v-icon start size="small">mdi-alert</v-icon>
              {{ dangerousCount }} {{ platform === 'ios' ? 'Privacy-Sensitive' : 'Dangerous' }}
            </v-chip>
            <v-chip v-if="platform === 'ios' && requiredCount > 0" size="small" variant="flat" color="error">
              <v-icon start size="small">mdi-alert-octagon</v-icon>
              {{ requiredCount }} Required Description
            </v-chip>
          </div>

          <!-- Empty State -->
          <div v-if="filteredPermissions.length === 0" class="text-center py-12">
            <v-icon size="64" color="grey-lighten-1">mdi-shield-search</v-icon>
            <p class="text-h6 mt-4" :class="isDark ? 'text-white' : 'text-black'">No permissions found</p>
            <p class="text-body-2" :class="isDark ? 'text-grey-lighten-1' : 'text-grey-darken-1'">Try adjusting your search or filter</p>
          </div>

          <!-- Permissions List -->
          <v-list v-else class="pa-0" lines="two">
            <template v-for="(permission, index) in filteredPermissions" :key="index">
              <v-list-item class="px-0 permission-item" :class="isDark ? 'theme--dark' : 'theme--light'">
                <template v-slot:prepend>
                  <v-avatar :color="getPermissionColor(permission)" size="40">
                    <v-icon color="white" size="20">{{ getPermissionIcon(permission) }}</v-icon>
                  </v-avatar>
                </template>

                <v-list-item-title class="font-weight-medium mb-1">
                  {{ formatPermissionName(permission) }}
                </v-list-item-title>

                <v-list-item-subtitle>
                  <code class="permission-code" :class="isDark ? 'code-dark' : 'code-light'">{{ getPermissionKey(permission) }}</code>
                </v-list-item-subtitle>

                <template v-slot:append>
                  <div class="d-flex flex-column align-end" style="gap: 4px;">
                    <v-chip
                      v-if="platform === 'android'"
                      :color="getCategoryColor(permission)"
                      size="x-small"
                      variant="flat"
                    >
                      {{ getCategory(permission) }}
                    </v-chip>
                    <v-chip
                      v-if="isDangerous(permission)"
                      :color="platform === 'ios' ? 'info' : 'warning'"
                      size="x-small"
                      variant="outlined"
                    >
                      {{ platform === 'ios' ? 'Privacy' : 'Dangerous' }}
                    </v-chip>
                    <v-chip
                      v-if="platform === 'ios' && requiresDescription(permission)"
                      color="error"
                      size="x-small"
                      variant="outlined"
                    >
                      Requires Description
                    </v-chip>
                  </div>
                </template>
              </v-list-item>
              <v-divider v-if="index < filteredPermissions.length - 1" :key="`div-${index}`"></v-divider>
            </template>
          </v-list>
        </div>

        <!-- XML View (Android) -->
        <div v-else-if="viewMode === 'xml' && platform === 'android'" class="code-view" :class="isDark ? 'theme--dark' : 'theme--light'">
          <div v-highlight class="pa-4">
            <pre class="language-xml"><code>{{ xmlContent }}</code></pre>
          </div>
        </div>

        <!-- Plist View (iOS) -->
        <div v-else-if="viewMode === 'plist' && platform === 'ios'" class="code-view" :class="isDark ? 'theme--dark' : 'theme--light'">
          <div v-highlight class="pa-4">
            <pre class="language-xml"><code>{{ plistContent }}</code></pre>
          </div>
        </div>

        <!-- JSON View -->
        <div v-else class="code-view" :class="isDark ? 'theme--dark' : 'theme--light'">
          <div v-highlight class="pa-4">
            <pre class="language-json"><code>{{ jsonContent }}</code></pre>
          </div>
        </div>
      </v-card-text>

      <v-divider></v-divider>

      <!-- Footer -->
      <v-card-actions class="pa-4">
        <v-spacer></v-spacer>
        <v-btn
          variant="text"
          @click="dialogModel = false"
          :class="isDark ? 'btn-dark' : ''"
        >
          Close
        </v-btn>
        <v-btn
          color="primary"
          variant="elevated"
          @click="downloadFile"
          :disabled="filteredPermissions.length === 0 || loading"
        >
          <v-icon start>mdi-download</v-icon>
          Download
        </v-btn>
      </v-card-actions>
    </v-card>

    <!-- Snackbar for notifications -->
    <v-snackbar
      v-model="snackbar"
      :timeout="2000"
      color="success"
      location="bottom"
    >
      {{ snackbarText }}
      <template v-slot:actions>
        <v-btn variant="text" @click="snackbar = false">Close</v-btn>
      </template>
    </v-snackbar>
  </v-dialog>
</template>

<script>
export default {
  name: 'PermissionsDialog',
  props: {
    permissionsDialog: Boolean,
    permissionsContent: [Array, Object, String],
    appId: String, // Used for iOS fetch: /ios/permissions/{appId}
    isDark: Boolean
  },
  emits: ['update:permissionsDialog'],
  data() {
    return {
      platform: 'android',
      searchQuery: '',
      categoryFilter: 'all',
      viewMode: 'list',
      snackbar: false,
      snackbarText: '',
      loading: false,
      error: null,
      iosPermissions: [],
      androidCategoryOptions: [
        { title: 'All Permissions', value: 'all' },
        { title: 'Standard Only', value: 'standard' },
        { title: 'Custom Only', value: 'custom' },
        { title: 'Dangerous Only', value: 'dangerous' }
      ],
      iosCategoryOptions: [
        { title: 'All Permissions', value: 'all' },
        { title: 'Privacy-Sensitive', value: 'privacy' },
        { title: 'Requires Description', value: 'required' }
      ],
      androidDangerousPermissions: [
        'READ_CALENDAR', 'WRITE_CALENDAR',
        'CAMERA',
        'READ_CONTACTS', 'WRITE_CONTACTS', 'GET_ACCOUNTS',
        'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'ACCESS_BACKGROUND_LOCATION',
        'RECORD_AUDIO',
        'READ_PHONE_STATE', 'READ_PHONE_NUMBERS', 'CALL_PHONE', 'READ_CALL_LOG',
        'WRITE_CALL_LOG', 'ADD_VOICEMAIL', 'USE_SIP', 'PROCESS_OUTGOING_CALLS',
        'ANSWER_PHONE_CALLS',
        'BODY_SENSORS',
        'SEND_SMS', 'RECEIVE_SMS', 'READ_SMS', 'RECEIVE_WAP_PUSH', 'RECEIVE_MMS',
        'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE', 'ACCESS_MEDIA_LOCATION',
        'ACTIVITY_RECOGNITION'
      ],
      iosPrivacySensitivePermissions: [
        'NSCameraUsageDescription',
        'NSPhotoLibraryUsageDescription',
        'NSPhotoLibraryAddUsageDescription',
        'NSMicrophoneUsageDescription',
        'NSLocationWhenInUseUsageDescription',
        'NSLocationAlwaysUsageDescription',
        'NSLocationAlwaysAndWhenInUseUsageDescription',
        'NSContactsUsageDescription',
        'NSCalendarsUsageDescription',
        'NSRemindersUsageDescription',
        'NSMotionUsageDescription',
        'NSHealthShareUsageDescription',
        'NSHealthUpdateUsageDescription',
        'NSBluetoothPeripheralUsageDescription',
        'NSBluetoothAlwaysUsageDescription',
        'NSAppleMusicUsageDescription',
        'NSSpeechRecognitionUsageDescription',
        'NSSiriUsageDescription',
        'NSFaceIDUsageDescription',
        'NSLocalNetworkUsageDescription',
        'NSUserTrackingUsageDescription'
      ]
    };
  },
  computed: {
    dialogModel: {
      get() {
        return this.permissionsDialog;
      },
      set(value) {
        this.$emit('update:permissionsDialog', value);
      }
    },

    currentCategoryOptions() {
      return this.platform === 'ios' ? this.iosCategoryOptions : this.androidCategoryOptions;
    },

    permissionsArray() {
      if (this.platform === 'ios') {
        // If we have fetched iOS permissions, use those
        if (this.iosPermissions && this.iosPermissions.length > 0) {
          return this.iosPermissions;
        }

        // Otherwise, try to parse from permissionsContent only if it looks like iOS data
        if (this.permissionsContent) {
          let parsed;
          if (typeof this.permissionsContent === 'string') {
            try {
              parsed = JSON.parse(this.permissionsContent);
            } catch {
              return [];
            }
          } else {
            parsed = this.permissionsContent;
          }

          // Helper to check if a key looks like iOS permission
          const isIOSPermission = (key) => {
            if (typeof key !== 'string') return false;
            return key.startsWith('NS') ||
                   key.includes('UsageDescription') ||
                   key.startsWith('UI') ||
                   key.startsWith('IT');
          };

          // Handle different iOS data formats - but validate it's actually iOS data
          if (Array.isArray(parsed)) {
            // Check if first item looks like iOS permission
            if (parsed.length > 0) {
              const firstKey = typeof parsed[0] === 'string' ? parsed[0] : (parsed[0].key || parsed[0].name || '');
              if (!isIOSPermission(firstKey)) {
                return []; // Not iOS data, return empty
              }
            }
            return parsed;
          } else if (parsed.permissions && Array.isArray(parsed.permissions)) {
            const perms = parsed.permissions;
            if (perms.length > 0) {
              const firstKey = typeof perms[0] === 'string' ? perms[0] : (perms[0].key || perms[0].name || '');
              if (!isIOSPermission(firstKey)) {
                return []; // Not iOS data, return empty
              }
            }
            return perms;
          } else if (typeof parsed === 'object') {
            const keys = Object.keys(parsed);
            // Check if keys look like iOS permissions
            if (keys.length > 0 && !isIOSPermission(keys[0])) {
              return []; // Not iOS data, return empty
            }
            // Convert object to array format
            return Object.entries(parsed).map(([key, value]) => {
              if (typeof value === 'string') {
                return { key, description: value };
              }
              return { key, ...value };
            });
          }
        }

        return [];
      }

      // Android permissions handling (original logic)
      if (Array.isArray(this.permissionsContent)) {
        return this.permissionsContent;
      } else if (typeof this.permissionsContent === 'string') {
        try {
          const parsed = JSON.parse(this.permissionsContent);
          if (parsed.permissions && Array.isArray(parsed.permissions)) {
            return parsed.permissions;
          }
          return Array.isArray(parsed) ? parsed : [this.permissionsContent];
        } catch {
          return this.permissionsContent.split('\n').filter(p => p.trim());
        }
      } else if (typeof this.permissionsContent === 'object' && this.permissionsContent !== null) {
        if (this.permissionsContent.permissions && Array.isArray(this.permissionsContent.permissions)) {
          return this.permissionsContent.permissions;
        }
        return Object.values(this.permissionsContent);
      }
      return [];
    },

    filteredPermissions() {
      let filtered = this.permissionsArray;

      if (this.platform === 'android') {
        if (this.categoryFilter === 'standard') {
          filtered = filtered.filter(this.isStandardPermission);
        } else if (this.categoryFilter === 'custom') {
          filtered = filtered.filter(this.isCustomPermission);
        } else if (this.categoryFilter === 'dangerous') {
          filtered = filtered.filter(this.isDangerous);
        }
      } else if (this.platform === 'ios') {
        if (this.categoryFilter === 'privacy') {
          filtered = filtered.filter(this.isDangerous);
        } else if (this.categoryFilter === 'required') {
          filtered = filtered.filter(this.requiresDescription);
        }
      }

      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        filtered = filtered.filter(permission => {
          const key = this.getPermissionKey(permission);
          const name = this.formatPermissionName(permission);
          return key.toLowerCase().includes(query) || name.toLowerCase().includes(query);
        });
      }

      return filtered.sort((a, b) => {
        const keyA = this.getPermissionKey(a).toLowerCase();
        const keyB = this.getPermissionKey(b).toLowerCase();
        return keyA.localeCompare(keyB);
      });
    },

    standardCount() {
      if (this.platform === 'ios') return 0;
      return this.filteredPermissions.filter(this.isStandardPermission).length;
    },

    customCount() {
      if (this.platform === 'ios') return 0;
      return this.filteredPermissions.filter(this.isCustomPermission).length;
    },

    dangerousCount() {
      return this.filteredPermissions.filter(this.isDangerous).length;
    },

    requiredCount() {
      if (this.platform !== 'ios') return 0;
      return this.filteredPermissions.filter(this.requiresDescription).length;
    },

    xmlContent() {
      if (this.filteredPermissions.length === 0) return '';

      return this.filteredPermissions
        .map(permission => {
          const category = this.getCategory(permission);
          const dangerous = this.isDangerous(permission) ? ' (Dangerous)' : '';
          return `<uses-permission android:name="${permission}"/> <!-- ${category}${dangerous} -->`;
        })
        .join('\n');
    },

    plistContent() {
      if (this.filteredPermissions.length === 0) return '';

      let content = '<?xml version="1.0" encoding="UTF-8"?>\n';
      content += '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n';
      content += '<plist version="1.0">\n<dict>\n';

      this.filteredPermissions.forEach(permission => {
        const key = this.getPermissionKey(permission);
        const description = typeof permission === 'object' && permission.description
          ? permission.description
          : `This app requires ${this.formatPermissionName(permission).toLowerCase()} access.`;

        content += `\t<key>${key}</key>\n`;
        content += `\t<string>${description}</string>\n`;
      });

      content += '</dict>\n</plist>';
      return content;
    },

    jsonContent() {
      if (this.platform === 'ios') {
        const permissions = {};
        this.filteredPermissions.forEach(permission => {
          const key = this.getPermissionKey(permission);
          permissions[key] = typeof permission === 'object' && permission.description
            ? permission.description
            : `This app requires ${this.formatPermissionName(permission).toLowerCase()} access.`;
        });
        return JSON.stringify(permissions, null, 2);
      }
      return JSON.stringify({ permissions: this.filteredPermissions }, null, 2);
    }
  },

  watch: {
    permissionsDialog(newVal) {
      if (newVal) {
        // Reset state when dialog opens
        this.searchQuery = '';
        this.categoryFilter = 'all';
        this.viewMode = 'list';
        this.error = null;

        // Default to Android, then check if iOS
        this.platform = 'android';

        // Auto-detect platform based on appId extension
        if (this.appId && this.appId.endsWith('.ipa')) {
          this.platform = 'ios';
        }

        // If iOS and appId provided and no permissionsContent, fetch permissions
        if (this.platform === 'ios' && this.appId && !this.permissionsContent) {
          this.fetchPermissions();
        }
      }
    },

    platform(newVal) {
      // Reset filters when switching platforms
      this.searchQuery = '';
      this.categoryFilter = 'all';
      this.viewMode = 'list';
      this.error = null;

      // Fetch iOS permissions if switching to iOS and no content available
      if (newVal === 'ios' && this.appId && this.permissionsDialog && !this.permissionsContent) {
        this.fetchPermissions();
      }
    }
  },

  methods: {
    async fetchPermissions() {
      if (this.platform !== 'ios' || !this.appId) return;

      this.loading = true;
      this.error = null;

      try {
        const response = await fetch(`/ios/permissions/${this.appId}`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Handle different response formats
        if (Array.isArray(data)) {
          this.iosPermissions = data;
        } else if (data.permissions && Array.isArray(data.permissions)) {
          this.iosPermissions = data.permissions;
        } else if (typeof data === 'object') {
          // Convert object to array format
          this.iosPermissions = Object.entries(data).map(([key, value]) => {
            if (typeof value === 'string') {
              return { key, description: value };
            }
            return { key, ...value };
          });
        } else {
          this.iosPermissions = [];
        }
      } catch (err) {
        this.error = err.message || 'Failed to fetch iOS permissions';
        this.iosPermissions = [];
      } finally {
        this.loading = false;
      }
    },

    getPermissionKey(permission) {
      if (typeof permission === 'string') {
        return permission;
      }
      return permission.key || permission.name || '';
    },

    isStandardPermission(permission) {
      const key = this.getPermissionKey(permission);
      return key.startsWith('android.permission.') ||
             key.startsWith('com.android.');
    },

    isCustomPermission(permission) {
      return !this.isStandardPermission(permission);
    },

    isDangerous(permission) {
      const key = this.getPermissionKey(permission);

      if (this.platform === 'ios') {
        return this.iosPrivacySensitivePermissions.some(p => key.includes(p));
      }

      const permName = key.split('.').pop();
      return this.androidDangerousPermissions.some(dp => permName.includes(dp));
    },

    requiresDescription(permission) {
      if (this.platform !== 'ios') return false;
      const key = this.getPermissionKey(permission);
      return key.includes('UsageDescription');
    },

    getCategory(permission) {
      if (this.platform === 'ios') {
        return 'iOS';
      }
      return this.isCustomPermission(permission) ? 'Custom' : 'Standard';
    },

    getCategoryColor(permission) {
      if (this.platform === 'ios') {
        return 'primary';
      }
      return this.isCustomPermission(permission) ? 'success' : 'info';
    },

    formatPermissionName(permission) {
      const key = this.getPermissionKey(permission);

      if (this.platform === 'ios') {
        // Remove NS prefix and UsageDescription suffix
        let name = key.replace(/^NS/, '').replace(/UsageDescription$/, '');

        // Split camelCase into words
        name = name.replace(/([A-Z])/g, ' $1').trim();

        return name.charAt(0).toUpperCase() + name.slice(1);
      }

      const parts = key.split('.');
      const name = parts[parts.length - 1];
      return name.split('_').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
    },

    getPermissionIcon(permission) {
      const key = this.getPermissionKey(permission).toUpperCase();

      if (key.includes('CAMERA')) return 'mdi-camera';
      if (key.includes('LOCATION') || key.includes('GPS')) return 'mdi-map-marker';
      if (key.includes('CONTACTS')) return 'mdi-account-multiple';
      if (key.includes('SMS') || key.includes('MMS')) return 'mdi-message-text';
      if (key.includes('CALL') || key.includes('PHONE')) return 'mdi-phone';
      if (key.includes('STORAGE') || key.includes('MEDIA') || key.includes('PHOTO') || key.includes('LIBRARY')) return 'mdi-folder';
      if (key.includes('MICROPHONE') || key.includes('RECORD_AUDIO')) return 'mdi-microphone';
      if (key.includes('CALENDAR')) return 'mdi-calendar';
      if (key.includes('REMINDER')) return 'mdi-bell';
      if (key.includes('INTERNET') || key.includes('NETWORK')) return 'mdi-web';
      if (key.includes('BLUETOOTH')) return 'mdi-bluetooth';
      if (key.includes('WIFI')) return 'mdi-wifi';
      if (key.includes('NFC')) return 'mdi-nfc';
      if (key.includes('BIOMETRIC') || key.includes('FINGERPRINT') || key.includes('FACEID')) return 'mdi-fingerprint';
      if (key.includes('VPN')) return 'mdi-vpn';
      if (key.includes('BATTERY')) return 'mdi-battery';
      if (key.includes('MOTION') || key.includes('ACTIVITY')) return 'mdi-run';
      if (key.includes('HEALTH')) return 'mdi-heart-pulse';
      if (key.includes('MUSIC')) return 'mdi-music';
      if (key.includes('SPEECH') || key.includes('SIRI')) return 'mdi-microphone-message';
      if (key.includes('TRACKING')) return 'mdi-radar';

      if (this.platform === 'ios') return 'mdi-apple';
      if (this.isCustomPermission(permission)) return 'mdi-package-variant';
      return 'mdi-shield-check';
    },

    getPermissionColor(permission) {
      if (this.isDangerous(permission)) return this.platform === 'ios' ? 'info' : 'warning';
      if (this.platform === 'ios') return 'primary';
      if (this.isCustomPermission(permission)) return 'success';
      return 'info';
    },

    async copyToClipboard() {
      try {
        let text = '';
        if (this.viewMode === 'xml' && this.platform === 'android') {
          text = this.xmlContent;
        } else if (this.viewMode === 'plist' && this.platform === 'ios') {
          text = this.plistContent;
        } else if (this.viewMode === 'json') {
          text = this.jsonContent;
        } else {
          text = this.filteredPermissions.map(p => this.getPermissionKey(p)).join('\n');
        }

        await navigator.clipboard.writeText(text);
        this.snackbarText = 'Copied to clipboard!';
        this.snackbar = true;
      } catch (error) {
        this.snackbarText = 'Failed to copy';
        this.snackbar = true;
      }
    },

    downloadFile() {
      let content = '';
      let filename = '';
      let mimeType = '';

      if (this.viewMode === 'xml' && this.platform === 'android') {
        content = this.xmlContent;
        filename = 'AndroidManifest-permissions.xml';
        mimeType = 'application/xml';
      } else if (this.viewMode === 'plist' && this.platform === 'ios') {
        content = this.plistContent;
        filename = 'Info-permissions.plist';
        mimeType = 'application/xml';
      } else if (this.viewMode === 'json') {
        content = this.jsonContent;
        filename = `${this.platform}-permissions.json`;
        mimeType = 'application/json';
      } else {
        content = this.filteredPermissions.map(p => this.getPermissionKey(p)).join('\n');
        filename = `${this.platform}-permissions.txt`;
        mimeType = 'text/plain';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      this.snackbarText = 'File downloaded!';
      this.snackbar = true;
    }
  }
};
</script>

<style scoped>
.theme--dark {
  background-color: #121212;
  color: #ffffff;
}

.theme--light {
  background-color: #ffffff;
  color: #000000;
}

.permission-item {
  padding-top: 12px;
  padding-bottom: 12px;
  transition: background-color 0.2s;
}

.permission-item :deep(.v-list-item__content) {
  overflow: hidden;
  min-width: 0;
}

.permission-item :deep(.v-list-item-title) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.permission-item :deep(.v-list-item-subtitle) {
  overflow: hidden;
  white-space: normal;
  -webkit-line-clamp: 2;
  display: -webkit-box;
  -webkit-box-orient: vertical;
}

.permission-item :deep(.v-list-item__append) {
  flex-shrink: 0;
  margin-left: 12px;
}

.permission-item:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.theme--dark .permission-item:hover {
  background-color: rgba(255, 255, 255, 0.04);
}

.permission-code {
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  word-break: break-all;
  overflow-wrap: break-word;
  display: inline-block;
  max-width: 100%;
  line-height: 1.4;
}

.code-dark {
  background-color: rgba(255, 255, 255, 0.1);
  color: #e0e0e0;
}

.code-light {
  background-color: rgba(0, 0, 0, 0.05);
  color: #424242;
}

.code-view {
  overflow-x: auto;
}

.theme--dark .code-view {
  background-color: #1e1e1e;
}

.theme--light .code-view {
  background-color: #f5f5f5;
}

.code-view pre {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'Courier New', monospace;
}

.btn-dark {
  background-color: #424242 !important;
  color: #ffffff !important;
}

.input-dark .v-field {
  background-color: #424242 !important;
}

.input-dark .v-field__input {
  color: #ffffff !important;
}

/* Custom scrollbar */
.v-card-text::-webkit-scrollbar {
  width: 8px;
}

.v-card-text::-webkit-scrollbar-track {
  background: transparent;
}

.v-card-text::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.theme--dark .v-card-text::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
}

.v-card-text::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

.theme--dark .v-card-text::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Ensure list doesn't overflow */
:deep(.v-list) {
  overflow: hidden;
}

:deep(.v-list-item) {
  min-height: auto;
}
</style>
