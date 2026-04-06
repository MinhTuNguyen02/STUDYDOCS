import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ordersApi } from '@/api/orders.api'
import { libraryApi } from '@/api/library.api'
import DisputeModal from '@/components/common/DisputeModal'
import { formatPrice, formatDate } from '@/utils/format'
import { Package, Download, ChevronLeft, ShieldCheck, FileText, CheckCircle2, Clock, XCircle, AlertCircle, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function OrderDetailPage() {
  const { id } = useParams()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [disputeTarget, setDisputeTarget] = useState<any>(null)

  useEffect(() => {
    fetchOrderDetail()
  }, [id])

  const fetchOrderDetail = async () => {
    try {
      const res = await ordersApi.getOrderStatus(id!)
      setOrder(res.data || res)
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể tải chi tiết đơn hàng')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (documentId: number) => {
    try {
      const res = await libraryApi.getDownloadLink(documentId)
      const signedUrl = res.signedUrl || res.downloadUrl || res.data?.signedUrl || res.data?.downloadUrl
      if (signedUrl) {
        // signedUrl = "/files/download/..." → backend route là /api/files/download/...
        // Vite proxy /api → http://localhost:4000, nên mở window với /api + signedUrl
        const url = signedUrl.startsWith('http') ? signedUrl : `/api${signedUrl}`
        window.open(url, '_blank')
      } else {
        toast.error('Không tìm thấy link tải xuống')
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Lỗi khi tải file')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <span className="bg-success/10 text-success px-4 py-1.5 text-sm font-semibold rounded-full flex items-center gap-1.5 w-fit"><CheckCircle2 className="w-4 h-4" /> Đã thanh toán</span>
      case 'PENDING_PAYMENT':
        return <span className="bg-warning/10 text-warning px-4 py-1.5 text-sm font-semibold rounded-full flex items-center gap-1.5 w-fit"><Clock className="w-4 h-4" /> Chờ thanh toán</span>
      case 'CANCELLED':
        return <span className="bg-danger/10 text-danger px-4 py-1.5 text-sm font-semibold rounded-full flex items-center gap-1.5 w-fit"><XCircle className="w-4 h-4" /> Đã hủy</span>
      case 'REFUNDED':
        return <span className="bg-info/10 text-info px-4 py-1.5 text-sm font-semibold rounded-full flex items-center gap-1.5 w-fit"><AlertCircle className="w-4 h-4" /> Đã hoàn tiền</span>
      default:
        return <span className="bg-gray-100 text-gray-600 px-4 py-1.5 text-sm font-semibold rounded-full">{status}</span>
    }
  }

  if (loading) return <div className="py-24 text-center text-muted-foreground">Đang tải chi tiết đơn...</div>
  if (!order) return <div className="py-24 text-center text-muted-foreground">Không tìm thấy đơn hàng</div>

  const orderId = order.orderId || order.order_id || order.id
  const status = order.status || order.paymentStatus
  const items = order.items || order.order_items || []
  let totalAmount = 0
  if (order.totalAmount || order.total_amount) {
    totalAmount = order.totalAmount || order.total_amount
  } else if (items.length > 0) {
    totalAmount = items.reduce((sum: number, item: any) => sum + (item.unitPrice || item.unit_price || item.document?.price || 0), 0)
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Link to="/orders" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors font-medium mb-6">
        <ChevronLeft className="w-4 h-4" /> Quay lại lịch sử
      </Link>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden mb-8">
        <div className="p-6 md:p-8 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-heading flex items-center gap-3">
              <Package className="w-7 h-7 text-primary shrink-0" />
              Chi tiết đơn hàng #{orderId}
            </h1>
            <p className="text-muted-foreground mt-2 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {formatDate(order.created_at || order.createdAt || new Date().toISOString())}
            </p>
          </div>
          <div>
            {getStatusBadge(status)}
          </div>
        </div>

        <div className="p-6 md:p-8">
          <h3 className="font-semibold text-lg mb-4 text-foreground">Sản phẩm đã mua</h3>
          
          <div className="space-y-4">
            {items.map((item: any, index: number) => {
              const doc = item.document || item
              const ext = doc.file_extension || doc.fileExtension || 'DOC'
              return (
                <div key={index} className="flex gap-4 p-4 border border-border rounded-xl hover:shadow-md transition-shadow bg-background">
                  <div className="w-16 h-20 bg-linear-to-br from-primary/20 to-primary/10 rounded-lg flex items-center justify-center shrink-0 border border-primary/20 relative">
                    <FileText className="w-6 h-6 text-primary opacity-60" />
                  </div>
                  <div className="flex-1 flex flex-col justify-center min-w-0">
                    <Link to={`/documents/${doc.id || doc.document_id}`} className="text-lg font-bold text-foreground hover:text-primary transition-colors truncate">
                      {doc.title}
                    </Link>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span className="font-bold text-primary">{formatPrice(item.unitPrice || item.unit_price || doc.price || 0)}</span>
                      <span className="uppercase text-xs font-semibold px-2 py-0.5 bg-muted rounded-md">{ext}</span>
                    </div>
                  </div>
                  
                  {status === 'PAID' && (
                    <div className="flex items-center justify-end shrink-0 gap-2">
                      <button 
                        onClick={() => setDisputeTarget(item)}
                        className="p-3 bg-danger/10 text-danger hover:bg-danger hover:text-white rounded-xl transition-colors tooltip-trigger"
                        title="Khiếu nại / Hoàn tiền"
                      >
                        <AlertTriangle className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleDownload(doc.id || doc.document_id)}
                        className="p-3 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-xl transition-colors tooltip-trigger"
                        title="Tải xuống tài liệu"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-8 pt-6 border-t border-border flex justify-between items-center">
            <span className="text-lg font-medium text-foreground">Tổng thanh toán:</span>
            <span className="text-3xl font-bold font-heading text-primary">{formatPrice(totalAmount)}</span>
          </div>

          <div className="mt-6 p-4 bg-muted border border-border rounded-xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-success shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              Bạn có 48 giờ để đánh giá hoặc khiếu nại tài liệu này nếu nội dung không đúng với mô tả. Giao dịch được bảo vệ bởi StudyDocs.
            </p>
          </div>
        </div>
      </div>
      {disputeTarget && (
        <DisputeModal
          orderItemId={disputeTarget.id || disputeTarget.order_item_id}
          documentTitle={disputeTarget.document?.title || ''}
          onClose={() => setDisputeTarget(null)}
        />
      )}
    </div>
  )
}
