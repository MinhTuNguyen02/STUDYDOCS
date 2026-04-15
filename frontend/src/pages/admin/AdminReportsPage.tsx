import { useState, useEffect } from 'react';
import { adminApi } from '@/api/admin.api';
import toast from 'react-hot-toast';
import { AlertOctagon, CheckCircle } from 'lucide-react';
import { formatDate } from '@/utils/format';
import { usePagination } from '@/hooks/usePagination';
import Pagination from '@/components/common/Pagination';

export default function AdminReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getReports();
      setReports(res.data || res);
    } catch (err) {
      // Silent error handler cho các API chưa setup triệt để The backend
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports.filter(r => statusFilter === 'ALL' || r.status === statusFilter);
  const { page, setPage, totalPages, total, limit, paginatedItems } = usePagination(filteredReports);

  const handleResolve = async (id: number) => {
    try {
      await adminApi.resolveReport(id, { status: 'RESOLVED' });
      toast.success('Đã xử lý báo cáo');
      fetchReports();
    } catch (err) {
      toast.error('Lỗi khi xử lý');
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <h1 className="text-2xl font-bold font-heading">Chi tiết Báo cáo</h1>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-background border border-border rounded-lg text-sm px-3 py-2 outline-none focus:border-primary min-w-[150px]"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PENDING">Đang chờ</option>
              <option value="RESOLVED">Đã giải quyết</option>
            </select>
            
            {statusFilter !== 'ALL' && (
              <button
                onClick={() => setStatusFilter('ALL')}
                className="text-sm px-3 py-2 text-muted-foreground hover:text-foreground transition-colors outline-none border border-transparent hover:border-border rounded-lg bg-transparent hover:bg-muted"
                title="Xóa bộ lọc"
              >
                Xóa lọc
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-muted/20 text-muted-foreground text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold">Ngày tạo</th>
                <th className="p-4 font-semibold">Người gửi</th>
                <th className="p-4 font-semibold">Lý do</th>
                <th className="p-4 font-semibold">Tài liệu</th>
                <th className="p-4 font-semibold">Trạng thái</th>
                <th className="p-4 font-semibold">Xử lý</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredReports.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Không có dữ liệu</td></tr>
              ) : paginatedItems.map((rep) => (
                <tr key={rep.report_id} className="hover:bg-muted/10">
                  <td className="p-4 text-sm text-muted-foreground">{formatDate(rep.created_at)}</td>
                  <td className="p-4 text-sm">
                    <p className="font-semibold text-primary">{rep.customer_profiles?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{rep.customer_profiles?.accounts?.email}</p>
                  </td>
                  <td className="p-4 text-sm">
                    <p className="font-semibold text-danger">{rep.type}</p>
                    <p className="text-muted-foreground">{rep.reason}</p>
                  </td>
                  <td className="p-4 text-sm font-semibold text-primary" title={`ID: ${rep.document_id}`}>
                    {rep.documents?.title || `Tài liệu ID: ${rep.document_id}`}
                  </td>
                  <td className="p-4 text-sm font-bold">{rep.status}</td>
                  <td className="p-4">
                    <button onClick={() => handleResolve(rep.report_id)} className="p-2 bg-success/10 text-success rounded-lg hover:bg-success/20 cursor-pointer" disabled={rep.status === 'RESOLVED'}>
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} limit={limit} onPageChange={setPage} />
      </div>
    </div>
  );
}
