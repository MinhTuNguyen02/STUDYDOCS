import api from './client'

export const reportsApi = {
  createReport: async (documentId: number, type: string, reason: string) => {
    const res = await api.post('/reports', { documentId, type, reason })
    return res.data
  }
}
