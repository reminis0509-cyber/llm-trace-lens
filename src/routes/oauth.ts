/**
 * routes/oauth.ts — AI Employee OAuth flow endpoints.
 *
 * Endpoints:
 *   GET  /api/auth/oauth/:provider/start
 *        Generates an `authorize` URL for the given provider and persists a
 *        CSRF `state` token. Responds with either a redirect (default) or
 *        `{ authorizeUrl, state }` JSON when the caller sends
 *        `Accept: application/json`.
 *
 *   GET  /api/auth/oauth/:provider/callback
 *        Exchanges the `code` for tokens, encrypts them into
 *        `connector_tokens`, then redirects back to the dashboard (or
 *        returns JSON when `Accept: application/json`).
 *
 *   POST /api/auth/oauth/:provider/disconnect
 *        Deletes the stored connector tokens for the current user.
 *
 * AUTH:
 *   All three endpoints require a verified user identity
 *   (`request.user.email`, set by the RBAC plugin from a session cookie or
 *   Supabase JWT). The callback endpoint additionally requires the user to
 *   be authenticated at callback time — the OAuth `state` row encodes the
 *   original user_id so we don't accidentally attach a Google account to
 *   a different FujiTrace user mid-flow.
 *
 * Response format:
 *   Success JSON → { success: true, data?: T }
 *   Error JSON   → { success: false, error: string }
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  isGoogleOAuthConfigured,
  loadGoogleOAuthConfig,
  createGoogleOAuth2Client,
  buildGoogleRedirectUri,
} from '../auth/oauth/google-oauth.js';
import {
  isConnectorProvider,
  createOAuthState,
  consumeOAuthState,
  saveConnectorToken,
  deleteConnectorToken,
  type ConnectorProvider,
} from '../auth/oauth/oauth-flow.js';
import { aggregateScopesForProvider } from '../connectors/registry.js';

interface ProviderParams {
  provider: string;
}

interface CallbackQuery {
  code?: string;
  state?: string;
  error?: string;
}

export default async function oauthRoutes(fastify: FastifyInstance): Promise<void> {
  // ---------------------------------------------------------------------
  // GET /api/auth/oauth/:provider/start
  // ---------------------------------------------------------------------
  fastify.get<{ Params: ProviderParams }>(
    '/api/auth/oauth/:provider/start',
    async (request, reply) => {
      const { provider } = request.params;
      const userEmail = request.user?.email;
      if (!userEmail) {
        return reply.code(401).send({ success: false, error: '認証が必要です' });
      }
      if (!isConnectorProvider(provider)) {
        return reply.code(400).send({ success: false, error: `未対応のプロバイダ: ${provider}` });
      }

      try {
        const result = await buildAuthorizeRedirect(request, provider, userEmail);
        if ('error' in result) {
          return reply.code(result.status).send({ success: false, error: result.error });
        }
        const wantsJson = (request.headers.accept ?? '').includes('application/json');
        if (wantsJson) {
          return reply.send({
            success: true,
            data: { authorizeUrl: result.authorizeUrl, state: result.state },
          });
        }
        return reply.redirect(result.authorizeUrl);
      } catch (err) {
        request.log.error({ err, provider }, '[oauth] /start failed');
        return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
      }
    },
  );

  // ---------------------------------------------------------------------
  // GET /api/auth/oauth/:provider/callback
  // ---------------------------------------------------------------------
  fastify.get<{ Params: ProviderParams; Querystring: CallbackQuery }>(
    '/api/auth/oauth/:provider/callback',
    async (request, reply) => {
      const { provider } = request.params;
      const userEmail = request.user?.email;
      if (!userEmail) {
        return reply.code(401).send({ success: false, error: '認証が必要です' });
      }
      if (!isConnectorProvider(provider)) {
        return reply.code(400).send({ success: false, error: `未対応のプロバイダ: ${provider}` });
      }

      const { code, state, error } = request.query;
      if (error) {
        return reply.code(400).send({ success: false, error: `OAuth拒否: ${error}` });
      }
      if (!code || !state) {
        return reply.code(400).send({ success: false, error: 'code と state は必須です' });
      }

      try {
        const stateRow = await consumeOAuthState(state, provider);
        if (!stateRow) {
          return reply
            .code(400)
            .send({ success: false, error: 'state が無効または期限切れです' });
        }
        if (stateRow.user_id !== userEmail) {
          request.log.error(
            { expected: stateRow.user_id, got: userEmail, provider },
            '[oauth] state user_id mismatch — possible CSRF',
          );
          return reply
            .code(400)
            .send({ success: false, error: 'state がこのユーザーと一致しません' });
        }

        const exchanged = await exchangeCodeForTokens(provider, code, stateRow.redirect_uri);
        if ('error' in exchanged) {
          return reply.code(exchanged.status).send({ success: false, error: exchanged.error });
        }

        await saveConnectorToken({
          userId: userEmail,
          provider,
          bundle: exchanged.bundle,
        });

        const wantsJson = (request.headers.accept ?? '').includes('application/json');
        if (wantsJson) {
          return reply.send({
            success: true,
            data: { provider, connected: true },
          });
        }
        // Browser flow: bounce back to the dashboard connector-settings tab.
        return reply.redirect('/dashboard/settings/connectors?connected=' + provider);
      } catch (err) {
        request.log.error({ err, provider }, '[oauth] /callback failed');
        return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
      }
    },
  );

  // ---------------------------------------------------------------------
  // POST /api/auth/oauth/:provider/api-key
  // For providers that do not use OAuth (chatwork, line) and still need
  // a token stored in connector_tokens. Body: { token: string }
  // ---------------------------------------------------------------------
  fastify.post<{ Params: ProviderParams; Body: { token?: unknown } }>(
    '/api/auth/oauth/:provider/api-key',
    async (request, reply) => {
      const { provider } = request.params;
      const userEmail = request.user?.email;
      if (!userEmail) {
        return reply.code(401).send({ success: false, error: '認証が必要です' });
      }
      if (!isConnectorProvider(provider)) {
        return reply.code(400).send({ success: false, error: `未対応のプロバイダ: ${provider}` });
      }
      const API_KEY_PROVIDERS: ConnectorProvider[] = ['chatwork', 'line'];
      if (!API_KEY_PROVIDERS.includes(provider)) {
        return reply
          .code(400)
          .send({ success: false, error: `${provider} is OAuth-based; use /start instead` });
      }
      const token = typeof request.body?.token === 'string' ? request.body.token : null;
      if (!token || token.length < 8 || token.length > 4096) {
        return reply.code(400).send({ success: false, error: 'token が必須です (8..4096 chars)' });
      }
      try {
        await saveConnectorToken({
          userId: userEmail,
          provider,
          bundle: {
            accessToken: token,
            refreshToken: null,
            expiresAt: null,
            scopes: [],
          },
        });
        return reply.send({ success: true, data: { provider, connected: true } });
      } catch (err) {
        request.log.error({ err, provider }, '[oauth] /api-key failed');
        return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
      }
    },
  );

  // ---------------------------------------------------------------------
  // POST /api/auth/oauth/:provider/disconnect
  // ---------------------------------------------------------------------
  fastify.post<{ Params: ProviderParams }>(
    '/api/auth/oauth/:provider/disconnect',
    async (request, reply) => {
      const { provider } = request.params;
      const userEmail = request.user?.email;
      if (!userEmail) {
        return reply.code(401).send({ success: false, error: '認証が必要です' });
      }
      if (!isConnectorProvider(provider)) {
        return reply.code(400).send({ success: false, error: `未対応のプロバイダ: ${provider}` });
      }

      try {
        const deleted = await deleteConnectorToken(userEmail, provider);
        return reply.send({
          success: true,
          data: { provider, deleted },
        });
      } catch (err) {
        request.log.error({ err, provider }, '[oauth] /disconnect failed');
        return reply.code(500).send({ success: false, error: '内部エラーが発生しました' });
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Provider dispatch
// ---------------------------------------------------------------------------

interface AuthorizeRedirectOk {
  authorizeUrl: string;
  state: string;
}

interface AuthorizeRedirectErr {
  error: string;
  status: number;
}

/**
 * Build the canonical callback URL for a non-google provider. The Google
 * provider has its own dedicated builder above because the `googleapis`
 * SDK expects the redirect URI to be baked into the OAuth2Client.
 */
