const solutions = [
  {
    step: '01',
    title: '説明責任を果たせるAI運用体制を構築',
    description: 'AIへの全入出力を自動記録。回答の信頼度と根拠を一覧で確認でき、取引先・監査法人・規制当局に対して根拠ある説明が可能になります。',
  },
  {
    step: '02',
    title: '情報漏洩リスクから会社を守る',
    description: '日本語の機密情報15種類以上を自動で検出・遮断。設定不要で、導入した瞬間から企業データを保護し、経営者のリスクを軽減します。',
  },
  {
    step: '03',
    title: 'AI投資のROIを経営会議で証明できる',
    description: 'モデル別・部署別のコストをリアルタイムで把握。AIエージェントの全行動を記録し、投資対効果を定量的に示せます。',
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
            FujiTrace で、
            <br className="sm:hidden" />
            AIガバナンスを確立する
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            導入は最短即日。
            <br className="hidden md:block" />
            AIの全通信を自動で可視化・検証・保護し、
            <br className="hidden md:block" />
            経営に必要な透明性と安心を提供します。
          </p>
        </div>

        {/* Solution steps */}
        <div className="grid lg:grid-cols-3 gap-4 mb-16">
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
              <div className="w-6 h-6 rounded bg-accent-dim text-accent flex items-center justify-center text-xs font-mono flex-shrink-0 mt-0.5">
                T
              </div>
              <div className="flex-1 p-3 rounded-card bg-app-bg-elevated border-l-2 border-l-border">
                <div className="text-xs text-text-muted mb-1 label-spacing uppercase">思考</div>
                <p className="text-sm text-text-secondary">"最新のAIニュースを検索する必要がある"</p>
              </div>
            </div>

            {/* Action */}
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded bg-accent-dim text-accent flex items-center justify-center text-xs font-mono flex-shrink-0 mt-0.5">
                A
              </div>
              <div className="flex-1 p-3 rounded-card bg-app-bg-elevated border-l-2 border-l-border">
                <div className="text-xs text-text-muted mb-1 label-spacing uppercase">行動</div>
                <p className="text-sm text-text-secondary font-mono">
                  web_search({"{"}"query": "latest AI news 2024"{"}"})
                  <span className="text-text-muted ml-2">-- 1,250ms</span>
                </p>
              </div>
            </div>

            {/* Observation */}
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded bg-accent-dim text-accent flex items-center justify-center text-xs font-mono flex-shrink-0 mt-0.5">
                O
              </div>
              <div className="flex-1 p-3 rounded-card bg-app-bg-elevated border-l-2 border-l-border">
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
