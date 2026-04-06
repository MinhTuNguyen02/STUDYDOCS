import api from './client'

export const packagesApi = {
  getPackages: async () => {
    const res = await api.get('/packages')
    return res.data
  },
  buyPackage: async (packageId: number) => {
    const res = await api.post(`/packages/${packageId}/buy`)
    return res.data
  }
}
