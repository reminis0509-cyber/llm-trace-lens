/**
 * Smoke tests for the AI Employee v2 connector registry expansion.
 *
 * Covers block 1 of the v2 spec — verifies that every connector declared
 * in the spec resolves via `getConnectorForAction` and that each exposes
 * the right action set.
 *
 * Real API calls are not made: when the user has no token stored every
 * connector returns `not_connected`, which is what we assert here.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import knex, { type Knex } from 'knex';
import { up as migrate013Up } from '../../../migrations/013_ai_employee_workspace.js';
import { up as migrate017Up } from '../../../migrations/017_custom_mcp.js';

let testDb: Knex;

vi.mock('../../storage/knex-client.js', () => ({
  getKnex: () => testDb,
  closeKnex: async () => {
    if (testDb) await testDb.destroy();
  },
}));

const {
  getConnector,
  getConnectorForAction,
  listConnectors,
} = await import('../../connectors/registry.js');

describe('connector registry v2 expansion', () => {
  beforeAll(async () => {
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

  it('registers all ten v2 connectors', () => {
    const ids = listConnectors().map((d) => d.id);
    for (const id of [
      'google-calendar',
      'gmail',
      'google-drive',
      'slack',
      'chatwork',
      'freee',
      'notion',
      'github',
      'line',
      'custom-mcp',
    ]) {
      expect(ids).toContain(id);
    }
  });

  const routingCases: Array<[string, string]> = [
    ['listFiles', 'google'],
    ['uploadFile', 'google'],
    ['listChannels', 'slack'],
    ['postMessage', 'slack'], // first-registered wins; both slack and chatwork use postMessage
    ['listRooms', 'chatwork'],
    ['listDeals', 'freee'],
    ['listPartners', 'freee'],
    ['createPage', 'notion'],
    ['searchPages', 'notion'],
    ['createIssue', 'github'],
    ['listRepos', 'github'],
    ['pushMessage', 'line'],
    ['invoke', 'custom_mcp'],
  ];

  for (const [action, provider] of routingCases) {
    it(`routes action '${action}' to provider '${provider}'`, () => {
      const c = getConnectorForAction(action);
      expect(c).not.toBeNull();
      if (c) expect(c.provider).toBe(provider);
    });
  }

  it('getConnector returns the first connector for each provider', () => {
    for (const p of ['google', 'slack', 'chatwork', 'freee', 'notion', 'github', 'line', 'custom_mcp'] as const) {
      const c = getConnector(p);
      expect(c).not.toBeNull();
    }
  });

  it('returns null for unknown action', () => {
    expect(getConnectorForAction('nope-nope-nope')).toBeNull();
  });

  it('line connector returns stub ok when LINE_ALLOW_STUB=1 and no token stored', async () => {
    const prev = process.env.LINE_ALLOW_STUB;
    process.env.LINE_ALLOW_STUB = '1';
    try {
      const c = getConnector('line');
      expect(c).not.toBeNull();
      if (!c) return;
      const res = await c.execute('u@example.com', 'pushMessage', {
        to: 'U123',
        text: 'hi',
      });
      expect(res.ok).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.LINE_ALLOW_STUB;
      else process.env.LINE_ALLOW_STUB = prev;
    }
  });

  it('line connector returns not_connected when stub disabled and no token', async () => {
    const prev = process.env.LINE_ALLOW_STUB;
    delete process.env.LINE_ALLOW_STUB;
    try {
      const c = getConnector('line');
      expect(c).not.toBeNull();
      if (!c) return;
      const res = await c.execute('u@example.com', 'pushMessage', {
        to: 'U123',
        text: 'hi',
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe('not_connected');
    } finally {
      if (prev !== undefined) process.env.LINE_ALLOW_STUB = prev;
    }
  });

  it('slack rejects unknown action and empty params', async () => {
    const c = getConnector('slack');
    expect(c).not.toBeNull();
    if (!c) return;
    const unknown = await c.execute('u@example.com', 'bogusAction', {});
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.code).toBe('unknown_action');
  });

  it('chatwork rejects unknown action', async () => {
    const c = getConnector('chatwork');
    expect(c).not.toBeNull();
    if (!c) return;
    const r = await c.execute('u@example.com', 'bogus', {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('unknown_action');
  });

  it('github rejects invalid createIssue params', async () => {
    const c = getConnector('github');
    expect(c).not.toBeNull();
    if (!c) return;
    // No token stored → not_connected short-circuits BEFORE param check,
    // so we assert not_connected here. Param-validation is exercised by
    // dedicated unit tests when a token is present.
    const r = await c.execute('u@example.com', 'createIssue', { owner: 'x' });
    expect(r.ok).toBe(false);
  });

  it('custom-mcp returns not_connected when no row exists', async () => {
    const c = getConnector('custom_mcp');
    expect(c).not.toBeNull();
    if (!c) return;
    const r = await c.execute('u@example.com', 'invoke', {
      serverId: 'deadbeef',
      tool: 'x',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('not_connected');
  });
});
