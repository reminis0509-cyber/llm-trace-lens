const solutions = [
  {
    step: '01',
    title: '構造化レスポンス強制',
    description: 'すべてのLLM出力を標準化されたJSON形式に変換。回答、信頼度、根拠、代替案を機械的に検証可能に。',
  },
  {
    step: '02',
    title: '多層検証エンジン',
    description: '信頼度検証、PII検出、リスクスコアリングの3段階で出力を評価。PASS/WARN/BLOCKで即座に判定。',
  },
  {
    step: '03',
    title: 'リアルタイム通知',
    description: '問題検出時はSlack・Teams・Webhookで即座にアラート。運用チームが迅速に対応可能。',
  },
];

export default function Solution() {
  return (
    <section id="solution" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            <span className="gradient-text">LLM Trace Lens</span>が解決します
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            プロキシ型アーキテクチャで、既存システムを変更せずに可観測性・検証機能を追加
          </p>
        </div>

        {/* Solution flow */}
        <div className="relative">
          {/* Connection line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-primary-200 via-primary-500 to-accent-500 transform -translate-y-1/2 z-0"></div>

          <div className="grid lg:grid-cols-3 gap-8 relative z-10">
            {solutions.map((solution, index) => (
              <div key={index} className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
                <div className="w-12 h-12 gradient-bg text-white rounded-full flex items-center justify-center font-bold text-lg mb-6">
                  {solution.step}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{solution.title}</h3>
                <p className="text-gray-600">{solution.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Response format example */}
        <div className="mt-16 bg-gray-900 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-white font-semibold text-lg">構造化レスポンスの例</h3>
            <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">PASS</span>
          </div>
          <pre className="text-sm overflow-x-auto">
            <code className="text-gray-300">
{`{
  "answer": "東京の現在の気温は18度です。",
  "confidence": 92,
  "evidence": [
    "気象庁の最新データ（2024年3月15日 14:00）",
    "東京都千代田区の観測地点"
  ],
  "alternatives": [
    "他の地域の気温も確認できます"
  ],
  "trace": {
    "requestId": "req_abc123",
    "provider": "openai",
    "model": "gpt-4o",
    "latencyMs": 1250,
    "estimatedCost": 0.0032,
    "validationResults": {
      "confidence": "PASS",
      "pii": "PASS",
      "riskScore": 12
    }
  }
}`}
            </code>
          </pre>
        </div>
      </div>
    </section>
  );
}
