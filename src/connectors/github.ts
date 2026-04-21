/**
 * github.ts — GitHub connector.
 *
 * Actions:
 *   - createIssue : { owner, repo, title, body? }
 *   - listRepos   : { visibility?, limit? }
 *
 * Auth: GitHub OAuth app (authorization_code). Required scope: `repo`.
 */
import {
  loadConnectorToken,
  isConnectorLinked,
} from '../auth/oauth/oauth-flow.js';
import type { Connector, ConnectorActionResult } from './base.js';
import { connectorOk, connectorErr } from './base.js';

export const GITHUB_SCOPES = ['repo'] as const;

const ACTIONS = ['createIssue', 'listRepos'] as const;
type GhAction = (typeof ACTIONS)[number];
function isGhAction(v: string): v is GhAction {
  return (ACTIONS as readonly string[]).includes(v);
}

interface CreateIssueParams {
  owner: string;
  repo: string;
  title: string;
  body?: string;
}
function isCreateIssueParams(v: unknown): v is CreateIssueParams {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.owner === 'string' &&
    typeof o.repo === 'string' &&
    typeof o.title === 'string' &&
    (o.body === undefined || typeof o.body === 'string')
  );
}

interface ListReposParams {
  visibility?: 'all' | 'public' | 'private';
  limit?: number;
}
function isListReposParams(v: unknown): v is ListReposParams {
  if (v === undefined || v === null) return true;
  if (typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (o.visibility !== undefined && !['all', 'public', 'private'].includes(String(o.visibility))) return false;
  if (o.limit !== undefined && typeof o.limit !== 'number') return false;
  return true;
}

async function ghCall(
  token: string,
  path: string,
  method: 'GET' | 'POST',
  body?: unknown,
): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'FujiTrace-AI-Employee/1.0',
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

export const githubConnector: Connector = {
  provider: 'github',
  requiredScopes: GITHUB_SCOPES,

  async isConnected(userId: string): Promise<boolean> {
    return isConnectorLinked(userId, 'github');
  },

  async execute(userId, action, params): Promise<ConnectorActionResult> {
    if (!isGhAction(action)) {
      return connectorErr(`Unknown github action: ${action}`, 'unknown_action');
    }
    const bundle = await loadConnectorToken(userId, 'github');
    if (!bundle) {
      return connectorErr('GitHub is not connected for this user', 'not_connected');
    }

    try {
      if (action === 'createIssue') {
        if (!isCreateIssueParams(params)) {
          return connectorErr('createIssue: owner/repo/title required', 'invalid_params');
        }
        const { status, json } = await ghCall(
          bundle.accessToken,
          `/repos/${encodeURIComponent(params.owner)}/${encodeURIComponent(params.repo)}/issues`,
          'POST',
          { title: params.title, body: params.body ?? '' },
        );
        if (status < 200 || status >= 300) {
          return connectorErr(`github error ${status}`, 'provider_error');
        }
        return connectorOk({ issue: json });
      }
      if (action === 'listRepos') {
        if (!isListReposParams(params)) {
          return connectorErr('listRepos: invalid params', 'invalid_params');
        }
        const visibility = params?.visibility ?? 'all';
        const limit = Math.max(1, Math.min(100, params?.limit ?? 30));
        const { status, json } = await ghCall(
          bundle.accessToken,
          `/user/repos?visibility=${visibility}&per_page=${limit}&sort=updated`,
          'GET',
        );
        if (status < 200 || status >= 300) {
          return connectorErr(`github error ${status}`, 'provider_error');
        }
        return connectorOk({ repos: json });
      }
      return connectorErr(`Unhandled github action: ${action as string}`, 'unknown_action');
    } catch (err) {
      return connectorErr(formatError(err), 'provider_error');
    }
  },
};

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
