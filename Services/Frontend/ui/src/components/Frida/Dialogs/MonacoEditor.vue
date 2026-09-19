<template>
  <div class="monaco-editor-container" :class="{ 'typings-loading': isLoadingTypings }" :style="{ height: containerHeight }">
    <div ref="editorContainer" class="editor-element" style="width: 100%; height: 100%;"></div>
    <!-- Subtle loading indicator for typings -->
    <transition name="typing-bar-fade">
      <div v-if="isLoadingTypings" class="typings-loading-bar"></div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed, nextTick } from 'vue';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

// Import typings directly as strings (bundled at build time, no CDN/fetch needed)
import { fridaGumTypes } from '@/components/Frida/frida-gum-types.js';
import javaBridgeTypings from '@/assets/typings/frida-java-bridge.d.ts?raw';
import objcBridgeTypings from '@/assets/typings/frida-objc-bridge.d.ts?raw';

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') return new jsonWorker();
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
    if (label === 'typescript' || label === 'javascript') return new tsWorker();
    return new editorWorker();
  }
};

const props = defineProps({
  modelValue: String,
  language: {
    type: String,
    default: 'javascript'
  },
  theme: {
    type: String,
    default: 'vs-dark'
  },
  height: {
    type: [String, Number],
    default: '300px'
  },
  options: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['update:modelValue', 'run']);

const editorContainer = ref(null);
let editor = null;
const isLoadingTypings = ref(false);
const typingsLoaded = ref(false);

const containerHeight = computed(() => {
  if (typeof props.height === 'number') {
    return `${props.height}px`;
  }
  return props.height;
});

// Configure TypeScript/JavaScript language defaults BEFORE creating the editor.
// This way IntelliSense is ready from the first keystroke.
const configureLanguageDefaults = () => {
  const jsDefaults = monaco.languages.typescript.javascriptDefaults;

  // Compiler options
  jsDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.CommonJS,
    noEmit: true,
    typeRoots: ["node_modules/@types"]
  });

  // Diagnostics
  jsDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });
};

// Load all Frida typings into Monaco's language service (can be called before or after editor creation)
const loadFridaTypings = async () => {
  if (typingsLoaded.value) return;

  isLoadingTypings.value = true;

  try {
    const jsDefaults = monaco.languages.typescript.javascriptDefaults;

    // 1. Load core Frida-GUM typings from local bundle (no network needed)
    const gumTypes = fridaGumTypes();
    jsDefaults.addExtraLib(gumTypes, 'frida-gum.d.ts');

    // 2. Load Java bridge typings (imported at build time)
    if (javaBridgeTypings) {
      jsDefaults.addExtraLib(javaBridgeTypings, 'frida-java-bridge.d.ts');
    }

    // 3. Load ObjC bridge typings (imported at build time)
    if (objcBridgeTypings) {
      jsDefaults.addExtraLib(objcBridgeTypings, 'frida-objc-bridge.d.ts');
    }

    // 4. Refresh the editor model so the new typings take effect
    if (editor) {
      const value = editor.getValue();
      const oldModel = editor.getModel();
      if (oldModel) {
        oldModel.dispose();
      }
      editor.setModel(monaco.editor.createModel(value, 'javascript'));
    }

    typingsLoaded.value = true;
    console.log('All Frida typings loaded (GUM + Java bridge + ObjC bridge)');
  } catch (error) {
    console.error('Error loading Frida typings:', error);
    throw error;
  } finally {
    isLoadingTypings.value = false;
  }
};

const initializeEditor = () => {
  if (editor || !editorContainer.value) {
    return;
  }

  // Configure language defaults before creating the editor
  configureLanguageDefaults();

  const defaultOptions = {
    value: props.modelValue || '// Write your Frida script here\nconsole.log("Hello, Frida!");',
    language: props.language,
    theme: props.theme,
    lineNumbers: 'on',
    automaticLayout: true,
    fontSize: 16,
    minimap: { enabled: false },
    wordWrap: 'on',
    scrollBeyondLastLine: false,
    renderWhitespace: 'none',
    renderControlCharacters: false,
    glyphMargin: true,
    folding: true,
    lineDecorationsWidth: 10,
    lineNumbersMinChars: 3,
    hover: {
      enabled: true,
      delay: 300,
      sticky: true
    },
    tabCompletion: 'on',
    acceptSuggestionOnEnter: 'on',
    suggestOnTriggerCharacters: true,
    quickSuggestions: {
      other: true,
      comments: false,
      strings: true
    },
    suggest: {
      showIcons: true,
      showSnippets: true,
      showWords: true,
      showKeywords: true,
      showMethods: true,
      showFunctions: true,
      showVariables: true,
      showClasses: true,
      showInterfaces: true,
      showModules: true,
      showProperties: true,
      showEvents: true,
      showConstants: true,
      showEnums: true,
      showEnumMembers: true,
      showTypeParameters: true,
      insertMode: 'insert',
      filterGraceful: true,
      snippetsPreventQuickSuggestions: false,
      preview: true
    },
    parameterHints: {
      enabled: true,
      cycle: true
    },
    inlineSuggest: {
      enabled: true
    },
    scrollbar: {
      vertical: 'auto',
      horizontal: 'auto',
      useShadows: false,
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10
    }
  };

  const editorOptions = { ...defaultOptions, ...props.options };

  try {
    editor = monaco.editor.create(editorContainer.value, editorOptions);

    editor.onDidChangeModelContent(() => {
      emit('update:modelValue', editor.getValue());
    });

    // Ctrl/Cmd+Enter runs the current script (the parent owns the RUN action).
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => emit('run'));

    // Auto-load typings right after editor creation
    loadFridaTypings().catch(err => {
      console.error('Auto-load typings failed:', err);
      console.error('fridaGumTypes available:', typeof fridaGumTypes);
      console.error('javaBridgeTypings available:', typeof javaBridgeTypings, javaBridgeTypings ? javaBridgeTypings.length : 0);
      console.error('objcBridgeTypings available:', typeof objcBridgeTypings, objcBridgeTypings ? objcBridgeTypings.length : 0);
    });

    setTimeout(() => {
      if (editor) {
        editor.layout();
        editor.focus();
      }
    }, 150);
  } catch (error) {
    console.error('Failed to initialize Monaco editor:', error);
  }
};

