/**
 * Pricing — LP 料金セクション (AI Employee v1, 2026-04-20)
 *
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
    price: '\u00A50',
    priceNote: '/ \u6708',
    audience: '\u307E\u305A\u8A66\u3057\u3066\u307F\u305F\u3044\u65B9\u3078',
    description: '\u66F8\u985E\u696D\u52D9\u306E AI \u4F53\u9A13\u3092\u3001\u7121\u6599\u3067\u3002',
    features: [
      '\u66F8\u985E\u696D\u52D9 AI \u793E\u54E1\uFF08\u898B\u7A4D\u66F8\u30FB\u8ACB\u6C42\u66F8\u30FB\u7D0D\u54C1\u66F8\u30FB\u767A\u6CE8\u66F8\u30FB\u9001\u4ED8\u72B6\uFF09',
      '\u65E5\u6B21 30 \u56DE\u307E\u3067\u306E\u30C8\u30EC\u30FC\u30B9\u76E3\u8996',
      '\u65E5\u672C\u8A9E PII \u691C\u51FA\uFF08\u30DE\u30A4\u30CA\u30F3\u30D0\u30FC\u30FB\u4F4F\u6240\u30FB\u96FB\u8A71\u756A\u53F7 15+ \u30D1\u30BF\u30FC\u30F3\uFF09',
      '\u30B9\u30B1\u30EB\u30C8\u30F3 trace\uFF08\u76F4\u8FD1 1 \u4EF6\u306E\u30EA\u30A2\u30EB\u30BF\u30A4\u30E0\u8868\u793A\uFF09',
      '7 \u65E5\u9593\u306E\u30C7\u30FC\u30BF\u4FDD\u6301',
    ],
    cta: '\u7121\u6599\u3067\u59CB\u3081\u308B',
    ctaHref: '/tutorial',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '\u00A53,000',
    priceNote: '/ \u6708',
    audience: '\u500B\u4EBA\u30FBSOHO \u5411\u3051',
    description: '\u500B\u4EBA\u306E\u66F8\u985E\u696D\u52D9\u3092\u3001AI \u306B\u4EFB\u305B\u308B\u3002',
    features: [
      'Free \u30D7\u30E9\u30F3\u306E\u5168\u6A5F\u80FD',
      '\u6708\u9593 50,000 \u30C8\u30EC\u30FC\u30B9 / LLM-as-Judge \u8A55\u4FA1 1,000 \u56DE',
      '\u30B9\u30B1\u30EB\u30C8\u30F3 trace \u5168\u5C65\u6B74\u4FDD\u5B58\uFF0890 \u65E5\u9593\uFF09',
      '\u30AB\u30B9\u30BF\u30E0\u30D0\u30EA\u30C7\u30FC\u30B7\u30E7\u30F3\u30EB\u30FC\u30EB\uFF085 \u4EF6\u307E\u3067\uFF09',
      '\u30EF\u30FC\u30AF\u30B9\u30DA\u30FC\u30B9 3 \u3064 / \u30E1\u30F3\u30D0\u30FC 3 \u540D\u307E\u3067',
      '\u30E1\u30FC\u30EB\u30B5\u30DD\u30FC\u30C8\uFF08\u65E5\u672C\u8A9E\u3001\u55B6\u696D\u65E5 24 \u6642\u9593\u4EE5\u5185\uFF09',
      'AI \u793E\u54E1\uFF08Agent \u03B2\uFF09\u306B\u3088\u308B\u81EA\u5F8B\u5B9F\u884C',
    ],
    cta: 'Pro \u306B\u30A2\u30C3\u30D7\u30B0\u30EC\u30FC\u30C9',
    ctaHref: '/dashboard',
    highlighted: true,
    badge: '\u4EBA\u6C17',
  },
  {
    name: 'Team',
    price: '\u00A56,000',
    priceNote: '/ \u5E2D / \u6708',
    priceSubnote: '\u6700\u4F4E 2 \u5E2D\uFF1D\u00A512,000 / \u6708\uFF5E',
    audience: '\u4E2D\u5C0F\u4F01\u696D 5-20 \u540D\u5411\u3051',
    description: '\u30C1\u30FC\u30E0\u5168\u54E1\u3067\u3001\u66F8\u985E\u696D\u52D9\u306E\u8CEA\u3092\u63C3\u3048\u308B\u3002',
    features: [
      'Pro \u30D7\u30E9\u30F3\u306E\u5168\u6A5F\u80FD',
      '\u6708\u9593 250,000 \u30C8\u30EC\u30FC\u30B9 / LLM-as-Judge \u8A55\u4FA1 5,000 \u56DE',
      '\u5171\u6709\u30EF\u30FC\u30AF\u30B9\u30DA\u30FC\u30B9\uFF08\u66F8\u985E\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u30FB\u53D6\u5F15\u5148 DB\uFF09',
      '\u7A1F\u8B70\u627F\u8A8D\u30D5\u30ED\u30FC\uFF08\u4F5C\u6210\u8005\u2192\u627F\u8A8D\u8005\u2192\u9001\u4ED8\uFF09',
      '\u76E3\u67FB\u30ED\u30B0\uFF08\u5168\u4EF6\u8A18\u9332\u3001180 \u65E5\u4FDD\u6301\uFF09',
      'SLA 99.5% + \u30E1\u30FC\u30EB\u512A\u5148\u30B5\u30DD\u30FC\u30C8',
      '\u6700\u5927 20 \u540D\u307E\u3067 / \u6700\u4F4E 2 \u5E2D\u304B\u3089',
    ],
    cta: '\u30C1\u30FC\u30E0\u3067\u59CB\u3081\u308B',
    ctaHref: '/dashboard',
    highlighted: false,
    badge: '\u65B0\u767B\u5834',
  },
  {
    name: 'Max',
    price: '\u00A515,000',
    priceNote: '/ \u6708',
    audience: '\u30D1\u30EF\u30FC\u30E6\u30FC\u30B6\u30FC\u30FB\u5C02\u9580\u8077\u5411\u3051',
    description: '\u5236\u7D04\u306E\u306A\u3044 FujiTrace \u3092\u3001\u4E00\u4EBA\u3067\u4F7F\u3044\u5012\u3059\u3002',
    features: [
      'Team \u76F8\u5F53\u306E AI \u6A5F\u80FD\uFF08\u500B\u4EBA\u5229\u7528\u7248\uFF09',
      '\u6708\u9593 500,000 \u30C8\u30EC\u30FC\u30B9 / LLM-as-Judge \u8A55\u4FA1 15,000 \u56DE',
      'Google Calendar / Gmail / Chatwork / freee \u306A\u3069\u5168\u30B3\u30CD\u30AF\u30BF\u5229\u7528\u53EF',
      '365 \u65E5\u306E\u30C7\u30FC\u30BF\u4FDD\u6301 + \u5168\u30C8\u30EC\u30FC\u30B9\u8A73\u7D30\u30ED\u30B0',
      'SLA 99.9% + \u512A\u5148\u30B5\u30DD\u30FC\u30C8\uFF08\u55B6\u696D\u65E5 4 \u6642\u9593\u4EE5\u5185\uFF09',
      '\u30EF\u30FC\u30AF\u30B9\u30DA\u30FC\u30B9 10 \u500B / \u30E1\u30F3\u30D0\u30FC 10 \u540D\u307E\u3067',
      '\u30AB\u30B9\u30BF\u30E0\u30D0\u30EA\u30C7\u30FC\u30B7\u30E7\u30F3 30 \u4EF6 / PII \u30EB\u30FC\u30EB 30 \u4EF6',
    ],
    cta: 'Max \u3067\u59CB\u3081\u308B',
    ctaHref: '/dashboard',
    highlighted: false,
  },
  {
    name: 'Enterprise',
    price: '\u00A550,000\u301C',
    priceNote: '/ \u6708',
    priceSubnote: '\u500B\u5225\u898B\u7A4D\uFF0F\u5E74\u6B21\u5951\u7D04',
    audience: '\u5927\u4F01\u696D\u30FB\u5B98\u516C\u5E81\u30FB\u91D1\u878D\u30FB\u533B\u7642\u5411\u3051',
    description: '\u7A1F\u8B70\u3092\u901A\u3057\u3066\u3001\u5168\u793E\u3067 AI \u904B\u7528\u3092\u3002',
    features: [
      'Max \u30D7\u30E9\u30F3\u306E\u5168\u6A5F\u80FD',
      '\u7121\u5236\u9650\u30C8\u30EC\u30FC\u30B9 / \u7121\u5236\u9650 LLM-as-Judge \u8A55\u4FA1',
      'SSO / SAML / Azure AD \u7D71\u5408',
      '\u56FD\u5185\u30C7\u30FC\u30BF\u6EDE\u7559\u4FDD\u8A3C\uFF08\u65E5\u672C\u30EA\u30FC\u30B8\u30E7\u30F3\u5C02\u7528\u30A4\u30F3\u30B9\u30BF\u30F3\u30B9\uFF09',
      'P\u30DE\u30FC\u30AF\u6E96\u62E0\u904B\u7528 + ISO27001 \u30ED\u30FC\u30C9\u30DE\u30C3\u30D7',
      '\u5C02\u4EFB\u62C5\u5F53 + \u96FB\u8A71\u30B5\u30DD\u30FC\u30C8 + SLA 99.95%',
      '\u5E74\u6B21\u5951\u7D04\uFF08\u00A5600,000 / \u5E74\u304B\u3089\uFF09 + \u30AB\u30B9\u30BF\u30E0\u5951\u7D04\u66F8\u5BFE\u5FDC',
    ],
    cta: '\u304A\u554F\u3044\u5408\u308F\u305B',
    ctaHref: 'mailto:contact@fujitrace.com?subject=Enterprise%20%E3%83%97%E3%83%A9%E3%83%B3%E5%B0%8E%E5%85%A5%E3%81%AE%E3%81%94%E7%9B%B8%E8%AB%87',
    highlighted: false,
    badge: '\u65B0\u767B\u5834',
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
            AI社員を雇うコストを、個人でも大企業でも合う形に。
          </p>
        </div>

        {/* 5 plan cards — wraps 3 / 2 on desktop */}
        <div className="grid gap-6 max-w-6xl mx-auto sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative surface-card p-6 flex flex-col ${
                plan.highlighted
                  ? 'border-accent ring-1 ring-accent/20'
                  : ''
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-block px-3 py-0.5 text-xs font-medium text-white bg-accent rounded-full whitespace-nowrap">
                  {plan.badge}
                </span>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-medium text-text-primary mb-1">
                  {plan.name}
                </h3>
                <p className="text-xs text-text-muted">{plan.audience}</p>
              </div>

              <div className="mb-4">
                <span className="text-3xl font-mono tabular-nums text-text-primary">
                  {plan.price}
                </span>
                <span className="ml-1 text-text-muted text-sm">
                  {plan.priceNote}
                </span>
                {plan.priceSubnote && (
                  <p className="mt-1 text-xs text-text-muted">{plan.priceSubnote}</p>
                )}
              </div>

              <p className="text-sm text-text-secondary mb-5 leading-relaxed">
                {plan.description}
              </p>

              <ul className="space-y-2.5 mb-6 flex-1">
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

        <p className="mt-10 text-xs text-text-muted text-center">
          表示価格はすべて税抜です。年次契約は10%割引でご利用いただけます。Free と Enterprise を除くすべてのプランはクレジットカードで即時開始できます。
        </p>
      </div>
    </section>
  );
}
