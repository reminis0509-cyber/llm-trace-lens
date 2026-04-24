/**
 * Provision the FujiTrace LINE Official Account Rich Menu.
 *
 * The Rich Menu is a persistent 2-row × 3-column grid of tap targets that
 * sits above the LINE message composer. It lets the user start any of the
 * 5 document-creation flows in one tap, plus jump to the company-info
 * form, tutorial, and quest LIFF apps.
 *
 *   ┌───────────────┬───────────────┬───────────────┐
 *   │  見積書を作る   │  請求書を作る   │  納品書を作る   │
 *   │ (postback)     │ (postback)     │ (postback)     │
 *   ├───────────────┼───────────────┼───────────────┤
 *   │  会社情報      │  使い方        │  クエスト      │
 *   │ (URI: LIFF)    │ (URI: LIFF)    │ (URI: LIFF)    │
 *   └───────────────┴───────────────┴───────────────┘
 *
 * Postback payloads are handled in `src/line/event-handler.ts` —
 * `action=start_estimate`, `start_invoice`, `start_delivery_note`.
 *
 * Usage:
 *
 *   LINE_CHANNEL_ACCESS_TOKEN=xxx LINE_LIFF_ID=yyy \
 *     tsx scripts/setup-line-rich-menu.ts <path-to-image.png>
 *
 * The image must be 2500 × 1686 px (LINE's "Large" template size) and
 * ≤ 1 MB. Use a designed asset; layout must match the grid above. A
 * minimal placeholder image can be checked in later if we stabilise the
 * design.
 *
 * The script is idempotent:
 *   1. Lists existing Rich Menus and deletes any whose name starts with
 *      "FujiTrace/" (our namespace).
 *   2. Creates the new Rich Menu (JSON definition below).
 *   3. Uploads the image.
 *   4. Sets the new Rich Menu as default for all users.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '';
const LIFF_ID = process.env.LINE_LIFF_ID ?? '';

if (!CHANNEL_ACCESS_TOKEN) {
  // eslint-disable-next-line no-console
  console.error('LINE_CHANNEL_ACCESS_TOKEN is required');
  process.exit(1);
}
if (!LIFF_ID) {
  // eslint-disable-next-line no-console
  console.error('LINE_LIFF_ID is required');
  process.exit(1);
}

const imagePath = process.argv[2];
if (!imagePath) {
  // eslint-disable-next-line no-console
  console.error(
    'Usage: tsx scripts/setup-line-rich-menu.ts <path-to-image.png>\n' +
      '       Image must be 2500x1686 PNG/JPG, ≤ 1 MB.',
  );
  process.exit(1);
}

const LINE_API = 'https://api.line.me/v2/bot';
const LINE_DATA = 'https://api-data.line.me/v2/bot';

interface ApiError {
  message?: string;
  details?: Array<{ message?: string; property?: string }>;
}

async function api<T>(
  method: 'GET' | 'POST' | 'DELETE',
  url: string,
  body?: unknown,
  contentType = 'application/json',
): Promise<T> {
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
      ...(body !== undefined ? { 'Content-Type': contentType } : {}),
    },
  };
  if (body !== undefined) {
    init.body =
      contentType === 'application/json' ? JSON.stringify(body) : (body as BodyInit);
  }
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    let err: ApiError = {};
    try {
      err = JSON.parse(text);
    } catch {
      err = { message: text };
    }
    throw new Error(
      `LINE API ${method} ${url} failed: ${res.status} ${err.message ?? text}`,
    );
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

/**
 * Rich Menu definition. The `size` 2500x1686 is LINE's "Large" template —
 * the only one that fits 6 regions at a comfortable tap size.
 *
 * Each `bounds` entry maps to a region of the image; the `action` is
 * what fires when the user taps that region. Coordinates are in image
 * pixels, origin at top-left.
 */
