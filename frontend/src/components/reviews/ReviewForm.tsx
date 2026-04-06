import { useState } from 'react'
import { Star } from 'lucide-react'
import { reviewsApi } from '@/api/reviews.api'
import toast from 'react-hot-toast'

interface Props {
  documentId: number
  onSuccess: () => void
}

export default function ReviewForm({ documentId, onSuccess }: Props) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (rating === 0) return toast.error('Vui lòng chọn số sao')
    if (!comment.trim()) return toast.error('Vui lòng nhập nội dung đánh giá')

    setSubmitting(true)
    try {
      await reviewsApi.upsertReview(documentId, { rating, comment })
      toast.success('Đánh giá của bạn đã được ghi nhận!')
      setRating(0)
      setComment('')
      onSuccess()
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Có lỗi xảy ra khi gửi đánh giá')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-muted/50 p-6 rounded-2xl border border-border mb-8">
      <h3 className="font-bold text-lg mb-4 text-foreground">Viết đánh giá của bạn</h3>
      
      <div className="flex mb-4 gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={() => setRating(star)}
            className="p-1 focus:outline-none transition-transform hover:scale-110"
          >
            <Star 
              className={`w-8 h-8 transition-colors ${
                star <= (hoverRating || rating) 
                  ? 'fill-yellow-400 text-yellow-400' 
                  : 'text-gray-300'
              }`} 
            />
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Chia sẻ cảm nghĩ của bạn về tài liệu này..."
        rows={4}
        className="w-full p-4 mb-4 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none text-sm transition-all"
      />

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting || rating === 0 || !comment.trim()}
          className="btn btn-primary disabled:opacity-50"
        >
          {submitting ? 'Đang gửi...' : 'Gửi đánh giá'}
        </button>
      </div>
    </form>
  )
}
