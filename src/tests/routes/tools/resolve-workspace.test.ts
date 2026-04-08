/**
 * QA H-1 regression test: resolveWorkspaceId must NEVER return a
 * `'default'` fallback. Callers without a resolvable workspace must get
 * `null` so the route can respond 401.
 *
 * This test stubs only the fields of FastifyRequest that resolveWorkspaceId
 * actually reads. The DB branch is not exercised here — shared.test.ts
 * documents the decision to keep DB-backed paths out of unit tests until a
 * Fastify + Knex harness exists. The key assertions below are precisely the
 * ones that previously (wrongly) returned `'default'`.
 */
import { describe, it, expect } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { resolveWorkspaceId } from '../../../routes/tools/_shared.js';

function makeRequest(overrides: Partial<{
  workspace: { workspaceId: string } | undefined;
  user: { email: string } | undefined;
  headers: Record<string, string>;
}> = {}): FastifyRequest {
  return {
    workspace: overrides.workspace,
    user: overrides.user,
    headers: overrides.headers ?? {},
  } as unknown as FastifyRequest;
}

describe('resolveWorkspaceId — QA H-1 strict policy', () => {
  it('returns workspace.workspaceId when auth middleware already set it', async () => {
    const req = makeRequest({ workspace: { workspaceId: 'ws_real_123' } });
    expect(await resolveWorkspaceId(req)).toBe('ws_real_123');
  });

  it('returns x-workspace-id header when no user/workspace context exists', async () => {
    const req = makeRequest({ headers: { 'x-workspace-id': 'ws_header' } });
    expect(await resolveWorkspaceId(req)).toBe('ws_header');
  });

  it('returns null for a fully anonymous request (no headers, no user)', async () => {
    const req = makeRequest();
    expect(await resolveWorkspaceId(req)).toBeNull();
  });

  it('returns null when only x-user-id is present (no workspace mapping)', async () => {
    // Previously this would return `'default'`; now it MUST be null so
    // the caller responds with 401. This is the core H-1 regression pin.
    const req = makeRequest({ headers: { 'x-user-id': 'some-user-id' } });
    expect(await resolveWorkspaceId(req)).toBeNull();
  });
});
