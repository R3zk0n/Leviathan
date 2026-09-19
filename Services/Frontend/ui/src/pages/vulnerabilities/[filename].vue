<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const filename = ref('');

onMounted(() => {
  filename.value = route.params.filename;
});
</script>

<template>
  <div>
    <h1>Hello {{ filename }}</h1>
  </div>
</template>

<style scoped>
/* Add your styles here */
</style>
