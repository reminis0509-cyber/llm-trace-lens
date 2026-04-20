/**
 * Unit test for migration 013 + OAuth state helper behaviour.
 *
 * Runs migration 013 against a fresh in-memory sqlite DB, then exercises
 * the OAuth state creation / consumption helpers against that DB. This
 * verifies:
 *   1. `up()` creates all four tables with the expected columns.
 *   2. `down()` reverses `up()` cleanly.
 *   3. `createOAuthState()` persists a row with unique `state`.
 *   4. `consumeOAuthState()` is one-shot — the second consume returns null.
 *   5. `consumeOAuthState()` rejects rows older than the TTL.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import knex, { type Knex } from 'knex';
import { up as migrate013Up, down as migrate013Down } from '../../../migrations/013_ai_employee_workspace.js';

// The OAuth flow module pulls its DB handle from storage/knex-client.
// We hijack that lazily so the test's in-memory DB is used.
let testDb: Knex;

vi.mock('../../storage/knex-client.js', () => ({
  getKnex: () => testDb,
  closeKnex: async () => {
    if (testDb) await testDb.destroy();
  },
}));

// Import after mock is set up so the module binds to our getKnex.
const oauthFlow = await import('../../auth/oauth/oauth-flow.js');

describe('migration 013 + oauth_states helpers', () => {
  beforeAll(async () => {
    testDb = knex({
      client: 'better-sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true,
    });
    await migrate013Up(testDb);
  });

  afterAll(async () => {
    if (testDb) {
      await migrate013Down(testDb);
      await testDb.destroy();
    }
  });

  it('creates all four AI Employee tables via up()', async () => {
    for (const name of ['ai_employee_memory', 'task_timeline', 'connector_tokens', 'oauth_states']) {
      expect(await testDb.schema.hasTable(name)).toBe(true);
    }
  });

  it('ai_employee_memory has a (user_id, key) unique index', async () => {
    await testDb('ai_employee_memory').insert({
      id: 'm1', user_id: 'u@x', key: 'k1', value: '{"a":1}',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    await expect(
      testDb('ai_employee_memory').insert({
        id: 'm2', user_id: 'u@x', key: 'k1', value: '{"b":2}',
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }),
    ).rejects.toThrow();
  });

  it('connector_tokens has a (user_id, provider) unique index', async () => {
    await testDb('connector_tokens').insert({
      id: 'c1', user_id: 'u@x', provider: 'google',
      access_token: 'enc', refresh_token: null, expires_at: null,
      scopes: '[]', connected_at: new Date().toISOString(),
    });
    await expect(
      testDb('connector_tokens').insert({
        id: 'c2', user_id: 'u@x', provider: 'google',
        access_token: 'enc2', refresh_token: null, expires_at: null,
        scopes: '[]', connected_at: new Date().toISOString(),
      }),
    ).rejects.toThrow();
  });

  it('createOAuthState persists a row and returns a unique state string', async () => {
    const a = await oauthFlow.createOAuthState({
      userId: 'user-a@example.com', provider: 'google', redirectUri: 'http://localhost/cb',
    });
    const b = await oauthFlow.createOAuthState({
      userId: 'user-b@example.com', provider: 'google', redirectUri: 'http://localhost/cb',
    });
    expect(a).not.toBe(b);
    const rows = await testDb('oauth_states').select('*');
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  it('consumeOAuthState is one-shot and matches provider', async () => {
    const state = await oauthFlow.createOAuthState({
      userId: 'one-shot@example.com', provider: 'google', redirectUri: 'http://localhost/cb',
    });
    const row1 = await oauthFlow.consumeOAuthState(state, 'google');
    expect(row1).not.toBeNull();
    if (row1) expect(row1.user_id).toBe('one-shot@example.com');
    const row2 = await oauthFlow.consumeOAuthState(state, 'google');
    expect(row2).toBeNull();
  });

  it('consumeOAuthState rejects expired state rows', async () => {
    const state = await oauthFlow.createOAuthState({
      userId: 'stale@example.com', provider: 'google', redirectUri: 'http://localhost/cb',
    });
    // age the row beyond the TTL
    const past = new Date(Date.now() - (oauthFlow.OAUTH_STATE_TTL_MS + 60_000)).toISOString();
    await testDb('oauth_states').where({ state }).update({ created_at: past });
    const row = await oauthFlow.consumeOAuthState(state, 'google');
    expect(row).toBeNull();
    // still deleted even though it was expired — one-shot semantics hold
    const leftover = await testDb('oauth_states').where({ state }).first();
    expect(leftover).toBeUndefined();
  });

  it('down() drops all four tables', async () => {
    await migrate013Down(testDb);
    for (const name of ['ai_employee_memory', 'task_timeline', 'connector_tokens', 'oauth_states']) {
      expect(await testDb.schema.hasTable(name)).toBe(false);
    }
    // restore for afterAll idempotence
    await migrate013Up(testDb);
  });
});
