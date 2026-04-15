import { useState, useEffect } from 'react';
import { adminApi } from '@/api/admin.api';
import toast from 'react-hot-toast';
import { Search, FileText, Ban, CheckCircle, ExternalLink, ShieldCheck } from 'lucide-react';
import { formatBalance, formatDate } from '@/utils/format';
import { documentsApi } from '@/api/documents.api';
import { Link } from 'react-router-dom';
import { usePagination } from '@/hooks/usePagination';
import Pagination from '@/components/common/Pagination';

export default function AdminDocumentsPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categories, setCategories] = useState<any[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchDocuments();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, statusFilter, categoryFilter]);

  const fetchCategories = async () => {
    try {
      const res = await documentsApi.getCategories();
      setCategories(res.data || res);
    } catch (e) {
      console.error(e);
    }
  }

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getAllDocuments({
        search: searchTerm,
        status: statusFilter,
        categoryId: categoryFilter
      });
      setDocuments(res.data || res);
    } catch (err) {
      // Ignore initial loaded error
    } finally {
      setLoading(false);
    }
  };

  const filteredDocs = documents; // Backend handles filtering now
  const { page, setPage, totalPages, total, limit, paginatedItems } = usePagination(filteredDocs);

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading">Quản lý Tài liệu</h1>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Tìm tên tài liệu hoặc người bán..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div className="flex w-full md:w-auto gap-3">
            <select 
              value={categoryFilter} 
              onChange={e => setCategoryFilter(e.target.value)}
              className="bg-background border border-border rounded-lg text-sm px-3 py-2 outline-none focus:border-primary min-w-[150px]"
            >
              <option value="ALL">Tất cả danh mục</option>
              {categories.map(cat => (
                <option key={cat.category_id || cat.id} value={cat.category_id || cat.id}>{cat.name}</option>
              ))}
            </select>
            <select 
              value={statusFilter} 
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-background border border-border rounded-lg text-sm px-3 py-2 outline-none focus:border-primary min-w-[150px]"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PENDING">Chờ duyệt</option>
              <option value="APPROVED">Đã duyệt</option>
              <option value="REJECTED">Từ chối</option>
            </select>
            {(searchTerm || statusFilter !== 'ALL' || categoryFilter !== 'ALL') && (
              <button 
                onClick={() => { setSearchTerm(''); setStatusFilter('ALL'); setCategoryFilter('ALL'); }}
                className="text-sm px-3 py-2 text-muted-foreground hover:text-foreground transition-colors outline-none shrink-0 border border-transparent hover:border-border rounded-lg bg-transparent hover:bg-muted"
                title="Xóa bộ lọc"
              >
                Xóa lọc
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-muted/20 text-muted-foreground text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold">Tài liệu</th>
                <th className="p-4 font-semibold">Người bán</th>
                <th className="p-4 font-semibold">Giá</th>
                <th className="p-4 font-semibold">Trạng thái</th>
                <th className="p-4 font-semibold">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedItems.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Không có dữ liệu</td></tr>
              ) : paginatedItems.map((doc) => (
                <tr key={doc.id} className="hover:bg-muted/10">
                  <td className="p-4">
                     <p className="font-semibold text-sm line-clamp-1">{doc.title}</p>
                     <p className="text-xs text-muted-foreground mt-1">{formatDate(doc.createdAt)}</p>
                  </td>
                  <td className="p-4 text-sm">{doc.sellerName || doc.seller?.fullName}</td>
                  <td className="p-4 text-sm text-primary font-semibold">{formatBalance(doc.price)}</td>
                  <td className="p-4 text-sm">
                     <span className={`px-2 py-1 rounded text-xs font-bold ${doc.status === 'APPROVED' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                       {doc.status}
                     </span>
                  </td>
                  <td className="p-4">
                     <div className="flex items-center gap-2">
                       {doc.status === 'APPROVED' ? (
                         <Link to={`/documents/${doc.id}`} target="_blank" className="text-primary bg-primary/10 p-2 rounded hover:bg-primary/20 transition-colors" title="Xem trên cửa hàng">
                            <ExternalLink className="w-4 h-4" />
                         </Link>
                       ) : doc.status === 'PENDING' ? (
                         <Link to="/admin/approvals" className="text-warning bg-warning/10 p-2 rounded hover:bg-warning/20 transition-colors" title="Đi tới duyệt tài liệu">
                            <ShieldCheck className="w-4 h-4" />
                         </Link>
                       ) : (
                         <button className="text-muted-foreground bg-muted p-2 rounded cursor-not-allowed opacity-50" title="Không có hành động">
                            <Ban className="w-4 h-4" />
                         </button>
                       )}
                     </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} limit={limit} onPageChange={setPage} />
      </div>
    </div>
  );
}
