import api from './client';

export const adminApi = {
  getDashboardStats: async (params?: any) => {
    const res = await api.get('/admin/dashboard', { params });
    return res.data;
  },
  getApprovals: async () => {
    const res = await api.get('/admin/approvals/documents');
    return res.data;
  },
  approveDocument: async (id: number) => {
    const res = await api.patch(`/admin/approvals/documents/${id}/approve`);
    return res.data;
  },
  rejectDocument: async (id: number, reason: string) => {
    const res = await api.patch(`/admin/approvals/documents/${id}/reject`, { reason });
    return res.data;
  },
  getDocumentReviewUrl: async (id: number) => {
    const res = await api.get(`/admin/approvals/documents/${id}/review-url`);
    return res.data;
  },

  getUsers: async (params?: any) => {
    const res = await api.get('/admin/users', { params });
    return res.data;
  },
  toggleUserStatus: async (id: number) => {
    const res = await api.patch(`/admin/users/${id}/toggle-active`);
    return res.data;
  },
  createStaffAccount: async (data: { email: string; fullName: string; password: string; role: 'MOD' | 'ACCOUNTANT' }) => {
    const res = await api.post('/admin/users/staff', data);
    return res.data;
  },

  getAllDocuments: async (params?: any) => {
    const res = await api.get('/admin/documents', { params });
    return res.data;
  },

  getWithdrawals: async () => {
    const res = await api.get('/admin/withdrawals');
    return res.data;
  },
  processWithdrawal: async (id: number, data: { status: string; note?: string }) => {
    const res = await api.patch(`/wallets/withdrawals/${id}`, data);
    return res.data;
  },

  getReports: async () => {
    const res = await api.get('/reports');
    return res.data;
  },
  resolveReport: async (id: number, data: { status: string }) => {
    const res = await api.put(`/reports/${id}/resolve`, data);
    return res.data;
  },
  getDisputes: async () => {
    const res = await api.get('/disputes');
    return res.data;
  },
  analyzeDispute: async (id: number) => {
    const res = await api.put(`/disputes/${id}/analyze`);
    return res.data;
  },
  resolveDispute: async (id: number, data: { status: string; resolution: string }) => {
    const res = await api.put(`/disputes/${id}/resolve`, data);
    return res.data;
  },

  getReconciliation: async () => {
    const res = await api.get('/admin/reconciliation');
    return res.data;
  },
  getRevenueReport: async (params?: any) => {
    const res = await api.get('/admin/reports/revenue', { params });
    return res.data;
  },

  getConfigs: async () => {
    const res = await api.get('/configs');
    return res.data;
  },
  updateConfig: async (key: string, data: { value: string; description?: string }) => {
    const res = await api.put(`/configs/${key}`, data);
    return res.data;
  },
  getPackages: async () => {
    const res = await api.get('/packages/admin/all');
    return res.data;
  },
  createPackage: async (data: { name: string; description: string; price: number; download_turns: number; duration_days: number; is_active?: boolean }) => {
    const res = await api.post('/packages', data);
    return res.data;
  },
  updatePackage: async (id: number, data: any) => {
    const res = await api.put(`/packages/${id}`, data);
    return res.data;
  },
  deletePackage: async (id: number) => {
    const res = await api.put(`/packages/${id}/delete`); // Soft delete
    return res.data;
  },

  // ── Categories ──
  createCategory: async (data: { name: string; slug: string; parent_id?: number }) => {
    const res = await api.post('/categories', data);
    return res.data;
  },
  updateCategory: async (id: number, data: { name?: string; slug?: string; parent_id?: number }) => {
    const res = await api.patch(`/categories/${id}`, data);
    return res.data;
  },
  deleteCategory: async (id: number) => {
    const res = await api.delete(`/categories/${id}`);
    return res.data;
  },

  // ── Tags ──
  createTag: async (data: { tag_name: string; slug: string }) => {
    const res = await api.post('/tags', data);
    return res.data;
  },
  updateTag: async (id: number, data: { tag_name?: string; slug?: string }) => {
    const res = await api.patch(`/tags/${id}`, data);
    return res.data;
  },
  deleteTag: async (id: number) => {
    const res = await api.delete(`/tags/${id}`);
    return res.data;
  },

  // ── Policies ──
  getPolicies: async () => {
    const res = await api.get('/policies/admin/all');
    return res.data;
  },
  createPolicy: async (data: { title: string; slug: string; content: string; isActive?: boolean }) => {
    const res = await api.post('/policies', data);
    return res.data;
  },
  updatePolicy: async (id: number, data: { title: string; slug: string; content: string; isActive?: boolean }) => {
    const res = await api.put(`/policies/${id}`, data);
    return res.data;
  },
  deletePolicy: async (id: number) => {
    const res = await api.delete(`/policies/${id}`);
    return res.data;
  },

  // ── Audit Logs ──
  getAuditLogs: async (params?: any) => {
    const res = await api.get('/admin/audit-logs', { params });
    return res.data;
  }
};
