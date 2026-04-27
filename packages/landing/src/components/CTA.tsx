import { trackDashboardConversion } from '../utils/gtag';
import MascotQuote from './home/MascotQuote';

/**
 * CTA — 最終誘導 (2026-04-22 刷新 + 2026-04-28 カピぶちょー軽い励まし追加)
 *
 * 中小企業向けに「無料で試す」「導入のご相談」の 2 導線に統一。
 * 老舗 SaaS 風の落ち着いたトーン、派手な装飾を避ける。
 *
 * 戦略 doc Section 7.3 (2026-04-28 改訂):
 *   末尾 CTA でカピぶちょー sm + 軽い励ましフキダシ。
 */
export default function CTA() {
  return (
    <section id="contact" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="section-container">
        <div className="relative bg-white border border-accent/30 rounded-card p-8 sm:p-12 text-center overflow-hidden">
          {/* 控えめな装飾罫線 */}
          <div
            className="absolute top-0 left-0 right-0 h-0.5 bg-accent"
            aria-hidden="true"
          />

          <h2 className="text-2xl sm:text-display-sm font-semibold text-text-primary mb-4">
            すべての業務に、おしごと AI を。
          </h2>
          <p className="text-base sm:text-lg text-text-secondary mb-8 max-w-2xl mx-auto leading-relaxed">
            まずは登録不要のチュートリアルで体験してください。
            <br className="hidden md:block" />
            社内展開の可否は、その後で判断いただけます。
          </p>

          {/* 安心バッジ */}
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-8 text-sm text-text-muted">
            {['初期費用 0 円', 'クレジットカード不要', '最低利用期間なし', '国内データ滞留'].map(
              (badge) => (
                <li key={badge} className="flex items-center gap-1.5">
                  <svg
                    className="w-3.5 h-3.5 text-status-pass flex-shrink-0"
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
              ),
            )}
          </ul>

          {/* CTA ボタン */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-lg mx-auto">
            <a
              href="/tutorial"
              className="w-full sm:w-auto px-8 py-3.5 bg-accent text-white rounded-card text-base font-semibold hover:bg-accent-hover transition-colors duration-120 text-center"
            >
              無料で試す
            </a>
            <a
              href="mailto:contact@fujitrace.com?subject=%E5%B0%8E%E5%85%A5%E3%81%AE%E3%81%94%E7%9B%B8%E8%AB%87"
              className="w-full sm:w-auto px-6 py-3.5 text-text-secondary hover:text-text-primary border border-border rounded-card font-medium hover:bg-app-bg-elevated transition-colors duration-120 text-center"
            >
              導入のご相談
            </a>
          </div>

          <p className="mt-6 text-sm text-text-muted">
            すでにアカウントをお持ちの方は
            <a
              href="/dashboard"
              onClick={trackDashboardConversion}
              className="text-accent hover:underline underline-offset-2 mx-1"
            >
              ダッシュボード
            </a>
            からご利用いただけます。
          </p>
        </div>

        {/* カピぶちょー軽い励まし — 末尾にちょこんと (Section 7.3 改訂) */}
        <div className="mt-12 sm:mt-14 flex justify-center">
          <MascotQuote
            size="sm"
            quote="気軽に話しかけてや〜。うち、いつでも待っとるで。"
          />
        </div>
      </div>
    </section>
  );
}
