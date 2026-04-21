/**
 * routes/projects.ts — AI Employee Projects CRUD.
 *
 * Endpoints (all require `request.user.email`, returning 401 otherwise):
 *
 *   POST   /api/projects
 *     body: { name: string, instructions?: string }
 *     resp: { success: true, data: { project } }
 *
 *   GET    /api/projects
 *     resp: { success: true, data: { projects } }
 *
 *   GET    /api/projects/:id
 *     resp: { success: true, data: { project, files, connectors, recentTasks } }
 *
 *   PATCH  /api/projects/:id
 *     body: { name?: string, instructions?: string }
 *     resp: { success: true, data: { project } }
 *
 *   DELETE /api/projects/:id
 *     resp: { success: true }
 *
 *   POST   /api/projects/:id/files  (multipart/form-data with field "file")
 *     resp: { success: true, data: { file } }
 *     10MB cap per file.
 *
 *   DELETE /api/projects/:id/files/:fileId
 *     resp: { success: true }
 *
 *   POST   /api/projects/:id/connectors
 *     body: { provider: string }
 *     resp: { success: true }
 *
 *   DELETE /api/projects/:id/connectors/:provider
 *     resp: { success: true }
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { getKnex } from '../storage/knex-client.js';
import { isConnectorProvider } from '../auth/oauth/oauth-flow.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface ProjectRow {
  id: string;
  workspace_id: string | null;
  user_id: string;
  name: string;
  instructions: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectFileRow {
  id: string;
  project_id: string;
  filename: string;
  mime_type: string;
  content_base64: string | null;
  storage_ref: string | null;
  size: number;
  created_at: string;
}

interface ProjectConnectorRow {
  project_id: string;
  provider: string;
  attached_at: string;
}

interface TaskTimelineLiteRow {
  id: string;
  task_type: string;
  title: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  project_id?: string | null;
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
  instructions: z.string().max(20_000).optional(),
});

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  instructions: z.string().max(20_000).optional(),
});

const connectorAttachSchema = z.object({
  provider: z.string(),
});

function rowToProject(r: ProjectRow) {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    userId: r.user_id,
    name: r.name,
    instructions: r.instructions,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToFile(r: ProjectFileRow) {
  return {
    id: r.id,
    projectId: r.project_id,
    filename: r.filename,
    mimeType: r.mime_type,
    size: r.size,
    createdAt: r.created_at,
    // content_base64 deliberately not included in listing; use download endpoint if needed
  };
}

async function ensureOwned(
  userEmail: string,
  projectId: string,
): Promise<ProjectRow | null> {
  const db = getKnex();
  const row = (await db('projects')
    .where({ id: projectId, user_id: userEmail })
    .first()) as ProjectRow | undefined;
  return row ?? null;
}

export default async function projectRoutes(fastify: FastifyInstance): Promise<void> {
  // ---------------------------------------------------------------------
  // POST /api/projects
  // ---------------------------------------------------------------------
  fastify.post('/api/projects', async (request, reply) => {
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
      const now = new Date().toISOString();
      await db('projects').insert({
        id,
        workspace_id: null,
        user_id: userEmail,
        name: parsed.data.name,
        instructions: parsed.data.instructions ?? null,
        created_at: now,
        updated_at: now,
      });
      const row = (await db('projects').where({ id }).first()) as ProjectRow;
      return reply.code(201).send({ success: true, data: { project: rowToProject(row) } });
    } catch (err) {
      request.log.error({ err }, '[projects POST] failed');
      return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
    }
  });

  // ---------------------------------------------------------------------
  // GET /api/projects
  // ---------------------------------------------------------------------
  fastify.get('/api/projects', async (request, reply) => {
    const userEmail = request.user?.email;
    if (!userEmail) return reply.code(401).send({ success: false, error: '認証が必要です' });

    try {
      const db = getKnex();
      const rows = (await db('projects')
        .where({ user_id: userEmail })
        .orderBy('created_at', 'desc')
        .limit(100)) as ProjectRow[];
      return reply.send({
        success: true,
        data: { projects: rows.map(rowToProject) },
      });
    } catch (err) {
      request.log.error({ err }, '[projects GET] failed');
      return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
    }
  });

  // ---------------------------------------------------------------------
  // GET /api/projects/:id
  // ---------------------------------------------------------------------
  fastify.get<{ Params: { id: string } }>(
    '/api/projects/:id',
    async (request, reply) => {
      const userEmail = request.user?.email;
      if (!userEmail) return reply.code(401).send({ success: false, error: '認証が必要です' });

      const owned = await ensureOwned(userEmail, request.params.id);
      if (!owned) return reply.code(404).send({ success: false, error: 'not found' });

      try {
        const db = getKnex();
        const files = (await db('project_files')
          .where({ project_id: owned.id })
          .orderBy('created_at', 'desc')) as ProjectFileRow[];
        const connectors = (await db('project_connectors')
          .where({ project_id: owned.id })) as ProjectConnectorRow[];
        const recentTasks = (await db('task_timeline')
          .where({ user_id: userEmail, project_id: owned.id })
          .orderBy('created_at', 'desc')
          .limit(20)) as TaskTimelineLiteRow[];

        return reply.send({
          success: true,
          data: {
            project: rowToProject(owned),
            files: files.map(rowToFile),
            connectors: connectors.map((c) => ({ provider: c.provider, attachedAt: c.attached_at })),
            recentTasks: recentTasks.map((t) => ({
              id: t.id,
              taskType: t.task_type,
              title: t.title,
              status: t.status,
              createdAt: t.created_at,
              completedAt: t.completed_at,
            })),
          },
        });
      } catch (err) {
        request.log.error({ err }, '[projects GET detail] failed');
        return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
      }
    },
  );

  // ---------------------------------------------------------------------
  // PATCH /api/projects/:id
  // ---------------------------------------------------------------------
  fastify.patch<{ Params: { id: string } }>(
    '/api/projects/:id',
    async (request, reply) => {
      const userEmail = request.user?.email;
      if (!userEmail) return reply.code(401).send({ success: false, error: '認証が必要です' });

      const owned = await ensureOwned(userEmail, request.params.id);
      if (!owned) return reply.code(404).send({ success: false, error: 'not found' });

      const parsed = patchSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          error: parsed.error.issues.map((i) => i.message).join('; '),
        });
      }
      if (!parsed.data.name && parsed.data.instructions === undefined) {
        return reply.code(400).send({ success: false, error: 'nothing to update' });
      }

      try {
        const db = getKnex();
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (parsed.data.name) patch.name = parsed.data.name;
        if (parsed.data.instructions !== undefined) patch.instructions = parsed.data.instructions;
        await db('projects').where({ id: owned.id }).update(patch);
        const row = (await db('projects').where({ id: owned.id }).first()) as ProjectRow;
        return reply.send({ success: true, data: { project: rowToProject(row) } });
      } catch (err) {
        request.log.error({ err }, '[projects PATCH] failed');
        return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
      }
    },
  );

  // ---------------------------------------------------------------------
  // DELETE /api/projects/:id
  // ---------------------------------------------------------------------
  fastify.delete<{ Params: { id: string } }>(
    '/api/projects/:id',
    async (request, reply) => {
      const userEmail = request.user?.email;
      if (!userEmail) return reply.code(401).send({ success: false, error: '認証が必要です' });

      const owned = await ensureOwned(userEmail, request.params.id);
      if (!owned) return reply.code(404).send({ success: false, error: 'not found' });

      try {
        const db = getKnex();
        await db('project_files').where({ project_id: owned.id }).del();
        await db('project_connectors').where({ project_id: owned.id }).del();
        await db('projects').where({ id: owned.id }).del();
        return reply.send({ success: true });
      } catch (err) {
        request.log.error({ err }, '[projects DELETE] failed');
        return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
      }
    },
  );

  // ---------------------------------------------------------------------
  // POST /api/projects/:id/files
  // Content-Type: multipart/form-data with a "file" field
  // ---------------------------------------------------------------------
  fastify.post<{ Params: { id: string } }>(
    '/api/projects/:id/files',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const userEmail = request.user?.email;
      if (!userEmail) return reply.code(401).send({ success: false, error: '認証が必要です' });

      const owned = await ensureOwned(userEmail, request.params.id);
      if (!owned) return reply.code(404).send({ success: false, error: 'not found' });

      // @fastify/multipart is registered at server level with 10MB limit.
      // Use an explicit runtime check to surface a clean error instead of
      // relying on the library's exception.
      type MultipartFile = {
        file: NodeJS.ReadableStream;
        filename: string;
        mimetype: string;
        toBuffer: () => Promise<Buffer>;
      };
      type MultipartReq = FastifyRequest<{ Params: { id: string } }> & {
        isMultipart?: () => boolean;
        file?: () => Promise<MultipartFile | undefined>;
      };
      const mpReq = request as MultipartReq;
      if (!mpReq.isMultipart || !mpReq.isMultipart()) {
        return reply.code(400).send({ success: false, error: 'multipart/form-data が必要です' });
      }

      try {
        const mp = await mpReq.file?.();
        if (!mp) return reply.code(400).send({ success: false, error: 'file が見つかりません' });

        const buf = await mp.toBuffer();
        if (buf.length > MAX_FILE_SIZE) {
          return reply.code(413).send({ success: false, error: 'ファイルサイズは10MB以下にしてください' });
        }

        const db = getKnex();
        const id = randomBytes(16).toString('hex');
        const now = new Date().toISOString();
        await db('project_files').insert({
          id,
          project_id: owned.id,
          filename: mp.filename,
          mime_type: mp.mimetype,
          content_base64: buf.toString('base64'),
          storage_ref: null,
          size: buf.length,
          created_at: now,
        });
        const row = (await db('project_files').where({ id }).first()) as ProjectFileRow;
        return reply.code(201).send({ success: true, data: { file: rowToFile(row) } });
      } catch (err) {
        request.log.error({ err }, '[projects file upload] failed');
        return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
      }
    },
  );

  // ---------------------------------------------------------------------
  // DELETE /api/projects/:id/files/:fileId
  // ---------------------------------------------------------------------
  fastify.delete<{ Params: { id: string; fileId: string } }>(
    '/api/projects/:id/files/:fileId',
    async (request, reply) => {
      const userEmail = request.user?.email;
      if (!userEmail) return reply.code(401).send({ success: false, error: '認証が必要です' });

      const owned = await ensureOwned(userEmail, request.params.id);
      if (!owned) return reply.code(404).send({ success: false, error: 'not found' });

      try {
        const db = getKnex();
        const deleted = await db('project_files')
          .where({ id: request.params.fileId, project_id: owned.id })
          .del();
        if (deleted === 0) {
          return reply.code(404).send({ success: false, error: 'file not found' });
        }
        return reply.send({ success: true });
      } catch (err) {
        request.log.error({ err }, '[projects file DELETE] failed');
        return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
      }
    },
  );

  // ---------------------------------------------------------------------
  // POST /api/projects/:id/connectors
  // ---------------------------------------------------------------------
  fastify.post<{ Params: { id: string } }>(
    '/api/projects/:id/connectors',
    async (request, reply) => {
      const userEmail = request.user?.email;
      if (!userEmail) return reply.code(401).send({ success: false, error: '認証が必要です' });

      const owned = await ensureOwned(userEmail, request.params.id);
      if (!owned) return reply.code(404).send({ success: false, error: 'not found' });

      const parsed = connectorAttachSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ success: false, error: 'provider が必須です' });
      }
      if (!isConnectorProvider(parsed.data.provider)) {
        return reply.code(400).send({ success: false, error: '未対応のプロバイダ' });
      }

      try {
        const db = getKnex();
        const existing = await db('project_connectors')
          .where({ project_id: owned.id, provider: parsed.data.provider })
          .first();
        if (!existing) {
          await db('project_connectors').insert({
            project_id: owned.id,
            provider: parsed.data.provider,
            attached_at: new Date().toISOString(),
          });
        }
        return reply.send({ success: true });
      } catch (err) {
        request.log.error({ err }, '[projects connector POST] failed');
        return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
      }
    },
  );

  // ---------------------------------------------------------------------
  // DELETE /api/projects/:id/connectors/:provider
  // ---------------------------------------------------------------------
  fastify.delete<{ Params: { id: string; provider: string } }>(
    '/api/projects/:id/connectors/:provider',
    async (request, reply) => {
      const userEmail = request.user?.email;
      if (!userEmail) return reply.code(401).send({ success: false, error: '認証が必要です' });

      const owned = await ensureOwned(userEmail, request.params.id);
      if (!owned) return reply.code(404).send({ success: false, error: 'not found' });

      try {
        const db = getKnex();
        await db('project_connectors')
          .where({ project_id: owned.id, provider: request.params.provider })
          .del();
        return reply.send({ success: true });
      } catch (err) {
        request.log.error({ err }, '[projects connector DELETE] failed');
        return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
      }
    },
  );
}
