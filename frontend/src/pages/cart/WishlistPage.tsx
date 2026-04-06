import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { wishlistApi } from '@/api/cart.api'
import DocumentCard from '@/components/common/DocumentCard'
import { Heart } from 'lucide-react'
import toast from 'react-hot-toast'

export default function WishlistPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWishlist()
  }, [])

  const fetchWishlist = async () => {
    try {
      const res = await wishlistApi.getWishlist()
      setItems(res.items || res.data || [])
    } catch (err: any) {
      toast.error('Không thể tải danh sách yêu thích')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-24 text-muted-foreground">Đang tải...</div>
  }

  return (
    <div className="max-w-7xl mx-auto py-8">
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border/50">
        <Heart className="w-8 h-8 text-destructive fill-destructive/20" />
        <h1 className="text-3xl font-bold font-heading text-foreground">Danh sách yêu thích</h1>
        <span className="ml-auto text-sm font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
          {items.length} tài liệu
        </span>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-24 bg-card border border-border rounded-2xl shadow-sm">
          <Heart className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Chưa có tài liệu yêu thích</h2>
          <p className="text-muted-foreground mb-6">Bạn chưa lưu tài liệu nào vào danh sách yêu thích.</p>
          <Link to="/documents" className="bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm inline-flex items-center">
            Khám phá tài liệu
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map(item => (
            <div key={item.wishlist_id || item.id} className="relative group">
              <DocumentCard document={item.document} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
