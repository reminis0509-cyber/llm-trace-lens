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
    'やあ、ボクはフジ。日本企業のAI事務員だよ。\nまずは見積書を作るところを見せるね。',
  hint: '下の「見積書」カードを押してみてください。',
};

const SHARE_TEXT = 'FujiTraceのAI事務員を無料で試したよ';
const SHARE_URL = 'https://fujitrace.jp/tutorial';
const X_INTENT_URL = `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(SHARE_URL)}`;

function DoneScreen({ onRestart }: { onRestart: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: prompt with URL (rare — older Safari / non-secure context)
      window.prompt('このURLをコピーしてください', SHARE_URL);
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
          本物のサービスはもっと賢いAIがあなたの指示を理解します。30日間、無料で全機能を試せます。
        </p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <a
          href="/dashboard"
          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700"
        >
          30日無料でフル機能を試す
        </a>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href={X_INTENT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            体験をXでシェア
          </a>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {copied ? 'コピーしました' : 'URLをコピー（稟議書用）'}
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
    title: 'AI事務員をタダで試す | FujiTrace',
    description:
      '見積書・請求書・複雑な業務指示まで、登録不要でAI事務員を体験できます。ダックスフンドのフジがご案内します。',
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
    updateMascot('happy', 'ぜんぶクリア！ここから先は本物のAIを試してみよう。');
  };
  const restart = () => {
    setStep(1);
    setMascot(INITIAL_MASCOT);
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
    <div className="min-h-screen bg-slate-50">
      <TutorialModeBadge />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
            無料チュートリアル
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
            AI事務員をタダで試す
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            登録不要・3ステップで、見積書・請求書の自動作成からやや複雑な業務指示までを体験できます。
          </p>
        </header>

        <DachshundNarrator
          state={mascot.state}
          message={mascot.message}
          actionHint={mascot.hint}
        />

        {renderStep()}
      </div>
    </div>
  );
}
