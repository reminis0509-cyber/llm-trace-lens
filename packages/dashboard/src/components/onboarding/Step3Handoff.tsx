/* ------------------------------------------------------------------ */
/*  Step3Handoff — 30s hand-off to the AI clerk task hub               */
/* ------------------------------------------------------------------ */

interface Props {
  onFinish: () => void;
}

const CARDS: Array<{ title: string; desc: string }> = [
  { title: '見積書', desc: '作成・チェック' },
  { title: '請求書', desc: '作成・チェック' },
  { title: '納品書', desc: '作成' },
  { title: '発注書', desc: '作成' },
  { title: '送付状', desc: '作成' },
];

export function Step3Handoff({ onFinish }: Props) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600 leading-relaxed">
        それでは、実際にダッシュボードでおしごと AIを使ってみましょう。以下 5 種類の書類が Free プランで月 30 回までご利用いただけます。
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {CARDS.map((c) => (
          <div
            key={c.title}
            className="p-3 rounded-md border border-slate-200 bg-white text-center"
          >
            <div className="text-sm font-medium text-slate-900">{c.title}</div>
            <div className="mt-0.5 text-xs text-slate-500">{c.desc}</div>
          </div>
        ))}
      </div>

      <div className="p-3 rounded-md bg-blue-50 border border-blue-100 text-xs text-slate-700 leading-relaxed">
        ヒント: 同じ案件で見積書 → 請求書 → 納品書と連続して作業したくなったら、それが Pro+「おしごと AI」への進級サインです。
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onFinish}
          className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 transition-colors"
        >
          ダッシュボードへ
        </button>
      </div>
    </div>
  );
}
