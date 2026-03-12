import axios from 'axios'

const baseURL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

const api = axios.create({
  baseURL,
  timeout: 130000,
  headers: { 'Content-Type': 'application/json' }
})

// Interceptor: attach auth token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Interceptor: handle 401 → logout
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token')
      window.location.reload()
    }
    return Promise.reject(error)
  }
)

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  // For download links, append token as query param
  const token = localStorage.getItem('auth_token')
  const sep = p.includes('?') ? '&' : '?'
  const authParam = token ? `${sep}token=${token}` : ''
  return baseURL ? `${baseURL}${p}${authParam}` : `${p}${authParam}`
}

export { baseURL }
export default api
