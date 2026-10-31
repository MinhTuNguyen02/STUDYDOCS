import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { toVNDateString } from "@/utils/format";

export function useFinancialReportQuery() {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultStartDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return toVNDateString(date);
  }, []);
  const startDate = searchParams.get("startDate") || defaultStartDate;
  const endDate = searchParams.get("endDate") || toVNDateString();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const updateQuery = useCallback(
    (updates: Record<string, string | number>) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        Object.entries(updates).forEach(([key, value]) =>
          next.set(key, String(value)),
        );
        return next;
      });
    },
    [setSearchParams],
  );

  return { startDate, endDate, requestedPage: page, updateQuery };
}
