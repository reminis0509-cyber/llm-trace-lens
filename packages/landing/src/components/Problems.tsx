const problems = [
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    title: 'ハルシネーション（LLMの嘘）',
    description: 'LLMは自信満々に誤った情報を生成します。顧客対応や意思決定支援で使用する場合、誤情報の提供は信頼性を大きく損ないます。',
    impact: '顧客信頼の喪失、法的リスク',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: '自信過剰な回答',
    description: '根拠が薄い回答でも「確実です」と答えるLLM。信頼度スコアなしでは、どの回答を信じるべきか判断できません。',
    impact: '誤判断の連鎖、品質低下',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    title: '機密情報の漏洩（PII）',
    description: 'クレジットカード番号、マイナンバー、APIキーなど、LLMの出力に含まれる機密情報を検出・ブロックする仕組みがありません。',
    impact: 'コンプライアンス違反、情報漏洩',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'コスト管理の困難',
    description: 'LLM APIの利用コストが予測困難。気づかないうちに予算を超過し、プロジェクトの継続が危ぶまれることも。',
    impact: '予算超過、ROI不明確',
  },
];

export default function Problems() {
  return (
    <section id="problems" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            LLMアプリケーションの<span className="gradient-text">深刻な課題</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            LLMをビジネスで活用する際、見過ごせないリスクが存在します
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {problems.map((problem, index) => (
            <div
              key={index}
              className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-2xl p-8 hover:shadow-lg transition-shadow"
            >
              <div className="w-14 h-14 bg-red-100 text-red-600 rounded-xl flex items-center justify-center mb-6">
                {problem.icon}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{problem.title}</h3>
              <p className="text-gray-600 mb-4">{problem.description}</p>
              <div className="inline-flex items-center px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm font-medium">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {problem.impact}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
