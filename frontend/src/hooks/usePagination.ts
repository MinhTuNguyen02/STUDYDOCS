import { useMemo, useState } from 'react'

const DEFAULT_LIMIT = 10

export function usePagination<T>(items: T[], limit = DEFAULT_LIMIT) {
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(items.length / limit))

  // Reset page if filtered items shrink below current page
  const safePage = Math.min(page, totalPages)

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * limit
    return items.slice(start, start + limit)
  }, [items, safePage, limit])

  const reset = () => setPage(1)

  return {
    page: safePage,
    setPage,
    totalPages,
    total: items.length,
    limit,
    paginatedItems,
    reset,
  }
}
