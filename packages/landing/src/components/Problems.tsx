/**
 * Problems — 中小企業 DX 決裁者の 3 大ペイン (2026-04-22 刷新)
 *
 * 東京商工会議所ペルソナ (社員 10-50 名・創業 5-30 年) に刺さる論点に絞り込み。
 * 4 項目 → 3 項目に削減、具体的なツール名 (freee/サイボウズ/楽楽精算) で距離を縮める。
 */
interface Problem {
  title: string;
  description: string;
  keyword: string;
}

const problems: Problem[] = [
  {
    keyword: '人手',
    title: '人を一人、雇う余裕がない。',
    description:
      '見積書・請求書・議事録・稟議書。毎月積み上がる事務作業を、誰かが黙々とこなしている現実。新たに社員を雇う予算は確保できず、経営者自身が夜遅くまで手を動かしています。',
  },
  {
    keyword: '安全',
    title: 'ChatGPT は、正直こわい。',
    description:
      '効率化したい気持ちはある。ただ、顧客情報や社内資料を海外サーバーに送ることへの不安がぬぐえません。日本の書類様式や稟議フローを理解しない汎用 AI に、業務を任せきれない。',
  },
  {
    keyword: '空白',
    title: '業務システムに投資しても、書類は減らない。',
    description:
      'freee ・サイボウズ ・楽楽精算を導入しても、見積書作成・議事録まとめ・稟議書ドラフトは依然として手作業。既存ツールの「間」が空いたまま、バックオフィスは疲弊しています。',
  },
];

export default function Problems() {
  return (
    <section id="problems" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="section-container">
        {/* Section header */}
        <div className="text-center mb-14">
          <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-5">
            課題
          </span>
          <h2 className="text-2xl sm:text-display-sm font-semibold text-text-primary mb-4">
            バックオフィスの悩みは、
            <br className="sm:hidden" />
            一社だけの話ではありません。
          </h2>
          <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            都内の中堅中小企業が、ほぼ例外なく抱えている三つの論点です。
          </p>
        </div>

        {/* Problems — 3 column cards (老舗SaaS風、縦スクロールで落ち着いた印象) */}
        <div className="grid md:grid-cols-3 gap-4 lg:gap-5">
          {problems.map((problem, index) => (
            <article
              key={problem.keyword}
              className="surface-card p-6 sm:p-7 flex flex-col"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-accent-dim text-accent font-mono text-xs tabular-nums">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="text-[11px] text-text-muted label-spacing uppercase">
                  {problem.keyword}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-text-primary mb-3 leading-snug">
                {problem.title}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {problem.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