function buildGenericRedirectUri(
  request: FastifyRequest,
  provider: ConnectorProvider,
): string {
  const envBase = process.env.OAUTH_REDIRECT_BASE;
  const hostHeader = request.headers.host ?? 'localhost';
  const forwardedProto = (request.headers['x-forwarded-proto'] as string | undefined) ?? 'http';
  const forwardedHost = (request.headers['x-forwarded-host'] as string | undefined) ?? hostHeader;
  const base = envBase
    ? envBase.replace(/\/+$/, '')
    : `${forwardedProto}://${forwardedHost}`;
  return `${base}/api/auth/oauth/${provider}/callback`;
}

interface OAuthAppConfig {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
}

function loadOAuthAppConfig(provider: ConnectorProvider): OAuthAppConfig | null {
  const cidEnv = `${provider.toUpperCase()}_OAUTH_CLIENT_ID`;
  const csEnv = `${provider.toUpperCase()}_OAUTH_CLIENT_SECRET`;
  const clientId = process.env[cidEnv];
  const clientSecret = process.env[csEnv];
  if (!clientId || !clientSecret) return null;

  if (provider === 'slack') {
    return {
      clientId,
      clientSecret,
      authorizeUrl: 'https://slack.com/oauth/v2/authorize',
      tokenUrl: 'https://slack.com/api/oauth.v2.access',
      scope: 'chat:write,channels:read,groups:read',
    };
  }
  if (provider === 'freee') {
    return {
      clientId,
      clientSecret,
      authorizeUrl: 'https://accounts.secure.freee.co.jp/public_api/authorize',
      tokenUrl: 'https://accounts.secure.freee.co.jp/public_api/token',
      scope: 'read',
    };
  }
  if (provider === 'notion') {
    return {
      clientId,
      clientSecret,
      authorizeUrl: 'https://api.notion.com/v1/oauth/authorize',
      tokenUrl: 'https://api.notion.com/v1/oauth/token',
      scope: '',
    };
  }
  if (provider === 'github') {
    return {
      clientId,
      clientSecret,
      authorizeUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      scope: 'repo',
    };
  }
  return null;
}

