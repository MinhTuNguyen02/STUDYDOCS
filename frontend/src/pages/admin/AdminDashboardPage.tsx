import { useEffect, useState } from 'react';
import { adminApi } from '@/api/admin.api';
import toast from 'react-hot-toast';
import { FileCheck, Files, ShoppingBag, Banknote, ArrowRight, Download, CalendarDays, Trophy, Package, RefreshCw } from 'lucide-react';
import { formatBalance } from '@/utils/format';
import { Link } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

type FilterMode = 'DAY' | 'MONTH' | 'YEAR';
type RevenueFilter = 'all' | 'deposit' | 'commission' | 'package';

function localDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getFirstDayOfMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

function getLastDayOfMonth(year: number, month: number) {
  const d = new Date(year, month, 0)
  return localDateStr(d)
}

const now = new Date()
const todayStr = localDateStr(now)
const currentYear = now.getFullYear()
const currentMonth = now.getMonth() + 1
const yearOptions = [2024, 2025, 2026, 2027].filter(y => y <= currentYear)

function getCurrentWeekRange() {
  const d = new Date()
  const dayOfWeek = d.getDay() || 7
  const start = new Date(d)
  start.setDate(d.getDate() - dayOfWeek + 1)
  const end = new Date(d)
  end.setDate(d.getDate() + (7 - dayOfWeek))
  return {
    start: localDateStr(start),
    end: localDateStr(end > now ? now : end)
  }
}

