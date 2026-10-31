import api, { refreshAuthSession } from './client'

export const authApi = {
  login: async (data: { email: string; password: string }) => {
    const res = await api.post('/auth/login', data)
    return res.data
  },

  register: async (data: { fullName: string; email: string; password: string }) => {
    const res = await api.post('/auth/register', data)
    return res.data
  },

  forgotPassword: async (email: string) => {
    const res = await api.post('/auth/forgot-password', { email })
    return res.data
  },

  resetPassword: async (token: string, newPassword: string) => {
    const res = await api.post('/auth/reset-password', { token, newPassword })
    return res.data
  },

  refresh: async () => {
    return refreshAuthSession()
  },

  logout: async () => {
    const csrf = await api.get('/auth/csrf')
    const csrfToken = csrf.data?.csrfToken || (csrf.data as any)?.data?.csrfToken
    const res = await api.post(
      '/auth/logout',
      {},
      {
        headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
      }
    )
    return res.data
  },

  sendOtp: async (phoneNumber: string) => {
    const res = await api.post('/auth/send-otp', { phoneNumber })
    return res.data
  },

  verifyOtp: async (data: { otpCode?: string; firebaseIdToken?: string }) => {
    const res = await api.post('/auth/verify-otp', data)
    return res.data
  },
}
