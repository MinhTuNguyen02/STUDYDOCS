import { useState, FormEvent, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { authApi } from '@/api/auth.api';
import toast from 'react-hot-toast';
import { Lock, ArrowRight, Eye, EyeOff, KeyRound, CheckCircle2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      toast.error('Đường dẫn không hợp lệ hoặc không có token.');
      navigate('/login');
    }
  }, [token, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp.');
      return;
    }

    if (password.length < 6) {
      toast.error('Mật khẩu phải từ 6 ký tự trở lên.');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(token as string, password);
      setSuccess(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Link đã hết hạn hoặc không hợp lệ.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-linear-to-r from-primary via-indigo-500 to-primary"></div>
        
        {success ? (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-bold text-foreground font-heading">Đổi Mật Khẩu Thành Công!</h2>
            <p className="text-muted-foreground leading-relaxed">
              Bạn có thể sử dụng mật khẩu mới để đăng nhập vào tài khoản của mình.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full btn bg-primary text-white py-3.5 rounded-xl font-bold shadow-lg"
            >
              Đăng Nhập Ngay
            </button>
          </div>
        ) : (
          <>
            <div className="mb-8 text-center">
              <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                <KeyRound className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-bold font-heading mb-2 text-foreground">Đặt Mật Khẩu Mới</h2>
              <p className="text-sm text-muted-foreground">Vui lòng nhập mật khẩu mới cho tài khoản của bạn</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Mật khẩu mới</label>
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
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Xác nhận mật khẩu</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-12 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all text-sm font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn bg-foreground text-background py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 disabled:opacity-50 transition-all hover:bg-foreground/90 shadow-md"
              >
                {loading ? 'Đang cập nhật...' : 'Xác nhận Đổi mật khẩu'}
                {!loading && <ArrowRight className="w-5 h-5" />}
              </button>

              <div className="text-center pt-2">
                <Link to="/login" className="text-sm text-primary font-semibold hover:underline">
                  Quay lại Đăng nhập
                </Link>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
