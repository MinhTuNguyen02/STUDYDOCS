import { useEffect, useState } from 'react'
import { adminApi } from '@/api/admin.api'
import { formatPrice, formatDateTime } from '@/utils/format'
import { ShieldAlert, CheckCircle2, XCircle, Search, MessageSquare, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/common/Pagination'

interface Dispute {
  id: number
  order_item_id: number
  customer_id: number
  reason: string
  description: string
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'REJECTED'
  resolution: string | null
  created_at: string
  resolved_at: string | null
  order_items: {
    unit_price: number
    documents: { title: string }
    orders: { order_id: number }
  }
  customer_profiles: {
    full_name: string
  }
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')

  // Modal State
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [resolutionNote, setResolutionNote] = useState('')

  useEffect(() => {
    fetchDisputes()
  }, [])

  const fetchDisputes = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getDisputes()
      setDisputes(res.data || res)
    } catch (error) {
      toast.error('Lỗi tải danh sách khiếu nại')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = async (dispute: Dispute) => {
    setSelectedDispute(dispute)
    setResolutionNote(dispute.resolution || '')
    setIsModalOpen(true)

    // Nếu đang là OPEN thì tự động chuyển sang INVESTIGATING khi click vào xem
    if (dispute.status === 'OPEN') {
      try {
        await adminApi.analyzeDispute(dispute.id);
        fetchDisputes(); // refresh to show INVESTIGATING
      } catch (e) {
        // Ignore analyze failure
      }
    }
  }

  const handleResolve = async (actionStatus: 'RESOLVED' | 'REJECTED') => {
    if (!selectedDispute) return
    if (!resolutionNote.trim()) {
      toast.error('Vui lòng nhập ghi chú kết quả/giải pháp')
      return
    }

    try {
      await adminApi.resolveDispute(selectedDispute.id, {
        status: actionStatus,
        resolution: resolutionNote
      })
      toast.success(actionStatus === 'RESOLVED' ? 'Đã hoàn tiền và đóng khiếu nại' : 'Đã từ chối khiếu nại')
      setIsModalOpen(false)
      fetchDisputes()
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Có lỗi xảy ra')
    }
  }

  const filteredDisputes = disputes.filter(d => {
    const matchesSearch = d.reason.toLowerCase().includes(search.toLowerCase()) ||
      d.customer_profiles?.full_name.toLowerCase().includes(search.toLowerCase()) ||
      d.order_items?.documents?.title.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = filterStatus === 'ALL' || d.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const { page, setPage, totalPages, total, limit, paginatedItems } = usePagination(filteredDisputes);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN': return <span className="px-2 py-1 bg-yellow-500/10 text-yellow-600 rounded-md text-xs font-bold border border-yellow-500/20">CHỜ XỬ LÝ</span>
      case 'INVESTIGATING': return <span className="px-2 py-1 bg-blue-500/10 text-blue-600 rounded-md text-xs font-bold border border-blue-500/20">ĐANG ĐIỀU TRA</span>
      case 'RESOLVED': return <span className="px-2 py-1 bg-success/10 text-success rounded-md text-xs font-bold border border-success/20">CHẤP NHẬN HOÀN TIỀN</span>
      case 'REJECTED': return <span className="px-2 py-1 bg-danger/10 text-danger rounded-md text-xs font-bold border border-danger/20">TỪ CHỐI</span>
      default: return <span className="px-2 py-1 bg-muted rounded-md text-xs font-bold">{status}</span>
    }
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-orange-500" /> Quản lý Khiếu nại
          </h1>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-border rounded-xl bg-background text-sm outline-none"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="OPEN">Chờ xử lý</option>
            <option value="INVESTIGATING">Đang điều tra</option>
            <option value="RESOLVED">Chấp nhận</option>
            <option value="REJECTED">Từ chối</option>
          </select>

          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm theo user, tài liệu..."
              className="w-full pl-9 pr-4 py-2 border border-border rounded-xl bg-background focus:ring-2 focus:ring-primary/20 outline-none text-sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="text-center py-24 text-muted-foreground animate-pulse">Đang tải danh sách khiếu nại...</div>
        ) : filteredDisputes.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <ShieldAlert className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            Không có khiếu nại nào.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground font-semibold uppercase text-xs">
                  <tr>
                    <th className="px-6 py-4">Mã KN</th>
                    <th className="px-6 py-4">Người khiếu nại</th>
                    <th className="px-6 py-4">Tài liệu / Giá trị</th>
                    <th className="px-6 py-4">Lý do</th>
                    <th className="px-6 py-4">Trạng thái</th>
                    <th className="px-6 py-4 text-right">Ngày gửi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedItems.map((dispute) => (
                    <tr
                      key={dispute.id}
                      onClick={() => handleOpenModal(dispute)}
                      className="hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 font-bold">#{dispute.id}</td>
                      <td className="px-6 py-4 font-medium">{dispute.customer_profiles?.full_name || 'Khách ẩn danh'}</td>
                      <td className="px-6 py-4">
                        <div className="font-semibold">{dispute.order_items?.documents?.title}</div>
                        <div className="text-xs text-danger font-mono mt-1">{formatPrice(dispute.order_items?.unit_price * 1 || 0)}</div>
                      </td>
                      <td className="px-6 py-4 text-orange-600 font-semibold">{dispute.reason}</td>
                      <td className="px-6 py-4">{getStatusBadge(dispute.status)}</td>
                      <td className="px-6 py-4 text-right text-muted-foreground text-xs">
                        {formatDateTime(dispute.created_at)}
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

      {isModalOpen && selectedDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
              <h3 className="text-xl font-bold font-heading flex items-center gap-2">
                Chi tiết Khiếu nại #{selectedDispute.id}
                <span className="ml-2">{getStatusBadge(selectedDispute.status)}</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                Đóng
              </button>
            </div>

            <div className="p-6 space-y-6">

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/30 p-4 rounded-xl border border-border">
                  <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">Người khiếu nại</p>
                  <p className="font-bold">{selectedDispute.customer_profiles?.full_name}</p>
                </div>
                <div className="bg-muted/30 p-4 rounded-xl border border-border">
                  <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">Mã Order Item</p>
                  <p className="font-bold font-mono">#{selectedDispute.order_item_id}</p>
                </div>
                <div className="col-span-2 bg-muted/30 p-4 rounded-xl border border-border">
                  <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">Tài liệu đang tranh chấp</p>
                  <div className="flex justify-between items-center">
                    <p className="font-bold text-primary">{selectedDispute.order_items?.documents?.title}</p>
                    <p className="font-mono text-danger font-bold">{formatPrice(selectedDispute.order_items?.unit_price)}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="font-semibold mb-2 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-500" /> Lý do & Mô tả từ người dùng:
                </p>
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 text-orange-900">
                  <p className="font-bold mb-1">{selectedDispute.reason}</p>
                  <p className="text-sm opacity-90 whitespace-pre-wrap">{selectedDispute.description}</p>
                </div>
              </div>

              {/* Resolution Form */}
              <div className="border-t border-border pt-6">
                <label className="font-semibold mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  Ghi chú Giải quyết / Phán quyết của BQT: <span className="text-danger">*</span>
                </label>
                <textarea
                  value={resolutionNote}
                  onChange={e => setResolutionNote(e.target.value)}
                  disabled={selectedDispute.status === 'RESOLVED' || selectedDispute.status === 'REJECTED'}
                  className="w-full px-4 py-3 border border-border rounded-xl bg-background focus:ring-2 focus:ring-primary/20 outline-none text-sm min-h-[100px] resize-none disabled:bg-muted disabled:opacity-70"
                  placeholder="Nhập lý do hoàn tiền hoặc lý do từ chối khiếu nại..."
                />
              </div>

            </div>

            <div className="p-4 border-t border-border bg-muted/30 flex gap-3 justify-end">
              {(selectedDispute.status === 'OPEN' || selectedDispute.status === 'INVESTIGATING') ? (
                <>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl bg-background border border-border hover:bg-muted font-bold transition">
                    Thoát
                  </button>
                  <button onClick={() => handleResolve('REJECTED')} className="px-5 py-2.5 rounded-xl bg-danger hover:bg-red-600 text-white font-bold transition flex items-center gap-2">
                    <XCircle className="w-4 h-4" /> Từ chối KN
                  </button>
                  <button onClick={() => handleResolve('RESOLVED')} className="px-5 py-2.5 rounded-xl bg-success hover:bg-emerald-600 text-white font-bold transition flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Hoàn tiền (Resolve)
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold transition">
                  Đóng lại
                </button>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
