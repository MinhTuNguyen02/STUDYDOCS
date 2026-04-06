import api from './client'

export const libraryApi = {
  getMyDocuments: async () => {
    const res = await api.get('/library/documents')
    return res.data
  },
  getDownloadLink: async (documentId: number) => {
    const res = await api.post(`/library/documents/${documentId}/download-link`)
    return res.data
  },
  requestDownload: async (documentId: number) => {
    const res = await api.get(`/downloads/${documentId}`)
    return res.data
  }
}
