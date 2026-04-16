interface EvaluationAxis {
  titleJa: string;
  titleEn: string;
  method: string;
  metrics: string;
  label: string;
}

const evaluationAxes: EvaluationAxis[] = [
  {
    titleJa: '応答品質',
    titleEn: 'Response Quality',
    method: 'LLM-as-Judge（独立したLLMによる自動採点）',
    metrics: '正確性、関連性、一貫性',
    label: '01',
  },
  {
    titleJa: 'ハルシネーション率',
    titleEn: 'Hallucination Rate',
    method: '出力とソースデータの自動突合',
    metrics: '事実と異なる出力の割合(%)',
    label: '02',
  },
  {
    titleJa: 'レイテンシ',
    titleEn: 'Latency',
    method: 'トレースのタイムスタンプ分析',
    metrics: '応答速度 (p50, p95, p99)',
    label: '03',
  },
  {
    titleJa: 'コスト効率',
    titleEn: 'Cost Efficiency',
    method: 'トークン使用量 x モデル単価',
    metrics: '1リクエストあたりのコスト',
    label: '04',
  },
  {
    titleJa: '安全性',
    titleEn: 'Safety',
    method: '機密情報検知エンジン + 有害出力フィルタ',
    metrics: '個人情報漏洩の検出率、有害コンテンツの遮断率',
    label: '05',
  },
];

export default function EvaluationStandards() {
  return (
    <section id="evaluation-standards" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="section-container">
        {/* Section header */}
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-6">
            品質評価基準
          </span>
          <h2 className="text-display-sm font-semibold text-text-primary mb-4">
            AI品質を定量化し、経営判断の根拠に
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            FujiTraceはAI品質を5つの軸で定量評価。
            <br className="hidden sm:block" />
            評価基準を公開し、透明性のあるAIガバナンスを実現します。
          </p>
        </div>

        {/* Evaluation axes grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {evaluationAxes.map((axis) => (
            <div
              key={axis.label}
              className="feature-card hover:bg-app-bg-elevated transition-colors duration-120"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-card bg-accent-dim text-accent flex items-center justify-center font-mono text-xs flex-shrink-0">
                  {axis.label}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-text-primary">
                    {axis.titleJa}
                  </h3>
                  <span className="text-xs text-text-muted font-mono">
                    {axis.titleEn}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-xs text-text-muted label-spacing uppercase mb-1">
                    測定方法
                  </div>
                  <p className="text-sm text-text-secondary">{axis.method}</p>
                </div>
                <div>
                  <div className="text-xs text-text-muted label-spacing uppercase mb-1">
                    Metrics
                  </div>
                  <p className="text-sm text-text-secondary">{axis.metrics}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Transparency note */}
        <div className="mt-8 surface-card p-6 text-center">
          <p className="text-sm text-text-secondary">
            全評価ロジックはオープンソースとして公開予定です。評価の透明性と再現性を保証し、ベンダーロックインのない品質管理を実現します。
          </p>
        </div>
      </div>
    </section>
  );
}
