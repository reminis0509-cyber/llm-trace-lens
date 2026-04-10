/**
 * FujiTrace AI Tools — shared types for the Design for Orchestration layer.
 *
 * These types define the contract that every responsible AI tool exposes to
 * the future FujiTrace AI 事務員 (Scaffolded Agent). Concrete tool modules
 * under `src/tools/<tool-name>/` construct `ToolSchema` values from their
 * existing Zod validators via `zodToJsonSchema()`, so there is a single
 * source of truth for request/response shapes.
 *
 * Strategy reference: docs/戦略_2026.md Section 7.8.5.1
 *   Requirement 1: toolSchema export
 *   Requirement 2: OpenAPI endpoint
 *
 * Requirements 3-7 (streaming, idempotency, cost-awareness, capabilities,
 * observability) are deferred to a later phase; `cost` is included as a
 * typed stub so v2 tools can populate it without a schema breaking change.
 */

/**
 * Minimal JSON Schema type. We intentionally do not pull in the full
 * `@types/json-schema` package — a structural alias keeps the barrier to
 * adding new tools low while still preventing accidental `any` usage.
 */
export type JSONSchema = Record<string, unknown>;

/**
 * Estimated cost envelope for invoking a tool. `estimated: 'unknown'` is the
 * safe default for tools that cannot predict cost without executing the LLM
 * call (e.g. variable-length conversations). Deterministic tools can return
 * a concrete JPY amount here once cost-aware routing lands.
 */
export interface ToolCostEstimate {
  estimated: number | 'unknown';
  currency: 'JPY';
}

/**
 * Contract describing a single tool endpoint for the orchestration layer.
 *
 * `Input` and `Output` are retained as phantom type parameters so that
 * downstream generic helpers can narrow types from the same declaration.
 * They are not referenced at runtime; tool authors pass Zod-derived
 * JSON Schemas for `inputSchema` / `outputSchema`.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
export interface ToolSchema<Input = unknown, Output = unknown> {
  /** Machine-readable identifier, e.g. "estimate.create" */
  name: string;
  /** Short Japanese description (30-60 chars) that helps the agent decide when to use the tool. */
  description: string;
  /** Semantic version of the tool contract. */
  version: string;
  /** HTTP method for invoking the tool. */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** HTTP path (relative to server root). */
  path: string;
  /** JSON Schema describing the request body. */
  inputSchema: JSONSchema;
  /** JSON Schema describing the response body. */
  outputSchema: JSONSchema;
  /** Optional cost estimate envelope (stub in Phase 0). */
  cost?: ToolCostEstimate;
  /**
   * Responsibility level for the AI 事務員 agent.
   * - 'high': Financial/legal impact — requires user confirmation before execution,
   *   and double-confirmation when used via adapted match.
   * - 'medium': Moderate impact — standard confirmation flow.
   * - 'low': Informational only — can execute without confirmation.
   */
  responsibilityLevel: 'high' | 'medium' | 'low';
}
/* eslint-enable @typescript-eslint/no-unused-vars */
