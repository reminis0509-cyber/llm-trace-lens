import { useEffect, useState } from 'react';
import PdfPreview from './PdfPreview';

interface Step1ButtonExperienceProps {
  onComplete: () => void;
  onMascot: (state: 'idle' | 'talk' | 'happy', message: string, hint?: string) => void;
}

type Phase = 'waiting' | 'working' | 'done';

const PROGRESS_STEPS = [
  'AI が作業中...',
  '書式を確認中...',
  'PDF を生成中...',
];

const PREFILL = {
  clientName: '株式会社サンプル商事',
  honorific: '御中',
  subject: 'AI 事務員導入コンサルティング',
  issueDate: '2026-04-15',
  expiryDate: '2026-05-15',
  itemName: 'AI 事務員初期構築',
  quantity: '1',
  unitPrice: '¥300,000',
  amount: '¥300,000',
  subtotal: '¥300,000',
  tax: '¥30,000',
  total: '¥330,000',
  paymentTerms: '月末締翌月末払い',
};

/** Small read-only form field that looks like a filled-in freee input. */
function ReadOnlyField({
  label,
  value,
  hint = '自動入力',
  mono = false,
  align = 'left',
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
  align?: 'left' | 'right';
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      <div
        className={`w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 ${
          mono ? 'tabular-nums' : ''
        } ${align === 'right' ? 'text-right' : ''}`}
        aria-readonly="true"
      >
        {value}
      </div>
      <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>
    </label>
  );
}

export default function Step1ButtonExperience({ onComplete, onMascot }: Step1ButtonExperienceProps) {
  const [phase, setPhase] = useState<Phase>('waiting');
  const [progressIdx, setProgressIdx] = useState(0);

  useEffect(() => {
    if (phase !== 'working') return;
    const timers: number[] = [];
    timers.push(window.setTimeout(() => setProgressIdx(1), 500));
    timers.push(window.setTimeout(() => setProgressIdx(2), 1000));
    timers.push(
      window.setTimeout(() => {
        setPhase('done');
        onMascot('happy', 'できた！\n\n本物のサービスでは…\n君の会社情報で\n自動生成されるんだ。');
      }, 1500),
    );
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [phase, onMascot]);

  const handleGenerate = () => {
    if (phase !== 'waiting') return;
    setPhase('working');
    setProgressIdx(0);
    onMascot('talk', '見積書を作っているよ。\nちょっとだけ…\n待っててね。');
  };

  return (
    <section aria-labelledby="step1-title" className="space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">Step 1 / 3</p>
        <h2 id="step1-title" className="mt-1 text-2xl font-bold text-slate-900">
          ボタン一つで見積書を作る
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          取引先・品目・金額はすでに入っています。下のボタンを押すと AI 事務員が見積書 PDF を生成します。
        </p>
      </header>

      {phase !== 'done' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-6">
          {/* 取引先情報 */}
          <section aria-labelledby="client-section" className="space-y-3">
            <h3 id="client-section" className="text-sm font-semibold text-slate-900">
              取引先情報
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ReadOnlyField label="宛先" value={PREFILL.clientName} />
              <ReadOnlyField label="敬称" value={PREFILL.honorific} />
            </div>
          </section>

          {/* 見積内容 */}
          <section aria-labelledby="content-section" className="space-y-3">
            <h3 id="content-section" className="text-sm font-semibold text-slate-900">
              見積内容
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-3">
                <ReadOnlyField label="件名" value={PREFILL.subject} />
              </div>
              <ReadOnlyField label="発行日" value={PREFILL.issueDate} mono />
              <ReadOnlyField label="有効期限" value={PREFILL.expiryDate} mono />
            </div>
          </section>

          {/* 明細 */}
          <section aria-labelledby="items-section" className="space-y-3">
            <h3 id="items-section" className="text-sm font-semibold text-slate-900">
              明細
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-3">品名</th>
                    <th className="py-2 px-3 text-right w-20">数量</th>
                    <th className="py-2 px-3 text-right w-32">単価</th>
                    <th className="py-2 pl-3 text-right w-32">金額</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="py-3 pr-3 text-slate-800">{PREFILL.itemName}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-800">{PREFILL.quantity}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-800">{PREFILL.unitPrice}</td>
                    <td className="py-3 pl-3 text-right tabular-nums text-slate-800">{PREFILL.amount}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-slate-400">自動入力</p>
          </section>

          {/* 合計 */}
          <section aria-labelledby="total-section" className="space-y-3">
            <h3 id="total-section" className="text-sm font-semibold text-slate-900">
              合計
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ReadOnlyField label="小計" value={PREFILL.subtotal} mono align="right" />
              <ReadOnlyField label="消費税 (10%)" value={PREFILL.tax} mono align="right" />
              <ReadOnlyField label="合計" value={PREFILL.total} mono align="right" />
            </div>
          </section>

          {/* 支払条件 */}
          <section aria-labelledby="payment-section" className="space-y-3">
            <h3 id="payment-section" className="text-sm font-semibold text-slate-900">
              支払条件
            </h3>
            <ReadOnlyField label="支払条件" value={PREFILL.paymentTerms} />
          </section>

          {/* CTA */}
          <div className="pt-4 border-t border-slate-100 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={phase !== 'waiting'}
              aria-label="AI で見積書を生成する"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-8 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-sm"
            >
              {phase === 'working' ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  作成中...
                </>
              ) : (
                'AI で見積書を生成する'
              )}
            </button>
            <p className="text-xs text-slate-500">所要時間: 約 2 秒</p>
          </div>
        </div>
      )}

      {phase === 'working' && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-slate-200 bg-white p-6"
        >
          <div className="flex items-center gap-3">
            <span className="w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
            <span className="text-sm font-medium text-slate-700">
              {PROGRESS_STEPS[progressIdx]}
            </span>
          </div>
          <ul className="mt-4 space-y-1 text-xs text-slate-500">
            {PROGRESS_STEPS.map((s, i) => (
              <li key={s} className={i <= progressIdx ? 'text-slate-800' : ''}>
                {i < progressIdx ? '済' : i === progressIdx ? '実行中' : '待機'} — {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {phase === 'done' && (
        <>
          <PdfPreview
            src="/tutorial/sample-estimate.pdf"
            filename="見積書_サンプル.pdf"
            title="見積書ができました！"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onComplete}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              次のステップへ
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </>
      )}
    </section>
  );
}
