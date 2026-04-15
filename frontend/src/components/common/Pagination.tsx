import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  limit: number
  onPageChange: (page: number) => void
  className?: string
}

export default function Pagination({ page, totalPages, total, limit, onPageChange, className = '' }: PaginationProps) {
  if (totalPages <= 1) return null

  const from = (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  return (
    <div className={`p-4 border-t border-border flex justify-between items-center bg-muted/10 ${className}`}>
      <span className="text-sm text-muted-foreground">
        Hiển thị <strong>{from}–{to}</strong> / {total} kết quả
      </span>
      <div className="flex items-center gap-1.5">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="p-1.5 border border-border rounded-lg bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let p: number
          if (totalPages <= 5) {
            p = i + 1
          } else if (page <= 3) {
            p = i + 1
          } else if (page >= totalPages - 2) {
            p = totalPages - 4 + i
          } else {
            p = page - 2 + i
          }
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`min-w-[32px] h-8 text-sm font-semibold rounded-lg border transition-colors ${
                p === page
                  ? 'bg-primary text-white border-primary'
                  : 'bg-background border-border hover:bg-muted'
              }`}
            >
              {p}
            </button>
          )
        })}
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="p-1.5 border border-border rounded-lg bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
