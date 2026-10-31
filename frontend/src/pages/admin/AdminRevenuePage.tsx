import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/api/admin.api";
import { formatBalance, formatDateTime, toVNDateString } from "@/utils/format";
import {
  LineChart,
  DollarSign,
  Calendar,
  Download,
  TrendingUp,
} from "lucide-react";
import toast from "react-hot-toast";
import Pagination from "@/components/common/Pagination";
import type { LedgerEntry, RevenueReport } from "@/api/contracts";
import { fetchAllPages, isCanceledRequest } from "@/api/request";
import { useFinancialReportQuery } from "@/hooks/useFinancialReportQuery";

// Chống lỗi missing moment do import
export default function AdminRevenuePage() {
  const { startDate, endDate, requestedPage, updateQuery } =
    useFinancialReportQuery();
  const [report, setReport] = useState<RevenueReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchRevenue = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const res = await adminApi.getRevenueReport(
          { startDate, endDate, page: requestedPage, limit: 20 },
          signal,
        );
        setReport(res);
      } catch (error) {
        if (!isCanceledRequest(error))
          toast.error("Lỗi khi tải báo cáo doanh thu");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [endDate, requestedPage, startDate],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchRevenue(controller.signal);
    return () => controller.abort();
  }, [fetchRevenue]);

  const handleExportCSV = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const data = await fetchAllPages<LedgerEntry>((page, limit) =>
        adminApi.getRevenueReport({ startDate, endDate, page, limit }),
      );
      if (data.length === 0) {
        toast.error("Không có dữ liệu để xuất");
        return;
      }

      const headers = [
        "Mã Giao Dịch",
        "Thời Gian",
        "Loại",
        "Mô Tả",
        "Thu Nhập (Credit)",
        "Khấu Trừ (Debit)",
      ];

      const csvContent = [
        headers.join(","),
        ...data.map((item) => {
          // Xử lý escape dấu ngoặc kép an toàn cho chuẩn CSV
          const safeDescription = item.ledger_transactions.description
            ? item.ledger_transactions.description.replace(/"/g, '""')
            : "";

          return [
            `TXN-${item.transaction_id}`,
            new Date(item.created_at)
              .toISOString()
              .replace("T", " ")
              .substring(0, 19),
            item.ledger_transactions.type,
            `"${safeDescription}"`, // Bọc chuỗi đã được escape an toàn
            Number(item.credit_amount),
            Number(item.debit_amount),
          ].join(",");
        }),
      ].join("\n");

      // Download CSV
      const blob = new Blob(["\uFEFF" + csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute(
        "download",
        `bao_cao_doanh_thu_${toVNDateString().replace(/-/g, "")}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      toast.error("Không thể xuất CSV, vui lòng thử lại");
    } finally {
      setExporting(false);
    }
  };

  const data = report?.data ?? [];
  const totalCredit = report?.summary.totalCredit ?? 0;
  const totalDebit = report?.summary.totalDebit ?? 0;
  const netRevenue = report?.summary.netRevenue ?? 0;
  const page = report?.meta.page ?? requestedPage;
  const limit = report?.meta.limit ?? 20;
  const total = report?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const setPage = (nextPage: number) => updateQuery({ page: nextPage });

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
            <LineChart className="w-7 h-7 text-primary" /> Báo cáo Doanh thu Hệ
            thống
          </h1>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={exporting}
          aria-busy={exporting}
          className="btn bg-success text-white hover:bg-emerald-600 px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors disabled:opacity-60"
        >
          <Download className="w-4 h-4" />{" "}
          {exporting ? "Đang xuất..." : "Xuất CSV"}
        </button>
      </div>

      {/* Filter Container */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Từ ngày
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="date"
              value={startDate}
              onChange={(e) =>
                updateQuery({ startDate: e.target.value, page: 1 })
              }
              className="pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-sm font-semibold outline-none cursor-pointer focus:border-primary"
            />
          </div>
        </div>
        <span className="text-muted-foreground font-bold pb-2">→</span>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Đến ngày
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="date"
              value={endDate}
              onChange={(e) =>
                updateQuery({ endDate: e.target.value, page: 1 })
              }
              className="pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-sm font-semibold outline-none cursor-pointer focus:border-primary"
            />
          </div>
        </div>
        <button
          onClick={() => void fetchRevenue()}
          className="btn bg-primary text-white hover:bg-primary-hover px-5 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors shadow-sm"
        >
          Lọc dữ liệu
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm relative overflow-hidden group">
          <div className="absolute -right-3 -top-3 w-20 h-20 bg-success/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <div className="relative z-10">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Tổng thu (Credits)
            </p>
            <p className="text-2xl font-black text-success">
              {formatBalance(totalCredit)}
            </p>
          </div>
        </div>
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm relative overflow-hidden group">
          <div className="absolute -right-3 -top-3 w-20 h-20 bg-danger/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <div className="relative z-10">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Tổng chi (Debits)
            </p>
            <p className="text-2xl font-black text-danger">
              {formatBalance(totalDebit)}
            </p>
          </div>
        </div>
        <div className="bg-primary/5 border border-primary/20 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
          <div className="absolute -right-3 -top-3 w-20 h-20 bg-primary/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">
                Lợi Nhận Ròng (Net)
              </p>
              <p className="text-2xl font-black text-primary">
                {formatBalance(netRevenue)}
              </p>
            </div>
            <div className="p-3 bg-primary/10 rounded-full text-primary shrink-0 relative z-20">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border bg-muted/20">
          <h2 className="font-bold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-muted-foreground" /> Lịch sử
            Dòng tiền
          </h2>
        </div>
        {loading ? (
          <div className="text-center py-16 text-muted-foreground animate-pulse">
            Đang tải dữ liệu...
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            Không có dữ liệu trong khoảng thời gian này.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-4 font-semibold w-40">Thời gian</th>
                    <th className="p-4 font-semibold">Mã Giao Dịch</th>
                    <th className="p-4 font-semibold">Mô tả</th>
                    <th className="p-4 font-semibold text-right text-success">
                      Thu (+)
                    </th>
                    <th className="p-4 font-semibold text-right text-danger">
                      Chi (-)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.map((item) => {
                    const cr = Number(item.credit_amount);
                    const de = Number(item.debit_amount);
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="p-4 text-muted-foreground text-sm whitespace-nowrap">
                          {formatDateTime(item.created_at)}
                        </td>
                        <td className="p-4 font-mono font-bold text-sm">
                          TXN-{item.transaction_id}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm">
                              {item.ledger_transactions.type}
                            </span>
                            <span className="text-xs text-muted-foreground mt-0.5">
                              {item.ledger_transactions.description}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          {cr > 0 ? (
                            <span className="font-bold text-success">
                              +{formatBalance(cr)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/30">-</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          {de > 0 ? (
                            <span className="font-bold text-danger">
                              -{formatBalance(de)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/30">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              limit={limit}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
