<template>
  <v-footer
          app
          :dark="this.$store.state.isDark"
          inset
          padless

  >
    <v-card
            :elevation="10"
            class="flex"
            color="gray"
            flat
            tile
    >

      <v-card-text class="py-2  text-center">
        <v-icon>mdi-security-network</v-icon> - LEVIATHAN - {{ new Date().getFullYear() }} - R3zk0n
      </v-card-text>
    </v-card>
  </v-footer>
</template>
<script setup lang="ts">
</script>
