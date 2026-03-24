import { useState } from 'react';

const mainPlans = [
  {
    name: 'Free',
    price: '¥0',
    priceNote: '/ 月',
    description: '個人開発・検証向け',
    features: [
      '月間 5,000 トレース',
      'リアルタイムトレース',
      '日本語PII検出・ブロック',
      '7日間のデータ保持',
      '1シート',
      'コミュニティサポート',
    ],
    cta: '無料で始める',
    ctaHref: '/dashboard',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '¥9,800',
    priceNote: '/ 月',
    description: '本番運用チーム向け',
    features: [
      '月間 50,000 トレース',
      'LLM-as-Judge 評価（月1,000回）',
      'カスタムバリデーションルール',
      '90日間のデータ保持',
      '無制限シート',
      'メールサポート（日本語）',
    ],
    cta: '今すぐ導入する',
    ctaHref: '#contact',
    highlighted: false,
  },
  {
    name: 'Enterprise Standard',
    price: '¥300,000',
    priceNote: '/ 年',
    description: 'SLA付きの本格運用に',
    features: [
      '月間 100,000 トレース',
      'LLM-as-Judge 評価（月3,000回）',
      '業界ベンチマーク',
      '180日間のデータ保持',
      '無制限シート',
      'SLA 99.5% + オンボーディング',
    ],
    cta: 'お問い合わせ',
    ctaHref: '#contact',
    highlighted: true,
  },
];

const enterprisePlans = [
  {
    name: 'Enterprise Plus',
    price: '¥960,000 / 年',
    monthlyEquivalent: '月額換算 ¥80,000',
    features: [
      '月間 500,000 トレース',
      'LLM-as-Judge 評価（月15,000回）',
      'SSO / SAML 対応',
      '365日間のデータ保持',
      'SLA 99.9% + 専任Slackサポート',
    ],
  },
  {
    name: 'Enterprise Premium',
    price: '¥2,400,000〜 / 年',
    monthlyEquivalent: '月額換算 ¥200,000〜',
    features: [
      'トレース上限 個別見積',
      'LLM-as-Judge 評価 個別見積',
      '無制限データ保持',
      'SLA 99.95% + 専任電話サポート',
      'オンプレミス / VPC 対応',
    ],
  },
];

const CheckIcon = () => (
  <svg
    className="w-4 h-4 mr-2 text-accent flex-shrink-0"
    fill="currentColor"
    viewBox="0 0 20 20"
  >
    <path
      fillRule="evenodd"
      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
      clipRule="evenodd"
    />
  </svg>
);

export default function Pricing() {
  const [showEnterprise, setShowEnterprise] = useState(false);

  return (
    <section id="pricing" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="section-container">
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-6">
            Pricing
          </span>
          <h2 className="text-display-sm font-semibold text-text-primary mb-4">
            AIガバナンスへの投資を最適化する料金プラン
          </h2>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            スモールスタートからエンタープライズ規模まで、事業フェーズに合わせてスケール。
            <br className="hidden sm:block" />
            すべてのEnterpriseプランは年次契約です。
          </p>
        </div>

        {/* Main 3 plans */}
        <div className="grid lg:grid-cols-3 gap-4">
          {mainPlans.map((plan, index) => (
            <div
              key={index}
              className={`surface-card p-6 relative ${
                plan.highlighted ? 'border-accent' : ''
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-4 px-2 py-0.5 bg-accent text-base text-xs rounded font-mono">
                  おすすめ
                </span>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-medium text-text-primary mb-1">
                  {plan.name}
                </h3>
                <p className="text-sm text-text-muted">{plan.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-2xl font-mono tabular-nums text-text-primary">
                  {plan.price}
                </span>
                <span className="ml-2 text-text-muted text-sm">
                  {plan.priceNote}
                </span>
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, i) => (
                  <li
                    key={i}
                    className="flex items-center text-sm text-text-secondary"
                  >
                    <CheckIcon />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href={plan.ctaHref}
                className={`block w-full py-2.5 px-4 rounded-card text-sm font-medium text-center transition-colors duration-120 ${
                  plan.highlighted
                    ? 'bg-accent text-base hover:bg-accent/90'
                    : 'bg-base-elevated text-text-secondary border border-border hover:text-text-primary'
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>

        {/* Enterprise expansion toggle */}
        <div className="mt-6 text-center">
          <button
            onClick={() => setShowEnterprise(!showEnterprise)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors duration-120"
          >
            <span>大規模向け Enterprise Plus / Premium を見る</span>
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${
                showEnterprise ? 'rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>

        {/* Enterprise Plus / Premium */}
        {showEnterprise && (
          <div className="mt-4 grid md:grid-cols-2 gap-4">
            {enterprisePlans.map((plan, index) => (
              <div key={index} className="surface-card p-6">
                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between mb-4">
                  <h3 className="text-lg font-medium text-text-primary">
                    {plan.name}
                  </h3>
                  <div className="mt-1 sm:mt-0 text-right">
                    <span className="text-lg font-mono tabular-nums text-text-primary">
                      {plan.price}
                    </span>
                    <span className="block text-xs text-text-muted mt-0.5">
                      {plan.monthlyEquivalent}
                    </span>
                  </div>
                </div>

                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature, i) => (
                    <li
                      key={i}
                      className="flex items-center text-sm text-text-secondary"
                    >
                      <CheckIcon />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href="#contact"
                  className="block w-full py-2.5 px-4 rounded-card text-sm font-medium text-center bg-base-elevated text-text-secondary border border-border hover:text-text-primary transition-colors duration-120"
                >
                  お問い合わせ
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Overage & note */}
        <div className="mt-8 surface-card p-5">
          <h4 className="text-sm font-medium text-text-primary mb-3">
            従量課金（上限超過時）
          </h4>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1 text-sm text-text-secondary">
            <p>トレース超過: ¥200〜300 / 万トレース</p>
            <p>評価超過: ¥100〜200 / 千回</p>
          </div>
          <p className="text-xs text-text-muted mt-3">
            ※ OSSセルフホスト版は全機能無料。クラウド版は上記プランが適用されます。
          </p>
        </div>
      </div>
    </section>
  );
}