async function buildAuthorizeRedirect(
  request: FastifyRequest,
  provider: ConnectorProvider,
  userId: string,
): Promise<AuthorizeRedirectOk | AuthorizeRedirectErr> {
  if (provider === 'google' || provider === 'google_drive') {
    if (!isGoogleOAuthConfigured()) {
      return {
        status: 503,
        error: 'Google OAuth が設定されていません (GOOGLE_OAUTH_CLIENT_ID/SECRET)',
      };
    }
    const redirectUri = buildGoogleRedirectUri({
      host: request.headers.host,
      'x-forwarded-host': request.headers['x-forwarded-host'] as string | undefined,
      'x-forwarded-proto': request.headers['x-forwarded-proto'] as string | undefined,
    });
    const config = loadGoogleOAuthConfig(redirectUri);
    const client = createGoogleOAuth2Client(config);
    const scopes = aggregateScopesForProvider('google');
    const state = await createOAuthState({
      userId,
      provider: 'google',
      redirectUri,
    });
    const authorizeUrl = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [...scopes],
      state,
      include_granted_scopes: true,
    });
    return { authorizeUrl, state };
  }

  // API-key based: user submits a token through /api/auth/oauth/:provider/api-key
  if (provider === 'chatwork' || provider === 'line' || provider === 'custom_mcp') {
    return {
      status: 400,
      error: `${provider} is API-key based — POST /api/auth/oauth/${provider}/api-key with { token } instead of starting an OAuth flow`,
    };
  }

  const app = loadOAuthAppConfig(provider);
  if (!app) {
    return {
      status: 503,
      error: `${provider.toUpperCase()}_OAUTH_CLIENT_ID / _SECRET が未設定です`,
    };
  }
  const redirectUri = buildGenericRedirectUri(request, provider);
  const state = await createOAuthState({ userId, provider, redirectUri });
  const qs = new URLSearchParams({
    client_id: app.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  });
  if (app.scope) qs.set('scope', app.scope);
  if (provider === 'notion') qs.set('owner', 'user');
  return { authorizeUrl: `${app.authorizeUrl}?${qs.toString()}`, state };
}

interface ExchangeOk {
  bundle: {
    accessToken: string;
    refreshToken: string | null;
    expiresAt: Date | null;
    scopes: readonly string[];
  };
}

interface ExchangeErr {
  error: string;
  status: number;
}

async function exchangeCodeForTokens(
  provider: ConnectorProvider,
  code: string,
  redirectUri: string,
): Promise<ExchangeOk | ExchangeErr> {
  if (provider === 'google' || provider === 'google_drive') {
    if (!isGoogleOAuthConfigured()) {
      return { status: 503, error: 'Google OAuth is not configured' };
    }
    const config = loadGoogleOAuthConfig(redirectUri);
    const client = createGoogleOAuth2Client(config);
    const { tokens } = await client.getToken(code);
    if (!tokens.access_token) {
      return { status: 502, error: 'Google がアクセストークンを返しませんでした' };
    }
    const scopes = typeof tokens.scope === 'string' ? tokens.scope.split(' ') : [];
    return {
      bundle: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        scopes,
      },
    };
  }

  const app = loadOAuthAppConfig(provider);
  if (!app) {
    return { status: 501, error: `プロバイダ ${provider} はまだ実装されていません` };
  }

  const body = new URLSearchParams({
    client_id: app.clientId,
    client_secret: app.clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch(app.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });
  let json: Record<string, unknown> = {};
  try {
    json = (await res.json()) as Record<string, unknown>;
  } catch {
    return { status: 502, error: `${provider} token endpoint: bad JSON` };
  }
  if (res.status < 200 || res.status >= 300) {
    return { status: 502, error: `${provider} token endpoint ${res.status}` };
  }
  // Slack's oauth.v2.access returns nested { authed_user, access_token (bot) }
  let accessToken: string | null =
    typeof json.access_token === 'string' ? json.access_token : null;
  if (!accessToken && provider === 'slack') {
    const botToken = (json as { access_token?: string }).access_token;
    if (typeof botToken === 'string') accessToken = botToken;
  }
  if (!accessToken) {
    return { status: 502, error: `${provider} returned no access_token` };
  }
  const refreshToken =
    typeof json.refresh_token === 'string' ? json.refresh_token : null;
  const expiresIn =
    typeof json.expires_in === 'number' ? json.expires_in : null;
  const scopeRaw =
    typeof json.scope === 'string' ? json.scope : '';
  const scopes = scopeRaw ? scopeRaw.split(/[,\s]+/).filter(Boolean) : [];
  return {
    bundle: {
      accessToken,
      refreshToken,
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
      scopes,
    },
  };
}
