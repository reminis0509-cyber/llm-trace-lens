/**
 * GET /api/agent/trial-status
 *
 * Returns the current trial status for the authenticated workspace.
 *
 * Response (200):
 *   {
 *     success: true,
 *     trialInfo: { used, limit, remaining, isTrialExhausted },
 *     isAdmin?: true
 *   }
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { resolveWorkspaceId } from '../tools/_shared.js';
import { getTrialStatus, AGENT_FREE_TRIAL_LIMIT } from '../../agent/trial.js';

export default async function agentTrialStatusRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/agent/trial-status', async (request: FastifyRequest, reply) => {
    try {
      const workspaceId = await resolveWorkspaceId(request);
      if (!workspaceId) {
        return reply.code(401).send({ success: false, error: '認証が必要です' });
      }

      const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
      const userEmail = (request.user?.email || '').toLowerCase();
      if (userEmail !== '' && adminEmails.includes(userEmail)) {
        return reply.code(200).send({
          success: true,
          trialInfo: {
            used: 0,
            limit: AGENT_FREE_TRIAL_LIMIT,
            remaining: AGENT_FREE_TRIAL_LIMIT,
            isTrialExhausted: false,
          },
          isAdmin: true,
        });
      }

      const trialInfo = await getTrialStatus(workspaceId);
      return reply.code(200).send({ success: true, trialInfo });
    } catch (error: unknown) {
      request.log.error(error, 'Agent trial-status error');
      return reply.code(500).send({
        success: false,
        error: '内部エラーが発生しました。しばらくしてからお試しください。',
      });
    }
  });
}
