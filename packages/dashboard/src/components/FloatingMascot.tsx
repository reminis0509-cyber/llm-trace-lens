/**
 * FloatingMascot — ダッシュボード右下に常駐するカピぶちょー (2026-04-28 新設)
 *
 * 戦略 doc Section 7.3「2 キャラ並走モデル」のうち、見守り役のカピぶちょーを
 * ダッシュボード画面の隅に配置する。クリックすると吹き出しが開き、LINE 公式アカウントの
 * 友だち追加リンクへ誘導する設計。
 *
 * CEO 判断 (2026-04-28):
 *   - 表示範囲: Dashboard / Admin。Watch Room / LIFF / Auth では非表示 (これは呼び出し側で制御)
 *   - 配置: position fixed; bottom-4 right-4; z-40
 *   - サイズ: モバイル md (128px) / デスクトップ lg (256px) — メディアクエリで切替
 *   - クリック: 吹き出し → LINE 友だち追加リンク (新規タブ)
 *   - LINE URL: import.meta.env.VITE_LINE_OFFICIAL_URL から読み、未設定時はプレースホルダー
 *
 * アクセシビリティ:
 *   - button 要素で囲み、aria-label / aria-expanded を提供
 *   - Escape キーで吹き出しを閉じる
 *   - 外側クリックでも閉じる
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Mascot from './Mascot';

const PLACEHOLDER_LINE_URL = 'https://line.me/R/ti/p/@fujitrace';

function getLineUrl(): string {
  const fromEnv = (import.meta.env.VITE_LINE_OFFICIAL_URL as string | undefined)?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : PLACEHOLDER_LINE_URL;
}

export default function FloatingMascot() {
  const [open, setOpen] = useState(false);
  // Tailwind md breakpoint = 768px. We use a JS check rather than CSS scale
  // because Mascot renders an <img> at the requested size and CSS scale can
  // produce blurry edges for pixel-art-leaning artwork.
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 768px)').matches,
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lineUrl = getLineUrl();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(min-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Close bubble on Escape or outside click
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('mousedown', handleClick);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('mousedown', handleClick);
    };
  }, [open]);

  const handleToggle = useCallback(() => {
    setOpen((v) => !v);
  }, []);

  // Mobile = md (128px), Desktop = lg (256px)
  const mascotSize = isDesktop ? 'lg' : 'md';
  const sizePx = isDesktop ? 256 : 128;

  return (
    <div
      ref={containerRef}
      className="fixed bottom-4 right-4 z-40 select-none"
      style={{ width: sizePx }}
    >
      {/* 吹き出し — open 時のみ表示 */}
      {open && (
        <div
          role="dialog"
          aria-label="カピぶちょーからの案内"
          className="mb-2 rounded-card border border-border bg-white shadow-lg p-4 text-sm text-text-primary"
        >
          <p className="font-medium mb-1">気軽に話しかけてみる</p>
          <p className="text-xs text-text-secondary leading-relaxed mb-3">
            おしごと AI とカピぶちょーが、LINE 公式アカウントでもお手伝いします。
          </p>
          <a
            href={lineUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-accent text-white rounded-card text-xs font-semibold hover:bg-accent-hover transition-colors duration-120"
            onClick={() => setOpen(false)}
          >
            LINE で話しかける
            <svg
              className="w-3 h-3"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l6-6M5 3h4v4" />
            </svg>
          </a>
        </div>
      )}

      {/* マスコットボタン */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label="カピぶちょーに話しかける"
        aria-expanded={open}
        aria-haspopup="dialog"
        className="block ml-auto bg-transparent border-0 p-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-card"
      >
        <Mascot pose="default" size={mascotSize} animation="idle" />
      </button>
    </div>
  );
}
