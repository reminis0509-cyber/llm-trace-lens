/**
 * Shared type definitions for FujiTrace AI Tools (見積書 etc).
 */

export interface EstimateClient {
  company_name: string;
  contact_person?: string;
  honorific: '御中' | '様' | string;
}

export interface EstimateItem {
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  tax_rate: number;
  subtotal: number;
}

export interface EstimateData {
  estimate_number: string;
  issue_date: string;
  valid_until: string;
  client: EstimateClient;
  subject: string;
  items: EstimateItem[];
  subtotal: number;
  tax_amount: number;
  total: number;
  delivery_date?: string;
  payment_terms?: string;
  notes?: string;
}

export interface CheckIssue {
  field: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface CheckResult {
  status: 'ok' | 'warning' | 'error';
  critical_issues: CheckIssue[];
  warnings: CheckIssue[];
  suggestions: string[];
  responsibility_notice: string;
}

export interface BusinessInfoRecord {
  id: string;
  workspace_id: string;
  company_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  invoice_number: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  account_type: string | null;
  account_number: string | null;
  account_holder: string | null;
  created_at: string;
  updated_at: string;
}
