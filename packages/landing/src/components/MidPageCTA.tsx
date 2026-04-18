export default function MidPageCTA() {
  return (
    <section className="py-12 sm:py-16 px-4 sm:px-6">
      <div className="section-container">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 surface-card p-6 sm:p-8">
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-1">
              社員のAIスキル、FujiTraceで育てませんか？
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              チュートリアル4章 + クエスト15問で、AIを実務で使えるレベルに。
              <br className="hidden sm:block" />
              登録不要・クレジットカード不要で今すぐ体験できます。
            </p>
          </div>
          <a
            href="/tutorial"
            className="w-full sm:w-auto px-6 py-3 bg-accent text-white rounded-card font-medium hover:bg-accent-hover transition-colors duration-120 text-center flex-shrink-0"
          >
            チュートリアルを始める
          </a>
        </div>
      </div>
    </section>
  );
}
