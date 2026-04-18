import api from './client'

export const notificationsApi = {
  list: async (limit = 8) => {
    const res = await api.get(`/notifications?limit=${limit}`)
    return res.data
  },
  markAsRead: async (id: number) => {
    const res = await api.patch(`/notifications/${id}/read`)
    return res.data
  },
  markAllAsRead: async () => {
    const res = await api.patch('/notifications/read-all')
    return res.data
  },
}
