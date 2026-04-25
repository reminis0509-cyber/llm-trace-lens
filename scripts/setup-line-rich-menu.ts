/**
 * Provision the FujiTrace LINE Official Account Rich Menu (Phase A2,
 * 2026-04-25). Gateway AI 戦略では LINE は「身近な相談相手」であり、
 * 業務色を消した 6 機能のメニューに刷新する。
 *
 *   ┌───────────────┬───────────────┬───────────────┐
 *   │ 📷 写真で聞く   │ ✉ 文案作成    │ 🌐 翻訳        │
 *   │ (postback)     │ (postback)     │ (postback)     │
 *   ├───────────────┼───────────────┼───────────────┤
 *   │ 💡 アイデア    │ 💬 お話しする  │ 📄 本格作業    │
 *   │ (postback)     │ (postback)     │ (postback)     │
 *   └───────────────┴───────────────┴───────────────┘
 *
 * すべて postback で統一しているのは、ボタン押下時に bot が「何を送れば
 * いいか」の使い方ガイドを返すスタイルにしているため(URI でいきなり外部に
 * 飛ばさない)。「📄 本格作業」だけは fujitrace.jp への送客だが、bot から
 * 案内文 + URL を返すことで「LINE で話してた相手に紹介された」という
 * 文脈を保つ。
 *
 * Postback dispatch は `src/line/event-handler.ts` の
 * `RICH_MENU_POSTBACK_TEXTS` を参照(action 名: rm_photo / rm_mail /
 * rm_translate / rm_idea / rm_chat / rm_web)。
 *
 * Usage:
 *
 *   LINE_CHANNEL_ACCESS_TOKEN=xxx \
 *     tsx scripts/setup-line-rich-menu.ts <path-to-image.png>
 *
 * The image must be 2500 × 1686 px (LINE's "Large" template size) and
 * ≤ 1 MB. デザインは Founder 側で Canva 等で準備。レイアウトは上記
 * グリッドに必ず一致させること(座標は下記 buildRichMenuDefinition 参照)。
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

if (!CHANNEL_ACCESS_TOKEN) {
  // eslint-disable-next-line no-console
  console.error('LINE_CHANNEL_ACCESS_TOKEN is required');
  process.exit(1);
}
// LINE_LIFF_ID is no longer required: Phase A2 menu is all postbacks. Kept
// here as informational so devs running the old command line still get a
// hint without a hard failure.

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
 * Phase A2 では 6 マスすべて postback。タップ時に bot が「何を送れば
 * いいか」の使い方ガイドを返す。`displayText` は LINE のチャット欄に
 * "あなた: ◯◯" として表示される文言で、ユーザーが「自分が今何を依頼
 * したか」を視覚的に追えるようにする。
 *
 * Coordinates are in image pixels, origin at top-left.
 */
function buildRichMenuDefinition(): object {
  const W = 2500;
  const H = 1686;
  const cellW = Math.floor(W / 3);
  const cellH = Math.floor(H / 2);

  return {
    size: { width: W, height: H },
    selected: true,
    name: 'FujiTrace/default',
    chatBarText: 'メニュー',
    areas: [
      // ── Row 1 ─────────────────────────────────────
      {
        bounds: { x: 0, y: 0, width: cellW, height: cellH },
        action: {
          type: 'postback',
          label: '写真で聞く',
          data: 'action=rm_photo',
          displayText: '写真で聞く',
        },
      },
      {
        bounds: { x: cellW, y: 0, width: cellW, height: cellH },
        action: {
          type: 'postback',
          label: '文案作成',
          data: 'action=rm_mail',
          displayText: '文案作成',
        },
      },
      {
        bounds: { x: cellW * 2, y: 0, width: W - cellW * 2, height: cellH },
        action: {
          type: 'postback',
          label: '翻訳',
          data: 'action=rm_translate',
          displayText: '翻訳',
        },
      },
      // ── Row 2 ─────────────────────────────────────
      {
        bounds: { x: 0, y: cellH, width: cellW, height: H - cellH },
        action: {
          type: 'postback',
          label: 'アイデア',
          data: 'action=rm_idea',
          displayText: 'アイデア',
        },
      },
      {
        bounds: { x: cellW, y: cellH, width: cellW, height: H - cellH },
        action: {
          type: 'postback',
          label: 'お話しする',
          data: 'action=rm_chat',
          displayText: 'お話しする',
        },
      },
      {
        bounds: { x: cellW * 2, y: cellH, width: W - cellW * 2, height: H - cellH },
        action: {
          type: 'postback',
          label: '本格作業',
          data: 'action=rm_web',
          displayText: '本格作業',
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
