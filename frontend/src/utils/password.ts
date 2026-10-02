export const PASSWORD_REQUIREMENTS =
  'Mật khẩu phải dài 8–72 ký tự và có chữ hoa, chữ thường, chữ số, ký tự đặc biệt.'

export function isStrongPassword(password: string) {
  return (
    password.length >= 8 &&
    password.length <= 72 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  )
}
