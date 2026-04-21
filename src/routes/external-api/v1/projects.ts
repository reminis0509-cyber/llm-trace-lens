/**
 * routes/external-api/v1/projects.ts — read-only Projects projection for
 * programmatic callers.
 *
 * Mount prefix: `/api/external-api/v1`. All endpoints require an API key.
 *
 * Endpoints:
 *   GET  /projects        → list projects owned by the API-key's user
 *   GET  /projects/:id    → project detail (no file contents, no secrets)
 */
import type { FastifyInstance } from 'fastify';
import { getKnex } from '../../../storage/knex-client.js';

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
  size: number;
  created_at: string;
}

function rowToProject(r: ProjectRow) {
  return {
    id: r.id,
    name: r.name,
    instructions: r.instructions,
    workspaceId: r.workspace_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export default async function externalProjectsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/projects', async (request, reply) => {
    const userEmail = request.user?.email;
    if (!userEmail) return reply.code(401).send({ success: false, error: 'unauthenticated' });
    try {
      const db = getKnex();
      const rows = (await db('projects')
        .where({ user_id: userEmail })
        .orderBy('created_at', 'desc')
        .limit(100)) as ProjectRow[];
      return reply.send({ success: true, data: { projects: rows.map(rowToProject) } });
    } catch (err) {
      request.log.error({ err }, '[external/projects GET] failed');
      return reply.code(500).send({ success: false, error: 'internal error' });
    }
  });

  fastify.get<{ Params: { id: string } }>('/projects/:id', async (request, reply) => {
    const userEmail = request.user?.email;
    if (!userEmail) return reply.code(401).send({ success: false, error: 'unauthenticated' });
    try {
      const db = getKnex();
      const project = (await db('projects')
        .where({ id: request.params.id, user_id: userEmail })
        .first()) as ProjectRow | undefined;
      if (!project) return reply.code(404).send({ success: false, error: 'not found' });

      const files = (await db('project_files')
        .where({ project_id: project.id })
        .orderBy('created_at', 'desc')) as ProjectFileRow[];

      return reply.send({
        success: true,
        data: {
          project: rowToProject(project),
          files: files.map((f) => ({
            id: f.id,
            filename: f.filename,
            mimeType: f.mime_type,
            size: f.size,
            createdAt: f.created_at,
          })),
        },
      });
    } catch (err) {
      request.log.error({ err }, '[external/projects GET id] failed');
      return reply.code(500).send({ success: false, error: 'internal error' });
    }
  });
}
