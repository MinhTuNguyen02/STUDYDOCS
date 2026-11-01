import axios from 'axios'
import { useAuthStore } from '@/store/authStore'
import { unwrapApiEnvelope } from './request'

const rawBaseUrl = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/+$/, '')
export const API_BASE_URL = rawBaseUrl.endsWith('/api') ? rawBaseUrl : `${rawBaseUrl}/api`

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request: gắn access token ──
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Single-flight session refresh để tránh race condition & token reuse detection ──
let refreshPromise: Promise<{ accessToken: string; user?: any }> | null = null

export async function refreshAuthSession(): Promise<{ accessToken: string; user?: any }> {
  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = (async () => {
    try {
      const baseUrl = API_BASE_URL
      const csrf = await axios.get(`${baseUrl}/auth/csrf`, { withCredentials: true })
      const csrfPayload = unwrapApiEnvelope(csrf.data) as { csrfToken: string }
      const csrfToken = csrfPayload?.csrfToken || (csrf.data as any)?.csrfToken

      const res = await axios.post(
        `${baseUrl}/auth/refresh`,
        {},
        {
          withCredentials: true,
          headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
        },
      )
      const refreshPayload = unwrapApiEnvelope(res.data) as { accessToken: string; user?: any }
      const newAccessToken = refreshPayload.accessToken

      useAuthStore.getState().setAccessToken(newAccessToken)
      if (refreshPayload.user) {
        useAuthStore.getState().updateUser(refreshPayload.user)
      }

      return refreshPayload
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

// ── Response: auto-refresh khi 401 ──
let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (token) prom.resolve(token)
    else prom.reject(error)
  })
  failedQueue = []
}

api.interceptors.response.use(
  (res) => {
    res.data = unwrapApiEnvelope(res.data)
    return res
  },
  async (error) => {
    const originalRequest = error.config
    const authPath = String(originalRequest?.url ?? '')
    const cannotAutoRefresh = [
      '/auth/login',
      '/auth/register',
      '/auth/refresh',
      '/auth/logout',
      '/auth/forgot-password',
      '/auth/reset-password',
    ].some((path) => authPath.includes(path))

    if (error.response?.status === 401 && !originalRequest._retry && !cannotAutoRefresh) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`
              resolve(api(originalRequest))
            },
            reject,
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const { accessToken } = await refreshAuthSession()
        originalRequest.headers.Authorization = `Bearer ${accessToken}`

        processQueue(null, accessToken)
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        useAuthStore.getState().logout()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default api
