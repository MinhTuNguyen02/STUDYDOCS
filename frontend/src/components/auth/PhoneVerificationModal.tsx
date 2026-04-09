import { useState, type FormEvent, useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/api/auth.api';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { auth } from '@/utils/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';

interface Props {
  onClose: () => void;
}

export default function PhoneVerificationModal({ onClose }: Props) {
  const { user, updateUser } = useAuthStore();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  const initRecaptcha = () => {
    if (!(window as any).recaptchaVerifier && import.meta.env.VITE_FIREBASE_API_KEY) {
      try {
        (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible'
        });
      } catch (err) {
        console.error('Lỗi khi khởi tạo RecaptchaVerifier', err);
      }
    }
  };

  useEffect(() => {
    if (step === 1) {
      // Đợi DOM render id="recaptcha-container"
      setTimeout(initRecaptcha, 100);
    }
  }, [step]);

  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) return toast.error('Vui lòng nhập số điện thoại');

    setLoading(true);
    try {
      // Gọi backend để lưu số điện thoại
      const res = await authApi.sendOtp(phoneNumber);
      
      if (res.mode === 'FIREBASE') {
        if (!(window as any).recaptchaVerifier) {
           initRecaptcha(); // Khởi tạo lại nếu bị mất do lỗi trước đó
           if (!(window as any).recaptchaVerifier) {
             toast.error('Firebase chưa được cấu hình ở Frontend.');
             setLoading(false);
             return;
           }
        }
        
        let formattedPhone = phoneNumber.replace(/\s+/g, ''); // Cạo sạch dấu cách
        if (formattedPhone.startsWith('0')) {
          formattedPhone = '+84' + formattedPhone.slice(1);
        } else if (!formattedPhone.startsWith('+')) {
          formattedPhone = '+84' + formattedPhone;
        }

        const appVerifier = (window as any).recaptchaVerifier;
        const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
        setConfirmationResult(confirmation);
        toast.success('Đã gửi mã OTP qua Firebase!');
        setStep(2);
      } else {
        // MOCK mode
        toast.success('Mã OTP giả lập đã được gửi: 123456!');
        setStep(2);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || err.message || 'Không thể gửi mã OTP');
      if ((window as any).recaptchaVerifier) {
        try {
          (window as any).recaptchaVerifier.clear();
        } catch(e) {}
        (window as any).recaptchaVerifier = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6) return toast.error('Mã OTP phải gồm 6 số');

    setLoading(true);
    try {
      let idToken = undefined;

      // Verify with Firebase if confirmationResult exists
      if (confirmationResult) {
        const credential = await confirmationResult.confirm(otpCode);
        idToken = await credential.user.getIdToken();
      }

      await authApi.verifyOtp({ otpCode, firebaseIdToken: idToken });
      
      toast.success('Xác minh số điện thoại thành công!');
      updateUser({ isPhoneVerified: true });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Xác minh thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-6 border-b border-border">
          <h2 className="text-xl font-bold font-heading">Xác minh SĐT</h2>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-muted-foreground mb-6">
            {step === 1 ? 'Vui lòng xác minh số điện thoại để đảm bảo quyền lợi và bảo mật tài khoản.' : `Đã gửi mã OTP đến ${phoneNumber}`}
          </p>

          <div id="recaptcha-container"></div>

          {step === 1 ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="phoneNumber">Số điện thoại</label>
                <input
                  id="phoneNumber"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="0912345678"
                  className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={onClose}
                  className="px-4 py-2 hover:bg-muted rounded-xl transition-colors font-medium cursor-pointer"
                >
                  Để sau
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 bg-primary text-white rounded-xl hover:bg-primary-hover shadow-md hover:shadow-lg transition-all font-bold cursor-pointer disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Đang gửi...' : 'Xác thực'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" htmlFor="otpCode">Mã OTP (6 số)</label>
                <input
                  id="otpCode"
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                  className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                  required
                />
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button 
                  type="submit" 
                  className="w-full py-2.5 bg-primary text-white rounded-xl hover:bg-primary-hover shadow-md hover:shadow-lg transition-all font-bold cursor-pointer disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Đang xác minh...' : 'Hoàn tất'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setStep(1)}
                  className="w-full py-2 bg-muted hover:bg-accent rounded-xl transition-colors font-medium cursor-pointer text-sm"
                  disabled={loading}
                >
                  Đổi số điện thoại
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
