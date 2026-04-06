import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCartStore } from '@/store/cartStore'
import { checkoutApi } from '@/api/checkout.api'
import { formatPrice } from '@/utils/format'
import { Trash2, ShoppingCart, FileText, WalletCards, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CartPage() {
  const { items, total, loading, fetchCart, removeFromCart, clearCart } = useCartStore()
  const [checkingOut, setCheckingOut] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetchCart()
  }, [fetchCart])

  const handleRemove = async (documentId: number) => {
    try {
      await removeFromCart(documentId)
      toast.success('Đã xóa khỏi giỏ hàng')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể xóa')
    }
  }

  const handleClear = async () => {
    if (!window.confirm('Bạn có chắc muốn xóa tất cả?')) return
    try {
      await clearCart()
      toast.success('Đã làm trống giỏ hàng')
    } catch (err) {
      toast.error('Lỗi khi làm trống giỏ hàng')
    }
  }

  const handleTopup = async (amount: number) => {
    try {
      const res = await checkoutApi.topupWallet(amount)
      if (res.paymentUrl) {
        window.location.href = res.paymentUrl
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Lỗi khi tạo giao dịch nạp tiền')
    }
  }

  const handleCheckout = async () => {
    if (items.length === 0) return
    setCheckingOut(true)
    try {
      const documentIds = items.map(i => i.document.id)
      const res = await checkoutApi.createOrder(documentIds)

      toast.success('Thanh toán thành công!')
      await fetchCart() // sync fresh state
      navigate(`/orders/${res.orderId || ''}`)
    } catch (err: any) {
      const msg = err?.response?.data?.message
      if (msg && msg.includes('Số dư trong ví không đủ')) {
        toast.error('Số dư không đủ. Đang chuyển hướng nạp tiền...')
        setTimeout(() => handleTopup(total), 1500)
      } else {
        toast.error(msg || 'Thanh toán thất bại')
      }
    } finally {
      setCheckingOut(false)
    }
  }

  if (loading && items.length === 0) {
    return <div className="text-center py-24 text-muted-foreground">Đang tải giỏ hàng...</div>
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-24 bg-card border border-border rounded-2xl shadow-sm max-w-3xl mx-auto mt-8">
        <ShoppingCart className="w-20 h-20 text-muted-foreground/30 mx-auto mb-6" />
        <h2 className="text-2xl font-bold mb-4">Giỏ hàng rỗng</h2>
        <p className="text-muted-foreground mb-8">Chưa có tài liệu nào trong giỏ hàng của bạn.</p>
        <Link to="/documents" className="bg-primary text-white font-medium px-8 py-3 rounded-lg hover:bg-primary-hover transition-colors shadow-sm inline-flex items-center gap-2">
          <FileText className="w-5 h-5" /> Khám phá tài liệu
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-heading">Giỏ hàng của bạn</h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* ── Cart Items List (Left - 70%) ── */}
        <div className="flex-1 space-y-4">
          <div className="flex justify-between items-center bg-card p-4 rounded-xl border border-border shadow-sm">
            <span className="font-semibold">{items.length} sản phẩm</span>
            <button
              onClick={handleClear}
              className="text-destructive hover:bg-destructive/10 px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-semibold transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Xóa tất cả
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {items.map(item => (
              <div key={item.cart_item_id} className="flex gap-6 p-6 bg-card rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow group">
                <div className="w-24 h-32 bg-linear-to-br from-primary/20 to-primary/10 rounded-lg flex items-center justify-center shrink-0 border border-primary/20 relative overflow-hidden">
                  <FileText className="w-10 h-10 text-primary opacity-50" />
                  <div className="absolute bottom-0 w-full bg-black/40 text-white text-center text-xs py-1 font-bold tracking-widest uppercase">
                    {item.document.fileExtension || item.document.file_extension || 'DOC'}
                  </div>
                </div>
                <div className="flex-1 flex flex-col min-w-0">
                  <Link to={`/documents/${item.document.id}`} className="text-xl font-semibold text-foreground hover:text-primary transition-colors mb-2 line-clamp-2">
                    {item.document.title}
                  </Link>
                  <div className="text-muted-foreground text-sm mb-4">
                    Tác giả: <span className="font-medium text-foreground">{item.document.sellerName || (item.document as any).customer_profiles?.full_name || 'Người dùng'}</span>
                  </div>
                  <div className="mt-auto flex items-end justify-between">
                    <div className="font-bold text-primary text-2xl tracking-tight">
                      {formatPrice(item.document.price)}
                    </div>
                    <button
                      onClick={() => handleRemove(item.document.id)}
                      className="p-2.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
                      title="Xóa khỏi giỏ"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Order Summary (Right - 30%) ── */}
        <div className="w-full lg:w-96 shrink-0">
          <div className="sticky top-24 bg-card p-8 rounded-2xl border border-border shadow-xl">
            <h2 className="text-xl font-bold mb-6 pb-4 border-b border-border text-foreground">Tóm tắt đơn hàng</h2>

            <div className="space-y-4 mb-6 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Số lượng tài liệu:</span>
                <span className="font-semibold text-foreground">{items.length}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Thuế & Phí:</span>
                <span className="font-semibold text-foreground">Đã bao gồm</span>
              </div>
            </div>

            <div className="pt-4 border-t border-border mb-8">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-foreground">Tổng thanh toán:</span>
                <span className="font-black text-3xl text-primary">{formatPrice(total)}</span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={checkingOut}
              className="w-full flex items-center justify-center gap-2 py-4 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg text-lg disabled:opacity-50"
            >
              <WalletCards className="w-6 h-6" />
              {checkingOut ? 'Đang xử lý...' : 'Thanh Toán Ngay'}
            </button>

            <div className="mt-6 flex items-start gap-3 bg-muted p-4 rounded-xl text-xs text-muted-foreground">
              <ShieldCheck className="w-8 h-8 text-success shrink-0" />
              <p className="leading-relaxed">Giao dịch an toàn. Tài liệu sẽ được mở khóa ngay lập tức sau khi thanh toán thành công.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
