/**
 * /tools — 無料ツール一覧 (Freemium 第 1 層 Phase B)
 *
 * 戦略 doc Section 5.6 / 18.2.N (Founder 承認 2026-04-29)
 *
 * 役割:
 *   - 5 種の無料書類ツールへのハブ
 *   - SEO 補強 (「業務書類 無料 テンプレート」系の親ページ)
 *   - ページ末尾「もっと楽したい?」のみ Pro へのソフト誘導を許可
 *     （他の /tools/* ページは第 1 段=Free 訴求のみ。ここは複数書類を
 *      自分で扱う層が見るので Pro 候補に近く、例外として許可）
 *
 * 禁止事項:
 *   - LLM 呼び出し禁止
 *   - ハブで Pro の価格メリットを「強く」打ち出す訴求は禁止 — あくまで「興味があれば」レベル
 */
import { useSeo } from '../hooks/useSeo';

interface ToolCard {
  id: string;
  title: string;
  description: string;
  href: string;
  /** Tailwind classes for the icon background swatch. */
  iconBg: string;
  /** Single-letter / 1-char doc icon glyph in Japanese. */
  glyph: string;
}

const TOOLS: ToolCard[] = [
  {
    id: 'seikyusho',
    title: '請求書',
    description:
      'インボイス制度対応・税区分(10%/8%/0%)・自動計算。発行日と支払期限を自動補完。',
    href: '/tools/seikyusho',
    iconBg: 'bg-blue-50 text-blue-600',
    glyph: '請',
  },
  {
    id: 'mitsumori',
    title: '見積書',
    description:
      '見積番号・有効期限・件名・支払条件・納期。値引きや非課税にも対応。',
    href: '/tools/mitsumori',
    iconBg: 'bg-emerald-50 text-emerald-600',
    glyph: '見',
  },
  {
    id: 'nouhin',
    title: '納品書',
    description:
      '納品番号・納品日・品目数量と単価をまとめて 1 枚の PDF に。受領印スペースつき。',
    href: '/tools/nouhin',
    iconBg: 'bg-amber-50 text-amber-700',
    glyph: '納',
  },
  {
    id: 'hatchu',
    title: '発注書',
    description:
      '発注番号・納品希望日・納品場所つき。発注者と受注者を逆にしないよう自動でラベル分け。',
    href: '/tools/hatchu',
    iconBg: 'bg-purple-50 text-purple-600',
    glyph: '発',
  },
  {
    id: 'soufu',
    title: '送付状',
    description:
      '請求書・見積書などビジネス書類に同封する送付状。同封書類リスト・本文編集可能。',
    href: '/tools/soufu',
    iconBg: 'bg-rose-50 text-rose-600',
    glyph: '送',
  },
];

