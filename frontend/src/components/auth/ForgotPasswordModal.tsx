import { useState } from 'react';
import { X, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { authApi } from '@/api/auth.api';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
}

export default function ForgotPasswordModal({ onClose }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSuccess(true);
      toast.success('Link lấy lại mật khẩu đã được gửi đến email của bạn!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không tìm thấy tài khoản với email này.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-6 border-b border-border flex justify-between items-center relative">
          <h2 className="text-2xl font-bold font-heading">Quên Mật Khẩu?</h2>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Gửi thành công!</h3>
              <p className="text-muted-foreground">
                Chúng tôi đã gửi link đặt lại mật khẩu đến <strong className="text-foreground">{email}</strong>. 
                Vui lòng kiểm tra hộp thư đến (cả ở mục Spam) và làm theo hướng dẫn.
              </p>
              <button
                onClick={onClose}
                className="w-full mt-6 btn bg-primary text-white py-3 rounded-xl font-semibold shadow-lg"
              >
                Trở về Đăng nhập
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex bg-primary/10 text-primary p-4 rounded-xl gap-3 text-sm items-start">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p>Nhập địa chỉ email liên kết với tài khoản của bạn để nhận liên kết đặt lại mật khẩu an toàn.</p>
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

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full btn bg-foreground text-background py-3 rounded-xl font-bold text-base flex justify-center items-center gap-2 disabled:opacity-50 transition-all hover:bg-foreground/90"
              >
                {loading ? 'Đang gửi...' : 'Tiếp tục'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
