import { create } from 'zustand'
import { cartApi } from '@/api/cart.api'

interface CartItem {
  cart_item_id: number
  document: {
    id: number
    title: string
    price: number
    sellerName: string
    fileExtension: string
  }
}

interface CartState {
  items: CartItem[]
  total: number
  count: number
  loading: boolean

  fetchCart: () => Promise<void>
  addToCart: (documentId: number) => Promise<void>
  removeFromCart: (documentId: number) => Promise<void>
  clearCart: () => Promise<void>
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  total: 0,
  count: 0,
  loading: false,

  fetchCart: async () => {
    set({ loading: true })
    try {
      const res = await cartApi.getCart()
      const parsedItems = res.items || []
      const calcTotal = parsedItems.reduce((acc: number, current: any) => {
         const price = current.document?.price ? Number(current.document.price) : 0
         return acc + price
      }, 0)

      set({
        items: parsedItems,
        total: calcTotal,
        count: parsedItems.length,
      })
    } catch (err) {
      console.error('Lỗi khi lấy giỏ hàng', err)
    } finally {
      set({ loading: false })
    }
  },

  addToCart: async (documentId: number) => {
    await cartApi.addToCart(documentId)
    await get().fetchCart()
  },

  removeFromCart: async (documentId: number) => {
    await cartApi.removeFromCart(documentId)
    await get().fetchCart()
  },

  clearCart: async () => {
    await cartApi.clearCart()
    set({ items: [], total: 0, count: 0 })
  }
}))