export default function ToolsIndexPage() {
  useSeo({
    title: '業務書類 無料テンプレート｜おしごと AI（カピぶちょー）',
    description:
      '請求書・見積書・納品書・発注書・送付状を会員登録なしで作成・PDF ダウンロード。インボイス制度対応、税区分対応、追跡なし。',
    url: 'https://oshigoto.ai/tools',
    ogTitle: '業務書類 無料テンプレート｜おしごと AI',
    jsonLd: [
      {
        id: 'jsonld-tools-index-webpage',
        data: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: '業務書類 無料テンプレート',
          url: 'https://oshigoto.ai/tools',
          description:
            '請求書・見積書・納品書・発注書・送付状を会員登録なしで作成・PDF ダウンロード。',
          inLanguage: 'ja-JP',
          isPartOf: {
            '@type': 'WebSite',
            name: 'おしごと AI',
            url: 'https://oshigoto.ai',
          },
          breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'ホーム', item: 'https://oshigoto.ai/' },
              { '@type': 'ListItem', position: 2, name: '無料ツール', item: 'https://oshigoto.ai/tools' },
            ],
          },
          hasPart: TOOLS.map((t) => ({
            '@type': 'WebPage',
            name: `${t.title}テンプレート 無料`,
            url: `https://oshigoto.ai${t.href}`,
            description: t.description,
          })),
        },
      },
    ],
  });

  const navigate = (href: string): void => {
    window.history.pushState({}, '', href);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.scrollTo(0, 0);
  };

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="pt-24 sm:pt-32 pb-10 sm:pb-14 px-4 sm:px-6 bg-gradient-to-b from-blue-50/40 to-white">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs sm:text-sm font-medium text-blue-600 mb-3 tracking-wide">
            無料テンプレート
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 leading-tight mb-5">
            無料で使える、業務書類ツール
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed mb-6 max-w-3xl mx-auto">
            請求書・見積書・納品書・発注書・送付状を会員登録なしで作成・PDF ダウンロード。
            インボイス制度対応、税区分(10%/8%/0%)対応、追跡なし。
          </p>
          <div className="inline-flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-white border border-slate-200 rounded-full px-5 py-2.5 shadow-sm">
            <span className="text-xs sm:text-sm text-slate-700">登録不要</span>
            <span className="text-slate-300">／</span>
            <span className="text-xs sm:text-sm text-slate-700">PDF即出力</span>
            <span className="text-slate-300">／</span>
            <span className="text-xs sm:text-sm text-slate-700">追跡なし</span>
          </div>
        </div>
      </section>

      {/* Tool cards */}
      <section className="py-10 sm:py-14 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
            {TOOLS.map((tool) => (
              <article
                key={tool.id}
                className="group rounded-xl border border-slate-200 bg-white p-6 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer"
                onClick={() => navigate(tool.href)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(tool.href);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`${tool.title}を無料で作成`}
              >
                <div
                  className={`w-12 h-12 rounded-lg ${tool.iconBg} flex items-center justify-center text-2xl font-bold mb-4`}
                  aria-hidden="true"
                >
                  {tool.glyph}
                </div>
                <h2 className="text-lg font-bold text-slate-900 mb-2">{tool.title}</h2>
                <p className="text-sm text-slate-600 leading-relaxed mb-5">
                  {tool.description}
                </p>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 group-hover:text-blue-800 transition-colors">
                  無料で作成
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
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* もっと楽したい? — soft Pro upsell (例外的に許可) */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 bg-slate-50 border-t border-slate-200">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-3">
            もっと楽したい？
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-6">
            毎回フォーム入力する代わりに、「先月分を○○商事に」と書くだけで
            <br className="hidden sm:inline" />
            AI 事務員が下書きを作成 → 自動チェックします。
          </p>

          <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-7 text-left">
            <div className="flex flex-wrap items-baseline gap-2 mb-4">
              <span className="text-xs text-slate-500">AI 事務員プラン</span>
              <span className="text-2xl font-bold text-slate-900">¥3,000</span>
              <span className="text-sm text-slate-500">/ 月</span>
            </div>
            <ul className="space-y-2 mb-5 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <Check />
                <span>5 書類すべて、AI に下書き依頼できる</span>
              </li>
              <li className="flex items-start gap-2">
                <Check />
                <span>過去の取引先・案件をワンクリックでコピー</span>
              </li>
              <li className="flex items-start gap-2">
                <Check />
                <span>LINE から写真 1 枚で OCR + 書類チェック</span>
              </li>
              <li className="flex items-start gap-2">
                <Check />
                <span>月 30 回まで Free でお試し可能</span>
              </li>
            </ul>
            <a
              href="/dashboard"
              className="block w-full sm:w-auto sm:inline-block text-center px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              無料で AI 事務員を試す（30 秒登録）
            </a>
            <p className="mt-3 text-xs text-slate-500">
              クレジットカード不要 / いつでも解約可能
            </p>
          </div>

          <p className="mt-6 text-xs text-slate-400">
            上記の無料ツールは登録なしでそのまま使い続けられます。
          </p>
        </div>
      </section>
    </div>
  );
}

function Check() {
  return (
    <span
      className="flex-shrink-0 mt-0.5 w-4 h-4 inline-flex items-center justify-center rounded-full bg-blue-100 text-blue-600"
      aria-hidden="true"
    >
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}
