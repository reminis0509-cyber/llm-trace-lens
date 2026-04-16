export default function MidPageCTA() {
  return (
    <section className="py-12 sm:py-16 px-4 sm:px-6">
      <div className="section-container">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 surface-card p-6 sm:p-8">
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-1">
              AI事故が起きる前に、ガバナンス体制を整えませんか？
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              無料（Free・5時間ごとにリセット）から、AI通信の可視化と保護を体験できます。
              <br className="hidden sm:block" />
              クレジットカード不要。
            </p>
          </div>
          <a
            href="/dashboard"
            className="w-full sm:w-auto px-6 py-3 bg-accent text-white rounded-card font-medium hover:bg-accent-hover transition-colors duration-120 text-center flex-shrink-0"
          >
            AI 事務員を使い始める
          </a>
        </div>
      </div>
    </section>
  );
}
