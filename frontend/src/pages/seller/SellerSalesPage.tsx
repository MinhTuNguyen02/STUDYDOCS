import { useState, useEffect } from 'react'
import { sellerApi } from '@/api/seller.api'
import { formatBalance, formatDate } from '@/utils/format'
import { TrendingUp, Clock, CheckCircle2, DollarSign, XCircle, Search, Filter } from 'lucide-react'
import SellerLayout from '@/components/layout/SellerLayout'

export default function SellerSalesPage() {
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [filter, setFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0 })
  const [totalEarnings, setTotalEarnings] = useState(0)
  const [totalOrders, setTotalOrders] = useState(0)

  // Trigger search on typing with debounce
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      fetchSales()
    }, 500)
    return () => clearTimeout(t)
  }, [search, filter, page])

  const fetchSales = async () => {
    setLoading(true)
    try {
      const res = await sellerApi.getSalesHistory({
        status: filter === 'ALL' ? undefined : filter,
        search,
        page,
        limit: 10
      })
      setSales(res.data || res)
      if (res.meta) setMeta(res.meta)
      if (res.totalEarnings !== undefined) setTotalEarnings(res.totalEarnings)
      if (res.totalOrders !== undefined) setTotalOrders(res.totalOrders)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }



  return (
    <SellerLayout>
      <h1 className="text-3xl font-bold font-heading flex items-center gap-3 mb-6">
        <TrendingUp className="w-8 h-8 text-primary" /> Lịch sử bán hàng
      </h1>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-success/10 text-success rounded-xl"><DollarSign className="w-6 h-6" /></div>
          <div>
            <p className="text-sm text-muted-foreground">Tổng thực nhận</p>
            <p className="text-2xl font-bold font-heading">{formatBalance(totalEarnings)}</p>
          </div>
        </div>
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-primary/10 text-primary rounded-xl"><TrendingUp className="w-6 h-6" /></div>
          <div>
            <p className="text-sm text-muted-foreground">Tổng đơn hàng</p>
            <p className="text-2xl font-bold font-heading">{totalOrders}</p>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 justify-between bg-muted/20">
          <div className="relative max-w-sm w-full">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm theo tên tài liệu..."
              className="w-full pl-10 pr-4 py-2 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-muted-foreground" />
            <select
              value={filter} onChange={(e) => setFilter(e.target.value)}
              className="px-4 py-2 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:outline-none bg-background font-medium"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="HELD">Tạm giữ</option>
              <option value="RELEASED">Đã cộng ví</option>
              <option value="REFUNDED">Bị hoàn tiền</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-muted text-muted-foreground text-xs uppercase tracking-wide">
                <th className="p-4 font-semibold">Mã Đơn</th>
                <th className="p-4 font-semibold">Tài liệu</th>
                <th className="p-4 font-semibold">Giá bán</th>
                <th className="p-4 font-semibold">Hoa hồng</th>
                <th className="p-4 font-semibold">Thực nhận</th>
                <th className="p-4 font-semibold">Trạng thái tiền</th>
                <th className="p-4 font-semibold">Ngày bán</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Đang tải...</td></tr>
              ) : sales.length === 0 ? (
                <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">
                  <TrendingUp className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p>{search ? 'Không tìm thấy đơn hàng khớp với bộ lọc.' : 'Chưa có giao dịch bán hàng nào.'}</p>
                </td></tr>
              ) : sales.map((sale: any) => (
                <tr key={sale.id || sale.order_item_id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-4 font-medium text-foreground">#{sale.id || sale.order?.id}</td>
                  <td className="p-4 max-w-xs truncate font-medium" title={sale.document?.title}>{sale.document?.title}</td>
                  <td className="p-4 font-medium">{formatBalance(sale.unitPrice || sale.unit_price)}</td>
                  <td className="p-4 text-warning font-medium">-{formatBalance(sale.commissionFee || sale.commission_fee || 0)}</td>
                  <td className="p-4 font-bold text-success">
                    {sale.status === 'REFUNDED' ? (
                      <span className="text-danger line-through opacity-70">+{formatBalance(sale.sellerEarning || sale.seller_earning || 0)}</span>
                    ) : (
                      `+${formatBalance(sale.sellerEarning || sale.seller_earning || 0)}`
                    )}
                  </td>
                  <td className="p-4">
                    {sale.status === 'REFUNDED' ? (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-danger bg-danger/10 px-2 py-1 rounded-md w-fit">
                        <XCircle className="w-3.5 h-3.5" /> Bị hoàn tiền
                      </span>
                    ) : (sale.status === 'HELD' || sale.fund_status === 'HELD') ? (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-warning bg-warning/10 px-2 py-1 rounded-md w-fit">
                        <Clock className="w-3.5 h-3.5" /> Tạm giữ
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-bold text-success bg-success/10 px-2 py-1 rounded-md w-fit">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Đã cộng ví
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-muted-foreground text-sm">{formatDate(sale.order?.created_at || sale.order?.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {meta.total > meta.limit && (
          <div className="p-4 border-t border-border flex justify-between items-center bg-muted/10">
            <span className="text-sm text-muted-foreground">
              Hiển thị tối đa {meta.limit} kết quả (Tổng cộng: {meta.total})
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 text-sm font-semibold bg-background border border-border rounded-lg disabled:opacity-50 hover:bg-muted"
              >
                Trang trước
              </button>
              <span className="px-3 py-1.5 text-sm font-semibold bg-background border border-border rounded-lg">
                Trang {page} / {Math.ceil(meta.total / meta.limit)}
              </span>
              <button
                disabled={page * meta.limit >= meta.total}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 text-sm font-semibold bg-background border border-border rounded-lg disabled:opacity-50 hover:bg-muted"
              >
                Trang sau
              </button>
            </div>
          </div>
        )}
      </div>
    </SellerLayout>
  )
}

