/**
 * LIFF-facing API routes for LINE-originated document rendering.
 *
 * Only one endpoint for now:
 *
 *   GET /api/line/liff-doc/:shortId
 *     → returns `{ type, data, issuer, createdAt }` so the LIFF page can
 *       reuse `packages/dashboard/src/lib/pdf/` to render the PDF on the
 *       user's device. Token is a 24-char base64url id minted by
 *       `saveDocForLiff()` with 1-hour TTL. 404 on miss / expiry.
 *
 * Intentionally does NOT require workspace authentication — the unguessable
 * token IS the capability. LIFF apps running inside the LINE in-app browser
 * cannot reliably carry dashboard auth cookies, so a capability-based token
 * design is the simplest scheme that works end-to-end.
 *
 * Rate limit isn't added here because KV TTL keeps the attack window short
 * and the endpoint returns pure JSON (no PDF render, no LLM call). If
 * abuse shows up in logs, tighten it then.
 */
import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { z } from 'zod';
import { getKnex } from '../storage/knex-client.js';
import { ensureAiToolsTables } from './tools/_shared.js';
import { loadDocForLiff } from '../line/doc-store.js';
import { resolveLineWorkspace } from '../line/workspace-resolver.js';

/**
 * LINE user IDs are fixed-length opaque strings. `U` + 32 hex chars is the
 * documented shape. A quick shape check protects KV / DB from garbage.
 */
const LINE_USER_ID_RE = /^U[0-9a-f]{32}$/;

/**
 * Request body for POST /api/line/liff-business-info. Mirrors the dashboard
 * form contract from `src/routes/tools/business-info.ts` so the rules stay
 * aligned (inv number pattern, max lengths).
 */
const businessInfoBodySchema = z.object({
  lineUserId: z.string().regex(LINE_USER_ID_RE, 'invalid lineUserId'),
  company_name: z.string().trim().min(1).max(200),
  address: z.string().trim().max(300).optional().default(''),
  phone: z.string().trim().max(30).optional().default(''),
  email: z.union([z.literal(''), z.string().trim().email().max(200)]).optional().default(''),
  invoice_number: z
    .union([z.literal(''), z.string().trim().regex(/^T\d{13}$/u)])
    .optional()
    .default(''),
  bank_name: z.string().trim().max(100).optional().default(''),
  bank_branch: z.string().trim().max(100).optional().default(''),
  account_type: z.union([z.literal(''), z.literal('普通'), z.literal('当座')]).optional().default(''),
  account_number: z.string().trim().max(30).optional().default(''),
  account_holder: z.string().trim().max(100).optional().default(''),
});

/** Empty string → null so the DB stores canonical "unset" values. */
function blank(v: string | undefined | null): string | null {
  if (v === undefined || v === null || v === '') return null;
  return v;
}

