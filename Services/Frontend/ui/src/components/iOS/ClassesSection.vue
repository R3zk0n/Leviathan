<template>
  <div>
    <v-dialog
      :model-value="dialog"
      max-width="1280"
      aria-labelledby="class-browser-title"
      @update:model-value="updateDialog"
    >
      <v-card class="class-browser" :theme="isDark ? 'dark' : 'light'">
        <header class="browser-header">
          <div>
            <h2 id="class-browser-title">Classes</h2>
            <p>Browse class declarations, methods, and properties.</p>
          </div>
          <v-btn icon="mdi-close" variant="text" aria-label="Close classes" @click="closeDialog" />
        </header>

        <v-tabs v-model="tab" class="language-tabs" color="primary" show-arrows>
          <v-tab value="objc">
            Objective-C <span class="tab-count">{{ objectiveCClasses.length }}</span>
          </v-tab>
          <v-tab value="swift">
            Swift <span class="tab-count">{{ swiftClasses.length }}</span>
          </v-tab>
        </v-tabs>

        <div class="browser-body">
          <aside class="class-sidebar" aria-label="Class navigation">
            <div class="class-search">
              <v-text-field
                v-model="searchQuery"
                label="Search class names"
                prepend-inner-icon="mdi-magnify"
                variant="outlined"
                density="compact"
                hide-details
                clearable
              />
              <p class="result-count" role="status">{{ resultSummary }}</p>
            </div>

            <nav
              v-if="paginatedClasses.length"
              :key="tab + ':' + currentPage + ':' + searchQuery"
              class="class-list"
              aria-label="Classes"
            >
              <button
                v-for="classSection in paginatedClasses"
                :key="classSection.id"
                type="button"
                class="class-list-item"
                :class="{ 'is-selected': selectedClass.id === classSection.id }"
                :aria-current="selectedClass.id === classSection.id ? 'true' : undefined"
                @click="selectClass(classSection.id)"
              >
                <span class="class-name">{{ classSection.className }}</span>
                <span v-if="tab === 'objc'" class="class-caption">
                  {{ classSection.methods.length }} methods · {{ classSection.properties.length }} properties
                </span>
              </button>
            </nav>
            <div v-else class="empty-state sidebar-empty">
              <v-icon size="28">mdi-magnify</v-icon>
              <p>{{ searchQuery ? 'No matching classes.' : 'No classes available.' }}</p>
              <v-btn v-if="searchQuery" variant="text" size="small" @click="searchQuery = ''">
                Clear search
              </v-btn>
            </div>

            <v-pagination
              v-if="totalPages > 1"
              v-model="currentPage"
              class="class-pagination"
              :length="totalPages"
              :total-visible="3"
              density="compact"
              size="small"
              aria-label="Class pages"
            />
          </aside>

          <section v-if="selectedClass" class="class-detail" aria-labelledby="selected-class-name">
            <div class="detail-header">
              <p class="detail-eyebrow">{{ tab === 'objc' ? 'Objective-C class' : 'Swift declaration' }}</p>
              <h3 id="selected-class-name">{{ selectedClass.className }}</h3>
              <p v-if="tab === 'objc'" class="class-superclass">
                Inherits from <code>{{ selectedClass.superclass }}</code>
                <span class="ivar-count">{{ selectedClass.ivars.length }} ivars</span>
              </p>
              <div class="detail-actions">
                <v-btn
                  prepend-icon="mdi-content-copy"
                  variant="tonal"
                  size="small"
                  @click="generateFridaScript(selectedClass.className)"
                >
                  Copy Frida script
                </v-btn>
                <v-switch
                  v-model="wrapLines"
                  class="wrap-toggle"
                  label="Wrap lines"
                  color="primary"
                  density="compact"
                  hide-details
                  inset
                />
              </div>
            </div>

            <v-tabs
              v-if="tab === 'objc'"
              v-model="activeTab"
              class="member-tabs"
              color="primary"
              show-arrows
            >
              <v-tab value="overview">Overview</v-tab>
              <v-tab value="methods">
                Methods <span class="tab-count">{{ selectedClass.methods.length }}</span>
              </v-tab>
              <v-tab value="properties">
                Properties <span class="tab-count">{{ selectedClass.properties.length }}</span>
              </v-tab>
            </v-tabs>

            <div
              v-if="showMembers && !highlightedMembers.length"
              class="empty-state detail-empty"
              role="status"
            >
              <v-icon size="32">mdi-code-braces</v-icon>
              <p>No {{ activeTab }} in this class dump.</p>
            </div>
            <div
              v-else
              :key="tab + ':' + selectedClass.id + ':' + activeTab"
              class="source-scroll"
              :class="{ 'wrap-lines': wrapLines }"
              role="region"
              tabindex="0"
              :aria-label="tab === 'objc' ? 'Class ' + activeTab : 'Swift source'"
            >
              <ol v-if="showMembers" class="member-list">
                <li v-for="(member, index) in highlightedMembers" :key="index">
                  <span class="member-number" aria-hidden="true">{{ index + 1 }}</span>
                  <pre><code class="hljs" v-html="member"></code></pre>
                </li>
              </ol>
              <pre v-else class="source-block"><code class="hljs" v-html="highlightedSource"></code></pre>
            </div>
          </section>

          <section v-else class="empty-state detail-empty">
            <v-icon size="40">mdi-file-code-outline</v-icon>
            <h3>{{ searchQuery ? 'No matching classes' : 'No class declarations' }}</h3>
            <p>
              {{ searchQuery
                ? 'Try a different class name or clear your search.'
                : 'This dump contains no ' + (tab === 'objc' ? 'Objective-C' : 'Swift') + ' declarations.' }}
            </p>
          </section>
        </div>

        <v-card-actions class="browser-footer">
          <v-spacer />
          <v-btn color="primary" @click="closeDialog">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :timeout="timeout">
      {{ snackbarText }}
      <template v-slot:actions>
        <v-btn color="blue" variant="text" @click="snackbar = false">Close</v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script>
