<template>
  <div>
    <v-dialog :model-value="dialog" @update:model-value="updateDialog" max-width="800px">
      <v-card :class="isDark ? 'theme--dark' : 'theme--light'">
        <v-card-title class="headline">Classes</v-card-title>
        <v-card-text>
          <div v-if="isLoading">
            <div class="text-center">
              <v-progress-circular indeterminate color="primary"></v-progress-circular>
              <div>Decompiling Classes...</div>
            </div>
          </div>
          <div v-else class="d-flex flex-row" :class="isDark ? 'theme--dark' : 'theme--light'">
            <v-tabs
              v-model="tab"
              color="primary"
              direction="vertical"
              :class="isDark ? 'theme--dark' : 'theme--light'"
            >
              <v-tab value="objc"><v-icon>mdi-language-c</v-icon>Objective-C Classes</v-tab>
              <v-tab value="swift"><v-icon>mdi-language-swift</v-icon>Swift Classes</v-tab>
            </v-tabs>

            <v-window v-model="tab" :class="isDark ? 'theme--dark' : 'theme--light'">
              <v-window-item value="objc">
                <v-card flat :class="isDark ? 'theme--dark' : 'theme--light'">
                  <v-card-text>
                    <v-text-field
                      v-model="objcSearchQuery"
                      label="Search Objective-C Classes"
                      clearable
                      :class="isDark ? 'theme--dark' : 'theme--light'"
                    ></v-text-field>
                    <v-expansion-panels>
                      <v-expansion-panel
                        v-for="(classSection, index) in paginatedObjectiveCClasses"
                        :key="index"
                        :class="isDark ? 'theme--dark' : 'theme--light'"
                      >
                        <v-expansion-panel-title>
                          <v-btn variant="text" icon @click.stop="generateFridaScript(classSection.className)">
                            <v-icon>mdi-application-import</v-icon>
                          </v-btn>
                          {{ classSection.className }}
                        </v-expansion-panel-title>
                        <v-expansion-panel-text>
                          <v-tabs v-model="activeTab" grow>
                            <v-tab value="overview">Overview</v-tab>
                            <v-tab value="methods">Methods</v-tab>
                            <v-tab value="properties">Properties</v-tab>
                          </v-tabs>
                          <v-window v-model="activeTab">
                            <v-window-item value="overview">
                              <pre><code class="objectivec" v-html="classSection.overview"></code></pre>
                            </v-window-item>
                            <v-window-item value="methods">
                              <pre><code class="objectivec" v-html="classSection.methods"></code></pre>
                            </v-window-item>
                            <v-window-item value="properties">
                              <pre><code class="objectivec" v-html="classSection.properties"></code></pre>
                            </v-window-item>
                          </v-window>
                        </v-expansion-panel-text>
                      </v-expansion-panel>
                    </v-expansion-panels>
                    <v-pagination
                      v-model="objcCurrentPage"
                      :length="objcTotalPages"
                      :total-visible="5"
                      @input="loadObjectiveCClasses"
                    ></v-pagination>
                  </v-card-text>
                </v-card>
              </v-window-item>

              <v-window-item value="swift">
                <v-card flat :class="isDark ? 'theme--dark' : 'theme--light'">
                  <v-card-text>
                    <v-text-field
                      v-model="swiftSearchQuery"
                      label="Search Swift Classes"
                      clearable
                      :class="isDark ? 'theme--dark' : 'theme--light'"
                    ></v-text-field>
                    <v-expansion-panels>
                      <v-expansion-panel
                        v-for="(classSection, index) in paginatedSwiftClasses"
                        :key="index"
                        :class="isDark ? 'theme--dark' : 'theme--light'"
                      >
                        <v-expansion-panel-title>
                          <v-btn variant="text" icon @click.stop="generateFridaScript(classSection.className)">
                            <v-icon>mdi-application-import</v-icon>
                          </v-btn>
                          {{ classSection.className }}
                        </v-expansion-panel-title>
                        <v-expansion-panel-text>
                          <pre><code class="swift" v-html="classSection.highlightedContent"></code></pre>
                        </v-expansion-panel-text>
                      </v-expansion-panel>
                    </v-expansion-panels>
                    <v-pagination
                      v-model="swiftCurrentPage"
                      :length="swiftTotalPages"
                      :total-visible="5"
                      @input="loadSwiftClasses"
                    ></v-pagination>
                  </v-card-text>
                </v-card>
              </v-window-item>
            </v-window>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" @click="closeDialog">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar template -->
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
      isLoading: true,
      objcSearchQuery: '',
      swiftSearchQuery: '',
      tab: 'objc',
      activeTab: 'overview',
      objcCurrentPage: 1,
      swiftCurrentPage: 1,
      itemsPerPage: 10,
      snackbar: false,
      snackbarText: '',
      timeout: 2000,
    };
  },
  computed: {
    ...mapState(['isDark']),
    formattedObjectiveCClasses() {
      return this.formatObjectiveC(this.objcContent);
    },
    formattedSwiftClasses() {
      return this.formatSwift(this.swiftContent);
    },
    filteredObjectiveCClasses() {
      if (!this.objcSearchQuery) {
        return this.formattedObjectiveCClasses;
      }
      return this.formattedObjectiveCClasses.filter(classSection =>
        classSection.className.toLowerCase().includes(this.objcSearchQuery.toLowerCase())
      );
    },
    filteredSwiftClasses() {
      if (!this.swiftSearchQuery) {
        return this.formattedSwiftClasses;
      }
      return this.formattedSwiftClasses.filter(classSection =>
        classSection.className.toLowerCase().includes(this.swiftSearchQuery.toLowerCase())
      );
    },
    paginatedObjectiveCClasses() {
      const start = (this.objcCurrentPage - 1) * this.itemsPerPage;
      const end = start + this.itemsPerPage;
      return this.filteredObjectiveCClasses.slice(start, end);
    },
    paginatedSwiftClasses() {
      const start = (this.swiftCurrentPage - 1) * this.itemsPerPage;
      const end = start + this.itemsPerPage;
      return this.filteredSwiftClasses.slice(start, end);
    },
    objcTotalPages() {
      return Math.ceil(this.filteredObjectiveCClasses.length / this.itemsPerPage);
    },
    swiftTotalPages() {
      return Math.ceil(this.filteredSwiftClasses.length / this.itemsPerPage);
    }
  },
  watch: {
    dialog(newValue) {
      if (newValue) {
        this.isLoading = true;
        this.loadClasses();
      }
    },
    objcContent(newContent) {
      if (newContent) {
        this.isLoading = false;
      }
    },
    swiftContent(newContent) {
      if (newContent.length > 0) {
        this.isLoading = false;
      }
    }
  },
  methods: {
    closeDialog() {
      this.updateDialog(false);
    },
    updateDialog(value) {
      this.$emit('update:dialog', value);
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
    formatObjectiveC(content) {
      return content
        .filter(classData => classData)  // Filter out any null values
        .map(classData => {
          const overview = `@interface ${classData.name} : ${classData.superclass}\n${classData.ivars.join('\n')}\n@end`;
          const methods = classData.methods.map(this.formatMethod).join('\n');
          const properties = classData.properties.join('\n');

          const highlightedOverview = hljs.highlight(overview, { language: 'objectivec' }).value;
          const highlightedMethods = hljs.highlight(methods, { language: 'objectivec' }).value;
          const highlightedProperties = hljs.highlight(properties, { language: 'objectivec' }).value;

          return {
            className: classData.name,
            overview: highlightedOverview,
            methods: highlightedMethods,
            properties: highlightedProperties
          };
        });
  },
    formatMethod(method) {
  // Convert method signatures to a more readable format
  const parts = method.match(/-\s?\(([^)]+)\)\s?(\w+):\(([^)]+)\)\s?(\w+)\s?:(\w+)\s?\(([^)]+)\)\s?(\w+)/);
  if (parts) {
    const returnType = parts[1];
    const methodName = parts[2];
    const param1Type = parts[3];
    const param1Name = parts[4];
    const param2Name = parts[5];
    const param2Type = parts[6];
    const param2NameFinal = parts[7];
    print("Formatted Called")

    return `- (${returnType})${methodName}:(${param1Type})${param1Name} ${param2Name}:(${param2Type})${param2NameFinal};`;
  }
  return method;
},
    formatSwift(content) {
      return content.map(classSection => {
        const highlightedContent = hljs.highlight(classSection, { language: 'swift' }).value;
        return {
          className: classSection.split('\n')[0].replace(/\s*\{/, '').trim(),
          content: classSection,
          highlightedContent
        };
      });
    },
    loadClasses() {
      setTimeout(() => {
        this.isLoading = false;
      }, 1000); // Simulate a delay for decompilation
    },
    loadObjectiveCClasses(page) {
      this.objcCurrentPage = page;
    },
    loadSwiftClasses(page) {
      this.swiftCurrentPage = page;
    }
  }
};
</script>

<style scoped>
pre {
  background-color: #272822;
  color: #f8f8f2;
  padding: 16px;
  border-radius: 4px;
  white-space: pre-wrap;
  font-family: 'Courier New', Courier, monospace;
}
.text-center {
  text-align: center;
  padding: 20px;
}
.d-flex {
  display: flex;
}
.flex-row {
  flex-direction: row;
}
.theme--dark .v-card-text,
.theme--dark .v-text-field,
.theme--dark .v-expansion-panel-title,
.theme--dark .v-expansion-panel-text {
  background-color: #1e1e1e;
  color: #ffffff;
}
</style>
