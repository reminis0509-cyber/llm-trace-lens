/**
 * Unit tests for the signup-credit module.
 *
 * Covers the three core behaviours (grant / consume / expiry) per the
 * acceptance criteria. KV and DB are both mocked — these tests focus on the
 * module's own logic (expiry computation, consume-on-empty, idempotency).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @vercel/kv BEFORE importing the module under test.
const kvStore = new Map<string, unknown>();
const kvGet = vi.fn(async (key: string) => kvStore.get(key) ?? null);
const kvSet = vi.fn(async (key: string, value: unknown) => {
  kvStore.set(key, value);
});
const kvIncrby = vi.fn(async (key: string, by: number) => {
  const cur = Number(kvStore.get(key) ?? 0);
  const next = cur + by;
  kvStore.set(key, next);
  return next;
});
const kvDecrby = vi.fn(async (key: string, by: number) => {
  const cur = Number(kvStore.get(key) ?? 0);
  const next = cur - by;
  kvStore.set(key, next);
  return next;
});

vi.mock('@vercel/kv', () => ({
  kv: {
    get: kvGet,
    set: kvSet,
    incrby: kvIncrby,
    decrby: kvDecrby,
  },
}));

// Mock the Knex DB client with a chainable stub.
interface FakeRow {
  workspace_id: string;
  signup_credit_jpy: number;
  signup_credit_expires_at: string | null;
}
const dbRows = new Map<string, FakeRow>();

const dbTable = () => {
  let whereClause: Partial<FakeRow> = {};
  const chain = {
    where(cond: Partial<FakeRow>) {
      whereClause = { ...whereClause, ...cond };
      return chain;
    },
    andWhere() {
      return chain;
    },
    select() {
      return chain;
    },
    async first() {
      if (!whereClause.workspace_id) return undefined;
      return dbRows.get(whereClause.workspace_id);
    },
    async insert(row: FakeRow) {
      dbRows.set(row.workspace_id, { ...row });
      return [1];
    },
    async update(patch: Partial<FakeRow>) {
      if (!whereClause.workspace_id) return 0;
      const existing = dbRows.get(whereClause.workspace_id);
      if (!existing) return 0;
      dbRows.set(whereClause.workspace_id, { ...existing, ...patch });
      return 1;
    },
    async decrement(col: keyof FakeRow, by: number) {
      if (!whereClause.workspace_id) return 0;
      const existing = dbRows.get(whereClause.workspace_id);
      if (!existing) return 0;
      const cur = Number(existing[col] ?? 0);
      dbRows.set(whereClause.workspace_id, { ...existing, [col]: cur - by });
      return 1;
    },
  };
  return chain;
};

vi.mock('../../storage/knex-client.js', () => ({
  getKnex: () => () => dbTable(),
}));

// Make KV appear "available" so the code takes the hot path.
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  kvStore.clear();
  dbRows.clear();
  kvGet.mockClear();
  kvSet.mockClear();
  kvIncrby.mockClear();
  kvDecrby.mockClear();
  process.env = {
    ...ORIGINAL_ENV,
    KV_REST_API_URL: 'https://example.upstash.io',
    KV_REST_API_TOKEN: 'test-token',
  };
});

// Import AFTER mocks so the module picks them up.
const {
  grantSignupCredit,
  getSignupCreditStatus,
  consumeSignupCredit,
  SIGNUP_CREDIT_AMOUNT_JPY,
  SIGNUP_CREDIT_VALIDITY_DAYS,
} = await import('../../plans/signup-credit.js');

describe('signup-credit: grant logic', () => {
  it('grants ¥10,000 with a 90-day expiry on a fresh workspace', async () => {
    const ws = 'ws_grant_fresh';
    const before = Date.now();
    const granted = await grantSignupCredit(ws);
    const after = Date.now();

    expect(granted).toBe(true);

    const status = await getSignupCreditStatus(ws);
    expect(status.balanceJpy).toBe(SIGNUP_CREDIT_AMOUNT_JPY);
    expect(status.active).toBe(true);
    expect(status.expiresAt).not.toBeNull();

    // Expiry is 90 days out, within the time window of this test run.
    const expiresAtMs = Date.parse(status.expiresAt!);
    const expectedMin = before + SIGNUP_CREDIT_VALIDITY_DAYS * 24 * 60 * 60 * 1000;
    const expectedMax = after + SIGNUP_CREDIT_VALIDITY_DAYS * 24 * 60 * 60 * 1000;
    expect(expiresAtMs).toBeGreaterThanOrEqual(expectedMin);
    expect(expiresAtMs).toBeLessThanOrEqual(expectedMax);
  });

  it('does not re-grant credit on a workspace that already has one', async () => {
    const ws = 'ws_grant_twice';

    const first = await grantSignupCredit(ws);
    expect(first).toBe(true);

    // Simulate: user has already spent some credit.
    const afterSpend = await consumeSignupCredit(ws, 500);
    expect(afterSpend.consumed).toBe(true);

    const second = await grantSignupCredit(ws);
    expect(second).toBe(false);

    // Balance must still reflect the spent state — NOT be reset to 10,000.
    const status = await getSignupCreditStatus(ws);
    expect(status.balanceJpy).toBe(SIGNUP_CREDIT_AMOUNT_JPY - 500);
  });

  it('reports inactive credit for a workspace that never received a grant', async () => {
    const status = await getSignupCreditStatus('ws_never_granted');
    expect(status.balanceJpy).toBe(0);
    expect(status.expiresAt).toBeNull();
    expect(status.active).toBe(false);
  });
});

describe('signup-credit: consume logic', () => {
  it('decrements the balance atomically and reports consumed:true', async () => {
    const ws = 'ws_consume';
    await grantSignupCredit(ws);

    const result = await consumeSignupCredit(ws, 3);
    expect(result.consumed).toBe(true);
    expect(result.remainingJpy).toBe(SIGNUP_CREDIT_AMOUNT_JPY - 3);

    const status = await getSignupCreditStatus(ws);
    expect(status.balanceJpy).toBe(SIGNUP_CREDIT_AMOUNT_JPY - 3);
    expect(status.active).toBe(true);
  });

  it('refuses consumption when requested cost exceeds remaining balance', async () => {
    const ws = 'ws_consume_over';
    await grantSignupCredit(ws);

    const huge = SIGNUP_CREDIT_AMOUNT_JPY + 1;
    const result = await consumeSignupCredit(ws, huge);

    expect(result.consumed).toBe(false);

    // Balance must not have been modified (no partial consume, no negative).
    const status = await getSignupCreditStatus(ws);
    expect(status.balanceJpy).toBe(SIGNUP_CREDIT_AMOUNT_JPY);
  });

  it('refuses consumption on a workspace with no credit', async () => {
    const result = await consumeSignupCredit('ws_no_credit', 1);
    expect(result.consumed).toBe(false);
    expect(result.remainingJpy).toBe(0);
  });
});

describe('signup-credit: expiry logic', () => {
  it('treats an expired credit as zero balance and refuses consume', async () => {
    const ws = 'ws_expired';

    // Pre-populate KV with an expired grant (expires_at in the past).
    const expiredIso = new Date(Date.now() - 60_000).toISOString();
    kvStore.set(`workspace:${ws}:signup_credit:balance_jpy`, 5_000);
    kvStore.set(`workspace:${ws}:signup_credit:expires_at`, expiredIso);

    const status = await getSignupCreditStatus(ws);
    // Even though the raw balance in storage is 5000, expiry makes it zero.
    expect(status.balanceJpy).toBe(0);
    expect(status.active).toBe(false);
    // But the original expires_at is preserved for audit/history.
    expect(status.expiresAt).toBe(expiredIso);

    // Consume must fail.
    const result = await consumeSignupCredit(ws, 1);
    expect(result.consumed).toBe(false);
  });

  it('treats a credit expiring exactly now as expired (boundary case)', async () => {
    const ws = 'ws_boundary';
    const nowIso = new Date(Date.now()).toISOString();
    kvStore.set(`workspace:${ws}:signup_credit:balance_jpy`, 1_000);
    kvStore.set(`workspace:${ws}:signup_credit:expires_at`, nowIso);

    const status = await getSignupCreditStatus(ws);
    expect(status.active).toBe(false);
    expect(status.balanceJpy).toBe(0);
  });
});
