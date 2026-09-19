<template>
  <v-dialog :model-value="dialog" @update:model-value="updateDialog" max-width="600px">
    <v-card :class="isDark ? 'theme--dark' : 'theme--light'">
      <v-card-title class="headline">Symbols</v-card-title>
      <v-card-subtitle>
        <v-text-field v-model="search" label="Search" class="mx-4"></v-text-field>
      </v-card-subtitle>
      <v-card-text>
        <v-progress-circular v-if="loading" indeterminate color="primary" class="mx-auto"></v-progress-circular>
        <v-data-table
          v-else
          :items="symbols"
          :headers="headers"
          :search="search"
          :class="isDark ? 'theme--dark' : 'theme--light'"
        >
          <template v-slot:item.address="{ item }">
            <code>{{ item.address }}</code>
          </template>
          <template v-slot:item.fullname="{ item }">
            <code>{{ item.fullname }}</code>
          </template>
        </v-data-table>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="primary" @click="closeDialog">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import axios from 'axios';
import { mapState } from 'vuex';

export default {
  name: 'SymbolsDialog',
  props: {
    dialog: {
      type: Boolean,
      required: true
    },
    symbols: {
      type: Array,
      required: true
    },
    filename: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      loading: true,
      search: '',
      headers: [
        { text: 'Address', value: 'address' },
        { text: 'Full Name', value: 'fullname' }
      ]
    };
  },
  computed: {
    ...mapState(['isDark'])
  },
  watch: {
    dialog(val) {
      if (val) {
        this.fetchSymbols();
      }
    }
  },
  methods: {
    closeDialog() {
      this.$emit('update:dialog', false);
    },
    updateDialog(value) {
      this.$emit('update:dialog', value);
    },
    async fetchSymbols() {
      this.loading = true;
      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/ios/symbols/${this.filename}`);
        this.$emit('update:symbols', response.data);
      } catch (err) {
        console.error('Error fetching symbols:', err);
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>

<style scoped>
.v-card-text {
  max-height: 400px;
  overflow-y: auto;
}
</style>
