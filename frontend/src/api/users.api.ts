import api from './client'

export const usersApi = {
  getMe: async () => {
    const res = await api.get('/users/me')
    return res.data
  },
  updateProfile: async (data: { fullName?: string, avatarUrl?: string }) => {
    const res = await api.patch('/users/me', data)
    return res.data
  },
  changePassword: async (data: any) => {
    const res = await api.post('/users/me/password', data)
    return res.data
  }
}
