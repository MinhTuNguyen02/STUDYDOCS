import axios from "axios";

export interface FieldErrorMap {
  [field: string]: string;
}

interface ApiErrorBody {
  message?: string | string[];
  errors?: Array<{ field?: string; messages?: string[] }>;
}

function bodyOf(error: unknown): ApiErrorBody | undefined {
  if (!axios.isAxiosError<ApiErrorBody>(error)) return undefined;
  return error.response?.data;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const message = bodyOf(error)?.message;
  if (Array.isArray(message)) return message[0] || fallback;
  return typeof message === "string" && message ? message : fallback;
}

export function getFieldErrors(error: unknown): FieldErrorMap {
  const errors = bodyOf(error)?.errors;
  if (!Array.isArray(errors)) return {};
  return Object.fromEntries(
    errors
      .filter((item) => item.field && item.messages?.length)
      .map((item) => [item.field as string, item.messages?.[0] as string]),
  );
}
