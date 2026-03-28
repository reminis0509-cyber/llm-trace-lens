export default function Architecture() {
  return (
    <section id="architecture" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="section-container">
        {/* Section header */}
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-6">
            仕組み
          </span>
          <h2 className="text-display-sm font-semibold text-text-primary mb-4">
            シンプルな仕組みで、確実にAIを保護
          </h2>
          <p className="text-lg text-text-secondary max-w-xl mx-auto">
            既存のAIアプリケーションに影響を与えず、全通信を安全に監視・保護します
          </p>
        </div>

        {/* Architecture diagram */}
        <div className="surface-card p-4 sm:p-6 lg:p-8">
          <div className="grid lg:grid-cols-5 gap-4 lg:gap-6 items-center">
            {/* Your App */}
            <div className="text-center">
              <div className="surface-card p-4 sm:p-6 mb-4">
                <svg className="w-8 h-8 sm:w-10 sm:h-10 mx-auto text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <span className="text-sm font-medium text-text-primary">Your App</span>
              <p className="text-xs text-text-muted mt-1">既存のAIアプリ</p>
              <p className="text-xs text-accent mt-2">+ AIエージェント</p>
            </div>

            {/* Arrow — horizontal on desktop, vertical on mobile */}
            <div className="flex items-center justify-center py-2 lg:py-0">
              {/* Vertical arrow (mobile) */}
              <div className="lg:hidden h-8 w-px bg-border relative">
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 border-b border-r border-text-muted rotate-45" />
              </div>
              {/* Horizontal arrow (desktop) */}
              <div className="hidden lg:block w-full h-px bg-border relative">
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 border-r border-t border-text-muted rotate-45" />
              </div>
            </div>

            {/* FujiTrace */}
            <div className="text-center">
              <div className="bg-accent-dim border border-accent/30 rounded-card p-4 sm:p-6 mb-4">
                <svg className="w-8 h-8 sm:w-10 sm:h-10 mx-auto" viewBox="0 0 32 32" fill="none">
                  <path d="M6 26 L14.5 6 L19.7 18.2" stroke="#1a1a1a" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  <path d="M16.5 26 L22 12.5 L27.5 26" stroke="#1a1a1a" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
              </div>
              <span className="text-sm font-medium text-text-primary">FujiTrace</span>
              <p className="text-xs text-text-muted mt-1">検証 + AI監視</p>
              <p className="text-xs text-accent mt-2">+ AIエージェント行動記録</p>
            </div>

            {/* Arrow — horizontal on desktop, vertical on mobile */}
            <div className="flex items-center justify-center py-2 lg:py-0">
              {/* Vertical arrow (mobile) */}
              <div className="lg:hidden h-8 w-px bg-border relative">
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 border-b border-r border-text-muted rotate-45" />
              </div>
              {/* Horizontal arrow (desktop) */}
              <div className="hidden lg:block w-full h-px bg-border relative">
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 border-r border-t border-text-muted rotate-45" />
              </div>
            </div>

            {/* LLM Providers */}
            <div className="text-center">
              <div className="surface-card p-4 sm:p-6 mb-4">
                <svg className="w-8 h-8 sm:w-10 sm:h-10 mx-auto text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <span className="text-sm font-medium text-text-primary">AI Providers</span>
              <p className="text-xs text-text-muted mt-1">OpenAI, Anthropic...</p>
            </div>
          </div>

          {/* Features below diagram */}
          <div className="grid sm:grid-cols-3 gap-6 mt-12 pt-8 border-t border-border">
            {[
              { title: '1行の変更で導入', desc: 'baseURLを変更するだけ' },
              { title: 'ベンダーロックインなし', desc: '複数プロバイダを統一管理' },
              { title: 'Docker Composeで即起動', desc: 'ワンコマンドで本番環境構築' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 bg-accent-dim text-accent rounded flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-text-primary">{item.title}</h4>
                  <p className="text-xs text-text-muted">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
