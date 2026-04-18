const steps = [
  {
    number: '01',
    title: 'チュートリアルで体験する',
    subtitle: '全4章 / 登録不要',
    description:
      'ボタン1つで見積書を生成。チャットで指示を出す方法を学び、反復で経験値を積み、複雑な指示まで段階的にマスター。修了証も発行されます。',
    mockup: (
      <div className="space-y-2">
        {['Ch.1 ボタンで見積書作成', 'Ch.2 チャットで指示', 'Ch.3 反復で経験値', 'Ch.4 複雑な指示'].map(
          (ch, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-2.5 rounded-card bg-white border border-border"
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono ${i < 2 ? 'bg-status-pass text-white' : 'bg-app-bg-elevated text-text-muted'}`}
              >
                {i < 2 ? '✓' : i + 1}
              </div>
              <span className="text-sm text-text-primary">{ch}</span>
            </div>
          ),
        )}
      </div>
    ),
  },
  {
    number: '02',
    title: 'クエストで鍛える',
    subtitle: '全15問 / 初級〜上級',
    description:
      '実際にAIを動かしながら、見積書30秒作成から競合調査レポート、業務フロー全体の自動化まで。実務で使えるレベルまで経験を積めます。',
    mockup: (
      <div className="space-y-2">
        {[
          { level: '初級', color: 'bg-blue-100 text-blue-700', quests: '5問', example: '見積書30秒作成' },
          {
            level: '中級',
            color: 'bg-purple-100 text-purple-700',
            quests: '5問',
            example: '競合調査レポート',
          },
          {
            level: '上級',
            color: 'bg-amber-100 text-amber-700',
            quests: '5問',
            example: '業務フロー全体',
          },
        ].map((tier) => (
          <div
            key={tier.level}
            className="flex items-center justify-between p-2.5 rounded-card bg-white border border-border"
          >
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${tier.color}`}>
                {tier.level}
              </span>
              <span className="text-sm text-text-primary">{tier.example}</span>
            </div>
            <span className="text-xs text-text-muted">{tier.quests}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    number: '03',
    title: '実務で使いこなす',
    subtitle: '5種の書類 / AI事務員',
    description:
      '見積書・請求書・納品書・発注書・送付状をAIが作成・チェック。金額ミスや記載漏れもリアルタイムで検出。社員にやらせれば、即戦力に。',
    mockup: (
      <div className="grid grid-cols-2 gap-2">
        {['見積書', '請求書', '納品書', '発注書'].map((doc) => (
          <div
            key={doc}
            className="flex items-center gap-2 p-2.5 rounded-card bg-white border border-border"
          >
            <div className="w-5 h-5 rounded bg-accent-dim text-accent flex items-center justify-center">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <span className="text-sm text-text-primary">{doc}</span>
          </div>
        ))}
        <div className="col-span-2 flex items-center gap-2 p-2.5 rounded-card bg-white border border-border">
          <div className="w-5 h-5 rounded bg-accent-dim text-accent flex items-center justify-center">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <span className="text-sm text-text-primary">送付状</span>
        </div>
      </div>
    ),
  },
];

export default function EducationShowcase() {
  return (
    <section id="education" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="section-container">
        {/* Section header */}
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-6">
            導入方法
          </span>
          <h2 className="text-2xl sm:text-display-sm font-semibold text-text-primary mb-4">
            体験して、鍛えて、使いこなす。
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            社員にFujiTraceを使わせるだけで、
            <br className="hidden md:block" />
            AIを実務で活用できる人材に育ちます。
          </p>
        </div>

        {/* 3-column cards */}
        <div className="grid lg:grid-cols-3 gap-6">
          {steps.map((step) => (
            <div key={step.number} className="surface-card p-6 flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-card bg-accent-dim text-accent flex items-center justify-center font-mono text-sm">
                  {step.number}
                </div>
                <div>
                  <h3 className="text-base font-medium text-text-primary">{step.title}</h3>
                  <p className="text-xs text-text-muted">{step.subtitle}</p>
                </div>
              </div>
              <p className="text-sm text-text-secondary mb-5 leading-relaxed">{step.description}</p>
              {/* Mockup */}
              <div className="mt-auto p-3 rounded-card bg-app-bg-elevated border border-border">
                {step.mockup}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
