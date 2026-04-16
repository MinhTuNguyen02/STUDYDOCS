import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import {
  LayoutDashboard, FileCheck, FileText, Users, Tags, AlertTriangle,
  MessageSquareWarning, WalletCards, Calculator, BarChart3, Settings,
  ShieldCheck, ScrollText, Package, LogOut, Menu, X, Library,
  FolderTree, Vault
} from 'lucide-react';

interface Props {
  children: ReactNode;
}

export default function AdminLayout({ children }: Props) {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const role = user?.roleNames?.[0]?.toLowerCase() || '';

  const menuGroups = [
    {
      label: 'Tổng Quan',
      items: [
        { name: 'Dashboard', path: '/admin', icon: <LayoutDashboard className="w-5 h-5" />, roles: ['admin', 'mod', 'accountant'] },
      ]
    },
    {
      label: 'Quản lý Nội dung',
      items: [
        { name: 'Kiểm duyệt Tài liệu', path: '/admin/approvals', icon: <FileCheck className="w-5 h-5" />, roles: ['admin', 'mod'] },
        { name: 'Quản lý Tài liệu', path: '/admin/documents', icon: <FileText className="w-5 h-5" />, roles: ['admin', 'mod'] },
        { name: 'Danh mục', path: '/admin/categories', icon: <FolderTree className="w-5 h-5" />, roles: ['admin', 'mod'] },
        { name: 'Quản lý Tags', path: '/admin/tags', icon: <Tags className="w-5 h-5" />, roles: ['admin', 'mod'] },
        { name: 'Gói Download', path: '/admin/packages', icon: <Package className="w-5 h-5" />, roles: ['admin'] },
      ]
    },
    {
      label: 'Cộng đồng & Support',
      items: [
        { name: 'Quản lý Người dùng', path: '/admin/users', icon: <Users className="w-5 h-5" />, roles: ['admin', 'mod'] },
        { name: 'Báo cáo Vi phạm', path: '/admin/reports', icon: <AlertTriangle className="w-5 h-5" />, roles: ['admin', 'mod'] },
        { name: 'Khiếu nại', path: '/admin/disputes', icon: <MessageSquareWarning className="w-5 h-5" />, roles: ['admin', 'mod'] },
      ]
    },
    {
      label: 'Kế toán & Tài chính',
      items: [
        { name: 'Quản lý Rút tiền', path: '/admin/withdrawals', icon: <WalletCards className="w-5 h-5" />, roles: ['admin', 'accountant'] },
        { name: 'Đối soát Tài chính', path: '/admin/reconciliation', icon: <Calculator className="w-5 h-5" />, roles: ['admin', 'accountant'] },
        { name: 'Báo cáo Doanh thu', path: '/admin/revenue', icon: <BarChart3 className="w-5 h-5" />, roles: ['admin', 'accountant'] },
        { name: 'Theo Dõi Tài Sản', path: '/admin/gateway', icon: <Vault className="w-5 h-5" />, roles: ['admin', 'accountant'] },
        { name: 'Thuế TNCN', path: '/admin/tax', icon: <ShieldCheck className="w-5 h-5" />, roles: ['admin', 'accountant'] },
      ]
    },
    {
      label: 'Cấu hình Hệ thống',
      items: [
        { name: 'Chính sách', path: '/admin/policies', icon: <ScrollText className="w-5 h-5" />, roles: ['admin'] },
        { name: 'Tham số Hệ thống', path: '/admin/configs', icon: <Settings className="w-5 h-5" />, roles: ['admin'] },
        { name: 'Nhật ký Hoạt động', path: '/admin/audit-logs', icon: <ShieldCheck className="w-5 h-5" />, roles: ['admin'] },
      ]
    }
  ];

  const filteredGroups = menuGroups.map(group => ({
    ...group,
    items: group.items.filter(item => item.roles.includes(role))
  })).filter(group => group.items.length > 0);

  return (
    <div className="min-h-screen bg-bg-secondary flex">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-card border-r border-border 
        flex flex-col transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-border shrink-0">
          <Link to="/admin" className="text-primary font-bold font-heading text-xl flex items-center gap-2">
            <Library className="w-6 h-6" /> StudyDocs
          </Link>
          <button
            className="lg:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <Link to="/admin/profile" className="block p-4 border-b border-border hover:bg-muted transition-colors cursor-pointer" onClick={() => setIsSidebarOpen(false)}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
              {user?.fullName?.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="font-semibold text-sm truncate">{user?.fullName}</p>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1">
                {role}
              </p>
            </div>
          </div>
        </Link>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6 custom-scrollbar">
          {filteredGroups.map((group, groupIndex) => (
            <div key={groupIndex} className="space-y-1">
              <h3 className="px-3 text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                {group.label}
              </h3>
              {group.items.map((item) => {
                const isActive = location.pathname === item.path || (location.pathname.startsWith(item.path) && item.path !== '/admin');
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsSidebarOpen(false)}
                    className={`
                      flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors
                      ${isActive ? 'bg-primary text-white shadow-sm' : 'text-foreground/80 hover:bg-muted hover:text-foreground'}
                    `}
                  >
                    {item.icon}
                    {item.name}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-border mt-auto">
          <Link to="/" className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors mb-2">
            ← Về trang chủ
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-danger hover:bg-danger/10 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            Đăng xuất
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="lg:hidden h-16 bg-card border-b border-border flex items-center px-4 shrink-0">
          <button
            className="text-foreground p-2 hover:bg-muted rounded-lg"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="ml-4 font-heading font-bold text-lg">Admin Panel</span>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
}
