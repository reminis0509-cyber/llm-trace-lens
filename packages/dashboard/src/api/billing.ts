import { supabase } from '../lib/supabase';

const API_BASE = '';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (session?.user) {
    headers['X-User-ID'] = session.user.id;
    headers['X-User-Email'] = session.user.email || '';
  }

  return headers;
}

// ---- Types ----

export interface BillingStatus {
  configured: boolean;
  planType?: string;
  hasCustomer?: boolean;
  subscription?: {
    status: string;
    subscriptionId: string;
    updatedAt: string;
  } | null;
  message?: string;
}

// ---- Billing API ----

export const billingApi = {
  /**
   * Get billing status
   */
  getStatus: async (): Promise<BillingStatus> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/billing/status`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      return { configured: false };
    }
    return res.json();
  },

  /**
   * Create Stripe Checkout Session (Free → Pro)
   */
  createCheckout: async (): Promise<{ checkoutUrl: string; sessionId: string }> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/billing/checkout`, {
      method: 'POST',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.message || error.error || 'Checkout Session の作成に失敗しました');
    }
    return res.json();
  },

  /**
   * Create Stripe Customer Portal Session
   */
  createPortal: async (): Promise<{ portalUrl: string }> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/billing/portal`, {
      method: 'POST',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.message || error.error || 'Portal Session の作成に失敗しました');
    }
    return res.json();
  },
};
