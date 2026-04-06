import api from './client'

export const checkoutApi = {
  createOrder: async (documentIds: number[]) => {
    const res = await api.post('/checkout/orders', {
      documentIds: documentIds.map(String),
      idempotencyKey: 'order_' + Date.now().toString()
    })
    return res.data
  },

  topupWallet: async (amount: number) => {
    const res = await api.post('/checkout/wallet/topup', { amount })
    return res.data
  }
}
