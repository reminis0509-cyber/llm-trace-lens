/**
 * google-oauth.ts — thin wrapper around `googleapis` OAuth2 client.
 *
 * The AI Employee connector layer needs a single source of truth for how
 * Google OAuth credentials are loaded and how the `OAuth2Client` instance
 * is constructed. Centralising this avoids copy-paste between the Calendar
 * and Gmail connectors.
 *
 * ENV:
 *   GOOGLE_OAUTH_CLIENT_ID      (required)
 *   GOOGLE_OAUTH_CLIENT_SECRET  (required)
 *   GOOGLE_OAUTH_REDIRECT_BASE  (optional; defaults to the request host)
 *
 * The redirect URI is `${base}/api/auth/oauth/google/callback`.
 */
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

// Scopes used by the built-in Google connectors. Additional scopes can be
// added by callers via `buildAuthorizeUrl({ extraScopes })`.
export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
] as const;

export const GOOGLE_GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.send',
] as const;

export const DEFAULT_GOOGLE_SCOPES: readonly string[] = [
  ...GOOGLE_CALENDAR_SCOPES,
  ...GOOGLE_GMAIL_SCOPES,
  'openid',
  'email',
  'profile',
];

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Read the Google OAuth config from env vars, throwing if unset. This is
 * the single choke point — routes should call `isGoogleOAuthConfigured()`
 * first to gracefully return a 503 when env is missing, rather than
 * catching the throw.
 */
export function loadGoogleOAuthConfig(redirectUri: string): GoogleOAuthConfig {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      '[google-oauth] GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be set',
    );
  }
  return { clientId, clientSecret, redirectUri };
}

/**
 * Cheap env check that routes can gate on before constructing the client.
 */
export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  );
}

/**
 * Derive the canonical redirect URI for a given request.
 * Precedence:
 *   1. `GOOGLE_OAUTH_REDIRECT_BASE` (env) if set (e.g. https://fujitrace.jp)
 *   2. `x-forwarded-proto` + `x-forwarded-host` / `host` from the request
 */
export function buildGoogleRedirectUri(headers: {
  host?: string;
  'x-forwarded-host'?: string | string[];
  'x-forwarded-proto'?: string | string[];
}): string {
  const envBase = process.env.GOOGLE_OAUTH_REDIRECT_BASE;
  if (envBase) {
    return `${envBase.replace(/\/+$/, '')}/api/auth/oauth/google/callback`;
  }
  const proto = firstHeader(headers['x-forwarded-proto']) ?? 'http';
  const host = firstHeader(headers['x-forwarded-host']) ?? headers.host ?? 'localhost';
  return `${proto}://${host}/api/auth/oauth/google/callback`;
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Construct a fresh `OAuth2Client`. The client is stateless so callers can
 * create and discard one per request — this is cheap and avoids any cache
 * invalidation headaches around the shared credentials.
 */
export function createGoogleOAuth2Client(config: GoogleOAuthConfig): OAuth2Client {
  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
}
