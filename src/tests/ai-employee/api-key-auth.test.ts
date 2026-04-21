/**
 * API key auth middleware + key generation tests (block 7 external API).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';
import knex, { type Knex } from 'knex';
import { randomBytes } from 'crypto';
import { up as migrate013Up } from '../../../migrations/013_ai_employee_workspace.js';
import { up as migrate018Up } from '../../../migrations/018_api_keys.js';

let testDb: Knex;

vi.mock('../../storage/knex-client.js', () => ({
  getKnex: () => testDb,
  closeKnex: async () => {
    if (testDb) await testDb.destroy();
  },
}));

const { mintApiKey, findApiKeyByRaw, hashApiKey } = await import('../../auth/api-key.js');
const { apiKeyAuth } = await import('../../middleware/api-key-auth.js');

describe('api key auth', () => {
  beforeAll(async () => {
    process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64');
    testDb = knex({
      client: 'better-sqlite3',
      connection: { filename: ':memory:' },
      useNullAsDefault: true,
    });
    await migrate013Up(testDb);
    await migrate018Up(testDb);
  });

  afterAll(async () => {
    if (testDb) await testDb.destroy();
  });

  it('mints a key whose raw secret starts with fjk_ and is never persisted', async () => {
    const minted = await mintApiKey({ userId: 'owner@example.com', name: 'ci' });
    expect(minted.secret.startsWith('fjk_')).toBe(true);
    const stored = await testDb('api_keys').where({ id: minted.id }).first();
    expect(stored.key_hash).toBe(hashApiKey(minted.secret));
    // Raw secret must not appear anywhere in the row
    const serialised = JSON.stringify(stored);
    expect(serialised.includes(minted.secret)).toBe(false);
  });

  it('findApiKeyByRaw returns the row for a valid secret', async () => {
    const minted = await mintApiKey({ userId: 'u2@example.com', name: 'ci-2' });
    const row = await findApiKeyByRaw(minted.secret);
    expect(row).not.toBeNull();
    if (row) {
      expect(row.user_id).toBe('u2@example.com');
      expect(row.revoked === true || row.revoked === 1).toBe(false);
    }
  });

  it('findApiKeyByRaw returns null for a wrong prefix', async () => {
    const row = await findApiKeyByRaw('notaprefix_xxx');
    expect(row).toBeNull();
  });

  it('rejects revoked keys', async () => {
    const minted = await mintApiKey({ userId: 'u3@example.com', name: 'ci-3' });
    await testDb('api_keys').where({ id: minted.id }).update({ revoked: true });
    const row = await findApiKeyByRaw(minted.secret);
    expect(row).toBeNull();
  });

  it('middleware attaches user.email on success', async () => {
    const minted = await mintApiKey({ userId: 'who@example.com', name: 'ci-mw' });

    const fastify = Fastify({ logger: false });
    fastify.addHook('preHandler', apiKeyAuth);
    fastify.get('/whoami', async (request, reply) => {
      return reply.send({ email: request.user?.email ?? null });
    });

    const res = await fastify.inject({
      method: 'GET',
      url: '/whoami',
      headers: { authorization: `Bearer ${minted.secret}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ email: 'who@example.com' });
    await fastify.close();
  });

  it('middleware 401s on missing / malformed authorization', async () => {
    const fastify = Fastify({ logger: false });
    fastify.addHook('preHandler', apiKeyAuth);
    fastify.get('/probe', async () => ({ ok: true }));

    const noHeader = await fastify.inject({ method: 'GET', url: '/probe' });
    expect(noHeader.statusCode).toBe(401);

    const wrongScheme = await fastify.inject({
      method: 'GET',
      url: '/probe',
      headers: { authorization: 'Basic zzz' },
    });
    expect(wrongScheme.statusCode).toBe(401);

    const tooShort = await fastify.inject({
      method: 'GET',
      url: '/probe',
      headers: { authorization: 'Bearer x' },
    });
    expect(tooShort.statusCode).toBe(401);

    const notMinted = await fastify.inject({
      method: 'GET',
      url: '/probe',
      headers: { authorization: 'Bearer fjk_nopeNOPEnopeNOPEnopeNOPEnopeNOPEnopeNOPE' },
    });
    expect(notMinted.statusCode).toBe(401);
    await fastify.close();
  });
});
