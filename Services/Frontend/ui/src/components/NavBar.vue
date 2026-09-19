<template>
  <nav>
    <v-app-bar app :color="isDark ? 'black' : 'white'" height="64">
      <router-link
        to="/"
        class="brand-link"
        :class="{ 'brand-dark': isDark }"
        aria-label="Leviathan home"
      >
        <LeviathanIcon class="brand-icon" />
        <span class="brand-wordmark">Leviathan</span>
      </router-link>
      <v-spacer></v-spacer>
      <v-app-bar-nav-icon @click.stop="drawer = !drawer" v-if="isAuthenticated"></v-app-bar-nav-icon>
      <template v-else>
        <v-btn @click="login" color="primary">Login</v-btn>
        <v-btn @click="register" variant="text" class="ml-2">Register</v-btn>
      </template>
    </v-app-bar>
    <v-navigation-drawer
      :class="isDark ? 'black' : 'white'"
      v-model="drawer"
      location="left"
      v-if="isAuthenticated"
    >
      <v-list flat>
        <v-list-item>
          <v-switch
            :label="`Dark Theme`"
            v-model="isDarkLocal"
            @change="switchColor"
          ></v-switch>
        </v-list-item>
        <v-list-item
          v-for="link in links"
          :key="link.text"
          :value="link.route"
          :to="link.route"
          color="primary"
        >
          <template v-slot:prepend>
            <v-icon>{{ link.icon }}</v-icon>
          </template>
          <v-list-item-title>{{ link.text }}</v-list-item-title>
        </v-list-item>

        <!-- Dropdown for Engine in the Navigation Drawer -->
        <v-list-group value="Engine">
          <template v-slot:activator="{ props }">
            <v-list-item v-bind="props" prepend-icon="mdi-cog" title="Engine"></v-list-item>
          </template>

          <v-list-item
            v-for="item in engineItems"
            :key="item.route"
            :to="item.route"
          >
            <template v-slot:prepend>
              <v-icon :icon="item.icon" size="small" class="mr-2"></v-icon>
            </template>
            <v-list-item-title>{{ item.text }}</v-list-item-title>
          </v-list-item>
        </v-list-group>

        <!-- Dropdown for Frida in the Navigation Drawer -->
        <v-list-group value="Frida">
          <template v-slot:activator="{ props }">
            <v-list-item v-bind="props" prepend-icon="mdi-cellphone" title="Frida"></v-list-item>
          </template>

          <v-list-item
            v-for="item in fridaItems"
            :key="item.route"
            :to="item.route"
          >
            <template v-slot:prepend>
              <v-icon :icon="item.icon" size="small" class="mr-2"></v-icon>
            </template>
            <v-list-item-title>{{ item.text }}</v-list-item-title>
          </v-list-item>
        </v-list-group>

        <!-- Dropdown for AI in the Navigation Drawer -->
        <v-list-group value="AI">
          <template v-slot:activator="{ props }">
            <v-list-item v-bind="props" prepend-icon="mdi-brain" title="AI"></v-list-item>
          </template>

          <v-list-item
            v-for="item in aiItems"
            :key="item.route"
            :to="item.route"
          >
            <template v-slot:prepend>
              <v-icon :icon="item.icon" size="small" class="mr-2"></v-icon>
            </template>
            <v-list-item-title>{{ item.text }}</v-list-item-title>
          </v-list-item>
        </v-list-group>

        <!-- User Management Dropdown in the Navigation Drawer -->
        <v-list-group value="User">
          <template v-slot:activator="{ props }">
            <v-list-item v-bind="props" prepend-icon="mdi-account" title="User"></v-list-item>
          </template>

          <v-list-item
            v-for="item in userItems"
            :key="item.route || item.action"
            :to="item.route"
            @click="item.action ? handleAction(item.action) : null"
          >
            <template v-slot:prepend>
              <v-icon :icon="item.icon" size="small" class="mr-2"></v-icon>
            </template>
            <v-list-item-title>{{ item.text }}</v-list-item-title>
          </v-list-item>
        </v-list-group>
      </v-list>
    </v-navigation-drawer>
    <v-snackbar v-model="logoutFailed" color="error" :timeout="-1">
      Signed out on this device. Server logout failed; other sessions may still be active.
      <template v-slot:actions>
        <v-btn variant="text" @click="logoutFailed = false">Dismiss</v-btn>
      </template>
    </v-snackbar>
  </nav>
</template>

<script>
import { mapState, mapActions } from 'vuex';
import LeviathanIcon from '@/components/LeviathanIcon.vue';

