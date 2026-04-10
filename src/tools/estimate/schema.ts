/**
 * ToolSchema declarations for the AI 見積書 ツール (第1弾).
 *
 * These are built from the EXISTING Zod validators in
 * `src/routes/tools/estimate-create.ts` and `estimate-check.ts` via
 * `zodToJsonSchema()`. There is intentionally no hand-written JSON Schema
 * here: the routes' Zod validators are the single source of truth, so the
 * agent-facing contract can never drift from the HTTP validation layer.
 *
 * Strategy reference: docs/戦略_2026.md Section 7.8.5.1 (Design for
 * Orchestration — Requirement 1: toolSchema export).
 *
 * Adding a new tool (第2弾 AI 請求書チェッカー etc.):
 *   1. Export the Zod request schema from the route file.
 *   2. Define a sibling `<tool>/schema.ts` mirroring this file.
 *   3. Register it in `src/tools/index.ts`.
 *   4. Register the OpenAPI endpoint in `src/routes/tools/openapi.ts`.
 *   Total time budget: ~30 minutes.
 */
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ToolSchema, JSONSchema } from '../types.js';
import { estimateCreateRequestSchema } from '../../routes/tools/estimate-create.js';
import {
  estimateCheckRequestSchema,
  estimateSchema,
} from '../../routes/tools/estimate-check.js';

/**
 * Local Zod mirrors of the response shapes. The route handlers return
 * these bodies today but do not validate them with Zod (they are built
 * from typed interfaces in src/types/ai-tools.ts). Declaring them here in
 * Zod lets us run them through the same zodToJsonSchema pipeline so the
 * OpenAPI document carries a real output contract instead of `any`.
 *
 * Keep these aligned with the JSDoc contracts in
 * src/routes/tools/estimate-create.ts and estimate-check.ts.
 */
const checkIssueSchema = z.object({
  field: z.string(),
  severity: z.enum(['error', 'warning', 'info']),
  message: z.string(),
});

const checkResultSchema = z.object({
  status: z.enum(['ok', 'warning', 'error']),
  critical_issues: z.array(checkIssueSchema),
  warnings: z.array(checkIssueSchema),
  suggestions: z.array(z.string()),
  responsibility_notice: z.string(),
});

const arithmeticCheckSchema = z.object({
  ok: z.boolean(),
  issues: z.array(
    z.object({
      field: z.string(),
      severity: z.literal('error'),
      message: z.string(),
    }),
  ),
});

const verificationPayloadSchema = checkResultSchema.extend({
  arithmetic_check: arithmeticCheckSchema,
  trace_id: z.string().nullable(),
  reason: z.string().optional(),
});

const estimateCreateResponseSchema = z.object({
  estimate: estimateSchema.nullable(),
  next_question: z.string().nullable(),
  trace_id: z.string().nullable(),
  verification: verificationPayloadSchema.optional(),
});

const estimateCheckResponseSchema = z.object({
  check_result: checkResultSchema,
  trace_id: z.string().nullable(),
});

function toJson(schema: z.ZodTypeAny, name: string): JSONSchema {
  // `target: 'openApi3'` emits draft-compatible JSON Schema without the
  // `$schema` meta field so it drops cleanly into components.schemas.
  return zodToJsonSchema(schema, { name, target: 'openApi3' }) as JSONSchema;
}

export const estimateCreateToolSchema: ToolSchema = {
  name: 'estimate.create',
  description:
    '事業情報とユーザーとの対話履歴から日本語の見積書ドラフトを生成し、自動検証結果を返します。',
  version: '1.0.0',
  method: 'POST',
  path: '/api/tools/estimate/create',
  inputSchema: toJson(estimateCreateRequestSchema, 'EstimateCreateRequest'),
  outputSchema: toJson(estimateCreateResponseSchema, 'EstimateCreateResponse'),
  cost: { estimated: 'unknown', currency: 'JPY' },
  responsibilityLevel: 'high',
};

export const estimateCheckToolSchema: ToolSchema = {
  name: 'estimate.check',
  description:
    '既存の見積書データをLLMと算術ルールで検証し、致命的な問題・警告・改善提案を返します。',
  version: '1.0.0',
  method: 'POST',
  path: '/api/tools/estimate/check',
  inputSchema: toJson(estimateCheckRequestSchema, 'EstimateCheckRequest'),
  outputSchema: toJson(estimateCheckResponseSchema, 'EstimateCheckResponse'),
  cost: { estimated: 'unknown', currency: 'JPY' },
  responsibilityLevel: 'high',
};

export const estimateToolSchemas: ToolSchema[] = [
  estimateCreateToolSchema,
  estimateCheckToolSchema,
];
