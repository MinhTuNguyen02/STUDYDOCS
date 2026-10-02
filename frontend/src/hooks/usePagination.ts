import { useCallback, useMemo, useState } from "react";

const DEFAULT_LIMIT = 10;

interface PaginationOptions {
  page?: number;
  onPageChange?: (page: number) => void;
}

export function usePagination<T>(
  items: T[],
  limit = DEFAULT_LIMIT,
  options: PaginationOptions = {},
) {
  const [internalPage, setInternalPage] = useState(1);
  const { page: controlledPage, onPageChange } = options;
  const requestedPage = controlledPage ?? internalPage;

  const totalPages = Math.max(1, Math.ceil(items.length / limit));

  // Reset page if filtered items shrink below current page
  const safePage = Math.max(1, Math.min(requestedPage, totalPages));

  const setPage = useCallback(
    (nextPage: number) => {
      const normalizedPage = Math.max(1, nextPage);
      if (onPageChange) {
        onPageChange(normalizedPage);
        return;
      }
      setInternalPage(normalizedPage);
    },
    [onPageChange],
  );

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * limit;
    return items.slice(start, start + limit);
  }, [items, safePage, limit]);

  const reset = () => setPage(1);

  return {
    page: safePage,
    setPage,
    totalPages,
    total: items.length,
    limit,
    paginatedItems,
    reset,
  };
}
