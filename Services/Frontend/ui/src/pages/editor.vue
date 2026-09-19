<template>
  <div class="editor-page">
    <v-card :theme="isDark ? 'dark' : 'light'" class="editor-card">
      <v-card-title class="editor-title">
        <v-icon class="mr-2">mdi-code-json</v-icon>
        <span>Rule Editor</span>

        <v-chip
          v-if="selectedRule"
          size="small"
          variant="tonal"
          class="ml-3"
          prepend-icon="mdi-file-code-outline"
        >{{ selectedRule }}</v-chip>

        <v-chip
          v-if="code && code.trim()"
          size="small"
          variant="tonal"
          class="ml-2"
          :color="isValidJson ? 'success' : 'error'"
          :prepend-icon="isValidJson ? 'mdi-check-circle-outline' : 'mdi-alert-circle-outline'"
        >{{ isValidJson ? 'Valid JSON' : 'Invalid JSON' }}</v-chip>

        <v-spacer />

        <!-- Rule field reference -->
        <v-menu :close-on-content-click="false" location="bottom end">
          <template v-slot:activator="{ props }">
            <v-btn v-bind="props" variant="text" size="small" prepend-icon="mdi-help-circle-outline">
              Fields
            </v-btn>
          </template>
          <v-card max-width="400" class="hints-card">
            <v-card-text class="py-2">
              <div class="text-caption text-medium-emphasis mb-2">
                Click a key in the editor for inline hints. Tip: keep <code>desc.name</code> free of
                spaces and <code>( ) + /</code> so the report file opens in View Code.
              </div>
              <v-list density="compact" class="hints-list" lines="two">
                <v-list-item v-for="hint in ruleFieldHints" :key="hint.key">
                  <v-list-item-title><code>{{ hint.key }}</code></v-list-item-title>
                  <v-list-item-subtitle>{{ hint.desc }}</v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-menu>
      </v-card-title>

      <v-card-text class="editor-content">
        <!-- Selectors row -->
        <div class="selectors-row">
          <!-- Directory selector -->
          <v-select
            v-model="selectedDirectory"
            :items="availableDirectories"
            label="Select Directory"
            :menu-props="{ maxHeight: '400px' }"
            @update:model-value="handleDirectoryChange"
            :loading="isLoadingDirectories"
            clearable
            return-object
            item-title="text"
            item-value="value"
            density="compact"
            variant="outlined"
            class="selector-field"
          ></v-select>

          <!-- Rule selector -->
          <v-select
            v-model="selectedRule"
            :items="availableRules"
            label="Select Rule"
            :menu-props="{ maxHeight: '400px' }"
            @update:model-value="loadSelectedRule"
            clearable
            :loading="isLoading"
            :disabled="!selectedDirectory"
            density="compact"
            variant="outlined"
            class="selector-field"
          ></v-select>
        </div>

        <!-- Editor container -->
        <div class="editor-wrapper" :class="isDark ? 'theme--dark' : 'theme--light'">
          <codemirror
            v-model="code"
            placeholder="Select a rule above, or paste rule JSON here. Click a key for inline hints, or use “Fields” for a reference."
            :style="{ minHeight: '400px', maxHeight: '60vh', fontSize: '14px' }"
            :autofocus="true"
            :indent-with-tab="true"
            :tab-size="2"
            :extensions="currentExtensions"
            @ready="handleReady"
            @change="handleChange"
            @focus="log('focus', $event)"
            @blur="log('blur', $event)"
            @mousedown="handleClick"
            class="editor"
          />
          <CodeMirrorTooltip ref="tooltipRef" @insertTemplate="insertTemplateJson" />
          <div
            v-if="dropdownVisible"
            :style="{ left: `${dropdownPosition.left}px`, top: `${dropdownPosition.top}px` }"
            class="dropdown-menu"
          >
            <ul v-if="dropdownType === 'SliceMode'">
              <li @click="insertValue(true)">true</li>
              <li @click="insertValue(false)">false</li>
            </ul>
            <ul v-if="dropdownType === 'traceDepth'">
              <li @click="insertValue(6)">6</li>
              <li @click="insertValue(8)">8</li>
              <li @click="insertValue(14)">14</li>
            </ul>
            <ul v-if="dropdownType === 'model'">
              <li @click="insertValue('low')">low</li>
              <li @click="insertValue('middle')">middle</li>
              <li @click="insertValue('high')">high</li>
            </ul>
          </div>
        </div>
      </v-card-text>

      <v-divider></v-divider>

      <v-card-actions class="editor-actions">
        <v-btn variant="outlined" size="small" @click="openFile">
          <v-icon start size="small">mdi-folder-open</v-icon>
          Open
        </v-btn>
        <v-btn variant="outlined" size="small" @click="saveFile">
          <v-icon start size="small">mdi-content-save</v-icon>
          Save
        </v-btn>
        <v-btn variant="elevated" color="primary" size="small" @click="saveToRuleDirectory" :disabled="!selectedDirectory">
          <v-icon start size="small">mdi-content-save-check</v-icon>
          Save to Rules
        </v-btn>
        <v-btn variant="outlined" size="small" @click="createRuleFolder">
          <v-icon start size="small">mdi-folder-plus</v-icon>
          New Folder
        </v-btn>
        <v-spacer></v-spacer>
        <v-btn variant="text" size="small" @click="formatJson">
          <v-icon start size="small">mdi-code-braces</v-icon>
          Format
        </v-btn>
        <v-btn
          variant="text"
          size="small"
          color="error"
          @click="openDeleteRuleDialog"
          :disabled="!selectedRule || !selectedDirectory"
        >
          <v-icon start size="small">mdi-trash-can-outline</v-icon>
          Delete Rule
        </v-btn>
        <v-btn variant="text" size="small" color="error" @click="clearEditor">
          <v-icon start size="small">mdi-delete</v-icon>
          Clear
        </v-btn>
      </v-card-actions>
    </v-card>

    <ConfirmDialog
      v-model="deleteRuleDialog"
      title="Delete rule"
      :message="`Are you sure you want to delete '${selectedRule || ''}'?`"
      :details="selectedDirectory ? `Directory: ${selectedDirectory.text}` : ''"
      confirm-text="Delete"
      cancel-text="Cancel"
      confirm-color="error"
      :loading="isDeletingRule"
      @confirm="confirmDeleteRule"
      @cancel="deleteRuleDialog = false"
    />
  </div>
