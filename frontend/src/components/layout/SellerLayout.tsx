import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, FileText, TrendingUp, Wallet } from 'lucide-react'

interface Props {
  children: ReactNode
}

export default function SellerLayout({ children }: Props) {
  const location = useLocation()
  
  const navItems = [
    { name: 'Tổng quan', path: '/seller/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { name: 'Tài liệu của tôi', path: '/seller/documents', icon: <FileText className="w-5 h-5" /> },
    { name: 'Lịch sử đơn hàng', path: '/seller/sales', icon: <TrendingUp className="w-5 h-5" /> },
    { name: 'Quản lý ví tín dụng', path: '/profile?tab=wallet', icon: <Wallet className="w-5 h-5" /> },
  ]

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 grid grid-cols-1 lg:grid-cols-5 gap-8">
      {/* Sidebar */}
      <aside className="lg:col-span-1 space-y-4">
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col gap-2">
          <h2 className="text-lg font-bold font-heading mb-4 px-2">Kênh Bán Hàng</h2>
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                    isActive ? 'bg-primary text-white shadow-md' : 'text-foreground hover:bg-muted'
                  }`}
                >
                  {item.icon}
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:col-span-4">
        {children}
      </main>
    </div>
  )
}
