import { create } from 'zustand'
import { wishlistApi } from '@/api/cart.api'

interface WishlistState {
  wishlistIds: number[]
  fetchWishlist: () => Promise<void>
  toggleWishlistCallback: (id: number, isWishlistedNow: boolean) => void
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  wishlistIds: [],

  fetchWishlist: async () => {
    try {
      const res = await wishlistApi.getWishlist()
      const items = res.items || res.data || []
      const ids = items.map((i: any) => i.document.id)
      set({ wishlistIds: ids })
    } catch (err) {
      console.error('Lỗi khi lấy wishlist global', err)
    }
  },

  toggleWishlistCallback: (id: number, isWishlistedNow: boolean) => {
    const currentIds = get().wishlistIds
    if (isWishlistedNow) {
      set({ wishlistIds: [...currentIds, id] })
    } else {
      set({ wishlistIds: currentIds.filter(v => v !== id) })
    }
  }
}))
