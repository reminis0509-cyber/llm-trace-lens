/**
 * AdLandingPage — 広告着地 LP の共通コンポーネント (CEO 判断 2026-04-28 / Q9 / Q10)
 *
 * 設計意図:
 *   - Header / Footer は描画しない (chromeless)。独自の簡素フッターのみ表示
 *   - LINE 友だち追加 URL に直遷移 (モーダルなし、Q9)
 *   - QR コードを併設し、PC で見ているユーザーがスマホで読み取って LINE に到達できる
 *   - 1 スクロールに収まる「キャッチ → カピぶちょー → CTA → 補足」の縦積み
 *   - 老舗 SaaS 基調、絵文字禁止、派手なアニメ禁止
 *
 * 4 本のテーマ別ページ (`/ads/*`) から本コンポーネントを呼び出す。
 */

import { useSeo } from '../hooks/useSeo';
import Mascot, { type MascotPose } from './Mascot';
import QrCode from './QrCode';
import { getLineUrl } from '../lib/line-url';

export interface AdLandingPageProps {
  /** /ads/<slug> の slug (SEO/aria 用) */
  slug: string;
  /** Eyebrow バッジに表示するテーマ短語。例: 「見積書 AI」 */
  eyebrow: string;
  /** メイン見出し。例: 「見積書、3 秒で。」 */
  headline: string;
  /** サブコピー (1〜2 文) */
  subcopy: string;
  /** 信頼バッジ (3 件想定) */
  trustBadges: string[];
  /** カピぶちょーのポーズ */
  mascotPose?: MascotPose;
  /** SEO 用 title (省略時は headline + サービス名) */
  seoTitle?: string;
  /** SEO 用 description */
  seoDescription?: string;
  /** 補足セクション 3 件 (タイトル + 1 文) */
  reasons: { title: string; body: string }[];
}

export default function AdLandingPage({
  slug,
  eyebrow,
  headline,
  subcopy,
  trustBadges,
  mascotPose = 'default',
  seoTitle,
  seoDescription,
  reasons,
}: AdLandingPageProps) {
  const lineUrl = getLineUrl();

  useSeo({
    title: seoTitle ?? `${headline} | おしごと AI — FujiTrace`,
    description:
      seoDescription ??
      'LINE 公式アカウントから、おしごと AI に話しかけるだけ。見積書・請求書・議事録・スライドまで、机上の事務作業をひととおりお任せいただけます。',
    url: `https://fujitrace.jp/ads/${slug}`,
  });

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Minimal logo bar — 独自の簡素フッターと対になる、最小限のブランディング */}
      <div className="px-4 sm:px-6 pt-6">
        <div className="section-container flex items-center gap-2">
          <svg className="w-5 h-5" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path
              d="M6 26 L14.5 6 L19.7 18.2"
              stroke="#1a1a1a"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="M16.5 26 L22 12.5 L27.5 26"
              stroke="#1a1a1a"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          <span className="text-sm font-medium text-text-primary">FujiTrace</span>
          <span className="hidden sm:inline text-xs text-text-muted ml-1">
            — おしごと AI とカピぶちょー
          </span>
        </div>
      </div>

      {/* Hero */}
      <main className="flex-1 px-4 sm:px-6 py-12 sm:py-16">
        <section
          className="section-container"
          aria-labelledby={`ad-${slug}-headline`}
        >
          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-14 items-center">
            {/* Left: copy + CTA */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 surface-card text-xs mb-6">
                <span
                  className="w-1.5 h-1.5 bg-accent rounded-full"
                  aria-hidden="true"
                />
                <span className="text-text-muted">{eyebrow}</span>
              </div>

              <h1
                id={`ad-${slug}-headline`}
                className="text-[2rem] sm:text-display-sm lg:text-[2.75rem] font-semibold text-text-primary mb-5 leading-[1.25] tracking-tight"
              >
                {headline}
              </h1>

              <p className="text-base sm:text-lg text-text-secondary mb-7 leading-relaxed">
                {subcopy}
              </p>

              <ul className="flex flex-wrap gap-x-5 gap-y-2 mb-8 text-sm text-text-secondary">
                {trustBadges.map((badge) => (
                  <li key={badge} className="flex items-center gap-1.5">
                    <svg
                      className="w-4 h-4 text-status-pass flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span>{badge}</span>
                  </li>
                ))}
              </ul>

              {/* 主 CTA — LINE 友だち追加に直遷移 (モーダルなし) */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-3">
                <a
                  href={lineUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-accent text-white rounded-card text-base font-semibold hover:bg-accent-hover transition-colors duration-120"
                >
                  LINE で話しかける
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 9l6-6M5 3h4v4"
                    />
                  </svg>
                </a>
                <a
                  href="/"
                  className="px-6 py-3.5 text-text-secondary hover:text-text-primary border border-border rounded-card font-medium hover:bg-app-bg-elevated transition-colors duration-120 text-center"
                >
                  サービス全体を見る
                </a>
              </div>
              <p className="text-sm text-text-muted">
                登録不要・友だち追加するだけで、すぐにお試しいただけます。
              </p>
            </div>

            {/* Right: カピぶちょー + QR */}
            <div className="flex flex-col items-center gap-6">
              <Mascot pose={mascotPose} size="xl" animation="idle" />
              <div className="flex flex-col items-center gap-2">
                <QrCode value={lineUrl} size={192} />
                <p className="text-xs text-text-muted">スマートフォンで読み取り</p>
              </div>
            </div>
          </div>
        </section>

        {/* Reasons — 3 列の控えめなカード (老舗 SaaS 風) */}
        <section
          className="section-container mt-16 sm:mt-20"
          aria-label="特徴"
        >
          <div className="grid md:grid-cols-3 gap-4 lg:gap-5">
            {reasons.map((r, idx) => (
              <article
                key={r.title}
                className="bg-app-bg-surface border border-border rounded-card p-6"
              >
                <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-accent-dim text-accent font-mono text-xs tabular-nums mb-3">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <h2 className="text-base sm:text-lg font-semibold text-text-primary mb-2 leading-snug">
                  {r.title}
                </h2>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {r.body}
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>

      {/* 独自の簡素フッター — Header/Footer chromeless 方針 (Q10 完全 chromeless) */}
      <footer className="px-4 sm:px-6 py-6 border-t border-border">
        <div className="section-container flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-text-muted">
          <p>&copy; 2026 合同会社 Reminis. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a
              href="/privacy"
              className="hover:text-text-primary transition-colors duration-120"
            >
              プライバシーポリシー
            </a>
            <a
              href="/terms"
              className="hover:text-text-primary transition-colors duration-120"
            >
              利用規約
            </a>
            <a
              href="/company"
              className="hover:text-text-primary transition-colors duration-120"
            >
              会社概要
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
