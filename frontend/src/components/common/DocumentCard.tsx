import { Link } from 'react-router-dom'
import { formatPrice } from '@/utils/format'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { libraryApi } from '@/api/library.api'
import toast from 'react-hot-toast'
import { Star, ShoppingCart, Heart, Download } from 'lucide-react'
import { wishlistApi } from '@/api/cart.api'
import { useState } from 'react'

interface Props {
  document: any
}

export default function DocumentCard({ document }: Props) {
  const { addToCart } = useCartStore()
  const { user } = useAuthStore()
  const { wishlistIds, toggleWishlistCallback } = useWishlistStore()

  const isWishlisted = document.isWishlisted || wishlistIds.includes(document.id)
  const [loadingWishlist, setLoadingWishlist] = useState(false)
  const isFree = !document.price || document.price === 0
  const isStaff = ['admin', 'mod', 'accountant'].includes(user?.roleNames?.[0]?.toLowerCase() || '');

  const handleDownloadFree = async (e: React.MouseEvent) => {
    e.preventDefault() // prevent Link navigation
    if (!user) return toast.error('Vui lòng đăng nhập để mua')
    if (isStaff) return toast.error('Quản trị viên không thực hiện tải tài liệu')
    if (user.customerId && document.seller_id === user.customerId) {
      return toast.error('Không thể mua tài liệu của chính mình')
    }

    try {
      const res = await libraryApi.requestDownload(Number(document.id))
      const rawUrl = res.signedUrl || res.downloadUrl || res.data?.downloadUrl || res.data?.signedUrl
      if (rawUrl) {
        const fullUrl = rawUrl.startsWith('http') ? rawUrl : `/api${rawUrl}`
        window.open(fullUrl, '_blank')
        toast.success(res.message || 'Bắt đầu tải tài liệu')
      } else {
        toast.error('Đã xảy ra lỗi, không sinh được link.')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể tải tài liệu này')
    }
  }

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault() // prevent Link navigation
    if (!user) return toast.error('Vui lòng đăng nhập để mua')
    if (isStaff) return toast.error('Quản trị viên không mua tài liệu')
    if (user.customerId && document.seller_id === user.customerId) {
      return toast.error('Không thể mua tài liệu của chính mình')
    }

    try {
      await addToCart(document.id)
      toast.success('Đã thêm vào giỏ')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Lỗi khi thêm giỏ')
    }
  }

  const handleToggleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!user) return toast.error('Vui lòng đăng nhập để lưu')
    if (isStaff) return toast.error('Quản trị viên không sử dụng tính năng này')
    setLoadingWishlist(true)
    try {
      const res = await wishlistApi.toggleWishlist(document.id)
      // The backend responds with { message, isLiked }
      const newStatus = res.isLiked !== undefined ? res.isLiked : !isWishlisted
      toggleWishlistCallback(document.id, newStatus)
      toast.success(newStatus ? 'Đã thêm yêu thích' : 'Đã bỏ yêu thích')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Lỗi xử lý')
    } finally {
      setLoadingWishlist(false)
    }
  }

  const ext = document.fileExtension?.toLowerCase() || document.file_extension?.toLowerCase() || 'pdf'
  const rating = document.rating || 0
  const reviewCount = document.reviewCount || 0

  return (
    <Link to={`/documents/${document.id}`} className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 flex flex-col h-full cursor-pointer group">
      <div className={`h-48 flex items-center justify-center relative shrink-0 overflow-hidden`}>
        {document.previewUrl && document.previewUrl !== 'previews/placeholder.png' ? (
          <object
            data={`${import.meta.env.VITE_STORAGE_URL || '/api/storage'}/${document.previewUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
            type="application/pdf"
            className="w-full h-full pointer-events-none opacity-90 group-hover:opacity-100 transition-opacity scale-[1.3] group-hover:scale-[1.35] duration-500 origin-top"
          />
        ) : (
          <div className="text-white text-3xl font-bold uppercase tracking-wider group-hover:scale-110 transition-transform duration-300">
            {ext}
          </div>
        )}
        {(!document.price || document.price === 0) && (
          <div className="absolute top-3 right-3 bg-success text-white px-3 py-1 text-sm font-semibold rounded-full shadow-sm z-10">
            Miễn phí
          </div>
        )}
        <button
          onClick={handleToggleWishlist}
          disabled={loadingWishlist}
          title={isWishlisted ? "Đã yêu thích" : "Thêm vào yêu thích"}
          className="absolute top-3 left-3 bg-white/90 p-2 rounded-full shadow-sm z-10 hover:bg-white transition-colors disabled:opacity-50"
        >
          <Heart className={`w-5 h-5 transition-colors ${isWishlisted ? 'fill-red-500 text-red-500' : 'text-gray-600 hover:text-red-500'}`} />
        </button>
      </div>
      <div className="p-4 flex flex-col flex-1">
        <div className="text-xs font-medium text-primary mb-2 uppercase tracking-wider line-clamp-1">{document.categoryName || document.categories?.name || 'Tài liệu'}</div>
        <h3 className="mb-2 line-clamp-2 text-foreground font-semibold group-hover:text-primary transition-colors h-12 leading-tight text-base font-sans">{document.title}</h3>
        <div className="flex flex-col gap-1 mb-4 text-sm text-muted-foreground">
          <span>{document.sellerName || document.customer_profiles?.full_name || 'Người dùng'}</span>
        </div>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-4 h-4 ${i < Math.floor(rating)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
                  }`}
              />
            ))}
          </div>
          <span className="text-sm text-muted-foreground">({reviewCount})</span>
        </div>
        <div className="flex items-center justify-between mt-auto">
          <div className="flex flex-col">
            <span className="text-lg font-bold text-foreground">
              {document.price > 0 ? formatPrice(document.price) : 'Miễn phí'}
            </span>
          </div>
          <button
            className="bg-primary text-primary-foreground p-2.5 rounded-lg hover:bg-primary-hover transition-colors shadow-sm disabled:opacity-50"
            onClick={isFree ? handleDownloadFree : handleAddToCart}
          >
            {isFree ? <Download className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </Link>
  )
}
