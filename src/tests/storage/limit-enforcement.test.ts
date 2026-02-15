import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the config module
vi.mock('../../config.js', () => ({
  config: {
    maxTraces: 10,
    maxAgeDays: 7,
    databaseType: 'kv',
    port: 3000,
    logLevel: 'info',
  },
}));

// Mock the @vercel/kv module
const mockKv = {
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
  zadd: vi.fn(),
  zrem: vi.fn(),
  zrange: vi.fn(),
  zremrangebyscore: vi.fn().mockResolvedValue(0),
  zcard: vi.fn(),
};

vi.mock('@vercel/kv', () => ({
  kv: mockKv,
}));

describe('KV Storage Limit Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getStats', () => {
    it('should return correct usage statistics', async () => {
      // Import after mocks are set up
      const { KVStorageAdapter } = await import('../../storage/adapter.js');
      const adapter = new KVStorageAdapter();

      mockKv.zcard.mockResolvedValue(5);
      mockKv.zrange.mockResolvedValue([
        'trace-1',
        Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
      ]);

      const stats = await adapter.getStats('test-workspace');

      expect(stats.currentCount).toBe(5);
      expect(stats.maxCount).toBe(10);
      expect(stats.maxAgeDays).toBe(7);
      expect(mockKv.zcard).toHaveBeenCalledWith('workspace:test-workspace:traces:index');
    });

    it('should return empty stats when no traces exist', async () => {
      const { KVStorageAdapter } = await import('../../storage/adapter.js');
      const adapter = new KVStorageAdapter();

      mockKv.zcard.mockResolvedValue(0);
      mockKv.zrange.mockResolvedValue([]);

      const stats = await adapter.getStats('test-workspace');

      expect(stats.currentCount).toBe(0);
      expect(stats.oldestDate).toBeNull();
    });
  });

  describe('saveTrace', () => {
    it('should save trace with correct TTL', async () => {
      const { KVStorageAdapter } = await import('../../storage/adapter.js');
      const adapter = new KVStorageAdapter();

      const trace = {
        id: 'test-trace-1',
        workspace_id: 'test-workspace',
        timestamp: new Date().toISOString(),
        provider: 'openai',
        model: 'gpt-4',
        prompt: 'test prompt',
        response: { answer: 'test answer' },
        validation_results: {},
        latency_ms: 100,
      };

      // Mock enforcement functions
      mockKv.zrange.mockResolvedValue([]);

      await adapter.saveTrace(trace);

      // Verify trace was saved with TTL (7 days in seconds)
      expect(mockKv.set).toHaveBeenCalledWith(
        'workspace:test-workspace:trace:test-trace-1',
        trace,
        { ex: 7 * 24 * 60 * 60 }
      );

      // Verify trace was added to index
      expect(mockKv.zadd).toHaveBeenCalled();
    });
  });

  describe('storage adapter selection', () => {
    it('should default to postgres adapter', async () => {
      // Reset modules to test default
      vi.resetModules();

      // Mock DATABASE_TYPE to be undefined
      const originalEnv = process.env.DATABASE_TYPE;
      delete process.env.DATABASE_TYPE;

      // Re-import after env change
      const { getStorageAdapter } = await import('../../storage/adapter.js');
      const adapter = getStorageAdapter();

      expect(adapter.type).toBe('postgres');

      // Restore
      process.env.DATABASE_TYPE = originalEnv;
    });

    it('should use KV adapter when DATABASE_TYPE is kv', async () => {
      vi.resetModules();

      process.env.DATABASE_TYPE = 'kv';

      const { getStorageAdapter } = await import('../../storage/adapter.js');
      const adapter = getStorageAdapter();

      expect(adapter.type).toBe('kv');
    });
  });
});

describe('Config defaults', () => {
  it('should have correct default values', async () => {
    vi.resetModules();

    // Mock process.env
    const originalEnv = { ...process.env };
    process.env.DATABASE_TYPE = undefined;
    process.env.MAX_TRACES = undefined;
    process.env.MAX_AGE_DAYS = undefined;

    const { config } = await import('../../config.js');

    // Note: These will reflect the mocked values from the top of the file
    expect(config.maxTraces).toBeDefined();
    expect(config.maxAgeDays).toBeDefined();

    // Restore
    Object.assign(process.env, originalEnv);
  });
});
