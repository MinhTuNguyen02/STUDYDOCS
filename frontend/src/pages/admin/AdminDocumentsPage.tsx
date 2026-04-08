import { useState, useEffect } from 'react';
import { adminApi } from '@/api/admin.api';
import toast from 'react-hot-toast';
import { Search, FileText, Ban, CheckCircle } from 'lucide-react';
import { formatBalance, formatDate } from '@/utils/format';

export default function AdminDocumentsPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getAllDocuments();
      setDocuments(res.data || res);
    } catch (err) {
      // Ignore initial loaded error
    } finally {
      setLoading(false);
    }
  };

  const filteredDocs = documents.filter(d => 
    d.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading">Quản lý Tài liệu</h1>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Tìm kiếm tài liệu..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
            />
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
              {filteredDocs.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Không có dữ liệu</td></tr>
              ) : filteredDocs.map((doc) => (
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
                     <button className="text-danger bg-danger/10 p-2 rounded hover:bg-danger/20 cursor-not-allowed opacity-50" title="Đang cập nhật">
                        <Ban className="w-4 h-4" />
                     </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
