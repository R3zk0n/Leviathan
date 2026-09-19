<template>
  <v-card>
    <v-card-title>Frida Script Editor</v-card-title>
    <v-card-text>
      <div>
        <div ref="editor" class="editor-container"></div>
      </div>
      <v-card-actions>
        <v-btn @click="handleOpenFile">Open Code</v-btn>
        <v-btn @click="handleSaveFile">Save Code</v-btn>
        <v-btn @click="handleFormatCode">Format</v-btn>
        <v-btn @click="handleClearEditor">Clear</v-btn>
        <v-btn @click="toggleTerminal">{{ terminalVisible ? 'Hide' : 'Show' }} Terminal</v-btn>
      </v-card-actions>
      <transition name="slide">
        <div v-show="terminalVisible" class="frame" ref="terminalContainer"></div>
      </transition>
    </v-card-text>
  </v-card>
</template>

<script>
import 'xterm/css/xterm.css';
import { FitAddon } from 'xterm-addon-fit';
import { Terminal } from 'xterm';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import prettier from 'prettier/standalone';
import babelParser from 'prettier/parser-babel';

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') return new jsonWorker();
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
    if (label === 'typescript' || label === 'javascript') return new tsWorker();
    return new editorWorker();
  }
};

export default {
  name: 'FridaScriptEditor',
  data() {
    return {
      terminalVisible: false,
      term: null,
      fitAddon: new FitAddon(),
      editor: null,
      currentCommand: '',
    };
  },
  mounted() {
    this.$nextTick(() => {
      if (this.$refs.editor) {
        this.initializeEditor();
        this.setupTerminal();
      }
    });
  },
  methods: {
    initializeEditor() {
      try {
        const initialValue = 'console.log("Frida script started");';
        this.editor = monaco.editor.create(this.$refs.editor, {
          value: initialValue,
          language: 'javascript',
          theme: 'vs-dark',
          automaticLayout: true,
          fontSize: 16,
          lineNumbers: 'on',
          roundedSelection: true,
          scrollBeyondLastLine: false,
          readOnly: false,
          minimap: { enabled: true },
        });

        this.registerFridaCompletions();
      } catch (error) {
        console.error('Error initializing editor:', error);
        // Handle the error appropriately, e.g., show an error message to the user
      }
    },
    registerFridaCompletions() {
      monaco.languages.registerCompletionItemProvider('javascript', {
        provideCompletionItems: () => ({
          suggestions: [
            {
              label: 'Interceptor.attach',
              kind: monaco.languages.CompletionItemKind.Function,
              documentation: 'Intercepts calls to the specified function',
              insertText: 'Interceptor.attach(${1:target}, {\n  onEnter(args) {\n    ${2}\n  },\n  onLeave(retval) {\n    ${3}\n  }\n});',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            },
            // Add more Frida API suggestions here
          ]
        })
      });
    },
    setupTerminal() {
      try {
        this.term = new Terminal({
          fontFamily: '"Fira Code", monospace',
          fontSize: 12,
          theme: { background: '#1e1e1e' },
        });

        this.term.loadAddon(this.fitAddon);
        this.term.open(this.$refs.terminalContainer);
        this.fitAddon.fit();

        this.term.onData(data => this.handleTerminalInput(data));
        window.addEventListener('resize', this.handleResize);
      } catch (error) {
        console.error('Error setting up terminal:', error);
        // Handle the error appropriately
      }
    },
    handleTerminalInput(data) {
      if (data === '\r') {  // Enter key
        this.executeCommand(this.currentCommand);
        this.currentCommand = '';
        this.term.write('\r\n$ ');
      } else if (data === '\u007f') {  // Backspace
        if (this.currentCommand.length > 0) {
          this.currentCommand = this.currentCommand.slice(0, -1);
          this.term.write('\b \b');
        }
      } else {
        this.currentCommand += data;
        this.term.write(data);
      }
    },
    executeCommand(command) {
      if (command === 'clear') {
        this.term.clear();
      } else if (command === 'run') {
        this.term.write('\r\n Running Script..\r\n');
      } else {
        this.term.write(`\r\nUnknown command: ${command}\r\n`);
      }
      this.term.write('$ ');
    },
    handleOpenFile() {
      try {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.js,.json,.txt';
        fileInput.onchange = (event) => {
          const file = event.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
              this.editor.setValue(e.target.result);
            };
            reader.onerror = (e) => {
              console.error('Error reading file:', e);
              // Handle file reading error
            };
            reader.readAsText(file);
          }
        };
        fileInput.click();
      } catch (error) {
        console.error('Error opening file:', error);
        // Handle the error appropriately, e.g., show an error message to the user
      }
    },
    handleSaveFile() {
      try {
        const content = this.editor.getValue();
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'frida-script.js';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error saving file:', error);
        // Handle the error appropriately, e.g., show an error message to the user
      }
    },
    handleFormatCode() {
      try {
        const unformattedCode = this.editor.getValue();
        const formattedCode = prettier.format(unformattedCode, {
          parser: 'babel',
          plugins: [babelParser],
        });
        this.editor.setValue(formattedCode);
      } catch (error) {
        console.error('Error formatting code:', error);
        // Handle the error appropriately, e.g., show an error message to the user
      }
    },
    handleClearEditor() {
      try {
        this.editor.setValue('');
      } catch (error) {
        console.error('Error clearing editor:', error);
        // Handle the error appropriately
      }
    },
    handleResize() {
      this.fitAddon.fit();
    },
    toggleTerminal() {
      this.terminalVisible = !this.terminalVisible;
      if (this.terminalVisible) {
        this.$nextTick(() => {
          this.fitAddon.fit();
        });
      }
    },
  },
  beforeDestroy() {
    if (this.term) {
      this.term.dispose();
    }
    window.removeEventListener('resize', this.handleResize);
    if (this.editor) {
      this.editor.dispose();
    }
  },
};
</script>

<style scoped>
.editor-container {
  height: 400px;
}
.frame {
  height: 200px;
  overflow: hidden;
}
.xterm-viewport {
  overflow-y: hidden;
}
.slide-enter-active,
.slide-leave-active {
  transition: max-height 0.5s ease;
}
.slide-enter,
.slide-leave-to {
  max-height: 0;
}
</style>
