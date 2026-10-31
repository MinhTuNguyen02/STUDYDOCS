import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/api/admin.api";
import { formatBalance, formatDateTime } from "@/utils/format";
import {
  Vault,
  TrendingUp,
  TrendingDown,
  Activity,
  Download,
  ArrowUpCircle,
  ArrowDownCircle,
  Calendar,
} from "lucide-react";
import toast from "react-hot-toast";
import Pagination from "@/components/common/Pagination";
import type { GatewayReport, LedgerEntry } from "@/api/contracts";
import { fetchAllPages, isCanceledRequest } from "@/api/request";
import { useFinancialReportQuery } from "@/hooks/useFinancialReportQuery";

export default function AdminGatewayPage() {
  const { startDate, endDate, requestedPage, updateQuery } =
    useFinancialReportQuery();
  const [data, setData] = useState<GatewayReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const res = await adminApi.getGatewayWalletReport(
          { startDate, endDate, page: requestedPage, limit: 20 },
          signal,
        );
        setData(res);
      } catch (error) {
        if (!isCanceledRequest(error)) toast.error("Lỗi khi tải dữ liệu ví");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [endDate, requestedPage, startDate],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const page = data?.meta.page ?? requestedPage;
  const limit = data?.meta.limit ?? 20;
  const total = data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const setPage = (nextPage: number) => updateQuery({ page: nextPage });

  const handleExportCSV = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const entries = await fetchAllPages<LedgerEntry>((page, limit) =>
        adminApi.getGatewayWalletReport({ startDate, endDate, page, limit }),
      );
      if (!entries.length) {
        toast.error("Không có dữ liệu để xuất");
        return;
      }

      const headers = [
        "Mã Giao Dịch",
        "Thời Gian",
        "Loại",
        "Mô Tả",
        "Tiền Vào (Debit)",
        "Tiền Ra (Credit)",
      ];
      const csvContent = [
        headers.join(","),
        ...entries.map((e) =>
          [
            `TXN-${e.transaction_id}`,
            formatDateTime(e.created_at),
            e.ledger_transactions.type,
            `"${(e.ledger_transactions.description ?? "").replace(/"/g, '""')}"`,
            Number(e.debit_amount),
            Number(e.credit_amount),
          ].join(","),
        ),
      ].join("\n");

      const blob = new Blob(["\uFEFF" + csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute("download", `gateway_pool_${startDate}_${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      toast.error("Không thể xuất CSV, vui lòng thử lại");
    } finally {
      setExporting(false);
    }
  };

  const txTypeLabel: Record<string, string> = {
    DEPOSIT: "Nạp ví",
    WITHDRAW: "Rút tiền",
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
            <Vault className="w-7 h-7 text-primary" /> Theo Dõi Tài Sản
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

      {/* ── Filter ── */}
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
              max={endDate}
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
              min={startDate}
              onChange={(e) =>
                updateQuery({ endDate: e.target.value, page: 1 })
              }
              className="pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-sm font-semibold outline-none cursor-pointer focus:border-primary"
            />
          </div>
        </div>
        <button
          onClick={() => void fetchData()}
          className="btn bg-primary text-white hover:bg-primary-hover px-5 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors shadow-sm"
        >
          Lọc dữ liệu
        </button>
      </div>

      {loading && (
        <div className="text-center text-muted-foreground py-10 animate-pulse">
          Đang tải dữ liệu...
        </div>
      )}

      {!loading && data && (
        <>
          {/* ── Balance KPI ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card border border-border p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute -right-3 -top-3 w-20 h-20 bg-primary/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
              <div className="relative z-10">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Số dư hiện tại
                </p>
                <p className="text-2xl font-black text-primary">
                  {formatBalance(Number(data.wallet?.balance ?? 0))}
                </p>
              </div>
            </div>

            <div className="bg-card border border-border p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute -right-3 -top-3 w-20 h-20 bg-success/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
              <div className="relative z-10">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Tổng tiền vào (kỳ)
                </p>
                <p className="text-2xl font-black text-success">
                  {formatBalance(data.summary?.totalIn ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> Ghi nợ (Debit) tài sản
                </p>
              </div>
            </div>

            <div className="bg-card border border-border p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute -right-3 -top-3 w-20 h-20 bg-danger/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
              <div className="relative z-10">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Tổng tiền ra (kỳ)
                </p>
                <p className="text-2xl font-black text-danger">
                  {formatBalance(data.summary?.totalOut ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5" /> Ghi có (Credit) tài
                  sản
                </p>
              </div>
            </div>

            <div className="bg-card border border-border p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute -right-3 -top-3 w-20 h-20 bg-warning/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
              <div className="relative z-10">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Net Flow (kỳ)
                </p>
                <p
                  className={`text-2xl font-black ${(data.summary?.netFlow ?? 0) >= 0 ? "text-success" : "text-danger"}`}
                >
                  {(data.summary?.netFlow ?? 0) >= 0 ? "+" : ""}
                  {formatBalance(data.summary?.netFlow ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5" />{" "}
                  {data.summary?.entryCount ?? 0} giao dịch
                </p>
              </div>
            </div>
          </div>

          {/* ── Ledger Table ── */}
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-bold text-base">Lịch Sử Giao Dịch</h2>
              <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-lg">
                {data.meta.total} bản ghi
              </span>
            </div>

            {data.data.length === 0 ? (
              <p className="text-center text-muted-foreground py-12 text-sm">
                Không có giao dịch trong kỳ đã chọn.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                          Mã TXN
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                          Thời gian
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                          Loại
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-muted-foreground">
                          Mô tả
                        </th>
                        <th className="text-right py-3 px-4 font-semibold text-success">
                          Tiền vào
                        </th>
                        <th className="text-right py-3 px-4 font-semibold text-danger">
                          Tiền ra
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.data.map((entry) => {
                        const isIn = Number(entry.debit_amount) > 0;
                        return (
                          <tr
                            key={entry.id}
                            className="border-b border-border/60 hover:bg-muted/30 transition-colors last:border-0"
                          >
                            <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                              TXN-{entry.transaction_id}
                            </td>
                            <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                              {formatDateTime(entry.created_at)}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                                  entry.ledger_transactions.type === "DEPOSIT"
                                    ? "bg-blue-100 text-blue-700"
                                    : entry.ledger_transactions.type ===
                                        "PURCHASE"
                                      ? "bg-violet-100 text-violet-700"
                                      : "bg-orange-100 text-orange-700"
                                }`}
                              >
                                {isIn ? (
                                  <ArrowUpCircle className="w-3 h-3" />
                                ) : (
                                  <ArrowDownCircle className="w-3 h-3" />
                                )}
                                {txTypeLabel[entry.ledger_transactions.type] ??
                                  entry.ledger_transactions.type}
                              </span>
                            </td>
                            <td
                              className="py-3 px-4 text-xs text-muted-foreground max-w-[200px] truncate"
                              title={
                                entry.ledger_transactions.description ??
                                undefined
                              }
                            >
                              {entry.ledger_transactions.description || "—"}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold text-success">
                              {Number(entry.debit_amount) > 0
                                ? `+${formatBalance(Number(entry.debit_amount))}`
                                : "—"}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold text-danger">
                              {Number(entry.credit_amount) > 0
                                ? `-${formatBalance(Number(entry.credit_amount))}`
                                : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="border-t border-border">
                    <Pagination
                      page={page}
                      totalPages={totalPages}
                      total={total}
                      limit={limit}
                      onPageChange={setPage}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
