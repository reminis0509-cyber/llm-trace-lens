const features = [
  {
    title: '日本語PII検出',
    description: 'マイナンバー、住所、電話番号、パスポート、保険証、免許証を自動検出・ブロック。',
    borderColor: 'border-l-status-block',
    isNew: true,
  },
  {
    title: 'LLM-as-Judge評価',
    description: 'OpenAI・Claude 両対応。回答の忠実性・関連性を自動スコアリング。',
    borderColor: 'border-l-violet-400',
    isNew: true,
  },
  {
    title: 'Agentトレース',
    description: 'ReActパターンの思考・行動・観察を構造化して完全可視化。',
    borderColor: 'border-l-status-pass',
    isNew: true,
  },
  {
    title: '信頼度検証',
    description: '信頼度スコアと根拠の数を照合。自信過剰な回答を自動検出。',
    borderColor: 'border-l-accent',
  },
  {
    title: 'コスト・予算管理',
    description: 'モデル別コストをリアルタイム計算。fail-closed予算ガードで超過を防止。',
    borderColor: 'border-l-status-fail',
  },
  {
    title: 'リスクスコアリング',
    description: '4要素の加重平均で0-100のリスクスコアを算出。SQLi・XSSも検出。',
    borderColor: 'border-l-status-warn',
  },
  {
    title: 'マルチプロバイダー',
    description: 'OpenAI、Anthropic、Gemini に対応。URL変更だけで導入。',
    borderColor: 'border-l-blue-400',
  },
  {
    title: 'プラン課金基盤',
    description: 'Free / Pro / Enterprise Standard〜Premium の5段階。月次トレースカウント・自動制限。',
    borderColor: 'border-l-amber-400',
  },
];

export default function Features() {
  return (
    <section id="features" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="section-container">
        {/* Section header */}
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-6">
            Features
          </span>
          <h2 className="text-display-sm font-semibold text-text-primary mb-4">
            エンタープライズ向けフル機能
          </h2>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            AIの可観測性・検証・エージェントトレースに必要なすべて
          </p>
        </div>

        {/* Features grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`feature-card ${feature.borderColor} hover:bg-base-elevated transition-colors duration-120 relative`}
            >
              {feature.isNew && (
                <span className="absolute top-4 right-4 px-2 py-0.5 text-[10px] text-accent bg-accent-dim rounded font-mono">
                  NEW
                </span>
              )}
              <h3 className="text-sm font-medium text-text-primary mb-2">{feature.title}</h3>
              <p className="text-sm text-text-secondary">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
