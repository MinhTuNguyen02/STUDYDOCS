// ─── Timezone constant ───────────────────────────────────────────────────────
const VN_TZ = 'Asia/Ho_Chi_Minh'

// ─── Currency ────────────────────────────────────────────────────────────────
export const formatPrice = (price: number | string | undefined | null) => {
  if (price === undefined || price === null) return '0 đ'
  const numericPrice = Number(price)
  if (isNaN(numericPrice)) return '0 đ'
  if (numericPrice === 0) return 'Miễn phí'
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(numericPrice)
}

export const formatBalance = (price: number | string | undefined | null) => {
  if (price === undefined || price === null) return '0 đ'
  const numericPrice = Number(price)
  if (isNaN(numericPrice)) return '0 đ'
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(numericPrice)
}

// ─── Date only: dd/MM/yyyy ────────────────────────────────────────────────────
export const formatDate = (dateString: string | Date | undefined | null) => {
  if (!dateString) return ''
  const d = new Date(dateString as string)
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VN_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

// ─── Date + time: dd/MM/yyyy HH:mm ───────────────────────────────────────────
export const formatDateTime = (dateString: string | Date | undefined | null) => {
  if (!dateString) return ''
  const d = new Date(dateString as string)
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VN_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

// ─── Date + time + seconds: dd/MM/yyyy HH:mm:ss (for audit logs) ─────────────
export const formatDateTimeSec = (dateString: string | Date | undefined | null) => {
  if (!dateString) return ''
  const d = new Date(dateString as string)
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VN_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d)
}

// ─── ISO date string clipped to VN local date: "YYYY-MM-DD" ─────────────────
// Use for <input type="date"> default values or generating filenames
export const toVNDateString = (date?: Date) => {
  const d = date ?? new Date()
  return new Intl.DateTimeFormat('en-CA', {   // en-CA gives YYYY-MM-DD
    timeZone: VN_TZ,
  }).format(d)
}

// ─── File size ────────────────────────────────────────────────────────────────
export const formatFileSize = (bytes: number | string | undefined | null) => {
  if (bytes === undefined || bytes === null) return '0 B'
  const numericBytes = Number(bytes)
  if (isNaN(numericBytes)) return '0 B'
  if (numericBytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(numericBytes) / Math.log(k))
  return parseFloat((numericBytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