const REVENUE_FILTER_OPTIONS: { value: RevenueFilter; label: string; color: string; dataKey: string }[] = [
  { value: 'all', label: 'Tất cả doanh thu', color: '#8b5cf6', dataKey: 'revenue' },
  { value: 'deposit', label: 'Nạp ví', color: '#3b82f6', dataKey: 'depositRevenue' },
  { value: 'commission', label: 'Hoa hồng tài liệu', color: '#10b981', dataKey: 'commissionRevenue' },
  { value: 'package', label: 'Bán gói', color: '#f59e0b', dataKey: 'packageRevenue' },
]

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Chart controls
  const [revenueFilter, setRevenueFilter] = useState<RevenueFilter>('all');
  const [showRefunded, setShowRefunded] = useState(false);

  // Filter state
  const [filterMode, setFilterMode] = useState<FilterMode>('DAY');
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const defaultWeek = getCurrentWeekRange();
  const [fromDate, setFromDate] = useState(defaultWeek.start);
  const [toDate, setToDate] = useState(defaultWeek.end);

  // Applied logic
  const [appliedQuery, setAppliedQuery] = useState({ start: defaultWeek.start, end: defaultWeek.end });
  const [appliedLabel, setAppliedLabel] = useState('Tuần hiện tại');

  useEffect(() => {
    fetchStats(appliedQuery.start, appliedQuery.end);
  }, [appliedQuery]);

  const fetchStats = async (start: string, end: string) => {
    try {
      setLoading(true);
      const res = await adminApi.getDashboardStats({ startDate: start, endDate: end, groupBy: filterMode === 'YEAR' ? 'month' : 'day' });
      setStats(res.data || res);
    } catch (err: any) {
      toast.error('Không thể tải dữ liệu Dashboard');
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = () => {
    let start, end, label;
    if (filterMode === 'YEAR') {
      start = `${year}-01-01`;
      end = year === currentYear ? todayStr : `${year}-12-31`;
      label = `Năm ${year}`;
    } else if (filterMode === 'MONTH') {
      start = getFirstDayOfMonth(year, month);
      const lastDay = getLastDayOfMonth(year, month);
      end = lastDay > todayStr ? todayStr : lastDay;
      label = `Tháng ${month}/${year}`;
    } else {
      start = fromDate;
      end = toDate > todayStr ? todayStr : toDate;
      label = `${start.split('-').reverse().join('/')} → ${end.split('-').reverse().join('/')}`;
    }
    setAppliedLabel(label);
    setAppliedQuery({ start, end });
  };

  const resetFilter = () => {
    const week = getCurrentWeekRange();
    setFilterMode('DAY');
    setFromDate(week.start);
    setToDate(week.end);
    setYear(currentYear);
    setMonth(currentMonth);
    setAppliedLabel('Tuần hiện tại');
    setAppliedQuery({ start: week.start, end: week.end });
  };

  const maxMonthForYear = (y: number) => y < currentYear ? 12 : currentMonth;

  const exportCSV = (data: any[], filename: string) => {
    if (!data || !data.length) { toast.error('Không có dữ liệu để xuất'); return; }
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportAll = () => {
    if (!stats) return;
    const sections: string[] = [];

    // Helper to convert array to CSV block
    const toCSVBlock = (title: string, rows: any[]) => {
      if (!rows?.length) return `=== ${title} ===\nChưa có dữ liệu\n`;
      const headers = Object.keys(rows[0]);
      return [
        `=== ${title} ===`,
        headers.join(','),
        ...rows.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','))
      ].join('\n');
    };

    sections.push(toCSVBlock(`Biểu đồ theo ngày (${appliedLabel})`, stats.chartData));
    sections.push(toCSVBlock('Top Người Bán (Doanh Thu)', (stats.topRevenueSellers ?? []).map((r: any) => ({ id: r.id, ten: r.name ?? 'Ẩn danh', doanh_thu: r.revenue }))));
    sections.push(toCSVBlock('Top Người Mua', (stats.topBuyers ?? []).map((b: any) => ({ id: b.id, ten: b.name ?? 'Ẩn danh', so_don: b.count, tong_chi: b.totalSpent }))));
    sections.push(toCSVBlock('Tác Giả Chăm Chỉ (Upload)', (stats.topUploaders ?? []).map((u: any) => ({ id: u.id, ten: u.name ?? 'Ẩn danh', so_file: u.count }))));
    sections.push(toCSVBlock('Tài Liệu Bán Chạy', (stats.topBoughtDocs ?? []).map((d: any) => ({ id: d.id, ten_tai_lieu: d.title ?? 'Đã xóa', so_don: d.count }))));
    sections.push(toCSVBlock('Tài Liệu Tải Nhiều', (stats.topDownloadedDocs ?? []).map((d: any) => ({ id: d.id, ten_tai_lieu: d.title ?? 'Đã xóa', luot_tai: d.count }))));
    sections.push(toCSVBlock('Top Gói Được Mua', (stats.topPackages ?? []).map((p: any) => ({ id: p.id, ten_goi: p.name, don_gia: p.price, luot_mua: p.count, tong_thu: p.price * p.count }))));
    if (stats.revenueBreakdown) {
      sections.push(`=== Doanh Thu Theo Nguồn (${appliedLabel}) ===\nNguồn,Số tiền\nNạp ví,${stats.revenueBreakdown.deposit}\nHoa hồng tài liệu,${stats.revenueBreakdown.commission}\nBán gói,${stats.revenueBreakdown.package}\nTổng,${stats.revenueRange ?? 0}`);
    }

    const blob = new Blob(["\uFEFF" + sections.join('\n\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `dashboard_${appliedQuery.start}_${appliedQuery.end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const yAxisFormatter = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return val.toString();
  };

  const xAxisFormatter = (val: string) => {
    if (!val || !val.includes('-')) return val;
    const parts = val.split('-');
    if (parts.length === 2) return `${parts[1]}/${parts[0]}`; // YYYY-MM
    return `${parts[2]}/${parts[1]}`; // YYYY-MM-DD
  };

  const activeRevOption = REVENUE_FILTER_OPTIONS.find(o => o.value === revenueFilter)!;

  // Revenue KPI breakdown for tooltip under revenue card
  const breakdown = stats?.revenueBreakdown;

  if (loading && !stats) return <div className="p-8 text-center text-muted-foreground animate-pulse">Đang tải dữ liệu báo cáo...</div>;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Dashboard Quản Trị</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExportAll} className="btn bg-success text-white hover:bg-success/90 px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm">
            <Download className="w-5 h-5" /> Xuất CSV
          </button>
        </div>
      </div>

      {/* ── Filter Panel ── */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold">Lọc thống kê thời gian</span>
          <span className="ml-auto text-xs font-semibold text-primary bg-primary/10 px-3 py-1 rounded-lg">
            Đang xem: {appliedLabel}
          </span>
        </div>

        <div className="flex gap-1 overflow-auto bg-muted/60 p-1 rounded-xl w-fit mb-4 border border-border">
          {([
            { value: 'DAY', label: 'Khoảng ngày' },
            { value: 'MONTH', label: 'Theo Tháng' },
            { value: 'YEAR', label: 'Cả năm' },
          ] as { value: FilterMode; label: string }[]).map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilterMode(tab.value)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${filterMode === tab.value ? 'bg-white dark:bg-card shadow-sm text-primary border border-border' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {filterMode === 'DAY' && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Từ ngày</label>
                <div className="flex items-center gap-2 bg-background border border-border px-3 py-2.5 rounded-xl">
                  <input type="date" max={toDate} value={fromDate} onChange={e => setFromDate(e.target.value)} className="bg-transparent text-sm font-semibold outline-none cursor-pointer" />
                </div>
              </div>
              <span className="text-muted-foreground font-bold pb-2">→</span>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Đến ngày</label>
                <div className="flex items-center gap-2 bg-background border border-border px-3 py-2.5 rounded-xl">
                  <input type="date" min={fromDate} max={todayStr} value={toDate} onChange={e => setToDate(e.target.value)} className="bg-transparent text-sm font-semibold outline-none cursor-pointer" />
                </div>
              </div>
            </>
          )}

          {filterMode === 'MONTH' && (
            <div className="flex gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tháng</label>
                <select value={month} onChange={e => setMonth(Number(e.target.value))} className="bg-background border border-border px-3 py-2.5 rounded-xl text-sm font-semibold outline-none cursor-pointer min-w-[120px]">
                  {Array.from({ length: maxMonthForYear(year) }, (_, i) => (
                    <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Năm</label>
                <select value={year} onChange={e => {
                  const y = Number(e.target.value)
                  setYear(y)
                  if (month > maxMonthForYear(y)) setMonth(maxMonthForYear(y))
                }} className="bg-background border border-border px-3 py-2.5 rounded-xl text-sm font-semibold outline-none cursor-pointer min-w-[100px]">
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          )}

          {filterMode === 'YEAR' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Năm</label>
              <select value={year} onChange={e => setYear(Number(e.target.value))} className="bg-background border border-border px-3 py-2.5 rounded-xl text-sm font-semibold outline-none cursor-pointer min-w-[100px]">
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button onClick={applyFilter} className="btn bg-primary text-white hover:bg-primary-hover px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer shadow-sm">
              Áp dụng
            </button>
            <button onClick={resetFilter} className="btn bg-transparent border border-border hover:bg-muted text-muted-foreground px-4 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-colors">
              Xóa lọc
            </button>
          </div>
        </div>
      </div>

      {stats && (
        <>
          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <div className="bg-card border border-border p-6 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-muted-foreground font-medium">Chờ kiểm duyệt</h3>
                  <div className="p-2 bg-primary/10 rounded-xl text-primary"><FileCheck className="w-5 h-5" /></div>
                </div>
                <p className="text-3xl font-bold font-heading mb-1">{stats.pendingApprovals || 0}</p>
                <Link to="/admin/approvals" className="text-sm text-primary font-medium flex items-center hover:underline mt-4">Vào đối soát <ArrowRight className="w-4 h-4 ml-1" /></Link>
              </div>
            </div>

            <div className="bg-card border border-border p-6 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-success/10 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-muted-foreground font-medium">Tổng tài liệu</h3>
                  <div className="p-2 bg-success/10 rounded-xl text-success"><Files className="w-5 h-5" /></div>
                </div>
                <p className="text-3xl font-bold font-heading mb-1">{stats.totalDocuments || 0}</p>
                <Link to="/admin/documents" className="text-sm text-success font-medium flex items-center hover:underline mt-4">Quản lý File <ArrowRight className="w-4 h-4 ml-1" /></Link>
              </div>
            </div>

            <div className="bg-card border border-border p-6 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-warning/10 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-muted-foreground font-medium">Đơn hàng trong kỳ</h3>
                  <div className="p-2 bg-warning/10 rounded-xl text-warning"><ShoppingBag className="w-5 h-5" /></div>
                </div>
                <p className="text-3xl font-bold font-heading mb-1">{stats.ordersRange || 0}</p>
                <p className="text-sm text-muted-foreground font-medium mt-4">Đơn thành công</p>
              </div>
            </div>

            <div className="bg-card border border-border p-6 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-danger/10 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-muted-foreground font-medium">Doanh thu trong kỳ</h3>
                  <div className="p-2 bg-danger/10 rounded-xl text-danger"><Banknote className="w-5 h-5" /></div>
                </div>
                <p className="text-3xl font-bold font-heading mb-1">{formatBalance(stats.revenueRange || 0)}</p>
                {breakdown && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs text-muted-foreground">💳 Nạp ví: <span className="font-semibold text-foreground">{formatBalance(breakdown.deposit)}</span></p>
                    <p className="text-xs text-muted-foreground">📄 Hoa hồng TL: <span className="font-semibold text-foreground">{formatBalance(breakdown.commission)}</span></p>
                    <p className="text-xs text-muted-foreground">📦 Bán gói: <span className="font-semibold text-foreground">{formatBalance(breakdown.package)}</span></p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Charts ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">

            {/* Revenue Line Chart */}
            <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <h3 className="text-lg font-bold font-heading">Doanh Thu Nền Tảng</h3>
                <div className="flex gap-1 bg-muted/60 p-1 rounded-xl border border-border overflow-x-auto">
                  {REVENUE_FILTER_OPTIONS.map(o => (
                    <button
                      key={o.value}
                      onClick={() => setRevenueFilter(o.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${revenueFilter === o.value ? 'bg-white dark:bg-card shadow-sm border border-border text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="date" tickFormatter={xAxisFormatter} tick={{ fontSize: 12 }} tickMargin={10} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={yAxisFormatter} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip formatter={(value: any) => [formatBalance(Number(value || 0)), activeRevOption.label]} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey={activeRevOption.dataKey}
                      name={activeRevOption.label}
                      stroke={activeRevOption.color}
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Transactions + Uploads Bar Chart */}
            <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold font-heading">Giao dịch & Lượt tải lên</h3>
                <button
                  onClick={() => setShowRefunded(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${showRefunded ? 'bg-danger/10 border-danger/30 text-danger' : 'bg-muted border-border text-muted-foreground hover:text-foreground'}`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {showRefunded ? 'Ẩn hoàn tiền' : 'Hiện hoàn tiền'}
                </button>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="date" tickFormatter={xAxisFormatter} tick={{ fontSize: 12 }} tickMargin={10} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <RechartsTooltip />
                    <Legend />
                    <Bar dataKey="orders" name="Đơn thành công" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="documents" name="File tải lên mới" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    {showRefunded && (
                      <Bar dataKey="refunded" name="Hoàn tiền" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ── Leaderboards ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* ── Panel 1: Top Người Bán Theo Doanh Thu ── */}
            <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
              <h4 className="font-bold font-heading text-lg flex items-center gap-2 mb-4 text-success">
                <Trophy className="w-6 h-6" /> Top Người Bán (Doanh Thu)
              </h4>
              <div className="space-y-3">
                {!stats.topRevenueSellers?.length && <p className="text-muted-foreground text-sm text-center">Chưa có số liệu</p>}
                {[...(stats.topRevenueSellers ?? [])]
                  .sort((a: any, b: any) => b.revenue - a.revenue)
                  .map((u: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center border-b border-border pb-3 last:border-0">
                      <span className="text-sm font-semibold truncate flex-1 pr-2" title={u.name}>{idx + 1}. {u.name || 'Người dùng ẩn'}</span>
                      <span className="text-sm font-mono text-success font-bold">{formatBalance(u.revenue)}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* ── Panel 2: Top Người Mua (Đơn + Tiền) ── */}
            <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
              <h4 className="font-bold font-heading text-lg flex items-center gap-2 mb-4 text-warning">
                <Trophy className="w-6 h-6" /> Top Người Mua
              </h4>
              <div className="space-y-3">
                {!stats.topBuyers?.length && <p className="text-muted-foreground text-sm text-center">Chưa có số liệu</p>}
                {(stats.topBuyers ?? []).map((u: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center border-b border-border pb-3 last:border-0 gap-2">
                    <span className="text-sm font-semibold truncate flex-1" title={u.name}>{idx + 1}. {u.name || 'Người dùng ẩn'}</span>
                    <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md whitespace-nowrap">{u.count} đơn</span>
                    <span className="text-xs font-mono text-warning font-bold whitespace-nowrap">{formatBalance(Number(u.totalSpent ?? 0))}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
              <h4 className="font-bold font-heading text-lg flex items-center gap-2 mb-4 text-blue-500">
                <Trophy className="w-6 h-6" /> Tác Giả Chăm Chỉ
              </h4>
              <div className="space-y-3">
                {!stats.topUploaders?.length && <p className="text-muted-foreground text-sm text-center">Chưa có số liệu</p>}
                {stats.topUploaders?.map((u: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center border-b border-border pb-3 last:border-0">
                    <span className="text-base font-semibold truncate pr-2 max-w-[250px]" title={u.name}>{idx + 1}. {u.name || 'Người dùng ẩn'}</span>
                    <span className="text-sm font-mono text-blue-600 bg-blue-100 px-3 py-1 rounded-md">{u.count} file</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
              <h4 className="font-bold font-heading text-lg flex items-center gap-2 mb-4 text-primary">
                <Trophy className="w-6 h-6" /> Tài Liệu Bán Chạy
              </h4>
              <div className="space-y-3">
                {!stats.topBoughtDocs?.length && <p className="text-muted-foreground text-sm text-center">Chưa có số liệu</p>}
                {stats.topBoughtDocs?.map((d: any, idx: number) => (
                  <div key={idx} className="flex flex-col border-b border-border pb-3 last:border-0">
                    <span className="text-base font-semibold truncate" title={d.title}>{idx + 1}. {d.title || 'Tài liệu bị xóa'}</span>
                    <span className="text-sm text-muted-foreground mt-1">Đã chốt {d.count} đơn thành công</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Top Packages ── */}
            <div className="lg:col-span-2 bg-card border border-border p-5 rounded-2xl shadow-sm">
              <h4 className="font-bold font-heading text-lg flex items-center gap-2 mb-4 text-amber-500">
                <Package className="w-6 h-6" /> Gói Được Mua Nhiều Nhất
              </h4>
              {!stats.topPackages?.length ? (
                <p className="text-muted-foreground text-sm text-center py-4">Chưa có giao dịch mua gói trong kỳ</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 font-semibold text-muted-foreground w-10">#</th>
                        <th className="text-left py-2 px-3 font-semibold text-muted-foreground">Tên gói</th>
                        <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Đơn giá</th>
                        <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Số lượt mua</th>
                        <th className="text-right py-2 px-3 font-semibold text-muted-foreground">Tổng thu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topPackages.map((pkg: any, idx: number) => (
                        <tr key={pkg.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-3">
                            <span className={`inline-flex w-6 h-6 rounded-full text-xs font-black items-center justify-center ${idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-slate-400 text-white' : idx === 2 ? 'bg-orange-400 text-white' : 'bg-muted text-muted-foreground'}`}>{idx + 1}</span>
                          </td>
                          <td className="py-3 px-3 font-semibold">{pkg.name}</td>
                          <td className="py-3 px-3 text-right font-mono text-primary">{formatBalance(pkg.price)}</td>
                          <td className="py-3 px-3 text-right">
                            <span className="bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-md">{pkg.count} lượt</span>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-success">{formatBalance(pkg.price * pkg.count)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border">
                        <td colSpan={3} className="py-2 px-3 text-sm font-semibold text-muted-foreground">Tổng cộng</td>
                        <td className="py-2 px-3 text-right font-bold">{stats.topPackages.reduce((s: number, p: any) => s + p.count, 0)} lượt</td>
                        <td className="py-2 px-3 text-right font-bold text-success">
                          {formatBalance(stats.topPackages.reduce((s: number, p: any) => s + p.price * p.count, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
