import { useState, useEffect, useCallback } from "react";
import { adminApi } from "@/api/admin.api";
import toast from "react-hot-toast";
import { ShieldCheck, XCircle } from "lucide-react";
import { formatBalance, formatDate } from "@/utils/format";
import Pagination from "@/components/common/Pagination";
import { useSearchParams } from "react-router-dom";

export default function AdminWithdrawalsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const statusFilter = searchParams.get("status") || "ALL";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = 10;
  const [total, setTotal] = useState(0);

  const fetchWithdrawals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminApi.getWithdrawals({
        status: statusFilter,
        page,
        limit,
      });
      setWithdrawals(res.data || res);
      setTotal(res.meta?.total ?? (res.data || res).length);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || "Lỗi tải danh sách yêu cầu rút tiền";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    void fetchWithdrawals();
  }, [fetchWithdrawals]);

  const updateQuery = useCallback(
    (updates: { status?: string; page?: number }) => {
      const next = new URLSearchParams(searchParams);
      if (updates.status !== undefined) {
        !updates.status || updates.status === "ALL"
          ? next.delete("status")
          : next.set("status", updates.status);
      }
      if (updates.page !== undefined) {
        updates.page <= 1
          ? next.delete("page")
          : next.set("page", String(updates.page));
      }
      setSearchParams(next);
    },
    [searchParams, setSearchParams],
  );

  const handleAction = async (id: number, status: "PAID" | "REJECTED") => {
    const note =
      status === "REJECTED"
        ? prompt("Mời nhập lý do từ chối (bắt buộc):")
        : "Duyệt tự động từ Admin Panel";
    if (status === "REJECTED" && !note) return;

    try {
      await adminApi.processWithdrawal(id, { status, note: note || undefined });
      toast.success(
        status === "PAID" ? "Đã duyệt yêu cầu rút tiền" : "Đã từ chối rút tiền",
      );
      if (withdrawals.length === 1 && page > 1 && statusFilter !== "ALL") {
        updateQuery({ page: page - 1 });
      } else {
        await fetchWithdrawals();
      }
    } catch (err) {
      toast.error("Có lỗi xảy ra khi xử lý");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <>
      <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold font-heading">Quản lý Rút tiền</h1>
        </div>

        {/* ── Filter ── */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => updateQuery({ status: e.target.value, page: 1 })}
              className="bg-background border border-border rounded-lg text-sm px-3 py-2 outline-none focus:border-primary min-w-[150px]"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PENDING">Chờ duyệt</option>
              <option value="PAID">Hoàn tất</option>
              <option value="REJECTED">Từ chối</option>
            </select>

            {statusFilter !== "ALL" && (
              <button
                onClick={() => updateQuery({ status: "ALL", page: 1 })}
                className="text-sm px-3 py-2 text-muted-foreground hover:text-foreground transition-colors outline-none border border-transparent hover:border-border rounded-lg bg-transparent hover:bg-muted"
                title="Xóa bộ lọc"
              >
                Xóa lọc
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">
            Đang tải...
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                  <tr>
                    <th className="p-4 font-semibold">Tài khoản Yêu cầu</th>
                    <th className="p-4 font-semibold">Số tiền</th>
                    <th className="p-4 font-semibold">Thuế</th>
                    <th className="p-4 font-semibold">Thực nhận</th>
                    <th className="p-4 font-semibold">Ngân hàng</th>
                    <th className="p-4 font-semibold">Trạng thái</th>
                    <th className="p-4 font-semibold">Ngày tạo</th>
                    <th className="p-4 font-semibold text-right">
                      Duyệt/Từ chối
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="p-8 text-center text-muted-foreground"
                      >
                        Đang tải danh sách yêu cầu rút tiền...
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center">
                        <p className="text-danger mb-4 font-medium">{error}</p>
                        <button
                          onClick={fetchWithdrawals}
                          className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
                        >
                          Thử lại
                        </button>
                      </td>
                    </tr>
                  ) : withdrawals.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="p-8 text-center text-muted-foreground"
                      >
                        Không có dữ liệu
                      </td>
                    </tr>
                  ) : (
                    withdrawals.map((w) => (
                      <tr key={w.request_id} className="hover:bg-muted/10">
                        <td className="p-4">
                          <div className="font-semibold text-sm">
                            {w.customer_profiles.full_name}
                          </div>
                          <p className="text-muted-foreground">
                            {w.customer_profiles.accounts.email}
                          </p>
                        </td>
                        <td className="p-4 font-bold text-primary">
                          {formatBalance(w.amount)}
                        </td>
                        <td className="p-4 font-bold text-primary">
                          {formatBalance(w.tax_amount)}
                        </td>
                        <td className="p-4 font-bold text-success">
                          {formatBalance(w.net_amount)}
                        </td>
                        <td className="p-4 text-sm">
                          <p className="font-semibold">{w.bank_info.bank}</p>
                          <p className="text-muted-foreground">
                            {w.bank_info.account}
                          </p>
                          <p className="text-muted-foreground">
                            {w.bank_info.accountName}
                          </p>
                        </td>
                        <td className="p-4">
                          {w.status === "PENDING" && (
                            <span className="bg-warning/10 text-warning px-2 py-1 rounded text-xs font-bold">
                              Chờ duyệt
                            </span>
                          )}
                          {w.status === "PAID" && (
                            <span className="bg-success/10 text-success px-2 py-1 rounded text-xs font-bold">
                              Hoàn tất
                            </span>
                          )}
                          {w.status === "REJECTED" && (
                            <span className="bg-danger/10 text-danger px-2 py-1 rounded text-xs font-bold">
                              Từ chối
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {formatDate(w.created_at)}
                        </td>
                        <td className="p-4 text-right">
                          {w.status === "PENDING" ? (
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() =>
                                  handleAction(w.request_id, "PAID")
                                }
                                className="p-2 bg-success text-white rounded-lg hover:bg-success/90 cursor-pointer"
                                title="Duyệt"
                              >
                                <ShieldCheck className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  handleAction(w.request_id, "REJECTED")
                                }
                                className="p-2 bg-danger/10 text-danger rounded-lg hover:bg-danger/20 cursor-pointer"
                                title="Từ chối"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm italic">
                              Đã xử lý
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              limit={limit}
              onPageChange={(nextPage) => updateQuery({ page: nextPage })}
            />
          </>
        )}
      </div>
    </>
  );
}
