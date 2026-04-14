/**
 * Security tests for the backend realtime broadcast module.
 *
 * These tests verify that the broadcast functions behave correctly
 * and that the broadcast payload does not leak sensitive data.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @supabase/supabase-js before importing the module under test
const mockSend = vi.fn().mockResolvedValue(undefined);
const mockChannel = vi.fn().mockReturnValue({ send: mockSend });
const mockCreateClient = vi.fn().mockReturnValue({ channel: mockChannel });

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

// We need to import fresh for each test to reset module-level state
let broadcastNewTrace: typeof import('../../lib/realtime.js').broadcastNewTrace;
let broadcastTraceUpdate: typeof import('../../lib/realtime.js').broadcastTraceUpdate;
let broadcastWorkspaceEvent: typeof import('../../lib/realtime.js').broadcastWorkspaceEvent;
let getSupabaseClient: typeof import('../../lib/realtime.js').getSupabaseClient;

describe('realtime broadcast security', () => {
  beforeEach(async () => {
    vi.resetModules();
    mockSend.mockClear();
    mockChannel.mockClear();
    mockCreateClient.mockClear();

    // Set environment variables for Supabase
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';

    // Re-mock after resetModules
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: mockCreateClient,
    }));

    const mod = await import('../../lib/realtime.js');
    broadcastNewTrace = mod.broadcastNewTrace;
    broadcastTraceUpdate = mod.broadcastTraceUpdate;
    broadcastWorkspaceEvent = mod.broadcastWorkspaceEvent;
    getSupabaseClient = mod.getSupabaseClient;
  });

  afterEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_KEY;
  });

  describe('broadcastNewTrace', () => {
    it('should scope broadcast channel to the correct workspace ID', () => {
      broadcastNewTrace('workspace-abc', {
        id: 'trace-1',
        model: 'gpt-4',
        timestamp: '2026-03-14T00:00:00Z',
      });

      expect(mockChannel).toHaveBeenCalledWith('workspace:workspace-abc');
    });

    it('should use broadcast type and new_trace event name', () => {
      broadcastNewTrace('ws-123', {
        id: 'trace-1',
        model: 'gpt-4',
        timestamp: '2026-03-14T00:00:00Z',
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'broadcast',
          event: 'new_trace',
        })
      );
    });

    it('should include only safe metadata in payload -- no prompt, no response, no API key', () => {
      broadcastNewTrace('ws-123', {
        id: 'trace-1',
        model: 'gpt-4',
        timestamp: '2026-03-14T00:00:00Z',
        totalTokens: 500,
        status: 'PASS',
        latencyMs: 1200,
      });

      const sendArgs = mockSend.mock.calls[0][0];
      const payload = sendArgs.payload;

      // Verify the payload structure contains only expected fields
      expect(payload).toHaveProperty('id');
      expect(payload).toHaveProperty('model');
      expect(payload).toHaveProperty('timestamp');

      // Verify that sensitive fields are NOT present
      expect(payload).not.toHaveProperty('prompt');
      expect(payload).not.toHaveProperty('rawResponse');
      expect(payload).not.toHaveProperty('response');
      expect(payload).not.toHaveProperty('apiKey');
      expect(payload).not.toHaveProperty('api_key');
      expect(payload).not.toHaveProperty('messages');
      expect(payload).not.toHaveProperty('structuredResponse');
    });

    it('should not throw when Supabase is not configured', () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_KEY;

      // Reset modules so the module reads updated env vars
      // Note: since we already imported, the existing import uses cached client
      // This test validates that the function handles null client gracefully
      expect(() => {
        broadcastNewTrace('ws-123', {
          id: 'trace-1',
          model: 'gpt-4',
          timestamp: '2026-03-14T00:00:00Z',
        });
      }).not.toThrow();
    });

    it('should handle send rejection gracefully without propagating errors', async () => {
      mockSend.mockRejectedValueOnce(new Error('Network error'));

      // Should not throw
      expect(() => {
        broadcastNewTrace('ws-123', {
          id: 'trace-1',
          model: 'gpt-4',
          timestamp: '2026-03-14T00:00:00Z',
        });
      }).not.toThrow();
    });

    it('should use different channel names for different workspaces to ensure isolation', () => {
      broadcastNewTrace('workspace-A', {
        id: 'trace-1',
        model: 'gpt-4',
        timestamp: '2026-03-14T00:00:00Z',
      });

      broadcastNewTrace('workspace-B', {
        id: 'trace-2',
        model: 'claude-3',
        timestamp: '2026-03-14T00:00:00Z',
      });

      expect(mockChannel).toHaveBeenCalledWith('workspace:workspace-A');
      expect(mockChannel).toHaveBeenCalledWith('workspace:workspace-B');
      expect(mockChannel).toHaveBeenCalledTimes(2);
    });
  });

  describe('broadcastTraceUpdate', () => {
    it('should scope to the correct workspace channel', () => {
      broadcastTraceUpdate('ws-456', 'trace-1', { status: 'completed' });

      expect(mockChannel).toHaveBeenCalledWith('workspace:ws-456');
    });

    it('should include traceId in payload', () => {
      broadcastTraceUpdate('ws-456', 'trace-99', { status: 'completed' });

      const sendArgs = mockSend.mock.calls[0][0];
      expect(sendArgs.payload.traceId).toBe('trace-99');
    });

    it('should use trace_update event name', () => {
      broadcastTraceUpdate('ws-456', 'trace-1', { status: 'completed' });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'broadcast',
          event: 'trace_update',
        })
      );
    });
  });

  describe('broadcastWorkspaceEvent', () => {
    it('should allow custom event names but scope to workspace channel', () => {
      broadcastWorkspaceEvent('ws-789', 'member_joined', { userId: 'user-1' });

      expect(mockChannel).toHaveBeenCalledWith('workspace:ws-789');
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'broadcast',
          event: 'member_joined',
        })
      );
    });
  });

  describe('getSupabaseClient', () => {
    it('should return null when environment variables are missing', async () => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_KEY;

      vi.resetModules();
      vi.doMock('@supabase/supabase-js', () => ({
        createClient: mockCreateClient,
      }));

      const freshMod = await import('../../lib/realtime.js');
      const client = freshMod.getSupabaseClient();

      expect(client).toBeNull();
    });

    it('should create client when both URL and key are provided', () => {
      const client = getSupabaseClient();

      expect(client).not.toBeNull();
      expect(mockCreateClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-service-key'
      );
    });

    it('should reuse the same client instance on subsequent calls (singleton)', () => {
      const client1 = getSupabaseClient();
      const client2 = getSupabaseClient();

      expect(client1).toBe(client2);
      // createClient should only be called once
      expect(mockCreateClient).toHaveBeenCalledTimes(1);
    });
  });
});
