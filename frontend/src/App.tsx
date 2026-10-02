import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from '@/components/guards/ProtectedRoute'
import MainLayout from '@/components/layout/MainLayout'
import AdminLayout from '@/components/layout/AdminLayout'
import AdminRoute from '@/components/guards/AdminRoute'
import RequireRole from '@/components/guards/RequireRole'

// ── Auth Pages ──
import { lazy, Suspense, useEffect, useState } from 'react'

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'))
const VerifyPhonePage = lazy(() => import('@/pages/auth/VerifyPhonePage'))
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'))

// ── Public Pages ──
const HomePage = lazy(() => import('@/pages/home/HomePage'))
const DocumentsListPage = lazy(() => import('@/pages/documents/DocumentsListPage'))
const DocumentDetailPage = lazy(() => import('@/pages/documents/DocumentDetailPage'))
const PolicyPage = lazy(() => import('@/pages/policies/PolicyPage'))
const PackagesPage = lazy(() => import('@/pages/packages/PackagesPage'))

// ── Private Pages (Phase 3) ──
const CartPage = lazy(() => import('@/pages/cart/CartPage'))
const WishlistPage = lazy(() => import('@/pages/cart/WishlistPage'))
const VnpayReturnPage = lazy(() => import('@/pages/payment/VnpayReturnPage'))

// ── Private Pages (Phase 4) ──
const OrdersPage = lazy(() => import('@/pages/orders/OrdersPage'))
const OrderDetailPage = lazy(() => import('@/pages/orders/OrderDetailPage'))
const LibraryPage = lazy(() => import('@/pages/library/LibraryPage'))

// ── Private Pages (Phase 5 & 7) ──
const ProfilePage = lazy(() => import('@/pages/profile/ProfilePage'))

// ── Private Pages (Phase 6) ──
const SellerDashboardPage = lazy(() => import('@/pages/seller/SellerDashboardPage'))
const SellerDocumentsPage = lazy(() => import('@/pages/seller/SellerDocumentsPage'))
const SellerUploadPage = lazy(() => import('@/pages/seller/SellerUploadPage'))
const SellerSalesPage = lazy(() => import('@/pages/seller/SellerSalesPage'))

// ── Admin Pages (Phase 8) ──
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'))
const AdminApprovalsPage = lazy(() => import('@/pages/admin/AdminApprovalsPage'))
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage'))
const AdminWithdrawalsPage = lazy(() => import('@/pages/admin/AdminWithdrawalsPage'))
const AdminDocumentsPage = lazy(() => import('@/pages/admin/AdminDocumentsPage'))
const AdminReportsPage = lazy(() => import('@/pages/admin/AdminReportsPage'))
const AdminCategoriesPage = lazy(() => import('@/pages/admin/AdminCategoriesPage'))
const AdminTagsPage = lazy(() => import('@/pages/admin/AdminTagsPage'))
const AdminReconciliationPage = lazy(() => import('@/pages/admin/AdminReconciliationPage'))
const AdminConfigsPage = lazy(() => import('@/pages/admin/AdminConfigsPage'))
const AdminPackagesPage = lazy(() => import('@/pages/admin/AdminPackagesPage'))
const AdminRevenuePage = lazy(() => import('@/pages/admin/AdminRevenuePage'))
const AdminGatewayPage = lazy(() => import('@/pages/admin/AdminGatewayPage'))
const AdminPoliciesPage = lazy(() => import('@/pages/admin/AdminPoliciesPage'))
const AdminAuditLogsPage = lazy(() => import('@/pages/admin/AdminAuditLogsPage'))
const AdminProfilePage = lazy(() => import('@/pages/admin/AdminProfilePage'))
const AdminTaxPage = lazy(() => import('@/pages/admin/AdminTaxPage'))
const NotFoundPage = lazy(() => import('@/pages/errors/NotFoundPage'))
const ForbiddenPage = lazy(() => import('@/pages/errors/ForbiddenPage'))
import { useAuthStore } from '@/store/authStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { useNotificationStore } from '@/store/notificationStore'
import { authApi } from '@/api/auth.api'

