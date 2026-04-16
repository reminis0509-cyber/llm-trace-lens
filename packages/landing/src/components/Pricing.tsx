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

interface PlanCard {
  name: string;
  price: string;
  priceNote: string;
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
    price: '\u00A50',
    priceNote: '/ \u6708',
    description: '\u307E\u305A\u306F\u8A66\u3057\u3066\u307F\u308B',
    features: [
      '\u30D5\u30B8\u5BFE\u8A71\uFF085 \u6642\u9593\u3054\u3068\u306B\u30EA\u30BB\u30C3\u30C8\uFF09',
      '\u66F8\u985E\u4F5C\u6210\u30FB\u30C1\u30A7\u30C3\u30AF\uFF08\u5BFE\u8A71\u56DE\u6570\u306B\u542B\u3080\uFF09',
      '\u30C1\u30E5\u30FC\u30C8\u30EA\u30A2\u30EB 4 \u7AE0',
      'Watch Room\uFF087 \u65E5\u4FDD\u6301\uFF09',
      '\u4F1A\u793E\u60C5\u5831 1 \u793E',
    ],
    cta: '\u7121\u6599\u3067\u59CB\u3081\u308B',
    ctaHref: '/tutorial',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '\u00A53,000',
    priceNote: '/ \u6708',
    description: 'AI \u3092\u4F7F\u3044\u3053\u306A\u3059',
    features: [
      '\u30D5\u30B8\u5BFE\u8A71 \u7121\u5236\u9650',
      '\u66F8\u985E\u4F5C\u6210\u30FB\u30C1\u30A7\u30C3\u30AF \u7121\u5236\u9650',
      '\u81EA\u5F8B\u30E2\u30FC\u30C9',
      '\u5FDC\u7528\u30AF\u30A8\u30B9\u30C8\u6559\u6750 \u5168\u958B\u653E',
      'Watch Room\uFF0890 \u65E5\u4FDD\u6301\uFF09',
      '\u4F1A\u793E\u60C5\u5831 \u7121\u5236\u9650',
    ],
    cta: '\u307E\u305A\u306F\u7121\u6599\u3067\u8A66\u3059',
    ctaHref: '/tutorial',
    highlighted: true,
    badge: '\u304A\u3059\u3059\u3081',
  },
  {
    name: 'Max',
    price: '\u00A515,000',
    priceNote: '/ \u6708',
    description: '\u30C1\u30FC\u30E0\u3067\u672C\u683C\u904B\u7528',
    features: [
      'Pro \u306E\u5168\u6A5F\u80FD',
      'Watch Room\uFF0890 \u65E5 + \u5168\u6587\u691C\u7D22\uFF09',
      '\u512A\u5148\u30B5\u30DD\u30FC\u30C8',
    ],
    cta: '\u307E\u305A\u306F\u7121\u6599\u3067\u8A66\u3059',
    ctaHref: '/tutorial',
    highlighted: false,
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
            シンプルな料金体系
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            Free（5時間ごとにリセット）から、登録するだけですぐに始められます。
          </p>
        </div>

        {/* 3 plan cards */}
        <div className="grid lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative surface-card p-6 flex flex-col ${
                plan.highlighted
                  ? 'border-accent ring-1 ring-accent/20'
                  : ''
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-block px-3 py-0.5 text-xs font-medium text-white bg-accent rounded-full">
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
                <span className="text-3xl font-mono tabular-nums text-text-primary">
                  {plan.price}
                </span>
                <span className="ml-1 text-text-muted text-sm">
                  {plan.priceNote}
                </span>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature, i) => (
                  <li
                    key={i}
                    className="flex items-start text-sm text-text-secondary"
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
                    : 'bg-app-bg-elevated text-text-secondary border border-border hover:text-text-primary'
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
