export default function Hero() {
  return (
    <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center">
          {/* Badge */}
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-primary-100 text-primary-700 text-sm font-medium mb-8">
            <span className="w-2 h-2 bg-primary-500 rounded-full mr-2 animate-pulse"></span>
            v0.4.1 リリース
          </div>

          {/* Main headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
            LLMの<span className="gradient-text">嘘・自信過剰・機密漏洩</span>を
            <br className="hidden sm:block" />
            検出・防止する
          </h1>

          {/* Subheadline */}
          <p className="text-xl sm:text-2xl text-gray-600 max-w-3xl mx-auto mb-10">
            プロキシ型の可観測性プラットフォームで、LLMアプリケーションの品質と安全性を担保。
            <br className="hidden sm:block" />
            <strong className="text-gray-900">既存コードの1行変更</strong>で即座に導入可能。
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <a
              href="#demo"
              className="gradient-bg text-white px-8 py-4 rounded-xl font-semibold text-lg hover:opacity-90 transition-opacity shadow-lg shadow-primary-500/30"
            >
              無料デモを試す
            </a>
            <a
              href="#docs"
              className="bg-white text-gray-700 px-8 py-4 rounded-xl font-semibold text-lg border border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all"
            >
              ドキュメントを見る
            </a>
          </div>

          {/* Code snippet preview */}
          <div className="max-w-2xl mx-auto">
            <div className="bg-gray-900 rounded-2xl p-6 text-left shadow-2xl">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-gray-400 text-sm ml-4">1行の変更で導入</span>
              </div>
              <pre className="text-sm sm:text-base overflow-x-auto">
                <code>
                  <span className="text-gray-500">// Before</span>
                  {'\n'}
                  <span className="text-red-400 line-through opacity-60">const client = new OpenAI({'{'} baseURL: "https://api.openai.com/v1" {'}'});</span>
                  {'\n\n'}
                  <span className="text-gray-500">// After</span>
                  {'\n'}
                  <span className="text-green-400">const client = new OpenAI({'{'} baseURL: "https://your-trace-lens.vercel.app/v1" {'}'});</span>
                </code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
