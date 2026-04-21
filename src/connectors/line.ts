/**
 * line.ts — LINE Messaging API connector.
 *
 * Actions:
 *   - pushMessage : { to, text }   (webhook + send)
 *
 * Auth: LINE Messaging API uses a Channel access token (long-lived). We
 * store it in `connector_tokens.access_token` (API-key style, no OAuth
 * refresh). If no token is stored, pushMessage returns `not_connected`.
 *
 * Stub behaviour: when `LINE_ALLOW_STUB=1` env is set and the user has no
 * token, we return connectorOk({ stub: true }) so builds pass without real
 * credentials (spec permission).
 */
import {
  loadConnectorToken,
  isConnectorLinked,
} from '../auth/oauth/oauth-flow.js';
import type { Connector, ConnectorActionResult } from './base.js';
import { connectorOk, connectorErr } from './base.js';

export const LINE_SCOPES = [] as const;

const ACTIONS = ['pushMessage'] as const;
type LineAction = (typeof ACTIONS)[number];
function isLineAction(v: string): v is LineAction {
  return (ACTIONS as readonly string[]).includes(v);
}

interface PushMessageParams {
  to: string;
  text: string;
}
function isPushMessageParams(v: unknown): v is PushMessageParams {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.to === 'string' &&
    o.to.length > 0 &&
    typeof o.text === 'string' &&
    o.text.length > 0
  );
}

export const lineConnector: Connector = {
  provider: 'line',
  requiredScopes: LINE_SCOPES,

  async isConnected(userId: string): Promise<boolean> {
    return isConnectorLinked(userId, 'line');
  },

  async execute(userId, action, params): Promise<ConnectorActionResult> {
    if (!isLineAction(action)) {
      return connectorErr(`Unknown line action: ${action}`, 'unknown_action');
    }
    if (!isPushMessageParams(params)) {
      return connectorErr('pushMessage: to/text required', 'invalid_params');
    }

    const bundle = await loadConnectorToken(userId, 'line');
    if (!bundle) {
      if (process.env.LINE_ALLOW_STUB === '1') {
        return connectorOk({ stub: true, simulatedTo: params.to });
      }
      return connectorErr('LINE channel token is not configured for this user', 'not_connected');
    }

    try {
      const res = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${bundle.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: params.to,
          messages: [{ type: 'text', text: params.text }],
        }),
      });
      if (res.status < 200 || res.status >= 300) {
        let detail = '';
        try {
          detail = JSON.stringify(await res.json());
        } catch {
          detail = '';
        }
        return connectorErr(`line error ${res.status} ${detail}`, 'provider_error');
      }
      return connectorOk({ ok: true });
    } catch (err) {
      return connectorErr(formatError(err), 'provider_error');
    }
  },
};

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
