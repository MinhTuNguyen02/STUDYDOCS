import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from '@/components/guards/ProtectedRoute'
import MainLayout from '@/components/layout/MainLayout'
import AdminLayout from '@/components/layout/AdminLayout'
import AdminRoute from '@/components/guards/AdminRoute'

// ── Auth Pages ──
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import VerifyPhonePage from '@/pages/auth/VerifyPhonePage'

// ── Public Pages ──
import HomePage from '@/pages/home/HomePage'
import DocumentsListPage from '@/pages/documents/DocumentsListPage'
import DocumentDetailPage from '@/pages/documents/DocumentDetailPage'
import PolicyPage from '@/pages/policies/PolicyPage'
import PackagesPage from '@/pages/packages/PackagesPage'

// ── Private Pages (Phase 3) ──
import CartPage from '@/pages/cart/CartPage'
import WishlistPage from '@/pages/cart/WishlistPage'
import VnpayReturnPage from '@/pages/payment/VnpayReturnPage'

// ── Private Pages (Phase 4) ──
import OrdersPage from '@/pages/orders/OrdersPage'
import OrderDetailPage from '@/pages/orders/OrderDetailPage'
import LibraryPage from '@/pages/library/LibraryPage'

// ── Private Pages (Phase 5 & 7) ──
import ProfilePage from '@/pages/profile/ProfilePage'

// ── Private Pages (Phase 6) ──
import SellerDashboardPage from '@/pages/seller/SellerDashboardPage'
import SellerDocumentsPage from '@/pages/seller/SellerDocumentsPage'
import SellerUploadPage from '@/pages/seller/SellerUploadPage'
import SellerSalesPage from '@/pages/seller/SellerSalesPage'

// ── Admin Pages (Phase 8) ──
import AdminDashboardPage from '@/pages/admin/AdminDashboardPage'
import AdminApprovalsPage from '@/pages/admin/AdminApprovalsPage'
import AdminUsersPage from '@/pages/admin/AdminUsersPage'
import AdminWithdrawalsPage from '@/pages/admin/AdminWithdrawalsPage'
import AdminDocumentsPage from '@/pages/admin/AdminDocumentsPage'
import AdminReportsPage from '@/pages/admin/AdminReportsPage'
import AdminCategoriesPage from '@/pages/admin/AdminCategoriesPage'
import AdminTagsPage from '@/pages/admin/AdminTagsPage'
import AdminReconciliationPage from '@/pages/admin/AdminReconciliationPage'
import AdminDisputesPage from '@/pages/admin/AdminDisputesPage'
import AdminConfigsPage from '@/pages/admin/AdminConfigsPage'
import AdminPackagesPage from '@/pages/admin/AdminPackagesPage'
import AdminRevenuePage from '@/pages/admin/AdminRevenuePage'
import AdminPoliciesPage from '@/pages/admin/AdminPoliciesPage'
import AdminAuditLogsPage from '@/pages/admin/AdminAuditLogsPage'
import PlaceholderAdminPage from '@/pages/admin/PlaceholderAdminPage'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'

function App() {
  const { loginTimestamp, logout } = useAuthStore()

  useEffect(() => {
    const TWO_HOURS = 2 * 60 * 60 * 1000
    
    const checkAuth = () => {
      if (loginTimestamp && Date.now() - loginTimestamp >= TWO_HOURS) {
         useAuthStore.getState().logout()
      } else if (useAuthStore.getState().user) {
         // Optionally fetch on startup if user is logged in
      }
    }

    // Initial check
    checkAuth()
    
    const { user } = useAuthStore.getState()
    if (user) {
      import('@/store/wishlistStore').then(({ useWishlistStore }) => {
        useWishlistStore.getState().fetchWishlist()
      })
    }

    // Setup periodic check every minute
    const interval = setInterval(checkAuth, 60000)
    
    return () => clearInterval(interval)
  }, [loginTimestamp, logout])

  return (
    <Routes>
      {/* ── Public Auth ── */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

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
              <Route path="/seller/dashboard" element={<ProtectedRoute><SellerDashboardPage /></ProtectedRoute>} />
              <Route path="/seller/documents" element={<ProtectedRoute><SellerDocumentsPage /></ProtectedRoute>} />
              <Route path="/seller/documents/new" element={<ProtectedRoute><SellerUploadPage /></ProtectedRoute>} />
              <Route path="/seller/sales" element={<ProtectedRoute><SellerSalesPage /></ProtectedRoute>} />
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
                <Route path="/" element={<AdminDashboardPage />} />
                <Route path="/approvals" element={<AdminApprovalsPage />} />
                <Route path="/users" element={<AdminUsersPage />} />
                <Route path="/documents" element={<AdminDocumentsPage />} />
                <Route path="/reports" element={<AdminReportsPage />} />
                <Route path="/withdrawals" element={<AdminWithdrawalsPage />} />
                <Route path="/categories" element={<AdminCategoriesPage />} />
                <Route path="/tags" element={<AdminTagsPage />} />
                <Route path="/disputes" element={<AdminDisputesPage />} />
                <Route path="/reconciliation" element={<AdminReconciliationPage />} />
                <Route path="/revenue" element={<AdminRevenuePage />} />
                <Route path="/configs" element={<AdminConfigsPage />} />
                <Route path="/policies" element={<AdminPoliciesPage />} />
                <Route path="/audit-logs" element={<AdminAuditLogsPage />} />
                <Route path="/packages" element={<AdminPackagesPage />} />
              </Routes>
            </AdminLayout>
          </AdminRoute>
        }
      />
    </Routes>
  )
}

export default App
