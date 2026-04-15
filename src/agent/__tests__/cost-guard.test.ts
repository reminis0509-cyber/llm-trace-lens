/**
 * Unit tests for `src/agent/cost-guard.ts`.
 *
 * Verifies:
 *   1. perRunCap — exceeding per-run cap throws CostBudgetExceededError
 *   2. perWorkspaceDailyCap — accumulated workspace spend blocks further runs
 *   3. globalDailyCap — platform-wide cap blocks any workspace
 *   4. Idempotency — recordSpend is a no-op on duplicate runId
 *   5. Daily isolation — spend from a previous day is not counted today
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── In-memory knex mock ───────────────────────────────────────────────────
// We reuse the same vi.hoisted pattern as clerk.test.ts so the mock is
// installed before the module under test is loaded.

interface FakeRow {
  id: string;
  workspace_id: string;
  run_id: string;
  usd_cost: number;
  created_at: string;
}

const { store, mockKnex } = vi.hoisted(() => {
  const rows: FakeRow[] = [];

  const tableExistsMap: Record<string, boolean> = {
    agent_run_costs: true,
  };

  interface Query {
    table: string;
    wheres: Array<(r: FakeRow) => boolean>;
  }

  function makeQuery(table: string): Query {
    return { table, wheres: [] };
  }

  function runQuery(q: Query): FakeRow[] {
    return rows.filter(
      (r) => r.workspace_id !== undefined && q.wheres.every((fn) => fn(r)),
    );
  }

  const knexFn = ((table: string) => {
    const q = makeQuery(table);
    const chain: Record<string, unknown> = {};
    chain.where = (cond: Record<string, unknown>) => {
      q.wheres.push((r) => {
        for (const [k, v] of Object.entries(cond)) {
          if ((r as unknown as Record<string, unknown>)[k] !== v) return false;
        }
        return true;
      });
      return chain;
    };
    chain.andWhere = (column: string, op: string, value: string) => {
      q.wheres.push((r) => {
        const rv = (r as unknown as Record<string, unknown>)[column];
        if (op === '>=') return String(rv) >= String(value);
        return true;
      });
      return chain;
    };
    chain.first = async () => runQuery(q)[0];
    chain.sum = (_spec: Record<string, string>) => {
      const results = runQuery(q);
      const total = results.reduce((a, r) => a + Number(r.usd_cost), 0);
      return { first: async () => ({ sum: total }) };
    };
    chain.insert = async (row: FakeRow) => {
      rows.push({ ...row });
      return [rows.length];
    };
    return chain;
  }) as unknown as Record<string, unknown>;

  knexFn['schema'] = {
    hasTable: vi.fn(async (name: string) => tableExistsMap[name] ?? false),
    createTable: vi.fn(async () => undefined),
  };
  knexFn['fn'] = {
    now: () => new Date().toISOString(),
  };

  return {
    store: { rows, tableExistsMap },
    mockKnex: knexFn,
  };
});

vi.mock('../../storage/knex-client.js', () => ({
  getKnex: () => mockKnex,
}));

// ── Tests ─────────────────────────────────────────────────────────────────

describe('cost-guard', () => {
  beforeEach(async () => {
    store.rows.length = 0;
    const mod = await import('../cost-guard.js');
    mod.resetBudgetForTesting();
    mod.resetTableReadyForTesting();
  });

  it('throws CostBudgetExceededError when perRunCap is exceeded', async () => {
    const { checkBudget, setBudgetForTesting, CostBudgetExceededError } =
      await import('../cost-guard.js');
    setBudgetForTesting({ perRunCapUsd: 0.01 });
    await expect(checkBudget('ws-1', 0.009, 0.005)).rejects.toBeInstanceOf(
      CostBudgetExceededError,
    );
    try {
      await checkBudget('ws-1', 0.009, 0.005);
    } catch (e) {
      const err = e as InstanceType<typeof CostBudgetExceededError>;
      expect(err.scope).toBe('run');
    }
  });

  it('throws CostBudgetExceededError when perWorkspaceDailyCap is exceeded', async () => {
    const { checkBudget, recordSpend, setBudgetForTesting, CostBudgetExceededError } =
      await import('../cost-guard.js');
    setBudgetForTesting({
      perRunCapUsd: 100,
      perWorkspaceDailyCapUsd: 0.5,
      globalDailyCapUsd: 1000,
    });
    await recordSpend('ws-1', 'run-a', 0.4);
    await expect(checkBudget('ws-1', 0, 0.2)).rejects.toBeInstanceOf(
      CostBudgetExceededError,
    );
    try {
      await checkBudget('ws-1', 0, 0.2);
    } catch (e) {
      const err = e as InstanceType<typeof CostBudgetExceededError>;
      expect(err.scope).toBe('workspace_daily');
    }
  });

  it('throws CostBudgetExceededError when globalDailyCap is exceeded', async () => {
    const { checkBudget, recordSpend, setBudgetForTesting, CostBudgetExceededError } =
      await import('../cost-guard.js');
    setBudgetForTesting({
      perRunCapUsd: 100,
      perWorkspaceDailyCapUsd: 100,
      globalDailyCapUsd: 1.0,
    });
    // Spend from another workspace contributes to the global bucket.
    await recordSpend('ws-other', 'run-x', 0.9);
    await expect(checkBudget('ws-1', 0, 0.2)).rejects.toBeInstanceOf(
      CostBudgetExceededError,
    );
    try {
      await checkBudget('ws-1', 0, 0.2);
    } catch (e) {
      const err = e as InstanceType<typeof CostBudgetExceededError>;
      expect(err.scope).toBe('global_daily');
    }
  });

  it('recordSpend is idempotent on runId', async () => {
    const { recordSpend, getTodaySpend } = await import('../cost-guard.js');
    await recordSpend('ws-1', 'run-idem', 0.05);
    await recordSpend('ws-1', 'run-idem', 0.05);
    await recordSpend('ws-1', 'run-idem', 0.05);
    const { workspace } = await getTodaySpend('ws-1');
    // Second + third calls must be no-ops, so total is still 0.05.
    expect(workspace).toBeCloseTo(0.05, 6);
    expect(store.rows.filter((r) => r.run_id === 'run-idem')).toHaveLength(1);
  });

  it('spend from a previous day is not included in today totals', async () => {
    const { recordSpend, getTodaySpend } = await import('../cost-guard.js');
    // Inject a row whose created_at is yesterday.
    const yesterday = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    store.rows.push({
      id: 'old',
      workspace_id: 'ws-1',
      run_id: 'old-run',
      usd_cost: 99.0,
      created_at: yesterday,
    });
    // Add today's row.
    await recordSpend('ws-1', 'run-today', 0.01);
    const { workspace, global } = await getTodaySpend('ws-1');
    // Only today's row should count.
    expect(workspace).toBeCloseTo(0.01, 6);
    expect(global).toBeCloseTo(0.01, 6);
  });

  it('estimateUsdCost applies the gpt-4o-mini pricing correctly', async () => {
    const { estimateUsdCost } = await import('../cost-guard.js');
    // 1,000,000 input + 1,000,000 output tokens on gpt-4o-mini:
    //   input: 1 * 0.15 = 0.15
    //   output: 1 * 0.60 = 0.60
    //   total: 0.75
    expect(estimateUsdCost('gpt-4o-mini', 1_000_000, 1_000_000)).toBeCloseTo(0.75, 6);
    // Zero usage = zero cost.
    expect(estimateUsdCost('gpt-4o-mini', 0, 0)).toBe(0);
  });
});
