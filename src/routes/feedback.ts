import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  saveFeedback,
  getFeedback,
  getFeedbackByTrace,
  getWorkspaceFeedback,
  getFeedbackStats,
  getWorkspaceTraces,
  getWorkspaceFromApiKey,
} from '../kv/client.js';
import type { TraceFeedback } from '../storage/models.js';

/**
 * Feedback routes for trace validation feedback collection
 * Enables false positive/negative tracking and analytics
 */
export async function feedbackRoutes(fastify: FastifyInstance): Promise<void> {
  // Workspace authentication hook - only for /feedback/* and /traces/*/feedback routes
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Only apply auth to feedback-related routes
    const isFeedbackRoute = request.url.startsWith('/feedback') ||
                           (request.url.startsWith('/traces/') && request.url.includes('/feedback'));
    if (!isFeedbackRoute) {
      return;
    }

    if (request.method === 'OPTIONS') {
      return;
    }

    const apiKey = request.headers['x-api-key'] as string | undefined;
    if (!apiKey) {
      return reply.code(401).send({ error: 'Missing x-api-key header' });
    }

    const workspaceId = await getWorkspaceFromApiKey(apiKey);
    if (!workspaceId) {
      return reply.code(401).send({ error: 'Invalid API key' });
    }

    // Attach workspaceId to request
    (request as any).workspaceId = workspaceId;
  });

  /**
   * POST /traces/:id/feedback
   * Submit feedback for a specific trace
   */
  fastify.post('/traces/:id/feedback', async (
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        feedbackType: 'false_positive' | 'false_negative' | 'correct';
        reason?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    const { id: traceId } = request.params;
    const { feedbackType, reason } = request.body;
    const workspaceId = (request as any).workspaceId;

    // Validate feedbackType
    const validTypes = ['false_positive', 'false_negative', 'correct'];
    if (!validTypes.includes(feedbackType)) {
      return reply.code(400).send({
        error: `Invalid feedbackType. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    try {
      const feedback: TraceFeedback = {
        id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        traceId,
        workspaceId,
        feedbackType,
        reason,
        createdAt: new Date(),
      };

      await saveFeedback(feedback);

      return reply.send({
        success: true,
        feedback: {
          id: feedback.id,
          traceId: feedback.traceId,
          feedbackType: feedback.feedbackType,
          createdAt: feedback.createdAt,
        },
      });
    } catch (error) {
      console.error('Failed to save feedback:', error);
      return reply.code(500).send({
        error: 'Failed to save feedback',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /traces/:id/feedback
   * Get all feedback for a specific trace
   */
  fastify.get('/traces/:id/feedback', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id: traceId } = request.params;

    try {
      const feedbacks = await getFeedbackByTrace(traceId);
      return reply.send({
        success: true,
        traceId,
        feedbacks,
      });
    } catch (error) {
      console.error('Failed to get feedback:', error);
      return reply.code(500).send({
        error: 'Failed to retrieve feedback',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /feedback/stats
   * Get feedback statistics for the workspace
   */
  fastify.get('/feedback/stats', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const workspaceId = (request as any).workspaceId;

    try {
      const stats = await getFeedbackStats(workspaceId);
      return reply.send({
        success: true,
        workspaceId,
        stats,
      });
    } catch (error) {
      console.error('Failed to get feedback stats:', error);
      return reply.code(500).send({
        error: 'Failed to retrieve feedback statistics',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /feedback/list
   * Get all feedback for the workspace with pagination
   */
  fastify.get('/feedback/list', async (
    request: FastifyRequest<{
      Querystring: { limit?: string; offset?: string };
    }>,
    reply: FastifyReply
  ) => {
    const workspaceId = (request as any).workspaceId;
    const limit = parseInt(request.query.limit || '50', 10);
    const offset = parseInt(request.query.offset || '0', 10);

    try {
      const feedbacks = await getWorkspaceFeedback(workspaceId, limit, offset);
      return reply.send({
        success: true,
        workspaceId,
        feedbacks,
        pagination: {
          limit,
          offset,
          count: feedbacks.length,
        },
      });
    } catch (error) {
      console.error('Failed to get feedback list:', error);
      return reply.code(500).send({
        error: 'Failed to retrieve feedback list',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /feedback/patterns
   * Analyze feedback patterns to identify common false positives/negatives
   */
  fastify.get('/feedback/patterns', async (
    request: FastifyRequest<{
      Querystring: { type?: 'false_positive' | 'false_negative'; limit?: string };
    }>,
    reply: FastifyReply
  ) => {
    const workspaceId = (request as any).workspaceId;
    const feedbackType = request.query.type || 'false_positive';
    const limit = parseInt(request.query.limit || '100', 10);

    try {
      // Get all feedback of the specified type
      const allFeedback = await getWorkspaceFeedback(workspaceId, 1000);
      const filteredFeedback = allFeedback.filter(f => f.feedbackType === feedbackType);

      // Get traces for pattern analysis
      const traces = await getWorkspaceTraces(workspaceId, limit);

      // Find traces that have feedback
      const feedbackTraceIds = new Set(filteredFeedback.map(f => f.traceId));
      const matchedTraces = traces.filter(t => feedbackTraceIds.has(t.requestId as string));

      // Extract common keywords from reasons
      const reasonKeywords: Record<string, number> = {};
      filteredFeedback.forEach(f => {
        if (f.reason) {
          const words = f.reason.toLowerCase().match(/\b\w{3,}\b/g) || [];
          words.forEach(word => {
            reasonKeywords[word] = (reasonKeywords[word] || 0) + 1;
          });
        }
      });

      // Top patterns
      const topPatterns = Object.entries(reasonKeywords)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word, count]) => ({ word, count }));

      return reply.send({
        success: true,
        feedbackType,
        totalFeedback: filteredFeedback.length,
        topPatterns,
        recentExamples: filteredFeedback.slice(0, 5).map(f => ({
          traceId: f.traceId,
          reason: f.reason,
          createdAt: f.createdAt,
        })),
      });
    } catch (error) {
      console.error('Failed to analyze feedback patterns:', error);
      return reply.code(500).send({
        error: 'Failed to analyze feedback patterns',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /feedback/:id
   * Get a specific feedback by ID
   */
  fastify.get('/feedback/:id', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;

    try {
      const feedback = await getFeedback(id);
      if (!feedback) {
        return reply.code(404).send({ error: 'Feedback not found' });
      }

      return reply.send({
        success: true,
        feedback,
      });
    } catch (error) {
      console.error('Failed to get feedback:', error);
      return reply.code(500).send({
        error: 'Failed to retrieve feedback',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}

export default feedbackRoutes;
