import api from './client'

export const cartApi = {
  getCart: async () => {
    const res = await api.get('/cart')
    return res.data
  },

  addToCart: async (documentId: number) => {
    const res = await api.post('/cart/add', { documentId })
    return res.data
  },

  removeFromCart: async (documentId: number) => {
    const res = await api.delete(`/cart/remove/${documentId}`)
    return res.data
  },

  clearCart: async () => {
    const res = await api.delete('/cart/clear')
    return res.data
  }
}

export const wishlistApi = {
  getWishlist: async () => {
    const res = await api.get('/wishlists')
    return res.data
  },

  toggleWishlist: async (documentId: number) => {
    const res = await api.post('/wishlists/toggle', { documentId })
    return res.data
  }
}
