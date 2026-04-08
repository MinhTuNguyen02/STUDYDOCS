import { useState, useEffect } from 'react';
import { adminApi } from '@/api/admin.api';
import toast from 'react-hot-toast';
import { Ban, CheckCircle, Search } from 'lucide-react';
import { formatDate } from '@/utils/format';
import { useAuthStore } from '@/store/authStore';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const currentUser = useAuthStore(state => state.user);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getUsers();
      setUsers(res.data || res);
    } catch (err) {
      toast.error('Lỗi tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: number) => {
    try {
      await adminApi.toggleUserStatus(id);
      toast.success('Đã cập nhật trạng thái người dùng');
      fetchUsers();
    } catch (err) {
      toast.error('Có lỗi xảy ra');
    }
  };

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading">Quản lý Người dùng</h1>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Tìm theo email, tên..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Đang tải...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="p-4 font-semibold">Tài khoản</th>
                  <th className="p-4 font-semibold">Email</th>
                  <th className="p-4 font-semibold">Vai trò</th>
                  <th className="p-4 font-semibold">Tham gia</th>
                  <th className="p-4 font-semibold text-right">Trạng thái (Khóa/Mở)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/10">
                    <td className="p-4 font-semibold text-sm">{u.fullName || u.full_name}</td>
                    <td className="p-4 text-sm text-muted-foreground">{u.email}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded bg-primary/10 text-primary text-xs uppercase font-bold">
                        {u.role || u.roleNames?.[0] || 'CUSTOMER'}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{formatDate(u.joinedAt || u.created_at)}</td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleToggleStatus(u.id)}
                        disabled={currentUser?.accountId === u.id}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ml-auto transition-colors ${
                          currentUser?.accountId === u.id ? 'opacity-50 cursor-not-allowed bg-muted' : 'cursor-pointer'
                        } ${
                          (u.isActive || u.status === 'ACTIVE') && currentUser?.accountId !== u.id
                            ? 'bg-danger/10 text-danger hover:bg-danger/20'
                            : (!(u.isActive || u.status === 'ACTIVE') && currentUser?.accountId !== u.id)
                            ? 'bg-success/10 text-success hover:bg-success/20'
                            : ''
                        }`}
                      >
                        {u.isActive || u.status === 'ACTIVE' ? <><Ban className="w-3.5 h-3.5" /> Khóa</> : <><CheckCircle className="w-3.5 h-3.5" /> Mở khóa</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
