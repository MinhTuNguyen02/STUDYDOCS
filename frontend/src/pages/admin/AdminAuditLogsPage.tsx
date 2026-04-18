import { useEffect, useState } from 'react'
import { adminApi } from '@/api/admin.api'
import { Activity, Search, ChevronRight, FileJson } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDateTime, formatDateTimeSec } from '@/utils/format'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/common/Pagination'

interface AuditLog {
  log_id: number
  account_id: number
  action: string
  target_id: number
  target_table: string
  old_value: any
  new_value: any
  created_at: string
  accounts: {
    email: string
  }
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchEmail, setSearchEmail] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  // View Details Modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      // In a real scenario, we might pass searchEmail instead of userId if API supports it.
      // We will just filter on frontend if backend doesn't support email search directly.
      const res = await adminApi.getAuditLogs({ action: actionFilter || undefined, limit })
      setLogs(res.data || res)
    } catch (error) {
      toast.error('Lỗi tải nhật ký hệ thống')
    } finally {
      setLoading(false)
    }
  }

  const handleApplyFilter = () => {
    fetchLogs()
  }

  const filteredLogs = logs.filter(log => {
    if (!searchEmail.trim()) return true
    return log.accounts?.email?.toLowerCase().includes(searchEmail.toLowerCase())
  })

  const { page, setPage, totalPages, total, limit, paginatedItems } = usePagination(filteredLogs, 20);

  // Helper cho JSON highlight
  const renderJson = (data: any) => {
    if (!data) return <span className="text-muted-foreground italic">Không có dữ liệu</span>
    return (
      <pre className="text-[11px] font-mono whitespace-pre-wrap leading-relaxed text-foreground/80 wrap-break-word">
        {JSON.stringify(data, null, 2)}
      </pre>
    )
  }

  const getActionBadge = (action: string) => {
    if (action.includes('CREATE') || action.includes('INSERT')) return 'bg-success/10 text-success border-success/20'
    if (action.includes('UPDATE') || action.includes('EDIT')) return 'bg-blue-500/10 text-blue-600 border-blue-500/20'
    if (action.includes('DELETE') || action.includes('REMOVE')) return 'bg-danger/10 text-danger border-danger/20'
    if (action.includes('APPROVE')) return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
    if (action.includes('REJECT')) return 'bg-orange-500/10 text-orange-600 border-orange-500/20'
    return 'bg-muted text-muted-foreground border-border'
  }

  return (
    <div className="pb-10">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" /> Nhật ký Hệ thống
          </h1>
        </div>
      </div>

      {/* ── Filter ── */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm mb-6 flex flex-wrap items-center gap-4 w-full">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchEmail}
            onChange={e => setSearchEmail(e.target.value)}
            placeholder="Tìm theo email người thực hiện..."
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="w-full md:w-auto">
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Mọi hành động (Tất cả)</option>
            <option value="APPROVE_DOCUMENT">Duyệt tài liệu</option>
            <option value="REJECT_DOCUMENT">Từ chối tài liệu</option>
            <option value="PROCESS_WITHDRAWAL">Xử lý rút tiền</option>
            <option value="RESOLVE_DISPUTE">Xử lý khiếu nại</option>
            <option value="UPDATE_SYSTEM_CONFIG">Sửa cấu hình</option>
            <option value="TOGGLE_USER_STATUS">Khoá tài khoản</option>
          </select>
        </div>
        <div className="w-full md:w-auto">
          <select
            value={limit}
            // onChange={e => setLimit(Number(e.target.value))}
            className="w-full px-4 py-2 bg-background border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value={50}>50 dòng gần nhất</option>
            <option value={100}>100 dòng gần nhất</option>
            <option value={500}>500 dòng gần nhất</option>
          </select>
        </div>
        <button
          onClick={handleApplyFilter}
          className="btn bg-primary text-white hover:bg-primary-hover px-6 py-2 rounded-xl text-sm font-semibold shadow-sm w-full md:w-auto"
        >
          Truy xuất
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-muted-foreground animate-pulse">Đang nạp dữ liệu phân tích...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">Không tìm thấy bản ghi Audit Log nào.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                  <tr>
                    <th className="px-6 py-4 rounded-tl-2xl w-[15%]">TG Thực hiện</th>
                    <th className="px-6 py-4 w-[20%]">Tác nhân</th>
                    <th className="px-6 py-4 w-[25%]">Hành động</th>
                    <th className="px-6 py-4 w-[25%]">Mục tiêu</th>
                    <th className="px-6 py-4 text-right rounded-tr-2xl w-[15%]">Tra soát</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedItems.map(log => (
                    <tr key={log.log_id} className="hover:bg-muted/30 transition-colors group cursor-pointer" onClick={() => setSelectedLog(log)}>
                      <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                        {formatDateTimeSec(log.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-primary">{log.accounts?.email || 'System'}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">UID: {log.account_id}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold border uppercase tracking-wider ${getActionBadge(log.action)}`}>
                          {log.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">[{log.target_table}]</span>
                          <span className="font-semibold">ID: {log.target_id}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors group-hover:translate-x-1 duration-200">
                          <ChevronRight className="w-5 h-5" />
                        </button>
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

      {/* JSON Viewer Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-4xl rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30 shrink-0">
              <h3 className="text-lg font-bold font-heading flex items-center gap-2">
                <FileJson className="w-5 h-5 text-primary" />
                Chi tiết Bản ghi (Log ID: {selectedLog.log_id})
              </h3>
              <button onClick={() => setSelectedLog(null)} className="text-muted-foreground hover:text-foreground">
                Đóng
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/40 p-4 rounded-xl border border-border">
                  <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Thời gian</p>
                  <p className="font-mono text-sm">{formatDateTimeSec(selectedLog.created_at)}</p>
                </div>
                <div className="bg-muted/40 p-4 rounded-xl border border-border">
                  <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Tác nhân</p>
                  <p className="font-semibold text-sm">{selectedLog.accounts?.email}</p>
                </div>
                <div className="bg-muted/40 p-4 rounded-xl border border-border">
                  <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Hành động</p>
                  <p className="font-bold text-sm text-primary">{selectedLog.action}</p>
                </div>
                <div className="bg-muted/40 p-4 rounded-xl border border-border">
                  <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Mục tiêu (Target)</p>
                  <p className="font-mono text-sm">{selectedLog.target_table} ({selectedLog.target_id})</p>
                </div>
              </div>

              {/* User Friendly Diff Table */}
              <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden mt-6">
                <div className="p-4 border-b border-border bg-muted/30">
                  <h4 className="font-bold text-sm flex items-center gap-2">
                    <FileJson className="w-4 h-4 text-primary" /> Phân tích dữ liệu thay đổi
                  </h4>
                </div>
                {(() => {
                  const oldVal = selectedLog.old_value || {};
                  const newVal = selectedLog.new_value || {};
                  const isOldObj = typeof oldVal === 'object' && oldVal !== null && !Array.isArray(oldVal);
                  const isNewObj = typeof newVal === 'object' && newVal !== null && !Array.isArray(newVal);

                  if (!isOldObj && !isNewObj) {
                    return (
                      <div className="p-6 grid grid-cols-2 gap-6">
                        <div>
                          <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Giá trị trước đó</p>
                          <div className="p-4 bg-muted/30 rounded-lg whitespace-pre-wrap">{String(oldVal)}</div>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Giá trị cập nhật</p>
                          <div className="p-4 bg-primary/5 text-primary font-medium rounded-lg whitespace-pre-wrap">{String(newVal)}</div>
                        </div>
                      </div>
                    );
                  }

                  const keys = Array.from(new Set([...Object.keys(oldVal), ...Object.keys(newVal)]));
                  if (keys.length === 0) return <p className="text-muted-foreground p-8 text-center">Không có dữ liệu chi tiết.</p>;

                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground font-semibold text-xs border-b border-border uppercase tracking-wider">
                          <tr>
                            <th className="px-6 py-4 w-[30%]">Trường Dữ liệu</th>
                            <th className="px-6 py-4 w-[35%]">Trạng thái Cũ</th>
                            <th className="px-6 py-4 w-[35%]">Trạng thái Mới</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {keys.map(k => {
                            const oldD = oldVal[k];
                            const newD = newVal[k];
                            const isChanged = JSON.stringify(oldD) !== JSON.stringify(newD);

                            const formatD = (d: any) => {
                              if (d === null || d === undefined || d === '') return <span className="text-muted-foreground italic">Trống</span>;
                              if (typeof d === 'boolean') return d ? 'Có / Bật' : 'Không / Tắt';
                              if (typeof d === 'object') return <span className="font-mono text-[11px]">{JSON.stringify(d)}</span>;
                              if (k.toLowerCase().includes('time') || k.toLowerCase().includes('date') || k.toLowerCase().includes('_at')) {
                                const date = new Date(d);
                                if (!isNaN(date.getTime())) return formatDateTime(date);
                              }
                              return String(d);
                            };

                            return (
                              <tr key={k} className={`hover:bg-muted/30 transition-colors ${isChanged ? 'bg-primary/5' : ''}`}>
                                <td className="px-6 py-4 font-mono font-bold text-foreground text-[13px]">{k}</td>
                                <td className={`px-6 py-4 ${isChanged && oldD !== undefined ? 'text-danger line-through opacity-70 cursor-help' : 'text-muted-foreground'} `} title={String(oldD)}>
                                  {formatD(oldD)}
                                </td>
                                <td className={`px-6 py-4 ${isChanged ? 'text-success font-bold bg-success/5' : 'text-foreground'}`}>
                                  {formatD(newD)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  )
}
