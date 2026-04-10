/**
 * GET /api/tools/<tool>/openapi.json
 *
 * Serves a per-tool OpenAPI 3.1 document for the orchestration layer
 * (Design for Orchestration, 戦略_2026.md Section 7.8.5.1 Requirement 2).
 *
 * Auth: public. The OpenAPI document contains only schema metadata, not
 * any workspace data, so exposing it without authentication lets the
 * future FujiTrace AI 事務員 discover tool contracts without credentials
 * and mirrors how OpenAI / Anthropic publish tool manifests.
 *
 * Factory: `registerToolOpenApiRoute(fastify, { toolName, schemas, ... })`
 * is how 第2弾以降 will register their per-tool endpoint in one line.
 */
import type { FastifyInstance } from 'fastify';
import {
  toolSchemasToOpenApi,
  type ToolSchema,
  type OpenApiConverterOptions,
} from '../../tools/index.js';
import { estimateToolSchemas } from '../../tools/estimate/index.js';

export interface RegisterToolOpenApiRouteOptions {
  /** URL segment, e.g. "estimate" → /api/tools/estimate/openapi.json */
  toolName: string;
  /** ToolSchemas whose paths/operations will be included in the document. */
  schemas: ToolSchema[];
  /** OpenAPI metadata for the generated document. */
  openapi: OpenApiConverterOptions;
}

export function registerToolOpenApiRoute(
  fastify: FastifyInstance,
  options: RegisterToolOpenApiRouteOptions,
): void {
  const route = `/api/tools/${options.toolName}/openapi.json`;
  fastify.get(route, async (_request, reply) => {
    try {
      const doc = toolSchemasToOpenApi(options.schemas, options.openapi);
      return reply
        .code(200)
        .header('content-type', 'application/json; charset=utf-8')
        .send(doc);
    } catch (err) {
      fastify.log.error({ err, route }, 'failed to generate openapi document');
      return reply.code(500).send({
        success: false,
        error: 'Failed to generate OpenAPI document',
      });
    }
  });
}

export default async function toolsOpenApiRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  registerToolOpenApiRoute(fastify, {
    toolName: 'estimate',
    schemas: estimateToolSchemas,
    openapi: {
      title: 'FujiTrace Estimate Tool API',
      version: '1.0.0',
      description:
        'AI見積書ツールの OpenAPI 3.1 契約。FujiTrace AI 事務員(Scaffolded Agent) からの呼び出し用。',
      baseUrl: '/',
    },
  });
}
