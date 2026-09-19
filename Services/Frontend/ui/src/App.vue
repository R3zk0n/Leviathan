<template>
  <v-app :class="{ 'theme--dark': isDark, 'theme--light': !isDark }"> <!-- Add class conditionally based on isDark -->
    <NavBar />
    <v-main class="ma-4">
      <router-view></router-view>
    </v-main>
  </v-app>
</template>

<script>
import { mapGetters } from 'vuex'; // Import mapGetters

import NavBar from "@/components/NavBar.vue";

export default {
  name: "App",
  components: {
    NavBar
  },
  computed: {
    ...mapGetters(['isDark']), // Map isDark getter from Vuex store
  },
  watch: {
    isDark(newValue) { // Watch for changes in isDark value
      document.documentElement.classList.toggle('theme--dark', newValue);
      document.documentElement.classList.toggle('theme--light', !newValue);
    },
  },
};
</script>

<style>
/* Ensure there are no global styles affecting the navigation drawer */
.theme--dark {
  background-color: black;
  color: white;
}

.theme--light {
  background-color: white;
  color: black;
}
</style>
