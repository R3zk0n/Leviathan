// Plugins
import Components from 'unplugin-vue-components/vite'
import Vue from '@vitejs/plugin-vue'
import Vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'
import ViteFonts from 'unplugin-fonts/vite'
// unplugin-vue-router removed: conflicts with manual router in src/router/index.js
// import VueRouter from 'unplugin-vue-router/vite'

// Utilities
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    Vue({
      template: { transformAssetUrls }
    }),
    // https://github.com/vuetifyjs/vuetify-loader/tree/master/packages/vite-plugin#readme
    Vuetify({
      autoImport: true,
      styles: {
        configFile: 'src/styles/settings.scss',
      },
    }),
    Components(),
    ViteFonts({
      google: {
        families: [{
          name: 'Roboto',
          styles: 'wght@100;300;400;500;700;900',
        }],
      },
    }),
  ],
  define: {
    'process.env': {},
    'import.meta.env.VITE_BACKEND_SERVICE_URL': JSON.stringify(
      process.env.BACKEND_SERVICE_URL || 'http://backend:5001'
    ),
    // NOTE: do NOT fall back to a literal '${import.meta.env.VITE_APP_API_URL}' string —
    // that ends up shipped verbatim in production builds. Fall back to '' so callers can
    // detect "unset" and use a relative path (proxied via nginx) instead.
    'import.meta.env.VITE_APP_API_URL': JSON.stringify(
      process.env.VUE_APP_API_URL || process.env.VITE_APP_API_URL || ''
    ),
    // Base URL for the amd64 ios-analysis twin (/ios, /disas). Empty '' means
    // "same origin as VITE_APP_API_URL" — correct for single-image x86_64 hosts
    // and for nginx-proxied prod, where http.js leaves those paths on the default
    // backend and nginx location blocks route them.
    'import.meta.env.VITE_IOS_API_URL': JSON.stringify(
      process.env.VITE_IOS_API_URL || ''
    ),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
    dedupe: [
      '@codemirror/state',
      '@codemirror/view',
      '@codemirror/language',
      '@codemirror/search',
      '@codemirror/commands',
      '@codemirror/autocomplete',
      'codemirror',
    ],
    extensions: [
      '.js',
      '.json',
      '.jsx',
      '.mjs',
      '.ts',
      '.tsx',
      '.vue',
    ],
  },
  optimizeDeps: {
    // Pre-bundle these so the dev server doesn't discover them mid-session and
    // force a full-page reload the first time a user navigates to a lazy-loaded
    // route (results.vue, Engine/Settings.vue, etc.).
    include: [
      'axios',
      'vuex',
      'vue-router',
      'lodash/debounce',
      'jwt-decode',
      // Frida UI dependencies (avoid first-load dep-optimizer reload)
      'xterm',
      'xterm-addon-fit',
      // Frida Scripting.vue editor formatter
      'prettier/standalone',
      'prettier/parser-babel',
    ],
    exclude: [
      'vue-codemirror',
      'vue-codemirror6',
      'codemirror',
      '@codemirror/state',
      '@codemirror/view',
      '@codemirror/language',
      '@codemirror/search',
      '@codemirror/commands',
      '@codemirror/autocomplete',
      '@codemirror/lang-java',
      '@codemirror/theme-one-dark',
      '@replit/codemirror-minimap',
    ],
  },
  server: {
    port: 3000,
    // Proactively transform the heavy lazy-loaded routes on dev-server start
    // so the very first navigation to them is fast and never triggers a
    // "new dependencies optimized → reload" cycle.
    warmup: {
      clientFiles: [
        './src/pages/results.vue',
        './src/pages/engine.vue',
        './src/pages/editor.vue',
        './src/pages/scan-logs.vue',
        './src/components/Engine/Settings.vue',
        './src/components/Android/Vulnerabilities/SecurityIssuePanel.vue',
        './src/components/Android/Vulnerabilities/VulnerabilityDetails.vue',
        './src/components/Android/Vulnerabilities/SplitView.vue',
        './src/components/Viewers/Generate.vue',
        // Frida routes/components
        './src/components/Frida/Devices.vue',
        './src/components/Frida/Scripting.vue',
        './src/components/Frida/Dialogs/FridaREPLDialog.vue',
        './src/components/Frida/Dialogs/MonacoEditor.vue',
        './src/components/Frida/Dialogs/FridaClicks/FridaClicks.vue',
      ],
    },
  },
})
