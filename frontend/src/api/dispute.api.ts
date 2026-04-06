import api from './client'

export const disputeApi = {
  createDispute: async (orderItemId: number, reason: string, description: string) => {
    const res = await api.post('/disputes', { orderItemId, reason, description })
    return res.data
  }
}
