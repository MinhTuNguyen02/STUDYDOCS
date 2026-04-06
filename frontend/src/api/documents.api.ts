import api from './client'

export const documentsApi = {
  getDocuments: async (params?: Record<string, any>) => {
    const res = await api.get('/documents', { params })
    return res.data
  },

  getDocumentById: async (id: string | number) => {
    const res = await api.get(`/documents/${id}`)
    return res.data
  },

  incrementView: async (id: string | number) => {
    const res = await api.post(`/documents/${id}/view`)
    return res.data
  },

  getCategories: async () => {
    const res = await api.get('/categories')
    return res.data
  },

  getTags: async (search?: string) => {
    const res = await api.get('/tags', { params: { search } })
    return res.data
  },

  getReviews: async (documentId: string | number) => {
    const res = await api.get(`/reviews/documents/${documentId}`)
    return res.data
  },

  getPolicies: async () => {
    const res = await api.get('/policies')
    return res.data?.data || res.data
  },

  getPolicyBySlug: async (slug: string) => {
    const res = await api.get(`/policies/${slug}`)
    return res.data?.data || res.data
  }
}
