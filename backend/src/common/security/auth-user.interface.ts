export interface AuthUser {
  accountId: number;
  email: string;
  status: string;
  roleNames: string[];
  customerId: number | null;
  staffId: number | null;
}
