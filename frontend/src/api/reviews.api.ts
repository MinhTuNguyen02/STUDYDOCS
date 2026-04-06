import api from './client'

export const reviewsApi = {
  upsertReview: async (documentId: number, data: { rating: number; comment: string }) => {
    const res = await api.post(`/reviews/documents/${documentId}`, data)
    return res.data
  },
  replyReview: async (reviewId: number, data: { reply: string }) => {
    const res = await api.post(`/reviews/${reviewId}/reply`, data)
    return res.data
  }
}
