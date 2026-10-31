import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/api/admin.api";
import { formatBalance, formatDateTime } from "@/utils/format";
import {
  ShieldCheck,
  Download,
  ArrowUpCircle,
  ArrowDownCircle,
  Info,
  HandCoins,
  Calendar,
} from "lucide-react";
import toast from "react-hot-toast";
import Pagination from "@/components/common/Pagination";
import type { LedgerEntry, TaxReport } from "@/api/contracts";
import { fetchAllPages, isCanceledRequest } from "@/api/request";
import { useFinancialReportQuery } from "@/hooks/useFinancialReportQuery";

export default function AdminTaxPage() {
  const { startDate, endDate, requestedPage, updateQuery } =
    useFinancialReportQuery();
  const [data, setData] = useState<TaxReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pay Tax Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const res = await adminApi.getTaxWallet(
          { startDate, endDate, page: requestedPage, limit: 20 },
          signal,
        );
        setData(res);
      } catch (error) {
        if (!isCanceledRequest(error))
          toast.error("Lỗi khi tải dữ liệu tiền Thuế Thu Hộ");
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

  const handlePayTax = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payAmount || Number(payAmount) <= 0)
      return toast.error("Vui lòng nhập số tiền hợp lệ");
    if (Number(payAmount) > Number(data?.summary?.availableTaxToPay ?? 0))
      return toast.error(
        "Số tiền vượt quá số dư thuế khả dụng (từ các yêu cầu đã duyệt)",
      );

    setIsSubmitting(true);
    try {
      await adminApi.payTax({
        amount: Number(payAmount),
        note: payNote || "Nộp ngân sách tháng",
      });
      toast.success("Đã ghi nhận giao dịch Nộp Thuế thành công");
      setIsPayModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Có lỗi xảy ra khi xử lý");
    } finally {
      setIsSubmitting(false);
    }
  };

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
        adminApi.getTaxWallet({ startDate, endDate, page, limit }),
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
        "Nộp Thuế (Debit)",
        "Thu Hộ (Credit)",
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
      link.setAttribute("download", `tax_payable_${startDate}_${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      toast.error("Không thể xuất CSV, vui lòng thử lại");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-purple-600" /> Quản lý Thuế Thu
            Hộ
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setPayAmount(String(data?.summary?.availableTaxToPay ?? ""));
              setPayNote("");
              setIsPayModalOpen(true);
            }}
            className="btn bg-purple-600 text-white hover:bg-purple-700 px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm"
          >
            <HandCoins className="w-4 h-4" /> Báo Cáo Đã Nộp Thuế
          </button>
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

      {/* Pay Modal */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handlePayTax}
            className="bg-card w-full max-w-md rounded-2xl p-6 shadow-xl relative animate-in zoom-in-95 duration-200"
          >
            <h3 className="text-xl font-bold font-heading mb-4 text-purple-600 flex gap-2 items-center">
              <HandCoins className="w-6 h-6" /> Nộp Tiền Ngân Sách
            </h3>

            <div className="mb-4 bg-purple-500/10 border border-purple-500/20 p-3 rounded-xl text-sm leading-relaxed text-foreground">
              Thao tác này dùng để <strong>ghi nhận hệ thống</strong> sau khi kế
              toán đã chuyển khoản đóng thuế thành công cho Nhà Nước. Nó sẽ trừ
              tiền từ ví TAX_PAYABLE và trừ tiền quỹ GATEWAY_POOL. Số thuế khả
              dụng tối đa được nộp (từ các yêu cầu đã duyệt) là{" "}
              <strong>
                {formatBalance(Number(data?.summary?.availableTaxToPay ?? 0))}
              </strong>
              .
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Số tiền đã nộp (VNĐ)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={Number(data?.summary?.availableTaxToPay ?? 0)}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-purple-500"
                  placeholder="VD: 15000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Mô tả / Mã đối soát
                </label>
                <textarea
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-purple-500 min-h-[80px]"
                  placeholder="UNC số 1234 Nộp cục thuế..."
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setIsPayModalOpen(false)}
                className="px-4 py-2 font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors"
                disabled={isSubmitting}
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors flex items-center gap-2"
              >
                {isSubmitting ? "Đang xử lý..." : "Xác nhận Nộp"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && (
        <div className="text-center text-muted-foreground py-10 animate-pulse">
          Đang tải dữ liệu...
        </div>
      )}

      {!loading && data && (
        <>
          {/* ── Balance KPI ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-card border border-border p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute -right-3 -top-3 w-20 h-20 bg-purple-600/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
              <div className="relative z-10">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Dư nợ Thuế Phải Nộp
                </p>
                <p className="text-2xl font-black text-purple-600">
                  {formatBalance(Number(data.wallet?.balance ?? 0))}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1 flex flex-col gap-0.5">
                  <span>Khoản nợ theo sổ sách</span>
                  <span className="text-purple-600 font-bold">
                    Khả dụng nộp:{" "}
                    {formatBalance(data.summary?.availableTaxToPay ?? 0)}
                  </span>
                </p>
              </div>
            </div>

            <div className="bg-card border border-border p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute -right-3 -top-3 w-20 h-20 bg-success/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
              <div className="relative z-10">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Thu Hộ (Credit)
                </p>
                <p className="text-2xl font-black text-success">
                  {formatBalance(data.summary?.totalCollected ?? 0)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                  10% giữ lại khi user rút
                </p>
              </div>
            </div>

            <div className="bg-card border border-border p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute -right-3 -top-3 w-20 h-20 bg-danger/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
              <div className="relative z-10">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Nộp NSNN (Debit)
                </p>
                <p className="text-2xl font-black text-danger">
                  {formatBalance(data.summary?.totalPaid ?? 0)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                  Đã chuyển đi Nộp Thuế
                </p>
              </div>
            </div>

            <div className="bg-card border border-border p-5 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute -right-3 -top-3 w-20 h-20 bg-blue-500/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
              <div className="relative z-10">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Giao dịch kỳ
                </p>
                <p className="text-2xl font-black text-blue-500">
                  {data.summary?.entryCount ?? 0}{" "}
                  <span className="text-sm">lượt</span>
                </p>
              </div>
            </div>
          </div>

          {/* ── Table ── */}
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-4 font-semibold text-center w-16">#</th>
                    <th className="p-4 font-semibold">Tín hiệu / Reference</th>
                    <th className="p-4 font-semibold">Thời gian giao dịch</th>
                    <th className="p-4 font-semibold">Ghi chú</th>
                    <th className="p-4 font-semibold text-right">
                      Thu hộ (Khách đóng)
                    </th>
                    <th className="p-4 font-semibold text-right">
                      Trừ nợ (Nộp thuế)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.data.map((e, idx) => {
                    const de = Number(e.debit_amount);
                    const cr = Number(e.credit_amount);
                    const isCollected = cr > 0;
                    const isPaid = de > 0;

                    return (
                      <tr
                        key={e.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="p-4 text-center text-muted-foreground text-sm">
                          {(page - 1) * limit + idx + 1}
                        </td>
                        <td className="p-4 text-sm font-semibold">
                          TXN-{e.transaction_id}
                          <div
                            className={
                              "text-[10px] mt-1 uppercase font-bold inline-block px-1.5 py-0.5 rounded " +
                              (isCollected
                                ? "bg-success/10 text-success"
                                : "bg-danger/10 text-danger")
                            }
                          >
                            {e.ledger_transactions.type === "DEPOSIT"
                              ? "Nạp ví"
                              : e.ledger_transactions.type === "WITHDRAW"
                                ? "Rút tiền"
                                : e.ledger_transactions.type}
                          </div>
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {formatDateTime(e.created_at)}
                        </td>
                        <td
                          className="p-4 text-sm font-medium max-w-[200px] truncate"
                          title={e.ledger_transactions.description ?? undefined}
                        >
                          {e.ledger_transactions.description || "-"}
                        </td>
                        <td className="p-4 text-right font-bold w-40 shrink-0">
                          {isCollected ? (
                            <span className="text-success flex justify-end items-center gap-1">
                              <ArrowUpCircle className="w-4 h-4" /> +
                              {formatBalance(cr)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/30">-</span>
                          )}
                        </td>
                        <td className="p-4 text-right font-bold w-40 shrink-0">
                          {isPaid ? (
                            <div className="flex flex-col items-end">
                              <span className="text-danger flex items-center gap-1">
                                <ArrowDownCircle className="w-4 h-4" /> -
                                {formatBalance(de)}
                              </span>
                              <span className="text-[10px] text-muted-foreground uppercase mt-0.5">
                                Nộp ngân sách
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/30">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {data.data.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-12 text-center text-muted-foreground"
                      >
                        Không phát sinh biến động nào trong kỳ này.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="p-4 border-t border-border bg-muted/20">
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  limit={limit}
                  total={total}
                  onPageChange={setPage}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
