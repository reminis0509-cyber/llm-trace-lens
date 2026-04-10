/**
 * Convert a list of `ToolSchema` values into a single OpenAPI 3.1 document.
 *
 * This module has no runtime side-effects and no I/O: given a pure array of
 * tool schemas it returns a fully-formed OpenAPI document object. The route
 * handler (src/routes/tools/openapi.ts) is responsible for serving it.
 *
 * Design notes:
 *   - OpenAPI 3.1 is used because it is fully compatible with JSON Schema
 *     draft 2020-12, which is what `zod-to-json-schema` emits. No Ajv-based
 *     validation is required.
 *   - Each tool's input/output schema is hoisted into `components.schemas`
 *     and referenced via `$ref`, which is the OpenAPI best practice and
 *     keeps `paths` readable for agents.
 *   - The response envelope for FujiTrace endpoints is
 *     `{ success: boolean, data?: T, error?: string }`. We wrap each tool's
 *     output in that envelope in `paths[*].responses["200"]`.
 */
import type { ToolSchema, JSONSchema } from './types.js';

export interface OpenApiConverterOptions {
  title: string;
  version: string;
  /** e.g. "https://fujitrace.jp" — used as the default server entry. */
  baseUrl?: string;
  description?: string;
}

export interface OpenApiDocument {
  openapi: '3.1.0';
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers: Array<{ url: string }>;
  paths: Record<string, Record<string, unknown>>;
  components: {
    schemas: Record<string, JSONSchema>;
  };
}

/**
 * Sanitize a tool name like "estimate.create" into a component schema key
 * like "estimate_create_Input".
 */
function toSchemaKey(toolName: string, suffix: 'Input' | 'Output'): string {
  return `${toolName.replace(/[^a-zA-Z0-9_]/g, '_')}_${suffix}`;
}

export function toolSchemasToOpenApi(
  tools: ToolSchema[],
  options: OpenApiConverterOptions,
): OpenApiDocument {
  const doc: OpenApiDocument = {
    openapi: '3.1.0',
    info: {
      title: options.title,
      version: options.version,
      ...(options.description ? { description: options.description } : {}),
    },
    servers: [{ url: options.baseUrl ?? '/' }],
    paths: {},
    components: { schemas: {} },
  };

  for (const tool of tools) {
    const inputKey = toSchemaKey(tool.name, 'Input');
    const outputKey = toSchemaKey(tool.name, 'Output');

    doc.components.schemas[inputKey] = tool.inputSchema;
    doc.components.schemas[outputKey] = tool.outputSchema;

    const methodLower = tool.method.toLowerCase();
    const operation: Record<string, unknown> = {
      operationId: tool.name,
      summary: tool.description,
      description: tool.description,
      'x-tool-name': tool.name,
      'x-tool-version': tool.version,
      ...(tool.cost ? { 'x-tool-cost': tool.cost } : {}),
      responses: {
        '200': {
          description: 'Success',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['success'],
                properties: {
                  success: { type: 'boolean', const: true },
                  data: { $ref: `#/components/schemas/${outputKey}` },
                },
              },
            },
          },
        },
        '400': { description: 'Bad request' },
        '401': { description: 'Unauthorized' },
        '429': { description: 'Rate limit or quota exceeded' },
        '500': { description: 'Server error' },
      },
    };

    // Body-carrying methods get a requestBody entry.
    if (tool.method !== 'GET' && tool.method !== 'DELETE') {
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/${inputKey}` },
          },
        },
      };
    }

    if (!doc.paths[tool.path]) {
      doc.paths[tool.path] = {};
    }
    doc.paths[tool.path][methodLower] = operation;
  }

  return doc;
}
