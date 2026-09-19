// User profile endpoints (/users).
import http from '@/utils/http'

export const usersApi = {
  getProfile:     ()     => http.get('/users/profile').then(r => r.data),
  updateProfile:  (data) => http.put('/users/profile', data).then(r => r.data),
  changePassword: (data) => http.put('/users/profile/password', data).then(r => r.data),
}
