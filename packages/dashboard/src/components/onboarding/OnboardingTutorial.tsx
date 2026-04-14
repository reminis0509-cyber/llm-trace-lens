/* ------------------------------------------------------------------ */
/*  OnboardingTutorial — 90-second 3-step overlay                      */
/*                                                                     */
/*  Strategy: docs/戦略_2026.md Section 13.2                           */
/*  Design principle: "見せる" and "触らせる" are separated.            */
/*                                                                     */
/*  Step 1 — Button AI hands-on (real API call)                        */
/*  Step 2 — Autonomous agent video preview (placeholder)              */
/*  Step 3 — Hand-off to the AI clerk task hub                         */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from 'react';
import { X, ChevronLeft } from 'lucide-react';
import { Step1ButtonExperience } from './Step1ButtonExperience';
import { Step2VideoPreview } from './Step2VideoPreview';
import { Step3Handoff } from './Step3Handoff';
import { markOnboardingCompleted, markOnboardingSkipped } from './onboardingState';

type StepIndex = 1 | 2 | 3;

interface Props {
  /** Called when the overlay should unmount (after complete or skip). */
  onClose: () => void;
  /**
   * Called when the user finishes Step 3.
   * Parent is responsible for switching to the AI clerk tab.
   */
  onFinish: () => void;
}

const STEP_TITLES: Record<StepIndex, string> = {
  1: 'ボタンでAIを動かしてみる',
  2: 'AI事務員（自律型）の予告',
  3: 'ダッシュボードへ',
};

export function OnboardingTutorial({ onClose, onFinish }: Props) {
  const [step, setStep] = useState<StepIndex>(1);

  // Lock body scroll while the overlay is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleSkip = () => {
    markOnboardingSkipped();
    onClose();
  };

  const handleFinish = () => {
    markOnboardingCompleted();
    onFinish();
    onClose();
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      style={{ fontFamily: '"Noto Sans JP", system-ui, -apple-system, sans-serif' }}
    >
      <div className="relative w-full max-w-2xl max-h-full overflow-y-auto bg-white rounded-xl shadow-2xl">
        {/* Header: step indicator + skip */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="p-1 text-slate-400 hover:text-slate-700 transition-colors rounded-md"
                aria-label="前のステップに戻る"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}
            <div>
              <div className="text-xs text-slate-500 tabular-nums">
                ステップ {step} / 3
              </div>
              <h2
                id="onboarding-title"
                className="text-base font-semibold text-slate-900 mt-0.5"
              >
                {STEP_TITLES[step]}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition-colors"
            aria-label="チュートリアルをスキップ"
          >
            <span>スキップ</span>
            <X className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-slate-100">
          <div
            className="h-full bg-blue-600 transition-all duration-200"
            style={{ width: `${(step / 3) * 100}%` }}
            aria-hidden="true"
          />
        </div>

        {/* Step body */}
        <div className="px-6 py-6">
          {step === 1 && <Step1ButtonExperience onComplete={() => setStep(2)} />}
          {step === 2 && <Step2VideoPreview onNext={() => setStep(3)} />}
          {step === 3 && <Step3Handoff onFinish={handleFinish} />}
        </div>

        {/* Footer note */}
        <div className="px-6 pb-5 text-[11px] text-slate-400 leading-relaxed">
          合計およそ90秒。ご自身のペースで進めてください。
        </div>
      </div>
    </div>
  );
}
