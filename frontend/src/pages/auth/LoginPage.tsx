import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/api/auth.api'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Mail, Lock, ShieldCheck, ArrowLeft } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  // Catch OAuth redirect tokens
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    const userStr = params.get('user');

    if (accessToken && refreshToken && userStr) {
      try {
        const user = JSON.parse(decodeURIComponent(userStr));
        login({ accessToken, refreshToken, user });
        toast.success('Đăng nhập thành công!');
        const role = user.roleNames?.[0]?.toLowerCase() || '';
        if (['admin', 'mod', 'accountant'].includes(role)) {
          navigate('/admin');
        } else {
          navigate('/');
        }
      } catch (e) {
        console.error('Failed to parse OAuth user', e);
      }
    }
  }, [login, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await authApi.login({ email, password })
      login({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: res.user,
      })
      toast.success('Đăng nhập thành công!')
      const role = res.user.roleNames?.[0]?.toLowerCase() || '';
      if (['admin', 'mod', 'accountant'].includes(role)) {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Đăng nhập thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="p-6">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors font-medium">
          <ArrowLeft className="w-5 h-5" /> Trở về trang chủ
        </Link>
      </div>
      <div className="flex-1 flex flex-col md:flex-row py-10 px-4 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto items-center justify-center gap-12 lg:gap-24">
        {/* Left side: Illustration / Welcome text */}
        <div className="hidden md:flex flex-col flex-1 max-w-lg space-y-8">
          <h1 className="text-4xl lg:text-5xl font-bold font-heading leading-tight text-foreground">
            Chào mừng trở lại với <span className="text-primary">StudyDocs</span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Nền tảng chia sẻ và mua bán tài liệu học tập uy tín nhất. Truy cập hàng ngàn tài liệu chất lượng cao ngay hôm nay!
          </p>
          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-4 text-foreground font-medium">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center relative shrink-0">
                <ShieldCheck className="w-5 h-5 absolute" />
              </div>
              100% Tài liệu đã được kiểm duyệt
            </div>
            <div className="flex items-center gap-4 text-foreground font-medium">
              <div className="w-10 h-10 rounded-full bg-success/10 text-success flex items-center justify-center relative shrink-0">
                <svg className="w-5 h-5 absolute" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
              Thanh toán an toàn, minh bạch
            </div>
          </div>
        </div>

        {/* Right side: Login Form */}
        <div className="w-full max-w-md bg-card border border-border rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-linear-to-r from-primary via-indigo-500 to-primary"></div>
          <div className="mb-8 text-center md:text-left">
            <h2 className="text-3xl font-bold font-heading mb-2 text-foreground">Đăng nhập</h2>
            <p className="text-muted-foreground">Vui lòng điền thông tin để tiếp tục</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nguyenvan@example.com"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all text-sm font-medium"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-semibold text-foreground">Mật khẩu</label>
                <span className="text-sm text-primary hover:underline font-semibold cursor-pointer">Quên mật khẩu?</span>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-12 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all text-sm font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all shadow-md hover:shadow-lg text-lg disabled:opacity-50"
            >
              {loading ? 'Đang xử lý...' : 'Đăng nhập'}
            </button>
          </form>

          <div className="mt-8 text-center space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-card text-muted-foreground font-medium">Hoặc đăng nhập với</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <button
                type="button"
                onClick={() => window.location.href = 'http://localhost:5173/api/auth/google'}
                className="flex items-center justify-center gap-3 py-3.5 border border-border rounded-xl hover:bg-accent hover:shadow-sm transition-all font-medium text-foreground bg-background"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  <path fill="none" d="M1 1h22v22H1z" />
                </svg>
                Google
              </button>
            </div>

            <p className="text-sm text-muted-foreground pt-4">
              Chưa có tài khoản?{' '}
              <Link to="/register" className="text-primary font-bold hover:underline">Đăng ký ngay</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
