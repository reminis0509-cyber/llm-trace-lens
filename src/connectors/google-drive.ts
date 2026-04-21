/**
 * google-drive.ts — Google Drive connector.
 *
 * Actions:
 *   - listFiles  : { query?, pageSize? } → files[]
 *   - uploadFile : { filename, mimeType, contentBase64, parentId? }
 *
 * Scope: drive.file (app-owned files only).
 *
 * Piggy-backs on the existing `google` OAuth connection. A user who has
 * only granted Calendar/Gmail scopes will hit a 403 from the Drive API;
 * the handler surfaces that as `provider_error`.
 */
import {
  loadConnectorToken,
  isConnectorLinked,
} from '../auth/oauth/oauth-flow.js';
import {
  createGoogleOAuth2Client,
  loadGoogleOAuthConfig,
} from '../auth/oauth/google-oauth.js';
import { google } from 'googleapis';
import { Readable } from 'stream';
import type { Connector, ConnectorActionResult } from './base.js';
import { connectorOk, connectorErr } from './base.js';

export const GOOGLE_DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
] as const;

const ACTIONS = ['listFiles', 'uploadFile'] as const;
type DriveAction = (typeof ACTIONS)[number];

function isDriveAction(v: string): v is DriveAction {
  return (ACTIONS as readonly string[]).includes(v);
}

interface ListFilesParams {
  query?: string;
  pageSize?: number;
}

function isListFilesParams(v: unknown): v is ListFilesParams {
  if (v === undefined || v === null) return true;
  if (typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (o.query !== undefined && typeof o.query !== 'string') return false;
  if (o.pageSize !== undefined && typeof o.pageSize !== 'number') return false;
  return true;
}

interface UploadFileParams {
  filename: string;
  mimeType: string;
  contentBase64: string;
  parentId?: string;
}

function isUploadFileParams(v: unknown): v is UploadFileParams {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.filename === 'string' &&
    typeof o.mimeType === 'string' &&
    typeof o.contentBase64 === 'string' &&
    (o.parentId === undefined || typeof o.parentId === 'string')
  );
}

async function buildDriveClient(userId: string) {
  const bundle = await loadConnectorToken(userId, 'google');
  if (!bundle) return null;
  const config = loadGoogleOAuthConfig('');
  const oauth2 = createGoogleOAuth2Client(config);
  oauth2.setCredentials({
    access_token: bundle.accessToken,
    refresh_token: bundle.refreshToken ?? undefined,
    expiry_date: bundle.expiresAt ? bundle.expiresAt.getTime() : undefined,
  });
  return google.drive({ version: 'v3', auth: oauth2 });
}

export const googleDriveConnector: Connector = {
  provider: 'google',
  requiredScopes: GOOGLE_DRIVE_SCOPES,

  async isConnected(userId: string): Promise<boolean> {
    return isConnectorLinked(userId, 'google');
  },

  async execute(userId, action, params): Promise<ConnectorActionResult> {
    if (!isDriveAction(action)) {
      return connectorErr(`Unknown drive action: ${action}`, 'unknown_action');
    }
    const client = await buildDriveClient(userId);
    if (!client) {
      return connectorErr('Google Drive is not connected for this user', 'not_connected');
    }

    try {
      if (action === 'listFiles') {
        if (!isListFilesParams(params)) {
          return connectorErr('listFiles: invalid params', 'invalid_params');
        }
        const res = await client.files.list({
          q: params?.query,
          pageSize: Math.max(1, Math.min(100, params?.pageSize ?? 30)),
          fields: 'files(id, name, mimeType, modifiedTime, size)',
        });
        return connectorOk({ files: res.data.files ?? [] });
      }
      if (action === 'uploadFile') {
        if (!isUploadFileParams(params)) {
          return connectorErr('uploadFile: filename/mimeType/contentBase64 required', 'invalid_params');
        }
        const buffer = Buffer.from(params.contentBase64, 'base64');
        const res = await client.files.create({
          requestBody: {
            name: params.filename,
            mimeType: params.mimeType,
            parents: params.parentId ? [params.parentId] : undefined,
          },
          media: {
            mimeType: params.mimeType,
            body: Readable.from(buffer),
          },
          fields: 'id, name, mimeType, webViewLink',
        });
        return connectorOk({ file: res.data });
      }
      return connectorErr(`Unhandled drive action: ${action as string}`, 'unknown_action');
    } catch (err) {
      return connectorErr(formatError(err), 'provider_error');
    }
  },
};

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
