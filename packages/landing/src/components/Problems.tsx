const problems = [
  {
    title: 'AIの誤情報が企業の信頼を毀損する',
    description: 'AIが自信満々に生成した誤情報が顧客対応や意思決定に使われれば、企業ブランドと顧客からの信頼を大きく損ないます。',
    borderColor: 'border-l-status-fail',
  },
  {
    title: '情報漏洩が法的リスクに直結する',
    description: 'マイナンバーや顧客情報がAIの出力に含まれてしまう。一度の漏洩が訴訟・行政処分・ブランド毀損につながります。',
    borderColor: 'border-l-status-block',
  },
  {
    title: 'AI投資のROIが見えない',
    description: 'どの部署が、どのAIに、いくら使っているか把握できない。経営会議でAI投資の妥当性を説明できますか？',
    borderColor: 'border-l-status-warn',
  },
  {
    title: 'AIの判断過程を説明できない',
    description: 'AIエージェントの意思決定がブラックボックス。問題発生時に取締役会や監査で説明責任を果たせません。',
    borderColor: 'border-l-accent',
  },
];

export default function Problems() {
  return (
    <section id="problems" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="section-container">
        {/* Section header */}
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-6">
            課題
          </span>
          <h2 className="text-display-sm font-semibold text-text-primary mb-4">
            AI活用を阻む、経営リスクの正体
          </h2>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            生成AIを事業に導入したいCEOの方へ。以下のリスクが、AI戦略の推進を妨げていませんか？
          </p>
        </div>

        {/* Problems grid */}
        <div className="grid md:grid-cols-2 gap-4">
          {problems.map((problem, index) => (
            <div
              key={index}
              className={`feature-card ${problem.borderColor} hover:bg-base-elevated transition-colors duration-120`}
            >
              <h3 className="text-lg font-medium text-text-primary mb-2">{problem.title}</h3>
              <p className="text-sm text-text-secondary">{problem.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
