import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { checkoutApi } from '@/api/checkout.api'
import { CheckCircle, XCircle } from 'lucide-react'

export default function VnpayReturnPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'LOADING' | 'SUCCESS' | 'FAILED'>('LOADING')
  const [message, setMessage] = useState('Đang xử lý thanh toán...')

  useEffect(() => {
    const vnp_ResponseCode = searchParams.get('vnp_ResponseCode')

    if (vnp_ResponseCode === '00') {
      setStatus('SUCCESS')
      setMessage('Giao dịch thành công! Số tiền đã được thêm vào ví của bạn.')
    } else {
      setStatus('FAILED')
      setMessage('Giao dịch thất bại hoặc đã bị hủy.')
    }
  }, [searchParams])

  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-card border border-border rounded-2xl shadow-sm text-center">
      {status === 'LOADING' && (
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <h2 className="text-xl font-bold font-heading">{message}</h2>
        </div>
      )}

      {status === 'SUCCESS' && (
        <div className="flex flex-col items-center animate-in zoom-in duration-300">
          <CheckCircle className="w-20 h-20 text-success mb-4" />
          <h2 className="text-2xl font-bold text-success font-heading mb-2">Thanh toán thành công</h2>
          <p className="text-muted-foreground mb-6">{message}</p>
          <button onClick={() => navigate('/profile')} className="btn bg-primary text-white rounded-xl px-8 w-full cursor-pointer">
            Về trang cá nhân
          </button>
        </div>
      )}

      {status === 'FAILED' && (
        <div className="flex flex-col items-center animate-in zoom-in duration-300">
          <XCircle className="w-20 h-20 text-danger mb-4" />
          <h2 className="text-2xl font-bold text-danger font-heading mb-2">Thanh toán thất bại</h2>
          <p className="text-muted-foreground mb-6">{message}</p>
          <button onClick={() => navigate('/profile')} className="btn border border-border hover:bg-muted rounded-xl px-8 w-full cursor-pointer">
            Về trang cá nhân
          </button>
        </div>
      )}
    </div>
  )
}
