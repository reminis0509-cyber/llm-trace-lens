const problems = [
  {
    title: 'AIを導入したいが、社員が使いこなせない',
    description:
      'ツールを契約しても、社員がプロンプトを書けず放置される。研修を開いても定着しない。導入コストだけが積み上がります。',
  },
  {
    title: 'AIの出力ミスが、実害につながる',
    description:
      '見積書の金額ミス、請求書の記載漏れ。AIが自信満々に生成した誤情報がそのまま顧客に届けば、信頼の毀損と損害賠償リスクに直結します。',
  },
  {
    title: 'どのAIツールを選べばいいかわからない',
    description:
      'ChatGPT、Gemini、Claude...選択肢が多すぎて判断できない。試しに使っても、業務にどう活かせるか見えてこない。',
  },
  {
    title: 'AI投資の効果を説明できない',
    description:
      '「AIで何が変わったか」を数字で示せない。経営会議でAI投資の妥当性を問われたとき、根拠ある回答ができますか？',
  },
];

export default function Problems() {
  return (
    <section id="problems" className="py-16 sm:py-24 px-4 sm:px-6">
      <div className="section-container">
        {/* Section header */}
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1.5 text-xs text-text-muted label-spacing uppercase surface-card mb-6">
            課題
          </span>
          <h2 className="text-2xl sm:text-display-sm font-semibold text-text-primary mb-4">
            AI導入、
            <br className="sm:hidden" />
            こんな壁にぶつかっていませんか？
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            ツールを入れただけでは、AIは使いこなせません。
            <br className="hidden md:block" />
            社員が安全に、確実に使えるようになるまでの仕組みが必要です。
          </p>
        </div>

        {/* Problems grid */}
        <div className="grid md:grid-cols-2 gap-4">
          {problems.map((problem, index) => (
            <div
              key={index}
              className="feature-card hover:bg-app-bg-elevated transition-colors duration-120"
            >
              <h3 className="text-lg font-medium text-text-primary mb-2">{problem.title}</h3>
              <p className="text-sm text-text-secondary">{problem.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
