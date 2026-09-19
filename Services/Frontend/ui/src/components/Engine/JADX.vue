<script setup>
import { ref, watch } from 'vue';
import { useStore } from 'vuex';
import { engineApi } from '@/services';

const store = useStore(); // Initialize the store
const jadxStatus = ref('');
const errorMessage = ref('');
const snackbar = ref(false);
const snackbarMessage = ref('');
const isDark = ref(store.state.isDark); // Use Vuex state for dark mode

const checkJadxStatus = async () => {
  try {
    const response = await engineApi.version();
    jadxStatus.value = response.output;
    snackbarMessage.value = `JADX Version: ${response.output}`;
    errorMessage.value = '';
    snackbar.value = true;
  } catch (error) {
    console.error('Error fetching JADX Version:', error);
    errorMessage.value = 'Error fetching JADX status. Please check the console for more details.';
    jadxStatus.value = '';
    snackbarMessage.value = errorMessage.value;
    snackbar.value = true;
  }
};

// Watch for changes in Vuex store state for dark mode
watch(() => store.state.isDark, (newVal) => {
  isDark.value = newVal;
});

watch(jadxStatus, () => {
  if (jadxStatus.value || errorMessage.value) {
    setTimeout(() => {
      snackbar.value = false;
    }, 1200); // Adjust the timeout as needed
  }
});
</script>

<template>
  <v-container :class="isDark ? 'theme--dark' : 'theme--light'">
    <v-row justify="center">
      <v-col cols="auto">
        <v-btn
          @click="checkJadxStatus"
          :class="isDark ? 'btn-dark' : 'btn-light'"
          height="72"
          min-width="164"
        >
          Check JADX Status
        </v-btn>
      </v-col>
    </v-row>
    <v-snackbar v-model="snackbar" :timeout="3000">
      {{ snackbarMessage }}
    </v-snackbar>
  </v-container>
</template>

<style scoped>
.error {
  color: red;
}
.theme--dark {
  background-color: #121212;
  color: #ffffff;
}
.theme--light {
  background-color: #ffffff;
  color: #000000;
}
.btn-dark {
  background-color: #000000;
  color: #ffffff;
}
.btn-light {
  background-color: #ffffff;
  color: #000000;
}
</style>
