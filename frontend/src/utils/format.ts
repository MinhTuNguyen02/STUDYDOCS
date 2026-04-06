export const formatPrice = (price: number | string | undefined | null) => {
  if (price === undefined || price === null) return '0 đ'
  const numericPrice = Number(price)
  if (isNaN(numericPrice)) return '0 đ'
  if (numericPrice === 0) return 'Miễn phí'
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(numericPrice)
}

export const formatBalance = (price: number | string | undefined | null) => {
  if (price === undefined || price === null) return '0 đ'
  const numericPrice = Number(price)
  if (isNaN(numericPrice)) return '0 đ'
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(numericPrice)
}
export const formatDate = (dateString: string | undefined | null) => {
  if (!dateString) return ''
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return '' // Invalid Date check
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

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
