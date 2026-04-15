import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { documentsApi } from '@/api/documents.api'
import { reviewsApi } from '@/api/reviews.api'
import { wishlistApi } from '@/api/cart.api'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { libraryApi } from '@/api/library.api'
import ReviewForm from '@/components/reviews/ReviewForm'
import SellerReplyForm from '@/components/reviews/SellerReplyForm'
import ReportModal from '@/components/common/ReportModal'
import { formatPrice, formatFileSize, formatDate } from '@/utils/format'
import { Star, ShoppingCart, Download, ShieldCheck, FileText, CheckCircle2, ChevronRight, CornerDownRight, Tag, AlertTriangle, Heart, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function DocumentDetailPage() {
  const { id } = useParams()
  const { user } = useAuthStore()
  const { addToCart } = useCartStore()
  const { wishlistIds } = useWishlistStore()
  const navigate = useNavigate()

  const [doc, setDoc] = useState<any>(null)
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [addingToCart, setAddingToCart] = useState(false)
  const [addingToWishlist, setAddingToWishlist] = useState(false)
  const [isPurchased, setIsPurchased] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)

  const isStaff = ['admin', 'mod', 'accountant'].includes(user?.roleNames?.[0]?.toLowerCase() || '');

  const handleDeleteReview = async (reviewId: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa đánh giá này? Dữ liệu không thể khôi phục.')) return;
    try {
      await reviewsApi.deleteReview(reviewId);
      toast.success('Đã xóa đánh giá');
      fetchDocAndReviews();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err?.response?.data?.message || err.message));
    }
  }

  const handleDeleteReply = async (reviewId: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa phản hồi này?')) return;
    try {
      await reviewsApi.deleteReply(reviewId);
      toast.success('Đã xóa phản hồi');
      fetchDocAndReviews();
    } catch (err: any) {
      toast.error('Lỗi: ' + (err?.response?.data?.message || err.message));
    }
  }

  const fetchDocAndReviews = async () => {
    try {
      const [docRes, revRes] = await Promise.all([
        documentsApi.getDocumentById(id!),
        documentsApi.getReviews(id!).catch(() => ({ data: [] }))
      ])
      const docData = docRes.data || docRes;
      setDoc(docData)
      setReviews(revRes.data || revRes || [])

      // Check if purchased uses the backend provided flag
      setIsPurchased(!!docData.hasPurchased)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Lỗi khi tải tài liệu')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) fetchDocAndReviews()
  }, [id, user])

  useEffect(() => {
    if (id) {
      const viewedDocs = JSON.parse(localStorage.getItem('viewedDocs') || '[]')
      if (!viewedDocs.includes(id)) {
        documentsApi.incrementView(id).catch(console.error)
        viewedDocs.push(id)
        localStorage.setItem('viewedDocs', JSON.stringify(viewedDocs))
      }
    }
  }, [id])

  const handleDownloadFree = async () => {
    if (!user) return navigate('/login')
    const role = user.roleNames?.[0]?.toLowerCase() || '';
    if (['admin', 'mod', 'accountant'].includes(role)) return toast.error('Quản trị viên không tải tài liệu');
    if (isOwner) return toast.error('Bạn là chủ sở hữu, hãy xem file tại mục quản lý')

    setAddingToCart(true) // Dành riêng cho FE3, FE4 không có thì bỏ dòng này
    try {
      const res = await libraryApi.requestDownload(Number(id || doc.id))

      // Chỉ cần check res.downloadUrl, không cần rawUrl hay startsWith('http') nữa
      if (res.downloadUrl) {
        window.open(res.downloadUrl, '_blank')
        toast.success(res.message || 'Bắt đầu tải tài liệu')
      } else {
        toast.error('Đã xảy ra lỗi, không sinh được link.')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể tải tài liệu này')
    } finally {
      setAddingToCart?.(false) // Dành riêng cho FE3
    }
  }

  const handleAddToCart = async () => {
    if (!user) return navigate('/login')
    const role = user.roleNames?.[0]?.toLowerCase() || '';
    if (['admin', 'mod', 'accountant'].includes(role)) return toast.error('Quản trị viên không mua tài liệu');
    if (isOwner) return toast.error('Không thể mua tài liệu của chính mình')

    setAddingToCart(true)
    try {
      await addToCart(Number(id))
      toast.success('Đã thêm vào giỏ hàng')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể thêm vào giỏ')
    } finally {
      setAddingToCart(false)
    }
  }

  const handleToggleWishlist = async () => {
    if (!user) return navigate('/login')
    const role = user.roleNames?.[0]?.toLowerCase() || '';
    if (['admin', 'mod', 'accountant'].includes(role)) return toast.error('Quản trị viên không dùng chức năng này');
    setAddingToWishlist(true)
    try {
      await wishlistApi.toggleWishlist(Number(id))
      toast.success(isWishlisted ? 'Đã bỏ khỏi danh sách yêu thích' : 'Đã cập nhật danh sách yêu thích')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Lỗi khi cập nhật yêu thích')
    } finally {
      setAddingToWishlist(false)
    }
  }

  if (loading) return <div className="text-center py-24 text-muted-foreground">Đang tải...</div>
  if (!doc) return <div className="text-center py-24 text-muted-foreground">Không tìm thấy tài liệu</div>

  const isFree = !doc.price || doc.price === 0
  const isOwner = user?.customerId && Number(doc.sellerId || doc.seller_id || 0) === Number(user.customerId)
  const isWishlisted = doc.isWishlisted || wishlistIds.includes(Number(id))

  const ext = doc.file_extension || doc.fileExtension || 'N/A'
  const rating = doc.rating || 0
  const reviewCount = reviews.length || doc.reviewCount || doc.reviews?.length || 0

  const hasReviewed = !!doc.hasReviewed || reviews.some((r: any) => r.buyer && Number(r.buyer.id) === Number(user?.customerId))

  return (
    <div className="bg-background text-foreground">
      <div className="max-w-7xl mx-auto py-2">

        {/* Breadcrumb */}
        <nav className="flex items-center text-sm text-muted-foreground mb-6 font-medium">
          <Link to="/" className="hover:text-primary transition-colors">Trang chủ</Link>
          <ChevronRight className="w-4 h-4 mx-2" />
          <Link to="/documents" className="hover:text-primary transition-colors">Tài liệu</Link>
          <ChevronRight className="w-4 h-4 mx-2" />
          <span className="text-foreground line-clamp-1">{doc.categoryName || doc.categories?.name || 'Chuyên mục'}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Main Content (Left) */}
          <div className="lg:col-span-2 space-y-8">

            {/* Header info */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-primary/10 text-primary px-3 py-1 text-sm font-semibold rounded-full uppercase tracking-wide">
                  {doc.categoryName || doc.categories?.name || 'Tài liệu'}
                </span>
                <span className="bg-orange-100 text-orange-700 px-3 py-1 text-sm font-semibold rounded-full uppercase tracking-wide flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  {ext}
                </span>
              </div>
              <h1 className="text-3xl font-bold font-heading mb-4 text-foreground leading-tight">
                {doc.title}
              </h1>

              <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground mb-6">
                <div className="flex items-center gap-2">
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < Math.floor(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                    ))}
                  </div>
                  <span className="font-semibold text-foreground">{rating}</span>
                  <span>({reviewCount} đánh giá)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">Người bán:</span>
                  <span className="text-primary font-semibold">{doc.sellerName || doc.customer_profiles?.full_name || 'Người dùng'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-success" />
                  <span className="text-success font-medium">Đã kiểm duyệt</span>
                </div>
                <div>{doc.downloadCount || 0} lượt tải</div>
                <div>{doc.viewCount || 0} lượt xem</div>
              </div>

              {/* Preview Document */}
              <div className="w-full h-[800px] bg-card border border-border rounded-xl flex items-center justify-center mb-8 overflow-hidden shadow-sm">
                {doc.previewUrl && doc.previewUrl !== 'previews/placeholder.png' ? (
                  <object
                    data={`${import.meta.env.VITE_STORAGE_URL || '/api/storage'}/${doc.previewUrl}#toolbar=0&navpanes=0&view=FitH`}
                    type="application/pdf"
                    className="w-full h-full bg-muted"
                  >
                    <p className="text-muted-foreground p-4">Trình duyệt không hỗ trợ xem trực tiếp PDF.</p>
                  </object>
                ) : (
                  <div className="w-full h-full bg-linear-to-br from-blue-400 to-indigo-600 flex items-center justify-center relative group">
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>
                    <FileText className="w-24 h-24 text-white/90 group-hover:scale-110 transition-transform duration-300 relative z-10" />
                    <div className="absolute font-heading font-black text-white/20 text-9xl z-0 tracking-widest">{ext}</div>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">Mô tả tài liệu</h2>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line wrap-break-word w-full text-lg">
                  {doc.description || 'Chưa có mô tả chi tiết cho tài liệu này.'}
                </p>

                {(doc.tags || doc.document_tags) && (
                  <div className="mt-8 flex flex-wrap gap-2">
                    {(doc.tags || doc.document_tags || []).map((t: any, i: number) => (
                      <Link key={i} to={`/documents?tagId=${t.tag_id || t.id}`} className="bg-primary/10 text-primary-hover px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1 hover:bg-primary/20 transition-colors">
                        <Tag className="w-3.5 h-3.5" />
                        {typeof t === 'string' ? t : (t.tags?.tag_name || t.tag_name || 'tag')}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Reviews Section */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-bold mb-6">Đánh giá từ người mua</h2>

              {isPurchased && !isOwner && !hasReviewed && (
                <ReviewForm documentId={Number(id)} onSuccess={fetchDocAndReviews} />
              )}

              {isPurchased && !isOwner && hasReviewed && (
                <div className="mb-8 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                  <p className="text-primary font-medium text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Đánh giá của bạn đã được ghi nhận. Mỗi người dùng chỉ được đánh giá 1 lần cho mỗi tài liệu.
                  </p>
                </div>
              )}

              {reviews.length > 0 ? (
                <div className="space-y-6">
                  {reviews.map((rev: any) => {
                    const isMyReview = Number(rev.buyer?.id || rev.buyer_id) === Number(user?.customerId);
                    const canDeleteReview = isStaff || isMyReview;
                    const canDeleteReply = isStaff || isOwner;

                    return (
                      <div key={rev.review_id || rev.id} className="border-b border-border pb-6 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold flex items-center gap-2">
                            <div className="w-8 h-8 bg-primary/20 text-primary rounded-full flex items-center justify-center font-bold text-sm">
                              {rev.buyer?.name?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            {rev.buyer?.name || `Ẩn danh ${rev.buyer?.id || ''}`}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">{formatDate(rev.created_at || rev.createdAt)}</span>
                            {canDeleteReview && (
                              <button
                                onClick={() => handleDeleteReview(rev.review_id || rev.id)}
                                className="text-danger flex items-center gap-1 text-xs hover:bg-danger/10 px-2 py-1 rounded"
                                title="Xóa đánh giá"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Xóa
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex text-yellow-400 mb-3">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className={`w-4 h-4 ${i < rev.rating ? 'fill-current' : 'text-gray-300 fill-transparent'}`} />
                          ))}
                        </div>
                        <p className="text-foreground">{rev.comment}</p>

                        {/* Hiển thị phản hồi của người bán */}
                        {(rev.sellerReply || rev.seller_reply) ? (
                          <div className="mt-4 p-4 bg-muted/30 border border-border rounded-xl ml-4 relative">
                            <CornerDownRight className="absolute -left-5 top-4 w-4 h-4 text-muted-foreground" />
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold text-sm text-foreground flex items-center gap-1">
                                Phản hồi của người bán
                                {isOwner && <span className="ml-2 text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Bạn</span>}
                              </span>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground">{formatDate(rev.repliedAt || rev.replied_at)}</span>
                                {canDeleteReply && (
                                  <button
                                    onClick={() => handleDeleteReply(rev.review_id || rev.id)}
                                    className="text-danger flex items-center gap-1 text-xs hover:bg-danger/10 px-2 py-1 rounded"
                                    title="Xóa phản hồi"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Xóa phản hồi
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-foreground/90 whitespace-pre-line">{rev.sellerReply || rev.seller_reply}</p>
                          </div>
                        ) : (
                          isOwner && <SellerReplyForm reviewId={rev.review_id || rev.id} onSuccess={fetchDocAndReviews} />
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground">Chưa có đánh giá nào. {isPurchased ? 'Hãy là người đầu tiên đánh giá!' : 'Bạn cần mua tài liệu để đánh giá.'}</p>
              )}
            </div>

          </div>

          {/* Sticky Sidebar (Right) */}
          <div className="lg:col-span-1 border-border">
            <div className="sticky top-24 bg-card border border-border rounded-2xl p-6 shadow-xl">

              <div className="mb-6">
                <div className="flex items-end gap-3 mb-2">
                  <span className="text-3xl font-bold font-heading text-primary">{isFree ? 'Miễn phí' : formatPrice(doc.price)}</span>
                </div>
              </div>

              <div className="space-y-3 mb-8">
                {isOwner ? (
                  <div className="w-full py-4 bg-muted text-muted-foreground font-bold rounded-xl text-center shadow-inner">
                    Bạn là chủ sở hữu
                  </div>
                ) : (
                  <>
                    {isPurchased ? (
                      <button
                        onClick={handleDownloadFree} // Reuse download logic
                        disabled={addingToCart}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-success hover:bg-success/90 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg text-lg disabled:opacity-50"
                      >
                        <Download className="w-6 h-6" />
                        {addingToCart ? 'Đang tải...' : 'Tải Xuống (Đã sở hữu)'}
                      </button>
                    ) : (
                      <button
                        onClick={isFree ? handleDownloadFree : handleAddToCart}
                        disabled={addingToCart}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg text-lg disabled:opacity-50"
                      >
                        {isFree ? <Download className="w-6 h-6" /> : <ShoppingCart className="w-6 h-6" />}
                        {addingToCart ? (isFree ? 'Đang xử lý...' : 'Đang thêm...') : isFree ? 'Tải Xuống' : 'Thêm Giỏ Hàng'}
                      </button>
                    )}
                    <button
                      onClick={handleToggleWishlist}
                      disabled={addingToWishlist}
                      className={`w-full py-4 border-2 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-lg disabled:opacity-50 ${isWishlisted ? 'bg-red-50 border-red-500 text-red-500 hover:bg-red-100' : 'bg-white border-primary text-primary hover:bg-primary/5'}`}
                    >
                      <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-current' : ''}`} /> {addingToWishlist ? 'Đang xử lý...' : isWishlisted ? 'Đã Yêu Thích' : 'Yêu Thích'}
                    </button>
                  </>
                )}
              </div>

              <div className="border-t border-border pt-6">
                <h3 className="font-bold mb-4 text-foreground">Thông tin chi tiết</h3>
                <ul className="space-y-4 text-sm">
                  <li className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-2"><FileText className="w-4 h-4" /> Định dạng</span>
                    <span className="font-semibold uppercase">{ext}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-2"><FileText className="w-4 h-4" /> Số trang</span>
                    <span className="font-semibold">{doc.page_count || doc.pageCount || '?'} trang</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-2"><Download className="w-4 h-4" /> Dung lượng</span>
                    <span className="font-semibold">{formatFileSize(doc.file_size || doc.fileSize)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Đăng ngày</span>
                    <span className="font-semibold">{formatDate(doc.published_at || doc.publishedAt || doc.created_at || doc.createdAt)}</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 bg-primary/5 border border-primary/10 rounded-xl p-4 flex gap-4 items-start">
                <ShieldCheck className="w-6 h-6 text-primary shrink-0" />
                <div>
                  <h4 className="font-bold text-primary-hover text-sm mb-1">Cam kết từ StudyDocs</h4>
                  <p className="text-xs text-foreground/80 leading-relaxed mb-3">Nội dung đã được kiểm duyệt. Nhận lại toàn bộ tiền trực tiếp vào số dư nếu tài liệu có vấn đề hay sai mô tả.</p>
                  {!isOwner && user && (
                    <button
                      onClick={() => setShowReportModal(true)}
                      className="text-xs text-danger font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" /> Báo cáo tài liệu này
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
      {showReportModal && (
        <ReportModal
          documentId={Number(id)}
          documentTitle={doc.title}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  )
}
