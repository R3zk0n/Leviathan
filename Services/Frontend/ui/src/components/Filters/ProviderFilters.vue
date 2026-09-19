<template>
  <v-container class="pa-0">
    <v-expansion-panels :class="isDark ? 'theme--dark' : 'theme--light'">
      <v-expansion-panel
        v-for="(provider, index) in providers"
        :key="providerKey(provider)"
        :value="index"
      >
        <v-expansion-panel-title>
          <v-icon color="primary" class="mr-2">mdi-database</v-icon>
          Provider {{ index + 1 }}: {{ provider.name }}
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-card flat :class="isDark ? 'theme--dark' : 'theme--light'">
            <v-card-text>
              <!-- Display each section if it has content -->
              <template v-for="(section, sectionKey) in sections" :key="sectionKey">
                <div v-if="provider[sectionKey]" class="mb-3">
                  <v-row no-gutters align="center" class="mb-1">
                    <v-col cols="auto">
                      <v-icon :icon="section.icon" color="primary" size="small" class="mr-2"></v-icon>
                    </v-col>
                    <v-col>
                      <span class="text-subtitle-2 font-weight-bold">{{ section.title }}</span>
                    </v-col>
                  </v-row>
                  <v-chip
                    class="ma-1"
                    size="small"
                    color="primary"
                    :variant="isDark ? 'flat' : 'outlined'"
                  >
                    {{ provider[sectionKey] }}
                  </v-chip>
                </div>
              </template>

              <!-- Display meta data if available -->
              <template v-if="hasMetadataContent(provider.metaData)">
                <v-divider class="my-3"></v-divider>
                <v-row no-gutters align="center" class="mb-1">
                  <v-col cols="auto">
                    <v-icon color="primary" size="small" class="mr-2">mdi-xml</v-icon>
                  </v-col>
                  <v-col>
                    <span class="text-subtitle-2 font-weight-bold">Meta Data</span>
                  </v-col>
                </v-row>
                <v-expansion-panels>
                  <v-expansion-panel
                    v-for="(meta, metaName) in provider.metaData"
                    :key="metaName"
                  >
                    <template v-if="meta && meta.content">
                      <v-expansion-panel-title>
                        {{ metaName }}
                      </v-expansion-panel-title>
                      <v-expansion-panel-text>
                        <strong>XML Resource Tag:</strong> {{ meta.resource }}<br>
                        <strong>Content:</strong>
                        <pre class="xml-content">{{ meta.content }}</pre>
                      </v-expansion-panel-text>
                    </template>
                  </v-expansion-panel>
                </v-expansion-panels>
              </template>
            </v-card-text>
          </v-card>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </v-container>
</template>

<script>
import { computed } from 'vue';
import { useStore } from 'vuex';

export default {
  name: 'ProvidersFilter',
  props: {
    providers: {
      type: Array,
      required: true
    }
  },
  setup() {
    const store = useStore();
    const isDark = computed(() => store.state.isDark);

    return {
      isDark,
      sections: {
        authorities: { title: 'Authorities', icon: 'mdi-account-key' },
        exported: { title: 'Exported', icon: 'mdi-checkbox-marked' },
        readPermission: { title: 'Read Permission', icon: 'mdi-lock-open' },
        writePermission: { title: 'Write Permission', icon: 'mdi-lock' },
        grantUriPermissions: { title: 'Grant URI Permissions', icon: 'mdi-link' },
      }
    };
  },
  methods: {
    providerKey(provider) {
      const authorities = Array.isArray(provider.authorities) ? provider.authorities.join(',') : provider.authorities || '';
      const exported = provider.exported ? provider.exported.toString() : '';
      const readPermission = provider.readPermission || '';
      const writePermission = provider.writePermission || '';
      const grantUriPermissions = provider.grantUriPermissions ? provider.grantUriPermissions.toString() : '';
      const metaData = provider.metaData ? Object.keys(provider.metaData).join(',') : '';
      return `${authorities}${exported}${readPermission}${writePermission}${grantUriPermissions}${metaData}`;
    },
    hasMetadataContent(metaData) {
      return metaData && Object.values(metaData).some(meta => meta && meta.content);
    }
  }
};
</script>

<style scoped>
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

.xml-content {
  white-space: pre-wrap;
  word-wrap: break-word;
  background-color: rgba(0, 0, 0, 0.05);
  padding: 8px;
  border-radius: 4px;
}

.theme--dark .xml-content {
  background-color: rgba(255, 255, 255, 0.05);
}
</style>
