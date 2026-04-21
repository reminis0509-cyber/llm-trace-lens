/**
 * MidPageCTA — LP 中間の誘導バナー (2026-04-22 刷新)
 *
 * 中小企業 DX 決裁者向けに「業務の山を、無料で試せる」訴求に切替。
 */
export default function MidPageCTA() {
  return (
    <section className="py-12 sm:py-14 px-4 sm:px-6">
      <div className="section-container">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 surface-card p-6 sm:p-8 border-l-4 border-l-accent">
          <div className="flex-1">
            <h3 className="text-base sm:text-lg font-semibold text-text-primary mb-1.5 leading-snug">
              まずは見積書一枚、AI に任せてみませんか。
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              登録不要・クレジットカード不要。ログインなしで一枚の見積書を作成していただけます。
              <br className="hidden sm:block" />
              社内展開の是非は、その手触りで判断してください。
            </p>
          </div>
          <a
            href="/tutorial"
            className="w-full sm:w-auto px-6 py-3 bg-accent text-white rounded-card font-medium hover:bg-accent-hover transition-colors duration-120 text-center flex-shrink-0"
          >
            無料で試す
          </a>
        </div>
      </div>
    </section>
  );
}
