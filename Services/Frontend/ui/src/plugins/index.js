/**
 * plugins/index.js
 *
 * Automatically included in `./src/main.js`
 */
// Plugins
import vuetify from './vuetify'
import router from '@/router'
import store from '@/store'
import { basicSetup } from 'codemirror'
import VueCodemirror from 'vue-codemirror'
import cytoscape from 'cytoscape'

export function registerPlugins (app) {
  app
    .use(vuetify)
    .use(router)
    .use(store)
    .use(cytoscape)
    .use(VueCodemirror, {
      autofocus: true,
      lineNumbers: true,
      disabled: false,
      extensions: [basicSetup]
  });
}
