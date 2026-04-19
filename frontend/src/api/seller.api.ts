import api from './client'

export const sellerApi = {
  getDashboardStats: async (startDate?: string, endDate?: string) => {
    const res = await api.get('/seller/dashboard', { params: { startDate, endDate } })
    return res.data
  },

  getMonthlyTrend: async (year?: number) => {
    const res = await api.get('/seller/dashboard/trend', { params: { year } })
    return res.data
  },

  getDailyTrend: async (startDate: string, endDate: string) => {
    const res = await api.get('/seller/dashboard/daily-trend', { params: { startDate, endDate } })
    return res.data
  },
  
  getMyDocuments: async (params?: { status?: string, search?: string, page?: number, limit?: number }) => {
    const res = await api.get('/seller/documents', { params })
    return res.data
  },
  
  updateDocument: async (id: number, data: any) => {
    const res = await api.patch(`/seller/documents/${id}`, data)
    return res.data
  },

  toggleDocumentVisibility: async (id: number, isHidden: boolean) => {
    const res = await api.patch(`/seller/documents/${id}/toggle-visibility`, { isHidden })
    return res.data
  },
  
  uploadDocument: async (formData: FormData) => {
    const res = await api.post('/seller/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return res.data
  },
  
  getSalesHistory: async (params?: { status?: string, search?: string, page?: number, limit?: number }) => {
    const res = await api.get('/seller/sales/order-items', { params })
    return res.data
  }
}
