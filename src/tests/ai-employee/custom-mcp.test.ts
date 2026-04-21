/**
 * Custom MCP connector unit test (block 7 of v2).
 *
 * Verifies row lookup + auth header decryption behaviour without hitting
 * any real external server. For the "server exists" case, we point the MCP
 * row at a local fetch-mock handled via a monkey-patched `global.fetch`.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify, { type FastifyRequest } from 'fastify';
import knex, { type Knex } from 'knex';
import { randomBytes } from 'crypto';
import { up as migrate013Up } from '../../../migrations/013_ai_employee_workspace.js';
import { up as migrate017Up } from '../../../migrations/017_custom_mcp.js';

let testDb: Knex;

vi.mock('../../storage/knex-client.js', () => ({
  getKnex: () => testDb,
  closeKnex: async () => {
    if (testDb) await testDb.destroy();
  },
}));

const { customMcpConnector } = await import('../../connectors/custom-mcp.js');
const { encryptToken } = await import('../../lib/token-crypto.js');
const { default: customMcpRoutes } = await import('../../routes/custom-mcp.js');

// Shared lifecycle — both the connector describe and the route SSRF describe
// rely on the same in-memory SQLite instance. Keeping this at file scope
// avoids the afterAll-too-early pitfall where the second describe would run
// against a destroyed DB.
beforeAll(async () => {
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  testDb = knex({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
  });
  await migrate013Up(testDb);
  await migrate017Up(testDb);
});

afterAll(async () => {
  if (testDb) await testDb.destroy();
});

describe('custom-mcp connector', () => {
  it('returns not_connected when the user has no registered servers', async () => {
    const r = await customMcpConnector.execute('no-row@example.com', 'invoke', {
      serverId: 'missing',
      tool: 'x',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('not_connected');
  });

  it('rejects invalid params', async () => {
    const r = await customMcpConnector.execute('u@example.com', 'invoke', {
      // missing serverId + tool
      params: {},
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('invalid_params');
  });

  it('returns not_connected when the row is disabled', async () => {
    await testDb('custom_mcp_servers').insert({
      id: 'disabled-srv',
      user_id: 'u@example.com',
      workspace_id: null,
      name: 'My MCP',
      url: 'https://example.test/mcp',
      auth_header_encrypted: null,
      enabled: 0,
      created_at: new Date().toISOString(),
    });
    const r = await customMcpConnector.execute('u@example.com', 'invoke', {
      serverId: 'disabled-srv',
      tool: 'greet',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('not_connected');
  });

  it('forwards the call, decrypts auth header, and returns the JSON body', async () => {
    await testDb('custom_mcp_servers').insert({
      id: 'live-srv',
      user_id: 'u@example.com',
      workspace_id: null,
      name: 'My MCP',
      url: 'https://example.test/mcp',
      auth_header_encrypted: encryptToken('Bearer secret-token'),
      enabled: 1,
      created_at: new Date().toISOString(),
    });

    const seenHeaders: Record<string, string> = {};
    const origFetch = global.fetch;
    // Cast through unknown — the signatures are close enough for this mock.
    global.fetch = (async (input: unknown, init: unknown) => {
      const opts = init as { headers?: Record<string, string> } | undefined;
      Object.assign(seenHeaders, opts?.headers ?? {});
      return {
        status: 200,
        async json() {
          return { greeting: 'hi' };
        },
      } as unknown as Response;
    }) as unknown as typeof fetch;

    try {
      const r = await customMcpConnector.execute('u@example.com', 'invoke', {
        serverId: 'live-srv',
        tool: 'greet',
        params: { name: 'フジ' },
      });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.data).toEqual({ mcpResult: { greeting: 'hi' } });
      expect(seenHeaders['Authorization']).toBe('Bearer secret-token');
    } finally {
      global.fetch = origFetch;
    }
  });

  it('connector refuses to fetch a row whose URL became private (S-05 defense-in-depth)', async () => {
    // Simulate a row that slipped past route validation (pre-fix data /
    // direct DB mutation). Execute-time guard must still reject.
    await testDb('custom_mcp_servers').insert({
      id: 'ssrf-srv',
      user_id: 'u@example.com',
      workspace_id: null,
      name: 'Attacker MCP',
      url: 'http://127.0.0.1:8080/admin',
      auth_header_encrypted: null,
      enabled: 1,
      created_at: new Date().toISOString(),
    });

    let fetchCalls = 0;
    const origFetch = global.fetch;
    global.fetch = (async () => {
      fetchCalls++;
      return { status: 200, async json() { return {}; } } as unknown as Response;
    }) as unknown as typeof fetch;

    try {
      const r = await customMcpConnector.execute('u@example.com', 'invoke', {
        serverId: 'ssrf-srv',
        tool: 'x',
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('invalid_params');
      expect(fetchCalls).toBe(0);
    } finally {
      global.fetch = origFetch;
    }
  });
});

describe('custom-mcp route: SSRF validation', () => {
  async function buildApp(): Promise<ReturnType<typeof Fastify>> {
    const app = Fastify({ logger: false });
    // Minimal auth stub — attach a static user so the route's own auth
    // check passes. This is identical to the pattern used in
    // auth-bypass.test.ts and estimate-check-auth.test.ts.
    app.addHook('preHandler', async (request: FastifyRequest) => {
      (request as unknown as { user: { email: string } }).user = {
        email: 'u@example.com',
      };
    });
    await app.register(customMcpRoutes);
    return app;
  }

  it('POST /api/custom-mcp rejects http://127.0.0.1:8080 with 400 (S-05)', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/custom-mcp',
        payload: { name: 'local-admin', url: 'http://127.0.0.1:8080' },
      });
      expect(res.statusCode).toBe(400);
      const body = res.json() as { success: boolean; error?: string };
      expect(body.success).toBe(false);
      expect(body.error ?? '').toMatch(/プライベート|非 http|http/);
    } finally {
      await app.close();
    }
  });

  it('POST /api/custom-mcp rejects AWS metadata URL with 400', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/custom-mcp',
        payload: {
          name: 'aws-meta',
          url: 'http://169.254.169.254/latest/meta-data/',
        },
      });
      expect(res.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it('POST /api/custom-mcp rejects file:// scheme with 400', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/custom-mcp',
        payload: { name: 'local-file', url: 'file:///etc/passwd' },
      });
      expect(res.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it('POST /api/custom-mcp accepts a valid public https URL with 201', async () => {
    const app = await buildApp();
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/custom-mcp',
        payload: { name: 'ok-server', url: 'https://mcp.example.com/rpc' },
      });
      expect(res.statusCode).toBe(201);
    } finally {
      await app.close();
    }
  });
});
