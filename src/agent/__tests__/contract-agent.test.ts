/**
 * Unit tests for the Contract-Based AI Clerk Runtime.
 *
 * These tests cover the core safety rails of `executeContractAgent`:
 *   1. Happy path — single estimate.create step → review ok → final
 *   2. Forbidden tool in the Plan → CONTRACT_VIOLATION error
 *   3. Plan with more than MAX_ITER steps → extra steps marked skipped/failed
 *   4. Planner LLM returns invalid JSON → fallback plan kicks in
 *   5. Tool returns arithmetically inconsistent data → review failed
 *
 * Both the LLM call helper (`callLlmViaProxy`) and the HTTP tool dispatcher
 * (`executeToolViaInject`) are mocked via `vi.mock`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Module mocks ──────────────────────────────────────────────────────────

const mockLlmResponses: string[] = [];
let mockLlmIndex = 0;

const mockToolResponses: Array<{ statusCode: number; body: unknown }> = [];
let mockToolIndex = 0;

vi.mock('../../routes/tools/_shared.js', () => {
  return {
    callLlmViaProxy: vi.fn(async () => {
      const idx = Math.min(mockLlmIndex, mockLlmResponses.length - 1);
      const content = mockLlmResponses[idx] ?? '{}';
      mockLlmIndex++;
      return { content, traceId: `trace-${idx}`, usage: null };
    }),
    loadPromptTemplate: vi.fn((_rel: string) => 'SYSTEM: {allowed_tools} {company_info} {user_message} {plan_summary} {step_reason} {input_hint} {tool_id} {tool_description} {final_tool} {final_result} {arithmetic_status} {arithmetic_notes}'),
    renderTemplate: vi.fn((tpl: string, vars: Record<string, string>) => {
      let out = tpl;
      for (const [k, v] of Object.entries(vars)) {
        out = out.split(`{${k}}`).join(v);
      }
      return out;
    }),
    parseLlmJson: vi.fn(<T,>(raw: string): T => {
      let cleaned = raw.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      }
      const first = cleaned.indexOf('{');
      const last = cleaned.lastIndexOf('}');
      if (first !== -1 && last !== -1 && last > first) {
        cleaned = cleaned.slice(first, last + 1);
      }
      return JSON.parse(cleaned) as T;
    }),
    recordUsage: vi.fn(async () => undefined),
    INTERNAL_SECRET: 'test-secret',
  };
});

vi.mock('../tool-executor.js', () => {
  return {
    executeToolViaInject: vi.fn(async () => {
      const idx = Math.min(mockToolIndex, mockToolResponses.length - 1);
      const res = mockToolResponses[idx] ?? { statusCode: 200, body: { success: true } };
      mockToolIndex++;
      return res;
    }),
  };
});

vi.mock('../desire-db.js', () => {
  return {
    logFeatureRequest: vi.fn(async () => undefined),
    ensureAgentTables: vi.fn(async () => undefined),
  };
});

// ── Import SUT after mocks are in place ──────────────────────────────────

import { executeContractAgent } from '../contract-agent.js';
import type { AgentSseEvent } from '../contract-agent.types.js';
import type { FastifyInstance } from 'fastify';

// Minimal fastify stub — the SUT only passes it through to mocked helpers.
const fastifyStub = {} as unknown as FastifyInstance;

async function collectEvents(
  gen: AsyncGenerator<AgentSseEvent, void, void>,
): Promise<AgentSseEvent[]> {
  const out: AgentSseEvent[] = [];
  for await (const ev of gen) out.push(ev);
  return out;
}

beforeEach(() => {
  mockLlmResponses.length = 0;
  mockLlmIndex = 0;
  mockToolResponses.length = 0;
  mockToolIndex = 0;
});

// ──────────────────────────────────────────────────────────────────────────
// 1. Happy path
// ──────────────────────────────────────────────────────────────────────────

describe('executeContractAgent — happy path', () => {
  it('yields run_started → plan → step_start → step_result(ok) → review(ok) → final', async () => {
    // Planner → single estimate.create step
    mockLlmResponses.push(
      JSON.stringify({
        summary: '見積書を1件作成します',
        steps: [{ tool: 'estimate.create', reason: '見積書の作成依頼', inputHint: 'A社 月額10万円' }],
      }),
    );
    // Tool-input builder
    mockLlmResponses.push(
      JSON.stringify({
        conversation_history: [{ role: 'user', content: 'A社 月額10万円で見積書' }],
        business_info_id: 'bi-1',
      }),
    );
    // Reviewer
    mockLlmResponses.push(
      JSON.stringify({ status: 'ok', notes: '算術一致', reply: '見積書を作成しました。承認・送信は必ずご自身で確認してください。' }),
    );

    // Tool returns arithmetically consistent estimate
    mockToolResponses.push({
      statusCode: 200,
      body: {
        success: true,
        data: {
          estimate: {
            items: [{ name: '月額サービス', quantity: 1, unit_price: 100000, amount: 100000 }],
            subtotal: 100000,
            tax_rate: 0.1,
            tax_amount: 10000,
            total: 110000,
          },
        },
      },
    });

    const events = await collectEvents(
      executeContractAgent(fastifyStub, {
        message: 'A社に月額10万円で見積書作って',
        workspaceId: 'ws-1',
      }),
    );
    const types = events.map((e) => e.type);
    expect(types[0]).toBe('run_started');
    expect(types).toContain('plan');
    expect(types).toContain('step_start');
    expect(types).toContain('step_result');
    expect(types).toContain('review');
    expect(types).toContain('final');
    const review = events.find((e) => e.type === 'review');
    expect(review && review.type === 'review' && review.status).toBe('ok');
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 2. Forbidden tool blocked
// ──────────────────────────────────────────────────────────────────────────

describe('executeContractAgent — Contract violation', () => {
  it('emits error CONTRACT_VIOLATION when planner returns a non-whitelisted tool', async () => {
    mockLlmResponses.push(
      JSON.stringify({
        summary: 'Webを検索します',
        steps: [{ tool: 'web_search', reason: '競合調査のため' }],
      }),
    );

    const events = await collectEvents(
      executeContractAgent(fastifyStub, {
        message: '競合企業を調べて',
        workspaceId: 'ws-1',
      }),
    );

    const errorEv = events.find((e) => e.type === 'error');
    expect(errorEv).toBeDefined();
    expect(errorEv && errorEv.type === 'error' && errorEv.code).toBe('CONTRACT_VIOLATION');
    // No step_start should have been emitted
    expect(events.some((e) => e.type === 'step_start')).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 3. MAX_ITER enforcement — extra steps marked failed/skipped
// ──────────────────────────────────────────────────────────────────────────

describe('executeContractAgent — MAX_ITER guard', () => {
  it('does not execute the 6th plan step (MAX_ITER = 5)', async () => {
    const sixSteps = Array.from({ length: 6 }, () => ({
      tool: 'estimate.create',
      reason: '反復テスト',
    }));
    mockLlmResponses.push(JSON.stringify({ summary: '6連発', steps: sixSteps }));
    // Tool-input + success body for each of the 5 that actually run
    for (let i = 0; i < 5; i++) {
      mockLlmResponses.push(JSON.stringify({ conversation_history: [], business_info_id: '' }));
      mockToolResponses.push({ statusCode: 200, body: { success: true, data: {} } });
    }
    // Reviewer
    mockLlmResponses.push(JSON.stringify({ status: 'ok', notes: '', reply: 'done' }));

    const events = await collectEvents(
      executeContractAgent(fastifyStub, {
        message: 'stress test',
        workspaceId: 'ws-1',
      }),
    );

    // The 6th step should yield step_result with status 'failed' and a MAX_ITER message
    const failedStep = events.find(
      (e) => e.type === 'step_result' && e.status === 'failed' && e.stepIndex === 5,
    );
    expect(failedStep).toBeDefined();
    if (failedStep && failedStep.type === 'step_result') {
      expect(failedStep.error).toContain('MAX_ITER');
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 4. Planner JSON parse failure → fallback plan
// ──────────────────────────────────────────────────────────────────────────

describe('executeContractAgent — planner fallback', () => {
  it('falls back to estimate.create single-step plan when planner returns non-JSON', async () => {
    mockLlmResponses.push('これは JSON ではありません。ごめんなさい。');
    // Tool-input builder for the fallback step
    mockLlmResponses.push(
      JSON.stringify({ conversation_history: [], business_info_id: '' }),
    );
    // Reviewer
    mockLlmResponses.push(
      JSON.stringify({ status: 'ok', notes: '', reply: 'fallback ok' }),
    );
    mockToolResponses.push({ statusCode: 200, body: { success: true, data: {} } });

    const events = await collectEvents(
      executeContractAgent(fastifyStub, {
        message: '何か書類を作って',
        workspaceId: 'ws-1',
      }),
    );
    const planEv = events.find((e) => e.type === 'plan');
    expect(planEv).toBeDefined();
    if (planEv && planEv.type === 'plan') {
      expect(planEv.plan.steps).toHaveLength(1);
      expect(planEv.plan.steps[0].tool).toBe('estimate.create');
    }
    // Final should still be emitted
    expect(events.some((e) => e.type === 'final')).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 5. Arithmetic mismatch surfaced in review
// ──────────────────────────────────────────────────────────────────────────

describe('executeContractAgent — arithmetic review failed', () => {
  it('emits review(status=failed) when total does not equal subtotal + tax', async () => {
    mockLlmResponses.push(
      JSON.stringify({
        summary: '見積書作成',
        steps: [{ tool: 'estimate.create', reason: '作成' }],
      }),
    );
    mockLlmResponses.push(JSON.stringify({ conversation_history: [], business_info_id: '' }));
    mockLlmResponses.push(
      JSON.stringify({ status: 'failed', notes: '算術不整合', reply: '算術不整合のため再確認してください。承認・送信は必ずご自身で確認してください。' }),
    );

    // subtotal=100000, tax=10000, total should be 110000 but claim 999999
    mockToolResponses.push({
      statusCode: 200,
      body: {
        success: true,
        data: {
          estimate: {
            items: [{ name: 'x', quantity: 1, unit_price: 100000, amount: 100000 }],
            subtotal: 100000,
            tax_rate: 0.1,
            tax_amount: 10000,
            total: 999999,
          },
        },
      },
    });

    const events = await collectEvents(
      executeContractAgent(fastifyStub, {
        message: '見積書作って',
        workspaceId: 'ws-1',
      }),
    );
    const review = events.find((e) => e.type === 'review');
    expect(review).toBeDefined();
    if (review && review.type === 'review') {
      expect(review.status).toBe('failed');
      expect(review.arithmeticOk).toBe(false);
    }
  });
});
