import { ConfidentialClientApplication, AuthenticationResult } from '@azure/msal-node';
import { kv } from '@vercel/kv';
import { createWorkspace, createApiKeyForWorkspace } from '../kv/client.js';

let msalClient: ConfidentialClientApplication | null = null;

export interface MicrosoftUser {
  email: string;
  name?: string;
  oid?: string; // Object ID
  tenant?: string;
}

export interface MicrosoftAuthResult {
  success: boolean;
  user?: MicrosoftUser;
  workspaceId?: string;
  error?: string;
}

/**
 * Initialize MSAL client
 */
function getMsalClient(): ConfidentialClientApplication | null {
  if (msalClient) return msalClient;

  const clientId = process.env.AZURE_AD_CLIENT_ID;
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
  const tenantId = process.env.AZURE_AD_TENANT_ID || 'common';

  if (!clientId || !clientSecret) {
    return null;
  }

  msalClient = new ConfidentialClientApplication({
    auth: {
      clientId,
      clientSecret,
      authority: `https://login.microsoftonline.com/${tenantId}`
    }
  });

  return msalClient;
}

/**
 * Get Microsoft OAuth authorization URL
 */
export function getMicrosoftAuthUrl(redirectUri: string, state?: string): string | null {
  const client = getMsalClient();
  if (!client) return null;

  const authUrl = `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID || 'common'}/oauth2/v2.0/authorize`;
  const params = new URLSearchParams({
    client_id: process.env.AZURE_AD_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'openid profile email',
    state: state || ''
  });

  return `${authUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeMicrosoftCode(
  code: string,
  redirectUri: string
): Promise<MicrosoftAuthResult> {
  const client = getMsalClient();
  if (!client) {
    return { success: false, error: 'MSAL client not configured' };
  }

  try {
    const result: AuthenticationResult = await client.acquireTokenByCode({
      code,
      redirectUri,
      scopes: ['openid', 'profile', 'email']
    });

    if (!result.account) {
      return { success: false, error: 'No account in token response' };
    }

    const user: MicrosoftUser = {
      email: result.account.username,
      name: result.account.name || undefined,
      oid: result.account.localAccountId,
      tenant: result.account.tenantId
    };

    // Get or create workspace for user
    const workspaceId = await getOrCreateWorkspaceForMicrosoftUser(user.email);

    return {
      success: true,
      user,
      workspaceId
    };
  } catch (error) {
    console.error('Microsoft token exchange failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Token exchange failed'
    };
  }
}

/**
 * Get or create workspace for a Microsoft user
 */
async function getOrCreateWorkspaceForMicrosoftUser(email: string): Promise<string> {
  const userWorkspaceKey = `user:${email}:workspace`;

  // Check if KV is available
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return 'default';
  }

  try {
    const existingWorkspaceId = await kv.get<string>(userWorkspaceKey);
    if (existingWorkspaceId) {
      return existingWorkspaceId;
    }

    const workspace = await createWorkspace(`${email}'s Workspace`);
    await kv.set(userWorkspaceKey, workspace.id);
    await kv.sadd(`workspace:${workspace.id}:users`, email);
    await createApiKeyForWorkspace(workspace.id, 'Default Key');

    return workspace.id;
  } catch (error) {
    console.error('Failed to get/create workspace for Microsoft user:', error);
    throw new Error('Workspace creation failed');
  }
}

/**
 * Check if Microsoft auth is configured
 */
export function isMicrosoftAuthConfigured(): boolean {
  return !!(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET);
}
