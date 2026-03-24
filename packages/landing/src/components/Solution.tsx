const solutions = [
  {
    step: '01',
    title: 'AIの全通信を可視化',
    description: 'LLMへの入出力を自動で記録。回答内容、信頼度、根拠の有無を一覧で確認でき、ハルシネーションを即座に発見できます。',
  },
  {
    step: '02',
    title: '個人情報・機密データの自動検知',
    description: 'マイナンバー、住所、電話番号など15種類以上の日本語の機密情報を自動検出・遮断。設定不要で導入した瞬間から保護を開始します。',
  },
  {
    step: '03',
    title: 'コストとAIエージェントの完全管理',
    description: 'モデル別のコストをリアルタイムで可視化。さらにAIエージェントの思考・行動・結果の全ステップを記録し、判断過程を追跡可能にします。',
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
          <h2 className="text-display-sm font-semibold text-text-primary mb-4">
            FujiTrace が解決します
          </h2>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            既存のAIアプリケーションのコードを1行変更するだけで、
            AI通信の可視化・検証・保護機能を追加できます
          </p>
        </div>

        {/* Solution steps */}
        <div className="grid lg:grid-cols-3 gap-4 mb-16">
          {solutions.map((solution, index) => (
            <div key={index} className="surface-card p-6 hover:bg-base-elevated transition-colors duration-120">
              <div className="w-10 h-10 rounded-card bg-accent-dim text-accent flex items-center justify-center font-mono text-sm mb-4">
                {solution.step}
              </div>
              <h3 className="text-base font-medium text-text-primary mb-2">{solution.title}</h3>
              <p className="text-sm text-text-secondary">{solution.description}</p>
            </div>
          ))}
        </div>

        {/* Agent trace example */}
        <div className="surface-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs text-text-muted label-spacing uppercase">AIエージェント行動記録</span>
              <span className="text-xs text-text-muted">思考・行動・観察の全ステップ</span>
            </div>
            <span className="text-xs text-status-pass font-mono">COMPLETED</span>
          </div>

          <div className="p-6 space-y-3">
            {/* Thought */}
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded bg-status-block/20 text-status-block flex items-center justify-center text-xs font-mono flex-shrink-0 mt-0.5">
                T
              </div>
              <div className="flex-1 p-3 rounded-card bg-base border-l-2 border-l-status-block">
                <div className="text-xs text-text-muted mb-1 label-spacing uppercase">思考</div>
                <p className="text-sm text-text-secondary">"最新のAIニュースを検索する必要がある"</p>
              </div>
            </div>

            {/* Action */}
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded bg-status-warn/20 text-status-warn flex items-center justify-center text-xs font-mono flex-shrink-0 mt-0.5">
                A
              </div>
              <div className="flex-1 p-3 rounded-card bg-base border-l-2 border-l-status-warn">
                <div className="text-xs text-text-muted mb-1 label-spacing uppercase">行動</div>
                <p className="text-sm text-text-secondary font-mono">
                  web_search({"{"}"query": "latest AI news 2024"{"}"})
                  <span className="text-text-muted ml-2">-- 1,250ms</span>
                </p>
              </div>
            </div>

            {/* Observation */}
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded bg-status-pass/20 text-status-pass flex items-center justify-center text-xs font-mono flex-shrink-0 mt-0.5">
                O
              </div>
              <div className="flex-1 p-3 rounded-card bg-base border-l-2 border-l-status-pass">
                <div className="text-xs text-text-muted mb-1 label-spacing uppercase">観察結果</div>
                <p className="text-sm text-text-secondary">"5件の関連記事を発見。トップ記事: GPT-5の噂..."</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-border flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-text-muted">総ステップ数:</span>
              <span className="text-text-primary font-mono tabular-nums ml-2">3</span>
            </div>
            <div>
              <span className="text-text-muted">外部ツール呼び出し:</span>
              <span className="text-text-primary font-mono tabular-nums ml-2">5</span>
            </div>
            <div>
              <span className="text-text-muted">処理時間:</span>
              <span className="text-text-primary font-mono tabular-nums ml-2">4.2s</span>
            </div>
            <div>
              <span className="text-text-muted">信頼度:</span>
              <span className="text-status-pass font-mono tabular-nums ml-2">92%</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
