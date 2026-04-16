const problems = [
  {
    title: 'AIの誤情報で、顧客の信頼が一瞬で崩れる',
    description: 'AIが自信満々に生成した誤情報が顧客対応に使われれば、企業ブランドの毀損と訴訟リスクに直結します。気づいたときには手遅れです。',
  },
  {
    title: '情報漏洩は、経営者の責任問題になる',
    description: 'マイナンバーや顧客情報がAIの出力に含まれてしまう。一度の漏洩が行政処分・損害賠償・経営責任の追及につながります。',
  },
  {
    title: 'AI投資の説明責任を果たせない',
    description: 'どの部署が、どのAIに、いくら使っているか把握できない。取締役会や監査法人にAI投資の妥当性を説明できますか？',
  },
  {
    title: 'AIの判断過程がブラックボックスのまま',
    description: 'AIエージェントの意思決定を説明できない。問題発生時に取引先や規制当局への説明責任を果たせません。',
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
          <h2 className="text-2xl sm:text-display-sm font-semibold text-text-primary mb-4">
            AI活用を阻む、
            <br className="sm:hidden" />
            経営リスクの正体
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            生成AIの導入を検討されている経営者の方へ。
            <br className="hidden md:block" />
            以下のリスクが、AI戦略の推進を妨げていませんか？
          </p>
        </div>

        {/* Problems grid */}
        <div className="grid md:grid-cols-2 gap-4">
          {problems.map((problem, index) => (
            <div
              key={index}
              className="feature-card hover:bg-app-bg-elevated transition-colors duration-120"
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
