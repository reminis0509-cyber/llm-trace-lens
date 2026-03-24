const problems = [
  {
    title: 'ハルシネーション（AIの誤情報生成）',
    description: 'AIが自信満々に誤った情報を生成。顧客対応や社内報告で誤情報が拡散すれば、企業の信頼を大きく損なうリスクがあります。',
    borderColor: 'border-l-status-fail',
  },
  {
    title: '個人情報・機密データの漏洩',
    description: 'マイナンバー、顧客の住所、クレジットカード番号がAIの出力に含まれてしまう。情報漏洩は法的リスクに直結します。',
    borderColor: 'border-l-status-block',
  },
  {
    title: 'AI利用コストの不透明さ',
    description: 'どの部署が、どのモデルに、いくら使っているか把握できない。気づいたときには予算を大幅に超過していた、という事態が起こり得ます。',
    borderColor: 'border-l-status-warn',
  },
  {
    title: 'AIエージェントの判断がブラックボックス',
    description: 'AIエージェントが何を考え、なぜその行動を取ったのか追跡できない。問題発生時の原因究明が困難になります。',
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
            こんな課題はありませんか？
          </h2>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            生成AIを業務に導入したいが、リスク管理に不安を感じている経営者・技術責任者の方へ
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
