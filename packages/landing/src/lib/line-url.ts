/**
 * line-url — LINE 公式アカウントの友だち追加 URL を一元管理する小さなヘルパー。
 *
 * 設計意図 (CEO 判断 2026-04-28):
 *   - 環境変数 `VITE_LINE_OFFICIAL_URL` から取得する
 *   - 未設定時は本番 placeholder URL にフォールバック
 *   - LP / 広告着地 LP / FloatingMascot 等、複数箇所から再利用する
 *
 * 同一ファイルが下記 2 箇所に存在する (案 A 共通化、Mascot.tsx と同じ方針):
 *   - packages/landing/src/lib/line-url.ts
 *   - packages/dashboard/src/lib/line-url.ts
 * 編集時は両ファイルを必ず同期させること。
 */

const PLACEHOLDER_LINE_URL = 'https://line.me/R/ti/p/@fujitrace';

export function getLineUrl(): string {
  const fromEnv = (import.meta.env.VITE_LINE_OFFICIAL_URL as string | undefined)?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : PLACEHOLDER_LINE_URL;
}
