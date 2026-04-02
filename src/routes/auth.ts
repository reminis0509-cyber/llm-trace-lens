import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomBytes } from 'crypto';
import { verifyGoogleToken, createSession, getSession, invalidateSession } from '../auth/google.js';
import { exchangeMicrosoftCode, getMicrosoftAuthUrl, isMicrosoftAuthConfigured } from '../auth/microsoft.js';

interface GoogleAuthBody {
  token: string;
}

interface MicrosoftCallbackQuery {
  code: string;
  state?: string;
}

interface SessionQuery {
  sessionId: string;
}

// ===========================
// OAuth State Store for CSRF Protection
// ===========================

/** TTL for OAuth state tokens: 10 minutes (milliseconds) */
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

/** In-memory store for OAuth state tokens with automatic TTL cleanup */
const oauthStateStore = new Map<string, NodeJS.Timeout>();

/**
 * Store an OAuth state token with automatic expiry.
 * The token is deleted after OAUTH_STATE_TTL_MS or upon successful validation.
 */
function storeOAuthState(state: string): void {
  // Clear any existing timer for this state (defensive)
  const existingTimer = oauthStateStore.get(state);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(() => {
    oauthStateStore.delete(state);
  }, OAUTH_STATE_TTL_MS);

  // Prevent the timer from keeping the Node.js process alive
  timer.unref();

  oauthStateStore.set(state, timer);
}

/**
 * Validate and consume an OAuth state token (one-time use).
 * Returns true if the state was valid, false otherwise.
 */
function consumeOAuthState(state: string): boolean {
  const timer = oauthStateStore.get(state);
  if (!timer) {
    return false;
  }

  clearTimeout(timer);
  oauthStateStore.delete(state);
  return true;
}

/**
 * Auth routes for OAuth/SSO
 */
export default async function authRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /auth/providers
   * Get available authentication providers
   */
  fastify.get('/auth/providers', async (_request, reply) => {
    const providers = [];

    if (process.env.GOOGLE_CLIENT_ID) {
      providers.push({
        name: 'google',
        displayName: 'Google',
        configured: true
      });
    }

    if (isMicrosoftAuthConfigured()) {
      providers.push({
        name: 'microsoft',
        displayName: 'Microsoft',
        configured: true
      });
    }

    return reply.send({
      providers,
      apiKeyAuthEnabled: process.env.ENABLE_AUTH === 'true'
    });
  });

  /**
   * POST /auth/google
   * Authenticate with Google ID token
   */
  fastify.post<{ Body: GoogleAuthBody }>(
    '/auth/google',
    async (request: FastifyRequest<{ Body: GoogleAuthBody }>, reply: FastifyReply) => {
      const { token } = request.body;

      if (!token) {
        return reply.code(400).send({
          success: false,
          error: 'Token is required'
        });
      }

      if (!process.env.GOOGLE_CLIENT_ID) {
        return reply.code(500).send({
          success: false,
          error: 'Google OAuth not configured'
        });
      }

      const result = await verifyGoogleToken(token);

      if (!result.success) {
        return reply.code(401).send({
          success: false,
          error: result.error || 'Authentication failed'
        });
      }

      // Create session
      const sessionId = await createSession(result.user!.email, result.workspaceId!);

      return reply.send({
        success: true,
        user: {
          email: result.user!.email,
          name: result.user!.name
        },
        workspaceId: result.workspaceId,
        sessionId
      });
    }
  );

  /**
   * GET /auth/microsoft
   * Get Microsoft OAuth authorization URL
   */
  fastify.get('/auth/microsoft', async (request, reply) => {
    if (!isMicrosoftAuthConfigured()) {
      return reply.code(500).send({
        success: false,
        error: 'Microsoft OAuth not configured'
      });
    }

    const protocol = request.headers['x-forwarded-proto'] || 'http';
    const host = request.headers['x-forwarded-host'] || request.headers.host;
    const redirectUri = `${protocol}://${host}/auth/microsoft/callback`;

    // Security: Use cryptographically secure random bytes for OAuth CSRF state parameter
    const state = randomBytes(16).toString('hex');
    const authUrl = getMicrosoftAuthUrl(redirectUri, state);

    if (!authUrl) {
      return reply.code(500).send({
        success: false,
        error: 'Failed to generate auth URL'
      });
    }

    // Store state server-side for validation in the callback (10-minute TTL)
    storeOAuthState(state);

    return reply.send({
      authUrl,
      state
    });
  });

  /**
   * GET /auth/microsoft/callback
   * Handle Microsoft OAuth callback
   */
  fastify.get<{ Querystring: MicrosoftCallbackQuery }>(
    '/auth/microsoft/callback',
    async (request: FastifyRequest<{ Querystring: MicrosoftCallbackQuery }>, reply: FastifyReply) => {
      const { code, state } = request.query;

      if (!code) {
        return reply.code(400).send({
          success: false,
          error: 'Authorization code is required'
        });
      }

      // Security: Validate OAuth state parameter to prevent CSRF attacks
      if (!state) {
        request.log.warn('Microsoft OAuth callback missing state parameter');
        return reply.code(400).send({
          success: false,
          error: 'Missing state parameter. Please restart the authentication flow.'
        });
      }

      if (!consumeOAuthState(state)) {
        request.log.warn('Microsoft OAuth callback received invalid or expired state parameter');
        return reply.code(400).send({
          success: false,
          error: 'Invalid or expired state parameter. Please restart the authentication flow.'
        });
      }

      const protocol = request.headers['x-forwarded-proto'] || 'http';
      const host = request.headers['x-forwarded-host'] || request.headers.host;
      const redirectUri = `${protocol}://${host}/auth/microsoft/callback`;

      const result = await exchangeMicrosoftCode(code, redirectUri);

      if (!result.success) {
        return reply.code(401).send({
          success: false,
          error: result.error || 'Authentication failed'
        });
      }

      // Create session
      const sessionId = await createSession(result.user!.email, result.workspaceId!);

      // For browser-based flows, set session cookie and redirect
      // For API flows, return JSON
      const acceptHeader = request.headers.accept || '';
      if (acceptHeader.includes('text/html')) {
        reply.header('Set-Cookie',
          `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
        );
        return reply.redirect('/dashboard');
      }

      return reply.send({
        success: true,
        user: {
          email: result.user!.email,
          name: result.user!.name
        },
        workspaceId: result.workspaceId,
        sessionId
      });
    }
  );

  /**
   * GET /auth/session
   * Get current session info
   */
  fastify.get<{ Querystring: SessionQuery }>(
    '/auth/session',
    async (request: FastifyRequest<{ Querystring: SessionQuery }>, reply: FastifyReply) => {
      const { sessionId } = request.query;

      if (!sessionId) {
        return reply.code(400).send({
          success: false,
          error: 'Session ID is required'
        });
      }

      const session = await getSession(sessionId);

      if (!session) {
        return reply.code(401).send({
          success: false,
          error: 'Invalid or expired session'
        });
      }

      return reply.send({
        success: true,
        session: {
          email: session.email,
          workspaceId: session.workspaceId
        }
      });
    }
  );

  /**
   * POST /auth/logout
   * Invalidate session
   */
  fastify.post<{ Body: { sessionId: string } }>(
    '/auth/logout',
    async (request: FastifyRequest<{ Body: { sessionId: string } }>, reply: FastifyReply) => {
      const { sessionId } = request.body;

      if (!sessionId) {
        return reply.code(400).send({
          success: false,
          error: 'Session ID is required'
        });
      }

      await invalidateSession(sessionId);

      return reply.send({
        success: true,
        message: 'Logged out successfully'
      });
    }
  );
}
