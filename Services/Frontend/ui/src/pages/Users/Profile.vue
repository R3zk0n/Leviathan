<script setup>
import { ref, onMounted, computed } from 'vue';
import { usersApi } from '@/services';

const user = ref(null);
const username = ref('');
const email = ref('');
const createdAt = ref('');
const updatedAt = ref('');
const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const message = ref('');
const loading = ref(false);

const loggedInUsername = computed(() => user.value?.username || 'Unknown User');

const applyProfile = (data) => {
  user.value = data;
  username.value = data.username || '';
  email.value = data.email || '';
  createdAt.value = data.created_at ? new Date(data.created_at).toLocaleString() : '';
  updatedAt.value = data.updated_at ? new Date(data.updated_at).toLocaleString() : '';
};

onMounted(async () => {
  loading.value = true;
  try {
    applyProfile(await usersApi.getProfile());
  } catch (error) {
    console.error('Error fetching profile:', error);
    message.value = error.response?.data?.message || 'Failed to load profile information.';
  } finally {
    loading.value = false;
  }
});

const updateProfile = async () => {
  loading.value = true;
  try {
    applyProfile(await usersApi.updateProfile({
      username: username.value,
      email: email.value,
    }));
    message.value = 'Profile updated successfully.';
  } catch (error) {
    console.error('Error updating profile:', error);
    message.value = error.response?.data?.message || 'Failed to update profile.';
  } finally {
    loading.value = false;
  }
};

const changePassword = async () => {
  if (newPassword.value !== confirmPassword.value) {
    message.value = 'New passwords do not match.';
    return;
  }
  loading.value = true;
  try {
    await usersApi.changePassword({
      current_password: currentPassword.value,
      new_password: newPassword.value,
    });
    message.value = 'Password changed successfully.';
    currentPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
  } catch (error) {
    console.error('Error changing password:', error);
    message.value = error.response?.data?.message || 'Failed to change password.';
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" sm="8" md="6">
        <v-card class="mb-4">
          <v-card-title>Logged in User</v-card-title>
          <v-card-text>
            <v-row align="center">
              <v-col cols="auto">
                <v-avatar color="primary" size="64">
                  <span class="text-h5 white--text">{{ loggedInUsername.charAt(0).toUpperCase() }}</span>
                </v-avatar>
              </v-col>
              <v-col>
                <div class="text-h6">{{ loggedInUsername }}</div>
                <div>Created: {{ createdAt }}</div>
                <div>Last Updated: {{ updatedAt }}</div>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-card>
          <v-card-title>User Profile</v-card-title>
          <v-card-text>
            <v-form @submit.prevent="updateProfile">
              <v-text-field
                v-model="username"
                label="Username"
                required
                :disabled="loading"
              ></v-text-field>
              <v-text-field
                v-model="email"
                label="Email"
                type="email"
                :disabled="loading"
              ></v-text-field>
              <v-btn type="submit" color="primary" :loading="loading">Update Profile</v-btn>
            </v-form>
          </v-card-text>
        </v-card>

        <v-card class="mt-4">
          <v-card-title>Change Password</v-card-title>
          <v-card-text>
            <v-form @submit.prevent="changePassword">
              <v-text-field
                v-model="currentPassword"
                label="Current Password"
                type="password"
                required
                :disabled="loading"
              ></v-text-field>
              <v-text-field
                v-model="newPassword"
                label="New Password"
                type="password"
                required
                :disabled="loading"
              ></v-text-field>
              <v-text-field
                v-model="confirmPassword"
                label="Confirm New Password"
                type="password"
                required
                :disabled="loading"
              ></v-text-field>
              <v-btn type="submit" color="primary" :loading="loading">Change Password</v-btn>
            </v-form>
          </v-card-text>
        </v-card>

        <v-alert
          v-if="message"
          :type="message.includes('successfully') ? 'success' : 'error'"
          class="mt-4"
        >
          {{ message }}
        </v-alert>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.v-card {
  margin-bottom: 20px;
}
</style>
