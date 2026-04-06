import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  requiredRoles?: string[]
  requirePhoneVerified?: boolean
}

/**
 * Route guard chung — kiểm tra đăng nhập + role.
 * Sử dụng: <ProtectedRoute>, <ProtectedRoute requiredRoles={['admin','mod']}>
 */
export default function ProtectedRoute({ children, requiredRoles, requirePhoneVerified }: Props) {
  const { isAuthenticated, user } = useAuthStore()
  const location = useLocation()

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requiredRoles && requiredRoles.length > 0) {
    const hasRole = user.roleNames.some((r) => requiredRoles.includes(r))
    if (!hasRole) {
      return <Navigate to="/" replace />
    }
  }

  if (requirePhoneVerified && !user.isPhoneVerified) {
    return <Navigate to="/verify-phone" state={{ from: location }} replace />
  }

  return <>{children}</>
}