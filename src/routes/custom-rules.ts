import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getCustomPatterns,
  addCustomPattern,
  removeCustomPattern,
  getWorkspaceFromApiKey
} from '../kv/client.js';

interface AddPatternBody {
  pattern: string;
}

interface PatternParams {
  pattern: string;
}

interface TestPatternBody {
  pattern: string;
  text: string;
}

/**
 * Get workspace ID from request (API key or default)
 */
async function getWorkspaceIdFromRequest(request: FastifyRequest): Promise<string> {
  const apiKey = request.headers['x-api-key'] as string | undefined;
  if (apiKey) {
    const workspaceId = await getWorkspaceFromApiKey(apiKey);
    return workspaceId || 'default';
  }
  return 'default';
}

/**
 * Custom validation rules routes
 * Allows workspaces to define their own blocked word patterns
 */
export default async function customRulesRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /custom-rules
   * Get all custom validation patterns for the workspace
   */
  fastify.get('/custom-rules', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const workspaceId = await getWorkspaceIdFromRequest(request);
      const patterns = await getCustomPatterns(workspaceId);

      return reply.send({
        success: true,
        workspace_id: workspaceId,
        patterns,
        count: patterns.length
      });
    } catch (error) {
      console.error('Failed to get custom patterns:', error);
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /custom-rules
   * Add a new custom validation pattern
   */
  fastify.post<{ Body: AddPatternBody }>(
    '/custom-rules',
    async (request: FastifyRequest<{ Body: AddPatternBody }>, reply: FastifyReply) => {
      try {
        const { pattern } = request.body;

        if (!pattern || typeof pattern !== 'string') {
          return reply.code(400).send({
            success: false,
            error: 'Pattern is required and must be a string'
          });
        }

        // Validate regex pattern
        try {
          new RegExp(pattern);
        } catch (regexError) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid regex pattern'
          });
        }

        const workspaceId = await getWorkspaceIdFromRequest(request);
        await addCustomPattern(workspaceId, pattern);

        return reply.send({
          success: true,
          workspace_id: workspaceId,
          pattern,
          message: 'Pattern added successfully'
        });
      } catch (error) {
        console.error('Failed to add custom pattern:', error);
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * DELETE /custom-rules/:pattern
   * Remove a custom validation pattern
   */
  fastify.delete<{ Params: PatternParams }>(
    '/custom-rules/:pattern',
    async (request: FastifyRequest<{ Params: PatternParams }>, reply: FastifyReply) => {
      try {
        const { pattern } = request.params;

        if (!pattern) {
          return reply.code(400).send({
            success: false,
            error: 'Pattern is required'
          });
        }

        const decodedPattern = decodeURIComponent(pattern);
        const workspaceId = await getWorkspaceIdFromRequest(request);
        await removeCustomPattern(workspaceId, decodedPattern);

        return reply.send({
          success: true,
          workspace_id: workspaceId,
          pattern: decodedPattern,
          message: 'Pattern removed successfully'
        });
      } catch (error) {
        console.error('Failed to remove custom pattern:', error);
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * POST /custom-rules/test
   * Test a pattern against sample text
   */
  fastify.post<{ Body: TestPatternBody }>(
    '/custom-rules/test',
    async (request: FastifyRequest<{ Body: TestPatternBody }>, reply: FastifyReply) => {
      try {
        const { pattern, text } = request.body;

        if (!pattern || typeof pattern !== 'string') {
          return reply.code(400).send({
            success: false,
            error: 'Pattern is required and must be a string'
          });
        }

        if (!text || typeof text !== 'string') {
          return reply.code(400).send({
            success: false,
            error: 'Text is required and must be a string'
          });
        }

        // Validate regex pattern
        let regex: RegExp;
        try {
          regex = new RegExp(pattern);
        } catch (regexError) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid regex pattern'
          });
        }

        const matches = text.match(regex);
        const isMatch = matches !== null;

        return reply.send({
          success: true,
          pattern,
          text,
          matched: isMatch,
          matches: matches || [],
          message: isMatch
            ? `Pattern matched ${matches.length} time(s)`
            : 'Pattern did not match'
        });
      } catch (error) {
        console.error('Failed to test pattern:', error);
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * POST /custom-rules/scan
   * Scan text against all workspace patterns
   */
  fastify.post<{ Body: { text: string } }>(
    '/custom-rules/scan',
    async (request: FastifyRequest<{ Body: { text: string } }>, reply: FastifyReply) => {
      try {
        const { text } = request.body;

        if (!text || typeof text !== 'string') {
          return reply.code(400).send({
            success: false,
            error: 'Text is required and must be a string'
          });
        }

        const workspaceId = await getWorkspaceIdFromRequest(request);
        const patterns = await getCustomPatterns(workspaceId);

        const results: Array<{
          pattern: string;
          matched: boolean;
          matches: string[];
        }> = [];

        let hasMatch = false;

        for (const pattern of patterns) {
          try {
            const regex = new RegExp(pattern);
            const matches = text.match(regex);
            const matched = matches !== null;

            if (matched) {
              hasMatch = true;
            }

            results.push({
              pattern,
              matched,
              matches: matches || []
            });
          } catch (error) {
            // Skip invalid patterns
            results.push({
              pattern,
              matched: false,
              matches: []
            });
          }
        }

        return reply.send({
          success: true,
          workspace_id: workspaceId,
          text,
          risk: hasMatch ? 'high' : 'low',
          patterns_checked: patterns.length,
          patterns_matched: results.filter(r => r.matched).length,
          results
        });
      } catch (error) {
        console.error('Failed to scan text:', error);
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );
}
