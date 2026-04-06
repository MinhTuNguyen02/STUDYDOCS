import api from './client'

export const ordersApi = {
  getOrders: async () => {
    const res = await api.get('/orders')
    return res.data
  },
  getOrderStatus: async (orderId: string | number) => {
    const res = await api.get(`/checkout/orders/${orderId}/status`)
    return res.data
  }
}