</template>

<script>
import { defineComponent, ref, shallowRef, onMounted, onUnmounted, computed, watch } from 'vue';
import { useStore } from 'vuex';
import { Codemirror } from 'vue-codemirror';
import { EditorState, StateEffect, StateField } from '@codemirror/state';
import { EditorView, Decoration } from '@codemirror/view';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import CodeMirrorTooltip from '@/components/Viewers/Tooltips/CodeMirrorTooltip.vue';
import axios from 'axios';
import ConfirmDialog from '@/components/Common/ConfirmDialog.vue';

export default defineComponent({
  components: {
    Codemirror,
    CodeMirrorTooltip,
    ConfirmDialog,
  },
  setup() {
    const store = useStore();
    const code = ref('');
    const view = shallowRef(null);
    const tooltipRef = ref(null);
    const editorHeight = ref(400);
    const dropdownVisible = ref(false);
    const dropdownPosition = ref({ left: 0, top: 0 });
    const dropdownType = ref('');

    // Live JSON validity, surfaced as a chip in the header.
    const isValidJson = computed(() => {
      const text = (code.value || '').trim();
      if (!text) return true; // empty isn't "invalid"
      try { JSON.parse(text); return true; } catch { return false; }
    });

    // Reference shown in the header "Fields" menu (rule-authoring cheat sheet).
    const ruleFieldHints = [
      { key: 'SliceMode / DirectMode', desc: 'Analysis mode. SliceMode finds the entry from source↔sink; DirectMode walks from a fixed entry.' },
      { key: 'traceDepth', desc: 'Call-graph depth budget — higher = more recall, more cost.' },
      { key: 'entry', desc: 'Where analysis starts. { "ExportedCompos": true } covers all exported components.' },
      { key: 'desc.name', desc: 'Display name AND report filename — keep to letters/spaces; avoid ( ) + / so View Code works.' },
      { key: 'desc.model', desc: 'Confidence: low | middle | high.' },
      { key: 'desc.possibility', desc: 'Severity / likelihood hint (1–5).' },
      { key: 'source', desc: 'Taint origins: Return, Param, Field, ConstString, NewInstance.' },
      { key: 'sink', desc: 'Dangerous call. Pick the variable with TaintCheck (@this, p0…, return).' },
      { key: 'sanitizer', desc: 'Paths to suppress. Top-level keys OR; methods within a key AND.' },
      { key: 'mustTainted', desc: 'Require the path to also pass through this tainted call.' },
      { key: 'TaintTweak', desc: 'Per-rule taint propagation overrides (I/O variable flow).' },
    ];

    const errorMark = Decoration.line({ class: 'error-line' });
    const addErrorMark = StateEffect.define();
    const removeErrorMark = StateEffect.define();

    const BASE_RULES_PATH = '/appshark_engine/appshark/config/rules';
    const selectedRule = ref(null);
    const availableRules = ref([]);
    const isLoading = ref(false);

    // New directory selection related variables
    const selectedDirectory = ref(null);
    const availableDirectories = ref([]);
    const isLoadingDirectories = ref(false);

    const errorMarkers = StateField.define({
      create() {
        return Decoration.none;
      },
      update(markers, tr) {
        markers = markers.map(tr.changes);
        for (let e of tr.effects) {
          if (e.is(addErrorMark)) markers = markers.update({ add: [errorMark.range(e.value)] });
          if (e.is(removeErrorMark)) markers = markers.update({ filter: () => false });
        }
        return markers;
      },
      provide: f => EditorView.decorations.from(f)
    });

    const extensions = computed(() => [
      json(),
      errorMarkers,
      isDark.value ? oneDark : []
    ]);

    const currentExtensions = computed(() => {
      return store.state.isDark ? [...extensions.value, oneDark] : extensions.value;
    });

    // Fetch available directories
    const fetchDirectories = async () => {
      isLoadingDirectories.value = true;
      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/engine/directories`);
        if (Array.isArray(response.data.directories)) {
          // Create directory options with base path and subdirectories
          availableDirectories.value = [
            { text: 'Base Rules', value: BASE_RULES_PATH },
            ...response.data.directories.map(dir => ({
              text: dir,
              value: `${BASE_RULES_PATH}/${dir}`
            }))
          ];
        }
      } catch (error) {
        console.error('Error fetching directories:', error);
        alert('Failed to fetch available directories');
      } finally {
        isLoadingDirectories.value = false;
      }
    };

    // Handler for directory change
    const handleDirectoryChange = async () => {
      selectedRule.value = null; // Clear selected rule
      code.value = ''; // Clear editor
      if (view.value) {
        view.value.dispatch({
          changes: { from: 0, to: view.value.state.doc.length, insert: '' },
        });
      }

      if (!selectedDirectory.value) {
        availableRules.value = [];
        return;
      }

      await fetchAvailableRules(selectedDirectory.value.value);
    };

    // New function to fetch available rules from selected directory
    const fetchAvailableRules = async (directoryPath) => {
      isLoading.value = true;
      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/engine/rules`, {
          params: {
            rulePath: directoryPath
          }
        });
        availableRules.value = response.data.rules || [];
      } catch (error) {
        console.error('Error fetching rules:', error);
        alert('Failed to fetch available rules');
      } finally {
        isLoading.value = false;
      }
    };

    // Updated loadSelectedRule function
    const loadSelectedRule = async () => {
      if (!selectedRule.value || !selectedDirectory.value) {
        if (view.value) {
          view.value.dispatch({
            changes: { from: 0, to: view.value.state.doc.length, insert: '' },
          });
        }
        return;
      }

      try {
        isLoading.value = true;
        // Get the rule content using the file-content endpoint with full path
        const rulePath = `${selectedDirectory.value.value}/${selectedRule.value}`;
        const formattedContent = await getFileContent(rulePath);

        if (view.value) {
          view.value.dispatch({
            changes: {
              from: 0,
              to: view.value.state.doc.length,
              insert: formattedContent
            },
          });
        }
      } catch (error) {
        console.error('Error loading rule:', error);
        alert('Failed to load selected rule: ' + error.message);
      } finally {
        isLoading.value = false;
      }
    };

    const handleReady = (payload) => {
      view.value = payload.view;
      adjustEditorHeight();
    };

    const handleChange = () => {
      adjustEditorHeight();
      clearErrorHighlight();
    };

    const adjustEditorHeight = () => {
      if (view.value) {
        const lineHeight = 24;
        const lineCount = view.value.state.doc.lines;
        editorHeight.value = Math.max(400, lineCount * lineHeight);
      }
    };

    // Updated getFileContent to use the full path
    const getFileContent = async (path) => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/engine/file-content`, {
          params: {
            path: path
          }
        });

        if (response.data && response.data.content) {
          return typeof response.data.content === 'object' ?
            JSON.stringify(response.data.content, null, 2) :
            response.data.content;
        }
        return '';
      } catch (error) {
        console.error('Error getting file content:', error);
        throw error;
      }
    };

    const openFile = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';
      input.onchange = (event) => {
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
          if (view.value) {
            view.value.dispatch({
              changes: { from: 0, to: view.value.state.doc.length, insert: e.target.result },
            });
          }
        };
        reader.readAsText(file);
      };
      input.click();
    };

    const saveFile = () => {
      if (view.value) {
        const blob = new Blob([view.value.state.doc.toString()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'code.json';
        a.click();
        URL.revokeObjectURL(url);
      } else {
        console.error('Editor view is not initialized.');
      }
    };

    // FIXED: Updated saveToRuleDirectory function to properly extract subdirectory name
    const saveToRuleDirectory = async () => {
      if (!view.value || !selectedDirectory.value) {
        alert('Please select a directory first');
        return;
      }

      let ruleName = selectedRule.value;
      if (!ruleName) {
        ruleName = prompt("Enter the rule name (including .json extension):");
      }

      if (!ruleName) return; // User cancelled

      // Ensure the filename ends with .json
      if (!ruleName.endsWith('.json')) {
        ruleName += '.json';
      }

      try {
        // Get the current content as a string
        const contentStr = view.value.state.doc.toString();

        // Validate that it's valid JSON before sending
        JSON.parse(contentStr); // This will throw if invalid JSON

        // For non-base directories, prepend directory name to rule path
        let rulePath = ruleName;
        if (selectedDirectory.value.value !== BASE_RULES_PATH) {
          // FIXED: Extract the subdirectory name from the full path
          const dirName = selectedDirectory.value.value.replace(`${BASE_RULES_PATH}/`, '');
          rulePath = `${dirName}/${ruleName}`;
        }

        console.log('Saving rule with path:', rulePath);
        console.log('Selected directory:', selectedDirectory.value);

        // Properly encode each path segment to handle spaces and special characters
        const encodedRulePath = rulePath.split('/').map(segment => encodeURIComponent(segment)).join('/');
        console.log('API URL:', `${import.meta.env.VITE_APP_API_URL}/engine/save-rule/${encodedRulePath}`);

        const response = await axios.post(
          `${import.meta.env.VITE_APP_API_URL}/engine/save-rule/${encodedRulePath}`,
          { content: contentStr },
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        console.log('Save response:', response.data);

        if (response.data.success) {
          alert(response.data.message);
          // Refresh the rules list for the current directory
          await fetchAvailableRules(selectedDirectory.value.value);
          // Set the selected rule to the filename (not the full path)
          selectedRule.value = ruleName;
        } else {
          throw new Error(response.data.message || 'Failed to save rule');
        }
      } catch (error) {
        console.error('Error saving rule:', error);
        if (error instanceof SyntaxError) {
          alert('Invalid JSON format. Please check your content.');
        } else {
          const errorMessage = error.response?.data?.message || error.message;
          alert('Failed to save rule: ' + errorMessage);
        }
      }
    };

    // Updated createRuleFolder to refresh directories after creation
    const createRuleFolder = async () => {
      const folderName = prompt("Enter the folder name:");
      if (folderName) {
        try {
          const encodedFolderName = encodeURIComponent(folderName);
          const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/engine/create-rule-folder/${encodedFolderName}`);
          alert(response.data.message);
          await fetchDirectories();  // Refresh directories list
        } catch (error) {
          console.error('Error creating folder:', error);
          alert('Failed to create folder: ' + (error.response?.data?.message || error.message));
        }
      }
    };

    const formatJson = () => {
      try {
        if (view.value) {
          const formatted = JSON.stringify(JSON.parse(view.value.state.doc.toString()), null, 2);
          view.value.dispatch({
            changes: { from: 0, to: view.value.state.doc.length, insert: formatted },
          });
          alert('JSON formatted successfully.')
        } else {
          console.error('Editor view is not initialized.');
        }
      } catch (error) {
        console.error('SyntaxError:', error);
        alert('Invalid JSON');
        highlightError(error);
      }
    };

    const clearEditor = () => {
      if (view.value) {
        view.value.dispatch({
          changes: { from: 0, to: view.value.state.doc.length, insert: '' },
        });
        selectedRule.value = null;  // Clear selected rule
      } else {
        console.error('Editor view is not initialized.');
      }
    };

    const handleClick = (event) => {
  if (!view.value) return;

  // Get the precise position in the document where the click occurred
  const pos = view.value.posAtCoords({ x: event.clientX, y: event.clientY });
  if (pos === null) return;

  // Get the line of text and its starting position
  const line = view.value.state.doc.lineAt(pos);
  const lineText = line.text;

  // Calculate the relative click position within the line
  const clickOffset = pos - line.from;

  // Function to find the key and its position in the line
  const findKeyInLine = (text, searchKey) => {
    const keyPattern = new RegExp(`"${searchKey}"\\s*:`);
    const match = text.match(keyPattern);
    if (!match) return null;

    return {
      start: match.index,
      end: match.index + searchKey.length + 2, // +2 for the quotes
      key: searchKey
    };
  };

  // Define all possible keys and their tooltips
  const tooltipData = {
    'SliceMode': 'Mode: compute the entry from the source↔sink lowest-common-ancestor. Default for most rules.',
    'DirectMode': 'Mode: walk traceDepth calls from a fixed entry (entry.methods / ExportedCompos).',
    'traceDepth': 'Call-graph depth budget — higher = more recall, more cost.',
    'entry': 'Where analysis starts. { "ExportedCompos": true } = every exported component.',
    'ExportedCompos': 'true = treat all exported components as entry points.',
    'desc': 'Metadata block: name, category, detail, possibility, model.',
    'name': 'Display name AND report filename — keep to letters/spaces; avoid ( ) + / so View Code works.',
    'category': 'Grouping shown in results (e.g. WebView, InitRules).',
    'wiki': 'Optional reference URL for the finding.',
    'detail': 'Human-readable description of what the rule detects.',
    'possibility': 'Severity / likelihood hint (1–5).',
    'model': 'Confidence model: low | middle | high.',
    'source': 'Taint origins: Return / Param / Field / ConstString / NewInstance.',
    'Return': 'Source: the return value of the listed method(s).',
    'Param': 'Source: specific parameters of a method (p0, p1, …).',
    'Field': 'Source: a static/instance field (no wildcards in field signatures).',
    'ConstString': 'Source: a literal string wherever it appears.',
    'NewInstance': 'Source: the constructed object of the listed class.',
    'sink': 'Dangerous call. Pick the variable to check with TaintCheck.',
    'TaintCheck': 'Variables checked at the sink/sanitizer: @this, p0..pN, p*, return.',
    'LibraryOnly': 'Only match if the class is declared Library in EngineConfig.',
    'sanitizer': 'Paths to suppress. Top-level keys OR; methods within a key AND.',
    'mustTainted': 'Require the path to also pass through this tainted call.',
    'TaintTweak': 'Per-rule taint propagation overrides (I/O variable flow).'
  };

  // Check each key to find which one was clicked
  for (const [key, tooltip] of Object.entries(tooltipData)) {
    const keyPos = findKeyInLine(lineText, key);
    if (keyPos && clickOffset >= keyPos.start && clickOffset <= keyPos.end) {
      // Calculate screen coordinates for tooltip positioning
      // Get the coordinates of the clicked position
      const startPos = line.from + keyPos.start;
      const coords = view.value.coordsAtPos(startPos);

      if (coords) {
        // coords from coordsAtPos are viewport-relative
        // Since tooltip uses position: absolute, we need to account for scroll
        const editorRect = view.value.scrollDOM.getBoundingClientRect();

        // Convert viewport coordinates to be relative to the editor container
        const tooltipX = coords.left - editorRect.left + view.value.scrollDOM.scrollLeft;
        const tooltipY = coords.bottom - editorRect.top + view.value.scrollDOM.scrollTop + 5;

        tooltipRef.value.show(tooltipX, tooltipY, tooltip);
        return;
       }
      }
    }

    tooltipRef.value.hide();
  };

    // Also update the handleKeydown function to use coordsAtPos
    const handleKeydown = (event) => {
      if (!view.value) return;

      if (event.ctrlKey && event.key === ' ') {
        const cursor = view.value.state.selection.main.head;
        const line = view.value.state.doc.lineAt(cursor);
        const lineText = line.text;

        // Get coordinates using coordsAtPos
        const coords = view.value.coordsAtPos(cursor);

        if (!coords) return;

        const dropdownCoords = {
          left: coords.left,
          top: coords.bottom
        };

        if (lineText.includes('"SliceMode"')) {
          dropdownType.value = 'SliceMode';
          toggleDropdown(dropdownCoords);
        } else if (lineText.includes('"traceDepth"')) {
          dropdownType.value = 'traceDepth';
          toggleDropdown(dropdownCoords);
        } else if (lineText.includes('"model"')) {
          dropdownType.value = 'model';
          toggleDropdown(dropdownCoords);
        } else {
          insertTemplateJson();
        }

        event.preventDefault();
      }
    };

    const toggleDropdown = (coords) => {
      dropdownVisible.value = !dropdownVisible.value;
      if (dropdownVisible.value) {
        dropdownPosition.value = {
          left: coords.left,
          top: coords.top + 5 // 5px padding
        };
      }
    };

    const insertTemplateJson = () => {
      const defaultTemplate = JSON.stringify({
        'TemplateName': {
          'SliceMode': 10,
          'traceDepth': null,
          'desc': {
            'name': 'TemplateName',
            'category': 'TemplateCategory',
            'wiki': 'Information on Template',
            'detail': 'TemplateDetails',
            'possibility': '',
            'model': ''
          },
          'source': {
            'Param': {
              '<*: android.os.ParcelFileDescriptor openFile(*)>': [
                'p0'
              ]
            }
          },
          'sink': {
            '<android.os.ParcelFileDescriptor: android.os.ParcelFileDescriptor open(java.io.File,int)>': {
              'TaintCheck': [
                'p0'
              ]
            }
          },
          'sanitize': {
            'getCanonicalFile': {
              '<java.io.File: java.io.File getCanonicalFile()>': {
                'TaintCheck': [
                  '@this'
                ]
              },
              '<java.lang.String: boolean startsWith(java.lang.String)>': {
                'TaintCheck': [
                  '@this'
                ]
              }
            }
          }
        }
      }, null, 2);

      if (view.value) {
        view.value.dispatch({
          changes: { from: 0, to: view.value.state.doc.length, insert: defaultTemplate },
        });
      } else {
        console.error('Editor view is not initialized.');
      }
    };

    const insertValue = (value) => {
      if (view.value) {
        const cursor = view.value.state.selection.main.head;
        const lineContent = view.value.state.doc.lineAt(cursor).text;
        const updatedLine = lineContent.replace(/:.*$/, `: ${value},`);
        view.value.dispatch({
          changes: { from: view.value.state.doc.lineAt(cursor).from, to: view.value.state.doc.lineAt(cursor).to, insert: updatedLine },
        });
        dropdownVisible.value = false;
      }
    };

    const highlightError = (error) => {
      const errorPos = findErrorPosition(error);
      if (errorPos !== null && view.value) {
        const line = view.value.state.doc.lineAt(errorPos).number;
        view.value.dispatch({ effects: addErrorMark.of(view.value.state.doc.line(line - 1).from) });
        view.value.dispatch({
          selection: { anchor: view.value.state.doc.line(line - 1).from }
        });
      }
    };

    const findErrorPosition = (error) => {
      const match = error.message.match(/position (\d+)/);
      if (match) {
        return parseInt(match[1], 10);
      }
      const matchWithLine = error.message.match(/line (\d+) column (\d+)/);
      if (matchWithLine) {
        const line = parseInt(matchWithLine[1], 10);
        const column = parseInt(matchWithLine[2], 10);
        const lines = view.value.state.doc.toString().split('\n');
        let position = 0;
        for (let i = 0; i < line - 1; i++) {
          position += lines[i].length + 1;
        }
        position += column - 1;
        return position;
      }
      return null;
    };

    const clearErrorHighlight = () => {
      if (view.value) {
        view.value.dispatch({ effects: removeErrorMark.of(null) });
      }
    };

    onMounted(() => {
      window.addEventListener('keydown', handleKeydown);
      fetchDirectories(); // Load directories on mount
    });

    onUnmounted(() => {
      window.removeEventListener('keydown', handleKeydown);
      if (view.value) {
        view.value.destroy();
      }
    });

    const isDark = computed(() => {
      return store.state.isDark;
    });

    const deleteRuleDialog = ref(false);
    const isDeletingRule = ref(false);

    const openDeleteRuleDialog = () => {
      if (!selectedRule.value || !selectedDirectory.value) return;
      deleteRuleDialog.value = true;
    };

    const confirmDeleteRule = async () => {
      if (!selectedRule.value || !selectedDirectory.value) return;

      isDeletingRule.value = true;
      try {
        // Build a repo-relative rule path (subdir/rule.json or rule.json)
        let rulePath = selectedRule.value;
        if (selectedDirectory.value.value !== BASE_RULES_PATH) {
          const dirName = selectedDirectory.value.value.replace(`${BASE_RULES_PATH}/`, '');
          rulePath = `${dirName}/${selectedRule.value}`;
        }

        const encodedRulePath = rulePath.split('/').map(segment => encodeURIComponent(segment)).join('/');
        const response = await axios.delete(
          `${import.meta.env.VITE_APP_API_URL}/engine/delete-rule/${encodedRulePath}`
        );

        if (response.data?.success) {
          alert(response.data.message || 'Rule deleted successfully');
        } else {
          throw new Error(response.data?.message || 'Failed to delete rule');
        }

        // Refresh rules list and clear editor selection
        await fetchAvailableRules(selectedDirectory.value.value);
        selectedRule.value = null;
        clearEditor();
      } catch (error) {
        console.error('Error deleting rule:', error);
        const errorMessage = error.response?.data?.message || error.message;
        alert('Failed to delete rule: ' + errorMessage);
      } finally {
        isDeletingRule.value = false;
        deleteRuleDialog.value = false;
      }
    };

    return {
      code,
      isValidJson,
      ruleFieldHints,
      currentExtensions,
      handleReady,
      handleChange,
      log: console.log,
      openFile,
      saveFile,
      saveToRuleDirectory,
      createRuleFolder,
      formatJson,
      clearEditor,
      insertTemplateJson,
      insertValue,
      highlightError,
      handleClick,
      tooltipRef,
      dropdownVisible,
      dropdownPosition,
      dropdownType,
      editorHeight,
      isDark,
      selectedRule,
      availableRules,
      isLoading,
      loadSelectedRule,
      // New directory-related props
      selectedDirectory,
      availableDirectories,
      isLoadingDirectories,
      handleDirectoryChange,
      BASE_RULES_PATH,
      deleteRuleDialog,
      isDeletingRule,
      openDeleteRuleDialog,
      confirmDeleteRule,
    };
  },
});
</script>

