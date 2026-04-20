/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

import { useSeo } from '../hooks/useSeo';

interface ToolCard {
  id: string;
  title: string;
  description: string;
  href: string | null;
  status: 'available' | 'coming-soon';
  badge?: string;
}

const TOOLS: ToolCard[] = [
  {
    id: 'clerk',
    title: 'AI社員',
    description:
      '自然言語で事務作業を依頼できるAIアシスタント。見積書作成・チェック、請求書、ビジネスメールなど、130以上の事務作業に対応します。',
    href: '/tools/clerk',
    status: 'available',
    badge: 'NEW',
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ToolsIndexPage() {
  useSeo({
    title: 'AI搭載ツール一覧 | FujiTrace - 業務AIツールプラットフォーム',
    description:
      'FujiTraceのAI搭載ツール一覧。見積書・請求書・納品書の作成やチェックなど、AIが下書き・AIが自己チェック・人間が最終責任の三段階で安心して使える業務AIツール群。',
    url: 'https://fujitrace.jp/tools',
  });

  const navigate = (href: string): void => {
    window.history.pushState({}, '', href);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="pt-32 pb-16 px-6 bg-gradient-to-b from-blue-50/40 to-white">
          <div className="max-w-5xl mx-auto text-center">
            <p className="text-sm font-medium text-blue-600 mb-3 tracking-wide">
              FUJITRACE AI TOOLS
            </p>
            <h1 className="text-3xl md:text-5xl font-bold text-slate-900 leading-tight mb-6">
              責任あるAI利用プラットフォーム
            </h1>
            <p className="text-lg md:text-xl text-slate-600 mb-8 leading-relaxed">
              業務でAIを使いたい。でも誤りが残ったまま顧客に出るのは怖い。
              <br className="hidden md:inline" />
              FujiTrace AI Toolsは「AIが下書き・AIが自己チェック・人間が最終責任」の
              <br className="hidden md:inline" />
              三段階で、安心して使える業務AIツール群を提供します。
            </p>
            <div className="inline-block bg-white border border-blue-200 rounded-full px-6 py-3 shadow-sm">
              <p className="text-sm md:text-base font-medium text-slate-800">
                初期費用 0円・月額 0円・AI利用量に応じた従量課金のみ
              </p>
            </div>
          </div>
        </section>

        {/* Tool cards */}
        <section className="py-16 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {TOOLS.map((tool) => {
                const isAvailable = tool.status === 'available' && tool.href !== null;
                return (
                  <article
                    key={tool.id}
                    className={`relative rounded-xl border p-6 transition-all duration-150 ${
                      isAvailable
                        ? 'border-slate-200 bg-white hover:border-blue-400 hover:shadow-lg cursor-pointer'
                        : 'border-slate-200 bg-slate-50/60 opacity-75'
                    }`}
                    onClick={() => {
                      if (isAvailable && tool.href) navigate(tool.href);
                    }}
                    onKeyDown={(e) => {
                      if (isAvailable && tool.href && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        navigate(tool.href);
                      }
                    }}
                    role={isAvailable ? 'button' : undefined}
                    tabIndex={isAvailable ? 0 : undefined}
                    aria-disabled={isAvailable ? undefined : true}
                  >
                    {tool.badge && (
                      <span className="absolute top-4 right-4 inline-block bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">
                        {tool.badge}
                      </span>
                    )}
                    {tool.status === 'coming-soon' && (
                      <span className="absolute top-4 right-4 inline-block bg-slate-300 text-slate-700 text-xs font-bold px-2 py-1 rounded">
                        Coming Soon
                      </span>
                    )}
                    <h2 className="text-xl font-bold text-slate-900 mb-3 pr-20">{tool.title}</h2>
                    <p className="text-sm text-slate-600 leading-relaxed mb-6">{tool.description}</p>
                    {isAvailable && tool.href && (
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-blue-600">
                        使ってみる
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </span>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Platform explanation */}
        <section className="py-16 px-6 bg-slate-50">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6 text-center">
              なぜFujiTrace AI Toolsか
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
              <div className="bg-white rounded-lg p-6 border border-slate-200">
                <h3 className="font-bold text-slate-900 mb-2">AIに二度書かせる</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  生成と検証を別プロンプトで実行。一度書いた結果を別のAIが厳密にレビューします。
                </p>
              </div>
              <div className="bg-white rounded-lg p-6 border border-slate-200">
                <h3 className="font-bold text-slate-900 mb-2">全行動をトレース</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  全AI呼び出しがFujiTrace基盤で記録されます。「いつ・誰が・何を生成したか」を後から検証できます。
                </p>
              </div>
              <div className="bg-white rounded-lg p-6 border border-slate-200">
                <h3 className="font-bold text-slate-900 mb-2">人間が最終責任</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  AIはあくまで下書き・チェック係。送付・提出の最終判断は必ず人間が行う設計です。
                </p>
              </div>
            </div>
          </div>
        </section>
    </div>
  );
}
