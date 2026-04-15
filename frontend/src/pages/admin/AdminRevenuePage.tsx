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
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
            <LineChart className="w-6 h-6 text-primary" /> Báo cáo Doanh thu Hệ thống
          </h1>
        </div>
      </div>

      {/* Filter and Export Container */}
      <div className="bg-card border border-border p-5 rounded-2xl shadow-sm mb-8 flex flex-col md:flex-row items-end justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Từ ngày</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Đến ngày</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
          </div>
          <button
            onClick={fetchRevenue}
            className="btn bg-primary text-white hover:bg-primary-hover px-6 py-2 rounded-xl text-sm font-semibold h-[38px] mt-auto shadow-sm"
          >
            Lọc dữ liệu
          </button>
        </div>

        <button
          onClick={handleExportCSV}
          className="btn bg-success text-white hover:bg-emerald-600 px-6 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 h-[38px] shrink-0 shadow-sm"
        >
          <Download className="w-4 h-4" /> Xuất Excel / CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-card border-l-4 border-l-success p-6 rounded-r-2xl border-y border-r border-border shadow-sm flex flex-col justify-center">
          <p className="text-sm text-muted-foreground font-semibold mb-1">Tổng thu (Credits)</p>
          <p className="text-3xl font-black font-heading text-success">{formatBalance(totalCredit)}</p>
        </div>
        <div className="bg-card border-l-4 border-l-danger p-6 rounded-r-2xl border-y border-r border-border shadow-sm flex flex-col justify-center">
          <p className="text-sm text-muted-foreground font-semibold mb-1">Tổng chi / Hoàn tiền (Debits)</p>
          <p className="text-3xl font-black font-heading text-danger">{formatBalance(totalDebit)}</p>
        </div>
        <div className="bg-primary/5 border border-primary/20 p-6 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm text-primary font-semibold mb-1 uppercase tracking-wide">Lợi Nhận Ròng (Net)</p>
            <p className="text-3xl font-black font-heading text-primary">{formatBalance(netRevenue)}</p>
          </div>
          <div className="p-4 bg-primary/10 rounded-full text-primary">
            <TrendingUp className="w-8 h-8" />
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
                <thead className="bg-muted text-muted-foreground font-semibold uppercase text-xs sticky top-0 z-10 shadow-sm leading-relaxed">
                  <tr>
                    <th className="px-6 py-4">Thời gian</th>
                    <th className="px-6 py-4">Mã Giao Dịch</th>
                    <th className="px-6 py-4">Mô tả</th>
                    <th className="px-6 py-4 text-right text-success border-x border-border">Thu (+)</th>
                    <th className="px-6 py-4 text-right text-danger border-r border-border rounded-tr-2xl">Chi (-)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedItems.map((item) => (
                    <tr key={item.entry_id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 text-muted-foreground text-xs whitespace-nowrap">
                        {formatDateTime(item.created_at)}
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-xs">TXN-{item.transaction_id}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold">{item.ledger_transactions.transaction_type}</span>
                          <span className="text-xs text-muted-foreground mt-0.5">{item.ledger_transactions.description}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-success border-x border-border/50">
                        {Number(item.credit_amount) > 0 ? `+${formatBalance(item.credit_amount)}` : '—'}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-danger border-r border-border/50">
                        {Number(item.debit_amount) > 0 ? `-${formatBalance(item.debit_amount)}` : '—'}
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
  )
}
