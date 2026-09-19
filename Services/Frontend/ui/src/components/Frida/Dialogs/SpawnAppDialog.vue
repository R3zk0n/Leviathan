<template>
  <v-dialog v-model="dialog" max-width="800">
    <v-card>
      <v-card-title>
        <v-icon class="mr-2">mdi-plus</v-icon>
        Spawn Application
      </v-card-title>

      <v-card-text>
        <v-form @submit.prevent="spawnApp">
          <v-text-field
            v-model="packageName"
            label="Package Name"
            :hint="getHint()"
            persistent-hint
            variant="outlined"
            density="compact"
            :rules="[v => !!v || 'Package name is required']"
            class="mb-4"
          />

          <v-text-field
            v-model="sessionId"
            label="Session ID"
            hint="Unique identifier for this session"
            persistent-hint
            variant="outlined"
            density="compact"
            class="mb-4"
          />

          <v-textarea
            v-model="spawnScript"
            label="Spawn Script (Optional)"
            hint="JavaScript code to execute after spawning"
            persistent-hint
            variant="outlined"
            density="compact"
            rows="6"
            class="mb-4"
            placeholder="// Optional Frida script to inject\nconsole.log('App spawned successfully');"
          />

          <v-row class="mb-4">
            <v-col cols="6">
              <v-switch
                v-model="noPause"
                label="Resume after spawn"
                hint="If disabled, process will remain paused"
                persistent-hint
                color="primary"
                density="compact"
              />
            </v-col>
            <v-col cols="6">
              <v-switch
                v-model="keepScriptRunning"
                label="Keep script running"
                hint="Maintain script execution thread"
                persistent-hint
                color="primary"
                density="compact"
              />
            </v-col>
          </v-row>

          <v-alert type="info" density="compact" variant="tonal" class="mt-4">
            <div class="text-caption">
              <strong>Examples:</strong>
              <div v-if="device?.os === 'ios'">
                iOS: com.apple.mobilesafari, com.facebook.Facebook
              </div>
              <div v-else-if="device?.os === 'android'">
                Android: com.android.chrome, com.facebook.katana
              </div>
              <div v-else>
                Enter the bundle ID (iOS) or package name (Android)
              </div>
            </div>
          </v-alert>
        </v-form>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="dialog = false">Cancel</v-btn>
        <v-btn
          color="primary"
          variant="tonal"
          @click="spawnApp"
          :loading="spawning"
          :disabled="!packageName"
        >
          <v-icon start>mdi-rocket-launch</v-icon>
          Spawn
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import axios from 'axios'
import { newSessionId } from '@/utils/frida'

const props = defineProps({
  modelValue: Boolean,
  device: Object
})

const emit = defineEmits(['update:modelValue', 'spawned'])

const dialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const packageName = ref('')
const spawnScript = ref('')
const sessionId = ref(newSessionId())
const noPause = ref(true)
const keepScriptRunning = ref(false)
const spawning = ref(false)

const wsUrl = computed(() => import.meta.env.VITE_APP_API_URL || 'http://localhost:5000/api')

const getHint = () => {
  if (props.device?.os === 'ios') {
    return 'Enter iOS bundle identifier (e.g., com.example.app)'
  } else if (props.device?.os === 'android') {
    return 'Enter Android package name (e.g., com.example.app)'
  }
  return 'Enter application identifier'
}

const spawnApp = async () => {
  if (!packageName.value || !props.device) return

  spawning.value = true

  try {
    const payload = {
      device_id: props.device.id,
      package_name: packageName.value,
      session_id: sessionId.value,
      no_pause: noPause.value,
      keep_script_running: keepScriptRunning.value
    }

    // Only include spawn_script if it's not empty
    if (spawnScript.value.trim()) {
      payload.spawn_script = spawnScript.value.trim()
    }

    const response = await axios.post(`${wsUrl.value}/frida/spawn`, payload)

    if (response.data.status === 'success') {
      emit('spawned', {
        deviceId: props.device.id,
        pid: response.data.pid,
        sessionId: response.data.session_id,
        packageName: packageName.value,
        message: response.data.message,
        paused: !noPause.value
      })
      dialog.value = false
      resetForm()
    } else {
      throw new Error(response.data.message || 'Failed to spawn application')
    }
  } catch (error) {
    console.error('Error spawning app:', error)
    // You might want to show an error snackbar here
  } finally {
    spawning.value = false
  }
}

const resetForm = () => {
  packageName.value = ''
  spawnScript.value = ''
  sessionId.value = newSessionId()
  noPause.value = true
  keepScriptRunning.value = false
}

// Reset form when dialog closes
watch(dialog, (newValue) => {
  if (!newValue) {
    resetForm()
  }
})
</script>
