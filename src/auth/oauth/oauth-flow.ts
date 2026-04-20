/**
 * oauth-flow.ts — generic OAuth authorization-code flow glue.
 *
 * Responsibilities:
 *   - Generate cryptographically-random `state` values and persist them in
 *     the `oauth_states` table (CSRF protection, 10-minute TTL).
 *   - Consume a `state` during callback and return the stored metadata.
 *   - Encrypt-and-store the exchanged tokens in `connector_tokens`.
 *   - Refresh expired access tokens via a provider-supplied refresh hook.
 *
 * This module is deliberately provider-agnostic: all Google-specific logic
 * lives in `google-oauth.ts` and the individual connector files.
 */
import { randomBytes } from 'crypto';
import { getKnex } from '../../storage/knex-client.js';
import { encryptToken, decryptToken } from '../../lib/token-crypto.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConnectorProvider = 'google' | 'chatwork' | 'slack' | 'freee' | 'drive';

export const CONNECTOR_PROVIDERS: readonly ConnectorProvider[] = [
  'google',
  'chatwork',
  'slack',
  'freee',
  'drive',
] as const;

export function isConnectorProvider(value: unknown): value is ConnectorProvider {
  return typeof value === 'string' && (CONNECTOR_PROVIDERS as readonly string[]).includes(value);
}

export interface OAuthStateRow {
  id: string;
  state: string;
  user_id: string;
  provider: ConnectorProvider;
  redirect_uri: string;
  created_at: string;
}

export interface ConnectorTokenRow {
  id: string;
  user_id: string;
  provider: ConnectorProvider;
  access_token: string;     // encrypted envelope
  refresh_token: string | null; // encrypted envelope or null
  expires_at: string | null;
  scopes: string[] | null;
  connected_at: string;
}

export interface StoredTokenBundle {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scopes: readonly string[];
}

// ---------------------------------------------------------------------------
// State (CSRF) handling
// ---------------------------------------------------------------------------

/** State tokens are valid for 10 minutes. */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

/**
 * Create and persist a new `state` token for an OAuth authorize redirect.
 */
export async function createOAuthState(params: {
  userId: string;
  provider: ConnectorProvider;
  redirectUri: string;
}): Promise<string> {
  const state = randomBytes(24).toString('base64url');
  const db = getKnex();
  await db('oauth_states').insert({
    id: randomBytes(16).toString('hex'),
    state,
    user_id: params.userId,
    provider: params.provider,
    redirect_uri: params.redirectUri,
    created_at: new Date().toISOString(),
  });
  return state;
}

/**
 * Consume a `state` token during the callback. Returns the stored row on
 * success (and deletes it so it cannot be replayed); returns null if the
 * state is unknown or older than the TTL.
 */
export async function consumeOAuthState(
  state: string,
  provider: ConnectorProvider,
): Promise<OAuthStateRow | null> {
  const db = getKnex();
  const row = (await db('oauth_states')
    .where({ state, provider })
    .first()) as OAuthStateRow | undefined;
  if (!row) return null;

  // Always delete, whether valid or expired — state tokens are one-shot.
  await db('oauth_states').where({ state }).del();

  const ageMs = Date.now() - new Date(row.created_at).getTime();
  if (ageMs > OAUTH_STATE_TTL_MS) {
    return null;
  }
  return row;
}

/**
 * Hard delete of any state rows older than the TTL. Intended to be called
 * by a future cron job. Safe to call from request paths (idempotent).
 */
export async function pruneExpiredOAuthStates(): Promise<number> {
  const db = getKnex();
  const cutoff = new Date(Date.now() - OAUTH_STATE_TTL_MS).toISOString();
  return db('oauth_states').where('created_at', '<', cutoff).del();
}

// ---------------------------------------------------------------------------
// Token storage
// ---------------------------------------------------------------------------

/**
 * Encrypt + upsert a connector token bundle for (user_id, provider).
 */
export async function saveConnectorToken(params: {
  userId: string;
  provider: ConnectorProvider;
  bundle: StoredTokenBundle;
}): Promise<void> {
  const { userId, provider, bundle } = params;
  const db = getKnex();

  const encryptedAccess = encryptToken(bundle.accessToken);
  const encryptedRefresh = bundle.refreshToken ? encryptToken(bundle.refreshToken) : null;

  const existing = (await db('connector_tokens')
    .where({ user_id: userId, provider })
    .first()) as ConnectorTokenRow | undefined;

  const row = {
    user_id: userId,
    provider,
    access_token: encryptedAccess,
    refresh_token: encryptedRefresh,
    expires_at: bundle.expiresAt ? bundle.expiresAt.toISOString() : null,
    scopes: JSON.stringify(bundle.scopes),
    connected_at: new Date().toISOString(),
  };

  if (existing) {
    await db('connector_tokens').where({ id: existing.id }).update(row);
  } else {
    await db('connector_tokens').insert({
      id: randomBytes(16).toString('hex'),
      ...row,
    });
  }
}

/**
 * Load and decrypt the token bundle for (user_id, provider). Returns null
 * if the connector has not been linked.
 */
export async function loadConnectorToken(
  userId: string,
  provider: ConnectorProvider,
): Promise<StoredTokenBundle | null> {
  const db = getKnex();
  const row = (await db('connector_tokens')
    .where({ user_id: userId, provider })
    .first()) as ConnectorTokenRow | undefined;
  if (!row) return null;

  const accessToken = decryptToken(row.access_token);
  const refreshToken = row.refresh_token ? decryptToken(row.refresh_token) : null;
  const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
  const scopes = parseScopes(row.scopes);

  return { accessToken, refreshToken, expiresAt, scopes };
}

/**
 * Delete the connector token for (user_id, provider).
 * Returns true if a row was deleted, false if the user had no connector.
 */
export async function deleteConnectorToken(
  userId: string,
  provider: ConnectorProvider,
): Promise<boolean> {
  const db = getKnex();
  const deleted = await db('connector_tokens').where({ user_id: userId, provider }).del();
  return deleted > 0;
}

/**
 * Check whether the user has a linked connector for the given provider.
 */
export async function isConnectorLinked(
  userId: string,
  provider: ConnectorProvider,
): Promise<boolean> {
  const db = getKnex();
  const row = (await db('connector_tokens')
    .where({ user_id: userId, provider })
    .first()) as ConnectorTokenRow | undefined;
  return Boolean(row);
}

function parseScopes(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // fall through
    }
  }
  return [];
}
