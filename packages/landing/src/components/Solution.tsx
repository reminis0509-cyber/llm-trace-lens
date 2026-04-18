const solutions = [
  {
    step: '01',
    title: 'チュートリアルで即体験',
    description:
      '登録不要・30秒で開始。ボタン操作からチャット指示まで、4章構成のハンズオン教材でAI事務員の使い方を体験できます。',
  },
  {
    step: '02',
    title: 'クエストで実務レベルに',
    description:
      '全15段階のクエストで、見積書作成から競合調査レポート、業務フロー全体の自動化まで。実際にAIを動かしながらスキルを身につけます。',
  },
  {
    step: '03',
    title: 'AIミスを自動検出して安心運用',
    description:
      'AIが生成した書類の金額ミス・記載漏れをリアルタイムで検出。日本語の機密情報15種類以上を自動遮断し、安全にAIを業務で使えます。',
  },
];

export default function Solution() {
  return (
    <section id="solution" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="section-container">
        {/* Section header */}
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-6">
            解決策
          </span>
          <h2 className="text-2xl sm:text-display-sm font-semibold text-text-primary mb-4">
            FujiTrace なら、
            <br className="sm:hidden" />
            社員がAIを使いこなせる
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            体験 → 練習 → 実務の3ステップで、
            <br className="hidden md:block" />
            AIを「知っている」から「使いこなせる」に変えます。
          </p>
        </div>

        {/* Solution steps */}
        <div className="grid lg:grid-cols-3 gap-4">
          {solutions.map((solution, index) => (
            <div key={index} className="surface-card p-6 hover:bg-app-bg-elevated transition-colors duration-120">
              <div className="w-10 h-10 rounded-card bg-accent-dim text-accent flex items-center justify-center font-mono text-sm mb-4">
                {solution.step}
              </div>
              <h3 className="text-base font-medium text-text-primary mb-2">{solution.title}</h3>
              <p className="text-sm text-text-secondary">{solution.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
