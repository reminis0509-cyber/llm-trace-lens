/**
 * custom-mcp.ts — Custom MCP server connector.
 *
 * Actions:
 *   - invoke : { serverId, tool, params }
 *
 * Unlike the other connectors in this directory, custom-mcp does not bind
 * to a single external service. It looks up the user-registered MCP server
 * row in `custom_mcp_servers`, decrypts the auth header, and forwards the
 * tool call as a generic JSON POST. The MCP server itself must implement
 * an HTTP endpoint that accepts `{ tool, params }` and returns JSON.
 *
 * Store shape (migration 017):
 *   custom_mcp_servers(id, user_id, name, url, auth_header_encrypted,
 *                      enabled, created_at)
 */
import { getKnex } from '../storage/knex-client.js';
import { decryptToken } from '../lib/token-crypto.js';
import { assertPublicUrl } from '../lib/url-safety.js';
import type { Connector, ConnectorActionResult } from './base.js';
import { connectorOk, connectorErr } from './base.js';

const ACTIONS = ['invoke'] as const;
type McpAction = (typeof ACTIONS)[number];
function isMcpAction(v: string): v is McpAction {
  return (ACTIONS as readonly string[]).includes(v);
}

interface InvokeParams {
  serverId: string;
  tool: string;
  params?: Record<string, unknown>;
}
function isInvokeParams(v: unknown): v is InvokeParams {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.serverId === 'string' &&
    typeof o.tool === 'string' &&
    (o.params === undefined || (typeof o.params === 'object' && o.params !== null))
  );
}

interface CustomMcpRow {
  id: string;
  user_id: string;
  name: string;
  url: string;
  auth_header_encrypted: string | null;
  enabled: number | boolean;
  created_at: string;
}

export const customMcpConnector: Connector = {
  provider: 'custom_mcp',
  requiredScopes: [],

  async isConnected(userId: string): Promise<boolean> {
    try {
      const db = getKnex();
      const row = await db('custom_mcp_servers')
        .where({ user_id: userId })
        .andWhere((b) => b.where('enabled', true).orWhere('enabled', 1))
        .first();
      return Boolean(row);
    } catch {
      return false;
    }
  },

  async execute(userId, action, params): Promise<ConnectorActionResult> {
    if (!isMcpAction(action)) {
      return connectorErr(`Unknown custom_mcp action: ${action}`, 'unknown_action');
    }
    if (!isInvokeParams(params)) {
      return connectorErr('invoke: serverId/tool required', 'invalid_params');
    }
    try {
      const db = getKnex();
      const row = (await db('custom_mcp_servers')
        .where({ id: params.serverId, user_id: userId })
        .first()) as CustomMcpRow | undefined;
      if (!row) {
        return connectorErr('custom_mcp server not found', 'not_connected');
      }
      if (!(row.enabled === true || row.enabled === 1)) {
        return connectorErr('custom_mcp server is disabled', 'not_connected');
      }

      // Defense-in-depth: even if the row somehow bypassed route-level
      // validation (old migration, direct DB write), refuse to hit a
      // private/loopback/non-http endpoint at execute time.
      try {
        assertPublicUrl(row.url);
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'blocked url';
        return connectorErr(`mcp url blocked: ${reason}`, 'invalid_params');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'FujiTrace-AI-Employee/CustomMCP',
      };
      if (row.auth_header_encrypted) {
        try {
          const authHeader = decryptToken(row.auth_header_encrypted);
          headers['Authorization'] = authHeader;
        } catch {
          return connectorErr('auth header decryption failed', 'provider_error');
        }
      }

      const res = await fetch(row.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tool: params.tool, params: params.params ?? {} }),
      });
      let json: unknown = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }
      if (res.status < 200 || res.status >= 300) {
        return connectorErr(`mcp error ${res.status}`, 'provider_error');
      }
      return connectorOk({ mcpResult: json });
    } catch (err) {
      return connectorErr(formatError(err), 'provider_error');
    }
  },
};

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
