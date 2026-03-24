export default function Hero() {
  return (
    <section className="min-h-screen flex items-center justify-center pt-20 pb-20 px-4 sm:px-6">
      <div className="section-container w-full">
        <div className="text-center">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 surface-card text-sm mb-8">
            <span className="w-1.5 h-1.5 bg-accent rounded-full" />
            <span className="text-text-muted">国産AIガバナンスプラットフォーム</span>
          </div>

          {/* Main headline */}
          <h1 className="text-display-sm md:text-display font-semibold text-text-primary mb-6">
            生成AIを、
            <br className="hidden sm:block" />
            安心して事業の武器に。
          </h1>

          {/* Subheadline */}
          <p className="text-lg text-text-secondary max-w-2xl mx-auto mb-8">
            情報漏洩・ハルシネーション・コスト超過 --
            <br className="hidden sm:block" />
            AIのリスクを可視化・制御し、経営判断に必要な透明性を提供します。
          </p>

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-4 mb-10">
            {[
              '30日間無料トライアル',
              'クレジットカード不要',
              '最短当日で導入完了',
            ].map((badge) => (
              <div key={badge} className="flex items-center gap-1.5 text-sm text-text-secondary">
                <svg className="w-4 h-4 text-status-pass flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>{badge}</span>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
            <a
              href="/dashboard"
              className="w-full sm:w-auto px-8 py-4 bg-accent rounded-card text-base font-semibold hover:bg-accent/90 transition-colors duration-120 text-center"
              style={{ color: '#0d0d0f' }}
            >
              30日間無料で試す
            </a>
            <a
              href="#contact"
              className="w-full sm:w-auto px-6 py-4 text-text-secondary hover:text-text-primary border border-border rounded-card font-medium hover:bg-base-elevated transition-colors duration-120 text-center"
            >
              導入のご相談
            </a>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-12 mb-12">
            {[
              { value: '15+', label: '日本語機密情報の自動保護' },
              { value: '即日', label: '導入完了までの最短期間' },
              { value: '24/7', label: 'AI通信の自動監視' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-mono tabular-nums text-text-primary mb-1">{stat.value}</div>
                <div className="text-xs text-text-muted label-spacing">{stat.label}</div>
              </div>
            ))}
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
