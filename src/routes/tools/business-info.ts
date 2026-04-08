/**
 * Business Info CRUD route
 *
 * GET  /api/tools/business-info        — list all business profiles for the workspace
 * GET  /api/tools/business-info/:id    — fetch one
 * POST /api/tools/business-info        — create new
 * PUT  /api/tools/business-info/:id    — update existing
 *
 * All endpoints require an authenticated workspace context (auth middleware
 * or X-User-Email / X-Workspace-ID headers).
 *
 * Response format follows the project standard:
 *   { success: boolean, data?: T, error?: string }
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { getKnex } from '../../storage/knex-client.js';
import { ensureAiToolsTables, resolveWorkspaceId } from './_shared.js';
import type { BusinessInfoRecord } from '../../types/ai-tools.js';

const businessInfoSchema = z.object({
  company_name: z.string().min(1).max(200),
  address: z.string().max(300).nullish(),
  phone: z.string().max(30).nullish(),
  email: z.string().email().max(200).nullish().or(z.literal('')),
  invoice_number: z
    .string()
    .regex(/^T\d{13}$/u, { message: 'インボイス番号はT+13桁の数字で入力してください' })
    .nullish()
    .or(z.literal('')),
  bank_name: z.string().max(100).nullish(),
  bank_branch: z.string().max(100).nullish(),
  account_type: z.string().max(20).nullish(),
  account_number: z.string().max(30).nullish(),
  account_holder: z.string().max(100).nullish(),
});

type BusinessInfoInput = z.infer<typeof businessInfoSchema>;

function normalizeNullable(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value === '') return null;
  return value;
}

function toRecordInsert(workspaceId: string, input: BusinessInfoInput): Omit<BusinessInfoRecord, 'created_at' | 'updated_at'> {
  return {
    id: crypto.randomUUID(),
    workspace_id: workspaceId,
    company_name: input.company_name,
    address: normalizeNullable(input.address ?? null),
    phone: normalizeNullable(input.phone ?? null),
    email: normalizeNullable(input.email ?? null),
    invoice_number: normalizeNullable(input.invoice_number ?? null),
    bank_name: normalizeNullable(input.bank_name ?? null),
    bank_branch: normalizeNullable(input.bank_branch ?? null),
    account_type: normalizeNullable(input.account_type ?? null),
    account_number: normalizeNullable(input.account_number ?? null),
    account_holder: normalizeNullable(input.account_holder ?? null),
  };
}

export default async function businessInfoRoute(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/tools/business-info
   * List all business profiles for the current workspace.
   */
  fastify.get('/api/tools/business-info', async (request, reply) => {
    try {
      const workspaceId = await resolveWorkspaceId(request);
      if (!workspaceId) {
        return reply.code(401).send({ success: false, error: '認証が必要です' });
      }
      await ensureAiToolsTables();
      const db = getKnex();
      const rows = await db<BusinessInfoRecord>('user_business_info')
        .where({ workspace_id: workspaceId })
        .orderBy('created_at', 'desc');
      return reply.code(200).send({ success: true, data: rows });
    } catch (err) {
      request.log.error({ err }, 'business-info list failed');
      return reply.code(500).send({ success: false, error: '事業情報の取得に失敗しました' });
    }
  });

  /**
   * GET /api/tools/business-info/:id
   */
  fastify.get<{ Params: { id: string } }>('/api/tools/business-info/:id', async (request, reply) => {
    try {
      const workspaceId = await resolveWorkspaceId(request);
      if (!workspaceId) {
        return reply.code(401).send({ success: false, error: '認証が必要です' });
      }
      await ensureAiToolsTables();
      const db = getKnex();
      const row = await db<BusinessInfoRecord>('user_business_info')
        .where({ id: request.params.id, workspace_id: workspaceId })
        .first();
      if (!row) {
        return reply.code(404).send({ success: false, error: '事業情報が見つかりません' });
      }
      return reply.code(200).send({ success: true, data: row });
    } catch (err) {
      request.log.error({ err }, 'business-info get failed');
      return reply.code(500).send({ success: false, error: '事業情報の取得に失敗しました' });
    }
  });

  /**
   * POST /api/tools/business-info
   * Create a new business profile.
   */
  fastify.post('/api/tools/business-info', async (request, reply) => {
    try {
      const workspaceId = await resolveWorkspaceId(request);
      if (!workspaceId) {
        return reply.code(401).send({ success: false, error: '認証が必要です' });
      }
      const parsed = businessInfoSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          error: '入力が不正です',
          details: parsed.error.errors,
        });
      }
      await ensureAiToolsTables();
      const db = getKnex();
      const insert = toRecordInsert(workspaceId, parsed.data);
      const now = new Date().toISOString();
      await db('user_business_info').insert({ ...insert, created_at: now, updated_at: now });
      const created = await db<BusinessInfoRecord>('user_business_info')
        .where({ id: insert.id })
        .first();
      return reply.code(201).send({ success: true, data: created });
    } catch (err) {
      request.log.error({ err }, 'business-info create failed');
      return reply.code(500).send({ success: false, error: '事業情報の作成に失敗しました' });
    }
  });

  /**
   * PUT /api/tools/business-info/:id
   * Update an existing business profile (must belong to the workspace).
   */
  fastify.put<{ Params: { id: string } }>('/api/tools/business-info/:id', async (request, reply) => {
    try {
      const workspaceId = await resolveWorkspaceId(request);
      if (!workspaceId) {
        return reply.code(401).send({ success: false, error: '認証が必要です' });
      }
      const parsed = businessInfoSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          error: '入力が不正です',
          details: parsed.error.errors,
        });
      }
      await ensureAiToolsTables();
      const db = getKnex();
      const existing = await db<BusinessInfoRecord>('user_business_info')
        .where({ id: request.params.id, workspace_id: workspaceId })
        .first();
      if (!existing) {
        return reply.code(404).send({ success: false, error: '事業情報が見つかりません' });
      }
      const update = toRecordInsert(workspaceId, parsed.data);
      await db('user_business_info')
        .where({ id: request.params.id, workspace_id: workspaceId })
        .update({
          company_name: update.company_name,
          address: update.address,
          phone: update.phone,
          email: update.email,
          invoice_number: update.invoice_number,
          bank_name: update.bank_name,
          bank_branch: update.bank_branch,
          account_type: update.account_type,
          account_number: update.account_number,
          account_holder: update.account_holder,
          updated_at: new Date().toISOString(),
        });
      const updated = await db<BusinessInfoRecord>('user_business_info')
        .where({ id: request.params.id })
        .first();
      return reply.code(200).send({ success: true, data: updated });
    } catch (err) {
      request.log.error({ err }, 'business-info update failed');
      return reply.code(500).send({ success: false, error: '事業情報の更新に失敗しました' });
    }
  });
}
