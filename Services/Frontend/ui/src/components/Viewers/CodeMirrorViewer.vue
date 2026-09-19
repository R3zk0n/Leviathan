<template>
  <div>
    <textarea ref="textarea"></textarea>
    <div v-if="showMenu" class="dropdown-menu" ref="dropdownMenu">
      <ul>
        <li @click="loadDefaultTemplate">Load Default Template</li>
      </ul>
    </div>
    <div v-if="dropdownVisible" :style="{ left: `${dropdownPosition.left}px`, top: `${dropdownPosition.top}px` }" class="dropdown-menu">
      <ul v-if="dropdownType === 'SliceMode'">
        <li @click="insertValue(true)">true</li>
        <li @click="insertValue(false)">false</li>
      </ul>
      <ul v-if="dropdownType === 'traceDepth'">
        <li @click="insertValue(6)">6</li>
        <li @click="insertValue(8)">8</li>
        <li @click="insertValue(14)">14</li>
      </ul>
      <ul v-if="dropdownType === 'category'">
        <li @click="insertValue('FileRisk')">FileRisk</li>
        <li @click="insertValue('WebViewRisk')">WebViewRisk</li>
      </ul>
      <ul v-if="dropdownType === 'possibility'">
        <li @click="insertValue('4')">4</li>
        <li @click="insertValue('5')">5</li>
      </ul>
      <ul v-if="dropdownType === 'model'">
        <li @click="insertValue('middle')">middle</li>
        <li @click="insertValue('high')">high</li>
      </ul>
      <ul v-if="dropdownType === 'source'">
        <li @click="insertValue('Param')">Param</li>
        <li @click="insertValue('Return')">Return</li>
        <li @click="insertValue('Field')">Field</li>
      </ul>
      <ul v-if="dropdownType === 'sink'">
        <li @click="insertValue('TaintCheck')">TaintCheck</li>
        <li @click="insertValue('LibraryOnly')">LibraryOnly</li>
      </ul>
      <ul v-if="dropdownType === 'sanitize'">
        <li @click="insertValue('TaintCheck')">TaintCheck</li>
        <li @click="insertValue('NotTaint')">NotTaint</li>
      </ul>
      <ul v-if="dropdownType === 'sourceType'">
        <li @click="insertValue('Return')">Return</li>
        <li @click="insertValue('Param')">Param</li>
        <li @click="insertValue('Field')">Field</li>
      </ul>
      <ul v-if="dropdownType === 'sinkType'">
        <li @click="insertValue('TaintCheck')">TaintCheck</li>
        <li @click="insertValue('LibraryOnly')">LibraryOnly</li>
      </ul>
      <ul v-if="dropdownType === 'sanitizeType'">
        <li @click="insertValue('TaintCheck')">TaintCheck</li>
        <li @click="insertValue('NotTaint')">NotTaint</li>
      </ul>
    </div>
    <CodeEditorTooltip v-if="tooltipVisible" :text="tooltipText" :position="tooltipPosition" />
  </div>
</template>

<script>
import { defineComponent, ref, onMounted, nextTick } from 'vue';
import CodeMirror from 'vue-codemirror6';
import { showMinimap } from "@replit/codemirror-minimap"
import CodeEditorTooltip from "@/components/Viewers/Tooltips/CodeEditorTooltip.vue";

