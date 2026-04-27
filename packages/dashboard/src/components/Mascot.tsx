/**
 * Mascot — カピぶちょー (FujiTrace 2 キャラ並走モデル / Section 7.3)
 *
 * 仕様の根拠: docs/戦略_2026.md
 *  - Section 7.3 「2 キャラ並走モデル」+ 「マーク重ね合わせ戦略」
 *  - カピバラ静的設計原則: 立ち絵は基本静止、マーク側だけ動く
 *  - 必須マーク 8 種は絵文字を CSS で重ね合わせ (独自描画しない)
 *
 * NOTE (案 A 共通化): 同じファイルが下記 2 箇所に存在する。
 *   - packages/landing/src/components/Mascot.tsx
 *   - packages/dashboard/src/components/Mascot.tsx
 * 将来 monorepo の shared package へ移行する (案 B)。
 * 編集時は両ファイルを必ず同期させること。
 *
 * 画像未配置でも壊れない設計:
 *   - <img onError> でフォールバック span に切替、背景色プレースホルダーを表示
 *   - alt 文字列は必ず人間可読にする
 */

import { useState } from 'react';

export type MascotPose = 'default' | 'real' | 'onsen';
export type MascotMark = '💢' | '💦' | '❓' | '✨' | '💡' | '🤔' | '🍵' | '👏';
export type MascotAnimation =
  | 'idle'
  | 'thinking'
  | 'celebrating'
  | 'alarmed'
  | 'none';
export type MascotSize = 'sm' | 'md' | 'lg' | 'hero';

export interface MascotProps {
  pose?: MascotPose;
  mark?: MascotMark | null;
  animation?: MascotAnimation;
  size?: MascotSize;
  className?: string;
}

const SIZE_PX: Record<MascotSize, number> = {
  sm: 64,
  md: 128,
  lg: 256,
  hero: 512,
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
 * Inline keyframes — Tailwind 設定を両パッケージで揃えるのを避け、
 * コンポーネント単体で完結させる。:where() でグローバル衝突を防止。
 */
const MASCOT_STYLE_ID = 'fujitrace-mascot-keyframes';
const MASCOT_KEYFRAMES = `
@keyframes fujitrace-mascot-breathe {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-0.5px); }
}
@keyframes fujitrace-mascot-mark-fade {
  0%, 100% { opacity: 0.2; }
  50%      { opacity: 1; }
}
@keyframes fujitrace-mascot-celebrate {
  0%   { transform: translateY(0); }
  40%  { transform: translateY(-4px); }
  100% { transform: translateY(0); }
}
@keyframes fujitrace-mascot-shake {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  20%      { transform: translate(-1px, 1px) rotate(-3deg); }
  40%      { transform: translate(1px, -1px) rotate(3deg); }
  60%      { transform: translate(-1px, 0) rotate(-2deg); }
  80%      { transform: translate(1px, 1px) rotate(2deg); }
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

interface ResolvedAnimation {
  baseAnim: string | undefined;
  markAnim: string | undefined;
  forcedMark: MascotMark | null;
}

function resolveAnimation(
  animation: MascotAnimation,
  mark: MascotMark | null,
): ResolvedAnimation {
  switch (animation) {
    case 'idle':
      return {
        baseAnim: 'fujitrace-mascot-breathe 4s ease-in-out infinite',
        markAnim: undefined,
        forcedMark: mark,
      };
    case 'thinking':
      return {
        baseAnim: undefined,
        markAnim: 'fujitrace-mascot-mark-fade 2s ease-in-out infinite',
        forcedMark: mark ?? '🤔',
      };
    case 'celebrating':
      return {
        baseAnim: 'fujitrace-mascot-celebrate 0.3s ease-out 1',
        markAnim: undefined,
        forcedMark: mark ?? '✨',
      };
    case 'alarmed':
      return {
        baseAnim: undefined,
        // 0.1s × 10cycle = 1s 揺れて止まる
        markAnim: 'fujitrace-mascot-shake 0.1s linear 10',
        forcedMark: mark ?? '💢',
      };
    case 'none':
    default:
      return {
        baseAnim: undefined,
        markAnim: undefined,
        forcedMark: mark,
      };
  }
}

export default function Mascot({
  pose = 'default',
  mark = null,
  animation = 'idle',
  size = 'md',
  className,
}: MascotProps) {
  ensureKeyframes();
  const [imgFailed, setImgFailed] = useState(false);

  const px = SIZE_PX[size];
  const markPx = Math.round(px * 0.3);
  const offset = Math.max(6, Math.round(px * 0.06));
  const src = POSE_SRC[pose];
  const alt = POSE_ALT[pose];

  const { baseAnim, markAnim, forcedMark } = resolveAnimation(animation, mark);

  const wrapperClass =
    'relative inline-block select-none' + (className ? ` ${className}` : '');

  return (
    <div
      className={wrapperClass}
      style={{ width: px, height: px }}
      role="img"
      aria-label={
        forcedMark
          ? `${alt} (${markAriaLabel(forcedMark)})`
          : alt
      }
    >
      {/* ベース立ち絵 */}
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
          // プレースホルダー: 画像未配置でも崩れない
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#f1f5f9',
              border: '1px dashed #cbd5e1',
              borderRadius: 8,
              color: '#64748b',
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

      {/* マーク (右上、絶対配置) */}
      {forcedMark ? (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -offset,
            right: -offset,
            width: markPx,
            height: markPx,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: Math.round(markPx * 0.85),
            lineHeight: 1,
            pointerEvents: 'none',
            animation: markAnim,
            willChange: markAnim ? 'opacity, transform' : undefined,
            // 絵文字描画を Apple 系で安定させる
            fontFamily:
              '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif',
            textShadow: '0 1px 2px rgba(0,0,0,0.08)',
          }}
        >
          {forcedMark}
        </span>
      ) : null}
    </div>
  );
}

function markAriaLabel(m: MascotMark): string {
  switch (m) {
    case '💢':
      return '怒り';
    case '💦':
      return '焦り';
    case '❓':
      return '疑問';
    case '✨':
      return 'ひらめき';
    case '💡':
      return 'アイデア';
    case '🤔':
      return '考え中';
    case '🍵':
      return 'のんびり';
    case '👏':
      return '拍手';
    default:
      return '';
  }
}

export const MASCOT_MARKS: MascotMark[] = [
  '💢',
  '💦',
  '❓',
  '✨',
  '💡',
  '🤔',
  '🍵',
  '👏',
];

export const MASCOT_POSES: MascotPose[] = ['default', 'real', 'onsen'];

export const MASCOT_ANIMATIONS: MascotAnimation[] = [
  'idle',
  'thinking',
  'celebrating',
  'alarmed',
  'none',
];
