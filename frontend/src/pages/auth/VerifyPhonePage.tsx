import { useState, type FormEvent, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { authApi } from '@/api/auth.api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

export default function VerifyPhonePage() {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  
  const { user, updateUser } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  
  // If user already verified phone, redirect them back or to home
  useEffect(() => {
    if (user?.isPhoneVerified) {
      const from = location.state?.from?.pathname || '/'
      navigate(from, { replace: true })
    }
  }, [user, navigate, location])

  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault()
    if (!phoneNumber) return toast.error('Vui lòng nhập số điện thoại')
    
    setLoading(true)
    try {
      const res = await authApi.sendOtp(phoneNumber)
      toast.success(res.mode === 'MOCK' ? 'Mã OTP giả lập đã được gửi: 123456!' : 'Đã gửi mã OTP!')
      setStep(2)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể gửi mã OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault()
    if (!otpCode || otpCode.length !== 6) return toast.error('Mã OTP phải gồm 6 số')

    setLoading(true)
    try {
      await authApi.verifyOtp({ otpCode })
      toast.success('Xác minh số điện thoại thành công!')
      updateUser({ isPhoneVerified: true })
      
      const from = location.state?.from?.pathname || '/'
      navigate(from, { replace: true })
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Xác minh thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Xác minh Số điện thoại</h1>
        <p className="auth-subtitle">
          {step === 1 ? 'Nhập số điện thoại để tiếp tục.' : `Đã gửi mã đến ${phoneNumber}`}
        </p>

        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="auth-form">
            <div className="form-group">
              <label htmlFor="phoneNumber">Số điện thoại</label>
              <input
                id="phoneNumber"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="0912345678"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Đang gửi...' : 'Nhận mã OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="auth-form">
            <div className="form-group">
              <label htmlFor="otpCode">Mã OTP (6 số)</label>
              <input
                id="otpCode"
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Đang xác minh...' : 'Xác minh'}
            </button>
            <button 
              type="button" 
              className="btn btn-full" 
              style={{marginTop: '-8px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)'}}
              onClick={() => setStep(1)}
              disabled={loading}
            >
              Đổi số điện thoại khác
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
