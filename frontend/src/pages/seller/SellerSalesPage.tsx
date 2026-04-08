import { useState, useEffect } from 'react'
import { sellerApi } from '@/api/seller.api'
import { formatBalance, formatDate } from '@/utils/format'
import { TrendingUp, Clock, CheckCircle2, DollarSign } from 'lucide-react'
import SellerLayout from '@/components/layout/SellerLayout'

export default function SellerSalesPage() {
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    sellerApi.getSalesHistory()
      .then(res => setSales(res.data || res))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const totalEarnings = sales.reduce((sum, s) => sum + Number(s.sellerEarning || s.seller_earning || 0), 0)
  const totalOrders = sales.length

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
                  <p>Chưa có giao dịch bán hàng nào.</p>
                </td></tr>
              ) : sales.map((sale: any) => (
                <tr key={sale.id || sale.order_item_id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-4 font-medium text-foreground">#{sale.id || sale.order?.id}</td>
                  <td className="p-4 max-w-xs truncate font-medium" title={sale.document?.title}>{sale.document?.title}</td>
                  <td className="p-4 font-medium">{formatBalance(sale.unitPrice || sale.unit_price)}</td>
                  <td className="p-4 text-warning font-medium">-{formatBalance(sale.commissionFee || sale.commission_fee || 0)}</td>
                  <td className="p-4 font-bold text-success">+{formatBalance(sale.sellerEarning || sale.seller_earning || 0)}</td>
                  <td className="p-4">
                    {(sale.status === 'HELD' || sale.fund_status === 'HELD') ? (
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
      </div>
    </SellerLayout>
  )
}

