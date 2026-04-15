import { useEffect, useState } from 'react';
import TutorialTaskCards, { type TaskId } from './TutorialTaskCards';
import PdfPreview from './PdfPreview';

interface Step1ButtonExperienceProps {
  onComplete: () => void;
  onMascot: (state: 'idle' | 'talk' | 'happy', message: string, hint?: string) => void;
}

type Phase = 'waiting' | 'working' | 'done';

const PROGRESS_STEPS = [
  'AIが作業中...',
  '書式を確認中...',
  'PDFを生成中...',
];

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
        onMascot('happy', 'できた！ 本物のサービスでは、君の会社情報で自動生成されるんだ。');
      }, 1500),
    );
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [phase, onMascot]);

  const handleSelect = (id: TaskId) => {
    if (id !== 'estimate' || phase !== 'waiting') return;
    setPhase('working');
    setProgressIdx(0);
    onMascot('talk', '見積書を作っているよ。ちょっとだけ待っててね。');
  };

  return (
    <section aria-labelledby="step1-title" className="space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">Step 1 / 3</p>
        <h2 id="step1-title" className="mt-1 text-2xl font-bold text-slate-900">
          ボタンでAI事務員を動かす
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          まずは「見積書」カードを押してみてください。サンプルの宛先・金額で PDF を生成します。
        </p>
      </header>

      <TutorialTaskCards activeId="estimate" onSelect={handleSelect} />

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
            title="見積書（サンプル）"
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
