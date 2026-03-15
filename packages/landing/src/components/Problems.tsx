const problems = [
  {
    title: 'ハルシネーション',
    subtitle: 'AIの嘘',
    description: 'AIは自信満々に誤った情報を生成。ビジネスでの誤情報提供は信頼性を大きく損なう。',
    borderColor: 'border-l-status-fail',
  },
  {
    title: '自信過剰な回答',
    subtitle: '根拠なき確信',
    description: '根拠が薄い回答でも「確実です」と返答。信頼度スコアなしでは判断不能。',
    borderColor: 'border-l-status-warn',
  },
  {
    title: '機密情報の漏洩',
    subtitle: 'PII・APIキー露出',
    description: 'クレジットカード、マイナンバー、APIキー等がAI出力に含まれるリスク。',
    borderColor: 'border-l-status-block',
  },
  {
    title: 'Agentのブラックボックス',
    subtitle: '意思決定の不透明性',
    description: 'AIエージェントが何を考え、なぜその行動を取ったか。思考プロセスが追えない。',
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
            The Challenge
          </span>
          <h2 className="text-display-sm font-semibold text-text-primary mb-4">
            AI活用における課題
          </h2>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            ビジネスでAIを活用する際、見過ごせないリスクが存在する
          </p>
        </div>

        {/* Problems grid */}
        <div className="grid md:grid-cols-2 gap-4">
          {problems.map((problem, index) => (
            <div
              key={index}
              className={`feature-card ${problem.borderColor} hover:bg-base-elevated transition-colors duration-120`}
            >
              <div className="mb-3">
                <span className="text-xs text-text-muted label-spacing uppercase">{problem.subtitle}</span>
                <h3 className="text-lg font-medium text-text-primary mt-1">{problem.title}</h3>
              </div>
              <p className="text-sm text-text-secondary">{problem.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
