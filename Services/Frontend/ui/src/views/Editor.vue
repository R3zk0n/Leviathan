<template>
  <div>
    <p>This is editor route</p>
  </div>
</template>

<script>
import { ref, defineComponent } from 'vue';
import CodeMirrorViewer from '@/components/Viewers/CodeMirrorViewer.vue';
import CodeEditorTooltip from "@/components/Viewers/Tooltips/CodeEditorTooltip.vue";
export default defineComponent({
  name: "Editor",
  components: {
    CodeMirrorViewer,
    CodeEditorTooltip
  },
  setup() {
    const editorCode = ref(JSON.stringify({ "key": "value" }, null, 2));
    const fileInput = ref(null);
    const editor = ref(null);

    const openFile = () => {
      fileInput.value.click();
    };

    const loadCode = (event) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          editorCode.value = e.target.result;
        };
        reader.readAsText(file);
      }
    };

    const saveFile = () => {
      const blob = new Blob([editorCode.value], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'code.json';
      a.click();
      URL.revokeObjectURL(url);
    };

    const formatCode = () => {
      try {
        const formatted = JSON.stringify(JSON.parse(editorCode.value), null, 2);
        editorCode.value = formatted;
      } catch (e) {
        console.error("Formatting error: ", e);
      }
    };

    return {
      editorCode,
      fileInput,
      editor,
      openFile,
      loadCode,
      saveFile,
      formatCode,
    };
  }
});
</script>

<style scoped>
.v-card-text {
  overflow: hidden;
}
</style>

