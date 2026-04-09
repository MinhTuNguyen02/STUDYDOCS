import { useState, useEffect, useMemo } from 'react';
import { adminApi } from '@/api/admin.api';
import toast from 'react-hot-toast';
import { Ban, CheckCircle, Search, Users, ShieldCheck, Plus, X, Eye, EyeOff, Info } from 'lucide-react';
import { formatDate } from '@/utils/format';
import { useAuthStore } from '@/store/authStore';

type TabType = 'customers' | 'staff';

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  ADMIN: { label: 'Admin', cls: 'bg-red-100 text-red-700 border-red-200' },
  MOD: { label: 'Mod', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
  ACCOUNTANT: { label: 'Kế toán', cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  STAFF: { label: 'Nhân viên', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  CUSTOMER: { label: 'Khách hàng', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const STAFF_ROLES = ['ADMIN', 'MOD', 'ACCOUNTANT', 'STAFF'];
const isStaff = (u: any) => STAFF_ROLES.includes((u.role || '').toUpperCase());

function RoleBadge({ role }: { role: string }) {
  const key = (role || 'CUSTOMER').toUpperCase();
  const badge = ROLE_BADGE[key] ?? ROLE_BADGE.CUSTOMER;
  return (
    <span className={`px-2.5 py-1 rounded-full border text-xs font-bold uppercase tracking-wide ${badge.cls}`}>
      {badge.label}
    </span>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return isActive
    ? <span className="inline-flex items-center gap-1 text-success text-xs font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse inline-block" /> Hoạt động</span>
    : <span className="inline-flex items-center gap-1 text-danger text-xs font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-danger inline-block" /> Bị khóa</span>;
}

export default function AdminUsersPage() {
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('customers');
  const currentUser = useAuthStore(state => state.user);

  // ── Create staff modal ──
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [staffForm, setStaffForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'MOD' as 'MOD' | 'ACCOUNTANT',
  });

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getUsers();
      setAllUsers(res.data || res);
    } catch {
      toast.error('Lỗi tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: number) => {
    try {
      await adminApi.toggleUserStatus(id);
      toast.success('Đã cập nhật trạng thái tài khoản');
      fetchUsers();
    } catch {
      toast.error('Có lỗi xảy ra');
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.fullName || !staffForm.email || !staffForm.password) {
      toast.error('Vui lòng điền đủ thông tin');
      return;
    }
    setCreating(true);
    try {
      await adminApi.createStaffAccount(staffForm);
      toast.success(`Đã tạo tài khoản ${staffForm.role === 'MOD' ? 'Moderator' : 'Kế toán'} thành công!`);
      setShowCreateModal(false);
      setStaffForm({ fullName: '', email: '', password: '', role: 'MOD' });
      fetchUsers();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể tạo tài khoản');
    } finally {
      setCreating(false);
    }
  };

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return allUsers.filter(u => {
      const matchesTab = activeTab === 'staff' ? isStaff(u) : !isStaff(u);
      if (!matchesTab) return false;
      if (!term) return true;
      return (
        (u.email || '').toLowerCase().includes(term) ||
        (u.fullName || '').toLowerCase().includes(term)
      );
    });
  }, [allUsers, searchTerm, activeTab]);

  const customerCount = useMemo(() => allUsers.filter(u => !isStaff(u)).length, [allUsers]);
  const staffCount = useMemo(() => allUsers.filter(u => isStaff(u)).length, [allUsers]);

  const isCurrentUser = (u: any) => currentUser?.accountId === u.id;
  const isAdmin = (currentUser as any)?.roleNames?.some((r: string) => r.toLowerCase() === 'admin');

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading">Quản lý Người dùng</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Tổng cộng <strong>{allUsers.length}</strong> tài khoản ({customerCount} khách hàng, {staffCount} nhân viên)
          </p>
        </div>
        {activeTab === 'staff' && isAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn bg-primary text-white hover:bg-primary-hover px-4 py-2 flex items-center gap-2 rounded-xl text-sm font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4" /> Tạo tài khoản nhân viên
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('customers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'customers'
            ? 'bg-card shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          <Users className="w-4 h-4" />
          Khách hàng
          <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-bold">
            {customerCount}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'staff'
            ? 'bg-card shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground'
            }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Nhân viên & Admin
          <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-bold">
            {staffCount}
          </span>
        </button>
      </div>

      {/* Table card */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={activeTab === 'customers' ? 'Tìm khách hàng...' : 'Tìm nhân viên...'}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-muted-foreground animate-pulse">Đang tải dữ liệu...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">Không có dữ liệu phù hợp.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="p-4 font-semibold">Tên / Email</th>
                  <th className="p-4 font-semibold">Vai trò</th>
                  <th className="p-4 font-semibold">Tình trạng</th>
                  <th className="p-4 font-semibold">Tham gia</th>
                  {activeTab === 'customers' && (
                    <th className="p-4 font-semibold text-center">
                      <span className="inline-flex items-center gap-1.5 justify-center">
                        Tài liệu
                        <span className="group relative cursor-help z-99999">
                          <Info className="w-3.5 h-3.5 text-muted-foreground/70 hover:text-primary transition-colors" />
                          <div className="absolute top-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-popover text-popover-foreground text-xs rounded-xl shadow-xl border border-border p-3 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 text-left font-normal normal-case tracking-normal">
                            <p className="font-semibold mb-1">Ý nghĩa tỉ số:</p>
                            <p><strong className="text-primary">Số đầu</strong> — Tổng số tài liệu đã được duyệt</p>
                            <p className="mt-1"><strong className="text-success">Số sau</strong> — Tổng lượt bán của tất cả tài liệu</p>
                          </div>
                        </span>
                      </span>
                    </th>
                  )}
                  <th className="p-4 font-semibold text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((u) => (
                  <tr key={u.id} className={`hover:bg-muted/10 transition-colors ${isCurrentUser(u) ? 'opacity-60' : ''}`}>
                    <td className="p-4">
                      <div className="font-semibold text-foreground">{u.fullName || '—'}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{u.email}</div>
                    </td>
                    <td className="p-4">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="p-4">
                      <StatusBadge isActive={u.isActive || u.accountStatus === 'ACTIVE'} />
                    </td>
                    <td className="p-4 text-muted-foreground text-xs">
                      {formatDate(u.joinedAt || u.created_at)}
                    </td>
                    {activeTab === 'customers' && (
                      <td className="p-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <span className="font-bold text-primary">{u.documentsCount ?? 0}</span>
                          <span className="text-muted-foreground text-xs">TL /</span>
                          <span className="font-bold text-success">{u.totalSales ?? 0}</span>
                          <span className="text-muted-foreground text-xs">bán</span>
                        </div>
                      </td>
                    )}
                    <td className="p-4 text-right">
                      {isCurrentUser(u) ? (
                        <span className="text-xs text-muted-foreground italic">Tài khoản hiện tại</span>
                      ) : (
                        <button
                          onClick={() => handleToggleStatus(u.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ml-auto transition-colors ${u.isActive || u.accountStatus === 'ACTIVE'
                            ? 'bg-danger/10 text-danger hover:bg-danger/20'
                            : 'bg-success/10 text-success hover:bg-success/20'
                            }`}
                        >
                          {u.isActive || u.accountStatus === 'ACTIVE'
                            ? <><Ban className="w-3.5 h-3.5" /> Khóa</>
                            : <><CheckCircle className="w-3.5 h-3.5" /> Mở khóa</>
                          }
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Staff Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
              <h3 className="text-lg font-bold font-heading flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Tạo tài khoản Nhân viên
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="p-6 space-y-4">
              {/* Role selector */}
              <div>
                <label className="block text-sm font-semibold mb-2 text-foreground">Vai trò <span className="text-danger">*</span></label>
                <div className="grid grid-cols-2 gap-3">
                  {(['MOD', 'ACCOUNTANT'] as const).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setStaffForm(p => ({ ...p, role: r }))}
                      className={`p-3 rounded-xl border-2 text-sm font-bold transition-all ${staffForm.role === r
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/50'
                        }`}
                    >
                      {r === 'MOD' ? '🛡️ Moderator' : '💼 Kế toán'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-foreground">Họ và tên <span className="text-danger">*</span></label>
                <input
                  type="text"
                  value={staffForm.fullName}
                  onChange={e => setStaffForm(p => ({ ...p, fullName: e.target.value }))}
                  placeholder="Nguyễn Văn A"
                  className="w-full px-3 py-2 border border-border rounded-xl bg-background focus:ring-2 focus:ring-primary/20 outline-none text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-foreground">Email <span className="text-danger">*</span></label>
                <input
                  type="email"
                  value={staffForm.email}
                  onChange={e => setStaffForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="staff@studydocs.vn"
                  className="w-full px-3 py-2 border border-border rounded-xl bg-background focus:ring-2 focus:ring-primary/20 outline-none text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-foreground">Mật khẩu <span className="text-danger">*</span></label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={staffForm.password}
                    onChange={e => setStaffForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="Mật khẩu ban đầu"
                    className="w-full px-3 py-2 pr-10 border border-border rounded-xl bg-background focus:ring-2 focus:ring-primary/20 outline-none text-sm"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Tối thiểu 6 ký tự. Nhân viên nên đổi mật khẩu sau khi đăng nhập lần đầu.</p>
              </div>

              <div className="pt-2 flex gap-3 border-t border-border mt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-semibold text-sm transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold text-sm transition-colors shadow-sm disabled:opacity-60"
                >
                  {creating ? 'Đang tạo...' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
