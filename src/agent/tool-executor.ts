/**
 * Shared helper for dispatching whitelisted tool calls via fastify.inject().
 *
 * Extracted from `src/agent/clerk.ts` (which keeps its own copy for binary
 * compatibility) so both the legacy single-turn clerk and the new
 * Contract-Based agent runtime can share identical HTTP semantics.
 */
import type { FastifyInstance } from 'fastify';
import { INTERNAL_SECRET } from '../routes/tools/_shared.js';

export interface ToolInjectResult {
  statusCode: number;
  body: unknown;
}

/**
 * POST/GET a whitelisted tool endpoint over fastify.inject().
 * The per-process internal secret authorises the `x-workspace-id` header so
 * that external callers cannot spoof workspace identity (see `_shared.ts`).
 */
export async function executeToolViaInject(
  fastify: FastifyInstance,
  toolPath: string,
  toolMethod: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  params: unknown,
  workspaceId: string,
): Promise<ToolInjectResult> {
  const injectResponse = await fastify.inject({
    method: toolMethod,
    url: toolPath,
    headers: {
      'content-type': 'application/json',
      'x-workspace-id': workspaceId,
      'x-internal-secret': INTERNAL_SECRET,
    },
    payload: params as Record<string, unknown>,
  });

  let body: unknown;
  try {
    body = JSON.parse(injectResponse.body);
  } catch {
    body = injectResponse.body;
  }
  return { statusCode: injectResponse.statusCode, body };
}
