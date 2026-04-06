import { useState } from 'react'
import { reportsApi } from '@/api/reports.api'
import { X, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  documentId: number
  documentTitle: string
  onClose: () => void
}

export default function ReportModal({ documentId, documentTitle, onClose }: Props) {
  const [type, setType] = useState('SPAM')
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) return toast.error('Vui lòng nhập lý do')
    
    setIsSubmitting(true)
    try {
      await reportsApi.createReport(documentId, type, reason)
      toast.success('Gửi báo cáo thành công. Cảm ơn bạn!')
      onClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Lý do báo cáo lỗi')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
          <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
            <AlertTriangle className="w-6 h-6 text-warning" />
            Báo cáo vi phạm
          </h2>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:bg-black/5 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-1">
            <span className="text-sm font-medium text-muted-foreground">Tài liệu bị báo cáo:</span>
            <p className="font-semibold text-foreground line-clamp-1">{documentTitle}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground block">Loại vi phạm</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border border-border rounded-xl px-4 py-3 bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            >
              <option value="SPAM">Spam / Rác</option>
              <option value="COPYRIGHT">Vi phạm bản quyền</option>
              <option value="INAPPROPRIATE">Nội dung không phù hợp</option>
              <option value="OTHER">Lý do khác</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground block">Mô tả chi tiết</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Vui lòng cung cấp chi tiết về vi phạm..."
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
              {isSubmitting ? 'Đang gửi...' : 'Gửi Báo Cáo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
