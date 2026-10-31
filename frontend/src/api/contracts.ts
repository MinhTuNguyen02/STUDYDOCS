export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  meta: PaginationMeta;
  data: T[];
}

export interface LedgerTransaction {
  id: number;
  type: string;
  reference_type?: string | null;
  description?: string | null;
  status: string;
}

export interface LedgerEntry {
  id: number;
  wallet_id: number;
  transaction_id: number;
  debit_amount: string;
  credit_amount: string;
  created_at: string;
  ledger_transactions: LedgerTransaction;
}

export interface LedgerReportParams {
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface RevenueReport extends PaginatedResponse<LedgerEntry> {
  summary: { totalCredit: number; totalDebit: number; netRevenue: number };
}

export interface GatewayReport extends PaginatedResponse<LedgerEntry> {
  wallet: { wallet_id: number; balance: string } | null;
  summary: {
    totalIn: number;
    totalOut: number;
    netFlow: number;
    entryCount: number;
  } | null;
}

export interface TaxReport extends PaginatedResponse<LedgerEntry> {
  wallet: { wallet_id: number; balance: string } | null;
  summary: {
    totalCollected: number;
    totalPaid: number;
    netFlow: number;
    entryCount: number;
    availableTaxToPay: number;
  } | null;
}
