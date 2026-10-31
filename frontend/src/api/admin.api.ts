import api from "./client";
import type {
  GatewayReport,
  LedgerReportParams,
  RevenueReport,
  TaxReport,
} from "./contracts";

export const adminApi = {
  getDashboardStats: async (
    params?: Record<string, string | number | undefined>,
  ) => {
    const res = await api.get("/admin/dashboard", { params });
    return res.data;
  },
  getApprovals: async (
    params?: Record<string, string | number | undefined>,
    signal?: AbortSignal,
  ) => {
    const res = await api.get("/admin/approvals/documents", { params, signal });
    return res.data;
  },
  approveDocument: async (id: number) => {
    const res = await api.patch(`/admin/approvals/documents/${id}/approve`);
    return res.data;
  },
  rejectDocument: async (id: number, reason: string) => {
    const res = await api.patch(`/admin/approvals/documents/${id}/reject`, {
      reason,
    });
    return res.data;
  },
  getDocumentReviewUrl: async (id: number) => {
    const res = await api.get(`/admin/approvals/documents/${id}/review-url`);
    return res.data;
  },

  getUsers: async (
    params?: Record<string, string | number | undefined>,
    signal?: AbortSignal,
  ) => {
    const res = await api.get("/admin/users", { params, signal });
    return res.data;
  },
  toggleUserStatus: async (id: number, durationDays: number | null = null) => {
    const res = await api.patch(`/admin/users/${id}/toggle-active`, {
      durationDays,
    });
    return res.data;
  },
  createStaffAccount: async (data: {
    email: string;
    fullName: string;
    password: string;
    role: "MOD" | "ACCOUNTANT";
  }) => {
    const res = await api.post("/admin/users/staff", data);
    return res.data;
  },

  getAllDocuments: async (
    params?: Record<string, string | number | undefined>,
    signal?: AbortSignal,
  ) => {
    const res = await api.get("/admin/documents", { params, signal });
    return res.data;
  },
  softDeleteDocument: async (id: number) => {
    const res = await api.patch(`/admin/documents/${id}/soft-delete`);
    return res.data;
  },
  restoreDocument: async (id: number) => {
    const res = await api.patch(`/admin/documents/${id}/restore`);
    return res.data;
  },

  getWithdrawals: async (
    params?: Record<string, string | number | undefined>,
  ) => {
    const res = await api.get("/admin/withdrawals", { params });
    return res.data;
  },
  processWithdrawal: async (
    id: number,
    data: { status: string; note?: string },
  ) => {
    const res = await api.patch(`/wallets/withdrawals/${id}`, data);
    return res.data;
  },

  getReports: async (params?: Record<string, string | number | undefined>) => {
    const res = await api.get("/reports", { params });
    return res.data;
  },
  resolveReport: async (id: number, data: { status: string }) => {
    const res = await api.put(`/reports/${id}/resolve`, data);
    return res.data;
  },

  getReconciliation: async () => {
    const res = await api.get("/admin/reconciliation");
    return res.data;
  },
  getRevenueReport: async (
    params: LedgerReportParams & { startDate: string; endDate: string },
    signal?: AbortSignal,
  ): Promise<RevenueReport> => {
    const res = await api.get("/admin/reports/revenue", { params, signal });
    return res.data;
  },
  getGatewayWallet: async (
    params?: LedgerReportParams,
    signal?: AbortSignal,
  ): Promise<GatewayReport> => {
    const res = await api.get("/admin/wallets/gateway", { params, signal });
    return res.data;
  },
  getTaxWallet: async (
    params?: LedgerReportParams,
    signal?: AbortSignal,
  ): Promise<TaxReport> => {
    const res = await api.get("/admin/wallets/tax", { params, signal });
    return res.data;
  },
  payTax: async (data: { amount: number; note: string }) => {
    const res = await api.post("/admin/wallets/tax/pay", data);
    return res.data;
  },

  getConfigs: async () => {
    const res = await api.get("/configs");
    return res.data;
  },
  updateConfig: async (
    key: string,
    data: { value: string; description?: string },
  ) => {
    const res = await api.put(`/configs/${key}`, data);
    return res.data;
  },
  getPackages: async () => {
    const res = await api.get("/packages/admin/all");
    return res.data;
  },
  createPackage: async (data: {
    name: string;
    description: string;
    price: number;
    download_turns: number;
    duration_days: number;
    is_active?: boolean;
  }) => {
    const res = await api.post("/packages", data);
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
  createCategory: async (data: {
    name: string;
    slug: string;
    parent_id?: number;
  }) => {
    const res = await api.post("/categories", data);
    return res.data;
  },
  updateCategory: async (
    id: number,
    data: { name?: string; slug?: string; parent_id?: number },
  ) => {
    const res = await api.patch(`/categories/${id}`, data);
    return res.data;
  },
  deleteCategory: async (id: number) => {
    const res = await api.delete(`/categories/${id}`);
    return res.data;
  },

  // ── Tags ──
  createTag: async (data: { tag_name: string; slug: string }) => {
    const res = await api.post("/tags", data);
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
    const res = await api.get("/policies/admin/all");
    return res.data;
  },
  createPolicy: async (data: {
    title: string;
    slug: string;
    content: string;
    isActive?: boolean;
  }) => {
    const res = await api.post("/policies", data);
    return res.data;
  },
  updatePolicy: async (
    id: number,
    data: { title: string; slug: string; content: string; isActive?: boolean },
  ) => {
    const res = await api.put(`/policies/${id}`, data);
    return res.data;
  },
  deletePolicy: async (id: number) => {
    const res = await api.delete(`/policies/${id}`);
    return res.data;
  },

  // ── Audit Logs ──
  getAuditLogs: async (
    params?: Record<string, string | number | undefined>,
    signal?: AbortSignal,
  ) => {
    const res = await api.get("/admin/audit-logs", { params, signal });
    return res.data;
  },

  // ── Gateway Wallet ──
  getGatewayWalletReport: async (
    params?: {
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    },
    signal?: AbortSignal,
  ): Promise<GatewayReport> => {
    const res = await api.get("/admin/wallets/gateway", { params, signal });
    return res.data;
  },
};
