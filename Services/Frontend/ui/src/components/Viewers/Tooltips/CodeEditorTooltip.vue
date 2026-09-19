<template>
  <div class="tooltip" :style="{ left: `${position.left}px`, top: `${position.top}px` }">
    {{ text }}
  </div>
</template>

<script>
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'CodeEditorTooltip',

  props: {
    text: {
      type: String,
      required: true
    },
    position: {
      type: Object,
      required: true,
      default: () => ({ left: 0, top: 0 })
    }
  },
});
</script>

<style scoped>
.tooltip {
  position: absolute;
  background-color: #333;
  color: #fff;
  padding: 8px;
  border-radius: 4px;
  font-size: 14px;
  white-space: nowrap;
  z-index: 10000;
}
</style>
