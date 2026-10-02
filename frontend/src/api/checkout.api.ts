import api from './client'

export const checkoutApi = {
  createOrder: async (documentIds: number[], idempotencyKey: string) => {
    const res = await api.post('/checkout/orders', {
      documentIds: documentIds.map(String),
      idempotencyKey
    })
    return res.data
  },

  topupWallet: async (amount: number) => {
    const res = await api.post('/checkout/wallet/topup', { amount })
    return res.data
  },

  getPaymentStatus: async (paymentId: number) => {
    const res = await api.get(`/checkout/payments/${paymentId}/status`)
    return res.data as { paymentId: number; status: 'PENDING' | 'COMPLETED' | 'FAILED' }
  }
}
