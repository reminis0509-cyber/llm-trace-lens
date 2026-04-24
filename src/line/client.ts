/**
 * Thin wrapper around `@line/bot-sdk`'s MessagingApiClient.
 *
 * Centralising client construction here lets us
 *   1. lazy-initialise (only when the first webhook arrives) so that
 *      `LINE_CHANNEL_ACCESS_TOKEN` unset in CI does not break module load,
 *   2. expose typed helpers for the handful of message shapes the bridge
 *      actually sends (text / flex / loading animation),
 *   3. keep the raw SDK import surface off the rest of the codebase.
 */
import { messagingApi } from '@line/bot-sdk';
import { lineConfig } from '../config.js';

type LineMessage = messagingApi.Message;
type FlexContainer = messagingApi.FlexContainer;

let cachedClient: messagingApi.MessagingApiClient | null = null;
let cachedBlobClient: messagingApi.MessagingApiBlobClient | null = null;

/**
 * Return a (possibly cached) MessagingApiClient instance, or throw when the
 * LINE integration is not configured.
 */
export function getLineClient(): messagingApi.MessagingApiClient {
  if (!lineConfig.enabled || !lineConfig.channelAccessToken) {
    throw new Error('LINE integration is not configured.');
  }
  if (!cachedClient) {
    cachedClient = new messagingApi.MessagingApiClient({
      channelAccessToken: lineConfig.channelAccessToken,
    });
  }
  return cachedClient;
}

/**
 * Send a reply_token based response (must be within 1 minute of the webhook).
 * Errors are swallowed and returned as `false` so the webhook processing
 * loop does not crash when the reply_token has expired.
 */
export async function replyLineMessage(
  replyToken: string,
  messages: LineMessage[],
): Promise<boolean> {
  try {
    const client = getLineClient();
    await client.replyMessage({ replyToken, messages });
    return true;
  } catch {
    return false;
  }
}

/**
 * Push-send one or more messages to a LINE user. Used after Contract runtime
 * finishes (replyToken already consumed / expired).
 */
export async function pushLineMessage(
  lineUserId: string,
  messages: LineMessage[],
): Promise<boolean> {
  try {
    const client = getLineClient();
    await client.pushMessage({ to: lineUserId, messages });
    return true;
  } catch {
    return false;
  }
}

/**
 * Return a (possibly cached) `MessagingApiBlobClient` used only for binary
 * endpoints (`GET .../message/{id}/content`). Shares the same channel access
 * token as the normal client but hits the `api-data.line.me` host.
 */
export function getLineBlobClient(): messagingApi.MessagingApiBlobClient {
  if (!lineConfig.enabled || !lineConfig.channelAccessToken) {
    throw new Error('LINE integration is not configured.');
  }
  if (!cachedBlobClient) {
    cachedBlobClient = new messagingApi.MessagingApiBlobClient({
      channelAccessToken: lineConfig.channelAccessToken,
    });
  }
  return cachedBlobClient;
}

/**
 * Download an image / file / video content that a LINE user sent. Returns
 * `null` when LINE is not configured or the download failed — callers
 * treat null as "skip this attachment" so a flaky content endpoint does
 * not crash the whole pipeline.
 *
 * The upstream endpoint streams a `Readable`; we collect it into a single
 * Buffer because the downstream consumers (pdf-parse, base64 encoding for
 * GPT-4o Vision) all want contiguous bytes.
 */
export async function downloadLineMessageContent(
  messageId: string,
): Promise<Buffer | null> {
  try {
    const client = getLineBlobClient();
    const stream = await client.getMessageContent(messageId);
    const chunks: Buffer[] = [];
    // `stream` is a Node.js `Readable`. Consuming via for-await is cleanest.
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  } catch {
    return null;
  }
}

/**
 * Show the typing indicator for up to `loadingSeconds` seconds (5..60).
 * Non-blocking — if the API rejects (e.g. old user) we silently ignore.
 */
export async function showLineLoading(
  lineUserId: string,
  loadingSeconds: number,
): Promise<void> {
  try {
    const client = getLineClient();
    const clamped = Math.max(5, Math.min(60, Math.round(loadingSeconds)));
    await client.showLoadingAnimation({
      chatId: lineUserId,
      loadingSeconds: clamped,
    });
  } catch {
    // Best-effort only.
  }
}

/** Helper: plain text message. */
export function textMessage(text: string): LineMessage {
  // LINE text messages cap at 5000 chars.
  const trimmed = text.length > 4900 ? `${text.slice(0, 4900)}…` : text;
  return { type: 'text', text: trimmed };
}

/** Helper: flex bubble with a single alt text. */
export function flexMessage(
  altText: string,
  contents: FlexContainer,
): LineMessage {
  return { type: 'flex', altText, contents };
}
