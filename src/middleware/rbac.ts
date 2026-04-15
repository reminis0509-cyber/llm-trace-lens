/**
 * RBAC (Role-Based Access Control) Middleware
 * Handles user authentication via verified session cookies, Supabase JWTs,
 * and role-based access control.
 *
 * SECURITY: User identity is NEVER derived from client-supplied headers
 * (e.g. X-User-ID, X-User-Email). Identity is verified server-side only.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import type { Role, UserInfo } from '../types/rbac.js';
import { getKnex } from '../storage/knex-client.js';
import { getSession } from '../auth/google.js';

// Extend Fastify types
declare module 'fastify' {
  interface FastifyInstance {
    requireRole: (
      requiredRole: Role
    ) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user?: UserInfo;
    workspaceRole?: Role;
  }
}

/**
 * Supabase user response shape (subset of fields we need)
 */
interface SupabaseUserResponse {
  id: string;
  email?: string;
}

/**
 * Extract user info from verified authentication sources only.
 *
 * Authentication is attempted in the following order:
 * 1. Session cookie — validated via getSession() against KV store
 * 2. Supabase JWT — verified by calling the Supabase Auth API
 *
 * Returns null if no valid authentication is found (triggers 401/403 downstream).
 */
async function extractUserInfo(request: FastifyRequest): Promise<UserInfo | null> {
  // 1. Try session cookie (set during OAuth callback flows)
  const sessionId = (request.headers.cookie || '').match(/session_id=([^;]+)/)?.[1];
  if (sessionId) {
    try {
      const session = await getSession(sessionId);
      if (session) {
        return {
          id: session.email, // session stores email as primary identifier
          email: session.email.toLowerCase(),
        };
      }
    } catch (err: unknown) {
      request.log.warn({ err }, 'Failed to validate session cookie');
    }
  }

  // 2. Try Supabase JWT from Authorization header
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const supabaseUrl = process.env['SUPABASE_URL'] || process.env['VITE_SUPABASE_URL'];
    const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'] || process.env['VITE_SUPABASE_ANON_KEY'];

    if (supabaseUrl && supabaseAnonKey && token.length > 0) {
      try {
        const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'apikey': supabaseAnonKey,
          },
        });

        if (response.ok) {
          const userData = (await response.json()) as SupabaseUserResponse;
          if (userData.id && userData.email) {
            return {
              id: userData.id,
              email: userData.email.toLowerCase(),
            };
          }
        }
      } catch (err: unknown) {
        request.log.warn({ err }, 'Failed to verify Supabase JWT');
      }
    }
  }

  // No valid authentication found. If the client nevertheless sent an
  // `x-user-email` header, that is a potential spoofing attempt (legacy
  // clients should no longer send it, and fresh clients never did). Log at
  // error level as an attack signal, but continue returning null so the
  // downstream 401 path behaves identically.
  if (request.headers['x-user-email']) {
    request.log.error(
      { header: 'x-user-email', path: request.url },
      'Client sent x-user-email header without valid auth — potential spoof attempt',
    );
  }
  return null;
}

async function rbacPlugin(fastify: FastifyInstance) {
  const db = getKnex();

  // Add user info extraction hook
  fastify.addHook('preHandler', async (request) => {
    const userInfo = await extractUserInfo(request);
    if (userInfo) {
      request.user = userInfo;
    }
  });

  // Decorate with requireRole function
  fastify.decorate(
    'requireRole',
    (requiredRole: Role) =>
      async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
        const userEmail = req.user?.email;

        // Get workspaceId from URL params, body, or header
        const workspaceId =
          (req.params as Record<string, string>)?.workspaceId ||
          (req.body as Record<string, string>)?.workspaceId ||
          (req.headers['x-workspace-id'] as string) ||
          req.workspace?.workspaceId; // Fallback to workspace from auth middleware

        if (!userEmail) {
          reply.status(401).send({
            error: 'Unauthorized',
            message: 'ユーザー認証が必要です。ログインしてください。',
          });
          return;
        }

        if (!workspaceId) {
          reply.status(400).send({
            error: 'Bad Request',
            message: 'ワークスペースIDが必要です',
          });
          return;
        }

        // Check user's role in workspace
        const membership = await db('workspace_users')
          .where({
            workspace_id: workspaceId,
            email: userEmail,
          })
          .first();

        if (!membership) {
          reply.status(403).send({
            error: 'Forbidden',
            message: 'このワークスペースへのアクセス権限がありません',
          });
          return;
        }

        // Role hierarchy: owner > admin > member
        const roleHierarchy: Record<Role, number> = {
          owner: 3,
          admin: 2,
          member: 1,
        };

        const userRoleLevel = roleHierarchy[membership.role as Role] || 0;
        const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

        if (userRoleLevel < requiredRoleLevel) {
          const roleNames: Record<string, string> = { owner: 'オーナー', admin: '管理者', member: 'メンバー' };
          reply.status(403).send({
            error: 'Forbidden',
            message: `この操作には${roleNames[requiredRole] || requiredRole}以上の権限が必要です`,
          });
          return;
        }

        // Set role on request for later use
        req.workspaceRole = membership.role as Role;
      }
  );
}

export default fp(rbacPlugin, { name: 'rbac' });

/**
 * Get user's role in a workspace
 * Can be used directly without middleware
 */
export async function getUserWorkspaceRole(
  email: string,
  workspaceId: string
): Promise<Role | null> {
  const db = getKnex();
  const membership = await db('workspace_users')
    .where({
      workspace_id: workspaceId,
      email: email.toLowerCase(),
    })
    .first();

  return membership?.role as Role | null;
}

/**
 * Check if user is owner of workspace
 */
export async function isWorkspaceOwner(
  email: string,
  workspaceId: string
): Promise<boolean> {
  const role = await getUserWorkspaceRole(email, workspaceId);
  return role === 'owner';
}

/**
 * Check if user has at least member access to workspace
 */
export async function hasWorkspaceAccess(
  email: string,
  workspaceId: string
): Promise<boolean> {
  const role = await getUserWorkspaceRole(email, workspaceId);
  return role !== null;
}
