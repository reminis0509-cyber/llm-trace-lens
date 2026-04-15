import { useState, useCallback } from 'react';
import { useSeo } from '../hooks/useSeo';
import TutorialModeBadge from './tutorial/TutorialModeBadge';
import DachshundNarrator, { type DachshundState } from './tutorial/DachshundNarrator';
import Step1ButtonExperience from './tutorial/Step1ButtonExperience';
import Step2ChatSimple from './tutorial/Step2ChatSimple';
import Step3ChatComplex from './tutorial/Step3ChatComplex';

type StepState = 1 | 2 | 3 | 'done';

interface MascotMessage {
  state: DachshundState;
  message: string;
  hint?: string;
}

const INITIAL_MASCOT: MascotMessage = {
  state: 'idle',
  message:
    'やあ。\nボクはフジ。\n日本企業のAI事務員だよ。\n\nまずは…\n見積書を作るところを\n見せるね。',
  hint: '下のフォームを見てから、\n「AIで見積書を生成する」を\n押してみてね。',
};

const SHARE_TEXT = 'FujiTrace の AI 事務員を無料で試したよ';
const SHARE_URL = 'https://fujitrace.jp/tutorial';
const X_INTENT_URL = `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(SHARE_URL)}`;

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function DoneScreen({ onRestart }: { onRestart: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('この URL をコピーしてください', SHARE_URL);
    }
  };

  return (
    <section aria-labelledby="done-title" className="space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">完了</p>
        <h2 id="done-title" className="mt-1 text-2xl font-bold text-slate-900">
          お疲れさま！これで基本は完璧だよ
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          本物のサービスはもっと賢い AI があなたの指示を理解します。30 日間、無料で全機能を試せます。
        </p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <a
          href="/dashboard"
          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700"
        >
          30 日無料でフル機能を試す
        </a>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href={X_INTENT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            体験を X でシェア
          </a>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {copied ? 'コピーしました' : 'URL をコピー（稟議書用）'}
          </button>
        </div>
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={onRestart}
            className="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2"
          >
            最初からもう一度
          </button>
        </div>
      </div>
    </section>
  );
}

export default function TutorialPage() {
  useSeo({
    title: 'AI 事務員をタダで試す | FujiTrace',
    description:
      '見積書・請求書・複雑な業務指示まで、登録不要で AI 事務員を体験できます。ダックスフンドのフジがご案内します。',
    url: 'https://fujitrace.jp/tutorial',
  });

  const [step, setStep] = useState<StepState>(1);
  const [mascot, setMascot] = useState<MascotMessage>(INITIAL_MASCOT);

  const updateMascot = useCallback(
    (state: DachshundState, message: string, hint?: string) => {
      setMascot({ state, message, hint });
    },
    [],
  );

  const goToStep2 = () => setStep(2);
  const goToStep3 = () => setStep(3);
  const goToDone = () => {
    setStep('done');
    updateMascot('happy', 'ぜんぶクリア！\n\nここから先は…\n本物のAIを試してみよう。');
  };
  const restart = () => {
    setStep(1);
    setMascot(INITIAL_MASCOT);
  };

  const handleClose = () => {
    window.location.href = '/';
  };

  const renderStep = () => {
    if (step === 1) {
      return <Step1ButtonExperience onComplete={goToStep2} onMascot={updateMascot} />;
    }
    if (step === 2) {
      return <Step2ChatSimple onComplete={goToStep3} onMascot={updateMascot} />;
    }
    if (step === 3) {
      return <Step3ChatComplex onComplete={goToDone} onMascot={updateMascot} />;
    }
    return <DoneScreen onRestart={restart} />;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="FujiTrace チュートリアル"
      className="fixed inset-0 z-50 bg-white overflow-y-auto"
    >
      {/* Close button — fixed top-right, thumb-reachable on mobile */}
      <button
        type="button"
        onClick={handleClose}
        aria-label="チュートリアルを閉じる"
        className="fixed top-3 right-3 sm:top-4 sm:right-4 z-[60] inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white/95 backdrop-blur px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900"
      >
        <CloseIcon className="w-4 h-4" />
        <span className="hidden sm:inline">閉じる</span>
      </button>

      <TutorialModeBadge />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-10">
        <header className="space-y-2 text-center sm:text-left">
          <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
            無料チュートリアル
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
            AI 事務員をタダで試す
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl mx-auto sm:mx-0">
            登録不要・3 ステップで、見積書・請求書の自動作成からやや複雑な業務指示までを体験できます。
          </p>
        </header>

        <DachshundNarrator
          state={mascot.state}
          message={mascot.message}
          actionHint={mascot.hint}
        />

        {renderStep()}

        <div className="pt-8 pb-4 text-center text-xs text-slate-400">
          FujiTrace チュートリアル · スクリプト駆動
        </div>
      </div>
    </div>
  );
}