function buildRichMenuDefinition(): object {
  const W = 2500;
  const H = 1686;
  const cellW = Math.floor(W / 3);
  const cellH = Math.floor(H / 2);
  const liffBusinessInfoUrl = `https://liff.line.me/${LIFF_ID}/liff/business-info`;
  const liffTutorialUrl = `https://liff.line.me/${LIFF_ID}/liff/tutorial`;
  const liffQuestUrl = `https://liff.line.me/${LIFF_ID}/liff/quest`;

  return {
    size: { width: W, height: H },
    selected: true,
    name: 'FujiTrace/default',
    chatBarText: 'メニュー',
    areas: [
      // Row 1 — document creation (postback)
      {
        bounds: { x: 0, y: 0, width: cellW, height: cellH },
        action: {
          type: 'postback',
          label: '見積書を作る',
          data: 'action=start_estimate',
          displayText: '見積書を作る',
        },
      },
      {
        bounds: { x: cellW, y: 0, width: cellW, height: cellH },
        action: {
          type: 'postback',
          label: '請求書を作る',
          data: 'action=start_invoice',
          displayText: '請求書を作る',
        },
      },
      {
        bounds: { x: cellW * 2, y: 0, width: W - cellW * 2, height: cellH },
        action: {
          type: 'postback',
          label: '納品書を作る',
          data: 'action=start_delivery_note',
          displayText: '納品書を作る',
        },
      },
      // Row 2 — LIFF apps (uri)
      {
        bounds: { x: 0, y: cellH, width: cellW, height: H - cellH },
        action: {
          type: 'uri',
          label: '会社情報',
          uri: liffBusinessInfoUrl,
        },
      },
      {
        bounds: { x: cellW, y: cellH, width: cellW, height: H - cellH },
        action: {
          type: 'uri',
          label: '使い方',
          uri: liffTutorialUrl,
        },
      },
      {
        bounds: { x: cellW * 2, y: cellH, width: W - cellW * 2, height: H - cellH },
        action: {
          type: 'uri',
          label: 'クエスト',
          uri: liffQuestUrl,
        },
      },
    ],
  };
}

interface RichMenuListResponse {
  richmenus: Array<{ richMenuId: string; name: string }>;
}

async function cleanupExisting(): Promise<void> {
  const list = await api<RichMenuListResponse>('GET', `${LINE_API}/richmenu/list`);
  const ours = list.richmenus.filter((m) => m.name.startsWith('FujiTrace/'));
  for (const m of ours) {
    // eslint-disable-next-line no-console
    console.log(`  → deleting existing Rich Menu ${m.richMenuId} (${m.name})`);
    await api('DELETE', `${LINE_API}/richmenu/${m.richMenuId}`);
  }
}

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('FujiTrace LINE Rich Menu setup');
  // eslint-disable-next-line no-console
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const resolvedImage = path.resolve(imagePath);
  const imageBuffer = await fs.readFile(resolvedImage);
  const ext = path.extname(resolvedImage).toLowerCase();
  const contentType =
    ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : null;
  if (!contentType) {
    throw new Error(`unsupported image type ${ext} — expected .png / .jpg / .jpeg`);
  }
  if (imageBuffer.byteLength > 1024 * 1024) {
    throw new Error(
      `image is ${(imageBuffer.byteLength / 1024 / 1024).toFixed(2)} MB; LINE caps Rich Menu images at 1 MB`,
    );
  }
  // eslint-disable-next-line no-console
  console.log(`  ✓ loaded image ${resolvedImage} (${imageBuffer.byteLength} bytes, ${contentType})`);

  // eslint-disable-next-line no-console
  console.log('  → cleaning up existing FujiTrace Rich Menus …');
  await cleanupExisting();

  // eslint-disable-next-line no-console
  console.log('  → creating Rich Menu definition …');
  const definition = buildRichMenuDefinition();
  const { richMenuId } = await api<{ richMenuId: string }>(
    'POST',
    `${LINE_API}/richmenu`,
    definition,
  );
  // eslint-disable-next-line no-console
  console.log(`  ✓ created Rich Menu ${richMenuId}`);

  // eslint-disable-next-line no-console
  console.log('  → uploading Rich Menu image …');
  await api(
    'POST',
    `${LINE_DATA}/richmenu/${richMenuId}/content`,
    imageBuffer,
    contentType,
  );
  // eslint-disable-next-line no-console
  console.log('  ✓ uploaded image');

  // eslint-disable-next-line no-console
  console.log('  → setting as default for all users …');
  await api('POST', `${LINE_API}/user/all/richmenu/${richMenuId}`);
  // eslint-disable-next-line no-console
  console.log('  ✓ Rich Menu is now live');

  // eslint-disable-next-line no-console
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  // eslint-disable-next-line no-console
  console.log('Done. Open the LINE bot to see the new menu bar.');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('SETUP FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
