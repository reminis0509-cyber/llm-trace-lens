/**
 * End-to-end smoke test for /api/workspace/briefing.
 *
 * Verifies Round 2 (2026-04-20) reshaped contract:
 *   空ユーザーで叩くと
 *   { calendarConnected: false, todayEvents: [], completedYesterday: [], pending: [] }
 *   が返る。
 *
 * The test mounts only the workspace routes into a fresh Fastify
 * instance, stubs `request.user.email` via a preHandler, and hits the
 * endpoint. The DB is an in-memory sqlite populated by migration 013.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';
import knex, { type Knex } from 'knex';
import { up as migrate013Up } from '../../../migrations/013_ai_employee_workspace.js';

let testDb: Knex;

vi.mock('../../storage/knex-client.js', () => ({
  getKnex: () => testDb,
  closeKnex: async () => {
    if (testDb) await testDb.destroy();
  },
}));

const workspaceRoutesMod = await import('../../routes/workspace.js');
const workspaceRoutes = workspaceRoutesMod.default;

describe('briefing endpoint smoke', () => {
  beforeAll(async () => {
    testDb = knex({
      client: 'better-sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true,
    });
    await migrate013Up(testDb);
  });

  afterAll(async () => {
    if (testDb) await testDb.destroy();
  });

  it('returns empty arrays for a fresh user with no data and no Google', async () => {
    const fastify = Fastify({ logger: false });
    // Stub an authenticated user (would normally be set by the RBAC plugin).
    fastify.addHook('preHandler', async (req) => {
      (req as unknown as { user: { email: string; id: string } }).user = {
        email: 'new-user@example.com',
        id: 'new-user@example.com',
      };
    });
    await workspaceRoutes(fastify);

    const res = await fastify.inject({
      method: 'GET',
      url: '/api/workspace/briefing',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      success: boolean;
      data?: {
        calendarConnected: boolean;
        todayEvents: unknown[];
        completedYesterday: unknown[];
        pending: unknown[];
      };
    };
    expect(body.success).toBe(true);
    expect(body.data?.calendarConnected).toBe(false);
    expect(body.data?.todayEvents).toEqual([]);
    expect(body.data?.completedYesterday).toEqual([]);
    expect(body.data?.pending).toEqual([]);
    await fastify.close();
  });

  it('returns 401 when the user is not authenticated', async () => {
    const fastify = Fastify({ logger: false });
    await workspaceRoutes(fastify);
    const res = await fastify.inject({
      method: 'GET',
      url: '/api/workspace/briefing',
    });
    expect(res.statusCode).toBe(401);
    await fastify.close();
  });
});
