import { useEffect, useState } from 'react'
import { sellerApi } from '@/api/seller.api'
import { formatBalance } from '@/utils/format'
import {
  LayoutDashboard, TrendingUp, Download, Eye,
  DollarSign, CalendarDays, Award, BarChart2, ShoppingBag
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import SellerLayout from '@/components/layout/SellerLayout'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts'

type FilterMode = 'DAY' | 'MONTH' | 'YEAR'

// Format date as YYYY-MM-DD using LOCAL timezone (avoids UTC shift)
function localDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const now = new Date()
const todayStr = localDateStr(now)

function getFirstDayOfMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

function getLastDayOfMonth(year: number, month: number) {
  const d = new Date(year, month, 0) // day 0 of next month = last day of this month
  return localDateStr(d)
}

function buildRange(mode: FilterMode, year: number, month: number, fromDate: string, toDate: string) {
  let start: string
  let end: string
  if (mode === 'YEAR') {
    start = `${year}-01-01`
    end = year === now.getFullYear() ? todayStr : `${year}-12-31`
  } else if (mode === 'MONTH') {
    start = getFirstDayOfMonth(year, month)
    const lastDay = getLastDayOfMonth(year, month)
    end = lastDay > todayStr ? todayStr : lastDay
  } else {
    start = fromDate
    end = toDate > todayStr ? todayStr : toDate
  }
  return { start, end }
}

function buildFilterLabel(mode: FilterMode, year: number, month: number, fromDate: string, toDate: string) {
  if (mode === 'YEAR') return `Năm ${year}`
  if (mode === 'MONTH') return `Tháng ${month}/${year}`
  return `${fromDate.split('-').reverse().join('/')} → ${toDate.split('-').reverse().join('/')}`
}

function getHighlightMonths(mode: FilterMode, month: number, fromDate: string, toDate: string): number[] {
  if (mode === 'YEAR') return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  if (mode === 'MONTH') return [month]
  const months: number[] = []
  const s = new Date(fromDate)
  const e = new Date(toDate)
  let cur = new Date(s.getFullYear(), s.getMonth(), 1)
  while (cur <= e) {
    months.push(cur.getMonth() + 1)
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
  }
  return months
}

const currentYear = now.getFullYear()
const currentMonth = now.getMonth() + 1
const yearOptions = [2024, 2025, 2026, 2027].filter(y => y <= currentYear)

export default function SellerDashboardPage() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState<any>(null)
  const [trend, setTrend] = useState<any[]>([])
  const [chartMode, setChartMode] = useState<'monthly' | 'daily'>('monthly')
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingTrend, setLoadingTrend] = useState(true)
  const [activeChart, setActiveChart] = useState<'earnings' | 'orders'>('earnings')

  // Filter state
  const [filterMode, setFilterMode] = useState<FilterMode>('MONTH')
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth)
  const [fromDate, setFromDate] = useState(getFirstDayOfMonth(currentYear, currentMonth))
  const [toDate, setToDate] = useState(todayStr)

  // Applied state (reflects last successful fetch)
  const [appliedLabel, setAppliedLabel] = useState('')
  const [trendYear, setTrendYear] = useState(currentYear)
  const [highlightMonths, setHighlightMonths] = useState<number[]>([currentMonth])

  useEffect(() => {
    applyFilter()
  }, [])

  const applyFilter = () => {
    const { start, end } = buildRange(filterMode, year, month, fromDate, toDate)
    const label = buildFilterLabel(filterMode, year, month, fromDate, toDate)
    const hMonths = getHighlightMonths(filterMode, month, start, end)
    const chartYear = filterMode === 'DAY' ? new Date(start).getFullYear() : year

    setAppliedLabel(label)
    setHighlightMonths(hMonths)
    setTrendYear(chartYear)

    fetchStats(start, end)

    // Choose chart granularity based on filter mode
    if (filterMode === 'YEAR') {
      setChartMode('monthly')
      fetchMonthlyTrend(chartYear)
    } else {
      // MONTH or DAY → show daily bars for the exact range
      setChartMode('daily')
      fetchDailyTrend(start, end)
    }
  }

  const fetchStats = async (startDate: string, endDate: string) => {
    setLoadingStats(true)
    try {
      const res = await sellerApi.getDashboardStats(startDate, endDate)
      setStats(res.data || res)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingStats(false)
    }
  }

  const fetchMonthlyTrend = async (y: number) => {
    setLoadingTrend(true)
    try {
      const res = await sellerApi.getMonthlyTrend(y)
      setTrend(res.data || res || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingTrend(false)
    }
  }

  const fetchDailyTrend = async (startDate: string, endDate: string) => {
    setLoadingTrend(true)
    try {
      const res = await sellerApi.getDailyTrend(startDate, endDate)
      setTrend(res.data || res || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingTrend(false)
    }
  }

  const topDocs = stats?.topDownloads || []
  const topViewDocs = stats?.topViews || []
  // Keep aliases for the progress-bar sections below
  const topViews = topViewDocs
  const maxDownloads = Math.max(...topDocs.map((d: any) => d.download_count), 1)
  const maxViewCount = Math.max(...topViewDocs.map((d: any) => d.view_count), 1)

  // Recharts formatters
  const yAxisFmt = (val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`
    return String(val)
  }
  const tooltipFmt = (value: any) => [activeChart === 'earnings' ? formatBalance(Number(value)) : `${value} đơn`, activeChart === 'earnings' ? 'Doanh thu' : 'Số đơn']

  const convRate = stats?.totalViews > 0
    ? ((stats.totalDownloads / stats.totalViews) * 100).toFixed(1) : '0.0'
  const avgPerOrder = stats?.totalOrders > 0
    ? formatBalance(stats.totalEarnings / stats.totalOrders) : formatBalance(0)

  // Prevent selecting future months
  const maxMonthForYear = (y: number) => y < currentYear ? 12 : currentMonth

  return (
    <SellerLayout>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold font-heading flex items-center gap-3">
          <LayoutDashboard className="w-8 h-8 text-primary" /> Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Xin chào <span className="font-semibold text-foreground">{user?.fullName}</span> – theo dõi tổng quan cửa hàng của bạn.
        </p>
      </div>

      {/* ── Filter Panel ── */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-8 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold">Lọc theo khoảng thời gian</span>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 bg-muted/60 p-1 rounded-xl w-fit mb-5 border border-border">
          {([
            { value: 'DAY', label: 'Khoảng ngày' },
            { value: 'MONTH', label: 'Tháng' },
            { value: 'YEAR', label: 'Cả năm' },
          ] as { value: FilterMode; label: string }[]).map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilterMode(tab.value)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${filterMode === tab.value ? 'bg-white dark:bg-card shadow-sm text-primary border border-border' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Contextual inputs */}
        <div className="flex flex-wrap items-end gap-3">
          {filterMode === 'DAY' && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Từ ngày</label>
                <div className="flex items-center gap-2 bg-background border border-border px-3 py-2.5 rounded-xl">
                  <input
                    type="date"
                    value={fromDate}
                    max={toDate}
                    onChange={e => setFromDate(e.target.value)}
                    className="bg-transparent text-sm font-semibold outline-none cursor-pointer"
                  />
                </div>
              </div>
              <span className="text-muted-foreground font-bold pb-2">→</span>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Đến ngày</label>
                <div className="flex items-center gap-2 bg-background border border-border px-3 py-2.5 rounded-xl">
                  <input
                    type="date"
                    value={toDate}
                    min={fromDate}
                    max={todayStr}
                    onChange={e => setToDate(e.target.value)}
                    className="bg-transparent text-sm font-semibold outline-none cursor-pointer"
                  />
                </div>
              </div>
            </>
          )}

          {filterMode === 'MONTH' && (
            <div className="flex gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tháng</label>
                <select
                  value={month}
                  onChange={e => setMonth(Number(e.target.value))}
                  className="bg-background border border-border px-3 py-2.5 rounded-xl text-sm font-semibold outline-none cursor-pointer"
                >
                  {Array.from({ length: maxMonthForYear(year) }, (_, i) => (
                    <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Năm</label>
                <select
                  value={year}
                  onChange={e => {
                    const y = Number(e.target.value)
                    setYear(y)
                    if (month > maxMonthForYear(y)) setMonth(maxMonthForYear(y))
                  }}
                  className="bg-background border border-border px-3 py-2.5 rounded-xl text-sm font-semibold outline-none cursor-pointer"
                >
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          )}

          {filterMode === 'YEAR' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Năm</label>
              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className="bg-background border border-border px-3 py-2.5 rounded-xl text-sm font-semibold outline-none cursor-pointer"
              >
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}

          <div className="flex items-end gap-3 pb-0">
            <button
              onClick={applyFilter}
              className="btn bg-primary text-white hover:bg-primary-hover px-6 py-2.5 rounded-xl text-sm font-bold cursor-pointer shadow-sm"
            >
              Áp dụng
            </button>
            {appliedLabel && (
              <span className="text-xs text-muted-foreground font-medium bg-muted/60 px-4 py-2.5 rounded-xl border border-border whitespace-nowrap">
                📊 Đang xem: <strong className="text-foreground">{appliedLabel}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Tổng lượt xem', value: `${stats?.totalViews || 0}`, icon: <Eye className="w-5 h-5" />, grad: 'from-sky-400 to-cyan-500', bg: 'bg-sky-50 border-sky-100' },
          { label: 'Tổng lượt tải', value: `${stats?.totalDownloads || 0}`, icon: <Download className="w-5 h-5" />, grad: 'from-emerald-400 to-teal-500', bg: 'bg-emerald-50 border-emerald-100' },
          { label: 'Doanh thu', value: formatBalance(stats?.totalEarnings || 0), icon: <DollarSign className="w-5 h-5" />, grad: 'from-violet-500 to-indigo-600', bg: 'bg-violet-50 border-violet-100' },
          { label: 'Đơn hàng', value: `${stats?.totalOrders || 0}`, icon: <ShoppingBag className="w-5 h-5" />, grad: 'from-orange-400 to-amber-500', bg: 'bg-orange-50 border-orange-100' },
        ].map(card => (
          <div key={card.label} className={`border ${card.bg} rounded-3xl p-5 shadow-sm hover:shadow-md transition-shadow overflow-hidden relative`}>
            <div className={`absolute -top-4 -right-4 w-24 h-24 rounded-full bg-linear-to-br ${card.grad} opacity-10`} />
            <div className={`inline-flex p-2.5 rounded-xl bg-linear-to-br ${card.grad} text-white shadow-md mb-4`}>{card.icon}</div>
            <p className="text-sm text-muted-foreground font-medium">{card.label}</p>
            <p className="text-2xl font-black font-heading mt-0.5">{loadingStats ? <span className="text-muted-foreground animate-pulse">...</span> : card.value}</p>
          </div>
        ))}
      </div>

      {/* ── Chart + Quick Stats ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

        {/* Bar Chart — adapts to filter mode */}
        <div className="lg:col-span-2 bg-card border border-border rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-lg">
                {chartMode === 'monthly' ? `Biểu đồ tháng – Năm ${trendYear}` : `Biểu đồ ngày – ${appliedLabel}`}
              </h3>
            </div>
            <div className="flex rounded-xl overflow-hidden border border-border text-xs">
              {(['earnings', 'orders'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setActiveChart(mode)}
                  className={`px-3 py-1.5 font-semibold transition-colors cursor-pointer ${activeChart === mode ? 'bg-primary text-white' : 'bg-card text-muted-foreground hover:bg-muted'}`}
                >
                  {mode === 'earnings' ? 'Doanh thu' : 'Đơn hàng'}
                </button>
              ))}
            </div>
          </div>

          {loadingTrend ? (
            <div className="h-56 flex items-center justify-center text-muted-foreground text-sm animate-pulse">Đang tải biểu đồ...</div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={trend}
                  margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
                  barCategoryGap={chartMode === 'daily' ? '10%' : '20%'}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    tickMargin={6}
                    axisLine={false}
                    tickLine={false}
                    // Daily: show every other tick (odd index = day 1,3,5...)
                    // Monthly: show all 12 ticks
                    interval={chartMode === 'daily' ? 1 : 0}
                  />
                  <YAxis
                    tickFormatter={yAxisFmt}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={45}
                  />
                  <RechartsTooltip
                    formatter={tooltipFmt}
                    labelFormatter={(label) => `Điểm dữ liệu: ${label}`}
                  />
                  <Bar dataKey={activeChart === 'earnings' ? 'earnings' : 'orders'} radius={[4, 4, 0, 0]}>
                    {trend.map((d, idx) => {
                      const isHighlighted = chartMode === 'monthly'
                        ? highlightMonths.includes(d.month)
                        : true
                      return <Cell key={idx} fill={isHighlighted ? '#8b5cf6' : '#8b5cf620'} />
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm flex flex-col gap-4">
          <h3 className="font-bold text-lg">Phân tích</h3>
          <p className="text-xs text-muted-foreground -mt-3 font-medium">{appliedLabel}</p>

          <div className="flex-1 space-y-3">
            <div className="p-4 bg-muted/40 rounded-2xl">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Tỷ lệ chuyển đổi</p>
              <p className="text-3xl font-black tracking-tight">{loadingStats ? '...' : `${convRate}%`}</p>
              <p className="text-xs text-muted-foreground mt-1">Lượt xem → Lượt tải xuống</p>
            </div>
            <div className="p-4 bg-muted/40 rounded-2xl">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Doanh thu / đơn</p>
              <p className="text-3xl font-black tracking-tight">{loadingStats ? '...' : avgPerOrder}</p>
              <p className="text-xs text-muted-foreground mt-1">Trung bình mỗi đơn bán</p>
            </div>
          </div>

          <div className="p-4 bg-primary/5 border border-primary/15 rounded-2xl text-xs text-foreground/70 leading-relaxed">
            💡 <strong>Mẹo:</strong> Cập nhật mô tả và tags rõ ràng để tăng khả năng hiển thị trong tìm kiếm.
          </div>
        </div>
      </div>

      {/* ── Top Documents ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
          <h3 className="font-bold text-base flex items-center gap-2 mb-5">
            <Award className="w-5 h-5 text-emerald-500" /> Top 5 – Lượt tải nhiều nhất
          </h3>
          <div className="space-y-5">
            {topDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Chưa có dữ liệu.</p>
            ) : topDocs.map((doc: any, i: number) => (
              <div key={doc.document_id}>
                <div className="flex justify-between items-center text-sm mb-1.5">
                  <span className="font-medium line-clamp-1 flex gap-2 items-center">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-400 text-white' : i === 2 ? 'bg-orange-400 text-white' : 'bg-muted text-muted-foreground'}`}>{i + 1}</span>
                    {doc.title}
                  </span>
                  <span className="font-bold text-emerald-600 shrink-0 ml-2">{doc.download_count}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-emerald-400 transition-all duration-700" style={{ width: `${(doc.download_count / maxDownloads) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
          <h3 className="font-bold text-base flex items-center gap-2 mb-5">
            <TrendingUp className="w-5 h-5 text-sky-500" /> Top 5 – Lượt xem cao nhất
          </h3>
          <div className="space-y-5">
            {topViews.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Chưa có dữ liệu.</p>
            ) : topViews.map((doc: any, i: number) => (
              <div key={doc.document_id}>
                <div className="flex justify-between items-center text-sm mb-1.5">
                  <span className="font-medium line-clamp-1 flex gap-2 items-center">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-400 text-white' : i === 2 ? 'bg-orange-400 text-white' : 'bg-muted text-muted-foreground'}`}>{i + 1}</span>
                    {doc.title}
                  </span>
                  <span className="font-bold text-sky-600 shrink-0 ml-2">{doc.view_count}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-sky-400 transition-all duration-700" style={{ width: `${(doc.view_count / maxViewCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </SellerLayout>
  )
}
