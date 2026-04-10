/**
 * FujiTrace AI 事務員 — route bundle.
 *
 * Mounts:
 *   POST /api/agent/chat
 *   GET  /api/agent/trial-status
 */
import type { FastifyInstance } from 'fastify';
import agentChatRoute from './chat.js';
import agentTrialStatusRoute from './trial-status.js';

export default async function agentRoutes(fastify: FastifyInstance): Promise<void> {
  await agentChatRoute(fastify);
  await agentTrialStatusRoute(fastify);
}
