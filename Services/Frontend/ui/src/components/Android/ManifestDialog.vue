<template>
  <v-dialog :model-value="dialog" @update:model-value="closeDialog" :width="dialogWidth" :fullscreen="isSmallScreen">
    <v-card :class="isDark ? 'theme--dark' : 'theme--light'" :height="cardHeight">
      <v-card-title class="headline d-flex align-center">
        <v-icon class="mr-2">mdi-xml</v-icon>
        Manifest
        <v-spacer></v-spacer>
        <v-btn icon variant="text" @click="closeDialog">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text v-if="loading" class="text-center py-8">
        <v-progress-circular indeterminate color="primary" size="48"></v-progress-circular>
        <p class="mt-4">Loading manifest...</p>
      </v-card-text>

      <v-card-text v-else :style="cardTextStyle">
        <div v-if="manifestContent">
          <div v-highlight>
            <pre class="language-xml"><code>{{ manifestContent }}</code></pre>
          </div>
        </div>
        <div v-else class="text-center py-8">
          <v-icon size="64" color="grey">mdi-file-question</v-icon>
          <p class="mt-4">No manifest data available</p>
        </div>
      </v-card-text>

      <v-card-actions>
        <v-btn
          color="secondary"
          variant="tonal"
          prepend-icon="mdi-download"
          @click="downloadManifest"
          :disabled="!manifestContent"
        >
          Download
        </v-btn>
        <v-spacer></v-spacer>
        <v-btn color="primary" variant="elevated" @click="closeDialog">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-snackbar v-model="snackbar" :timeout="3000" :color="snackbarColor">
    {{ snackbarText }}
  </v-snackbar>
</template>

<script>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useStore } from 'vuex';
import axios from 'axios';

export default {
  name: 'ManifestDialog',
  props: {
    dialog: Boolean,
    filename: String,
  },
  setup(props, { emit }) {
    const store = useStore();
    const manifestContent = ref('');
    const loading = ref(false);
    const snackbar = ref(false);
    const snackbarText = ref('');
    const snackbarColor = ref('error');
    const windowWidth = ref(window.innerWidth);
    const windowHeight = ref(window.innerHeight);

    const closeDialog = () => {
      emit('update:dialog', false);
    };

    const showSnackbar = (message, color = 'error') => {
      snackbarText.value = message;
      snackbarColor.value = color;
      snackbar.value = true;
    };

    const fetchManifest = async () => {
      if (!props.filename) {
        loading.value = false;
        return;
      }

      loading.value = true;
      manifestContent.value = '';

      try {
        const response = await axios.get(
          `${import.meta.env.VITE_APP_API_URL}/audit/manifest/${props.filename}`
        );
        manifestContent.value = response.data.manifest;
      } catch (error) {
        console.error('Error fetching manifest:', error);
        showSnackbar('Error fetching manifest', 'error');
      } finally {
        loading.value = false;
      }
    };

    const downloadManifest = () => {
      if (!manifestContent.value) return;

      const blob = new Blob([manifestContent.value], { type: 'text/xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${props.filename.replace('.apk', '')}_AndroidManifest.xml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showSnackbar('Manifest downloaded successfully', 'success');
    };

    const onResize = () => {
      windowWidth.value = window.innerWidth;
      windowHeight.value = window.innerHeight;
    };

    // Fetch manifest when dialog opens
    watch(() => props.dialog, (newValue) => {
      if (newValue) {
        fetchManifest();
      }
    });

    // Fetch manifest when filename changes
    watch(() => props.filename, () => {
      if (props.dialog) {
        fetchManifest();
      }
    });

    onMounted(() => {
      window.addEventListener('resize', onResize);
    });

    onUnmounted(() => {
      window.removeEventListener('resize', onResize);
    });

    const isSmallScreen = computed(() => windowWidth.value < 600);
    const dialogWidth = computed(() => isSmallScreen.value ? '100%' : '90%');
    const cardHeight = computed(() => isSmallScreen.value ? '100%' : '90vh');
    const cardTextStyle = computed(() => {
      const height = isSmallScreen.value ? 'calc(100% - 132px)' : 'calc(90vh - 132px)';
      return `height: ${height}; overflow-y: auto;`;
    });

    return {
      manifestContent,
      loading,
      closeDialog,
      isDark: computed(() => store.state.isDark),
      snackbar,
      snackbarText,
      snackbarColor,
      downloadManifest,
      isSmallScreen,
      dialogWidth,
      cardHeight,
      cardTextStyle,
    };
  },
};
</script>

<style scoped>
.theme--dark .v-card,
.theme--dark .v-card-title,
.theme--dark .v-card-text {
  background-color: #1e1e1e;
  color: #ffffff;
}

.theme--light .v-card,
.theme--light .v-card-title,
.theme--light .v-card-text {
  background-color: #ffffff;
  color: #000000;
}

.theme--dark pre {
  background-color: #272822 !important;
}

.theme--light pre {
  background-color: #f8f9fa !important;
}
</style>
