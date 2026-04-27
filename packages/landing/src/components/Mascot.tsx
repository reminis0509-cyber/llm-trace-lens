/**
 * Mascot — カピぶちょー (FujiTrace 2 キャラ並走モデル / 戦略 doc Section 7.3)
 *
 * 2026-04-28 リファクタ(Founder 判断): クオリティ最優先のため、汎用絵文字
 * マーク重ね合わせ機能を撤去。ベース立ち絵 3 ポーズ + サイズ 4 種 + 控えめ
 * な呼吸アニメ(idle)のみに簡素化。感情表現は別レイヤー(AI 応答 + カピ
 * ぶちょーフキダシ、`src/line/capi-bucho.ts`)が担当する。
 *
 * 設計原則(Notion DESIGN.md / docs/design/notion-DESIGN.md ベース):
 *   - 温かい中性色プレースホルダー(`#f6f5f4` warm white + `#a39e98` warm gray)
 *   - 1px solid rgba(0,0,0,0.1) の whisper border(枠線)
 *   - 立ち絵は基本静止、idle 時のみ 0.5px 上下する控えめな呼吸
 *   - 画像未配置でも graceful fallback で破綻しない
 *
 * NOTE (案 A 共通化): 同じファイルが下記 2 箇所に存在する。
 *   - packages/landing/src/components/Mascot.tsx
 *   - packages/dashboard/src/components/Mascot.tsx
 * 将来 monorepo の shared package へ移行する (案 B)。
 * 編集時は両ファイルを必ず同期させること。
 */

import { useState } from 'react';

export type MascotPose = 'default' | 'real' | 'onsen';
export type MascotAnimation = 'idle' | 'none';
export type MascotSize = 'sm' | 'md' | 'lg' | 'hero';

export interface MascotProps {
  pose?: MascotPose;
  animation?: MascotAnimation;
  size?: MascotSize;
  className?: string;
}

/**
 * サイズ定義(2026-04-28 改訂):
 *   - sm: アバター・小アイコン(64px)
 *   - md: フッター・記事内挿絵・小バナー(128px)
 *   - lg: ダッシュボード常時マスコット・モーダル挿絵(256px)
 *   - hero: LP メインビジュアル(768px、画面内で存在感)
 */
const SIZE_PX: Record<MascotSize, number> = {
  sm: 64,
  md: 128,
  lg: 256,
  hero: 768,
};

const POSE_SRC: Record<MascotPose, string> = {
  default: '/mascot/capi-default.png',
  real: '/mascot/capi-real.png',
  onsen: '/mascot/capi-onsen.png',
};

const POSE_ALT: Record<MascotPose, string> = {
  default: 'カピぶちょー (通常)',
  real: 'カピぶちょー (リアル化)',
  onsen: 'カピぶちょー (温泉)',
};

/**
 * idle の呼吸アニメ — 0.5px の上下、4 秒周期。立ち絵が「死んでる」印象を
 * 与えないための最小限の動き(カピバラ静的設計原則、戦略 doc Section 7.3)。
 */
const MASCOT_STYLE_ID = 'fujitrace-mascot-keyframes';
const MASCOT_KEYFRAMES = `
@keyframes fujitrace-mascot-breathe {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-0.5px); }
}
`;

/**
 * Mount the keyframes once per page. Idempotent — safe to call from many
 * Mascot instances simultaneously.
 */
function ensureKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(MASCOT_STYLE_ID)) return;
  const styleEl = document.createElement('style');
  styleEl.id = MASCOT_STYLE_ID;
  styleEl.textContent = MASCOT_KEYFRAMES;
  document.head.appendChild(styleEl);
}

export default function Mascot({
  pose = 'default',
  animation = 'idle',
  size = 'md',
  className,
}: MascotProps) {
  ensureKeyframes();
  const [imgFailed, setImgFailed] = useState(false);

  const px = SIZE_PX[size];
  const src = POSE_SRC[pose];
  const alt = POSE_ALT[pose];

  const baseAnim =
    animation === 'idle'
      ? 'fujitrace-mascot-breathe 4s ease-in-out infinite'
      : undefined;

  const wrapperClass =
    'relative inline-block select-none' + (className ? ` ${className}` : '');

  return (
    <div
      className={wrapperClass}
      style={{ width: px, height: px }}
      role="img"
      aria-label={alt}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          animation: baseAnim,
          willChange: baseAnim ? 'transform' : undefined,
        }}
      >
        {!imgFailed ? (
          <img
            src={src}
            alt={alt}
            width={px}
            height={px}
            draggable={false}
            onError={() => setImgFailed(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              imageRendering: 'auto',
              userSelect: 'none',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              // Notion 流の温かい中性色フォールバック(docs/design/notion-DESIGN.md)
              backgroundColor: '#f6f5f4',
              border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: 8,
              color: '#a39e98',
              fontSize: Math.max(10, Math.round(px * 0.09)),
              fontWeight: 500,
              padding: 4,
              textAlign: 'center',
              lineHeight: 1.3,
            }}
            aria-hidden="true"
          >
            {alt}
          </div>
        )}
      </div>
    </div>
  );
}

export const MASCOT_POSES: MascotPose[] = ['default', 'real', 'onsen'];

export const MASCOT_SIZES: MascotSize[] = ['sm', 'md', 'lg', 'hero'];

export const MASCOT_ANIMATIONS: MascotAnimation[] = ['idle', 'none'];
