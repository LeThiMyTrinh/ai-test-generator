import axios from 'axios'

/**
 * Base URL của API. Cấu hình qua biến môi trường VITE_API_BASE_URL.
 * - Để trống hoặc không set: gọi tương đối (dùng Vite proxy trong dev).
 * - Ví dụ production: https://api.example.com
 */
const baseURL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

const api = axios.create({
  baseURL,
  timeout: 130000,
  headers: { 'Content-Type': 'application/json' }
})

/**
 * Trả về URL đầy đủ cho path API (dùng cho href, download, iframe...).
 * @param {string} path - Đường dẫn bắt đầu bằng /api/... hoặc /evidence/..., /reports/...
 */
export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  return baseURL ? `${baseURL}${p}` : p
}

export default api
