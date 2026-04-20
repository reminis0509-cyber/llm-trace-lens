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

async function buildAuthorizeRedirect(
  request: FastifyRequest,
  provider: ConnectorProvider,
  userId: string,
): Promise<AuthorizeRedirectOk | AuthorizeRedirectErr> {
  if (provider === 'google') {
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
      provider,
      redirectUri,
    });
    const authorizeUrl = client.generateAuthUrl({
      access_type: 'offline', // issue refresh token
      prompt: 'consent',      // force refresh token re-issue on reconnect
      scope: [...scopes],
      state,
      include_granted_scopes: true,
    });
    return { authorizeUrl, state };
  }

  return {
    status: 501,
    error: `プロバイダ ${provider} はまだ実装されていません`,
  };
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
  if (provider === 'google') {
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
  return { status: 501, error: `プロバイダ ${provider} はまだ実装されていません` };
}