function App() {
  const user = useAuthStore((state) => state.user)
  const accessToken = useAuthStore((state) => state.accessToken)
  const login = useAuthStore((state) => state.login)
  const logout = useAuthStore((state) => state.logout)
  const [authReady, setAuthReady] = useState(!user || Boolean(accessToken))

  useEffect(() => {
    if (!user || accessToken) return

    let active = true
    authApi.refresh()
      .then((session) => {
        if (active) {
          login({ accessToken: session.accessToken, user: session.user })
          setAuthReady(true)
        }
      })
      .catch(() => {
        if (active) {
          logout()
          setAuthReady(true)
        }
      })
    return () => { active = false }
  }, [accessToken, login, logout, user])

  useEffect(() => {
    if (user) {
      useWishlistStore.getState().fetchWishlist()
      useNotificationStore.getState().fetchInitial()
    }
  }, [user])

  useEffect(() => {
    if (user && accessToken) useNotificationStore.getState().connect()
    else useNotificationStore.getState().disconnect()
    return () => useNotificationStore.getState().disconnect()
  }, [accessToken, user])

  if (!authReady) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground" role="status">Đang khôi phục phiên đăng nhập...</div>
  }

  return (
    <Suspense fallback={<div className="min-h-[40vh] grid place-items-center text-muted-foreground" role="status">Đang tải trang...</div>}>
    <Routes>
      {/* ── Public Auth ── */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/forbidden" element={<ForbiddenPage />} />

      {/* ── Protected Auth ── */}
      <Route
        path="/verify-phone"
        element={
          <ProtectedRoute>
            <VerifyPhonePage />
          </ProtectedRoute>
        }
      />

      {/* ── Main App Layout (Public & Protected routes grouped here) ── */}
      <Route
        path="/*"
        element={
          <MainLayout>
            <Routes>
              {/* Public Map */}
              <Route path="/" element={<HomePage />} />
              <Route path="/documents" element={<DocumentsListPage />} />
              <Route path="/documents/:id" element={<DocumentDetailPage />} />
              <Route path="/policies" element={<PolicyPage />} />
              <Route path="/policies/:slug" element={<PolicyPage />} />
              <Route path="/packages" element={<PackagesPage />} />

              {/* Protected Map */}
              <Route path="/cart" element={<ProtectedRoute><CartPage /></ProtectedRoute>} />
              <Route path="/wishlist" element={<ProtectedRoute><WishlistPage /></ProtectedRoute>} />
              <Route path="/payment/vnpay-return" element={<ProtectedRoute><VnpayReturnPage /></ProtectedRoute>} />
              <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
              <Route path="/orders/:id" element={<ProtectedRoute><OrderDetailPage /></ProtectedRoute>} />
              <Route path="/library" element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

              {/* Seller Map */}
              <Route path="/seller/dashboard" element={<ProtectedRoute requiredRoles={['customer', 'admin']}><SellerDashboardPage /></ProtectedRoute>} />
              <Route path="/seller/documents" element={<ProtectedRoute requiredRoles={['customer', 'admin']}><SellerDocumentsPage /></ProtectedRoute>} />
              <Route path="/seller/documents/new" element={<ProtectedRoute requiredRoles={['customer', 'admin']}><SellerUploadPage /></ProtectedRoute>} />
              <Route path="/seller/sales" element={<ProtectedRoute requiredRoles={['customer', 'admin']}><SellerSalesPage /></ProtectedRoute>} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </MainLayout>
        }
      />

      {/* ── Admin App Layout (Phase 8) ── */}
      <Route
        path="/admin/*"
        element={
          <AdminRoute>
            <AdminLayout>
              <Routes>
              {/* Admin-only routes */}
                <Route path="/" element={
                  <RequireRole allowedRoles={['admin']} redirectTo="/admin/approvals">
                    <AdminDashboardPage />
                  </RequireRole>
                } />

                {/* Admin + Mod (content moderation) */}
                <Route path="/approvals" element={
                  <RequireRole allowedRoles={['admin', 'mod']} redirectTo="/admin/profile">
                    <AdminApprovalsPage />
                  </RequireRole>
                } />
                <Route path="/reports" element={
                  <RequireRole allowedRoles={['admin', 'mod']} redirectTo="/admin/profile">
                    <AdminReportsPage />
                  </RequireRole>
                } />
                <Route path="/documents" element={
                  <RequireRole allowedRoles={['admin', 'mod']} redirectTo="/admin/profile">
                    <AdminDocumentsPage />
                  </RequireRole>
                } />
                <Route path="/categories" element={
                  <RequireRole allowedRoles={['admin', 'mod']} redirectTo="/admin/profile">
                    <AdminCategoriesPage />
                  </RequireRole>
                } />
                <Route path="/tags" element={
                  <RequireRole allowedRoles={['admin', 'mod']} redirectTo="/admin/profile">
                    <AdminTagsPage />
                  </RequireRole>
                } />
                <Route path="/policies" element={
                  <RequireRole allowedRoles={['admin', 'mod']} redirectTo="/admin/profile">
                    <AdminPoliciesPage />
                  </RequireRole>
                } />

                {/* Admin + Accountant (financial oversight) */}
                <Route path="/users" element={
                  <RequireRole allowedRoles={['admin', 'mod']} redirectTo="/admin/profile">
                    <AdminUsersPage />
                  </RequireRole>
                } />
                <Route path="/withdrawals" element={
                  <RequireRole allowedRoles={['admin', 'accountant']} redirectTo="/admin/profile">
                    <AdminWithdrawalsPage />
                  </RequireRole>
                } />
                <Route path="/revenue" element={
                  <RequireRole allowedRoles={['admin', 'accountant']} redirectTo="/admin/profile">
                    <AdminRevenuePage />
                  </RequireRole>
                } />
                <Route path="/gateway" element={
                  <RequireRole allowedRoles={['admin', 'accountant']} redirectTo="/admin/profile">
                    <AdminGatewayPage />
                  </RequireRole>
                } />
                <Route path="/reconciliation" element={
                  <RequireRole allowedRoles={['admin', 'accountant']} redirectTo="/admin/profile">
                    <AdminReconciliationPage />
                  </RequireRole>
                } />
                <Route path="/tax" element={
                  <RequireRole allowedRoles={['admin', 'accountant']} redirectTo="/admin/profile">
                    <AdminTaxPage />
                  </RequireRole>
                } />
                <Route path="/packages" element={
                  <RequireRole allowedRoles={['admin', 'accountant']} redirectTo="/admin/profile">
                    <AdminPackagesPage />
                  </RequireRole>
                } />

                {/* Admin only (system config) */}
                <Route path="/configs" element={
                  <RequireRole allowedRoles={['admin']} redirectTo="/admin/profile">
                    <AdminConfigsPage />
                  </RequireRole>
                } />
                <Route path="/audit-logs" element={
                  <RequireRole allowedRoles={['admin']} redirectTo="/admin/profile">
                    <AdminAuditLogsPage />
                  </RequireRole>
                } />

                {/* All staff */}
                <Route path="/profile" element={<AdminProfilePage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </AdminLayout>
          </AdminRoute>
        }
      />
    </Routes>
    </Suspense>
  )
}

export default App
