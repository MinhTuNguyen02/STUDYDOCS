import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { sellerApi } from '@/api/seller.api'
import { formatBalance } from '@/utils/format'
import { LayoutDashboard, TrendingUp, Download, Eye, FileText, Upload, DollarSign } from 'lucide-react'

export default function SellerDashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await sellerApi.getDashboardStats()
        setStats(res.data || res)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  if (loading) return <div className="py-24 text-center">Đang tải dữ liệu...</div>

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold font-heading flex items-center gap-3">
          <LayoutDashboard className="w-8 h-8 text-primary" /> Tổng quan Kênh Bán Hàng
        </h1>
        <Link to="/seller/documents/new" className="btn btn-primary inline-flex gap-2">
          <Upload className="w-5 h-5" /> Tải lên tài liệu
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-success/10 text-success rounded-xl"><DollarSign className="w-6 h-6" /></div>
            <h3 className="font-semibold text-muted-foreground">Doanh thu</h3>
          </div>
          <p className="text-3xl font-bold font-heading">{formatBalance(stats?.totalEarnings || stats?.total_earnings || 0)}</p>
        </div>
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-info/10 text-info rounded-xl"><Eye className="w-6 h-6" /></div>
            <h3 className="font-semibold text-muted-foreground">Lượt xem</h3>
          </div>
          <p className="text-3xl font-bold font-heading">{stats?.totalViews || stats?.total_views || 0}</p>
        </div>
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-primary/10 text-primary rounded-xl"><Download className="w-6 h-6" /></div>
            <h3 className="font-semibold text-muted-foreground">Lượt tải</h3>
          </div>
          <p className="text-3xl font-bold font-heading">{stats?.totalDownloads || stats?.total_downloads || 0}</p>
        </div>
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-warning/10 text-warning rounded-xl"><TrendingUp className="w-6 h-6" /></div>
            <h3 className="font-semibold text-muted-foreground">Đơn hàng</h3>
          </div>
          <p className="text-3xl font-bold font-heading">{stats?.totalOrders || stats?.total_orders || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Link to="/seller/documents" className="group bg-card border border-border hover:border-primary/50 p-6 rounded-2xl shadow-sm flex flex-col items-center justify-center min-h-[200px] transition-colors">
          <FileText className="w-12 h-12 text-muted-foreground group-hover:text-primary transition-colors mb-4" />
          <h2 className="text-xl font-bold">Quản lý Tài liệu</h2>
          <p className="text-muted-foreground text-center mt-2">Xem danh sách, sửa giá, và kiểm tra trạng thái duyệt tài liệu.</p>
        </Link>
        <Link to="/seller/sales" className="group bg-card border border-border hover:border-primary/50 p-6 rounded-2xl shadow-sm flex flex-col items-center justify-center min-h-[200px] transition-colors">
          <TrendingUp className="w-12 h-12 text-muted-foreground group-hover:text-primary transition-colors mb-4" />
          <h2 className="text-xl font-bold">Lịch sử Bán hàng</h2>
          <p className="text-muted-foreground text-center mt-2">Theo dõi đơn hàng, doanh thu và thời gian hold tiền.</p>
        </Link>
      </div>
    </div>
  )
}
