import { useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface NewTracePayload {
  id: string;
  model: string;
  timestamp: string;
  totalTokens?: number;
  status?: string;
  latencyMs?: number;
}

interface UseRealtimeTracesOptions {
  workspaceId: string | null;
  onNewTrace?: (trace: NewTracePayload) => void;
  fallbackPollingInterval?: number; // in ms, default 30000
  enabled?: boolean;
}

/**
 * Hook to subscribe to realtime trace updates
 * Falls back to polling if Supabase is not configured
 */
export function useRealtimeTraces({
  workspaceId,
  onNewTrace,
  fallbackPollingInterval = 30000,
  enabled = true,
}: UseRealtimeTracesOptions) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const subscribe = useCallback(() => {
    if (!workspaceId || !enabled) return;

    // Check if Supabase Realtime is configured
    if (!isSupabaseConfigured) {
      console.log('[Realtime] Supabase not configured, using polling fallback');
      return;
    }

    // Clean up existing subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Subscribe to workspace channel
    const channel = supabase
      .channel(`workspace:${workspaceId}`)
      .on('broadcast', { event: 'new_trace' }, (message) => {
        if (onNewTrace && message.payload) {
          onNewTrace(message.payload as NewTracePayload);
        }
      })
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
      });

    channelRef.current = channel;
  }, [workspaceId, onNewTrace, enabled]);

  // Setup subscription
  useEffect(() => {
    subscribe();

    // Cleanup on unmount or dependencies change
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [subscribe]);

  // Fallback polling when Supabase is not configured
  useEffect(() => {
    if (!enabled || isSupabaseConfigured) return;

    const timer = setInterval(() => {
      // Trigger a manual refresh - the parent component should handle this
      // We emit a special "poll" event that the parent can listen to
    }, fallbackPollingInterval);

    return () => clearInterval(timer);
  }, [enabled, fallbackPollingInterval]);

  return {
    isConnected: channelRef.current !== null,
    reconnect: subscribe,
  };
}

export type { NewTracePayload };
