/**
 * routes/external-api/index.ts — `/api/external-api/v1/*` bundle.
 *
 * All child routes are API-key-authenticated via `apiKeyAuth`. The raw
 * middleware is attached at the scoped prefix so Cookie / JWT auth paths
 * elsewhere in the app remain unaffected.
 */
import type { FastifyInstance } from 'fastify';
import { apiKeyAuth } from '../../middleware/api-key-auth.js';
import externalTasksRoutes from './v1/tasks.js';
import externalProjectsRoutes from './v1/projects.js';

export default async function externalApiRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(
    async (scoped) => {
      scoped.addHook('preHandler', apiKeyAuth);
      await externalTasksRoutes(scoped);
      await externalProjectsRoutes(scoped);
    },
    { prefix: '/api/external-api/v1' },
  );
}
