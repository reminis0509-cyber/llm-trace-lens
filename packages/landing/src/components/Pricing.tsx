const plans = [
  {
    name: 'Starter',
    price: '未定',
    priceNote: '/ 月',
    description: '小規模チーム向け',
    features: [
      '月間 10,000 リクエスト',
      '基本検証機能',
      '7日間のトレース保持',
      'メールサポート',
    ],
    cta: 'お問い合わせ',
    highlighted: false,
  },
  {
    name: 'Professional',
    price: '未定',
    priceNote: '/ 月',
    description: '成長中のチーム向け',
    features: [
      '月間 100,000 リクエスト',
      '全検証機能',
      '30日間のトレース保持',
      'Slack/Teams連携',
      'カスタムルール',
      '優先サポート',
    ],
    cta: 'お問い合わせ',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: '未定',
    priceNote: 'カスタム',
    description: '大規模組織向け',
    features: [
      '無制限リクエスト',
      '全機能 + カスタム開発',
      '無制限トレース保持',
      'マルチワークスペース',
      'SSO / SAML',
      'SLA保証',
      '専任サポート',
    ],
    cta: 'お問い合わせ',
    highlighted: false,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            シンプルな<span className="gradient-text">料金プラン</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            チームの規模に合わせて最適なプランをお選びください
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`rounded-2xl p-8 ${
                plan.highlighted
                  ? 'bg-gradient-to-br from-primary-600 to-accent-600 text-white shadow-2xl scale-105'
                  : 'bg-white border border-gray-200 shadow-lg'
              }`}
            >
              {plan.highlighted && (
                <div className="inline-flex items-center px-3 py-1 bg-white/20 rounded-full text-sm font-medium mb-4">
                  おすすめ
                </div>
              )}
              <h3 className={`text-2xl font-bold mb-2 ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                {plan.name}
              </h3>
              <p className={`mb-6 ${plan.highlighted ? 'text-white/80' : 'text-gray-600'}`}>
                {plan.description}
              </p>
              <div className="mb-6">
                <span className={`text-4xl font-extrabold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                  {plan.price}
                </span>
                <span className={`ml-2 ${plan.highlighted ? 'text-white/80' : 'text-gray-500'}`}>
                  {plan.priceNote}
                </span>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center">
                    <svg
                      className={`w-5 h-5 mr-3 ${plan.highlighted ? 'text-white' : 'text-green-500'}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className={plan.highlighted ? 'text-white' : 'text-gray-600'}>{feature}</span>
                  </li>
                ))}
              </ul>
              <a
                href="#contact"
                className={`block w-full py-3 px-6 rounded-xl font-semibold text-center transition-all ${
                  plan.highlighted
                    ? 'bg-white text-primary-600 hover:bg-gray-100'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-500">
            ※ 料金は現在調整中です。詳細はお問い合わせください。
          </p>
        </div>
      </div>
    </section>
  );
}
