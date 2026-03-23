export default function Hero() {
  return (
    <section className="min-h-screen flex items-center justify-center pt-20 pb-20 px-4 sm:px-6">
      <div className="section-container w-full">
        <div className="text-center">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 surface-card text-sm mb-8">
            <span className="w-1.5 h-1.5 bg-accent rounded-full" />
            <span className="text-text-muted">AIエージェント意思決定トレース対応</span>
          </div>

          {/* Main headline */}
          <h1 className="text-display-sm md:text-display font-semibold text-text-primary mb-6">
            AIの真実を可視化
          </h1>

          {/* Subheadline */}
          <p className="text-lg text-text-secondary max-w-2xl mx-auto mb-12">
            マイナンバー、住所、電話番号 — 日本語の個人情報を自動検出・遮断。
            <br className="hidden sm:block" />
            セキュリティ専任者がいなくても、AI利用の安全性を確保。
          </p>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-12 mb-12">
            {[
              { value: '15+', label: '日本語PIIパターン' },
              { value: '1行', label: 'コード変更で導入' },
              { value: '0件', label: '競合の日本語PII対応' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-mono tabular-nums text-text-primary mb-1">{stat.value}</div>
                <div className="text-xs text-text-muted label-spacing uppercase">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
            <a
              href="/dashboard"
              className="w-full sm:w-auto px-6 py-3 bg-accent rounded-card font-medium hover:bg-accent/90 transition-colors duration-120 text-center"
              style={{ color: '#0d0d0f' }}
            >
              無料で試す
            </a>
            <a
              href="#demo-video"
              className="w-full sm:w-auto px-6 py-3 text-text-secondary hover:text-text-primary border border-border rounded-card font-medium hover:bg-base-elevated transition-colors duration-120 text-center"
            >
              デモを見る
            </a>
          </div>

          {/* Code preview */}
          <div className="max-w-2xl mx-auto">
            <div className="surface-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-status-fail/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-status-warn/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-status-pass/60" />
                </div>
                <span className="text-xs text-text-muted font-mono">1行の変更で導入</span>
              </div>
              <pre className="p-4 text-sm overflow-x-auto text-left font-mono">
                <code>
                  <span className="text-text-muted">// Before</span>
                  {'\n'}
                  <span className="text-text-muted line-through">const client = new OpenAI({'{'} baseURL: "https://api.openai.com/v1" {'}'});</span>
                  {'\n\n'}
                  <span className="text-text-muted">// After</span>
                  {'\n'}
                  <span className="text-text-secondary">const client = new OpenAI({'{'} baseURL: "</span>
                  <span className="text-accent">https://your-fujitrace.example.com/v1</span>
                  <span className="text-text-secondary">" {'}'});</span>
                </code>
              </pre>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="mt-16">
            <svg className="w-5 h-5 mx-auto text-text-muted animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
