import { useState, useEffect } from 'react';
import { adminApi } from '@/api/admin.api';
import toast from 'react-hot-toast';
import { FileCheck, XCircle, Search, X, FileText, Tag, Info, Eye, ExternalLink } from 'lucide-react';
import { formatBalance, formatDate } from '@/utils/format';

interface PendingDoc {
  id: number;
  title: string;
  sellerName: string;
  categoryName: string;
  price: number;
  createdAt: string;
  status: string;
  tags: string[];
  description: string;
  format: string;
  pageCount: number;
  fileExtension: string;
  size: string;
  previewSignedUrl?: string | null;  // 30% watermarked preview (for buyers sample)
  reviewSignedUrl?: string | null;   // 100% full-page review PDF (staff only, 2h TTL)
}

export default function AdminApprovalsPage() {
  const [documents, setDocuments] = useState<PendingDoc[]>([]);
  const [filtered, setFiltered] = useState<PendingDoc[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [previewDoc, setPreviewDoc] = useState<PendingDoc | null>(null);

  useEffect(() => { fetchPendingDocuments(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(q ? documents.filter(d =>
      d.title.toLowerCase().includes(q) ||
      d.sellerName.toLowerCase().includes(q) ||
      d.categoryName.toLowerCase().includes(q)
    ) : documents);
  }, [search, documents]);

  const fetchPendingDocuments = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getApprovals();
      const data = res.data || res;
      setDocuments(data);
      setFiltered(data);
    } catch {
      toast.error('Lỗi khi tải danh sách kiểm duyệt');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    setProcessingId(id);
    try {
      await adminApi.approveDocument(id);
      toast.success('Đã duyệt tài liệu thành công');
      setDocuments(docs => docs.filter(d => d.id !== id));
      if (previewDoc?.id === id) setPreviewDoc(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Có lỗi xảy ra');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectId || !reason.trim()) return toast.error('Vui lòng nhập lý do');
    setProcessingId(rejectId);
    try {
      await adminApi.rejectDocument(rejectId, reason);
      toast.success('Đã từ chối tài liệu');
      setDocuments(docs => docs.filter(d => d.id !== rejectId));
      if (previewDoc?.id === rejectId) setPreviewDoc(null);
      setRejectId(null);
      setReason('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Có lỗi xảy ra');
    } finally {
      setProcessingId(null);
    }
  };

  // Prefer full review PDF if available, fall back to 30% preview
  const getViewUrl = (doc: PendingDoc) => doc.reviewSignedUrl || doc.previewSignedUrl || null;

  const handleReviewOriginal = async (id: number) => {
    // Audit log will still be recorded on backend reliably without halting UX
    setProcessingId(id);
    try {
      const res = await adminApi.getDocumentReviewUrl(id);
      if (res && res.reviewUrl) {
        window.open(res.reviewUrl, '_blank');
      } else {
        toast.error("Không thể lấy link bản gốc.");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Có lỗi xảy ra khi lấy bản gốc');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return (
    <div className="p-12 text-center text-muted-foreground">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      Đang tải danh sách kiểm duyệt...
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading text-foreground">
          Kiểm duyệt Tài liệu
          {documents.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-warning/10 text-warning rounded-full text-sm">{documents.length}</span>
          )}
        </h1>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {/* Search bar */}
        <div className="p-4 border-b border-border bg-muted/30 flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm theo tên, người gửi, danh mục..."
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <span className="text-xs text-muted-foreground">{filtered.length} tài liệu</span>
        </div>

        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
              <FileCheck className="w-12 h-12 mb-3 text-muted-foreground/50" />
              <p>{search ? 'Không tìm thấy kết quả.' : 'Không có tài liệu nào đang chờ kiểm duyệt.'}</p>
              {!search && <p className="text-sm mt-1">Tuyệt vời, bạn đã xử lý xong mọi việc!</p>}
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="p-4 font-semibold">Tài liệu</th>
                  <th className="p-4 font-semibold">Người gửi</th>
                  <th className="p-4 font-semibold">Giá</th>
                  <th className="p-4 font-semibold">Ngày gửi</th>
                  <th className="p-4 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((doc) => (
                  <tr key={doc.id} className="hover:bg-muted/10 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                          {doc.format || 'DOC'}
                        </div>
                        <div>
                          <p className="font-semibold text-sm line-clamp-1">{doc.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{doc.categoryName} · {doc.size}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm">{doc.sellerName}</td>
                    <td className="p-4 text-sm font-semibold">
                      {Number(doc.price) === 0
                        ? <span className="text-success">Miễn phí</span>
                        : <span className="text-primary">{formatBalance(doc.price)}</span>}
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{formatDate(doc.createdAt)}</td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setPreviewDoc(doc)}
                          className="px-3 py-1.5 bg-accent text-foreground hover:bg-muted rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> Xem
                        </button>
                        <button
                          onClick={() => handleApprove(doc.id)}
                          disabled={processingId === doc.id}
                          className="px-3 py-1.5 bg-success text-white hover:bg-success/90 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <FileCheck className="w-3.5 h-3.5" /> Duyệt
                        </button>
                        <button
                          onClick={() => setRejectId(doc.id)}
                          disabled={processingId === doc.id}
                          className="px-3 py-1.5 bg-danger/10 text-danger hover:bg-danger/20 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Từ chối
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Preview Modal ── */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-card rounded-2xl w-full max-w-4xl shadow-2xl my-8 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-border flex items-start justify-between gap-4">
              <div>
                <h2 className="font-bold text-lg line-clamp-2">{previewDoc.title}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Bởi <strong>{previewDoc.sellerName}</strong> · {previewDoc.categoryName} · {previewDoc.size}
                </p>
              </div>
              <button onClick={() => setPreviewDoc(null)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
              {/* Left: metadata */}
              <div className="md:col-span-1 border-r border-border p-5 space-y-5">
                {/* Price, pages */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/40 rounded-xl p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Giá bán</p>
                    <p className="font-bold text-base">
                      {Number(previewDoc.price) === 0 ? <span className="text-success">Miễn phí</span> : formatBalance(previewDoc.price)}
                    </p>
                  </div>
                  <div className="bg-muted/40 rounded-xl p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Số trang</p>
                    <p className="font-bold text-base">{previewDoc.pageCount ?? '—'}</p>
                  </div>
                </div>

                {/* Metadata */}
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Định dạng:</span>
                    <span className="font-semibold">{previewDoc.format}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Ngày gửi:</span>
                    <span className="font-semibold">{formatDate(previewDoc.createdAt)}</span>
                  </div>
                </div>

                {/* Tags */}
                {previewDoc.tags?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" /> Tags
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {previewDoc.tags.map(tag => (
                        <span key={tag} className="px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Mô tả</p>
                  <p className="text-sm text-foreground/80 leading-relaxed max-h-40 overflow-y-auto">{previewDoc.description || 'Không có mô tả.'}</p>
                </div>

                {/* Action buttons */}
                <div className="pt-2 space-y-2.5">
                  <button
                    onClick={() => { handleApprove(previewDoc.id); }}
                    disabled={processingId === previewDoc.id}
                    className="w-full py-2.5 bg-success text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-success/90 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <FileCheck className="w-4 h-4" />
                    {processingId === previewDoc.id ? 'Đang xử lý...' : 'Duyệt tài liệu'}
                  </button>
                  <button
                    onClick={() => { setRejectId(previewDoc.id); }}
                    disabled={processingId === previewDoc.id}
                    className="w-full py-2.5 bg-danger/10 text-danger rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-danger/20 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    Từ chối
                  </button>
                  <div className="pt-3 border-t border-border mt-3">
                    <button
                      onClick={() => handleReviewOriginal(previewDoc.id)}
                      disabled={processingId === previewDoc.id}
                      className="w-full py-2 bg-muted/60 text-foreground hover:text-primary hover:bg-muted rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
                      title="Mở toàn bộ file gốc ở tab mới"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {processingId === previewDoc.id ? 'Đang tải...' : 'Xem toàn văn (File Gốc)'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right: file viewer */}
              <div className="md:col-span-2 p-5 flex flex-col">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Xem nội dung tài liệu</p>

                              {(() => {
                  const viewUrl = getViewUrl(previewDoc);
                  if (!viewUrl) {
                    return (
                      <div className="flex-1 bg-muted/30 rounded-xl flex flex-col items-center justify-center gap-3 min-h-60 border border-dashed border-border">
                        <FileText className="w-12 h-12 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground text-center font-semibold">Không có bản xem trước PDF</p>
                        <p className="text-xs text-muted-foreground/70 text-center max-w-xs">
                          Tài liệu chưa có preview được tạo (có thể upload thất bại hoặc đang xử lý).
                          Bạn vẫn có thể duyệt dựa trên mô tả và thông tin bên cạnh.
                        </p>
                      </div>
                    );
                  }

                  // Preview is always a PDF (generated by pdf-lib with watermark)
                  return (
                    <div className="flex-1 flex flex-col gap-2">
                      <iframe
                        src={viewUrl}
                        title={`Preview: ${previewDoc.title}`}
                        className="w-full flex-1 min-h-[500px] rounded-xl border border-border"
                      />
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          {previewDoc.reviewSignedUrl
                            ? '📄 Bản xem duyệt đầy đủ (chỉ dành cho nhân viên, xóa sau khi duyệt/từ chối).'
                            : '⚠️ Bản xem trước có watermark (30% đầu). Nhân viên xem để tham khảo.'}
                        </p>
                        <a
                          href={viewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors font-medium"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Mở tab mới
                        </a>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal ── */}
      {rejectId && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-border font-bold text-lg flex justify-between items-center">
              Từ chối Tài liệu
              <button onClick={() => setRejectId(null)} className="text-muted-foreground hover:text-foreground cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleReject} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Lý do từ chối</label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-danger min-h-[100px]"
                  placeholder="Vd: Tài liệu sai định dạng, vi phạm bản quyền..."
                  required
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setRejectId(null)} className="px-4 py-2 hover:bg-muted rounded-xl transition-colors font-medium">
                  Hủy
                </button>
                <button type="submit" disabled={processingId === rejectId} className="px-6 py-2 bg-danger text-white rounded-xl hover:bg-danger/90 transition-colors font-bold shadow-md disabled:opacity-50">
                  {processingId === rejectId ? 'Đang xử lý...' : 'Xác nhận Từ chối'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
