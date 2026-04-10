/**
 * FujiTrace AI 事務員 — route bundle.
 *
 * Mounts:
 *   POST /api/agent/chat
 */
import type { FastifyInstance } from 'fastify';
import agentChatRoute from './chat.js';

export default async function agentRoutes(fastify: FastifyInstance): Promise<void> {
  await agentChatRoute(fastify);
}
