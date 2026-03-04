export default function CTA() {
  return (
    <section id="contact" className="py-24 px-6">
      <div className="section-container">
        <div className="surface-card p-8 lg:p-12 text-center">
          <h2 className="text-display-sm font-semibold text-text-primary mb-4">
            LLMの品質と安全性を今すぐ向上
          </h2>
          <p className="text-lg text-text-secondary mb-8 max-w-xl mx-auto">
            無料デモでFujiTraceの効果を体感してください。
            <br className="hidden sm:block" />
            AIエージェントのトレース機能も含め、導入のご相談を承ります。
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="#demo"
              className="px-6 py-3 bg-accent text-base rounded-card font-medium hover:bg-accent/90 transition-colors duration-120"
            >
              無料デモを申し込む
            </a>
            <a
              href="mailto:contact@fujitrace.com"
              className="px-6 py-3 text-text-secondary hover:text-text-primary border border-border rounded-card font-medium hover:bg-base-elevated transition-colors duration-120"
            >
              お問い合わせ
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
