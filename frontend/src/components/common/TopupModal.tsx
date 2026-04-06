import { useState } from 'react'
import { checkoutApi } from '@/api/checkout.api'
import toast from 'react-hot-toast'

interface Props {
  onClose: () => void
}

export default function TopupModal({ onClose }: Props) {
  const [topupAmount, setTopupAmount] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const handleTopup = async (e: React.FormEvent) => {
    e.preventDefault()
    const amountNum = Number(topupAmount)
    if (amountNum < 10000) return toast.error('Nạp tối thiểu 10,000đ')
    
    setIsProcessing(true)
    try {
      const res = await checkoutApi.topupWallet(amountNum)
      if (res.paymentUrl) {
        window.location.href = res.paymentUrl // Redirect to VNPay
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Có lỗi xảy ra')
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
          <h3 className="font-bold text-lg">Nạp tiền vào ví</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <form onSubmit={handleTopup} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Số tiền (VNĐ)</label>
            <input 
              type="number"
              value={topupAmount}
              onChange={(e) => setTopupAmount(e.target.value)}
              placeholder="VD: 50000"
              required
              className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            {[50000, 100000, 200000, 500000].map(amt => (
              <button 
                type="button" 
                key={amt} 
                onClick={() => setTopupAmount(amt.toString())} 
                className="flex-1 py-2 bg-muted hover:bg-primary/10 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {amt / 1000}k
              </button>
            ))}
          </div>
          <button type="submit" disabled={isProcessing} className="w-full btn btn-primary mt-4 rounded-xl py-3 text-base">
            {isProcessing ? 'Đang kết nối VNPay...' : 'Nạp qua VNPay'}
          </button>
        </form>
      </div>
    </div>
  )
}
