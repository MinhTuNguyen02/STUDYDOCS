import api from './client'

export const ordersApi = {
  getOrders: async (params?: { status?: string, page?: number, limit?: number }) => {
    const res = await api.get('/orders', { params })
    return res.data
  },
  getOrderStatus: async (orderId: string | number) => {
    const res = await api.get(`/checkout/orders/${orderId}/status`)
    return res.data
  }
}
