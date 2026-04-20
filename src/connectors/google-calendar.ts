/**
 * google-calendar.ts — Google Calendar connector.
 *
 * Actions:
 *   - listEventsToday     : events that start between [00:00 JST, 24:00 JST) today
 *   - listEventsThisWeek  : events in the next 7 days from now
 *   - createEvent         : stub for v1 (returns not_implemented)
 *
 * The connector fetches events from the user's *primary* calendar only.
 * Multi-calendar support is a follow-up.
 */
import {
  loadConnectorToken,
  isConnectorLinked,
} from '../auth/oauth/oauth-flow.js';
import {
  createGoogleOAuth2Client,
  loadGoogleOAuthConfig,
  GOOGLE_CALENDAR_SCOPES,
} from '../auth/oauth/google-oauth.js';
import { google } from 'googleapis';
import type { Connector, ConnectorActionResult } from './base.js';
import { connectorOk, connectorErr } from './base.js';

// Actions understood by this connector. Keep in sync with the route layer
// and with `src/agent/allowed-tools.ts` when Runtime integration lands.
const ACTIONS = ['listEventsToday', 'listEventsThisWeek', 'createEvent'] as const;
type CalendarAction = (typeof ACTIONS)[number];

function isCalendarAction(value: string): value is CalendarAction {
  return (ACTIONS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Shared calendar client construction
// ---------------------------------------------------------------------------

/**
 * Build a googleapis Calendar client bound to the stored credentials for
 * (user_id, 'google'). Returns null if the user has not linked Google.
 *
 * NOTE: a redirect URI is required by the OAuth2Client constructor even
 * when we only use it for token refresh. We pass an empty string here
 * because the client is never used for a fresh authorize redirect.
 */
async function buildCalendarClient(userId: string) {
  const bundle = await loadConnectorToken(userId, 'google');
  if (!bundle) return null;
  const config = loadGoogleOAuthConfig('');
  const oauth2 = createGoogleOAuth2Client(config);
  oauth2.setCredentials({
    access_token: bundle.accessToken,
    refresh_token: bundle.refreshToken ?? undefined,
    expiry_date: bundle.expiresAt ? bundle.expiresAt.getTime() : undefined,
  });
  return google.calendar({ version: 'v3', auth: oauth2 });
}

// ---------------------------------------------------------------------------
// Param narrowing
// ---------------------------------------------------------------------------

interface CreateEventParams {
  summary: string;
  start: string; // ISO 8601
  end: string;   // ISO 8601
  description?: string;
  attendees?: string[];
}

function isCreateEventParams(value: unknown): value is CreateEventParams {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.summary === 'string' &&
    typeof v.start === 'string' &&
    typeof v.end === 'string' &&
    (v.description === undefined || typeof v.description === 'string') &&
    (v.attendees === undefined || (Array.isArray(v.attendees) && v.attendees.every((a) => typeof a === 'string')))
  );
}

// ---------------------------------------------------------------------------
// Connector implementation
// ---------------------------------------------------------------------------

export const googleCalendarConnector: Connector = {
  provider: 'google',
  requiredScopes: GOOGLE_CALENDAR_SCOPES,

  async isConnected(userId: string): Promise<boolean> {
    return isConnectorLinked(userId, 'google');
  },

  async execute(userId: string, action: string, params: unknown): Promise<ConnectorActionResult> {
    if (!isCalendarAction(action)) {
      return connectorErr(`Unknown calendar action: ${action}`, 'unknown_action');
    }

    const client = await buildCalendarClient(userId);
    if (!client) {
      return connectorErr('Google Calendar is not connected for this user', 'not_connected');
    }

    try {
      if (action === 'listEventsToday') {
        const { start, end } = boundsForToday();
        const res = await client.events.list({
          calendarId: 'primary',
          timeMin: start.toISOString(),
          timeMax: end.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 50,
        });
        return connectorOk({ events: normaliseEvents(res.data.items ?? []) });
      }

      if (action === 'listEventsThisWeek') {
        const start = new Date();
        const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
        const res = await client.events.list({
          calendarId: 'primary',
          timeMin: start.toISOString(),
          timeMax: end.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 100,
        });
        return connectorOk({ events: normaliseEvents(res.data.items ?? []) });
      }

      if (action === 'createEvent') {
        // Narrow params defensively even though the action is a stub.
        if (!isCreateEventParams(params)) {
          return connectorErr('createEvent requires summary/start/end', 'invalid_params');
        }
        // v1: stub. Write paths go behind a human confirmation step in
        // the UI and will be wired in the next backend sprint.
        return connectorErr(
          'createEvent is not yet enabled in v1 (write access pending UI confirmation flow)',
          'not_implemented',
        );
      }

      return connectorErr(`Unhandled action: ${action as string}`, 'unknown_action');
    } catch (err) {
      return connectorErr(formatError(err), 'provider_error');
    }
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Today window in the server's local time. Production servers run in UTC,
 * but the Dashboard displays JST — the frontend handles conversion. If we
 * ever need strict JST boundaries server-side, we'll wire `Intl` here.
 */
function boundsForToday(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

interface RawCalendarEvent {
  id?: string | null;
  summary?: string | null;
  description?: string | null;
  status?: string | null;
  start?: { dateTime?: string | null; date?: string | null; timeZone?: string | null } | null;
  end?: { dateTime?: string | null; date?: string | null; timeZone?: string | null } | null;
  attendees?: Array<{ email?: string | null; responseStatus?: string | null }> | null;
  location?: string | null;
  htmlLink?: string | null;
}

interface NormalisedCalendarEvent {
  id: string | null;
  summary: string;
  description: string | null;
  status: string | null;
  start: string | null;
  end: string | null;
  allDay: boolean;
  attendees: string[];
  location: string | null;
  htmlLink: string | null;
}

function normaliseEvents(items: RawCalendarEvent[]): NormalisedCalendarEvent[] {
  return items.map((item) => {
    const startDt = item.start?.dateTime ?? null;
    const startAllDay = item.start?.date ?? null;
    const endDt = item.end?.dateTime ?? null;
    const endAllDay = item.end?.date ?? null;
    const attendees = (item.attendees ?? [])
      .map((a) => a.email ?? null)
      .filter((email): email is string => typeof email === 'string');
    return {
      id: item.id ?? null,
      summary: item.summary ?? '(no title)',
      description: item.description ?? null,
      status: item.status ?? null,
      start: startDt ?? startAllDay,
      end: endDt ?? endAllDay,
      allDay: !startDt && Boolean(startAllDay),
      attendees,
      location: item.location ?? null,
      htmlLink: item.htmlLink ?? null,
    };
  });
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
