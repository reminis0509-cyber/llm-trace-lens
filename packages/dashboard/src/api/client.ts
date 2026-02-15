import type { TraceListResponse, Trace, StatsResponse } from '../types';

const API_BASE = '';

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
