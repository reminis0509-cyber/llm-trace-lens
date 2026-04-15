/**
 * FujiTrace Contract-Based Agent — Allowed tools whitelist.
 *
 * This module enforces the Contract constraint of the 柱3 AI 事務員 runtime:
 *   - 入口固定 (fixed intake): chat message + companyInfo
 *   - 中間自由 (free middle): LLM may choose any whitelisted tool
 *   - 出口固定 (fixed output): PDF / structured text + arithmetic review
 *
 * Only the tools listed here may be invoked by the autonomous agent. All
 * other 140+ tools remain available via the traditional card-driven UI but
 * are considered Contract violations when called from the Plan/Execute loop.
 *
 * Extending the whitelist is a deliberate product decision — edits here are
 * the single source of truth for the agent's tool surface.
 */

/** The canonical list of tool IDs that the Contract-Based agent may call. */
export const ALLOWED_AGENT_TOOLS = [
  'estimate.create',
  'estimate.check',
  'accounting.estimate_check',
  'accounting.invoice_create',
  'accounting.invoice_check',
  'accounting.delivery_note_create',
  'accounting.purchase_order_create',
  'general_affairs.cover_letter_create',
] as const;

/** Union type of allowed tool IDs. */
export type AllowedAgentTool = (typeof ALLOWED_AGENT_TOOLS)[number];

/**
 * Metadata describing how the agent should dispatch a whitelisted tool.
 *
 * `estimate.create` and `estimate.check` have dedicated HTTP endpoints while
 * every other tool flows through the archetype-aware
 * `/api/tools/office-task/execute` router.
 */
export interface ToolDispatchSpec {
  /** HTTP method for fastify.inject(). */
  method: 'POST';
  /** Target path for fastify.inject(). */
  path: string;
  /**
   * If true, the payload is wrapped as
   * `{ task_id, instruction, ...archetypeFields }` for office-task-execute.
   * If false, the payload is sent as-is (dedicated routes).
   */
  viaOfficeTask: boolean;
}

/**
 * Resolve the HTTP dispatch target for a whitelisted tool.
 * Returns null for unknown tools.
 */
export function resolveAllowedToolDispatch(
  toolId: string,
): ToolDispatchSpec | null {
  if (!isAllowedAgentTool(toolId)) return null;
  if (toolId === 'estimate.create') {
    return { method: 'POST', path: '/api/tools/estimate/create', viaOfficeTask: false };
  }
  if (toolId === 'estimate.check') {
    return { method: 'POST', path: '/api/tools/estimate/check', viaOfficeTask: false };
  }
  return { method: 'POST', path: '/api/tools/office-task/execute', viaOfficeTask: true };
}

/**
 * Type-narrowing guard: returns true only when `toolId` is on the whitelist.
 * Returns false for every other string (Contract 制約).
 */
export function isAllowedAgentTool(toolId: string): toolId is AllowedAgentTool {
  return (ALLOWED_AGENT_TOOLS as readonly string[]).includes(toolId);
}

/**
 * Thrown when a non-whitelisted tool is reached anywhere in the Plan →
 * Execute → Review loop. The runtime catches this and emits an
 * `error: CONTRACT_VIOLATION` SSE event.
 */
export class ContractViolationError extends Error {
  public readonly attemptedTool: string;

  constructor(attemptedTool: string, message?: string) {
    super(
      message ??
        `Contract violation: tool '${attemptedTool}' is not in the allowed agent whitelist.`,
    );
    this.name = 'ContractViolationError';
    this.attemptedTool = attemptedTool;
  }
}

/**
 * Assertion helper. Throws ContractViolationError when `toolId` is not
 * whitelisted; narrows the type on success.
 */
export function assertAllowedTool(toolId: string): asserts toolId is AllowedAgentTool {
  if (!isAllowedAgentTool(toolId)) {
    throw new ContractViolationError(toolId);
  }
}

/**
 * Human-readable summary of the whitelist for embedding in the Plan-stage
 * system prompt. Lists each tool ID with a one-line Japanese description.
 */
export function describeAllowedToolsForPlanner(): string {
  const descriptions: Record<AllowedAgentTool, string> = {
    'estimate.create': '見積書を作成する（構造化データ + 算術検証）',
    'estimate.check': '既存の見積書内容をチェックする',
    'accounting.estimate_check': '見積書の書類チェック（archetype: document_check）',
    'accounting.invoice_create': '請求書を作成する',
    'accounting.invoice_check': '請求書をチェックする',
    'accounting.delivery_note_create': '納品書を作成する',
    'accounting.purchase_order_create': '発注書を作成する',
    'general_affairs.cover_letter_create': '送付状を作成する',
  };
  return ALLOWED_AGENT_TOOLS.map((id) => `- ${id}: ${descriptions[id]}`).join('\n');
}
