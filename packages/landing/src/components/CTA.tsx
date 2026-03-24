export default function CTA() {
  return (
    <section id="contact" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="section-container">
        <div className="surface-card p-6 sm:p-8 lg:p-12 text-center">
          <h2 className="text-display-sm font-semibold text-text-primary mb-4">
            AIガバナンスの第一歩を、今日から
          </h2>
          <p className="text-lg text-text-secondary mb-4 max-w-xl mx-auto">
            クレジットカード不要で全機能をご利用いただけます。
            <br className="hidden sm:block" />
            生成AIを安心して事業の武器にする環境を、30日間無料で体験してください。
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-8 text-sm text-text-muted">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-status-pass" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              30日間全機能無料
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-status-pass" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              クレジットカード不要
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-status-pass" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              最短即日で導入完了
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/dashboard"
              className="w-full sm:w-auto px-8 py-4 bg-accent rounded-card text-base font-semibold hover:bg-accent/90 transition-colors duration-120 text-center"
              style={{ color: '#0d0d0f' }}
            >
              30日間無料で試す
            </a>
            <a
              href="mailto:contact@fujitrace.com"
              className="w-full sm:w-auto px-6 py-4 text-text-secondary hover:text-text-primary border border-border rounded-card font-medium hover:bg-base-elevated transition-colors duration-120 text-center"
            >
              導入のご相談
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
