/**
 * Problems — 中小企業 3 大ペイン(2026-04-28 客の声 + 公的統計版)
 *
 * 戦略 doc Section 2.1 / 2.2 (2026-04-28 確定):
 *   - 「ウォンツの言葉で集客、ニーズの言葉で刺す」原則
 *   - 表面ウォンツ(業務効率化 64% / コスト削減 50.5% / DX 必要 71.9%)を統計として
 *     織り込みつつ、深層ニーズ(採用構造 / 安全 / 空白)で刺す
 *   - 各カードのタイトルは「客の声」(感情的な独白)、本文で統計引用
 *
 * 戦略 doc Section 7.3:
 *   セクション末尾にカピぶちょーフキダシで顧客代弁(感情ヒット)
 */
import MascotQuote from './home/MascotQuote';

interface Problem {
  title: string;
  description: string;
  keyword: string;
}

const problems: Problem[] = [
  {
    keyword: '人手',
    title: '採用に ¥10 万かけて、応募ゼロ。',
    description:
      '中小企業の 64% が「業務効率化したい」と答える裏に、採用が立ち行かない現実があります。月末月初は社長が事務作業で潰れ、戦略に時間を使えない。雇える人がいないから、自分で抱えるしかない。',
  },
  {
    keyword: '安全',
    title: '会社の数字を ChatGPT に貼って、本当に大丈夫?',
    description:
      'DX 必要認識は 71.9% に達しているのに、実施率はわずか 4.6%。ギャップを埋められない最大の理由は「機密情報を社外サーバーに送る不安」。日本の商慣習を理解しない汎用 AI に、業務を預けきれない。',
  },
  {
    keyword: '空白',
    title: 'freee + サイボウズ + ChatGPT を入れても、結局見積書は手作業。',
    description:
      '50.5% が「コスト削減したい」と答えるのは、ツールに投資しても書類業務が減らないから。会計データはあるのに、見積書 1 枚作るのに 30 分。「ツールの間」が空いたまま、社員が手で穴埋めしている。',
  },
];

export default function Problems() {
  return (
    <section id="problems" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="section-container">
        {/* Section header */}
        <div className="text-center mb-14">
          <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-5">
            こんなお悩み、ありませんか?
          </span>
          <h2 className="text-2xl sm:text-display-sm font-semibold text-text-primary mb-4">
            あなたのことかもしれません。
          </h2>
          <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            中小機構 2023 / 経産省の調査で、中小企業の 71.9% が DX を必要と答えました。
            <br className="hidden sm:block" />
            そのうち実施できているのは 4.6%。残りの 67% が抱える「現場の声」がこちらです。
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

        {/* カピぶちょー顧客代弁フキダシ — 感情ヒット (Section 7.3 改訂) */}
        <div className="mt-12 sm:mt-14 flex justify-center">
          <MascotQuote
            size="md"
            quote="うちもよう聞くわ、人手足らんって。なぁ、社長さんたちホンマえらいこっちゃで。"
          />
        </div>
      </div>
    </section>
  );
}
