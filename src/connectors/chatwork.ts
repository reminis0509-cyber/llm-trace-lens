/**
 * chatwork.ts — Chatwork connector.
 *
 * Auth: Chatwork does not issue OAuth tokens for all plans; the supported
 * path is a personal API token. We piggy-back on `connector_tokens`:
 * `access_token` stores the API token (encrypted), `refresh_token` stays
 * null, `expires_at` stays null.
 *
 * Actions:
 *   - postMessage : { roomId, body }
 *   - listRooms   : {}
 */
import {
  loadConnectorToken,
  isConnectorLinked,
} from '../auth/oauth/oauth-flow.js';
import type { Connector, ConnectorActionResult } from './base.js';
import { connectorOk, connectorErr } from './base.js';

const ACTIONS = ['postMessage', 'listRooms'] as const;
type ChatworkAction = (typeof ACTIONS)[number];
function isChatworkAction(v: string): v is ChatworkAction {
  return (ACTIONS as readonly string[]).includes(v);
}

interface PostMessageParams {
  roomId: string | number;
  body: string;
}

function isPostMessageParams(v: unknown): v is PostMessageParams {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    (typeof o.roomId === 'string' || typeof o.roomId === 'number') &&
    typeof o.body === 'string' &&
    o.body.length > 0
  );
}

async function chatworkCall(
  token: string,
  path: string,
  method: 'GET' | 'POST',
  form?: Record<string, string>,
): Promise<{ status: number; json: unknown }> {
  const url = `https://api.chatwork.com/v2${path}`;
  const headers: Record<string, string> = { 'X-ChatWorkToken': token };
  let body: string | undefined;
  if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(form).toString();
  }
  const res = await fetch(url, { method, headers, body });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

export const chatworkConnector: Connector = {
  provider: 'chatwork',
  requiredScopes: [],

  async isConnected(userId: string): Promise<boolean> {
    return isConnectorLinked(userId, 'chatwork');
  },

  async execute(userId, action, params): Promise<ConnectorActionResult> {
    if (!isChatworkAction(action)) {
      return connectorErr(`Unknown chatwork action: ${action}`, 'unknown_action');
    }
    const bundle = await loadConnectorToken(userId, 'chatwork');
    if (!bundle) {
      return connectorErr('Chatwork API token is not set for this user', 'not_connected');
    }

    try {
      if (action === 'postMessage') {
        if (!isPostMessageParams(params)) {
          return connectorErr('postMessage: roomId/body required', 'invalid_params');
        }
        const { status, json } = await chatworkCall(
          bundle.accessToken,
          `/rooms/${params.roomId}/messages`,
          'POST',
          { body: params.body },
        );
        if (status < 200 || status >= 300) {
          return connectorErr(`chatwork error ${status}`, 'provider_error');
        }
        return connectorOk({ result: json });
      }
      if (action === 'listRooms') {
        const { status, json } = await chatworkCall(bundle.accessToken, '/rooms', 'GET');
        if (status < 200 || status >= 300) {
          return connectorErr(`chatwork error ${status}`, 'provider_error');
        }
        return connectorOk({ rooms: json });
      }
      return connectorErr(`Unhandled chatwork action: ${action as string}`, 'unknown_action');
    } catch (err) {
      return connectorErr(formatError(err), 'provider_error');
    }
  },
};

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
