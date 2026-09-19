<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12" md="6">
        <v-card>
          <v-card-title class="headline">Login</v-card-title>
          <v-card-text>
            <v-form @submit.prevent="handleLogin">
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
              <v-btn type="submit" color="primary" block>Login</v-btn>
              <v-alert
                v-if="loginError"
                type="error"
                dismissible
              >
                {{ loginError }}
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
      loginError: null,
    };
  },
  methods: {
    ...mapActions(['login']),
    async handleLogin() {
      const authData = {
        username: this.username,
        password: this.password,
      };
      try {
        await this.login(authData);
        this.$router.push('/');
      } catch (error) {
        this.loginError = 'Login failed: ' + (error.response && error.response.data ? error.response.data.message : error.message);
      }
    },
  },
};
</script>