export default {
  name: "Navbar",
  components: { LeviathanIcon },
  data() {
    return {
      drawer: false,
      logoutFailed: false,
      links: [
        { icon: "mdi-view-dashboard", text: "Dashboard", route: "/" },
        { icon: "mdi-pen", text: "Editor", route: "/editor" },
      ],
      engineItems: [
        { icon: 'mdi-upload-multiple', text: 'Bulk Upload', route: '/upload/bulk' },
        { icon: 'mdi-cog', text: 'Status', route: '/engine' },
        { icon: 'mdi-tune', text: 'Settings', route: '/engine/settings' },
        { icon: 'mdi-text-box-search-outline', text: 'Scan Logs', route: '/engine/logs' },
      ],
      fridaItems: [
        { icon: 'mdi-code-tags', text: 'Devices', route: '/frida/devices' }
      ],
      aiItems: [
        { icon: 'mdi-server-network', text: 'MCP', route: '/ai/mcp' },
        { icon: 'mdi-robot', text: 'Agents', route: '/ai/agents' },
      ],
      userItems: [
        { icon: 'mdi-account-circle', text: 'Profile', route: '/profile' },
        { icon: 'mdi-logout', text: 'Logout', action: 'logout' }
      ],
      isDarkLocal: false,
    };
  },
  computed: {
    ...mapState(['isDark', 'accessToken']),
    isAuthenticated() {
      return !!this.accessToken;
    },
  },
  watch: {
    isDark(newVal) {
      this.isDarkLocal = newVal;
    }
  },
  methods: {
    ...mapActions(['setTheme']),
    async logout() {
      try {
        await this.$store.dispatch('logout');
      } catch {
        this.logoutFailed = true;
      } finally {
        this.$router.push("/login");
      }
    },
    login() {
      this.$router.push("/login");
    },
    register() {
      this.$router.push("/register");
    },
    switchColor() {
      this.setTheme(this.isDarkLocal);
    },
    handleAction(action) {
      if (action === 'logout') {
        this.logout();
      }
      // Add other actions as needed
    },
  },
  created() {
    this.isDarkLocal = this.isDark;
  },
};
</script>

<style scoped>
.border {
  border-left: 4px solid cyan;
}
.v-navigation-drawer--right {
  right: 0 !important;
  left: auto !important;
}
.black {
  background-color: black;
  color: white;
}
.white {
  background-color: white;
  color: black;
}
.v-list-item-content {
  display: flex;
  align-items: center;
}
.d-flex {
  display: flex;
}
.align-items-center {
  align-items: center;
}
.mr-1 {
  margin-right: 4px;
}
.mr-2 {
  margin-right: 8px;
}
.mr-3 {
  margin-right: 12px;
}
.mr-4 {
  margin-right: 16px;
}

/* One knob: --brand-size is the icon height. Gap and wordmark follow the
   proportions of logo.svg (icon 100 : gap 20 : wordmark cap height ~30).
   Keep it a multiple of 20px: the icon is drawn on a 20-row grid, so at 40px every
   stroke and pixel is exactly 2px and stays sharp at 100%, 150% and 200% scaling.
   In between (e.g. 32px) the edges fall between pixels and the icon turns grey and soft. */
.brand-link {
  --brand-size: 40px;
  display: flex;
  align-items: center;
  gap: calc(var(--brand-size) * 0.2);
  margin-left: 12px;
  color: #111;
  text-decoration: none;
}

.brand-link.brand-dark {
  color: #fff;
}

.brand-icon {
  height: var(--brand-size);
  width: auto;
  display: block;
  flex: none;
}

/* Live text in the app's own UI font (semibold), so the wordmark is rendered by the
   same text engine as every other label. logo.svg at the repo root uses Roboto Medium
   outlines, the closest openly licensed match, because GitHub cannot use system fonts. */
.brand-wordmark {
  flex: none;
  font-family: var(--ui-font);
  font-size: calc(var(--brand-size) * 0.425); /* 17px: a ~12px cap height, 30% of the icon */
  font-weight: 600;
  letter-spacing: 0.16em;
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;
  /* Centre on the capitals rather than the line box (which sits ~1px low in Segoe UI).
     Ignored where unsupported; the fallback is that 1px. */
  text-box: trim-both cap alphabetic;
}

/* Narrow screens: the icon alone, so the Login / Register buttons still fit. */
@media (max-width: 480px) {
  .brand-wordmark {
    display: none;
  }
}
</style>
