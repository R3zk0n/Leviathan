// Authentication endpoints (/auth).
import http from '@/utils/http'

export const authApi = {
  login:    (credentials) => http.post('/auth/login', credentials).then(r => r.data),
  register: (data)        => http.post('/auth/register', data).then(r => r.data),
  refresh:  (refresh_token) => http.post('/auth/refresh', { refresh_token }).then(r => r.data),
  logout:   (token) => http.post('/auth/logout', {}, { _logoutToken: token }).then(r => r.data),
}
