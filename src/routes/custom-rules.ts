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
 * ReDoS (Regular Expression Denial of Service) Protection
 * Validates regex patterns for potential catastrophic backtracking
 */
function validateRegexSafety(pattern: string): { safe: boolean; reason?: string } {
  // Maximum pattern length
  const MAX_PATTERN_LENGTH = 500;
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return { safe: false, reason: `Pattern too long (max ${MAX_PATTERN_LENGTH} characters)` };
  }

  // Check for potentially dangerous patterns that can cause catastrophic backtracking
  const dangerousPatterns = [
    // Nested quantifiers: (a+)+ or (a*)*
    /\([^)]*[+*][^)]*\)[+*]/,
    // Overlapping alternations with quantifiers: (a|a)+
    /\([^)]*\|[^)]*\)[+*]/,
    // Multiple consecutive quantifiers: a++, a**
    /[+*?]{2,}/,
    // Backreferences with quantifiers can be slow
    /\\[1-9][+*]/,
    // Very long character classes with quantifiers
    /\[[^\]]{50,}\][+*]/,
  ];

  for (const dangerous of dangerousPatterns) {
    if (dangerous.test(pattern)) {
      return { safe: false, reason: 'Pattern contains potentially dangerous constructs that could cause performance issues' };
    }
  }

  // Count quantifiers - too many can be problematic
  const quantifierCount = (pattern.match(/[+*?]|\{\d/g) || []).length;
  if (quantifierCount > 10) {
    return { safe: false, reason: 'Pattern contains too many quantifiers' };
  }

  // Count nested groups
  let maxDepth = 0;
  let currentDepth = 0;
  for (const char of pattern) {
    if (char === '(') {
      currentDepth++;
      maxDepth = Math.max(maxDepth, currentDepth);
    } else if (char === ')') {
      currentDepth--;
    }
  }
  if (maxDepth > 5) {
    return { safe: false, reason: 'Pattern contains too many nested groups' };
  }

  return { safe: true };
}

/**
 * Execute regex with timeout protection
 */
function safeRegexTest(pattern: string, text: string, timeoutMs: number = 1000): {
  success: boolean;
  result?: RegExpMatchArray | null;
  error?: string;
} {
  // Limit text length to prevent DoS
  const MAX_TEXT_LENGTH = 10000;
  if (text.length > MAX_TEXT_LENGTH) {
    return { success: false, error: `Text too long (max ${MAX_TEXT_LENGTH} characters)` };
  }

  try {
    const regex = new RegExp(pattern);

    // Simple timeout using a flag (Note: This doesn't truly interrupt the regex,
    // but provides a safety check for the pattern validation phase)
    const startTime = Date.now();
    const result = text.match(regex);
    const elapsed = Date.now() - startTime;

    if (elapsed > timeoutMs) {
      console.warn(`[CustomRules] Slow regex detected: ${elapsed}ms for pattern "${pattern}"`);
    }

    return { success: true, result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
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

        // Validate regex syntax
        try {
          new RegExp(pattern);
        } catch (regexError) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid regex pattern syntax'
          });
        }

        // ReDoS protection - check for dangerous patterns
        const safetyCheck = validateRegexSafety(pattern);
        if (!safetyCheck.safe) {
          return reply.code(400).send({
            success: false,
            error: `Unsafe regex pattern: ${safetyCheck.reason}`
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

        // Validate regex syntax
        try {
          new RegExp(pattern);
        } catch (regexError) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid regex pattern syntax'
          });
        }

        // ReDoS protection
        const safetyCheck = validateRegexSafety(pattern);
        if (!safetyCheck.safe) {
          return reply.code(400).send({
            success: false,
            error: `Unsafe regex pattern: ${safetyCheck.reason}`
          });
        }

        // Execute with timeout protection
        const result = safeRegexTest(pattern, text);
        if (!result.success) {
          return reply.code(400).send({
            success: false,
            error: result.error
          });
        }

        const matches = result.result;
        const isMatch = matches !== null && matches !== undefined;
        const matchArray = matches || [];

        return reply.send({
          success: true,
          pattern,
          text,
          matched: isMatch,
          matches: matchArray,
          message: isMatch
            ? `Pattern matched ${matchArray.length} time(s)`
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

        // Limit text length for scan endpoint
        const MAX_SCAN_TEXT_LENGTH = 10000;
        if (text.length > MAX_SCAN_TEXT_LENGTH) {
          return reply.code(400).send({
            success: false,
            error: `Text too long for scanning (max ${MAX_SCAN_TEXT_LENGTH} characters)`
          });
        }

        for (const pattern of patterns) {
          // Use safe regex execution
          const result = safeRegexTest(pattern, text);

          if (result.success) {
            const matches = result.result;
            const matched = matches !== null;

            if (matched) {
              hasMatch = true;
            }

            results.push({
              pattern,
              matched,
              matches: matches || []
            });
          } else {
            // Skip patterns that fail safety checks or execution
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
