import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '@/api/auth.api'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Mail, Lock, User as UserIcon, ArrowLeft } from 'lucide-react'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp!')
      return
    }

    setLoading(true)
    try {
      await authApi.register({ fullName, email, password })
      toast.success('Đăng ký thành công! Vui lòng đăng nhập.')
      navigate('/login')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Đăng ký thất bại')
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
        {/* Right side: Registration Form (We put it first in source for mobile order if needed, but flex-col keeps it normal) */}
        <div className="w-full max-w-md bg-card border border-border rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-linear-to-r from-success via-emerald-500 to-success"></div>
          <div className="mb-8 text-center md:text-left">
            <h2 className="text-3xl font-bold font-heading mb-2 text-foreground">Tạo tài khoản</h2>
            <p className="text-muted-foreground">Tham gia cộng đồng StudyDocs ngay hôm nay!</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Họ và tên</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all text-sm font-medium"
                />
              </div>
            </div>

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
              <label className="text-sm font-semibold text-foreground">Mật khẩu</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
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
              <p className="text-xs text-muted-foreground mt-1.5">Mật khẩu phải có ít nhất 6 ký tự.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground">Xác nhận mật khẩu</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className={`w-full pl-10 pr-12 py-3 bg-background border rounded-xl focus:outline-none focus:ring-2 transition-all text-sm font-medium ${confirmPassword && password !== confirmPassword
                      ? 'border-danger focus:ring-danger focus:border-danger'
                      : 'border-border focus:ring-primary focus:border-primary'
                    }`}
                />
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-danger mt-1">Mật khẩu xác nhận không khớp.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-success text-success-foreground font-bold rounded-xl hover:bg-success/90 transition-all shadow-md hover:shadow-lg text-lg mt-2 disabled:opacity-50"
            >
              {loading ? 'Đang xử lý...' : 'Đăng ký'}
            </button>
          </form>

          <div className="mt-8 text-center space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-card text-muted-foreground font-medium">Hoặc đăng ký với</span>
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
              Bằng việc đăng ký, bạn đồng ý với{' '}
              <span className="text-primary font-semibold cursor-pointer hover:underline">Điều khoản dịch vụ</span> và{' '}
              <span className="text-primary font-semibold cursor-pointer hover:underline">Chính sách bảo mật</span>
            </p>

            <p className="text-sm text-muted-foreground pt-4 border-t border-border">
              Đã có tài khoản?{' '}
              <Link to="/login" className="text-primary font-bold hover:underline">Đăng nhập</Link>
            </p>
          </div>
        </div>

        {/* Left side: Features summary */}
        <div className="hidden md:flex flex-col flex-1 max-w-lg space-y-8 order-first md:order-last">
          <h1 className="text-4xl lg:text-5xl font-bold font-heading leading-tight text-foreground">
            Trở thành người bán & người mua <span className="text-primary">thông minh</span>
          </h1>
          <ul className="space-y-6 pt-4">
            <li className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center relative shrink-0 mt-1">
                <svg className="w-5 h-5 absolute" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-foreground mb-1 text-lg">Đăng bán tài liệu dễ dàng</h3>
                <p className="text-muted-foreground">Tự động duyệt nếu đúng định dạng, nhận tiền vào ví nhanh chóng, hoa hồng cạnh tranh nhất thị trường.</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center relative shrink-0 mt-1">
                <svg className="w-5 h-5 absolute" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-foreground mb-1 text-lg">Hệ thống ví bảo mật cao</h3>
                <p className="text-muted-foreground">Bảo vệ quyền lợi cả người mua và người bán bằng cơ chế hold tiền thông minh, rút tiền linh hoạt.</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center relative shrink-0 mt-1">
                <svg className="w-5 h-5 absolute" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-foreground mb-1 text-lg">Hàng ngàn tài liệu miễn phí</h3>
                <p className="text-muted-foreground">Nhận lượt tải miễn phí mỗi tháng cho các tài liệu đặc biệt được đóng góp bởi cộng đồng.</p>
              </div>
            </li>
          </ul>
        </div>

      </div>
    </div>
  )
}
