/**
 * Unit tests for the Connector base contract and registry shape.
 *
 * These pin the public API that the Runtime layer relies on:
 *   - `Connector` must expose provider, requiredScopes, isConnected,
 *     execute.
 *   - Registry must surface both google-calendar and gmail under provider
 *     'google', and must route actions to the correct connector.
 *   - `aggregateScopesForProvider('google')` must return a deduplicated
 *     superset of Calendar + Gmail scopes (what the OAuth start redirect
 *     will request).
 */
import { describe, it, expect } from 'vitest';
import {
  connectorOk,
  connectorErr,
  type Connector,
} from '../../connectors/base.js';
import {
  listConnectors,
  listConnectorsByProvider,
  getConnector,
  getConnectorForAction,
  aggregateScopesForProvider,
} from '../../connectors/registry.js';
import {
  GOOGLE_CALENDAR_SCOPES,
  GOOGLE_GMAIL_SCOPES,
} from '../../auth/oauth/google-oauth.js';

describe('Connector base helpers', () => {
  it('connectorOk wraps data', () => {
    const r = connectorOk({ foo: 1 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toEqual({ foo: 1 });
    }
  });

  it('connectorErr defaults to provider_error code', () => {
    const r = connectorErr('boom');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe('boom');
      expect(r.code).toBe('provider_error');
    }
  });

  it('connectorErr accepts a custom code', () => {
    const r = connectorErr('nope', 'not_connected');
    if (!r.ok) {
      expect(r.code).toBe('not_connected');
    }
  });
});

describe('Connector registry', () => {
  it('registers both google-calendar and gmail', () => {
    const ids = listConnectors().map((d) => d.id);
    expect(ids).toContain('google-calendar');
    expect(ids).toContain('gmail');
  });

  it('groups connectors by provider', () => {
    const googleOnes = listConnectorsByProvider('google');
    expect(googleOnes.length).toBeGreaterThanOrEqual(2);
    expect(googleOnes.every((d) => d.provider === 'google')).toBe(true);
  });

  it('getConnector returns a Connector for a known provider', () => {
    const c = getConnector('google');
    expect(c).not.toBeNull();
    assertConnectorShape(c);
  });

  it('getConnector returns null for an unregistered provider', () => {
    // v2 (2026-04-20) registered every spec'd provider. We assert that
    // a truly unknown value (cast via `as unknown`) still returns null.
    const fake = 'totally-fake-provider' as unknown as Parameters<typeof getConnector>[0];
    expect(getConnector(fake)).toBeNull();
  });

  it('getConnectorForAction routes listEventsToday to Calendar', () => {
    const c = getConnectorForAction('listEventsToday');
    expect(c).not.toBeNull();
    assertConnectorShape(c);
    // requiredScopes must include the Calendar read scope
    if (c) {
      expect(c.requiredScopes).toContain(GOOGLE_CALENDAR_SCOPES[0]);
    }
  });

  it('getConnectorForAction routes draftEmail to Gmail', () => {
    const c = getConnectorForAction('draftEmail');
    expect(c).not.toBeNull();
    if (c) {
      expect(c.requiredScopes).toContain(GOOGLE_GMAIL_SCOPES[0]);
    }
  });

  it('getConnectorForAction returns null for unknown actions', () => {
    expect(getConnectorForAction('nope')).toBeNull();
  });

  it('aggregateScopesForProvider(google) returns a dedup Calendar + Gmail scope set', () => {
    const scopes = aggregateScopesForProvider('google');
    for (const s of GOOGLE_CALENDAR_SCOPES) expect(scopes).toContain(s);
    for (const s of GOOGLE_GMAIL_SCOPES) expect(scopes).toContain(s);
    // no duplicates
    expect(new Set(scopes).size).toBe(scopes.length);
  });
});

function assertConnectorShape(c: Connector | null): void {
  expect(c).not.toBeNull();
  if (!c) return;
  expect(typeof c.provider).toBe('string');
  expect(Array.isArray(c.requiredScopes)).toBe(true);
  expect(typeof c.isConnected).toBe('function');
  expect(typeof c.execute).toBe('function');
}
