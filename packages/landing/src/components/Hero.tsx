import { trackDashboardConversion } from '../utils/gtag';
import { useSeo } from '../hooks/useSeo';

/**
 * Hero — LP メインビジュアル (2026-04-28 完全作り直し)
 *
 * 戦略 doc Section 18.2.M / Section 7.3 配置ルール:
 *  - **カピぶちょー(マスコット)はここでは出さない**
 *    Hero は商品名 + メインコピー + CTA が主役。キャラを入れると焦点ぼやける。
 *  - 御見積書プレビューは AI の成果物として温存
 *  - Stats(数値訴求 5/8/23/¥3,000) は Hero 内に小さく統合
 *
 * 戦略 doc Section 9.5 「明るい未来の 3 主体ストーリー」:
 *  - メインコピー「おしごと AI、雇いませんか。」
 *  - サブ「採用市場が壊れた日本で、月¥3,000 から事務員 1 人分働く AI を。」
 */
export default function Hero() {
  useSeo({
    title:
      'おしごと AI、雇いませんか。 月¥3,000 から事務員 1 人分働く AI を | FujiTrace',
    description:
      '採用市場が壊れた日本で、月¥3,000 から事務員 1 人分働くおしごと AI を。見積書・請求書・議事録・スライドまで、机上の事務作業をひととおり。国内データ滞留・承認後実行で運用できます。',
    url: 'https://fujitrace.jp/',
  });

  const scrollToDemo = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById('home-end-cta')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="pt-24 pb-16 sm:pt-28 sm:pb-20 px-4 sm:px-6">
      <div className="section-container w-full">
        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 items-center">
          {/* ---- Left: headline + copy + CTA (キャラなし) ---- */}
          <div>
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 surface-card text-xs mb-6">
              <span className="w-1.5 h-1.5 bg-accent rounded-full" aria-hidden="true" />
              <span className="text-text-muted">採用市場が壊れた日本で</span>
            </div>

            {/* Main headline */}
            <h1 className="text-[2rem] sm:text-display-sm lg:text-[3rem] font-semibold text-text-primary mb-5 leading-[1.2] tracking-tight">
              おしごと AI、
              <br />
              雇いませんか。
            </h1>

            {/* Subheadline */}
            <p className="text-base sm:text-lg text-text-secondary mb-7 leading-relaxed">
              月¥3,000 から、事務員 1 人分働く AI を。
              <br className="hidden sm:block" />
              見積書・請求書・議事録・スライドまで、机上の仕事をひととおり。
            </p>

            {/* Trust badges (inline、控えめ) */}
            <ul className="flex flex-wrap gap-x-5 gap-y-2 mb-8 text-sm text-text-secondary">
              {['国内データ滞留', '承認後に実行', '日本の商慣習に準拠'].map((badge) => (
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

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
              <a
                href="/tutorial"
                onClick={trackDashboardConversion}
                className="px-7 py-3.5 bg-accent text-white rounded-card text-base font-semibold hover:bg-accent-hover transition-colors duration-120 text-center"
              >
                無料で試す
              </a>
              <a
                href="#home-end-cta"
                onClick={scrollToDemo}
                className="px-6 py-3.5 text-text-secondary hover:text-text-primary border border-border rounded-card font-medium hover:bg-app-bg-elevated transition-colors duration-120 text-center"
              >
                LINE で相談する
              </a>
            </div>
            <p className="text-sm text-text-muted">
              クレジットカード不要・メール登録だけで、当日からおしごと AI が稼働します。
            </p>

            {/* Stats — 数字 4 つ (LP 内に小さく統合) */}
            <div className="mt-10 pt-8 border-t border-border-subtle grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 max-w-2xl">
              {[
                { value: '5', unit: '種', label: '対応書類' },
                { value: '8', unit: '章', label: 'Tutorial' },
                { value: '23', unit: '問', label: 'Quest' },
                { value: '¥3,000', unit: '〜', label: '月額' },
              ].map((stat) => (
                <div key={stat.label} className="text-left">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl sm:text-3xl font-mono tabular-nums text-text-primary">
                      {stat.value}
                    </span>
                    {stat.unit && <span className="text-sm text-text-muted">{stat.unit}</span>}
                  </div>
                  <div className="mt-1 text-xs text-text-muted label-spacing">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ---- Right: 御見積書プレビュー (資産温存、キャラなし) ---- */}
          <div className="relative">
            {/* 薄い背景紙 */}
            <div
              className="absolute inset-0 -translate-x-3 translate-y-3 bg-app-bg-surface border border-border rounded-card"
              aria-hidden="true"
            />
            {/* 前面の和文ビジネス文書 */}
            <div className="relative bg-white border border-border rounded-card p-6 sm:p-8 shadow-sm">
              {/* タイトル */}
              <div className="text-center pb-4 border-b-2 border-[#1a1a1a]">
                <h2 className="text-lg sm:text-xl font-semibold text-[#1a1a1a] tracking-[0.4em] ml-[0.4em]">
                  御見積書
                </h2>
              </div>

              {/* 宛先 / 発行者 */}
              <div className="grid grid-cols-2 gap-4 mt-5 text-[11px] sm:text-xs text-[#1a1a1a]">
                <div>
                  <p className="mb-1 text-[#444]">宛先</p>
                  <p className="text-sm font-medium">
                    株式会社 日本橋商事 <span className="text-[#666] font-normal">御中</span>
                  </p>
                  <p className="mt-3 text-[#444]">件名</p>
                  <p className="text-sm">業務システム導入支援</p>
                </div>
                <div className="text-right">
                  <p className="text-[#444]">発行日</p>
                  <p className="text-sm">令和8年4月20日</p>
                  <p className="mt-3 text-[#444]">見積番号</p>
                  <p className="text-sm font-mono">EST-20260420-001</p>
                </div>
              </div>

              {/* 明細テーブル */}
              <div className="mt-5 border border-[#1a1a1a]">
                <div className="grid grid-cols-[40px_1fr_56px_88px] bg-[#f8f9fa] border-b border-[#1a1a1a] text-[10px] sm:text-[11px] text-[#444]">
                  <div className="px-2 py-1.5 text-center border-r border-[#333]">No</div>
                  <div className="px-2 py-1.5 border-r border-[#333]">品名</div>
                  <div className="px-2 py-1.5 text-center border-r border-[#333]">数量</div>
                  <div className="px-2 py-1.5 text-right">金額</div>
                </div>
                {[
                  { no: '1', name: '要件定義', qty: '1式', amount: '250,000' },
                  { no: '2', name: '設計・実装', qty: '1式', amount: '850,000' },
                  { no: '3', name: '導入研修', qty: '1回', amount: '120,000' },
                ].map((row) => (
                  <div
                    key={row.no}
                    className="grid grid-cols-[40px_1fr_56px_88px] text-[11px] sm:text-xs text-[#1a1a1a] border-b border-[#333] last:border-b-0"
                  >
                    <div className="px-2 py-1.5 text-center border-r border-[#333] font-mono">
                      {row.no}
                    </div>
                    <div className="px-2 py-1.5 border-r border-[#333]">{row.name}</div>
                    <div className="px-2 py-1.5 text-center border-r border-[#333]">{row.qty}</div>
                    <div className="px-2 py-1.5 text-right tabular-nums">{row.amount}</div>
                  </div>
                ))}
              </div>

              {/* 合計 — 二重線風 */}
              <div className="mt-4 ml-auto w-full sm:w-64">
                <div className="flex justify-between text-[11px] sm:text-xs text-[#444] py-1">
                  <span>小計</span>
                  <span className="tabular-nums text-[#1a1a1a]">1,220,000円</span>
                </div>
                <div className="flex justify-between text-[11px] sm:text-xs text-[#444] py-1">
                  <span>消費税 (10%)</span>
                  <span className="tabular-nums text-[#1a1a1a]">122,000円</span>
                </div>
                <div className="flex justify-between items-baseline border-t-2 border-double border-[#1a1a1a] pt-1.5 mt-1">
                  <span className="text-xs font-medium text-[#1a1a1a]">合計</span>
                  <span className="text-base font-semibold tabular-nums text-[#1a1a1a]">
                    1,342,000円
                  </span>
                </div>
              </div>

              {/* AI検証チップ */}
              <div className="mt-4 pt-4 border-t border-border-subtle flex items-center gap-2 text-[11px] text-text-muted">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-status-pass/10 text-status-pass font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-pass" aria-hidden="true" />
                  AI検証済み
                </span>
                <span>金額・消費税・記載事項 チェック完了</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
