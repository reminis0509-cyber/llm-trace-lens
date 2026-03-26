const partnerTypes = [
  {
    title: 'リセラー',
    description: 'FujiTraceの販売・セット提案を行うパートナー',
    details: [
      'AIエージェント導入案件にFujiTraceをセット提案',
      '獲得報酬: Standard ¥100,000 / Plus ¥250,000 / Premium ¥500,000',
      '更新ボーナス: 2年目以降の継続時に追加報酬',
      '営業テンプレート・デモ環境を提供',
    ],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
  },
  {
    title: 'リファラル',
    description: '見込み顧客をご紹介いただくパートナー',
    details: [
      '紹介のみでOK。商談・契約はFujiTraceが担当',
      '獲得報酬の50%を紹介手数料としてお支払い',
      'Standard紹介で¥50,000、Plus紹介で¥125,000',
      '契約書テンプレートを提供',
    ],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
  {
    title: 'OEM',
    description: '自社製品にFujiTraceを組み込むパートナー',
    details: [
      '自社AIプロダクトにトレース機能をホワイトラベル提供',
      '料金体系は個別交渉',
      'API/SDKの技術サポートを優先提供',
      '共同マーケティングの機会あり',
    ],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.491 48.491 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.401.604-.401.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
      </svg>
    ),
  },
];

const benefits = [
  '初年度ノルマなし',
  'デモ環境の無償提供',
  '3パターンの営業戦術テンプレート',
  'パートナー専用Slackチャンネル',
];

export default function Partners() {
  return (
    <section id="partners" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="section-container">
        {/* Section header */}
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-6">
            Partner Program
          </span>
          <h2 className="text-display-sm font-semibold text-text-primary mb-4">
            パートナー企業募集
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            AIエージェント販売チャネルとFujiTraceのセット販売で、
            <br className="hidden sm:block" />
            三方良しのビジネスモデルを実現します
          </p>
        </div>

        {/* Partner type cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-12">
          {partnerTypes.map((type, index) => (
            <div key={index} className="surface-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-card bg-accent-dim flex items-center justify-center text-accent">
                  {type.icon}
                </div>
                <div>
                  <h3 className="text-base font-medium text-text-primary">
                    {type.title}
                  </h3>
                  <p className="text-xs text-text-muted">{type.description}</p>
                </div>
              </div>

              <ul className="space-y-2">
                {type.details.map((detail, i) => (
                  <li
                    key={i}
                    className="flex items-start text-sm text-text-secondary"
                  >
                    <span className="text-text-muted mr-2 mt-1 text-xs">•</span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Benefits */}
        <div className="surface-card p-6 mb-8">
          <h3 className="text-sm font-medium text-text-primary mb-4">
            パートナー特典
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="flex items-center text-sm text-text-secondary"
              >
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
                <span>{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <a
            href="mailto:partner@fujitrace.jp"
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-card text-sm font-medium hover:bg-accent/90 transition-colors duration-120"
          >
            パートナー登録のお問い合わせ
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
              />
            </svg>
          </a>
          <p className="text-xs text-text-muted mt-3">
            partner@fujitrace.jp までお気軽にご連絡ください
          </p>
        </div>
      </div>
    </section>
  );
}
