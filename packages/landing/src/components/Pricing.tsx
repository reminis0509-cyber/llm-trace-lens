import { useState } from 'react';

const challenges = [
  {
    challenge: 'AIの品質を数値で把握したい',
    free: 'パターンベースの基本検知のみ',
    pro: 'LLM-as-Judgeで回答品質をスコア化',
  },
  {
    challenge: '過去の障害から改善したい',
    free: '7日間のみ保存',
    pro: '90日間保存 + 全文検索',
  },
  {
    challenge: 'ハルシネーションを即座に検知したい',
    free: '通知なし（手動確認のみ）',
    pro: 'リアルタイムアラート通知',
  },
  {
    challenge: 'APIコストを最適化したい',
    free: '合計金額のみ表示',
    pro: 'プロバイダー別・モデル別の内訳分析',
  },
  {
    challenge: '監査・コンプライアンスに対応したい',
    free: '保存期間が不十分',
    pro: '長期保存 + 証跡エクスポート',
  },
];

const mainPlans = [
  {
    name: 'Free',
    price: '\u00A50',
    priceNote: '/ \u6708',
    description: '\u307E\u305A\u306F\u8A66\u3057\u3066\u307F\u308B',
    features: [
      '\u6708\u9593 5,000 \u30C8\u30EC\u30FC\u30B9',
      '\u30EA\u30A2\u30EB\u30BF\u30A4\u30E0\u30C8\u30EC\u30FC\u30B9',
      '\u65E5\u672C\u8A9EPII\u691C\u51FA\u30FB\u30D6\u30ED\u30C3\u30AF',
      '7\u65E5\u9593\u306E\u30C7\u30FC\u30BF\u4FDD\u6301',
      '1\u30B7\u30FC\u30C8',
    ],
    cta: '\u7121\u6599\u3067\u59CB\u3081\u308B',
    ctaHref: '/dashboard',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '\u00A59,800',
    priceNote: '/ \u6708',
    description: '\u54C1\u8CEA\u7BA1\u7406\u3092\u672C\u683C\u7684\u306B\u59CB\u3081\u308B',
    badge: '30\u65E5\u9593\u7121\u6599\u30C8\u30E9\u30A4\u30A2\u30EB',
    features: [
      '\u6708\u9593 50,000 \u30C8\u30EC\u30FC\u30B9',
      'LLM-as-Judge \u54C1\u8CEA\u8A55\u4FA1\uFF08\u67081,000\u56DE\uFF09',
      '\u30AB\u30B9\u30BF\u30E0\u30D0\u30EA\u30C7\u30FC\u30B7\u30E7\u30F3\u30EB\u30FC\u30EB',
      '90\u65E5\u9593\u306E\u30C7\u30FC\u30BF\u4FDD\u6301',
      '\u7121\u5236\u9650\u30B7\u30FC\u30C8',
      '\u30EA\u30A2\u30EB\u30BF\u30A4\u30E0\u30A2\u30E9\u30FC\u30C8\u901A\u77E5',
      '\u30E1\u30FC\u30EB\u30B5\u30DD\u30FC\u30C8\uFF08\u65E5\u672C\u8A9E\uFF09',
    ],
    cta: '\u7121\u6599\u30C8\u30E9\u30A4\u30A2\u30EB\u3092\u59CB\u3081\u308B',
    ctaHref: '/dashboard',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: '\u00A5300,000\u301C',
    priceNote: '/ \u5E74',
    description: 'SLA\u4ED8\u304D\u306E\u672C\u683C\u904B\u7528\u306B',
    features: [
      '\u6708\u9593 100,000+ \u30C8\u30EC\u30FC\u30B9',
      'LLM-as-Judge \u54C1\u8CEA\u8A55\u4FA1\uFF08\u7121\u5236\u9650\uFF09',
      'SSO / SAML \u5BFE\u5FDC',
      '180\u301C365\u65E5\u9593\u306E\u30C7\u30FC\u30BF\u4FDD\u6301',
      '\u7121\u5236\u9650\u30B7\u30FC\u30C8',
      'SLA 99.5\u301C99.95%',
      '\u5C02\u4EFBSlack\u30B5\u30DD\u30FC\u30C8',
    ],
    cta: '\u304A\u554F\u3044\u5408\u308F\u305B',
    ctaHref: '#contact',
    highlighted: false,
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

const CrossIcon = () => (
  <svg
    className="w-4 h-4 mr-2 text-text-muted flex-shrink-0"
    fill="none"
    viewBox="0 0 20 20"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l8 8M14 6l-8 8" />
  </svg>
);

export default function Pricing() {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <section id="pricing" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="section-container">
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-6">
            Pricing
          </span>
          <h2 className="text-display-sm font-semibold text-text-primary mb-4">
            あなたの課題に合ったプランを選ぶ
          </h2>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            登録するだけでPro機能を30日間無料で体験できます。
            <br className="hidden sm:block" />
            まずは無料で始めて、AIの品質管理を実感してください。
          </p>
        </div>

        {/* Challenge-based comparison table */}
        <div className="surface-card p-6 mb-8 overflow-x-auto">
          <h3 className="text-sm font-medium text-text-muted label-spacing uppercase mb-6">
            あなたの課題はどれですか？
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 pr-4 text-text-secondary font-medium w-2/5">課題</th>
                <th className="text-left py-3 px-4 text-text-muted font-medium w-[30%]">Free</th>
                <th className="text-left py-3 pl-4 text-accent font-medium w-[30%]">Pro</th>
              </tr>
            </thead>
            <tbody>
              {challenges.map((row, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  <td className="py-3 pr-4 text-text-primary font-medium">{row.challenge}</td>
                  <td className="py-3 px-4 text-text-muted">
                    <span className="flex items-center">
                      <CrossIcon />
                      {row.free}
                    </span>
                  </td>
                  <td className="py-3 pl-4 text-text-secondary">
                    <span className="flex items-center">
                      <CheckIcon />
                      {row.pro}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              {plan.badge && (
                <span className="absolute -top-3 left-4 px-2 py-0.5 bg-accent text-white text-xs rounded font-mono">
                  {plan.badge}
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
                    ? 'bg-accent text-white hover:bg-accent/90'
                    : 'bg-base-elevated text-text-secondary border border-border hover:text-text-primary'
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>

        {/* Detail expansion toggle */}
        <div className="mt-6 text-center">
          <button
            onClick={() => setShowDetail(!showDetail)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors duration-120"
          >
            <span>Enterprise Plus / Premium の詳細を見る</span>
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${
                showDetail ? 'rotate-180' : ''
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
        {showDetail && (
          <div className="mt-4 grid md:grid-cols-2 gap-4">
            <div className="surface-card p-6">
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between mb-4">
                <h3 className="text-lg font-medium text-text-primary">Enterprise Plus</h3>
                <div className="mt-1 sm:mt-0 text-right">
                  <span className="text-lg font-mono tabular-nums text-text-primary">{'\u00A5960,000 / \u5E74'}</span>
                  <span className="block text-xs text-text-muted mt-0.5">{'\u6708\u984D\u63DB\u7B97 \u00A580,000'}</span>
                </div>
              </div>
              <ul className="space-y-2 mb-6">
                {[
                  '\u6708\u9593 500,000 \u30C8\u30EC\u30FC\u30B9',
                  'LLM-as-Judge \u8A55\u4FA1\uFF08\u670815,000\u56DE\uFF09',
                  'SSO / SAML \u5BFE\u5FDC',
                  '365\u65E5\u9593\u306E\u30C7\u30FC\u30BF\u4FDD\u6301',
                  'SLA 99.9% + \u5C02\u4EFBSlack\u30B5\u30DD\u30FC\u30C8',
                ].map((f, i) => (
                  <li key={i} className="flex items-center text-sm text-text-secondary">
                    <CheckIcon /><span>{f}</span>
                  </li>
                ))}
              </ul>
              <a href="#contact" className="block w-full py-2.5 px-4 rounded-card text-sm font-medium text-center bg-base-elevated text-text-secondary border border-border hover:text-text-primary transition-colors duration-120">
                お問い合わせ
              </a>
            </div>
            <div className="surface-card p-6">
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between mb-4">
                <h3 className="text-lg font-medium text-text-primary">Enterprise Premium</h3>
                <div className="mt-1 sm:mt-0 text-right">
                  <span className="text-lg font-mono tabular-nums text-text-primary">{'\u00A52,400,000\u301C / \u5E74'}</span>
                  <span className="block text-xs text-text-muted mt-0.5">{'\u6708\u984D\u63DB\u7B97 \u00A5200,000\u301C'}</span>
                </div>
              </div>
              <ul className="space-y-2 mb-6">
                {[
                  '\u30C8\u30EC\u30FC\u30B9\u4E0A\u9650 \u500B\u5225\u898B\u7A4D',
                  'LLM-as-Judge \u8A55\u4FA1 \u500B\u5225\u898B\u7A4D',
                  '\u7121\u5236\u9650\u30C7\u30FC\u30BF\u4FDD\u6301',
                  'SLA 99.95% + \u5C02\u4EFB\u96FB\u8A71\u30B5\u30DD\u30FC\u30C8',
                  '\u30AA\u30F3\u30D7\u30EC\u30DF\u30B9 / VPC \u5BFE\u5FDC',
                ].map((f, i) => (
                  <li key={i} className="flex items-center text-sm text-text-secondary">
                    <CheckIcon /><span>{f}</span>
                  </li>
                ))}
              </ul>
              <a href="#contact" className="block w-full py-2.5 px-4 rounded-card text-sm font-medium text-center bg-base-elevated text-text-secondary border border-border hover:text-text-primary transition-colors duration-120">
                お問い合わせ
              </a>
            </div>
          </div>
        )}

        {/* Overage & note */}
        <div className="mt-8 surface-card p-5">
          <h4 className="text-sm font-medium text-text-primary mb-3">
            従量課金（上限超過時）
          </h4>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1 text-sm text-text-secondary">
            <p>トレース超過: \u00A5200\u301C300 / 万トレース</p>
            <p>評価超過: \u00A5100\u301C200 / 千回</p>
          </div>
          <p className="text-xs text-text-muted mt-3">
            ※ OSSセルフホスト版は全機能無料。クラウド版は上記プランが適用されます。
          </p>
        </div>
      </div>
    </section>
  );
}
