import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ordersApi } from '@/api/orders.api'
import { formatPrice, formatDate } from '@/utils/format'
import { Package, Clock, CheckCircle2, XCircle, AlertCircle, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      const res = await ordersApi.getOrders()
      setOrders(res.data || res || [])
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể tải lịch sử đơn hàng')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <span className="bg-success/10 text-success px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1 w-fit"><CheckCircle2 className="w-3.5 h-3.5" /> Đã thanh toán</span>
      case 'PENDING_PAYMENT':
        return <span className="bg-warning/10 text-warning px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1 w-fit"><Clock className="w-3.5 h-3.5" /> Chờ thanh toán</span>
      case 'CANCELLED':
        return <span className="bg-danger/10 text-danger px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1 w-fit"><XCircle className="w-3.5 h-3.5" /> Đã hủy</span>
      case 'REFUNDED':
        return <span className="bg-info/10 text-info px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1 w-fit"><AlertCircle className="w-3.5 h-3.5" /> Đã hoàn tiền</span>
      default:
        return <span className="bg-gray-100 text-gray-600 px-3 py-1 text-xs font-semibold rounded-full">{status}</span>
    }
  }

  if (loading) return <div className="py-24 text-center text-muted-foreground">Đang tải lịch sử đơn hàng...</div>

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-8">
        <Package className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold font-heading text-foreground">Lịch sử đơn hàng</h1>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-border shadow-sm">
          <Package className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Bạn chưa có đơn hàng nào</h3>
          <p className="text-muted-foreground mb-6">Hãy khám phá các tài liệu hữu ích trên hệ thống.</p>
          <Link to="/documents" className="btn btn-primary inline-flex">Khám phá ngay</Link>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted text-muted-foreground text-sm border-b border-border">
                  <th className="p-4 font-semibold">Mã Đơn</th>
                  <th className="p-4 font-semibold">Ngày tạo</th>
                  <th className="p-4 font-semibold">Tổng tiền</th>
                  <th className="p-4 font-semibold">Trạng thái</th>
                  <th className="p-4 font-semibold text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => (
                  <tr key={order.order_id || order.id} className="hover:bg-muted/50 transition-colors">
                    <td className="p-4 font-medium text-foreground">
                      #{order.order_id || order.id}
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {formatDate(order.created_at || order.createdAt)}
                    </td>
                    <td className="p-4 font-bold text-primary">
                      {formatPrice(order.total_amount || order.totalAmount)}
                    </td>
                    <td className="p-4">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="p-4 text-right">
                      <Link 
                        to={`/orders/${order.order_id || order.id}`}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg transition-colors font-medium text-sm"
                      >
                        <Eye className="w-4 h-4" /> Xem
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
