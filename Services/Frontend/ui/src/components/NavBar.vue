<template>
  <nav>
    <v-app-bar app :color="isDark ? 'black' : 'white'">
      <v-toolbar-title class="text-uppercase">
        <span class="font-weight-light d-flex align-items-center">
          <router-link to="/" class="no-button-style">
            <v-icon class="mr-2">mdi-security</v-icon>
          </router-link>
          Leviathan - Vuetify Version: <span>{{ version() }}</span>
        </span>
      </v-toolbar-title>
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
  </nav>
</template>

<script>
import { mapState, mapActions } from 'vuex';
import { version } from 'vuetify';

export default {
  name: "Navbar",
  data() {
    return {
      drawer: false,
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
        { icon: 'mdi-cog', text: 'Settings', route: '/settings' },
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
    version() {
      return version;
    },
    logout() {
      this.$store.commit('clearAuthData');
      this.$router.push("/login");
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

.no-button-style {
  color: inherit;
  text-decoration: none;
}
</style>
