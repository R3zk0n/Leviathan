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
import { useTheme } from 'vuetify';

import NavBar from "@/components/NavBar.vue";

export default {
  name: "App",
  components: {
    NavBar
  },
  setup() {
    return { vuetifyTheme: useTheme() };
  },
  computed: {
    ...mapGetters(['isDark']), // Map isDark getter from Vuex store
  },
  watch: {
    // state.isDark is the single source of truth for dark mode. Two things follow it:
    //  1. Vuetify's own theme, so every Vuetify component is themed without per-page CSS.
    //  2. The legacy .theme--dark / .theme--light classes that the hand-written styles use.
    //     They also go on <html>, because dialogs and menus are teleported to <body>,
    //     outside <v-app>. immediate: a page loaded in dark mode is themed from the start.
    isDark: {
      immediate: true,
      handler(newValue) {
        this.vuetifyTheme.global.name.value = newValue ? 'dark' : 'light';
        document.documentElement.classList.toggle('theme--dark', newValue);
        document.documentElement.classList.toggle('theme--light', !newValue);
      },
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
