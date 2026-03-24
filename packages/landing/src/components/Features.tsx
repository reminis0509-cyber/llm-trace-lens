const features = [
  {
    title: '日本語の機密情報を自動検知',
    description: 'マイナンバー、住所、電話番号、パスポート、保険証、免許証など15種類以上を自動検出・遮断。',
    borderColor: 'border-l-status-block',
    isNew: true,
  },
  {
    title: 'AIによる回答品質の自動評価',
    description: 'OpenAI・Anthropic両対応。回答の正確性・関連性をAIが自動でスコアリングします。',
    borderColor: 'border-l-violet-400',
    isNew: true,
  },
  {
    title: 'AIエージェントの行動記録',
    description: 'AIエージェントの思考・行動・観察結果を構造化して完全に可視化します。',
    borderColor: 'border-l-status-pass',
    isNew: true,
  },
  {
    title: 'ハルシネーション検出',
    description: '信頼度スコアと根拠の数を照合。自信過剰な回答や事実と異なる出力を自動検出します。',
    borderColor: 'border-l-accent',
  },
  {
    title: 'コスト・予算管理',
    description: 'モデル別コストをリアルタイム計算。予算上限の設定により、コスト超過を自動で防止します。',
    borderColor: 'border-l-status-fail',
  },
  {
    title: 'セキュリティリスク分析',
    description: '4要素の加重平均で0-100のリスクスコアを算出。インジェクション攻撃も検出します。',
    borderColor: 'border-l-status-warn',
  },
  {
    title: '複数AIプロバイダー対応',
    description: 'OpenAI、Anthropic、Google Gemini に対応。接続先URLの変更だけで導入できます。',
    borderColor: 'border-l-blue-400',
  },
  {
    title: '柔軟な料金プラン',
    description: '無料プランから大規模企業向けまで5段階。月間の通信記録数に応じた従量課金です。',
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
            機能一覧
          </span>
          <h2 className="text-display-sm font-semibold text-text-primary mb-4">
            AI監視に必要な全機能を搭載
          </h2>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            AIの可視化・品質検証・セキュリティ保護をワンストップで提供
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
