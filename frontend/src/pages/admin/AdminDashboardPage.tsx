import { useEffect, useState } from 'react';
import { adminApi } from '@/api/admin.api';
import toast from 'react-hot-toast';
import { FileCheck, Files, ShoppingBag, Banknote, ArrowRight } from 'lucide-react';
import { formatBalance } from '@/utils/format';
import { Link } from 'react-router-dom';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getDashboardStats();
      setStats(res.data || res);
    } catch (err: any) {
      toast.error('Không thể tải dữ liệu Dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Đang tải dữ liệu...</div>;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Dashboard Tổng quan</h1>
          <p className="text-muted-foreground mt-1">Thông số hoạt động của hệ thống hôm nay.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-muted-foreground font-medium">Chờ kiểm duyệt</h3>
              <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <FileCheck className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-bold font-heading mb-1">{stats?.pendingApprovals || 0}</p>
            <Link to="/admin/approvals" className="text-sm text-primary font-medium flex items-center hover:underline mt-4">
              Xem chi tiết <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>

        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-success/10 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-muted-foreground font-medium">Tổng Tài liệu</h3>
              <div className="p-2 bg-success/10 rounded-xl text-success">
                <Files className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-bold font-heading mb-1">{stats?.totalDocuments || 0}</p>
            <p className="text-sm text-success font-medium flex items-center mt-4">
              Tài liệu đang hoạt động
            </p>
          </div>
        </div>

        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-warning/10 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-muted-foreground font-medium">Đơn hàng (Hôm nay)</h3>
              <div className="p-2 bg-warning/10 rounded-xl text-warning">
                <ShoppingBag className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-bold font-heading mb-1">{stats?.ordersToday || 0}</p>
            <p className="text-sm text-muted-foreground flex items-center mt-4">
              Giao dịch ghi nhận mới
            </p>
          </div>
        </div>

        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-danger/10 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-muted-foreground font-medium">Doanh thu (Hôm nay)</h3>
              <div className="p-2 bg-danger/10 rounded-xl text-danger">
                <Banknote className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-bold font-heading mb-1">{formatBalance(stats?.revenueToday || 0)}</p>
            <Link to="/admin/revenue" className="text-sm text-danger font-medium flex items-center hover:underline mt-4">
              Báo cáo chi tiết <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border p-6 rounded-2xl shadow-sm mt-8 text-center text-muted-foreground py-24">
        Biểu đồ hoạt động sẽ được tích hợp ở đây
      </div>
    </div>
  );
}
