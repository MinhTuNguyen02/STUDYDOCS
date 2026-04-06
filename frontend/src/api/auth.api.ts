import api from './client'

export const authApi = {
  login: async (data: { email: string; password: string }) => {
    const res = await api.post('/auth/login', data)
    return res.data
  },

  register: async (data: { fullName: string; email: string; password: string }) => {
    const res = await api.post('/auth/register', data)
    return res.data
  },

  refresh: async (refreshToken: string) => {
    const res = await api.post('/auth/refresh', { refreshToken })
    return res.data
  },

  logout: async (refreshToken: string) => {
    const res = await api.post('/auth/logout', { refreshToken })
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

  setup2FA: async () => {
    const res = await api.post('/auth/2fa/setup')
    return res.data
  },

  verify2FA: async (code: string) => {
    const res = await api.post('/auth/2fa/verify', { code })
    return res.data
  },
}
