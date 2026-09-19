<!-- src/components/LoadingSpinner.vue -->
<template>
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
              <div>{{ message }}</div>
            </v-col>
          </v-row>
        </v-container>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script>
import { defineComponent } from 'vue';
import { mapState } from 'vuex';

export default defineComponent({
  name: 'LoadingSpinner',
  props: {
    loading: {
      type: Boolean,
      required: true,
    },
    message: {
      type: String,
      default: 'Loading...',
    },
  },
  computed: {
    ...mapState(['isDark']),
  },
});
</script>
