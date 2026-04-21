/**
 * FujiTrace AI Tools — route bundle.
 *
 * Mounts:
 *   GET/POST/PUT /api/tools/business-info[/:id]
 *   POST         /api/tools/estimate/create
 *   POST         /api/tools/estimate/check
 *   POST         /api/tools/office-task/execute
 *   POST         /api/tools/office-task/execute-stream  (SSE)
 *   GET          /api/tools/estimate/openapi.json
 *   POST         /api/tools/excel-analyze           (v2.1)
 *   POST         /api/tools/meeting-transcribe     (v2.1)
 *   POST         /api/tools/document-proofread     (v2.1)
 *
 * NOTE: Server-side PDF generation (`/api/tools/estimate/pdf`) was removed on
 * 2026-04-15. PDF rendering is now performed entirely client-side via
 * `@react-pdf/renderer` (see `packages/dashboard/src/lib/pdf/`). The server
 * route was deleted because Vercel's 4.5MB response cap was incompatible with
 * embedding a CJK TTF subset, and the client-side path is already the only
 * code path exercised by the dashboard.
 */
import type { FastifyInstance } from 'fastify';
import businessInfoRoute from './business-info.js';
import estimateCreateRoute from './estimate-create.js';
import estimateCheckRoute from './estimate-check.js';
import officeTaskExecuteRoute from './office-task-execute.js';
import toolsOpenApiRoutes from './openapi.js';
import excelAnalyzeRoutes from './excel-analyze.js';
import meetingTranscribeRoutes from './meeting-transcribe.js';
import documentProofreadRoutes from './document-proofread.js';

export default async function toolsRoutes(fastify: FastifyInstance): Promise<void> {
  await businessInfoRoute(fastify);
  await estimateCreateRoute(fastify);
  await estimateCheckRoute(fastify);
  await officeTaskExecuteRoute(fastify);
  await toolsOpenApiRoutes(fastify);
  // AI 社員 v2.1 (Founder承認 2026-04-21) — Excel / Voice / Proofreader
  await excelAnalyzeRoutes(fastify);
  await meetingTranscribeRoutes(fastify);
  await documentProofreadRoutes(fastify);
}
