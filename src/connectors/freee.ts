/**
 * freee.ts — freee accounting connector (read-only先行).
 *
 * Actions:
 *   - listDeals    : { limit?, companyId? }
 *   - listPartners : { limit?, companyId? }
 *
 * Auth: OAuth2 (authorization_code grant). The token exchange is handled
 * by the generic oauth flow; we only consume the stored access_token here.
 *
 * Required scope: `read` (freee has a unified read scope).
 */
import {
  loadConnectorToken,
  isConnectorLinked,
} from '../auth/oauth/oauth-flow.js';
import type { Connector, ConnectorActionResult } from './base.js';
import { connectorOk, connectorErr } from './base.js';

export const FREEE_SCOPES = ['read'] as const;

const ACTIONS = ['listDeals', 'listPartners'] as const;
type FreeeAction = (typeof ACTIONS)[number];
function isFreeeAction(v: string): v is FreeeAction {
  return (ACTIONS as readonly string[]).includes(v);
}

interface ListParams {
  limit?: number;
  companyId?: number | string;
}

function isListParams(v: unknown): v is ListParams {
  if (v === undefined || v === null) return true;
  if (typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (o.limit !== undefined && typeof o.limit !== 'number') return false;
  if (o.companyId !== undefined && typeof o.companyId !== 'number' && typeof o.companyId !== 'string') return false;
  return true;
}

async function freeeCall(
  token: string,
  path: string,
): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`https://api.freee.co.jp${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

export const freeeConnector: Connector = {
  provider: 'freee',
  requiredScopes: FREEE_SCOPES,

  async isConnected(userId: string): Promise<boolean> {
    return isConnectorLinked(userId, 'freee');
  },

  async execute(userId, action, params): Promise<ConnectorActionResult> {
    if (!isFreeeAction(action)) {
      return connectorErr(`Unknown freee action: ${action}`, 'unknown_action');
    }
    if (!isListParams(params)) {
      return connectorErr('invalid params', 'invalid_params');
    }
    const bundle = await loadConnectorToken(userId, 'freee');
    if (!bundle) {
      return connectorErr('freee is not connected for this user', 'not_connected');
    }

    try {
      const limit = Math.max(1, Math.min(100, params?.limit ?? 50));
      const companyQS = params?.companyId ? `&company_id=${encodeURIComponent(String(params.companyId))}` : '';
      if (action === 'listDeals') {
        const { status, json } = await freeeCall(
          bundle.accessToken,
          `/api/1/deals?limit=${limit}${companyQS}`,
        );
        if (status < 200 || status >= 300) {
          return connectorErr(`freee error ${status}`, 'provider_error');
        }
        return connectorOk({ deals: json });
      }
      if (action === 'listPartners') {
        const { status, json } = await freeeCall(
          bundle.accessToken,
          `/api/1/partners?limit=${limit}${companyQS}`,
        );
        if (status < 200 || status >= 300) {
          return connectorErr(`freee error ${status}`, 'provider_error');
        }
        return connectorOk({ partners: json });
      }
      return connectorErr(`Unhandled freee action: ${action as string}`, 'unknown_action');
    } catch (err) {
      return connectorErr(formatError(err), 'provider_error');
    }
  },
};

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
