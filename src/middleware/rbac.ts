/**
 * RBAC (Role-Based Access Control) Middleware
 * Handles user authentication via Supabase and role-based access control
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import type { Role, UserInfo } from '../types/rbac.js';
import { getKnex } from '../storage/knex-client.js';

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
 * Extract user info from request headers
 * Frontend should pass X-User-ID and X-User-Email from Supabase session
 */
function extractUserInfo(request: FastifyRequest): UserInfo | null {
  const userId = request.headers['x-user-id'] as string | undefined;
  const userEmail = request.headers['x-user-email'] as string | undefined;

  // Try to extract from Supabase JWT in Authorization header (if Bearer token is a Supabase JWT)
  // For now, we rely on frontend passing user info via headers
  if (userId && userEmail) {
    return {
      id: userId,
      email: userEmail.toLowerCase(),
    };
  }

  // Fallback: check session cookie
  const sessionId = (request.headers.cookie || '').match(/session_id=([^;]+)/)?.[1];
  if (sessionId) {
    // For session-based auth, the session should already be validated upstream
    // We would need to import the session service to get user info
    // For now, return null and require headers
    return null;
  }

  return null;
}

async function rbacPlugin(fastify: FastifyInstance) {
  const db = getKnex();

  // Add user info extraction hook
  fastify.addHook('preHandler', async (request) => {
    const userInfo = extractUserInfo(request);
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
            message: 'User authentication required. Please login.',
          });
          return;
        }

        if (!workspaceId) {
          reply.status(400).send({
            error: 'Bad Request',
            message: 'workspaceId is required',
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
            message: 'You do not have access to this workspace',
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
          reply.status(403).send({
            error: 'Forbidden',
            message: `This action requires ${requiredRole} permission or higher`,
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
