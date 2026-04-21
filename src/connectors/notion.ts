/**
 * notion.ts — Notion connector.
 *
 * Actions:
 *   - createPage   : { parentDatabaseId?, parentPageId?, title, contentText? }
 *   - searchPages  : { query, limit? }
 *
 * Auth: Notion internal integration OAuth. Stored `access_token` is the
 * `integration_token` from the OAuth exchange. Scopes are implicit per
 * integration install (Notion does not use a scopes string).
 */
import {
  loadConnectorToken,
  isConnectorLinked,
} from '../auth/oauth/oauth-flow.js';
import type { Connector, ConnectorActionResult } from './base.js';
import { connectorOk, connectorErr } from './base.js';

export const NOTION_SCOPES = [] as const;

const ACTIONS = ['createPage', 'searchPages'] as const;
type NotionAction = (typeof ACTIONS)[number];
function isNotionAction(v: string): v is NotionAction {
  return (ACTIONS as readonly string[]).includes(v);
}

interface CreatePageParams {
  parentDatabaseId?: string;
  parentPageId?: string;
  title: string;
  contentText?: string;
}
function isCreatePageParams(v: unknown): v is CreatePageParams {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (typeof o.title !== 'string' || o.title.length === 0) return false;
  if (o.parentDatabaseId !== undefined && typeof o.parentDatabaseId !== 'string') return false;
  if (o.parentPageId !== undefined && typeof o.parentPageId !== 'string') return false;
  if (o.contentText !== undefined && typeof o.contentText !== 'string') return false;
  if (!o.parentDatabaseId && !o.parentPageId) return false;
  return true;
}

interface SearchPagesParams {
  query: string;
  limit?: number;
}
function isSearchPagesParams(v: unknown): v is SearchPagesParams {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.query === 'string' &&
    (o.limit === undefined || typeof o.limit === 'number')
  );
}

async function notionCall(
  token: string,
  path: string,
  method: 'GET' | 'POST',
  body?: unknown,
): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

export const notionConnector: Connector = {
  provider: 'notion',
  requiredScopes: NOTION_SCOPES,

  async isConnected(userId: string): Promise<boolean> {
    return isConnectorLinked(userId, 'notion');
  },

  async execute(userId, action, params): Promise<ConnectorActionResult> {
    if (!isNotionAction(action)) {
      return connectorErr(`Unknown notion action: ${action}`, 'unknown_action');
    }
    const bundle = await loadConnectorToken(userId, 'notion');
    if (!bundle) {
      return connectorErr('Notion is not connected for this user', 'not_connected');
    }

    try {
      if (action === 'createPage') {
        if (!isCreatePageParams(params)) {
          return connectorErr('createPage: parent + title required', 'invalid_params');
        }
        const parent = params.parentDatabaseId
          ? { database_id: params.parentDatabaseId }
          : { page_id: params.parentPageId as string };
        const body: Record<string, unknown> = {
          parent,
          properties: params.parentDatabaseId
            ? { Name: { title: [{ text: { content: params.title } }] } }
            : { title: [{ text: { content: params.title } }] },
        };
        if (params.contentText) {
          (body.children as unknown) = [
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [{ type: 'text', text: { content: params.contentText } }],
              },
            },
          ];
        }
        const { status, json } = await notionCall(bundle.accessToken, '/pages', 'POST', body);
        if (status < 200 || status >= 300) {
          return connectorErr(`notion error ${status}`, 'provider_error');
        }
        return connectorOk({ page: json });
      }
      if (action === 'searchPages') {
        if (!isSearchPagesParams(params)) {
          return connectorErr('searchPages: query required', 'invalid_params');
        }
        const { status, json } = await notionCall(bundle.accessToken, '/search', 'POST', {
          query: params.query,
          page_size: Math.max(1, Math.min(100, params.limit ?? 25)),
        });
        if (status < 200 || status >= 300) {
          return connectorErr(`notion error ${status}`, 'provider_error');
        }
        return connectorOk({ results: json });
      }
      return connectorErr(`Unhandled notion action: ${action as string}`, 'unknown_action');
    } catch (err) {
      return connectorErr(formatError(err), 'provider_error');
    }
  },
};

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
