/**
 * LongTermFuture — おしごと AI を雇った先の、余裕のある未来 (2026-04-28 新設)
 *
 * 戦略 doc Section 9.5 のストーリー構造を満たすセクション。
 * 「人を雇う余裕がない」(Problems) → 「おしごと AI が担える仕事」(Solution) →
 * 「では、その先に何が残るか」(本セクション) という流れで余白の価値を提示する。
 *
 * カピぶちょー (温泉ポーズ) を中央に置くことで、「事務作業から解放された経営者の余裕」
 * をビジュアルで表現する。立ち絵は size="lg" (256px) で配置 (CEO 判断 2026-04-28)。
 *
 * 派手なアニメ禁止、絵文字禁止、老舗 SaaS 基調を守る。
 */
import Mascot from './Mascot';

interface FutureItem {
  tag: string;
  title: string;
  description: string;
}

const items: FutureItem[] = [
  {
    tag: '考える時間',
    title: '次の四半期に、頭を使う余裕が戻ります。',
    description:
      '見積書の桁チェックや議事録のまとめに溶けていた時間が、戦略会議や顧客訪問に使えるようになります。経営者が経営の仕事をする — そのための余白がうまれます。',
  },
  {
    tag: '組織の体力',
    title: '一人辞めても、業務は止まりません。',
    description:
      '事務作業の手順がおしごと AI 側に蓄積されるため、属人化したノウハウが組織の資産として残ります。退職・産育休・繁忙期の偏りに対する耐性が上がります。',
  },
  {
    tag: '採用と育成',
    title: '採用基準を、一段引き上げられます。',
    description:
      '定型業務は AI が担うため、人にお願いする仕事は「判断」「対人」「企画」が中心に。求める人物像が明確になり、研修もチュートリアルと修了証が下地を作ります。',
  },
];

export default function LongTermFuture() {
  return (
    <section
      id="long-term-future"
      className="py-16 sm:py-24 px-4 sm:px-6 bg-app-bg-surface"
      aria-labelledby="long-term-future-heading"
    >
      <div className="section-container">
        {/* Section header */}
        <div className="text-center mb-14">
          <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-5">
            雇った、その先
          </span>
          <h2
            id="long-term-future-heading"
            className="text-2xl sm:text-display-sm font-semibold text-text-primary mb-4"
          >
            おしごと AI を雇った、
            <br className="sm:hidden" />
            その先の景色。
          </h2>
          <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            机上の事務作業から手が空いたとき、
            <br className="hidden md:block" />
            経営にどんな余裕が戻ってくるかを整理しました。
          </p>
        </div>

        {/* カピぶちょー (温泉) — 余裕のある未来をビジュアルで表現 */}
        <div className="flex justify-center mb-10">
          <Mascot pose="onsen" size="lg" animation="idle" />
        </div>

        {/* 3 future items — 老舗 SaaS 風の控えめなカード */}
        <div className="grid md:grid-cols-3 gap-4 lg:gap-5 max-w-5xl mx-auto">
          {items.map((item, idx) => (
            <article
              key={item.tag}
              className="bg-white border border-border rounded-card p-6 sm:p-7 flex flex-col"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-accent-dim text-accent font-mono text-xs tabular-nums">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <span className="text-[11px] text-text-muted label-spacing uppercase">
                  {item.tag}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-text-primary mb-3 leading-snug">
                {item.title}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {item.description}
              </p>
            </article>
          ))}
        </div>

        {/* 締めの文 — 過剰な約束をしない、控えめな表現 */}
        <div className="mt-10 max-w-2xl mx-auto text-center">
          <p className="text-sm text-text-muted leading-relaxed">
            導入直後にすべてが変わるわけではありません。
            <br className="hidden sm:block" />
            一枚の見積書を任せるところから、半年・一年かけて、組織の景色がゆっくり変わっていきます。
          </p>
        </div>
      </div>
    </section>
  );
}
