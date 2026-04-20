/**
 * base.ts — Connector interface for the AI Employee Connector layer.
 *
 * A Connector represents one external service (Google Calendar, Gmail,
 * Chatwork, etc.). The Runtime layer calls `Connector.execute()` during
 * plan step execution; the routing from LLM tool-call to Connector is
 * handled by the registry.
 *
 * This file intentionally contains NO provider-specific code.
 */
import type { ConnectorProvider } from '../auth/oauth/oauth-flow.js';

/**
 * All connectors implement the same shape. `params` is declared `unknown`
 * so each concrete connector can narrow it with a zod schema or type guard
 * at the top of its `execute()` implementation — we never trust LLM output
 * to match a TS interface.
 */
export interface Connector {
  readonly provider: ConnectorProvider;
  readonly requiredScopes: readonly string[];

  /**
   * True iff the user has completed OAuth for this provider.
   */
  isConnected(userId: string): Promise<boolean>;

  /**
   * Execute a named action on behalf of the user.
   *
   * Implementations MUST:
   *   - Validate `action` against their allow-list (return a 400-shaped
   *     error, not throw, for unknown actions).
   *   - Narrow `params` to a known shape before use.
   *   - Never return raw provider errors to the caller; wrap them.
   */
  execute(userId: string, action: string, params: unknown): Promise<ConnectorActionResult>;
}

/**
 * Uniform result envelope returned by `Connector.execute()`. Success and
 * failure share the same shape so the Runtime layer can branch cheaply.
 */
export type ConnectorActionResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string; code?: ConnectorErrorCode };

export type ConnectorErrorCode =
  | 'not_connected'
  | 'unknown_action'
  | 'invalid_params'
  | 'provider_error'
  | 'not_implemented';

/**
 * Helper to build a successful result.
 */
export function connectorOk(data: unknown): ConnectorActionResult {
  return { ok: true, data };
}

/**
 * Helper to build a failed result.
 */
export function connectorErr(
  error: string,
  code: ConnectorErrorCode = 'provider_error',
): ConnectorActionResult {
  return { ok: false, error, code };
}
