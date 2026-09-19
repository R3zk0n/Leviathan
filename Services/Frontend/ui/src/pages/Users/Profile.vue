<script setup>
import { ref, onMounted, computed } from 'vue';
import { useStore } from 'vuex';
import { jwtDecode } from 'jwt-decode';


import axios from 'axios';


const store = useStore();
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

const apiUrl = import.meta.env.VITE_APP_API_URL;

const decodeToken = (token) => {
  try {
    const decoded = jwtDecode(token);
    return decoded.sub; // This should be the user ID
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};
onMounted(async () => {
  loading.value = true;
  try {
    const token = store.state.accessToken;
    const userId = decodeToken(token);

    if (!userId) {
      throw new Error('Invalid token');
    }

    const response = await axios.get(`${apiUrl}/users/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    user.value = response.data;
    username.value = user.value.username;
    email.value = user.value.email;
    createdAt.value = new Date(user.value.created_at).toLocaleString();
    updatedAt.value = new Date(user.value.updated_at).toLocaleString();
  } catch (error) {
    console.error('Error fetching profile:', error);
    message.value = 'Failed to load profile information.';
  } finally {
    loading.value = false;
  }
});

const updateProfile = async () => {
  loading.value = true;
  try {
    const response = await axios.put(`${apiUrl}/api/users/profile`,
      { username: username.value, email: email.value },
      { headers: { Authorization: `Bearer ${store.state.accessToken}` } }
    );
    user.value = response.data;
    username.value = user.value.username;
    email.value = user.value.email;
    updatedAt.value = new Date(user.value.updated_at).toLocaleString();
    message.value = 'Profile updated successfully.';
  } catch (error) {
    console.error('Error updating profile:', error);
    message.value = 'Failed to update profile.';
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
    await axios.put(`${apiUrl}/api/users/profile/password`,
      { current_password: currentPassword.value, new_password: newPassword.value },
      { headers: { Authorization: `Bearer ${store.state.accessToken}` } }
    );
    message.value = 'Password changed successfully.';
    currentPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
  } catch (error) {
    console.error('Error changing password:', error);
    message.value = 'Failed to change password.';
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
                required
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
