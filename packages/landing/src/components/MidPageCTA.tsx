export default function MidPageCTA() {
  return (
    <section className="py-12 sm:py-16 px-4 sm:px-6">
      <div className="section-container">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 surface-card p-6 sm:p-8">
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-1">
              AIガバナンスの構築を、今日から始めませんか？
            </h3>
            <p className="text-sm text-text-secondary">
              30日間の無料トライアルで、AI通信の完全な可視化と保護を体験できます。クレジットカード不要。
            </p>
          </div>
          <a
            href="/dashboard"
            className="w-full sm:w-auto px-6 py-3 bg-accent rounded-card font-medium hover:bg-accent/90 transition-colors duration-120 text-center flex-shrink-0"
            style={{ color: '#0d0d0f' }}
          >
            まずは無料トライアル
          </a>
        </div>
      </div>
    </section>
  );
}
