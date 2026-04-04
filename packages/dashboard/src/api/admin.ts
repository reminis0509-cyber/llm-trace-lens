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

  const adminToken = sessionStorage.getItem('fujitrace_admin_token');
  if (adminToken) {
    headers['Authorization'] = `Bearer ${adminToken}`;
  }

  return headers;
}

// ---- Types ----

export interface AdminOverviewStats {
  totalWorkspaces: number;
  planDistribution: Record<string, number>;
  mrr: number;
  totalTraces: number;
  totalMembers: number;
  newWorkspacesThisWeek: number;
  newWorkspacesThisMonth: number;
  chatbotStats: {
    totalChatbots: number;
    publishedChatbots: number;
    totalSessions: number;
    totalMessages: number;
  };
}

export type WorkspaceStatus = 'trial' | 'active' | 'expired' | 'free';

export interface WorkspaceMember {
  email: string;
  role: string;
}

export interface AdminWorkspace {
  id: string;
  name: string;
  companyName?: string;
  createdAt: string | null;
  status: WorkspaceStatus;
  trialDaysRemaining: number | null;
  members: WorkspaceMember[];
  plan: {
    type: string;
    startedAt: string;
    expiresAt?: string;
    subscriptionId?: string;
  };
  usage: {
    traceCount: number;
    traceLimit: number | null;
    tracePercentage: number;
    evaluationCount: number;
    month: string;
  };
  chatbot: {
    count: number;
    publishedCount: number;
    totalSessions: number;
    totalMessages: number;
  };
}

export interface AdminWorkspaceDetail extends AdminWorkspace {
  limits: {
    monthlyTraces: number;
    maxWorkspaces: number;
    maxMembers: number;
    retentionDays: number;
    customRules: boolean;
    monthlyEvaluations: number;
    sso: boolean;
    sla: number | null;
    prioritySupport: boolean;
  };
  chatbots: Array<{
    id: string;
    name: string;
    isPublished: boolean;
    model: string;
    sessionCount: number;
    messageCount: number;
  }>;
  apiKeys: Array<{
    name: string;
    isActive: boolean;
    createdAt: string;
    lastUsedAt: string | null;
  }>;
}

export interface RegistrationData {
  date: string;
  count: number;
}

// ---- Admin API ----

export const adminApi = {
  /**
   * Login with email and password
   */
  login: async (email: string, password: string): Promise<{ success: boolean; token: string }> => {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'ログインに失敗しました');
    }
    return res.json();
  },

  /**
   * Logout admin session
   */
  logout: () => {
    sessionStorage.removeItem('fujitrace_admin_token');
  },

  /**
   * Check if current user is system admin
   */
  checkAdmin: async (): Promise<{ isAdmin: boolean; email?: string }> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/admin/check`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      return { isAdmin: false };
    }
    return res.json();
  },

  /**
   * Get overview stats
   */
  getOverviewStats: async (): Promise<AdminOverviewStats> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/admin/stats/overview`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.message || error.error || '統計の取得に失敗しました');
    }
    return res.json();
  },

  /**
   * Get all workspaces
   */
  getWorkspaces: async (): Promise<AdminWorkspace[]> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/admin/workspaces`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.message || error.error || 'ワークスペース一覧の取得に失敗しました');
    }
    const data = await res.json();
    return data.workspaces || [];
  },

  /**
   * Get workspace detail
   */
  getWorkspaceDetail: async (id: string): Promise<AdminWorkspaceDetail> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/admin/workspaces/${id}`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.message || error.error || 'ワークスペース詳細の取得に失敗しました');
    }
    return res.json();
  },

  /**
   * Update workspace company name
   */
  updateCompanyName: async (workspaceId: string, companyName: string): Promise<{ message: string }> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/admin/workspaces/${workspaceId}/company`, {
      method: 'PUT',
      headers,
      credentials: 'include',
      body: JSON.stringify({ companyName }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.message || error.error || '会社名の更新に失敗しました');
    }
    return res.json();
  },

  /**
   * Get registration trend data
   */
  getRegistrations: async (): Promise<RegistrationData[]> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/admin/stats/registrations`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.message || error.error || '登録推移の取得に失敗しました');
    }
    const data = await res.json();
    return data.registrations || [];
  },

  /**
   * Update workspace plan
   */
  updatePlan: async (
    id: string,
    planType: string,
    options?: {
      expiresAt?: string;
      subscriptionId?: string;
      customLimits?: Record<string, unknown>;
    }
  ): Promise<{ message: string }> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/admin/workspaces/${id}/plan`, {
      method: 'PUT',
      headers,
      credentials: 'include',
      body: JSON.stringify({ planType, ...options }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.message || error.error || 'プラン変更に失敗しました');
    }
    return res.json();
  },
};
