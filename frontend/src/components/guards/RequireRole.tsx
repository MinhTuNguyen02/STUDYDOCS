import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

interface Props {
  allowedRoles: string[]   // e.g. ['admin'] or ['admin', 'mod']
  children: ReactNode
  redirectTo?: string
}

/**
 * Hard gate: blocks render AND redirects if user's role is not in allowedRoles.
 * Use inside /admin/* routes where specific pages need stricter role checks.
 */
export default function RequireRole({ allowedRoles, children, redirectTo = '/admin' }: Props) {
  const { user } = useAuthStore()

  if (!user) return <Navigate to="/login" replace />

  const userRole = (user.roleNames?.[0] || '').toLowerCase()
  if (!allowedRoles.map(r => r.toLowerCase()).includes(userRole)) {
    return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}
