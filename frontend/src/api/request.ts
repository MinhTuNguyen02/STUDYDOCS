import axios from "axios";
import type { PaginatedResponse } from "./contracts";

interface SuccessEnvelope {
  success: true;
  data: unknown;
  [key: string]: unknown;
}

export function unwrapApiEnvelope(payload: unknown): unknown {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("success" in payload) ||
    (payload as { success?: unknown }).success !== true ||
    !("data" in payload)
  ) {
    return payload;
  }
  const { success: _success, data, ...rest } = payload as SuccessEnvelope;
  return "meta" in rest ? { data, ...rest } : data;
}

export function asCollection<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && "data" in payload) {
    const data = (payload as { data?: unknown }).data;
    return Array.isArray(data) ? (data as T[]) : [];
  }
  return [];
}

export function isCanceledRequest(error: unknown) {
  return (
    axios.isCancel(error) ||
    (axios.isAxiosError(error) && error.code === "ERR_CANCELED")
  );
}

export async function fetchAllPages<T>(
  fetchPage: (page: number, limit: number) => Promise<PaginatedResponse<T>>,
) {
  const limit = 100;
  const first = await fetchPage(1, limit);
  const items = [...first.data];
  const totalPages = Math.ceil(first.meta.total / limit);
  for (let page = 2; page <= totalPages; page += 1) {
    const response = await fetchPage(page, limit);
    items.push(...response.data);
  }
  return items;
}
