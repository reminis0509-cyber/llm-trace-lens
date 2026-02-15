/**
 * Supabase Realtime integration for broadcasting events
 * Used to notify clients of new traces in real-time
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;
let isConfigured = false;

/**
 * Get or create Supabase client for realtime
 */
export function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    return null;
  }

  if (!supabase) {
    supabase = createClient(url, key);
    isConfigured = true;
  }

  return supabase;
}

/**
 * Check if Supabase Realtime is configured
 */
export function isRealtimeConfigured(): boolean {
  return isConfigured || !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}

/**
 * Broadcast a new trace event to workspace subscribers
 * Non-blocking - fires and forgets to avoid slowing down trace processing
 */
export function broadcastNewTrace(
  workspaceId: string,
  traceData: {
    id: string;
    model: string;
    timestamp: string;
    totalTokens?: number;
    status?: string;
    latencyMs?: number;
  }
): void {
  const client = getSupabaseClient();
  if (!client) {
    return; // Silently skip if not configured
  }

  // Fire and forget - don't block on this
  client
    .channel(`workspace:${workspaceId}`)
    .send({
      type: 'broadcast',
      event: 'new_trace',
      payload: traceData,
    })
    .catch((error: unknown) => {
      console.warn('[Realtime] Failed to broadcast trace event:', error);
    });
}

/**
 * Broadcast a trace update event (e.g., validation complete)
 */
export function broadcastTraceUpdate(
  workspaceId: string,
  traceId: string,
  update: Record<string, unknown>
): void {
  const client = getSupabaseClient();
  if (!client) {
    return;
  }

  client
    .channel(`workspace:${workspaceId}`)
    .send({
      type: 'broadcast',
      event: 'trace_update',
      payload: {
        traceId,
        ...update,
      },
    })
    .catch((error: unknown) => {
      console.warn('[Realtime] Failed to broadcast trace update:', error);
    });
}

/**
 * Broadcast a workspace event (member joined, settings changed, etc.)
 */
export function broadcastWorkspaceEvent(
  workspaceId: string,
  event: string,
  data: Record<string, unknown>
): void {
  const client = getSupabaseClient();
  if (!client) {
    return;
  }

  client
    .channel(`workspace:${workspaceId}`)
    .send({
      type: 'broadcast',
      event,
      payload: data,
    })
    .catch((error: unknown) => {
      console.warn(`[Realtime] Failed to broadcast ${event} event:`, error);
    });
}
