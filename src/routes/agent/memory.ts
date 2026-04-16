/**
 * GET  /api/agent/memory — Retrieve workspace custom instructions (memory).
 * PUT  /api/agent/memory — Upsert workspace custom instructions (max 2000 chars).
 *
 * Auth: workspace required.
 *
 * Response format:
 *   GET  → { success: true, data: { content: string, updatedAt: string | null } }
 *   PUT  → { success: true }
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { z } from 'zod';
import { getKnex } from '../../storage/knex-client.js';
import { resolveWorkspaceId } from '../tools/_shared.js';
import { ensureAgentTables } from '../../agent/desire-db.js';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const putSchema = z.object({
  content: z
    .string()
    .max(2000, 'メモは2000文字以内にしてください'),
});

// ---------------------------------------------------------------------------
// DB row shape
// ---------------------------------------------------------------------------

interface WorkspaceMemoryRow {
  id: string;
  workspace_id: string;
  content: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export default async function memoryRoute(fastify: FastifyInstance): Promise<void> {
  // GET /api/agent/memory
  fastify.get('/api/agent/memory', async (request: FastifyRequest, reply) => {
    const workspaceId = await resolveWorkspaceId(request);
    if (!workspaceId) {
      return reply.code(401).send({ success: false, error: '認証が必要です' });
    }

    try {
      await ensureAgentTables();
      const db = getKnex();
      const row = (await db('workspace_memory')
        .where({ workspace_id: workspaceId })
        .first()) as WorkspaceMemoryRow | undefined;

      return reply.send({
        success: true,
        data: {
          content: row?.content ?? '',
          updatedAt: row?.updated_at ?? null,
        },
      });
    } catch (err) {
      request.log.error(err, 'Failed to load workspace memory');
      return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
    }
  });

  // PUT /api/agent/memory
  fastify.put('/api/agent/memory', async (request: FastifyRequest, reply) => {
    const workspaceId = await resolveWorkspaceId(request);
    if (!workspaceId) {
      return reply.code(401).send({ success: false, error: '認証が必要です' });
    }

    const parsed = putSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: parsed.error.issues.map((i) => i.message).join('; '),
      });
    }

    const { content } = parsed.data;

    try {
      await ensureAgentTables();
      const db = getKnex();
      const now = new Date().toISOString();

      const existing = (await db('workspace_memory')
        .where({ workspace_id: workspaceId })
        .first()) as WorkspaceMemoryRow | undefined;

      if (existing) {
        await db('workspace_memory')
          .where({ workspace_id: workspaceId })
          .update({ content, updated_at: now });
      } else {
        await db('workspace_memory').insert({
          id: crypto.randomUUID(),
          workspace_id: workspaceId,
          content,
          updated_at: now,
        });
      }

      return reply.send({ success: true });
    } catch (err) {
      request.log.error(err, 'Failed to save workspace memory');
      return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
    }
  });
}
