/**
 * FujiTrace AI 事務員 — route bundle.
 *
 * Mounts:
 *   POST /api/agent/chat
 *   POST /api/agent/chat-v2
 *   GET  /api/agent/trial-status
 */
import type { FastifyInstance } from 'fastify';
import agentChatRoute from './chat.js';
import agentTrialStatusRoute from './trial-status.js';
import contractChatRoute from './contract-chat.js';
import chatV2Route from './chat-v2.js';
import memoryRoute from './memory.js';

export default async function agentRoutes(fastify: FastifyInstance): Promise<void> {
  await agentChatRoute(fastify);
  await chatV2Route(fastify);
  await agentTrialStatusRoute(fastify);
  await memoryRoute(fastify);
  // Contract-Based AI Clerk Runtime (β) — /api/agent/contract-chat
  await fastify.register(
    async (scoped) => {
      await contractChatRoute(scoped);
    },
    { prefix: '/api/agent' },
  );
}
