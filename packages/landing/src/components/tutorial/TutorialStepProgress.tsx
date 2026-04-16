import { useEffect, useRef, useState } from 'react';
import { playStepSound, playCompleteSound } from '../../lib/tutorialSound';

export interface TutorialStep {
  label: string;
  /** How long this step stays "in progress" before completing (ms). */
  duration: number;
}

interface TutorialStepProgressProps {
  steps: TutorialStep[];
  onComplete: () => void;
}

/* ─── Icons ───────────────────────────────────────────────────────── */

function Spinner() {
  return (
    <svg
      className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="w-4 h-4 text-green-500 flex-shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function PendingDot() {
  return (
    <svg
      className="w-4 h-4 text-slate-300 flex-shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8" strokeWidth={2} />
    </svg>
  );
}

/* ─── Elapsed seconds hook ────────────────────────────────────────── */

function useElapsedSeconds(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (!active) {
      setElapsed(0);
      startRef.current = Date.now();
      return;
    }
    startRef.current = Date.now();
    setElapsed(0);
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  return elapsed;
}

/* ─── Component ───────────────────────────────────────────────────── */

/**
 * Lightweight step-progress timeline for the tutorial.
 * Mimics the SkeletonTrace design from the dashboard:
 * completed = green check, in-progress = spinner + elapsed, pending = grey dot.
 */
export default function TutorialStepProgress({ steps, onComplete }: TutorialStepProgressProps) {
  const [completedCount, setCompletedCount] = useState(0);
  const firedComplete = useRef(false);
  const isRunning = completedCount < steps.length;
  const elapsed = useElapsedSeconds(isRunning);

  useEffect(() => {
    if (steps.length === 0) return;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let cumulative = 0;

    for (let i = 0; i < steps.length; i++) {
      cumulative += steps[i].duration;
      const stepIdx = i + 1;
      const timer = setTimeout(() => {
        if (cancelled) return;
        setCompletedCount(stepIdx);
        playStepSound();

        if (stepIdx === steps.length && !firedComplete.current) {
          firedComplete.current = true;
          // Small delay so the last step visually settles before onComplete fires
          const doneTimer = setTimeout(() => {
            if (!cancelled) {
              playCompleteSound();
              onComplete();
            }
          }, 300);
          timers.push(doneTimer);
        }
      }, cumulative);
      timers.push(timer);
    }

    return () => {
      cancelled = true;
      for (const t of timers) clearTimeout(t);
    };
  }, [steps, onComplete]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full rounded-xl border border-slate-100 bg-white p-5"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        {isRunning && (
          <span className="text-xs text-slate-400 font-mono tabular-nums">{elapsed}s</span>
        )}
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-0 bottom-0 w-px bg-slate-200" />

        {steps.map((step, idx) => {
          const isCompleted = idx < completedCount;
          const isActive = idx === completedCount && isRunning;

          return (
            <div key={idx} className="relative pl-8 pb-3">
              {/* Timeline dot */}
              <div
                className={`absolute left-[1px] top-1.5 w-3.5 h-3.5 rounded-full border-2 ${
                  isCompleted
                    ? 'border-green-500 bg-green-50'
                    : isActive
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 bg-slate-50'
                }`}
              />

              {/* Step card */}
              <div
                className={`rounded-lg border p-3 transition-all duration-300 ${
                  isCompleted
                    ? 'border-l-[3px] border-l-green-500 border-t-slate-100 border-r-slate-100 border-b-slate-100 bg-slate-50'
                    : isActive
                      ? 'border-l-[3px] border-l-blue-500 border-t-slate-100 border-r-slate-100 border-b-slate-100 bg-blue-50/30'
                      : 'border-l-[3px] border-l-slate-200 border-t-slate-100 border-r-slate-100 border-b-slate-100 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isCompleted ? (
                    <CheckIcon />
                  ) : isActive ? (
                    <Spinner />
                  ) : (
                    <PendingDot />
                  )}
                  <span
                    className={`text-sm font-medium ${
                      isCompleted
                        ? 'text-slate-800'
                        : isActive
                          ? 'text-slate-800'
                          : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
