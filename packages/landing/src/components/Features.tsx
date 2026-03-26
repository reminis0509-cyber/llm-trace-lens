const features = [
  {
    title: '日本企業の機密情報を自動保護',
    description: 'マイナンバー、住所、電話番号など15種類以上の日本固有の機密情報を自動検出・遮断。',
  },
  {
    title: 'AI回答の品質を自動で担保',
    description: '回答の正確性・関連性をAIが自動でスコアリング。品質基準を満たさない回答を検出します。',
  },
  {
    title: 'AIエージェントの判断過程を完全記録',
    description: 'AIエージェントの思考・行動・結果を構造化して記録。監査対応と説明責任を支援します。',
  },
  {
    title: '誤情報による経営リスクを早期検出',
    description: '信頼度スコアと根拠を照合し、自信過剰な回答や事実と異なる出力を自動検出します。',
  },
  {
    title: 'AI投資コストを透明化・最適化',
    description: 'モデル別コストをリアルタイム計算。予算上限を設定し、コスト超過を自動で防止します。',
  },
  {
    title: 'セキュリティリスクを定量評価',
    description: '多面的なリスクスコアを自動算出。インジェクション攻撃など外部脅威も検出します。',
  },
  {
    title: '主要AIプロバイダーに統一対応',
    description: 'OpenAI、Anthropic、Google Gemini を統一管理。ベンダーロックインを防ぎます。',
  },
  {
    title: '事業規模に合わせた柔軟な料金体系',
    description: '無料プランから大規模企業向けまで5段階。スモールスタートから段階的にスケール可能。',
  },
];

export default function Features() {
  return (
    <section id="features" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="section-container">
        {/* Section header */}
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-6">
            機能一覧
          </span>
          <h2 className="text-display-sm font-semibold text-text-primary mb-4">
            AIガバナンスに必要な全機能を搭載
          </h2>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            AI活用のリスク管理・品質保証・コスト最適化をワンストップで実現
          </p>
        </div>

        {/* Features grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature, index) => (
            <div
              key={index}
              className="feature-card hover:border-accent/50 hover:bg-base-elevated transition-colors duration-120"
            >
              <h3 className="text-sm font-medium text-text-primary mb-2">{feature.title}</h3>
              <p className="text-sm text-text-secondary">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
