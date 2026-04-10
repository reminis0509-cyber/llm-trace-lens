/**
 * FujiTrace AI Tools — route bundle.
 *
 * Mounts:
 *   GET/POST/PUT /api/tools/business-info[/:id]
 *   POST         /api/tools/estimate/create
 *   POST         /api/tools/estimate/check
 *   POST         /api/tools/estimate/pdf
 *   POST         /api/tools/office-task/execute
 *   GET          /api/tools/estimate/openapi.json
 */
import type { FastifyInstance } from 'fastify';
import businessInfoRoute from './business-info.js';
import estimateCreateRoute from './estimate-create.js';
import estimateCheckRoute from './estimate-check.js';
import estimatePdfRoute from './estimate-pdf.js';
import officeTaskExecuteRoute from './office-task-execute.js';
import toolsOpenApiRoutes from './openapi.js';

export default async function toolsRoutes(fastify: FastifyInstance): Promise<void> {
  await businessInfoRoute(fastify);
  await estimateCreateRoute(fastify);
  await estimateCheckRoute(fastify);
  await estimatePdfRoute(fastify);
  await officeTaskExecuteRoute(fastify);
  await toolsOpenApiRoutes(fastify);
}
