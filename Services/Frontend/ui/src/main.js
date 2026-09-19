// main.js

/**
 * main.js
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Plugins
import { registerPlugins } from '@/plugins'

// Imports
import { createApp } from 'vue'
import App from './App.vue'
import router from '@/router'
import VueCodeHighlight from 'vue-code-highlight'
import 'vue-code-highlight/themes/prism-okaidia.css' // Import the theme you prefer
import '@/styles/prism-light-overrides.css'
import '@/styles/typography.css' // Global font-smoothing / crisp-text tuning
import TreeView from "vue-json-tree-view"

// Vuex store
import store from './store' // Ensure correct import path here

// Vuetify
import vuetify from '@/plugins/vuetify'

// Centralized axios setup (auth header + 401 refresh + redirect-to-login).
// MUST run before app.mount() so the very first API request after a hard
// reload (or Vite optimizeDeps reload) carries the persisted access token.
import { installHttp } from '@/utils/http'

// Create the Vue application
const app = createApp(App)

// Register other plugins
registerPlugins(app)

// Register VueCodeHighlight plugin
app.use(VueCodeHighlight)

// Register TreeView plugin
app.use(TreeView)

// Use Vuetify as a plugin
app.use(vuetify)


// Use Vuex store
app.use(store)

// Wire HTTP interceptors with router + store available so 401s can redirect
// to /login and refreshed tokens flow back into Vuex state.
installHttp({ router, store })

// Mount the application
app.mount('#app')
