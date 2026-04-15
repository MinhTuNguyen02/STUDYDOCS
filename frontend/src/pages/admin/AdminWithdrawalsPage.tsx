import { useState, useEffect } from 'react';
import { adminApi } from '@/api/admin.api';
import toast from 'react-hot-toast';
import { ShieldCheck, XCircle } from 'lucide-react';
import { formatBalance, formatDate } from '@/utils/format';
import { usePagination } from '@/hooks/usePagination';
import Pagination from '@/components/common/Pagination';

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const fetchWithdrawals = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getWithdrawals();
      setWithdrawals(res.data || res);
    } catch (err) {
      toast.error('Lỗi tải danh sách yêu cầu rút tiền');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: number, status: 'PAID' | 'REJECTED') => {
    const note = status === 'REJECTED' ? prompt('Mời nhập lý do từ chối (bắt buộc):') : 'Duyệt tự động từ Admin Panel';
    if (status === 'REJECTED' && !note) return;

    try {
      await adminApi.processWithdrawal(id, { status, note: note || undefined });
      toast.success(status === 'PAID' ? 'Đã duyệt yêu cầu rút tiền' : 'Đã từ chối rút tiền');
      fetchWithdrawals();
    } catch (err) {
      toast.error('Có lỗi xảy ra khi xử lý');
    }
  };

  const filteredWithdrawals = withdrawals.filter(w => statusFilter === 'ALL' || w.status === statusFilter);
  const { page, setPage, totalPages, total, limit, paginatedItems } = usePagination(filteredWithdrawals);

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading">Quản lý Rút tiền</h1>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-background border border-border rounded-lg text-sm px-3 py-2 outline-none focus:border-primary min-w-[150px]"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PENDING">Chờ duyệt</option>
              <option value="PAID">Hoàn tất</option>
              <option value="REJECTED">Từ chối</option>
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

        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Đang tải...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-muted-foreground text-xs uppercase tracking-wider">
                    <th className="p-4 font-semibold">Tài khoản Yêu cầu</th>
                    <th className="p-4 font-semibold">Số tiền</th>
                    <th className="p-4 font-semibold">Ngân hàng</th>
                    <th className="p-4 font-semibold">Trạng thái</th>
                    <th className="p-4 font-semibold">Ngày tạo</th>
                    <th className="p-4 font-semibold text-right">Duyệt/Từ chối</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredWithdrawals.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Không có dữ liệu</td></tr>
                  ) : paginatedItems.map((w) => (
                    <tr key={w.id} className="hover:bg-muted/10">
                      <td className="p-4">
                        <div className="font-semibold text-sm">{w.accountName || w.user?.fullName}</div>
                      </td>
                      <td className="p-4 font-bold text-primary">{formatBalance(w.amount)}</td>
                      <td className="p-4 text-sm">
                        <p className="font-semibold">{w.bankName}</p>
                        <p className="text-muted-foreground">{w.accountNumber}</p>
                      </td>
                      <td className="p-4">
                        {w.status === 'PENDING' && <span className="bg-warning/10 text-warning px-2 py-1 rounded text-xs font-bold">Chờ duyệt</span>}
                        {w.status === 'PAID' && <span className="bg-success/10 text-success px-2 py-1 rounded text-xs font-bold">Hoàn tất</span>}
                        {w.status === 'REJECTED' && <span className="bg-danger/10 text-danger px-2 py-1 rounded text-xs font-bold">Từ chối</span>}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{formatDate(w.createdAt)}</td>
                      <td className="p-4 text-right">
                        {w.status === 'PENDING' ? (
                          <div className="flex justify-end gap-2">
                            <button onClick={() => handleAction(w.id, 'PAID')} className="p-2 bg-success text-white rounded-lg hover:bg-success/90 cursor-pointer" title="Duyệt"><ShieldCheck className="w-4 h-4" /></button>
                            <button onClick={() => handleAction(w.id, 'REJECTED')} className="p-2 bg-danger/10 text-danger rounded-lg hover:bg-danger/20 cursor-pointer" title="Từ chối"><XCircle className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm italic">Đã xử lý</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} limit={limit} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
