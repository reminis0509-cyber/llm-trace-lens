/**
 * Unit tests for AI Employee token crypto helpers.
 *
 * These cover the lowest-level guarantee of the connector layer: OAuth
 * refresh tokens MUST round-trip losslessly under a freshly generated
 * key, and decryption MUST fail when the ciphertext is tampered with.
 */
import { describe, it, expect } from 'vitest';
import { randomBytes } from 'crypto';
import { __testing__, loadTokenEncryptionKey, assertTokenCryptoReady } from '../../lib/token-crypto.js';

const { encryptTokenWithKey, decryptTokenWithKey } = __testing__;

function withTempKey<T>(fn: (key: Buffer) => T): T {
  const key = randomBytes(32);
  return fn(key);
}

describe('token-crypto', () => {
  it('round-trips plaintext through AES-256-GCM', () => {
    withTempKey((key) => {
      const sample = 'ya29.example-google-access-token-xxxxxxxxxxxxxxxx';
      const sealed = encryptTokenWithKey(sample, key);
      expect(sealed).not.toContain(sample);
      const opened = decryptTokenWithKey(sealed, key);
      expect(opened).toBe(sample);
    });
  });

  it('produces different ciphertext for the same plaintext each call (fresh IV)', () => {
    withTempKey((key) => {
      const sample = 'refresh-token-abc';
      const a = encryptTokenWithKey(sample, key);
      const b = encryptTokenWithKey(sample, key);
      expect(a).not.toBe(b);
    });
  });

  it('rejects tampered ciphertext', () => {
    withTempKey((key) => {
      const sealed = encryptTokenWithKey('hello', key);
      const parsed = JSON.parse(sealed);
      // flip one base64 char in the ciphertext
      parsed.ct = parsed.ct.slice(0, -2) + (parsed.ct.endsWith('A') ? 'B' : 'A') + parsed.ct.slice(-1);
      const tampered = JSON.stringify(parsed);
      expect(() => decryptTokenWithKey(tampered, key)).toThrow();
    });
  });

  it('rejects envelope with wrong version', () => {
    withTempKey((key) => {
      const sealed = encryptTokenWithKey('x', key);
      const parsed = JSON.parse(sealed);
      parsed.v = 99;
      expect(() => decryptTokenWithKey(JSON.stringify(parsed), key)).toThrow();
    });
  });

  describe('loadTokenEncryptionKey', () => {
    it('throws when TOKEN_ENCRYPTION_KEY is not set', () => {
      const prev = process.env.TOKEN_ENCRYPTION_KEY;
      delete process.env.TOKEN_ENCRYPTION_KEY;
      try {
        expect(() => loadTokenEncryptionKey()).toThrow(/TOKEN_ENCRYPTION_KEY/);
      } finally {
        if (prev !== undefined) process.env.TOKEN_ENCRYPTION_KEY = prev;
      }
    });

    it('throws when TOKEN_ENCRYPTION_KEY decodes to the wrong length', () => {
      const prev = process.env.TOKEN_ENCRYPTION_KEY;
      process.env.TOKEN_ENCRYPTION_KEY = Buffer.from('short').toString('base64');
      try {
        expect(() => loadTokenEncryptionKey()).toThrow(/32 bytes/);
      } finally {
        if (prev === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
        else process.env.TOKEN_ENCRYPTION_KEY = prev;
      }
    });

    it('loads a valid 32-byte key from base64 env and passes self-test', () => {
      const prev = process.env.TOKEN_ENCRYPTION_KEY;
      process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64');
      try {
        expect(loadTokenEncryptionKey().length).toBe(32);
        expect(assertTokenCryptoReady()).toBe(true);
      } finally {
        if (prev === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
        else process.env.TOKEN_ENCRYPTION_KEY = prev;
      }
    });
  });
});
