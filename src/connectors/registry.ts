/**
 * registry.ts — central registration of all AI Employee connectors.
 *
 * The Runtime layer resolves connectors by a compound key `(provider, action)`
 * rather than by `provider` alone, because multiple connectors share the
 * `google` provider (Calendar and Gmail both ride on Google OAuth).
 *
 * Consumers:
 *   - Runtime layer: `getConnectorForAction(provider, action)` returns the
 *     connector that implements a given action, or null if unknown.
 *   - UI / settings: `listConnectors()` returns all registered connectors
 *     for rendering the "Connected Services" page.
 */
import type { ConnectorProvider } from '../auth/oauth/oauth-flow.js';
import type { Connector } from './base.js';
import { googleCalendarConnector } from './google-calendar.js';
import { gmailConnector } from './gmail.js';

/**
 * Description of what a connector is capable of. `actions` is the
 * authoritative list of strings that `Connector.execute()` will accept;
 * anything else must be rejected with `unknown_action`.
 */
export interface ConnectorDescriptor {
  readonly id: string;
  readonly provider: ConnectorProvider;
  readonly actions: readonly string[];
  readonly connector: Connector;
  readonly displayName: string;
}

const CONNECTOR_DESCRIPTORS: readonly ConnectorDescriptor[] = [
  {
    id: 'google-calendar',
    provider: 'google',
    actions: ['listEventsToday', 'listEventsThisWeek', 'createEvent'],
    connector: googleCalendarConnector,
    displayName: 'Google Calendar',
  },
  {
    id: 'gmail',
    provider: 'google',
    actions: ['draftEmail', 'sendEmail'],
    connector: gmailConnector,
    displayName: 'Gmail',
  },
];

/**
 * Return all registered connectors.
 */
export function listConnectors(): readonly ConnectorDescriptor[] {
  return CONNECTOR_DESCRIPTORS;
}

/**
 * Return all connectors that share a given OAuth provider.
 * Useful when a single OAuth flow grants scopes for multiple connectors
 * (Google → Calendar + Gmail).
 */
export function listConnectorsByProvider(
  provider: ConnectorProvider,
): readonly ConnectorDescriptor[] {
  return CONNECTOR_DESCRIPTORS.filter((d) => d.provider === provider);
}

/**
 * Resolve a connector by the OAuth provider alone. When multiple
 * connectors share a provider, the FIRST registration wins. Runtime code
 * that dispatches actions should use `getConnectorForAction()` instead.
 */
export function getConnector(provider: ConnectorProvider): Connector | null {
  const descriptor = CONNECTOR_DESCRIPTORS.find((d) => d.provider === provider);
  return descriptor?.connector ?? null;
}

/**
 * Resolve the connector that implements a specific action.
 * Returns null if no connector handles the action.
 */
export function getConnectorForAction(action: string): Connector | null {
  const descriptor = CONNECTOR_DESCRIPTORS.find((d) => d.actions.includes(action));
  return descriptor?.connector ?? null;
}

/**
 * Aggregate list of all OAuth scopes required across every connector for
 * a given provider. Used when building the authorize redirect URL.
 */
export function aggregateScopesForProvider(provider: ConnectorProvider): readonly string[] {
  const seen = new Set<string>();
  for (const d of CONNECTOR_DESCRIPTORS) {
    if (d.provider !== provider) continue;
    for (const s of d.connector.requiredScopes) seen.add(s);
  }
  return Array.from(seen);
}