<style scoped>
/* Page container */
.editor-page {
  padding: 16px;
  max-width: 100%;
  height: calc(100vh - 64px);
  overflow: hidden;
}

/* Card styling */
.editor-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: calc(100vh - 96px);
  overflow: hidden;
}

.editor-title {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  padding: 16px 20px;
  font-size: 1.25rem;
  font-weight: 500;
}

/* Fields reference menu */
.hints-card {
  max-height: 70vh;
  overflow-y: auto;
}

.hints-list :deep(.v-list-item-subtitle) {
  white-space: normal;
  opacity: 0.85;
}

.hints-list :deep(.v-list-item-title) code {
  font-size: 0.85rem;
}

.editor-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 16px 20px;
}

/* Selectors row */
.selectors-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.selector-field {
  flex: 1;
  min-width: 200px;
  max-width: 400px;
}

/* Editor wrapper */
.editor-wrapper {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border-radius: 8px;
}

.editor {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  overflow: auto;
  height: 100%;
  max-height: calc(100vh - 350px);
}

.theme--dark .editor {
  border-color: rgba(255, 255, 255, 0.12);
}

/* CodeMirror overrides */
.editor :deep(.cm-editor) {
  height: 100%;
  max-height: calc(100vh - 350px);
}

.editor :deep(.cm-scroller) {
  overflow: auto;
}

