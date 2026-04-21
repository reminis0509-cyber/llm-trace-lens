/**
 * slack.ts — Slack connector.
 *
 * Actions:
 *   - postMessage  : { channel, text, blocks? }
 *   - listChannels : { limit? }
 *
 * Auth: OAuth v2 bot token. The stored `access_token` is the `xoxb-...`
 * bot token returned by `oauth.v2.access`. Required bot scopes:
 *   chat:write, channels:read, groups:read.
 *
 * v2 note: we call Slack's Web API via fetch() rather than pulling a new
 * SDK. The endpoints we touch accept JSON and return JSON.
 */
import {
  loadConnectorToken,
  isConnectorLinked,
} from '../auth/oauth/oauth-flow.js';
import type { Connector, ConnectorActionResult } from './base.js';
import { connectorOk, connectorErr } from './base.js';

export const SLACK_SCOPES = [
  'chat:write',
  'channels:read',
  'groups:read',
] as const;

const ACTIONS = ['postMessage', 'listChannels'] as const;
type SlackAction = (typeof ACTIONS)[number];

function isSlackAction(v: string): v is SlackAction {
  return (ACTIONS as readonly string[]).includes(v);
}

interface PostMessageParams {
  channel: string;
  text: string;
  blocks?: unknown[];
}

function isPostMessageParams(v: unknown): v is PostMessageParams {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (typeof o.channel !== 'string' || o.channel.length === 0) return false;
  if (typeof o.text !== 'string') return false;
  if (o.blocks !== undefined && !Array.isArray(o.blocks)) return false;
  return true;
}

interface ListChannelsParams {
  limit?: number;
}

function isListChannelsParams(v: unknown): v is ListChannelsParams {
  if (v === undefined || v === null) return true;
  if (typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (o.limit !== undefined && typeof o.limit !== 'number') return false;
  return true;
}

interface SlackApiResponse {
  ok: boolean;
  error?: string;
  [k: string]: unknown;
}

async function slackCall(
  token: string,
  method: string,
  body: Record<string, unknown> | null,
): Promise<SlackApiResponse> {
  const url = `https://slack.com/api/${method}`;
  const isGet = body === null;
  const res = await fetch(url, {
    method: isGet ? 'GET' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: isGet ? undefined : JSON.stringify(body),
  });
  const json = (await res.json()) as SlackApiResponse;
  return json;
}

export const slackConnector: Connector = {
  provider: 'slack',
  requiredScopes: SLACK_SCOPES,

  async isConnected(userId: string): Promise<boolean> {
    return isConnectorLinked(userId, 'slack');
  },

  async execute(userId, action, params): Promise<ConnectorActionResult> {
    if (!isSlackAction(action)) {
      return connectorErr(`Unknown slack action: ${action}`, 'unknown_action');
    }
    const bundle = await loadConnectorToken(userId, 'slack');
    if (!bundle) {
      return connectorErr('Slack is not connected for this user', 'not_connected');
    }

    try {
      if (action === 'postMessage') {
        if (!isPostMessageParams(params)) {
          return connectorErr('postMessage: channel/text required', 'invalid_params');
        }
        const r = await slackCall(bundle.accessToken, 'chat.postMessage', {
          channel: params.channel,
          text: params.text,
          blocks: params.blocks,
        });
        if (!r.ok) return connectorErr(r.error ?? 'slack_error', 'provider_error');
        return connectorOk({ ts: r.ts, channel: r.channel });
      }
      if (action === 'listChannels') {
        if (!isListChannelsParams(params)) {
          return connectorErr('listChannels: invalid params', 'invalid_params');
        }
        const limit = Math.max(1, Math.min(1000, params?.limit ?? 100));
        const url = `conversations.list?limit=${limit}&types=public_channel,private_channel`;
        const r = await slackCall(bundle.accessToken, url, null);
        if (!r.ok) return connectorErr(r.error ?? 'slack_error', 'provider_error');
        return connectorOk({ channels: r.channels ?? [] });
      }
      return connectorErr(`Unhandled slack action: ${action as string}`, 'unknown_action');
    } catch (err) {
      return connectorErr(formatError(err), 'provider_error');
    }
  },
};

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
