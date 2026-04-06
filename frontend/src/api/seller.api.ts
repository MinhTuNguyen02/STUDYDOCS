import api from './client'

export const sellerApi = {
  getDashboardStats: async (month?: number, year?: number) => {
    const res = await api.get('/seller/dashboard', { params: { month, year } })
    return res.data
  },
  
  getMyDocuments: async (status?: string) => {
    const res = await api.get('/seller/documents', { params: { status: status === 'ALL' ? undefined : status } })
    return res.data
  },
  
  updateDocument: async (id: number, data: any) => {
    const res = await api.patch(`/seller/documents/${id}`, data)
    return res.data
  },
  
  uploadDocument: async (formData: FormData) => {
    const res = await api.post('/seller/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return res.data
  },
  
  getSalesHistory: async () => {
    const res = await api.get('/seller/sales/order-items')
    return res.data
  }
}
