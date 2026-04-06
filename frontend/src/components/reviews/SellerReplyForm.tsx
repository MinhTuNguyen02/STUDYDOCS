import { useState } from 'react'
import { reviewsApi } from '@/api/reviews.api'
import toast from 'react-hot-toast'
import { Send, CornerDownRight } from 'lucide-react'

interface Props {
  reviewId: number
  onSuccess: () => void
}

export default function SellerReplyForm({ reviewId, onSuccess }: Props) {
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isReplying, setIsReplying] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyText.trim()) return toast.error('Vui lòng nhập nội dung phản hồi')

    setSubmitting(true)
    try {
      await reviewsApi.replyReview(reviewId, { reply: replyText })
      toast.success('Phản hồi đã được gửi!')
      setReplyText('')
      setIsReplying(false)
      onSuccess()
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Lỗi khi gửi phản hồi')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isReplying) {
    return (
      <button 
        onClick={() => setIsReplying(true)}
        className="mt-3 text-sm text-primary font-medium hover:underline flex items-center gap-1"
      >
        <CornerDownRight className="w-4 h-4" />
        Trả lời đánh giá
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 p-4 bg-muted/30 border border-border rounded-xl">
      <div className="flex gap-2 mb-2 items-center text-sm font-semibold text-foreground">
        <CornerDownRight className="w-4 h-4 text-primary" />
        Phản hồi của người bán:
      </div>
      <div className="flex gap-2">
        <textarea
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Nhập phản hồi của bạn..."
          rows={2}
          className="flex-1 p-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm resize-none"
          disabled={submitting}
        />
      </div>
      <div className="flex items-center gap-2 mt-3 justify-end">
        <button
          type="button"
          onClick={() => setIsReplying(false)}
          className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground font-medium"
          disabled={submitting}
        >
          Hủy
        </button>
        <button
          type="submit"
          disabled={submitting || !replyText.trim()}
          className="btn btn-primary py-2 px-4 rounded-lg flex items-center gap-2 text-sm"
        >
          <Send className="w-4 h-4" />
          {submitting ? 'Đang gửi...' : 'Gửi phản hồi'}
        </button>
      </div>
    </form>
  )
}
