/**
 * FujiTrace Agent Cost Guard.
 *
 * Tracks per-run cumulative LLM cost (USD) for the Contract-Based AI Clerk
 * Runtime and enforces three caps to protect the Founder investment guardrail
 * (monthly API spend ¥50K notification threshold, see MEMORY.md / Section 7.8.4).
 *
 *   perRunCapUsd        — hard stop for a single run (prevents runaway plans).
 *   perWorkspaceDailyCapUsd — daily budget per tenant (prevents single-tenant burn).
 *   globalDailyCapUsd   — platform-wide daily budget (≈15% of ¥50K monthly cap
 *                         so alerts fire well before the guardrail is hit).
 *
 * Default budget rationale (at ¥150/USD):
 *   perRunCapUsd          = $0.10   ≈ ¥15   — ~200x the ~$0.0005 typical run cost;
 *                                             any run exceeding this is almost
 *                                             certainly looping or a prompt bug.
 *   perWorkspaceDailyCapUsd = $1.00 ≈ ¥150  — >30 typical runs/day per workspace;
 *                                             well above Free-plan 30 runs/month
 *                                             and typical Pro daily usage.
 *   globalDailyCapUsd     = $50.00  ≈ ¥7,500 — 15% of the ¥50K monthly alert;
 *                                              leaves head-room for 2 consecutive
 *                                              high-usage days before Founder ping.
 *
 * This module only **measures and restricts** — it never charges money.
 * Stripe billing integration is deferred to Phase A1.
 */
import crypto from 'crypto';
import { getKnex } from '../storage/knex-client.js';

export interface CostBudget {
  perRunCapUsd: number;
  perWorkspaceDailyCapUsd: number;
  globalDailyCapUsd: number;
}

export const DEFAULT_BUDGET: CostBudget = {
  perRunCapUsd: 0.10,
  perWorkspaceDailyCapUsd: 1.0,
  globalDailyCapUsd: 50.0,
};

/** Per-process override hook — tests may swap this via `setBudgetForTesting`. */
let activeBudget: CostBudget = { ...DEFAULT_BUDGET };

export function getActiveBudget(): CostBudget {
  return { ...activeBudget };
}

/** Test-only: override the active budget. Reset via `resetBudgetForTesting()`. */
export function setBudgetForTesting(next: Partial<CostBudget>): void {
  activeBudget = { ...activeBudget, ...next };
}

export function resetBudgetForTesting(): void {
  activeBudget = { ...DEFAULT_BUDGET };
}

export type BudgetScope = 'run' | 'workspace_daily' | 'global_daily';

export class CostBudgetExceededError extends Error {
  public readonly scope: BudgetScope;
  public readonly spentUsd: number;
  public readonly capUsd: number;

  constructor(scope: BudgetScope, spentUsd: number, capUsd: number) {
    super(
      `Cost budget exceeded (scope=${scope}): spent=$${spentUsd.toFixed(
        6,
      )} cap=$${capUsd.toFixed(6)}`,
    );
    this.name = 'CostBudgetExceededError';
    this.scope = scope;
    this.spentUsd = spentUsd;
    this.capUsd = capUsd;
  }
}

/**
 * Token-usage → USD conversion for the default agent model (gpt-4o-mini).
 * Pricing as of 2026-04 from OpenAI: $0.15 / 1M input, $0.60 / 1M output.
 * Additional models can be added as the agent model set expands.
 */
const MODEL_PRICING_USD_PER_1M: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o': { input: 2.50, output: 10.00 },
};

export function estimateUsdCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const price = MODEL_PRICING_USD_PER_1M[model] ?? MODEL_PRICING_USD_PER_1M['gpt-4o-mini'];
  const inCost = (promptTokens / 1_000_000) * price.input;
  const outCost = (completionTokens / 1_000_000) * price.output;
  return inCost + outCost;
}

/**
 * Return ISO start-of-today (UTC). Used for daily aggregation.
 */
function todayStartIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

/** Ensure the agent_run_costs table exists (safety net if migration not run). */
let tableReady = false;
async function ensureTable(): Promise<void> {
  if (tableReady) return;
  const db = getKnex();
  const exists = await db.schema.hasTable('agent_run_costs');
  if (!exists) {
    await db.schema.createTable('agent_run_costs', (table) => {
      table.string('id').primary();
      table.string('workspace_id').notNullable().index();
      table.string('run_id').notNullable().unique();
      table.decimal('usd_cost', 12, 6).notNullable().defaultTo(0);
      table.timestamp('created_at').notNullable().defaultTo(db.fn.now()).index();
    });
  }
  tableReady = true;
}

/**
 * Get today's aggregated spend for a workspace and globally.
 */
export async function getTodaySpend(
  workspaceId: string,
): Promise<{ workspace: number; global: number }> {
  await ensureTable();
  const db = getKnex();
  const since = todayStartIso();

  const wsRow = await db('agent_run_costs')
    .where({ workspace_id: workspaceId })
    .andWhere('created_at', '>=', since)
    .sum<{ sum: string | number | null }>({ sum: 'usd_cost' })
    .first();

  const globalRow = await db('agent_run_costs')
    .andWhere('created_at', '>=', since)
    .sum<{ sum: string | number | null }>({ sum: 'usd_cost' })
    .first();

  return {
    workspace: Number(wsRow?.sum ?? 0),
    global: Number(globalRow?.sum ?? 0),
  };
}

/**
 * Check whether accumulating `addedUsd` to a run (whose current spend is
 * `runUsd`) would exceed any cap. Throws `CostBudgetExceededError` if so.
 *
 * Reads global/workspace daily totals live from the DB.
 */
export async function checkBudget(
  workspaceId: string,
  runUsd: number,
  addedUsd: number,
): Promise<void> {
  const budget = activeBudget;
  const nextRun = runUsd + addedUsd;
  if (nextRun > budget.perRunCapUsd) {
    throw new CostBudgetExceededError('run', nextRun, budget.perRunCapUsd);
  }
  // Fast-path: nothing added → no DB round trip needed. This also protects
  // the contract-agent tests that mock callLlmViaProxy to return usage:null.
  if (addedUsd <= 0) return;
  const { workspace, global } = await getTodaySpend(workspaceId);
  if (workspace + addedUsd > budget.perWorkspaceDailyCapUsd) {
    throw new CostBudgetExceededError(
      'workspace_daily',
      workspace + addedUsd,
      budget.perWorkspaceDailyCapUsd,
    );
  }
  if (global + addedUsd > budget.globalDailyCapUsd) {
    throw new CostBudgetExceededError(
      'global_daily',
      global + addedUsd,
      budget.globalDailyCapUsd,
    );
  }
}

/**
 * Record a run's accumulated spend. Idempotent on `runId` — a second call
 * with the same runId is a no-op (we do not double-count).
 */
export async function recordSpend(
  workspaceId: string,
  runId: string,
  usd: number,
): Promise<void> {
  if (usd <= 0) return;
  await ensureTable();
  const db = getKnex();
  const existing = await db('agent_run_costs').where({ run_id: runId }).first();
  if (existing) {
    // Idempotent: do not re-insert. Keep first value to preserve wall-clock anchor.
    return;
  }
  await db('agent_run_costs').insert({
    id: crypto.randomUUID(),
    workspace_id: workspaceId,
    run_id: runId,
    usd_cost: usd,
    created_at: new Date().toISOString(),
  });
}

/**
 * Test-only: reset module-level readiness so ensureTable runs again.
 */
export function resetTableReadyForTesting(): void {
  tableReady = false;
}
