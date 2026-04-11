/**
 * FujiTrace AI 事務員 — Tool matcher.
 *
 * Converts registered ToolSchema entries into OpenAI function-calling format
 * and provides resolution helpers for mapping LLM-returned function names
 * back to their ToolSchema definitions.
 */
import type { ToolSchema } from '../tools/types.js';

export interface MatchResult {
  type: 'exact' | 'adapted' | 'none';
  tool?: ToolSchema;
  adaptedFrom?: string;
  confidence: number;
  adaptationNote?: string;
}

interface FunctionDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface FunctionCallingTool {
  type: 'function';
  function: FunctionDefinition;
}

/**
 * Convert a ToolSchema name (e.g. "estimate.create") to a valid OpenAI
 * function name (e.g. "estimate_create"). OpenAI function names must match
 * `^[a-zA-Z0-9_-]+$`.
 */
function toFunctionName(schemaName: string): string {
  return schemaName.replace(/\./g, '_');
}

/**
 * Build the OpenAI function-calling `tools` array from registered ToolSchema entries.
 *
 * Includes:
 * - One function per registered tool
 * - `_adapt_tool` — meta-function for the agent to signal an adapted match
 * - `_log_feature_request` — meta-function for logging unmatched requests
 */
let cachedFunctionCallingTools: FunctionCallingTool[] | null = null;

export function buildFunctionCallingTools(schemas: ToolSchema[]): FunctionCallingTool[] {
  if (cachedFunctionCallingTools) return cachedFunctionCallingTools;

  // OpenAI limits function calling to 128 tools.
  // Filter out forbidden tools (they get rejected at execution anyway)
  // and cap at 124 to leave room for meta-functions.
  const MAX_TOOLS = 124;
  const allowedSchemas = schemas
    .filter((s) => !s.description.startsWith('[対応不可'))
    .slice(0, MAX_TOOLS);

  const toolFunctions: FunctionCallingTool[] = allowedSchemas.map((schema) => ({
    type: 'function' as const,
    function: {
      name: toFunctionName(schema.name),
      description: `${schema.description} [responsibility: ${schema.responsibilityLevel}]`,
      parameters: sanitizeSchema(schema.inputSchema),
    },
  }));

  // Meta-function: adapted tool invocation
  const adaptTool: FunctionCallingTool = {
    type: 'function',
    function: {
      name: '_adapt_tool',
      description:
        '既存ツールを応用して依頼に対応する場合に呼び出します。base_tool に応用元のツール名を指定してください。',
      parameters: {
        type: 'object',
        properties: {
          base_tool: {
            type: 'string',
            description: '応用元のツール名（例: estimate_create）',
          },
          adaptation_reason: {
            type: 'string',
            description: 'なぜこのツールを応用できるか、簡潔な説明',
          },
          adapted_params: {
            type: 'object',
            description: '応用元ツールに渡すパラメータ（ツールのinputSchemaに準拠）',
          },
        },
        required: ['base_tool', 'adaptation_reason', 'adapted_params'],
        additionalProperties: false,
      },
    },
  };

  // Meta-function: feature request logging
  const logFeatureRequest: FunctionCallingTool = {
    type: 'function',
    function: {
      name: '_log_feature_request',
      description:
        '対応可能なツールがなく、応用もできない場合に呼び出します。ユーザーの依頼内容を記録します。',
      parameters: {
        type: 'object',
        properties: {
          user_request_summary: {
            type: 'string',
            description: 'ユーザーの依頼内容の要約',
          },
          suggested_tool_category: {
            type: 'string',
            description: '将来作るべきツールのカテゴリ（任意）',
          },
        },
        required: ['user_request_summary'],
        additionalProperties: false,
      },
    },
  };

  cachedFunctionCallingTools = [...toolFunctions, adaptTool, logFeatureRequest];
  return cachedFunctionCallingTools;
}

/**
 * Resolve an OpenAI function name back to its ToolSchema.
 * Returns undefined for meta-functions (_adapt_tool, _log_feature_request)
 * and unknown function names.
 */
export function resolveToolName(
  functionName: string,
  schemas: ToolSchema[],
): ToolSchema | undefined {
  return schemas.find((s) => toFunctionName(s.name) === functionName);
}

/**
 * Sanitize a JSON Schema for OpenAI function calling.
 * OpenAI expects a plain object schema without top-level `$schema` or `$ref` wrappers.
 * zodToJsonSchema sometimes wraps in { definitions: ..., $ref: ... } format.
 */
function sanitizeSchema(schema: Record<string, unknown>): Record<string, unknown> {
  // If the schema has a top-level $ref, resolve it from definitions
  if (typeof schema['$ref'] === 'string' && schema['definitions']) {
    const refPath = (schema['$ref'] as string).replace('#/definitions/', '');
    const definitions = schema['definitions'] as Record<string, unknown>;
    const resolved = definitions[refPath];
    if (resolved && typeof resolved === 'object') {
      return resolved as Record<string, unknown>;
    }
  }
  // Return as-is if already a direct object schema
  return schema;
}
