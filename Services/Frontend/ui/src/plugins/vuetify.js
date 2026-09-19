// plugins/vuetify.js

import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import '@mdi/font/css/materialdesignicons.css'

// Theming
// The user's choice lives in Vuex (state.isDark, persisted to localStorage as 'isDark').
// App.vue keeps Vuetify's theme in sync with it, so every Vuetify component (cards, tables,
// dialogs, menus, inputs, button groups, ...) gets correct dark colours on its own. Before
// this, Vuetify always ran its light theme and dark mode was only the .theme--dark class,
// which left every component nobody had restyled by hand with light-theme colours.
//
// Start in the stored theme so a reload in dark mode does not flash the light theme.
function storedTheme() {
  try {
    return localStorage.getItem('isDark') === 'true' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export default createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: storedTheme(),
    themes: {
      // `light` is deliberately not customised: it stays Vuetify's default, which is what
      // the app has always rendered, so light mode is unchanged.
      dark: {
        dark: true,
        colors: {
          // Match the app's existing hand-written dark palette so restyled and
          // un-restyled components sit together: black page, #1e1e1e panels.
          background: '#000000',
          surface: '#1e1e1e',
          // Snackbars and tooltips use these. Vuetify's dark default flips them to a
          // light grey panel; keep the dark panel with light text they have always had
          // (11 snackbars set no colour of their own, and several have white Close buttons).
          'surface-variant': '#424242',
          'on-surface-variant': '#EEEEEE',
        },
      },
    },
  },
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: {
      mdi,
    },
  },
})
