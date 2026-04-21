/**
 * routes/custom-mcp.ts — CRUD for user-registered Custom MCP servers.
 *
 * Endpoints (all require auth):
 *   POST   /api/custom-mcp        body: { name, url, authHeader?, enabled? }
 *   GET    /api/custom-mcp
 *   GET    /api/custom-mcp/:id
 *   PATCH  /api/custom-mcp/:id    body: subset of POST
 *   DELETE /api/custom-mcp/:id
 */
import type { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { getKnex } from '../storage/knex-client.js';
import { encryptToken } from '../lib/token-crypto.js';
import { isPublicUrl } from '../lib/url-safety.js';

interface CustomMcpRow {
  id: string;
  user_id: string;
  workspace_id: string | null;
  name: string;
  url: string;
  auth_header_encrypted: string | null;
  enabled: number | boolean;
  created_at: string;
}

const PUBLIC_URL_ERROR =
  'プライベート/ループバック/非 http URL は登録できません';

const createSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url().refine((v) => isPublicUrl(v), PUBLIC_URL_ERROR),
  authHeader: z.string().max(4096).optional(),
  enabled: z.boolean().optional(),
});

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  url: z.string().url().refine((v) => isPublicUrl(v), PUBLIC_URL_ERROR).optional(),
  authHeader: z.string().max(4096).optional(),
  enabled: z.boolean().optional(),
});

function rowOut(r: CustomMcpRow) {
  return {
    id: r.id,
    name: r.name,
    url: r.url,
    enabled: Boolean(r.enabled),
    hasAuthHeader: Boolean(r.auth_header_encrypted),
    createdAt: r.created_at,
  };
}

export default async function customMcpRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/custom-mcp', async (request, reply) => {
    const userEmail = request.user?.email;
    if (!userEmail) return reply.code(401).send({ success: false, error: '認証が必要です' });

    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join('; '),
      });
    }

    try {
      const db = getKnex();
      const id = randomBytes(16).toString('hex');
      const encrypted = parsed.data.authHeader
        ? encryptToken(parsed.data.authHeader)
        : null;
      await db('custom_mcp_servers').insert({
        id,
        user_id: userEmail,
        workspace_id: null,
        name: parsed.data.name,
        url: parsed.data.url,
        auth_header_encrypted: encrypted,
        enabled: parsed.data.enabled ?? true,
        created_at: new Date().toISOString(),
      });
      const row = (await db('custom_mcp_servers').where({ id }).first()) as CustomMcpRow;
      return reply.code(201).send({ success: true, data: { server: rowOut(row) } });
    } catch (err) {
      request.log.error({ err }, '[custom-mcp POST] failed');
      return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
    }
  });

  fastify.get('/api/custom-mcp', async (request, reply) => {
    const userEmail = request.user?.email;
    if (!userEmail) return reply.code(401).send({ success: false, error: '認証が必要です' });
    try {
      const db = getKnex();
      const rows = (await db('custom_mcp_servers')
        .where({ user_id: userEmail })
        .orderBy('created_at', 'desc')
        .limit(200)) as CustomMcpRow[];
      return reply.send({ success: true, data: { servers: rows.map(rowOut) } });
    } catch (err) {
      request.log.error({ err }, '[custom-mcp GET] failed');
      return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
    }
  });

  fastify.get<{ Params: { id: string } }>('/api/custom-mcp/:id', async (request, reply) => {
    const userEmail = request.user?.email;
    if (!userEmail) return reply.code(401).send({ success: false, error: '認証が必要です' });
    try {
      const db = getKnex();
      const row = (await db('custom_mcp_servers')
        .where({ id: request.params.id, user_id: userEmail })
        .first()) as CustomMcpRow | undefined;
      if (!row) return reply.code(404).send({ success: false, error: 'not found' });
      return reply.send({ success: true, data: { server: rowOut(row) } });
    } catch (err) {
      request.log.error({ err }, '[custom-mcp GET id] failed');
      return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
    }
  });

  fastify.patch<{ Params: { id: string } }>(
    '/api/custom-mcp/:id',
    async (request, reply) => {
      const userEmail = request.user?.email;
      if (!userEmail) return reply.code(401).send({ success: false, error: '認証が必要です' });

      const parsed = patchSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          error: parsed.error.issues.map((i) => i.message).join('; '),
        });
      }

      try {
        const db = getKnex();
        const existing = (await db('custom_mcp_servers')
          .where({ id: request.params.id, user_id: userEmail })
          .first()) as CustomMcpRow | undefined;
        if (!existing) return reply.code(404).send({ success: false, error: 'not found' });

        const patch: Record<string, unknown> = {};
        if (parsed.data.name) patch.name = parsed.data.name;
        if (parsed.data.url) patch.url = parsed.data.url;
        if (parsed.data.enabled !== undefined) patch.enabled = parsed.data.enabled;
        if (parsed.data.authHeader !== undefined) {
          patch.auth_header_encrypted = parsed.data.authHeader
            ? encryptToken(parsed.data.authHeader)
            : null;
        }
        if (Object.keys(patch).length === 0) {
          return reply.send({ success: true, data: { server: rowOut(existing) } });
        }
        await db('custom_mcp_servers').where({ id: existing.id }).update(patch);
        const row = (await db('custom_mcp_servers').where({ id: existing.id }).first()) as CustomMcpRow;
        return reply.send({ success: true, data: { server: rowOut(row) } });
      } catch (err) {
        request.log.error({ err }, '[custom-mcp PATCH] failed');
        return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
      }
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/api/custom-mcp/:id',
    async (request, reply) => {
      const userEmail = request.user?.email;
      if (!userEmail) return reply.code(401).send({ success: false, error: '認証が必要です' });
      try {
        const db = getKnex();
        const deleted = await db('custom_mcp_servers')
          .where({ id: request.params.id, user_id: userEmail })
          .del();
        if (deleted === 0) {
          return reply.code(404).send({ success: false, error: 'not found' });
        }
        return reply.send({ success: true });
      } catch (err) {
        request.log.error({ err }, '[custom-mcp DELETE] failed');
        return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
      }
    },
  );
}
