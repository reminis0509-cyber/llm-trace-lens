import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
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

    const state = Math.random().toString(36).substring(7);
    const authUrl = getMicrosoftAuthUrl(redirectUri, state);

    if (!authUrl) {
      return reply.code(500).send({
        success: false,
        error: 'Failed to generate auth URL'
      });
    }

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

      // For browser-based flows, redirect to dashboard with session
      // For API flows, return JSON
      const acceptHeader = request.headers.accept || '';
      if (acceptHeader.includes('text/html')) {
        // Redirect to dashboard with session token in query
        return reply.redirect(`/dashboard?session=${sessionId}`);
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
