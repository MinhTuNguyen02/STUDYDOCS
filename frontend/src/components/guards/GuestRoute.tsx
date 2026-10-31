import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

interface Props {
  children: ReactNode
}

/**
 * GuestRoute: Ngăn chặn người dùng đã đăng nhập truy cập vào các trang xác thực (login, register, reset-password).
 * Tự động chuyển hướng về trang trước đó (nếu có) hoặc trang chủ / trang quản trị theo role.
 */
export default function GuestRoute({ children }: Props) {
  const { isAuthenticated, user } = useAuthStore()
  const location = useLocation()

  if (isAuthenticated && user) {
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname
    if (from && from !== '/login' && from !== '/register' && from !== '/reset-password') {
      return <Navigate to={from} replace />
    }

    const role = (user.roleNames?.[0] || '').toLowerCase()
    if (['admin', 'mod', 'accountant'].includes(role)) {
      return <Navigate to="/admin" replace />
    }

    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
