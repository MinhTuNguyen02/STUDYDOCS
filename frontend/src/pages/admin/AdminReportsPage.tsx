import { useState, useEffect, useCallback } from "react";
import { adminApi } from "@/api/admin.api";
import toast from "react-hot-toast";
import { AlertOctagon, CheckCircle } from "lucide-react";
import { formatDate } from "@/utils/format";
import Pagination from "@/components/common/Pagination";
import { useSearchParams } from "react-router-dom";

export default function AdminReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const statusFilter = searchParams.get("status") || "ALL";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = 10;
  const [total, setTotal] = useState(0);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminApi.getReports({
        status: statusFilter,
        page,
        limit,
      });
      setReports(res.data || res);
      setTotal(res.meta?.total ?? (res.data || res).length);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || "Không thể tải danh sách báo cáo";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

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

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleResolve = async (id: number) => {
    try {
      await adminApi.resolveReport(id, { status: "RESOLVED" });
      toast.success("Đã xử lý báo cáo");
      if (reports.length === 1 && page > 1 && statusFilter !== "ALL") {
        updateQuery({ page: page - 1 });
      } else {
        await fetchReports();
      }
    } catch (err) {
      toast.error("Lỗi khi xử lý");
    }
  };

  if (loading)
    return (
      <div className="py-24 text-center text-muted-foreground">
        Đang tải báo cáo...
      </div>
    );

  if (error)
    return (
      <div className="py-24 text-center">
        <p className="text-danger mb-4">{error}</p>
        <button
          onClick={fetchReports}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          Thử lại
        </button>
      </div>
    );

  return (
    <>
      <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
        <h1 className="text-2xl font-bold font-heading">Chi tiết Báo cáo</h1>

        {/* ── Filter ── */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => updateQuery({ status: e.target.value, page: 1 })}
              className="bg-background border border-border rounded-lg text-sm px-3 py-2 outline-none focus:border-primary min-w-[150px]"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PENDING">Đang chờ</option>
              <option value="REVIEWING">Đang xử lý</option>
              <option value="RESOLVED">Đã giải quyết</option>
              <option value="REJECTED">Đã từ chối</option>
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
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
              <tr>
                <th className="p-4 font-semibold">Ngày tạo</th>
                <th className="p-4 font-semibold">Người gửi</th>
                <th className="p-4 font-semibold">Lý do</th>
                <th className="p-4 font-semibold">Tài liệu</th>
                <th className="p-4 font-semibold">Trạng thái</th>
                <th className="p-4 font-semibold">Xử lý</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reports.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-8 text-center text-muted-foreground"
                  >
                    Không có dữ liệu
                  </td>
                </tr>
              ) : (
                reports.map((rep) => (
                  <tr key={rep.report_id} className="hover:bg-muted/10">
                    <td className="p-4 text-sm text-muted-foreground">
                      {formatDate(rep.created_at)}
                    </td>
                    <td className="p-4 text-sm">
                      <p className="font-semibold text-primary">
                        {rep.customer_profiles?.full_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {rep.customer_profiles?.accounts?.email}
                      </p>
                    </td>
                    <td className="p-4 text-sm">
                      <p className="font-semibold text-danger">{rep.type}</p>
                      <p className="text-muted-foreground">{rep.reason}</p>
                    </td>
                    <td
                      className="p-4 text-sm font-semibold text-primary"
                      title={`ID: ${rep.document_id}`}
                    >
                      {rep.documents?.title ||
                        `Tài liệu ID: ${rep.document_id}`}
                    </td>
                    <td className="p-4 text-sm font-bold">
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${rep.status === "RESOLVED" ? "bg-success/10 text-success" : rep.status === "PENDING" ? "bg-warning/10 text-warning" : rep.status === "REJECTED" ? "bg-danger/10 text-danger" : "bg-muted text-muted-foreground"}`}
                      >
                        {rep.status === "PENDING"
                          ? "Đang chờ"
                          : rep.status === "RESOLVED"
                            ? "Đã giải quyết"
                            : rep.status === "REJECTED"
                              ? "Từ chối"
                              : rep.status === "REVIEWING"
                                ? "Đang xử lý"
                                : rep.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => handleResolve(rep.report_id)}
                        className="p-2 bg-success/10 text-success rounded-lg hover:bg-success/20 cursor-pointer"
                        disabled={rep.status === "RESOLVED"}
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
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
      </div>
    </>
  );
}
