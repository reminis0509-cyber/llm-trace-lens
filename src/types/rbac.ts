/**
 * RBAC (Role-Based Access Control) types
 * For workspace member management and permissions
 */

export type Role = 'owner' | 'admin' | 'member';

export interface WorkspaceUser {
  id: string;
  workspace_id: string;
  email: string;
  role: Role;
  invited_by: string | null;
  created_at: Date;
}

export interface Invitation {
  token: string;
  workspace_id: string;
  invited_by_email: string;
  email: string | null;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

export interface UserInfo {
  id: string;
  email: string;
}

// Fastify type extensions for RBAC
declare module 'fastify' {
  interface FastifyRequest {
    user?: UserInfo;
    workspaceRole?: Role;
  }
}
