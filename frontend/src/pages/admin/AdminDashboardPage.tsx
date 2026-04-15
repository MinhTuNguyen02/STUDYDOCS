import { useEffect, useState } from 'react';
import { adminApi } from '@/api/admin.api';
import toast from 'react-hot-toast';
import { FileCheck, Files, ShoppingBag, Banknote, ArrowRight, Download, CalendarDays, Trophy } from 'lucide-react';
import { formatBalance } from '@/utils/format';
import { Link } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

type FilterMode = 'DAY' | 'MONTH' | 'YEAR';

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
  const dayOfWeek = d.getDay() || 7 // 1-7 (Mon-Sun)
  const start = new Date(d)
  start.setDate(d.getDate() - dayOfWeek + 1)
  const end = new Date(d)
  end.setDate(d.getDate() + (7 - dayOfWeek))
  return {
    start: localDateStr(start),
    end: localDateStr(end > now ? now : end)
  }
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
      const res = await adminApi.getDashboardStats({ startDate: start, endDate: end });
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
    if (!data || !data.length) {
      toast.error('Không có dữ liệu để xuất');
      return;
    }
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
    exportCSV(stats.chartData, `dashboard_thongke_${appliedQuery.start}_${appliedQuery.end}.csv`);
  };

  const yAxisFormatter = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return val.toString();
  };

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
                  <h3 className="text-muted-foreground font-medium">Tổng File Đang Public</h3>
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
                <p className="text-sm text-muted-foreground font-medium mt-4">Tất cả nạp tiền đã lọc</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
              <h3 className="text-lg font-bold font-heading mb-6">Biểu đồ Doanh Thu</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} tickMargin={10} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={yAxisFormatter} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    {/* <RechartsTooltip formatter={(value: number) => [formatBalance(value), 'Doanh thu']} /> */}
                    <RechartsTooltip
                      formatter={(value: any) => {
                        // Nếu value không hợp lệ, trả về 0 hoặc một chuỗi mặc định
                        const formattedValue = value ? formatBalance(Number(value)) : '0';
                        return [formattedValue, 'Doanh thu'];
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" name="Doanh thu" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
              <h3 className="text-lg font-bold font-heading mb-6">Giao dịch & Lượt tải lên</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} tickMargin={10} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <RechartsTooltip />
                    <Legend />
                    <Bar dataKey="orders" name="Số đơn hàng" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="documents" name="File tải lên mới" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
              <h4 className="font-bold font-heading text-lg flex items-center gap-2 mb-4 text-warning">
                <Trophy className="w-6 h-6" /> Top Bán Chạy Nhất
              </h4>
              <div className="space-y-4">
                {stats.topSellers?.length === 0 && <p className="text-muted-foreground text-sm text-center">Chưa có số liệu</p>}
                {stats.topSellers?.map((u: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center border-b border-border pb-3 last:border-0">
                    <span className="text-base font-semibold truncate pr-2 max-w-[250px]" title={u.name}>{idx + 1}. {u.name || 'Người dùng ẩn'}</span>
                    <span className="text-sm font-mono text-primary bg-primary/10 px-3 py-1 rounded-md">{u.count} đơn</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
              <h4 className="font-bold font-heading text-lg flex items-center gap-2 mb-4 text-danger">
                <Trophy className="w-6 h-6" /> Doanh Thu TOP
              </h4>
              <div className="space-y-4">
                {stats.topRevenueSellers?.length === 0 && <p className="text-muted-foreground text-sm text-center">Chưa có số liệu</p>}
                {stats.topRevenueSellers?.map((u: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center border-b border-border pb-3 last:border-0">
                    <span className="text-base font-semibold truncate pr-2 max-w-[250px]" title={u.name}>{idx + 1}. {u.name || 'Người dùng ẩn'}</span>
                    <span className="text-sm font-mono text-success font-bold">{formatBalance(u.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
              <h4 className="font-bold font-heading text-lg flex items-center gap-2 mb-4 text-blue-500">
                <Trophy className="w-6 h-6" /> Tác Giả Chăm Chỉ (File mới)
              </h4>
              <div className="space-y-4">
                {stats.topUploaders?.length === 0 && <p className="text-muted-foreground text-sm text-center">Chưa có số liệu</p>}
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
              <div className="space-y-4">
                {stats.topBoughtDocs?.length === 0 && <p className="text-muted-foreground text-sm text-center">Chưa có số liệu</p>}
                {stats.topBoughtDocs?.map((d: any, idx: number) => (
                  <div key={idx} className="flex flex-col border-b border-border pb-3 last:border-0">
                    <span className="text-base font-semibold truncate" title={d.title}>{idx + 1}. {d.title || 'Tài liệu bị xóa'}</span>
                    <span className="text-sm text-muted-foreground mt-1">Đã chốt {d.count} đơn thành công</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
