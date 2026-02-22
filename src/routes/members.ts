/**
 * Member Management Routes
 * Handles workspace member invitations, listing, and role management
 */
import { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getKnex } from '../storage/knex-client.js';
import type { Role, Invitation, WorkspaceUser } from '../types/rbac.js';

/**
 * Add days to a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export default async function membersRoutes(fastify: FastifyInstance) {
  const db = getKnex();

  /**
   * POST /api/workspaces/:workspaceId/invitations
   * Create invitation link (owner/admin only)
   */
  fastify.post<{
    Params: { workspaceId: string };
    Body: { email?: string };
  }>(
    '/api/workspaces/:workspaceId/invitations',
    { preHandler: fastify.requireRole('admin') },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { email } = request.body ?? {};
      const userEmail = request.user!.email;

      const token = randomBytes(24).toString('hex');
      const expiresAt = addDays(new Date(), 7);

      await db('invitations').insert({
        token,
        workspace_id: workspaceId,
        invited_by_email: userEmail,
        email: email?.toLowerCase() ?? null,
        expires_at: expiresAt,
      });

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const inviteLink = `${frontendUrl}/invite/accept?token=${token}`;

      return reply.send({
        inviteLink,
        expiresAt: expiresAt.toISOString(),
        message: 'Share this link with the person you want to invite (valid for 7 days)',
      });
    }
  );

  /**
   * POST /api/invitations/accept
   * Accept an invitation and join workspace
   */
  fastify.post<{ Body: { token: string } }>(
    '/api/invitations/accept',
    async (request, reply) => {
      const { token } = request.body ?? {};
      const userEmail = request.user?.email;

      if (!userEmail) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Please login to accept the invitation',
        });
      }

      if (!token) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invitation token is required',
        });
      }

      const invitation = await db('invitations')
        .where({ token })
        .where('expires_at', '>', new Date())
        .whereNull('used_at')
        .first() as Invitation | undefined;

      if (!invitation) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Invitation is invalid or has expired',
        });
      }

      // Check if invitation is restricted to specific email
      if (invitation.email && invitation.email !== userEmail.toLowerCase()) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'This invitation is not for you',
        });
      }

      // Check if already a member
      const existing = await db('workspace_users')
        .where({
          workspace_id: invitation.workspace_id,
          email: userEmail.toLowerCase(),
        })
        .first() as WorkspaceUser | undefined;

      if (existing) {
        return reply.send({
          success: true,
          workspaceId: invitation.workspace_id,
          message: 'You are already a member of this workspace',
          role: existing.role,
        });
      }

      // Add user to workspace as member
      await db.transaction(async (trx) => {
        await trx('workspace_users').insert({
          id: uuidv4(),
          workspace_id: invitation.workspace_id,
          email: userEmail.toLowerCase(),
          role: 'member',
          invited_by: invitation.invited_by_email,
        });

        await trx('invitations')
          .where({ token })
          .update({ used_at: new Date() });
      });

      return reply.send({
        success: true,
        workspaceId: invitation.workspace_id,
        role: 'member',
      });
    }
  );

  /**
   * GET /api/workspaces/:workspaceId/members
   * List workspace members (member+ access)
   */
  fastify.get<{ Params: { workspaceId: string } }>(
    '/api/workspaces/:workspaceId/members',
    { preHandler: fastify.requireRole('member') },
    async (request, reply) => {
      const { workspaceId } = request.params;

      const members = await db('workspace_users')
        .where({ workspace_id: workspaceId })
        .select('id', 'email', 'role', 'invited_by', 'created_at')
        .orderBy('created_at', 'asc');

      return reply.send(members);
    }
  );

  /**
   * DELETE /api/workspaces/:workspaceId/members/:memberId
   * Remove a member from workspace (admin+ only)
   */
  fastify.delete<{ Params: { workspaceId: string; memberId: string } }>(
    '/api/workspaces/:workspaceId/members/:memberId',
    { preHandler: fastify.requireRole('admin') },
    async (request, reply) => {
      const { workspaceId, memberId } = request.params;
      const requesterEmail = request.user!.email;

      // Get member to be removed
      const member = await db('workspace_users')
        .where({ workspace_id: workspaceId, id: memberId })
        .first() as WorkspaceUser | undefined;

      if (!member) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Member not found',
        });
      }

      // Prevent self-removal
      if (member.email === requesterEmail) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'You cannot remove yourself from the workspace',
        });
      }

      // Prevent removing owner (only owner can leave or be removed by another owner)
      if (member.role === 'owner' && request.workspaceRole !== 'owner') {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Only owners can remove other owners',
        });
      }

      // Count owners to prevent removing the last owner
      if (member.role === 'owner') {
        const ownerCount = await db('workspace_users')
          .where({ workspace_id: workspaceId, role: 'owner' })
          .count('* as count')
          .first();

        if ((ownerCount?.count as number) <= 1) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Cannot remove the last owner of the workspace',
          });
        }
      }

      await db('workspace_users')
        .where({ workspace_id: workspaceId, id: memberId })
        .delete();

      return reply.send({ success: true });
    }
  );

  /**
   * PATCH /api/workspaces/:workspaceId/members/:memberId/role
   * Update member role (owner only)
   */
  fastify.patch<{
    Params: { workspaceId: string; memberId: string };
    Body: { role: string };
  }>(
    '/api/workspaces/:workspaceId/members/:memberId/role',
    { preHandler: fastify.requireRole('owner') },
    async (request, reply) => {
      const { workspaceId, memberId } = request.params;
      const { role } = request.body ?? {};
      const requesterEmail = request.user!.email;

      if (!['owner', 'admin', 'member'].includes(role)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid role. Must be owner, admin, or member',
        });
      }

      // Get member
      const member = await db('workspace_users')
        .where({ workspace_id: workspaceId, id: memberId })
        .first() as WorkspaceUser | undefined;

      if (!member) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Member not found',
        });
      }

      // Prevent demoting last owner
      if (member.role === 'owner' && role !== 'owner') {
        const ownerCount = await db('workspace_users')
          .where({ workspace_id: workspaceId, role: 'owner' })
          .count('* as count')
          .first();

        if ((ownerCount?.count as number) <= 1) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Cannot demote the last owner',
          });
        }
      }

      await db('workspace_users')
        .where({ workspace_id: workspaceId, id: memberId })
        .update({ role });

      return reply.send({ success: true, role });
    }
  );

  /**
   * GET /api/workspaces/:workspaceId/invitations
   * List pending invitations (admin+ only)
   */
  fastify.get<{ Params: { workspaceId: string } }>(
    '/api/workspaces/:workspaceId/invitations',
    { preHandler: fastify.requireRole('admin') },
    async (request, reply) => {
      const { workspaceId } = request.params;

      const invitations = await db('invitations')
        .where({ workspace_id: workspaceId })
        .whereNull('used_at')
        .where('expires_at', '>', new Date())
        .select('token', 'email', 'invited_by_email', 'expires_at', 'created_at')
        .orderBy('created_at', 'desc');

      return reply.send(invitations);
    }
  );

  /**
   * DELETE /api/workspaces/:workspaceId/invitations/:token
   * Revoke an invitation (admin+ only)
   */
  fastify.delete<{ Params: { workspaceId: string; token: string } }>(
    '/api/workspaces/:workspaceId/invitations/:token',
    { preHandler: fastify.requireRole('admin') },
    async (request, reply) => {
      const { workspaceId, token } = request.params;

      const deleted = await db('invitations')
        .where({ workspace_id: workspaceId, token })
        .delete();

      if (!deleted) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Invitation not found',
        });
      }

      return reply.send({ success: true });
    }
  );

  /**
   * GET /api/workspaces/:workspaceId/my-role
   * Get current user's role in workspace
   */
  fastify.get<{ Params: { workspaceId: string } }>(
    '/api/workspaces/:workspaceId/my-role',
    async (request, reply) => {
      const { workspaceId } = request.params;
      const userEmail = request.user?.email;

      if (!userEmail) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const membership = await db('workspace_users')
        .where({
          workspace_id: workspaceId,
          email: userEmail.toLowerCase(),
        })
        .first();

      return reply.send({
        role: membership?.role ?? null,
        isMember: !!membership,
      });
    }
  );

  /**
   * GET /api/my-workspaces
   * List workspaces current user belongs to
   */
  fastify.get('/api/my-workspaces', async (request, reply) => {
    const userEmail = request.user?.email;

    if (!userEmail) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const memberships = await db('workspace_users')
      .where({ email: userEmail.toLowerCase() })
      .join('workspaces', 'workspace_users.workspace_id', 'workspaces.id')
      .select(
        'workspaces.id',
        'workspaces.name',
        'workspace_users.role',
        'workspace_users.created_at as joined_at'
      )
      .orderBy('workspace_users.created_at', 'desc');

    return reply.send(memberships);
  });
}
