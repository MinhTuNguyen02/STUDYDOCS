import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { sellerApi } from "@/api/seller.api";
import { FileText, Plus, Search, Filter, EyeOff, Eye } from "lucide-react";
import toast from "react-hot-toast";
import { formatBalance, formatDate } from "@/utils/format";
import SellerLayout from "@/components/layout/SellerLayout";

export default function SellerDocumentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filter = searchParams.get("status") || "ALL";
  const search = searchParams.get("search") || "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const [searchInput, setSearchInput] = useState(search);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0 });

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await sellerApi.getMyDocuments({
        status: filter === "ALL" ? undefined : filter,
        search,
        page,
        limit: 10,
      });
      setDocuments(res.data || res);
      if (res.meta) setMeta(res.meta);
    } catch (err) {
      const msg =
        (err as any)?.response?.data?.message ||
        "Không thể tải danh sách tài liệu";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [filter, page, search]);

  useEffect(() => {
    void fetchDocs();
  }, [fetchDocs]);
  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const updateQuery = useCallback(
    (updates: { status?: string; search?: string; page?: number }) => {
      const next = new URLSearchParams(searchParams);
      if (updates.status !== undefined) {
        updates.status === "ALL"
          ? next.delete("status")
          : next.set("status", updates.status);
      }
      if (updates.search !== undefined) {
        updates.search
          ? next.set("search", updates.search)
          : next.delete("search");
      }
      if (updates.page !== undefined) {
        updates.page <= 1
          ? next.delete("page")
          : next.set("page", String(updates.page));
      }
      if (next.toString() !== searchParams.toString()) {
        setSearchParams(next, { replace: true });
      }
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    const timer = window.setTimeout(
      () => updateQuery({ search: searchInput.trim(), page: 1 }),
      500,
    );
    return () => window.clearTimeout(timer);
  }, [searchInput, updateQuery]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="px-2 py-1 bg-success/10 text-success text-xs font-bold rounded-md">
            Đã duyệt
          </span>
        );
      case "PENDING":
        return (
          <span className="px-2 py-1 bg-warning/10 text-warning text-xs font-bold rounded-md">
            Chờ duyệt
          </span>
        );
      case "REJECTED":
        return (
          <span className="px-2 py-1 bg-danger/10 text-danger text-xs font-bold rounded-md">
            Từ chối
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-muted text-muted-foreground text-xs font-bold rounded-md">
            {status}
          </span>
        );
    }
  };

  const handleToggleVisibility = async (id: number, isHidden: boolean) => {
    try {
      await sellerApi.toggleDocumentVisibility(id, !isHidden);
      toast.success(
        !isHidden ? "Đã ẩn tài liệu thành công" : "Đã hiện tài liệu thành công",
      );
      fetchDocs();
    } catch (err) {
      toast.error("Có lỗi xảy ra khi thay đổi trạng thái hiển thị");
    }
  };

  return (
    <SellerLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold font-heading flex items-center gap-3">
          <FileText className="w-8 h-8 text-primary" /> Quản lý tài liệu
        </h1>
        <Link
          to="/seller/documents/new"
          className="btn btn-primary inline-flex gap-2 whitespace-nowrap"
        >
          <Plus className="w-5 h-5" /> Tải lên mới
        </Link>
      </div>

      <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 justify-between bg-muted/20">
          <div className="relative max-w-sm w-full">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm tên tài liệu..."
              className="w-full pl-10 pr-4 py-2 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-muted-foreground" />
            <select
              value={filter}
              onChange={(e) => updateQuery({ status: e.target.value, page: 1 })}
              className="px-4 py-2 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:outline-none bg-background font-medium"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="APPROVED">Đã duyệt</option>
              <option value="PENDING">Chờ duyệt</option>
              <option value="REJECTED">Bị từ chối</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-muted text-muted-foreground text-xs uppercase tracking-wide">
                <th className="p-4 font-semibold">Tên tài liệu</th>
                <th className="p-4 font-semibold">Giá bán</th>
                <th className="p-4 font-semibold">Lượt xem</th>
                <th className="p-4 font-semibold">Lượt tải</th>
                <th className="p-4 font-semibold">Ngày tải lên</th>
                <th className="p-4 font-semibold">Trạng thái</th>
                <th className="p-4 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="p-8 text-center text-muted-foreground"
                  >
                    Đang tải danh sách tài liệu...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <p className="text-danger mb-4 font-medium">{error}</p>
                    <button
                      onClick={fetchDocs}
                      className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      Thử lại
                    </button>
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="p-12 text-center text-muted-foreground"
                  >
                    <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
                    <p>
                      {search
                        ? "Không tìm thấy tài liệu khớp."
                        : "Chưa có tài liệu nào."}
                    </p>
                  </td>
                </tr>
              ) : (
                documents.map((doc: any) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td
                      className="p-4 font-medium max-w-xs truncate"
                      title={doc.title}
                    >
                      {doc.title}
                    </td>
                    <td className="p-4 font-bold text-primary">
                      {formatBalance(doc.price)}
                    </td>
                    <td className="p-4 text-muted-foreground text-sm">
                      {doc.viewCount ?? 0}
                    </td>
                    <td className="p-4 text-muted-foreground text-sm">
                      {doc.downloadCount ?? 0}
                    </td>
                    <td className="p-4 text-muted-foreground text-sm">
                      {formatDate(doc.createdAt || doc.created_at)}
                    </td>
                    <td className="p-4">
                      {getStatusBadge(doc.status)}
                      {doc.status === "REJECTED" && doc.rejectionReason && (
                        <div className="text-xs text-danger mt-1">
                          Lý do: {doc.rejectionReason}
                        </div>
                      )}
                      {doc.isUserHidden && (
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <EyeOff className="w-3 h-3" /> Đã ẩn (Người bán)
                        </div>
                      )}
                      {doc.status === "HIDDEN" && (
                        <div className="text-xs text-danger mt-1 flex items-center gap-1">
                          <EyeOff className="w-3 h-3" /> Đã bị ẩn (Admin)
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-right flex items-center justify-end gap-3">
                      <button
                        onClick={() =>
                          handleToggleVisibility(doc.id, doc.isUserHidden)
                        }
                        title={
                          doc.isUserHidden ? "Hiển thị lại" : "Tạm ẩn tài liệu"
                        }
                        className="text-muted-foreground hover:text-primary transition-colors"
                      >
                        {doc.isUserHidden ? (
                          <span className="text-success text-sm font-semibold">
                            Công khai
                          </span>
                        ) : (
                          <span className="text-danger text-sm font-semibold">
                            Ẩn
                          </span>
                        )}
                      </button>
                      <Link
                        to={`/documents/${doc.id}`}
                        className="text-primary hover:underline text-sm font-semibold"
                      >
                        Xem
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {meta.total > meta.limit && (
          <div className="p-4 border-t border-border flex justify-between items-center bg-muted/10">
            <span className="text-sm text-muted-foreground">
              Hiển thị tối đa {meta.limit} tài liệu (Tổng cộng: {meta.total})
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => updateQuery({ page: page - 1 })}
                className="px-3 py-1.5 text-sm font-semibold bg-background border border-border rounded-lg disabled:opacity-50 hover:bg-muted"
              >
                Trang trước
              </button>
              <span className="px-3 py-1.5 text-sm font-semibold bg-background border border-border rounded-lg">
                Trang {page} / {Math.ceil(meta.total / meta.limit)}
              </span>
              <button
                disabled={page * meta.limit >= meta.total}
                onClick={() => updateQuery({ page: page + 1 })}
                className="px-3 py-1.5 text-sm font-semibold bg-background border border-border rounded-lg disabled:opacity-50 hover:bg-muted"
              >
                Trang sau
              </button>
            </div>
          </div>
        )}
      </div>
    </SellerLayout>
  );
}
