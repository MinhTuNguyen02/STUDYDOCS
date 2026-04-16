import { useEffect, useState } from 'react'
import { adminApi } from '@/api/admin.api'
import { formatBalance, formatDateTime, toVNDateString } from '@/utils/format'
import { LineChart, DollarSign, Calendar, Download, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/common/Pagination'

// Chống lỗi missing moment do import
interface RevenueEntry {
  entry_id: number
  wallet_id: number
  transaction_id: number
  debit_amount: string
  credit_amount: string
  created_at: string
  ledger_transactions: {
    transaction_type: string
    reference_type: string
    description: string
  }
}

export default function AdminRevenuePage() {
  const [data, setData] = useState<RevenueEntry[]>([])
  const [loading, setLoading] = useState(false)

  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return toVNDateString(d)
  })
  const [endDate, setEndDate] = useState(() => toVNDateString())

  useEffect(() => {
    fetchRevenue()
  }, [])

  const fetchRevenue = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getRevenueReport({ startDate, endDate })
      setData(res.data || res)
    } catch (error) {
      toast.error('Lỗi khi tải báo cáo doanh thu')
    } finally {
      setLoading(false)
    }
  }

  const handleExportCSV = () => {
    if (data.length === 0) {
      toast.error('Không có dữ liệu để xuất')
      return
    }

    const headers = ['Mã Giao Dịch', 'Thời Gian', 'Loại', 'Mô Tả', 'Thu Nhập (Credit)', 'Khấu Trừ (Debit)']

    const csvContent = [
      headers.join(','),
      ...data.map(item => {
        // Xử lý escape dấu ngoặc kép an toàn cho chuẩn CSV
        const safeDescription = item.ledger_transactions.description
          ? item.ledger_transactions.description.replace(/"/g, '""')
          : '';

        return [
          `TXN-${item.transaction_id}`,
          new Date(item.created_at).toISOString().replace('T', ' ').substring(0, 19),
          item.ledger_transactions.transaction_type,
          `"${safeDescription}"`, // Bọc chuỗi đã được escape an toàn
          Number(item.credit_amount),
          Number(item.debit_amount)
        ].join(',')
      })
    ].join('\n')

    // Download CSV
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `bao_cao_doanh_thu_${toVNDateString().replace(/-/g, '')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const totalCredit = data.reduce((acc, cur) => acc + Number(cur.credit_amount), 0)
  const totalDebit = data.reduce((acc, cur) => acc + Number(cur.debit_amount), 0)
  const netRevenue = totalCredit - totalDebit

  const { page, setPage, totalPages, total, limit, paginatedItems } = usePagination(data, 20);

  return (
    <div>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
            <LineChart className="w-7 h-7 text-primary" /> Báo cáo Doanh thu Hệ thống
          </h1>
        </div>
        <button
          onClick={handleExportCSV}
          className="btn bg-success text-white hover:bg-emerald-600 px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 h-[38px] shrink-0 shadow-sm transition-colors"
        >
          <Download className="w-4 h-4" /> Xuất CSV
        </button>
      </div>

      {/* Filter Container */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm mb-6 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Từ ngày</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-sm font-semibold outline-none cursor-pointer focus:border-primary"
            />
          </div>
        </div>
        <span className="text-muted-foreground font-bold pb-2">→</span>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Đến ngày</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-sm font-semibold outline-none cursor-pointer focus:border-primary"
            />
          </div>
        </div>
        <button
          onClick={fetchRevenue}
          className="btn bg-primary text-white hover:bg-primary-hover px-5 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors shadow-sm h-[38px]"
        >
          Lọc dữ liệu
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm relative overflow-hidden group">
          <div className="absolute -right-3 -top-3 w-20 h-20 bg-success/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <div className="relative z-10">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Tổng thu (Credits)</p>
            <p className="text-2xl font-black text-success">{formatBalance(totalCredit)}</p>
          </div>
        </div>
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm relative overflow-hidden group">
          <div className="absolute -right-3 -top-3 w-20 h-20 bg-danger/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <div className="relative z-10">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Tổng chi / Hoàn tiền (Debits)</p>
            <p className="text-2xl font-black text-danger">{formatBalance(totalDebit)}</p>
          </div>
        </div>
        <div className="bg-primary/5 border border-primary/20 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
          <div className="absolute -right-3 -top-3 w-20 h-20 bg-primary/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Lợi Nhận Ròng (Net)</p>
              <p className="text-2xl font-black text-primary">{formatBalance(netRevenue)}</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-full text-primary shrink-0 relative z-20">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border bg-muted/20">
          <h2 className="font-bold flex items-center gap-2"><DollarSign className="w-5 h-5 text-muted-foreground" /> Lịch sử Dòng tiền</h2>
        </div>
        {loading ? (
          <div className="text-center py-16 text-muted-foreground animate-pulse">Đang tải data từ Ledger...</div>
        ) : data.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">Không có dữ liệu trong khoảng thời gian này.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-4 font-semibold w-40">Thời gian</th>
                    <th className="p-4 font-semibold">Mã Giao Dịch</th>
                    <th className="p-4 font-semibold">Mô tả</th>
                    <th className="p-4 font-semibold text-right text-success">Thu (+)</th>
                    <th className="p-4 font-semibold text-right text-danger">Chi (-)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedItems.map((item) => {
                    const cr = Number(item.credit_amount);
                    const de = Number(item.debit_amount);
                    return (
                      <tr key={item.entry_id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-4 text-muted-foreground text-sm whitespace-nowrap">
                          {formatDateTime(item.created_at)}
                        </td>
                        <td className="p-4 font-mono font-bold text-sm">TXN-{item.transaction_id}</td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm">{item.ledger_transactions.transaction_type}</span>
                            <span className="text-xs text-muted-foreground mt-0.5">{item.ledger_transactions.description}</span>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          {cr > 0 ? <span className="font-bold text-success">+{formatBalance(cr)}</span> : <span className="text-muted-foreground/30">-</span>}
                        </td>
                        <td className="p-4 text-right">
                          {de > 0 ? <span className="font-bold text-danger">-{formatBalance(de)}</span> : <span className="text-muted-foreground/30">-</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} limit={limit} onPageChange={setPage} />
          </>
        )}
      </div>

    </div>
  )
}
