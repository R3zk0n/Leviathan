<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title class="headline">Register</v-card-title>
          <v-card-text>
            <v-form @submit.prevent="handleRegister">
              <v-text-field
                label="Username"
                v-model="username"
                required
              ></v-text-field>
              <v-text-field
                label="Password"
                v-model="password"
                required
                type="password"
              ></v-text-field>
              <v-btn type="submit" color="primary" block>Register</v-btn>
              <v-alert
                v-if="registerError"
                type="error"
                dismissible
              >
                {{ registerError }}
              </v-alert>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { mapActions } from 'vuex';

export default {
  data() {
    return {
      username: '',
      password: '',
      registerError: null,
    };
  },
  methods: {
    ...mapActions(['register']),
    async handleRegister() {
      const authData = {
        username: this.username,
        password: this.password,
      };
      try {
        await this.register(authData);
        this.$router.push('/login');
      } catch (error) {
        this.registerError = 'Registration failed: ' + (error.response && error.response.data ? error.response.data.message : error.message);
      }
    },
  },
};
</script>
