/**
 * Unit tests for `resolveLineWorkspace`.
 *
 * Covers the two critical paths:
 *   1. First contact — KV returns null → createWorkspace() is called →
 *      new workspace id is persisted and returned with `isNew: true`.
 *   2. Repeat visitor — KV already has a mapping → createWorkspace() is
 *      NOT called and `isNew: false` is returned.
 *
 * Side-effects on the `workspace_users` table are stubbed via a Knex mock.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// NOTE: vi.mock is hoisted to the top of the file, so any variable referenced
// inside the factory must be declared with `vi.hoisted()` (or be imported).

const { kvStore, kvGet, kvSet, createWorkspaceSpy, insertSpy } = vi.hoisted(
  () => {
    const kvStore = new Map<string, string>();
    return {
      kvStore,
      kvGet: vi.fn(async (key: string) => kvStore.get(key) ?? null),
      kvSet: vi.fn(async (key: string, value: string) => {
        kvStore.set(key, value);
        return 'OK';
      }),
      createWorkspaceSpy: vi.fn(async (name: string) => ({
        id: `ws-${name.replace(/\s+/g, '-')}-${Math.floor(Math.random() * 1e9)}`,
        name,
        created_at: new Date(),
      })),
      insertSpy: vi.fn(async () => [1]),
    };
  },
);

vi.mock('@vercel/kv', () => ({
  kv: {
    get: kvGet,
    set: kvSet,
  },
}));

vi.mock('../../kv/client.js', () => ({
  createWorkspace: createWorkspaceSpy,
}));

// Minimal chainable Knex stub — workspace_users table never finds an
// existing row so the insert branch is exercised.
vi.mock('../../storage/knex-client.js', () => {
  interface FakeQueryBuilder {
    where: (...args: unknown[]) => FakeQueryBuilder;
    first: () => Promise<null>;
    insert: (row: Record<string, unknown>) => Promise<number[]>;
  }
  function makeQb(): FakeQueryBuilder {
    const qb: FakeQueryBuilder = {
      where: () => qb,
      first: async () => null,
      insert: insertSpy,
    };
    return qb;
  }
  return {
    getKnex: () => (_table: string) => makeQb(),
  };
});

// ── Ensure KV env vars are set so `isKvAvailable()` returns true ───────────
beforeEach(() => {
  process.env.KV_REST_API_URL = 'https://fake-kv.example.com';
  process.env.KV_REST_API_TOKEN = 'fake-token';
  kvStore.clear();
  kvGet.mockClear();
  kvSet.mockClear();
  createWorkspaceSpy.mockClear();
  insertSpy.mockClear();
});

// ── Import SUT after mocks are set up ──────────────────────────────────────
import { resolveLineWorkspace, buildLinePseudoEmail } from '../workspace-resolver.js';

describe('resolveLineWorkspace — first contact', () => {
  it('creates a new workspace and persists the mapping', async () => {
    const lineUserId = 'U11111111111111111111111111111111';
    const result = await resolveLineWorkspace(lineUserId);

    expect(result).not.toBeNull();
    expect(result?.isNew).toBe(true);
    expect(result?.workspaceId).toMatch(/^ws-/);
    expect(createWorkspaceSpy).toHaveBeenCalledTimes(1);
    // KV set should have stored the mapping
    expect(kvSet).toHaveBeenCalledWith(
      `user:line:${lineUserId}:workspace`,
      result?.workspaceId,
    );
  });
});

describe('resolveLineWorkspace — repeat visitor', () => {
  it('returns the existing workspace without calling createWorkspace', async () => {
    const lineUserId = 'U22222222222222222222222222222222';
    kvStore.set(`user:line:${lineUserId}:workspace`, 'ws-existing-123');

    const result = await resolveLineWorkspace(lineUserId);

    expect(result).toEqual({ workspaceId: 'ws-existing-123', isNew: false });
    expect(createWorkspaceSpy).not.toHaveBeenCalled();
    // No KV set should happen on the repeat path
    expect(kvSet).not.toHaveBeenCalled();
  });
});

describe('buildLinePseudoEmail', () => {
  it('maps the LINE user id into a deterministic internal email', () => {
    expect(buildLinePseudoEmail('U123')).toBe('line_U123@fujitrace.internal');
  });
});
