<template>
  <div
    v-if="showTooltip"
    class="tooltip"
    :style="tooltipStyle"
  >
    {{ tooltipText }}
  </div>
</template>

<script>
import { ref, nextTick } from 'vue';

export default {
  name: 'CodeMirrorTooltip',
  setup(props, { emit }) {
    const showTooltip = ref(false);
    const tooltipStyle = ref({});
    const tooltipText = ref('');
    let hideTimeout = null;

    const show = async (left, top, text) => {
      // Clear any existing timeout
      if (hideTimeout) {
        clearTimeout(hideTimeout);
      }

      tooltipText.value = text;

      // Set initial position
      tooltipStyle.value = {
        left: `${left}px`,
        top: `${top}px`,
        opacity: 0  // Start invisible for smooth transition
      };

      showTooltip.value = true;

      // Wait for DOM update then adjust position if needed
      await nextTick();
      const tooltip = document.querySelector('.tooltip');
      if (tooltip) {
        const tooltipRect = tooltip.getBoundingClientRect();
        const windowWidth = window.innerWidth;

        // Adjust if tooltip goes off-screen
        if (tooltipRect.right > windowWidth) {
          const overflow = tooltipRect.right - windowWidth;
          tooltipStyle.value = {
            ...tooltipStyle.value,
            left: `${left - overflow - 10}px`, // 10px buffer
            opacity: 1
          };
        } else {
          tooltipStyle.value.opacity = 1;
        }
      }

      // Set auto-hide timeout
      hideTimeout = setTimeout(() => {
        hide();
      }, 1000);
    };

    const hide = () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
      }
      showTooltip.value = false;
    };

    return {
      showTooltip,
      tooltipStyle,
      tooltipText,
      show,
      hide,
    };
  },
};
</script>

<style scoped>
.tooltip {
  position: fixed;  /* Changed from absolute to fixed */
  padding: 10px;
  background-color: rgba(0, 0, 0, 0.9);
  color: white;
  border-radius: 5px;
  z-index: 1000;
  cursor: default;  /* Changed from pointer to default */
  transition: opacity 0.2s ease-in-out;
  font-size: 14px;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  pointer-events: none;  /* Changed to none so it doesn't interfere with clicks */
}

@media (prefers-color-scheme: dark) {
  .tooltip {
    background-color: rgba(255, 255, 255, 0.9);
    color: black;
    box-shadow: 0 2px 8px rgba(255, 255, 255, 0.15);
  }
}
</style>
