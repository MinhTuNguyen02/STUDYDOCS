import { useState } from 'react'
import { disputeApi } from '@/api/dispute.api'
import { X, HandMetal } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  orderItemId: number
  documentTitle: string
  onClose: () => void
}

export default function DisputeModal({ orderItemId, documentTitle, onClose }: Props) {
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim() || !description.trim()) return toast.error('Vui lòng điền đầy đủ thông tin')
    
    setIsSubmitting(true)
    try {
      await disputeApi.createDispute(orderItemId, reason, description)
      toast.success('Gửi khiếu nại thành công. Đang chờ xử lý.')
      onClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Lỗi khiếu nại')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-border bg-danger/10">
          <h2 className="text-xl font-bold flex items-center gap-2 text-danger">
            <HandMetal className="w-6 h-6" />
            Khiếu nại sản phẩm
          </h2>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:bg-black/5 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-1">
            <span className="text-sm font-medium text-muted-foreground">Tài liệu khiếu nại:</span>
            <p className="font-semibold text-foreground line-clamp-1">{documentTitle}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground block">Lý do chính</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Tiêu đề lừa đảo, sai định dạng..."
              maxLength={255}
              className="w-full border border-border rounded-xl px-4 py-3 bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground block">Mô tả chi tiết</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Vui lòng giải thích rõ vì sao bạn cần hoàn tiền..."
              maxLength={2000}
              className="w-full border border-border rounded-xl px-4 py-3 bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none min-h-[120px] resize-y"
              required
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl font-medium bg-danger hover:bg-red-600 text-white transition-colors flex items-center gap-2 disabled:opacity-50 shadow-md"
            >
              {isSubmitting ? 'Đang gửi...' : 'Xác nhận Khiếu nại'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
