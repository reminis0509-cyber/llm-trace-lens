import { useState } from 'react';
import { trackDashboardConversion } from '../utils/gtag';

interface PlanInfo {
  name: string;
  monthlyBase: number;
  features: string[];
  cta: string;
  ctaHref: string;
}

const plans: PlanInfo[] = [
  {
    name: 'Free',
    monthlyBase: 0,
    features: ['\u30D5\u30B8\u5BFE\u8A71 \u6708 30 \u56DE', '\u66F8\u985E\u4F5C\u6210\u30FB\u30C1\u30A7\u30C3\u30AF\uFF08\u5BFE\u8A71\u56DE\u6570\u306B\u542B\u3080\uFF09', 'Watch Room\uFF087 \u65E5\u4FDD\u6301\uFF09', '\u4F1A\u793E\u60C5\u5831 1 \u793E'],
    cta: '\u7121\u6599\u3067\u59CB\u3081\u308B',
    ctaHref: '/tutorial',
  },
  {
    name: 'Pro',
    monthlyBase: 3000,
    features: ['\u30D5\u30B8\u5BFE\u8A71 \u7121\u5236\u9650', '\u66F8\u985E\u4F5C\u6210\u30FB\u30C1\u30A7\u30C3\u30AF \u7121\u5236\u9650', '\u81EA\u5F8B\u30E2\u30FC\u30C9', '\u5FDC\u7528\u30AF\u30A8\u30B9\u30C8\u6559\u6750 \u5168\u958B\u653E', 'Watch Room\uFF0890 \u65E5\u4FDD\u6301\uFF09', '\u4F1A\u793E\u60C5\u5831 \u7121\u5236\u9650'],
    cta: '\u307E\u305A\u306F\u7121\u6599\u3067\u8A66\u3059',
    ctaHref: '/tutorial',
  },
  {
    name: 'Max',
    monthlyBase: 15000,
    features: ['Pro \u306E\u5168\u6A5F\u80FD', 'Watch Room\uFF0890 \u65E5 + \u5168\u6587\u691C\u7D22\uFF09', '\u512A\u5148\u30B5\u30DD\u30FC\u30C8'],
    cta: '\u307E\u305A\u306F\u7121\u6599\u3067\u8A66\u3059',
    ctaHref: '/tutorial',
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

function formatPrice(n: number): string {
  return `\u00A5${n.toLocaleString('ja-JP')}`;
}

export default function PricingSimulator() {
  const [selectedIndex, setSelectedIndex] = useState(1);
  const plan = plans[selectedIndex];

  return (
    <section id="pricing-simulator" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="section-container">
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-6">
            Pricing Simulator
          </span>
          <h2 className="text-2xl sm:text-display-sm font-semibold text-text-primary mb-4">
            プランを比較する
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            あなたの利用スタイルに合ったプランをお選びください
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Left Column - Plan selector */}
          <div className="surface-card p-6">
            <h3 className="text-sm font-medium text-text-muted label-spacing uppercase mb-6">
              プラン選択
            </h3>
            <div className="space-y-3">
              {plans.map((p, i) => (
                <button
                  key={p.name}
                  onClick={() => setSelectedIndex(i)}
                  className={`w-full text-left px-4 py-3 rounded-card border transition-colors duration-120 ${
                    selectedIndex === i
                      ? 'border-accent bg-accent/5'
                      : 'border-border hover:border-accent/40'
                  }`}
                  aria-pressed={selectedIndex === i}
                  aria-label={`${p.name} プランを選択`}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium text-text-primary">{p.name}</span>
                    <span className="text-sm font-mono tabular-nums text-text-primary">
                      {formatPrice(p.monthlyBase)}
                      <span className="text-text-muted text-xs"> / 月</span>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right Column - Details */}
          <div className="surface-card p-6">
            {/* Plan badge */}
            <div className="mb-6">
              <span className="text-xs text-text-muted label-spacing uppercase">
                選択中のプラン
              </span>
              <div className="mt-2">
                <span className="inline-block px-3 py-1 text-sm font-medium text-accent bg-accent/10 rounded-card">
                  {plan.name}
                </span>
              </div>
            </div>

            {/* Price display */}
            <div className="mb-6">
              <span className="text-xs text-text-muted label-spacing uppercase">
                月額
              </span>
              <div className="mt-2">
                <span className="text-3xl font-mono tabular-nums text-text-primary">
                  {formatPrice(plan.monthlyBase)}
                </span>
                <span className="ml-2 text-text-muted text-sm">/ 月</span>
              </div>
            </div>

            {/* Features */}
            <div className="mb-6 border-t border-border pt-4">
              <span className="text-xs text-text-muted label-spacing uppercase">
                含まれる機能
              </span>
              <ul className="mt-3 space-y-2">
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
            </div>

            {/* CTA */}
            <a
              href={plan.ctaHref}
              onClick={plan.ctaHref === '/dashboard' ? trackDashboardConversion : undefined}
              className="block w-full py-2.5 px-4 rounded-card text-sm font-medium text-center transition-colors duration-120 bg-accent text-white hover:bg-accent/90"
            >
              {plan.cta}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