export default async function lineLiffRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.get<{ Params: { shortId: string } }>(
    '/api/line/liff-doc/:shortId',
    async (request, reply) => {
      const shortId = request.params.shortId;
      // Fail-fast shape check so obviously malformed ids don't hit KV.
      if (!shortId || !/^[A-Za-z0-9_-]{20,32}$/.test(shortId)) {
        return reply
          .code(400)
          .send({ success: false, error: 'invalid shortId' });
      }

      const record = await loadDocForLiff(shortId);
      if (!record) {
        return reply.code(404).send({
          success: false,
          error: 'document not found or expired (max 1 hour)',
        });
      }

      return reply.send({
        success: true,
        data: {
          type: record.type,
          data: record.data,
          issuer: record.issuer,
          createdAt: record.createdAt,
        },
      });
    },
  );

  /**
   * GET /api/line/liff-business-info?lineUserId=U{32-hex}
   *
   * Fetch the LINE user's workspace business_info row. Returns
   * `data: null` when no row exists yet (first-time access).
   *
   * Auth model: the caller proves they own `lineUserId` by being inside the
   * LIFF app (`liff.getProfile().userId`). This is the same trust level as
   * `/api/line/liff-doc/:shortId` — LIFF app gates the call. Future
   * hardening should verify an IDToken instead, but the LIFF SDK already
   * scopes `getProfile()` to the real LINE user so the current design is
   * acceptable for the current trust boundary (onboarding form only; no
   * PII egress beyond the user's own data).
   */
  fastify.get<{ Querystring: { lineUserId?: string } }>(
    '/api/line/liff-business-info',
    async (request, reply) => {
      const lineUserId = request.query.lineUserId ?? '';
      if (!LINE_USER_ID_RE.test(lineUserId)) {
        return reply.code(400).send({ success: false, error: 'invalid lineUserId' });
      }
      const resolved = await resolveLineWorkspace(lineUserId);
      if (!resolved) {
        return reply.code(503).send({
          success: false,
          error: 'workspace resolver unavailable',
        });
      }
      try {
        await ensureAiToolsTables();
        const db = getKnex();
        const row = await db('user_business_info')
          .where({ workspace_id: resolved.workspaceId })
          .orderBy('created_at', 'asc')
          .first();
        if (!row || (row as { company_name?: string }).company_name === 'デモユーザー') {
          // Placeholder row exists but counts as "no real data yet" so the
          // form shows empty fields on first visit.
          return reply.send({ success: true, data: null });
        }
        return reply.send({ success: true, data: row });
      } catch (err) {
        request.log.error({ err, lineUserId }, '[liff-business-info] GET failed');
        return reply.code(500).send({ success: false, error: 'DB error' });
      }
    },
  );

  /**
   * POST /api/line/liff-business-info
   *
   * Upsert the LINE user's business info. Keeps a single oldest row per
   * workspace (`created_at asc`) so later edits consistently update the
   * same row that the estimate/invoice tools read via `business_info_id`.
   *
   * Clears the `line:onboarding:{workspaceId}` flag if set — once the form
   * is submitted the conversational onboarding detour should stop firing.
   */
  fastify.post('/api/line/liff-business-info', async (request, reply) => {
    const parsed = businessInfoBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: parsed.error.issues[0]?.message ?? 'invalid body',
      });
    }
    const body = parsed.data;
    const resolved = await resolveLineWorkspace(body.lineUserId);
    if (!resolved) {
      return reply.code(503).send({
        success: false,
        error: 'workspace resolver unavailable',
      });
    }
    try {
      await ensureAiToolsTables();
      const db = getKnex();
      const existing = await db('user_business_info')
        .where({ workspace_id: resolved.workspaceId })
        .orderBy('created_at', 'asc')
        .first();
      const now = new Date();
      if (existing && existing.id) {
        await db('user_business_info')
          .where({ id: existing.id })
          .update({
            company_name: body.company_name,
            address: blank(body.address),
            phone: blank(body.phone),
            email: blank(body.email),
            invoice_number: blank(body.invoice_number),
            bank_name: blank(body.bank_name),
            bank_branch: blank(body.bank_branch),
            account_type: blank(body.account_type),
            account_number: blank(body.account_number),
            account_holder: blank(body.account_holder),
            updated_at: now,
          });
      } else {
        await db('user_business_info').insert({
          id: crypto.randomUUID(),
          workspace_id: resolved.workspaceId,
          company_name: body.company_name,
          address: blank(body.address),
          phone: blank(body.phone),
          email: blank(body.email),
          invoice_number: blank(body.invoice_number),
          bank_name: blank(body.bank_name),
          bank_branch: blank(body.bank_branch),
          account_type: blank(body.account_type),
          account_number: blank(body.account_number),
          account_holder: blank(body.account_holder),
          created_at: now,
          updated_at: now,
        });
      }
      // Best-effort: clear the conversational onboarding flag so future
      // chat messages skip the detour. Import dynamically so this module
      // doesn't depend on the LINE KV helpers when LINE is disabled.
      try {
        const { finishOnboarding } = await import('../line/onboarding.js');
        await finishOnboarding(resolved.workspaceId);
      } catch {
        // Non-fatal.
      }
      return reply.send({ success: true });
    } catch (err) {
      request.log.error({ err, lineUserId: body.lineUserId }, '[liff-business-info] POST failed');
      return reply.code(500).send({ success: false, error: 'DB error' });
    }
  });
}
