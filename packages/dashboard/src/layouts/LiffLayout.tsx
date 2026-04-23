import type { ReactNode } from 'react';

interface LiffLayoutProps {
  children: ReactNode;
}

/**
 * LiffLayout — immersive full-viewport wrapper for LIFF routes.
 *
 * Strips the dashboard chrome (header / sidebar / footer) so the hosted
 * experience (tutorial, quest) fills the LINE in-app browser. Padding is
 * deliberately zero — the inner content component owns all spacing so
 * existing responsive behaviour is preserved.
 *
 * Kept minimal on purpose: a single container div + Noto Sans JP font
 * stack (dashboard default) + white background.
 */
export function LiffLayout({ children }: LiffLayoutProps) {
  return (
    <div
      className="min-h-screen w-screen bg-white overflow-x-hidden"
      style={{
        fontFamily:
          '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", system-ui, -apple-system, sans-serif',
      }}
    >
      {children}
    </div>
  );
}

export default LiffLayout;