export default defineComponent({
  name: 'CodeMirrorViewer',
  components: {
    CodeEditorTooltip
  },
  props: {
    modelValue: {
      type: String,
      default: ''
    },
    options: {
      type: Object,
      default: () => ({
        mode: 'application/json',
        lineNumbers: true,
        theme: 'monokai',
        extraKeys: {
          'Ctrl-Space': 'openDropdown',
          'Ctrl-Enter': 'openMenu',
          'Ctrl-S': function(cm) {
            cm.save();
            alert('Code saved..');
          }
        },
        autoCloseTags: true,
      })
    }
  },
  setup(props, { emit }) {
    const textarea = ref(null);
    const codeMirrorInstance = ref(null);
    const showMenu = ref(false);
    const tooltipVisible = ref(false);
    const tooltipText = ref('');
    const tooltipPosition = ref({ left: 0, top: 0 });
    const dropdownVisible = ref(false);
    const dropdownPosition = ref({ left: 0, top: 0 });
    const dropdownType = ref('');

    // Show minimap
    showMinimap(codeMirrorInstance.value, {
      width: 100,
      side: 'left',
      height: 100,
      minimapWidth: 100,
      minimapHeight: 100,
      minimapOptions: {
        width: 100,
        height: 100,
        minimapWidth: 100,
      }, })

    const loadDefaultTemplate = () => {
      const defaultTemplate = JSON.stringify({
        'TemplateName': {
          'SliceMode': null,
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
      codeMirrorInstance.value.setValue(defaultTemplate);
      showMenu.value = false;
      adjustHeight();
    };

    const toggleMenu = () => {
      showMenu.value = !showMenu.value;
      if (showMenu.value) {
        nextTick(() => {
          const { left, bottom } = codeMirrorInstance.value.cursorCoords();
          document.querySelector('.dropdown-menu').style.left = `${left}px`;
          document.querySelector('.dropdown-menu').style.top = `${bottom}px`;
        });
      }
    };


    const toggleDropdown = () => {
  if (!view.value) return;

  const cursor = view.value.state.selection.main.head;
  const line = view.value.state.doc.lineAt(cursor);
  const lineContent = line.text;

  if (lineContent.includes('"SliceMode"')) {
      dropdownType.value = 'SliceMode';
    } else if (lineContent.includes('"traceDepth"')) {
      dropdownType.value = 'traceDepth';
    } else if (lineContent.includes('"category"')) {
      dropdownType.value = 'category';
    } else if (lineContent.includes('"possibility"')) {
      dropdownType.value = 'possibility';
    } else if (lineContent.includes('"model"')) {
      dropdownType.value = 'model';
    } else if (lineContent.includes('"source"')) {
      dropdownType.value = 'source';
    } else if (lineContent.includes('"sink"')) {
      dropdownType.value = 'sink';
    } else if (lineContent.includes('"sanitize"')) {
      dropdownType.value = 'sanitize';
    } else {
      // Check for nested properties
      const prevLine = view.value.state.doc.line(line.number - 1);
      if (prevLine.text.includes('"source"')) {
        dropdownType.value = 'sourceType';
      } else if (prevLine.text.includes('"sink"')) {
        dropdownType.value = 'sinkType';
      } else if (prevLine.text.includes('"sanitize"')) {
        dropdownType.value = 'sanitizeType';
      } else {
        return; // No relevant dropdown for this line
      }
    }

    dropdownVisible.value = !dropdownVisible.value;
    if (dropdownVisible.value) {
      const coords = view.value.coordsAtPos(cursor);
      dropdownPosition.value = { left: coords.left, top: coords.bottom };
    }
  };

  const insertValue = (value) => {
    if (!view.value) return;

    const cursor = view.value.state.selection.main.head;
    const line = view.value.state.doc.lineAt(cursor);
    let updatedLine;

    switch (dropdownType.value) {
      case 'SliceMode':
      case 'traceDepth':
        updatedLine = line.text.replace(/:.*$/, `: ${value},`);
        break;
      case 'category':
      case 'possibility':
      case 'model':
        updatedLine = line.text.replace(/:.*$/, `: "${value}",`);
        break;
      case 'source':
      case 'sink':
      case 'sanitize':
        updatedLine = line.text.replace(/:.*$/, `: {\n        \n      },`);
        view.value.dispatch({
          changes: { from: line.from, to: line.to, insert: updatedLine }
        });
        const newCursorPos = view.value.state.doc.lineAt(line.number + 1).from + 8;
        view.value.dispatch({
          changes: { from: newCursorPos, insert: `"${value}": {\n          \n        }` },
          selection: { anchor: newCursorPos + value.length + 15 }
        });
        break;
      case 'sourceType':
      case 'sinkType':
      case 'sanitizeType':
        updatedLine = `        "${value}": [\n          \n        ]`;
        view.value.dispatch({
          changes: { from: line.from, to: line.to, insert: updatedLine },
          selection: { anchor: line.from + updatedLine.indexOf('\n') + 11 }
        });
        break;
      default:
        return;
    }

    if (!['source', 'sink', 'sanitize', 'sourceType', 'sinkType', 'sanitizeType'].includes(dropdownType.value)) {
      view.value.dispatch({
        changes: { from: line.from, to: line.to, insert: updatedLine }
      });
    }

    dropdownVisible.value = false;
  };

    const handleCursorActivity = () => {
      const cursor = codeMirrorInstance.value.getCursor();
      const token = codeMirrorInstance.value.getTokenAt(cursor);

      if (token.string === '"name"' && token.type === 'string property') {
        const coords = codeMirrorInstance.value.cursorCoords();
        tooltipVisible.value = true;
        tooltipText.value = 'Name of the Template';
        tooltipPosition.value = { left: coords.left, top: coords.bottom };
      } else if (token.string === '"category"' && token.type === 'string property') {
        const coords = codeMirrorInstance.value.cursorCoords();
        tooltipVisible.value = true;
        tooltipText.value = 'Category of the Template';
        tooltipPosition.value = { left: coords.left, top: coords.bottom };
      } else if (token.string === '"SliceMode"' && token.type === 'string property') {
        const coords = codeMirrorInstance.value.cursorCoords();
        tooltipVisible.value = true;
        tooltipText.value = 'Determines if slicing mode is enabled';
        tooltipPosition.value = { left: coords.left, top: coords.bottom };
      } else if (token.string === '"traceDepth"' && token.type === 'string property') {
        const coords = codeMirrorInstance.value.cursorCoords();
        tooltipVisible.value = true;
        tooltipText.value = 'Depth of the trace';
        tooltipPosition.value = { left: coords.left, top: coords.bottom };
      } else if (token.string === '"desc"' && token.type === 'string property') {
        const coords = codeMirrorInstance.value.cursorCoords();
        tooltipVisible.value = true;
        tooltipText.value = 'Description of the Template';
        tooltipPosition.value = { left: coords.left, top: coords.bottom };
      } else {
        tooltipVisible.value = false;
      }
    };

    onMounted(() => {
      codeMirrorInstance.value = CodeMirror.fromTextArea(textarea.value, props.options);
      codeMirrorInstance.value.setValue(props.modelValue);

      codeMirrorInstance.value.on('change', () => {
        const newValue = codeMirrorInstance.value.getValue();
        if (newValue !== props.modelValue) {
          emit('update:modelValue', newValue);
        }
        adjustHeight();
      });

      codeMirrorInstance.value.on('cursorActivity', handleCursorActivity);

      CodeMirror.commands.openDropdown = () => {
        toggleDropdown();
      };

      CodeMirror.commands.openMenu = () => {
        toggleMenu();
      };

      autoFormat();
      adjustHeight();
    });

    const autoFormat = () => {
      codeMirrorInstance.value.setCursor(0, 0);
      codeMirrorInstance.value.execCommand('selectAll');
      codeMirrorInstance.value.autoFormatRange(codeMirrorInstance.value.getCursor(true), codeMirrorInstance.value.getCursor(false));
      codeMirrorInstance.value.setCursor(0, 0);
    };

    const adjustHeight = () => {
      const lineCount = codeMirrorInstance.value.lineCount();
      const newHeight = Math.min(lineCount * 24, 800); // Adjust 24 to your line height and 800 to your max height
      codeMirrorInstance.value.setSize(null, `${newHeight}px`);
    };

    return {
      textarea,
      codeMirrorInstance,
      showMenu,
      tooltipVisible,
      tooltipText,
      tooltipPosition,
      dropdownVisible,
      dropdownPosition,
      dropdownType,
      loadDefaultTemplate,
      toggleMenu,
      toggleDropdown,
      insertValue,
      handleCursorActivity
    };
  }
});
</script>

<style scoped>
.CodeMirror {
  padding: 8px 0;
  text-align: left;
  position: relative;
  z-index: 999;
  height: auto;
  min-height: 80vh; /* Ensure a minimum height */
  max-height: 80vh; /* Limit maximum height */
  overflow: auto; /* Handle overflow */
}
.error-line {
  background-color: #ffcccc;
  text-decoration: underline;
  text-decoration-color: red;
}
.dropdown-menu {
  position: absolute;
  background: white;
  border: 1px solid #ccc;
  box-shadow: 0 2px 5px rgba(0,0,0,0.15);
  z-index: 1000;
  list-style: none;
  padding: 0;
  margin: 0;
}
.dropdown-menu ul {
  padding: 0;
  margin: 0;
  list-style: none;
}
.dropdown-menu li {
  padding: 10px;
  cursor: pointer;
}
.dropdown-menu li:hover {
  background: #f0f0f0;
}
</style>
