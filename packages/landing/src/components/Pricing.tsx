/**
 * Pricing — LP 料金セクション (2026-04-28 リブランド)
 *
 * 旧名「AI 社員」「AI 事務員」を「おしごと AI」に統一。プラン構造・価格は不変。
 * 5 プラン体系 (Free / Pro / Team / Max / Enterprise)。CFO コピー集
 * `docs/pricing-copy-2026-04-20.md` を情報源とする。
 */

const CheckIcon = () => (
  <svg
    className="w-4 h-4 mr-2 text-accent flex-shrink-0"
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
);

interface PlanCard {
  name: string;
  price: string;
  priceNote: string;
  priceSubnote?: string;
  audience: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlighted: boolean;
  badge?: string;
}

const plans: PlanCard[] = [
  {
    name: 'Free',
    price: '¥0',
    priceNote: '/ 月',
    audience: 'まず試してみたい方へ',
    description: '書類業務の AI 体験を、無料で。',
    features: [
      'おしごと AI(見積書・請求書・納品書・発注書・送付状)',
      '日次 30 回までのトレース監視',
      '日本語 PII 検出(マイナンバー・住所・電話番号 15+ パターン)',
      'スケルトン trace(直近 1 件のリアルタイム表示)',
      '7 日間のデータ保持',
    ],
    cta: '無料で始める',
    ctaHref: '/tutorial',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '¥3,000',
    priceNote: '/ 月',
    audience: '個人・SOHO 向け',
    description: '個人の書類業務を、おしごと AI に任せる。',
    features: [
      'Free プランの全機能',
      '月間 50,000 トレース / LLM-as-Judge 評価 1,000 回',
      'スケルトン trace 全履歴保存(90 日間)',
      'カスタムバリデーションルール(5 件まで)',
      'ワークスペース 3 つ / メンバー 3 名まで',
      'メールサポート(日本語、営業日 24 時間以内)',
      'おしごと AI(Agent β)による自律実行',
    ],
    cta: 'Pro にアップグレード',
    ctaHref: '/dashboard',
    highlighted: true,
    badge: '人気',
  },
  {
    name: 'Team',
    price: '¥6,000',
    priceNote: '/ 席 / 月',
    priceSubnote: '最低 2 席=¥12,000 / 月〜',
    audience: '中小企業 5-20 名向け',
    description: 'チーム全員で、書類業務の質を揃える。',
    features: [
      'Pro プランの全機能',
      '月間 250,000 トレース / LLM-as-Judge 評価 5,000 回',
      '共有ワークスペース(書類テンプレート・取引先 DB)',
      '稟議承認フロー(作成者→承認者→送付)',
      '監査ログ(全件記録、180 日保持)',
      'SLA 99.5% + メール優先サポート',
      '最大 20 名まで / 最低 2 席から',
    ],
    cta: 'チームで始める',
    ctaHref: '/dashboard',
    highlighted: true,
    badge: '中小企業推奨',
  },
  {
    name: 'Max',
    price: '¥15,000',
    priceNote: '/ 月',
    audience: 'パワーユーザー・専門職向け',
    description: '制約のない FujiTrace を、一人で使い倒す。',
    features: [
      'Team 相当の AI 機能(個人利用版)',
      '月間 500,000 トレース / LLM-as-Judge 評価 15,000 回',
      'Google Calendar / Gmail / Chatwork / freee など全コネクタ利用可',
      '365 日のデータ保持 + 全トレース詳細ログ',
      'SLA 99.9% + 優先サポート(営業日 4 時間以内)',
      'ワークスペース 10 個 / メンバー 10 名まで',
      'カスタムバリデーション 30 件 / PII ルール 30 件',
    ],
    cta: 'Max で始める',
    ctaHref: '/dashboard',
    highlighted: false,
  },
  {
    name: 'Enterprise',
    price: '¥50,000〜',
    priceNote: '/ 月',
    priceSubnote: '個別見積/年次契約',
    audience: '大企業・官公庁・金融・医療向け',
    description: '稟議を通して、全社で AI 運用を。',
    features: [
      'Max プランの全機能',
      '無制限トレース / 無制限 LLM-as-Judge 評価',
      'SSO / SAML / Azure AD 統合',
      '国内データ滞留保証(日本リージョン専用インスタンス)',
      'Pマーク準拠運用 + ISO27001 ロードマップ',
      '専任担当 + 電話サポート + SLA 99.95%',
      '年次契約(¥600,000 / 年から) + カスタム契約書対応',
    ],
    cta: 'お問い合わせ',
    ctaHref: 'mailto:contact@fujitrace.com?subject=Enterprise%20%E3%83%97%E3%83%A9%E3%83%B3%E5%B0%8E%E5%85%A5%E3%81%AE%E3%81%94%E7%9B%B8%E8%AB%87',
    highlighted: false,
    badge: '新登場',
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="section-container">
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-6">
            Pricing
          </span>
          <h2 className="text-2xl sm:text-display-sm font-semibold text-text-primary mb-4">
            料金プラン
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            個人・中小企業・大規模組織まで、必要な分だけ。
            <br className="hidden md:block" />
            すべてのプランで国内データ滞留・最低利用期間なしです。
          </p>
        </div>

        {/* 5 plan cards — Founder 指摘 2026-04-28: 縦長すぎ問題を解消、
            features を 3 項目に絞り、padding 縮小、価格と CTA を主役に */}
        <div className="grid gap-4 max-w-6xl mx-auto sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative surface-card p-5 flex flex-col ${
                plan.highlighted
                  ? 'border-accent ring-2 ring-accent/30 shadow-md'
                  : ''
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-block px-3 py-0.5 text-xs font-bold text-white bg-accent rounded-full whitespace-nowrap shadow">
                  {plan.badge}
                </span>
              )}

              <div className="mb-3">
                <h3 className="text-xl font-bold text-text-primary mb-0.5">
                  {plan.name}
                </h3>
                <p className="text-xs text-text-muted">{plan.audience}</p>
              </div>

              <div className="mb-4">
                <span className="text-3xl font-mono tabular-nums text-text-primary font-bold">
                  {plan.price}
                </span>
                <span className="ml-1 text-text-muted text-xs">
                  {plan.priceNote}
                </span>
                {plan.priceSubnote && (
                  <p className="mt-1 text-[11px] text-text-muted">{plan.priceSubnote}</p>
                )}
              </div>

              {/* 主要機能 上位 3 項目のみ — フル機能は /pricing */}
              <ul className="space-y-2 mb-5 flex-1">
                {plan.features.slice(0, 3).map((feature, i) => (
                  <li
                    key={i}
                    className="flex items-start text-xs sm:text-sm text-text-secondary leading-relaxed"
                  >
                    <CheckIcon />
                    <span>{feature}</span>
                  </li>
                ))}
                {plan.features.length > 3 && (
                  <li className="text-[11px] text-text-muted pl-6">
                    + 他 {plan.features.length - 3} 機能
                  </li>
                )}
              </ul>

              <a
                href={plan.ctaHref}
                className={`block w-full py-2.5 px-4 rounded-card text-sm font-semibold text-center transition-colors duration-120 ${
                  plan.highlighted
                    ? 'bg-accent text-white hover:bg-accent/90'
                    : 'bg-app-bg-elevated text-text-secondary border border-border hover:text-text-primary'
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>

        {/* 詳細リンク + 注釈 */}
        <div className="mt-10 text-center space-y-3">
          <a
            href="/pricing"
            className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline underline-offset-4"
          >
            全プランの詳細を見る
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
              />
            </svg>
          </a>
          <p className="text-xs text-text-muted">
            表示価格はすべて税抜。年次契約は 10% 割引。Free と Enterprise を除く全プランはクレジットカードで即時開始可能。
          </p>
        </div>
      </div>
    </section>
  );
}
