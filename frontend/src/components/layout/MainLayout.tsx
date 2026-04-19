import { ReactNode, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import TopupModal from '@/components/common/TopupModal'
import PhoneVerificationModal from '@/components/auth/PhoneVerificationModal'
import { Search, ShoppingCart, User, Menu, LogOut, Mail, Phone, MapPin, Heart, Library, Package, Wallet, ChevronDown, Store, ShieldCheck, Upload } from 'lucide-react'
import { FiFacebook, FiInstagram, FiYoutube } from 'react-icons/fi'
import { documentsApi } from '@/api/documents.api'
import NotificationBell from '@/components/common/NotificationBell'

interface Props {
  children: ReactNode
}

export default function MainLayout({ children }: Props) {
  const { user, logout } = useAuthStore()
  const { count, fetchCart } = useCartStore()
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showTopupModal, setShowTopupModal] = useState(false)
  const [showPhoneModal, setShowPhoneModal] = useState(false)

  const [footerCategories, setFooterCategories] = useState<any[]>([])
  const [footerPolicies, setFooterPolicies] = useState<any[]>([])

  const isStaff = ['admin', 'mod', 'accountant'].includes(user?.roleNames?.[0]?.toLowerCase() || '');

  useEffect(() => {
    if (user) {
      if (user.isPhoneVerified === false) {
        setShowPhoneModal(true);
      }
    }
  }, [user])

  useEffect(() => {
    if (user) {
      fetchCart()
    }
  }, [user, fetchCart])

  useEffect(() => {
    documentsApi.getCategories().then(res => setFooterCategories(res || []))
    documentsApi.getPolicies().then(res => setFooterPolicies(res || []))
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/documents?keyword=${encodeURIComponent(searchQuery.trim())}`)
      setIsMenuOpen(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">

      {/* ── Header ── */}
      <header className="bg-white border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            <div className="flex items-center gap-8">
              <Link to="/" className="shrink-0">
                <h1 className="text-primary text-2xl font-bold font-heading">StudyDocs</h1>
              </Link>
              <nav className="hidden md:flex items-center gap-6">
                <Link to="/documents" className="text-foreground hover:text-primary font-medium transition-colors">Danh mục</Link>
                <Link to="/packages" className="text-foreground hover:text-primary font-medium transition-colors flex items-center gap-1">
                  Gói tải <span className="bg-warning text-white text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">Hot</span>
                </Link>
              </nav>
            </div>

            <div className="hidden md:flex items-center gap-4 flex-1 max-w-xl mx-8">
              <form onSubmit={handleSearch} className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm tài liệu..."
                  className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary shadow-sm text-sm transition-shadow"
                />
              </form>
            </div>

            <div className="hidden md:flex items-center gap-4">
              {user ? (
                <>
                  {!isStaff && (
                    <>

                      <Link to="/seller/documents/new" className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 rounded-lg transition-colors text-sm font-bold ml-2 cursor-pointer">
                        <Upload className="w-4 h-4" />
                        <span>Tải tài liệu</span>
                      </Link>
                      <button onClick={() => setShowTopupModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors text-sm font-bold ml-2 cursor-pointer">
                        <Wallet className="w-4 h-4" />
                        <span>Nạp tiền</span>
                      </button>
                      <Link to="/cart" className="p-2 text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg transition-colors relative">
                        <ShoppingCart className="w-6 h-6" />
                        {count > 0 && (
                          <span className="absolute -top-1 -right-1 bg-destructive text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shadow-sm">
                            {count}
                          </span>
                        )}
                      </Link>
                      <Link to="/wishlist" className="p-2 text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg transition-colors" title="Danh sách yêu thích">
                        <Heart className="w-6 h-6" />
                      </Link>
                    </>
                  )}

                  <NotificationBell />

                  {/* User Dropdown */}
                  <div className="relative group ml-2 py-2">
                    <div className="flex items-center gap-2 cursor-pointer text-foreground hover:text-primary transition-colors">
                      <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                        {user.fullName.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium">{user.fullName}</span>
                      <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:rotate-180 transition-transform duration-200" />
                    </div>

                    {/* Dropdown Menu (Hover Trigger) */}
                    <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top translate-y-2 group-hover:translate-y-0 z-50 overflow-hidden">
                      <div className="p-2 flex flex-col">
                        {isStaff && (
                          <Link to="/admin" className="flex items-center gap-3 px-3 py-2.5 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors text-sm font-semibold text-primary mb-1 border border-primary/20">
                            <ShieldCheck className="w-4 h-4" />
                            Trang quản trị
                          </Link>
                        )}
                        {!isStaff && user.hasUploadedDocument && (
                          <Link to="/seller/dashboard" className="flex items-center gap-3 px-3 py-2.5 bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors text-sm font-semibold text-primary mb-1 border border-primary/10">
                            <Store className="w-4 h-4" />
                            Kênh người bán
                          </Link>
                        )}
                        <Link to="/profile" className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted rounded-lg transition-colors text-sm font-medium text-foreground">
                          <User className="w-4 h-4 text-muted-foreground" />
                          Trang cá nhân
                        </Link>
                        {!isStaff && (
                          <>
                            <Link to="/orders" className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted rounded-lg transition-colors text-sm font-medium text-foreground">
                              <Package className="w-4 h-4 text-muted-foreground" />
                              Lịch sử mua hàng
                            </Link>
                            <Link to="/library" className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted rounded-lg transition-colors text-sm font-medium text-foreground">
                              <Library className="w-4 h-4 text-muted-foreground" />
                              Thư viện của tôi
                            </Link>
                          </>
                        )}

                        <div className="h-px bg-border my-1"></div>

                        <button
                          onClick={handleLogout}
                          className="flex items-center gap-3 px-3 py-2.5 hover:bg-destructive/10 text-destructive rounded-lg transition-colors text-sm font-medium w-full text-left cursor-pointer"
                        >
                          <LogOut className="w-4 h-4" />
                          Đăng xuất
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Link to="/login" className="hidden lg:flex items-center justify-center px-4 py-2 border border-border text-foreground rounded-lg hover:bg-accent transition-colors text-sm font-semibold">
                    Đăng nhập
                  </Link>
                  <Link to="/register" className="hidden lg:flex items-center justify-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-semibold shadow-sm">
                    Đăng ký
                  </Link>
                </>
              )}
            </div>

            <button
              className="md:hidden p-2 hover:bg-accent rounded-lg"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="md:hidden py-4 border-t border-border">
              <form onSubmit={handleSearch} className="relative mb-4 px-2">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm tài liệu..."
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </form>
              <nav className="flex flex-col gap-2 px-2">
                <Link to="/" onClick={() => setIsMenuOpen(false)} className="px-4 py-2 text-foreground font-medium hover:bg-accent rounded-lg transition-colors">Trang chủ</Link>
                <Link to="/documents" onClick={() => setIsMenuOpen(false)} className="px-4 py-2 text-foreground font-medium hover:bg-accent rounded-lg transition-colors">Danh mục</Link>
                <Link to="/packages" onClick={() => setIsMenuOpen(false)} className="px-4 py-2 text-foreground font-medium hover:bg-accent rounded-lg transition-colors flex justify-between items-center">
                  Gói lượt tải <span className="bg-warning text-white text-xs px-2 py-0.5 rounded-full font-bold">Hot</span>
                </Link>

                <div className="border-t border-border my-2"></div>
                {user ? (
                  <>
                    {!isStaff && (
                      <Link to="/cart" onClick={() => setIsMenuOpen(false)} className="px-4 py-2 text-foreground font-medium hover:bg-accent rounded-lg transition-colors flex items-center justify-between">
                        Giỏ hàng
                        {count > 0 && <span className="bg-destructive text-white px-2 py-0.5 rounded-full text-xs">{count}</span>}
                      </Link>
                    )}
                    {!isStaff && <Link to="/library" onClick={() => setIsMenuOpen(false)} className="px-4 py-2 text-foreground font-medium hover:bg-accent rounded-lg transition-colors">Thư viện của tôi</Link>}
                    {!isStaff && <Link to="/orders" onClick={() => setIsMenuOpen(false)} className="px-4 py-2 text-foreground font-medium hover:bg-accent rounded-lg transition-colors">Lịch sử đơn hàng</Link>}
                    <Link to="/profile" onClick={() => setIsMenuOpen(false)} className="px-4 py-2 text-foreground font-medium hover:bg-accent rounded-lg transition-colors">Trang cá nhân</Link>
                    {isStaff && (
                      <Link to="/admin" onClick={() => setIsMenuOpen(false)} className="px-4 py-2 text-primary font-bold hover:bg-primary/10 rounded-lg transition-colors flex items-center gap-2">
                        Trang quản trị
                      </Link>
                    )}
                    {!isStaff && user.hasUploadedDocument && (
                      <Link to="/seller/dashboard" onClick={() => setIsMenuOpen(false)} className="px-4 py-2 text-primary font-bold hover:bg-primary/10 rounded-lg transition-colors flex items-center gap-2">
                        Kênh người bán
                      </Link>
                    )}
                    <button onClick={() => { handleLogout(); setIsMenuOpen(false); }} className="px-4 py-2 flex items-center justify-start text-destructive font-medium hover:bg-accent rounded-lg transition-colors">Đăng xuất</button>
                  </>
                ) : (
                  <>
                    <Link to="/login" onClick={() => setIsMenuOpen(false)} className="px-4 py-2 text-foreground font-medium hover:bg-accent rounded-lg transition-colors">Đăng nhập</Link>
                    <Link to="/register" onClick={() => setIsMenuOpen(false)} className="px-4 py-2 text-primary font-medium hover:bg-accent rounded-lg transition-colors">Đăng ký mới</Link>
                  </>
                )}
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 w-full mx-auto px-4 py-8 lg:px-8 sm:px-4">
        {children}
      </main>

      {showTopupModal && <TopupModal onClose={() => setShowTopupModal(false)} />}
      {showPhoneModal && <PhoneVerificationModal onClose={() => setShowPhoneModal(false)} />}

      {/* ── Footer ── */}
      <footer className="bg-primary text-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="mb-4 text-white font-bold text-lg">Về StudyDocs</h3>
              <p className="text-white/80 mb-4 text-sm">
                Nền tảng cung cấp tài liệu học tập chất lượng cao, giúp học sinh, sinh viên học tập hiệu quả hơn.
              </p>
              <div className="flex gap-3">
                <button className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
                  <FiFacebook className="w-5 h-5" />
                </button>
                <button className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
                  <FiInstagram className="w-5 h-5" />
                </button>
                <button className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
                  <FiYoutube className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div>
              <h3 className="mb-4 text-white font-bold text-lg">Danh mục</h3>
              <ul className="space-y-2 text-white/80 text-sm">
                <li><Link to="/documents" className="hover:text-white transition-colors flex items-center gap-2 font-semibold text-primary-foreground"><span className="w-1 h-1 rounded-full bg-white"></span>Tất cả danh mục</Link></li>
                {footerCategories.slice(0, 3).map(c => (
                  <li key={c.category_id || c.id}>
                    <Link to={`/documents?categoryId=${c.category_id || c.id}`} className="hover:text-white transition-colors flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-white/50"></span>
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="mb-4 text-white font-bold text-lg">Hỗ trợ</h3>
              <ul className="space-y-2 text-white/80 text-sm">
                <li><Link to="/policies" className="hover:text-white transition-colors flex items-center gap-2 font-semibold text-primary-foreground"><span className="w-1 h-1 rounded-full bg-white"></span>Chính sách chung</Link></li>
                {footerPolicies.slice(0, 3).map(p => (
                  <li key={p.policy_id || p.id}>
                    <Link to={`/policies/${p.slug}`} className="hover:text-white transition-colors flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-white/50"></span>
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="mb-4 text-white font-bold text-lg">Liên hệ</h3>
              <ul className="space-y-3 text-white/80 text-sm">
                <li className="flex items-start gap-2">
                  <MapPin className="w-5 h-5 shrink-0" />
                  <span>97 Đường Man Thiện, TP. Thủ Đức, TP.HCM</span>
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="w-5 h-5 shrink-0" />
                  <span>0909 090 909</span>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="w-5 h-5 shrink-0" />
                  <span>support@studydocs.vn</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/20 pt-8 text-center text-white/80 text-sm">
            <p>&copy; 2026 StudyDocs. Tất cả quyền được bảo lưu.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