/* Actions bar */
.editor-actions {
  flex-shrink: 0;
  padding: 12px 16px;
  gap: 8px;
  flex-wrap: wrap;
}

/* Error highlighting */
.error-line {
  text-decoration: underline;
  text-decoration-color: red;
  text-decoration-style: wavy;
}

/* Dropdown menu */
.dropdown-menu {
  position: absolute;
  background: white;
  border: 1px solid #ccc;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-radius: 6px;
  z-index: 1000;
  list-style: none;
  padding: 4px 0;
  margin: 0;
}

.dropdown-menu ul {
  padding: 0;
  margin: 0;
  list-style: none;
}

.dropdown-menu li {
  padding: 8px 16px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.dropdown-menu li:hover {
  background: #f5f5f5;
}

.theme--dark .dropdown-menu {
  background: #2d2d2d;
  color: #fff;
  border-color: #444;
}

.theme--dark .dropdown-menu li:hover {
  background: #3d3d3d;
}

/* Tooltip */
.tooltip {
  position: absolute;
  padding: 8px 12px;
  background-color: #333;
  color: white;
  border-radius: 6px;
  z-index: 1000;
  cursor: pointer;
  font-size: 13px;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .selectors-row {
    flex-direction: column;
  }

  .selector-field {
    max-width: none;
  }

  .editor-actions {
    justify-content: center;
  }

  .editor-actions .v-spacer {
    display: none;
  }
}
</style>
