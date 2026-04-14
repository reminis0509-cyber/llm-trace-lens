/**
 * QA 2026-04-09: Authentication guard regression for
 * POST /api/tools/estimate/check.
 *
 * Background
 * ----------
 * The AI estimate tool is the first responsible-AI tool under FujiTrace's
 * Free-tier investment strategy (30 runs/month, ¥50K/month cap on API cost).
 * If an anonymous caller could reach the LLM pipeline, the quota counter is
 * bypassed and real API spend is incurred. This test pins the contract that
 * any request which cannot be resolved to a workspace MUST receive a 401
 * BEFORE the LLM proxy is invoked.
 *
 * Strategy
 * --------
 * We boot a minimal Fastify instance registering only `estimateCheckRoute`.
 * No rate-limit plugin is installed — route-level `config.rateLimit` is a
 * no-op when the plugin is absent, which is exactly what we want for unit
 * testing the auth boundary in isolation. We then `inject()` an anonymous
 * POST and assert the 401 envelope and — critically — that the response is
 * produced without the handler ever needing DB or LLM access (guaranteed by
 * `resolveWorkspaceId` returning null for fully anonymous requests; see
 * `resolve-workspace.test.ts`).
 */
import { describe, it, expect, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import estimateCheckRoute from '../../../routes/tools/estimate-check.js';

interface ErrorEnvelope {
  success: false;
  error: string;
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    (value as { success: unknown }).success === false &&
    'error' in value &&
    typeof (value as { error: unknown }).error === 'string'
  );
}

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(estimateCheckRoute);
  await app.ready();
  return app;
}

const minimalValidEstimate = {
  estimate_number: 'E-0001',
  issue_date: '2026-04-09',
  valid_until: '2026-05-09',
  client: {
    company_name: '株式会社テスト',
    honorific: '御中',
  },
  subject: 'テスト案件',
  items: [
    {
      name: 'テスト作業',
      quantity: 1,
      unit: '式',
      unit_price: 10000,
      tax_rate: 10,
      subtotal: 10000,
    },
  ],
  subtotal: 10000,
  tax_amount: 1000,
  total: 11000,
};

describe('POST /api/tools/estimate/check — auth guard', () => {
  let app: FastifyInstance;

  afterAll(async () => {
    if (app) await app.close();
  });

  it('returns 401 for a fully anonymous request (no headers)', async () => {
    app = await buildTestApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/tools/estimate/check',
      payload: { estimate: minimalValidEstimate },
    });
    expect(res.statusCode).toBe(401);
    const body: unknown = res.json();
    expect(isErrorEnvelope(body)).toBe(true);
    if (isErrorEnvelope(body)) {
      expect(body.error).toContain('認証');
    }
  });

  it('returns 401 when only x-user-id header is present (no workspace mapping)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tools/estimate/check',
      headers: { 'x-user-id': 'random-user-id-no-workspace' },
      payload: { estimate: minimalValidEstimate },
    });
    expect(res.statusCode).toBe(401);
    const body: unknown = res.json();
    expect(isErrorEnvelope(body)).toBe(true);
  });

  it('returns 401 BEFORE zod body validation runs — unauth requests with a bogus body still get 401', async () => {
    // Important: the handler must not leak body-validation 400s to anonymous
    // callers, because doing so would let an attacker probe the schema
    // without being authenticated. resolveWorkspaceId is called first in the
    // handler, so the order is guaranteed.
    const res = await app.inject({
      method: 'POST',
      url: '/api/tools/estimate/check',
      payload: { this_is_not_a_valid_body: true },
    });
    expect(res.statusCode).toBe(401);
  });
});
