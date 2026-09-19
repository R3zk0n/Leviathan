<template>
  <pre :class="{ 'dark-pre': isDark }"><code ref="codeEl" :class="['language-' + prismLanguage, { 'dark-code': isDark }]">{{ code }}</code></pre>
</template>

<script setup>
import { defineProps, onMounted, computed, ref, watch, nextTick } from 'vue';
import Prism from 'prismjs';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-markup';

const props = defineProps({
  code: {
    type: String,
    required: true,
  },
  language: {
    type: String,
    default: 'java',
  },
  isDark: {
    type: Boolean,
    default: false,
  },
});

const codeEl = ref(null);

// Prism uses "markup" for HTML/XML-like languages.
const prismLanguage = computed(() => {
  const lang = (props.language || 'java').toLowerCase();
  if (lang === 'xml' || lang === 'html' || lang === 'markup') return 'markup';
  return lang;
});

const highlight = async () => {
  await nextTick();
  if (!codeEl.value) return;

  Prism.highlightElement(codeEl.value);
};

onMounted(() => {
  // Use element-level highlighting so we can re-run it on updates.
  highlight();
});

watch(
  () => [props.code, prismLanguage.value, props.isDark],
  () => {
    highlight();
  }
);
</script>

<style scoped>
pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  padding: 1rem;
  border-radius: 4px;
  margin: 0;
  background-color: #f6f8fa;
  border: 1px solid #d0d7de;
}

code {
  color: #24292f;
  text-shadow: none;
}

.dark-pre {
  background-color: #2D2D2D;
  border-color: rgba(255, 255, 255, 0.12);
}

.dark-code {
  color: #E0E0E0;
}
</style>
