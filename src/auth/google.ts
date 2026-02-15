import { OAuth2Client } from 'google-auth-library';
import { kv } from '@vercel/kv';
import { createWorkspace, createApiKeyForWorkspace, getWorkspace } from '../kv/client.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export interface GoogleUser {
  email: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
}

export interface AuthResult {
  success: boolean;
  user?: GoogleUser;
  workspaceId?: string;
  error?: string;
}

/**
 * Verify Google ID token and return user info
 */
export async function verifyGoogleToken(token: string): Promise<AuthResult> {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return { success: false, error: 'Invalid token payload' };
    }

    const user: GoogleUser = {
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      email_verified: payload.email_verified,
    };

    // Get or create workspace for this user
    const workspaceId = await getOrCreateWorkspaceForUser(user.email);

    return {
      success: true,
      user,
      workspaceId,
    };
  } catch (error) {
    console.error('Google token verification failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Token verification failed',
    };
  }
}

/**
 * Get or create workspace for a user email
 */
async function getOrCreateWorkspaceForUser(email: string): Promise<string> {
  const userWorkspaceKey = `user:${email}:workspace`;

  // Check if KV is available
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    // Local development - return default workspace
    return 'default';
  }

  try {
    // Check if user already has a workspace
    const existingWorkspaceId = await kv.get<string>(userWorkspaceKey);
    if (existingWorkspaceId) {
      return existingWorkspaceId;
    }

    // Create new workspace for user
    const workspace = await createWorkspace(`${email}'s Workspace`);

    // Associate user with workspace
    await kv.set(userWorkspaceKey, workspace.id);
    await kv.sadd(`workspace:${workspace.id}:users`, email);

    // Create initial API key for the workspace
    await createApiKeyForWorkspace(workspace.id, 'Default Key');

    return workspace.id;
  } catch (error) {
    console.error('Failed to get/create workspace for user:', error);
    throw new Error('Workspace creation failed');
  }
}

/**
 * Get user's workspaces
 */
export async function getUserWorkspaces(email: string): Promise<string[]> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return ['default'];
  }

  try {
    const workspaceId = await kv.get<string>(`user:${email}:workspace`);
    return workspaceId ? [workspaceId] : [];
  } catch (error) {
    console.error('Failed to get user workspaces:', error);
    return [];
  }
}

/**
 * Check if user has access to workspace
 */
export async function userHasWorkspaceAccess(email: string, workspaceId: string): Promise<boolean> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return true; // Allow all in local development
  }

  try {
    const isMember = await kv.sismember(`workspace:${workspaceId}:users`, email);
    return isMember === 1;
  } catch (error) {
    console.error('Failed to check workspace access:', error);
    return false;
  }
}

/**
 * Add user to workspace
 */
export async function addUserToWorkspace(
  email: string,
  workspaceId: string,
  role: 'owner' | 'admin' | 'member' = 'member'
): Promise<boolean> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return true;
  }

  try {
    await kv.sadd(`workspace:${workspaceId}:users`, email);
    await kv.set(`workspace:${workspaceId}:user:${email}:role`, role);
    return true;
  } catch (error) {
    console.error('Failed to add user to workspace:', error);
    return false;
  }
}

/**
 * Create session for authenticated user
 */
export async function createSession(
  email: string,
  workspaceId: string
): Promise<string> {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;

  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    await kv.set(
      `session:${sessionId}`,
      { email, workspaceId, created_at: new Date().toISOString() },
      { ex: 60 * 60 * 24 * 7 } // 7 days
    );
  }

  return sessionId;
}

/**
 * Get session info
 */
export async function getSession(
  sessionId: string
): Promise<{ email: string; workspaceId: string } | null> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return null;
  }

  try {
    const session = await kv.get<{ email: string; workspaceId: string }>(
      `session:${sessionId}`
    );
    return session;
  } catch (error) {
    console.error('Failed to get session:', error);
    return null;
  }
}

/**
 * Invalidate session
 */
export async function invalidateSession(sessionId: string): Promise<void> {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    await kv.del(`session:${sessionId}`);
  }
}