import hljs from 'highlight.js/lib/core';
import objectivec from 'highlight.js/lib/languages/objectivec';
import swift from 'highlight.js/lib/languages/swift';
import 'highlight.js/styles/androidstudio.css';
import { mapState } from 'vuex';

hljs.registerLanguage('objectivec', objectivec);
hljs.registerLanguage('swift', swift);

export default {
  name: 'ClassesSection',
  emits: ['update:dialog'],
  props: {
    dialog: {
      type: Boolean,
      required: true,
    },
    objcContent: {
      type: Array,
      required: true,
    },
    swiftContent: {
      type: Array,
      required: true,
    },
  },
  data() {
    return {
      searches: { objc: '', swift: '' },
      pages: { objc: 1, swift: 1 },
      selections: { objc: null, swift: null },
      tab: 'objc',
      activeTab: 'overview',
      wrapLines: false,
      itemsPerPage: 10,
      snackbar: false,
      snackbarText: '',
      timeout: 2000,
    };
  },
  computed: {
    ...mapState(['isDark']),
    objectiveCClasses() {
      return this.objcContent.filter(Boolean).map((classData, index) => ({
        id: index,
        className: classData.name,
        superclass: classData.superclass,
        ivars: classData.ivars,
        methods: classData.methods,
        properties: classData.properties,
      }));
    },
    swiftClasses() {
      return this.swiftContent.filter(content => content.trim()).map((content, index) => ({
        id: index,
        className: content.split('\n')[0].replace(/\s*\{/, '').trim(),
        content,
      }));
    },
    classes() {
      return this.tab === 'objc' ? this.objectiveCClasses : this.swiftClasses;
    },
    searchQuery: {
      get() {
        return this.searches[this.tab];
      },
      set(value) {
        this.searches[this.tab] = value || '';
        this.pages[this.tab] = 1;
        this.selections[this.tab] = null;
      },
    },
    filteredClasses() {
      const query = this.searchQuery.trim().toLowerCase();
      return query
        ? this.classes.filter(classSection => classSection.className.toLowerCase().includes(query))
        : this.classes;
    },
    totalPages() {
      return Math.max(1, Math.ceil(this.filteredClasses.length / this.itemsPerPage));
    },
    currentPage: {
      get() {
        return Math.min(this.pages[this.tab], this.totalPages);
      },
      set(value) {
        this.pages[this.tab] = value;
        this.selections[this.tab] = null;
      },
    },
    paginatedClasses() {
      const start = (this.currentPage - 1) * this.itemsPerPage;
      return this.filteredClasses.slice(start, start + this.itemsPerPage);
    },
    resultSummary() {
      const count = this.filteredClasses.length;
      if (!count) return '0 classes';
      const first = (this.currentPage - 1) * this.itemsPerPage + 1;
      const last = Math.min(first + this.itemsPerPage - 1, count);
      return first + '–' + last + ' of ' + count + (count === 1 ? ' class' : ' classes');
    },
    selectedClass() {
      return this.paginatedClasses.find(classSection => classSection.id === this.selections[this.tab])
        || this.paginatedClasses[0]
        || null;
    },
    showMembers() {
      return this.tab === 'objc' && this.activeTab !== 'overview';
    },
    highlightedMembers() {
      if (!this.selectedClass || !this.showMembers) return [];
      // Keep every declaration exactly as supplied; only add syntax markup.
      return this.selectedClass[this.activeTab].map(member =>
        hljs.highlight(member, { language: 'objectivec' }).value
      );
    },
    highlightedSource() {
      if (!this.selectedClass || this.showMembers) return '';
      const classSection = this.selectedClass;
      const source = this.tab === 'objc'
        ? '@interface ' + classSection.className + ' : ' + classSection.superclass
          + '\n' + classSection.ivars.join('\n') + '\n@end'
        : classSection.content;
      return hljs.highlight(source, { language: this.tab === 'objc' ? 'objectivec' : 'swift' }).value;
    },
  },
  watch: {
    dialog: {
      immediate: true,
      handler(open) {
        if (open) {
          this.tab = this.objectiveCClasses.length || !this.swiftClasses.length ? 'objc' : 'swift';
          this.activeTab = 'overview';
        }
      },
    },
    objcContent() {
      this.resetNavigation('objc');
    },
    swiftContent() {
      this.resetNavigation('swift');
    },
  },
  methods: {
    closeDialog() {
      this.updateDialog(false);
    },
    updateDialog(value) {
      this.$emit('update:dialog', value);
    },
    selectClass(id) {
      this.selections[this.tab] = id;
    },
    resetNavigation(language) {
      this.searches[language] = '';
      this.pages[language] = 1;
      this.selections[language] = null;
    },
    async generateFridaScript(className) {
      const script = `if (ObjC.available) {
        console.log("Hooking methods of class: ${className}");
        var targetClass = ObjC.classes["${className}"];
        if (targetClass) {
          var methods = targetClass.$ownMethods;
          methods.forEach(function(method) {
            console.log("Hooking method: " + method);
            var targetMethod = targetClass[method];
            Interceptor.attach(targetMethod.implementation, {
              onEnter: function(args) {
                console.log("Entering method: " + method);
                try {
                  if (args && args.length > 0) {
                    for (var i = 0; i < args.length; i++) {
                      try {
                        console.log("Arg[" + i + "]: " + args[i].toString());
                      } catch (e) {
                        console.log("Error accessing Arg[" + i + "]: " + e.message);
                      }
                    }
                  } else {
                    console.log("No arguments for this method.");
                  }
                } catch (e) {
                  console.log("Error processing arguments: " + e.message);
                }
              },
              onLeave: function(retval) {
                console.log("Leaving method: " + method);
                try {
                  let retvalStr = retval.toString();
                  if (retvalStr.length > 0) {
                    console.log("Return value: " + retvalStr);
                  } else {
                    console.log("Return value: (empty string)");
                  }
                } catch (e) {
                  console.log("Error accessing return value: " + e.message);
                }
              }
            });
          });
        } else {
          console.log("Class not found: ${className}");
        }
      } else {
        console.log("Objective-C Runtime is not available!");
      }`;
      console.log(`Generated Frida script:\n${script}`);

      // Copy to clipboard
      await this.copyToClipboard(script);

      // Show snackbar notification
      this.snackbarText = `Frida script for ${className} generated and copied to clipboard.`;
      this.snackbar = true;
    },
    async copyToClipboard(text) {
      try {
        await navigator.clipboard.writeText(text);
        console.log('Copied to clipboard');
      } catch (err) {
        console.error('Failed to copy: ', err);
      }
    },
  },
};
</script>

<style scoped>
.class-browser {
  height: min(860px, 90dvh);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.browser-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 20px 24px 16px;
}
.browser-header h2 {
  font-size: 22px;
  font-weight: 600;
}
.browser-header p,
.result-count,
.class-caption,
.class-superclass,
.detail-eyebrow {
  color: rgba(var(--v-theme-on-surface), 0.65);
}
.browser-header p {
  margin-top: 4px;
  font-size: 14px;
}
.language-tabs,
.member-tabs,
.browser-footer {
  flex: 0 0 auto;
}
.language-tabs {
  padding: 0 12px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.tab-count {
  margin-left: 8px;
  padding: 1px 6px;
  border-radius: 6px;
  background: rgba(var(--v-theme-on-surface), 0.07);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.browser-body {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  flex: 1;
  min-height: 0;
}
.class-sidebar {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.class-search {
  padding: 20px 16px 12px;
}
.result-count {
  margin-top: 10px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.class-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 12px;
}
.class-list-item {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 6px;
  margin: 2px 0;
  padding: 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  text-align: left;
  line-height: 1.45;
  cursor: pointer;
  color: inherit;
}
.class-list-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
}
.class-list-item.is-selected {
  background: rgba(var(--v-theme-primary), 0.1);
  border-color: rgba(var(--v-theme-primary), 0.4);
}
.class-list-item:focus-visible,
.source-scroll:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}
.class-name {
  font-size: 14px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.class-caption {
  font-size: 12px;
}
.class-pagination {
  flex: 0 0 auto;
  padding: 8px 0;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
.class-detail {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.detail-header {
  padding: 20px 24px 12px;
}
.detail-eyebrow {
  margin-bottom: 6px;
  font-size: 12px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.detail-header h3 {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.class-superclass {
  margin-top: 6px;
  font-size: 13px;
  overflow-wrap: anywhere;
}
.ivar-count {
  display: inline-block;
  margin-left: 16px;
}
.detail-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-top: 12px;
}
.wrap-toggle {
  flex: 0 0 auto;
}
.wrap-toggle :deep(.v-label) {
  font-size: 13px;
}
.member-tabs {
  padding: 0 12px;
}
.source-scroll {
  flex: 1;
  min-height: 0;
  margin: 12px 24px 24px;
  overflow: auto;
  border: 1px solid #383e48;
  border-radius: 8px;
  background: #20242c;
  color: #e6edf3;
}
pre {
  margin: 0;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
  font-size: 14px;
  line-height: 1.8;
  tab-size: 4;
  white-space: pre;
}
pre code.hljs {
  display: block;
  padding: 0;
  overflow: visible;
  background: transparent;
  color: inherit;
  font: inherit;
}
.source-block {
  padding: 20px;
}
.member-list {
  width: max-content;
  min-width: 100%;
  padding: 0;
  list-style: none;
}
.member-list li {
  display: flex;
  gap: 16px;
  padding: 14px 20px;
}
.member-list li + li {
  border-top: 1px solid #383e48;
}
.member-list li:nth-child(even) {
  background: rgba(255, 255, 255, 0.025);
}
.member-number {
  flex: 0 0 3ch;
  color: #9aa6b5;
  font-family: Consolas, monospace;
  font-size: 12px;
  line-height: 2.1;
  text-align: right;
  user-select: none;
}
.wrap-lines pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  min-width: 0;
}
.wrap-lines .member-list {
  width: 100%;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
  color: rgba(var(--v-theme-on-surface), 0.65);
}
.empty-state p {
  font-size: 14px;
  line-height: 1.6;
}
.sidebar-empty,
.detail-empty {
  flex: 1;
  min-width: 0;
}
.browser-footer {
  padding: 8px 16px;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
@media (max-width: 760px) {
  .class-browser {
    height: 92dvh;
  }
  .browser-header {
    padding: 16px;
  }
  .browser-header p {
    display: none;
  }
  .browser-body {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(320px, 1fr);
    overflow-y: auto;
  }
  .class-sidebar {
    max-height: 260px;
    border-right: 0;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  }
  .class-search {
    padding: 12px 16px 8px;
  }
  .class-list {
    min-height: 72px;
  }
  .detail-header {
    padding: 16px 16px 8px;
  }
  .detail-header h3 {
    font-size: 18px;
  }
  .source-scroll {
    min-height: 180px;
    margin: 12px 16px 16px;
  }
  .member-tabs {
    padding: 0;
  }
  .member-list li,
  .source-block {
    padding: 14px;
  }
}
</style>
