<template>
  <div>
    <v-btn text @click="showDialog = true">
      Information
    </v-btn>

    <v-dialog v-model="showDialog" max-width="300">
      <v-card>
        <v-card-title>Device Information</v-card-title>
        <v-card-text>
          <v-list dense>
            <v-list-item>
              <v-list-item-content>
                <v-list-item-title>Device ID: {{ deviceId }}</v-list-item-title>
              </v-list-item-content>
            </v-list-item>
            <v-list-item>
              <v-list-item-content>
                <v-list-item-title>PID: {{ pid }}</v-list-item-title>
              </v-list-item-content>
            </v-list-item>
            <v-list-item>
              <v-list-item-content>
                <v-list-item-title>Session ID: {{ sessionId }}</v-list-item-title>
              </v-list-item-content>
            </v-list-item>
            <v-list-item>
              <v-list-item-content>
                <v-list-item-title>Architecture: Arm64</v-list-item-title>
              </v-list-item-content>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" text @click="showDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
export default {
  name: 'FridaInfoDropdown',
  props: {
    deviceId: String,
    pid: Number,
    sessionId: String,
  },
  data() {
    return {
      showDialog: false
    };
  }
};
</script>
