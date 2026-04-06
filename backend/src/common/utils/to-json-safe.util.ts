type JsonSafe = string | number | boolean | null | JsonSafe[] | { [key: string]: JsonSafe };

export function toJsonSafe<T>(value: T): JsonSafe {
  if (value === null || value === undefined) return null;

  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') return value;

  if (Array.isArray(value)) {
    return value.map((item) => toJsonSafe(item));
  }

  if (typeof value === 'object') {
    if (value instanceof Date) return value.toISOString();
    const objectValue = value as Record<string, unknown>;
    if (typeof objectValue.toNumber === 'function') {
      try {
        return Number(objectValue.toNumber());
      } catch {
        return String(value);
      }
    }

    const output: { [key: string]: JsonSafe } = {};
    for (const key of Object.keys(objectValue)) {
      output[key] = toJsonSafe(objectValue[key]);
    }
    return output;
  }

  return String(value);
}
