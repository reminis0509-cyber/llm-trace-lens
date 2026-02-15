import type { TraceListResponse, Trace, StatsResponse } from '../types';
import { supabase } from '../lib/supabase';

const API_BASE = '';

/**
 * Get auth headers including user info for RBAC
 */
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

export async function fetchTraces(params: {
  limit?: number;
  offset?: number;
  level?: string;
  provider?: string;
}): Promise<TraceListResponse> {
  const searchParams = new URLSearchParams();
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.offset) searchParams.set('offset', String(params.offset));
  if (params.level) searchParams.set('level', params.level);
  if (params.provider) searchParams.set('provider', params.provider);

  const response = await fetch(`${API_BASE}/v1/traces?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch traces');
  return response.json();
}

export async function fetchTrace(id: string): Promise<Trace> {
  const response = await fetch(`${API_BASE}/v1/traces/${id}`);
  if (!response.ok) throw new Error('Failed to fetch trace');
  return response.json();
}

export async function fetchStats(): Promise<StatsResponse> {
  const response = await fetch(`${API_BASE}/v1/stats`);
  if (!response.ok) throw new Error('Failed to fetch stats');
  return response.json();
}

export async function checkHealth(): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) throw new Error('Health check failed');
  return response.json();
}

export interface StorageUsageStats {
  currentCount: number;
  maxCount: number;
  maxAgeDays: number;
  oldestDate: string | null;
  usagePercent: number;
  storageType: string;
}

export async function fetchStorageUsage(): Promise<StorageUsageStats> {
  const response = await fetch(`${API_BASE}/api/storage/usage`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch storage usage');
  }
  return response.json();
}

// ---- Member Management Types ----

export type Role = 'owner' | 'admin' | 'member';

export interface WorkspaceMember {
  id: string;
  email: string;
  role: Role;
  invited_by: string | null;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  role: Role;
  joined_at: string;
}

export interface Invitation {
  token: string;
  email: string | null;
  invited_by_email: string;
  expires_at: string;
  created_at: string;
}

// ---- Member Management API ----

export const membersApi = {
  /**
   * Create invitation link
   */
  createInvitation: async (
    workspaceId: string,
    email?: string
  ): Promise<{ inviteLink: string; expiresAt: string; message: string }> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/invitations`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.message || error.error || 'Failed to create invitation');
    }
    return res.json();
  },

  /**
   * List workspace members
   */
  getMembers: async (workspaceId: string): Promise<WorkspaceMember[]> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/members`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.message || error.error || 'Failed to fetch members');
    }
    return res.json();
  },

  /**
   * Remove member from workspace
   */
  removeMember: async (workspaceId: string, memberId: string): Promise<void> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'DELETE',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.message || error.error || 'Failed to remove member');
    }
  },

  /**
   * Update member role
   */
  updateRole: async (
    workspaceId: string,
    memberId: string,
    role: Role
  ): Promise<void> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/members/${memberId}/role`, {
      method: 'PATCH',
      headers,
      credentials: 'include',
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.message || error.error || 'Failed to update role');
    }
  },

  /**
   * Accept invitation
   */
  acceptInvitation: async (token: string): Promise<{ workspaceId: string; role: Role; success: boolean }> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/invitations/accept`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.message || error.error || 'Failed to accept invitation');
    }
    return res.json();
  },

  /**
   * Get pending invitations
   */
  getInvitations: async (workspaceId: string): Promise<Invitation[]> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/invitations`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.message || error.error || 'Failed to fetch invitations');
    }
    return res.json();
  },

  /**
   * Revoke invitation
   */
  revokeInvitation: async (workspaceId: string, token: string): Promise<void> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/invitations/${token}`, {
      method: 'DELETE',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.message || error.error || 'Failed to revoke invitation');
    }
  },

  /**
   * Get current user's role in workspace
   */
  getMyRole: async (workspaceId: string): Promise<{ role: Role | null; isMember: boolean }> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/my-role`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.message || error.error || 'Failed to get role');
    }
    return res.json();
  },

  /**
   * Get workspaces current user belongs to
   */
  getMyWorkspaces: async (): Promise<Workspace[]> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/api/my-workspaces`, {
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.message || error.error || 'Failed to get workspaces');
    }
    return res.json();
  },
};
