/**
 * auth/api-key.ts — External API key generation & validation.
 *
 * Design:
 *   - Raw format: `fjk_<32-byte base64url>` (44 chars after prefix).
 *   - Only a SHA-256 hash is persisted. The raw secret is returned exactly
 *     once, at creation time, and never again.
 *   - Prefix = first 8 chars of the raw secret (after `fjk_`) so the UI
 *     can show "fjk_abcd…" in the listing without leaking the key.
 */
import { createHash, randomBytes } from 'crypto';
import { getKnex } from '../storage/knex-client.js';

const KEY_PREFIX = 'fjk_';
const KEY_BYTES = 32;

export interface ApiKeyRow {
  id: string;
  user_id: string;
  workspace_id: string | null;
  name: string;
  prefix: string;
  key_hash: string;
  created_at: string;
  last_used_at: string | null;
  revoked: number | boolean;
}

export interface MintedApiKey {
  id: string;
  name: string;
  prefix: string;
  /** Raw secret — returned ONCE, then unrecoverable. */
  secret: string;
  createdAt: string;
}

export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export async function mintApiKey(input: {
  userId: string;
  workspaceId?: string | null;
  name: string;
}): Promise<MintedApiKey> {
  const secret = `${KEY_PREFIX}${randomBytes(KEY_BYTES).toString('base64url')}`;
  const prefix = secret.slice(KEY_PREFIX.length, KEY_PREFIX.length + 8);
  const keyHash = hashApiKey(secret);
  const id = randomBytes(16).toString('hex');
  const now = new Date().toISOString();

  const db = getKnex();
  await db('api_keys').insert({
    id,
    user_id: input.userId,
    workspace_id: input.workspaceId ?? null,
    name: input.name,
    prefix,
    key_hash: keyHash,
    created_at: now,
    last_used_at: null,
    revoked: false,
  });

  return { id, name: input.name, prefix, secret, createdAt: now };
}

export async function findApiKeyByRaw(raw: string): Promise<ApiKeyRow | null> {
  if (!raw.startsWith(KEY_PREFIX)) return null;
  const keyHash = hashApiKey(raw);
  const db = getKnex();
  const row = (await db('api_keys').where({ key_hash: keyHash }).first()) as
    | ApiKeyRow
    | undefined;
  if (!row) return null;
  if (row.revoked === true || row.revoked === 1) return null;
  return row;
}

export async function touchApiKey(id: string): Promise<void> {
  const db = getKnex();
  await db('api_keys')
    .where({ id })
    .update({ last_used_at: new Date().toISOString() });
}

export async function listApiKeys(userId: string): Promise<ApiKeyRow[]> {
  const db = getKnex();
  const rows = (await db('api_keys')
    .where({ user_id: userId })
    .orderBy('created_at', 'desc')) as ApiKeyRow[];
  return rows;
}

export async function revokeApiKey(
  userId: string,
  id: string,
): Promise<boolean> {
  const db = getKnex();
  const updated = await db('api_keys')
    .where({ id, user_id: userId })
    .update({ revoked: true });
  return updated > 0;
}

export function rowToPublic(r: ApiKeyRow) {
  return {
    id: r.id,
    name: r.name,
    prefix: r.prefix,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
    revoked: Boolean(r.revoked),
  };
}
