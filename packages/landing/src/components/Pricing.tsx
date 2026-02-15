const plans = [
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
      'ワークスペース 1個',
      'コミュニティサポート',
    ],
    cta: '無料で始める',
    ctaHref: '#demo',
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
      'ワークスペース 3個 / 10名',
      'SLA 99.5%',
    ],
    cta: '今すぐ導入する',
    ctaHref: '#contact',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: '個別見積',
    priceNote: '',
    description: '大規模組織・金融・医療向け',
    features: [
      '無制限トレース',
      'LLM-as-Judge 無制限',
      'SSO / SAML 対応',
      '365日間のデータ保持',
      '無制限ワークスペース・メンバー',
      'SLA 99.9% + 専任サポート',
    ],
    cta: 'お問い合わせ',
    ctaHref: '#contact',
    highlighted: false,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-24 px-6">
      <div className="section-container">
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-6">
            Pricing
          </span>
          <h2 className="text-display-sm font-semibold text-text-primary mb-4">
            シンプルな料金プラン
          </h2>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            チームの規模に合わせて最適なプランをお選びください
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          {plans.map((plan, index) => (
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
                <h3 className="text-lg font-medium text-text-primary mb-1">{plan.name}</h3>
                <p className="text-sm text-text-muted">{plan.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-2xl font-mono tabular-nums text-text-primary">{plan.price}</span>
                <span className="ml-2 text-text-muted text-sm">{plan.priceNote}</span>
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center text-sm text-text-secondary">
                    <svg
                      className="w-4 h-4 mr-2 text-accent flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
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

        <div className="mt-8 text-center">
          <p className="text-sm text-text-muted">
            ※ OSSセルフホスト版は全機能無料。クラウド版は上記プランが適用されます。
          </p>
        </div>
      </div>
    </section>
  );
}
