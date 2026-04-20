/**
 * token-crypto.ts — AES-256-GCM encryption helpers for OAuth tokens.
 *
 * Used by the AI Employee connector layer to store `access_token` and
 * `refresh_token` values at rest inside the `connector_tokens` table.
 *
 * SECURITY:
 * - The encryption key is read from `TOKEN_ENCRYPTION_KEY` (base64 of 32 bytes).
 * - If the env var is missing or invalid, module-level reads will throw. The
 *   connector layer is responsible for failing the request loudly rather than
 *   silently storing plaintext — there is NO dev fallback for token crypto
 *   (`src/security/secret-manager.ts` has a dev fallback for API keys, but
 *   OAuth refresh tokens are strictly higher-value and must never be stored
 *   without a real key).
 *
 * 暗号化アルゴリズム: AES-256-GCM (authenticated encryption).
 *
 * Envelope format (encryptToken output / decryptToken input):
 *   {
 *     v: 1,           // version byte for future rotation
 *     iv: base64,     // 12-byte random IV
 *     tag: base64,    // 16-byte authentication tag
 *     ct: base64      // ciphertext
 *   }
 *
 * The JSON envelope is serialized and stored as a single string. This keeps
 * the DB schema simple (one TEXT column per token) and makes the version
 * byte available for future key rotation.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH_BYTES = 32; // AES-256
const IV_LENGTH_BYTES = 12;  // GCM recommended
const ENVELOPE_VERSION = 1;

// ---------------------------------------------------------------------------
// Envelope types
// ---------------------------------------------------------------------------

interface TokenEnvelopeV1 {
  v: 1;
  iv: string;
  tag: string;
  ct: string;
}

function isTokenEnvelope(value: unknown): value is TokenEnvelopeV1 {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    obj.v === 1 &&
    typeof obj.iv === 'string' &&
    typeof obj.tag === 'string' &&
    typeof obj.ct === 'string'
  );
}

// ---------------------------------------------------------------------------
// Key loading
// ---------------------------------------------------------------------------

/**
 * Load the 32-byte AES key from `TOKEN_ENCRYPTION_KEY` (base64).
 *
 * Throws a descriptive error if the env var is missing or malformed. No
 * fallback is provided — OAuth refresh tokens grant long-lived access to a
 * user's Google/Chatwork/etc account and must never be stored under a
 * deterministic development key.
 */
export function loadTokenEncryptionKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      '[token-crypto] TOKEN_ENCRYPTION_KEY is not set. ' +
        'Generate a 32-byte key and set it as base64: ' +
        '`openssl rand -base64 32`',
    );
  }
  let key: Buffer;
  try {
    key = Buffer.from(raw, 'base64');
  } catch (err) {
    throw new Error(
      `[token-crypto] TOKEN_ENCRYPTION_KEY is not valid base64: ${String(err)}`,
    );
  }
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `[token-crypto] TOKEN_ENCRYPTION_KEY must decode to ${KEY_LENGTH_BYTES} bytes ` +
        `(got ${key.length}). Use \`openssl rand -base64 32\` to generate one.`,
    );
  }
  return key;
}

/**
 * Verify at startup that the crypto key is configured and usable.
 * Call this from server bootstrap to fail fast rather than fail at the
 * first OAuth callback in production.
 *
 * Returns `true` on success, throws on failure.
 */
export function assertTokenCryptoReady(): true {
  const key = loadTokenEncryptionKey();
  // round-trip a tiny payload to catch mis-padded keys early
  const sample = 'probe';
  const sealed = encryptTokenWithKey(sample, key);
  const opened = decryptTokenWithKey(sealed, key);
  if (opened !== sample) {
    throw new Error('[token-crypto] self-test failed (round-trip mismatch)');
  }
  return true;
}

// ---------------------------------------------------------------------------
// Core encrypt / decrypt
// ---------------------------------------------------------------------------

function encryptTokenWithKey(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const envelope: TokenEnvelopeV1 = {
    v: ENVELOPE_VERSION,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ct: ct.toString('base64'),
  };
  return JSON.stringify(envelope);
}

function decryptTokenWithKey(sealed: string, key: Buffer): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(sealed);
  } catch {
    throw new Error('[token-crypto] sealed payload is not valid JSON');
  }
  if (!isTokenEnvelope(parsed)) {
    throw new Error('[token-crypto] sealed payload has unexpected shape');
  }
  const iv = Buffer.from(parsed.iv, 'base64');
  const tag = Buffer.from(parsed.tag, 'base64');
  const ct = Buffer.from(parsed.ct, 'base64');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}

/**
 * Encrypt a token string. Loads the key from env on every call (cheap and
 * avoids holding keys in module-level memory longer than necessary).
 */
export function encryptToken(plaintext: string): string {
  const key = loadTokenEncryptionKey();
  return encryptTokenWithKey(plaintext, key);
}

/**
 * Decrypt a token string. Throws if the envelope is tampered with or the
 * key does not match.
 */
export function decryptToken(sealed: string): string {
  const key = loadTokenEncryptionKey();
  return decryptTokenWithKey(sealed, key);
}

// ---------------------------------------------------------------------------
// Test-only helpers (exported for unit tests, NOT for production callers)
// ---------------------------------------------------------------------------

export const __testing__ = {
  encryptTokenWithKey,
  decryptTokenWithKey,
};