onMounted(() => {
  nextTick(() => {
    setTimeout(() => {
      initializeEditor();
    }, 50);
  });
});

onBeforeUnmount(() => {
  if (editor) {
    editor.dispose();
  }
});

watch(() => props.modelValue, (newValue) => {
  if (editor && newValue !== editor.getValue()) {
    editor.setValue(newValue);
  }
});

watch(() => props.theme, (newValue) => {
  if (editor) {
    monaco.editor.setTheme(newValue);
  }
});

watch(() => props.height, () => {
  layout();
});

watch(() => props.options, (newOptions) => {
  if (editor && newOptions) {
    editor.updateOptions(newOptions);
    layout();
  }
}, { deep: true });

const layout = () => {
  if (editor) {
    requestAnimationFrame(() => {
      editor.layout();
    });
  }
};

const loadCustomTypings = (typingsContent, filename = 'custom.d.ts') => {
  if (!editor) {
    console.error('Editor not initialized');
    return false;
  }

  try {
    monaco.languages.typescript.javascriptDefaults.addExtraLib(typingsContent, filename);

    const value = editor.getValue();
    const model = editor.getModel();
    if (model) {
      model.dispose();
      editor.setModel(monaco.editor.createModel(value, 'javascript'));
    }

    console.log(`Custom typings loaded: ${filename}`);
    return true;
  } catch (error) {
    console.error('Error loading custom typings:', error);
    return false;
  }
};

defineExpose({
  getValue: () => editor?.getValue() || '',
  loadFridaTypings,
  loadCustomTypings,
  isLoadingTypings,
  typingsLoaded,
  editor: computed(() => editor),
  layout
});
</script>

<style scoped>
.monaco-editor-container {
  width: 100%;
  height: 100%;
  position: relative;
  background-color: #1e1e1e;
}

.editor-element {
  width: 100%;
  height: 100%;
  position: relative;
}

/* Ensure Monaco editor renders properly */
.monaco-editor-container :deep(.monaco-editor) {
  width: 100% !important;
  height: 100% !important;
}

.monaco-editor-container :deep(.monaco-editor .overflow-guard) {
  width: 100% !important;
  height: 100% !important;
}

.monaco-editor-container :deep(.monaco-editor .monaco-scrollable-element) {
  width: 100% !important;
  height: 100% !important;
}

/* Ensure text area is visible */
.monaco-editor-container :deep(.view-lines) {
  width: 100% !important;
  color: #ffffff !important;
}

/* Make sure the editor background is visible */
.monaco-editor-container :deep(.monaco-editor-background) {
  background-color: #1e1e1e !important;
}

/* Ensure cursor and selection are visible */
.monaco-editor-container :deep(.cursor) {
  color: #ffffff !important;
}

.monaco-editor-container :deep(.selected-text) {
  background-color: #264f78 !important;
}

/* Fix tooltip and hover widget positioning */
.monaco-editor-container :deep(.monaco-hover) {
  max-width: 500px !important;
  word-wrap: break-word !important;
  z-index: 1000 !important;
}

.monaco-editor-container :deep(.monaco-hover .hover-contents) {
  max-width: 480px !important;
  word-wrap: break-word !important;
}

.monaco-editor-container :deep(.parameter-hints-widget) {
  max-width: 600px !important;
  z-index: 1000 !important;
}

.monaco-editor-container :deep(.suggest-widget) {
  max-width: 400px !important;
  z-index: 1000 !important;
}

/* Constrain all overlay widgets within container bounds */
.monaco-editor-container :deep(.overlayWidgets) {
  contain: layout style !important;
}

.monaco-editor-container :deep(.monaco-editor .overlayWidgets .monaco-hover) {
  position: fixed !important;
  max-width: min(500px, 90vw) !important;
  transform: translateX(0) !important;
}

/* Ensure tooltips don't overflow the editor container */
.monaco-editor-container :deep(.monaco-editor .overlayWidgets) {
  overflow: visible !important;
  pointer-events: none !important;
}

.monaco-editor-container :deep(.monaco-editor .overlayWidgets > *) {
  pointer-events: auto !important;
}

/* Fix specific positioning for hover widgets */
.monaco-editor-container :deep(.monaco-hover.below) {
  top: auto !important;
  bottom: 100% !important;
  margin-bottom: 2px !important;
}

.monaco-editor-container :deep(.monaco-hover.above) {
  bottom: auto !important;
  top: 100% !important;
  margin-top: 2px !important;
}

/* Typings loading progress bar */
.typings-loading-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, #2196F3 30%, #64B5F6 50%, #2196F3 70%, transparent);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  z-index: 5;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.typing-bar-fade-enter-active {
  transition: opacity 0.3s ease;
}
.typing-bar-fade-leave-active {
  transition: opacity 0.8s ease;
}
.typing-bar-fade-enter-from,
.typing-bar-fade-leave-to {
  opacity: 0;
}
</style>
