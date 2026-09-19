<template>
  <div>
    <tree-view :data="jsonData" :options="{ maxDepth: openDepth, rootLabel: rootLabel }"></tree-view>
  </div>
</template>

<script>
import { TreeView } from 'vue-json-tree-view';

export default {
  name: 'JsonViewer',
  components: {
    TreeView
  },
  props: {
    jsonData: {
      type: Object,
      required: true
    },
    openDepth: {
      type: Number,
      default: 1
    },
    rootLabel: {
      type: String,
      default: 'Binary'
    }
  }
};
</script>

<style scoped>
/* Add any scoped styles if needed */
</style>
