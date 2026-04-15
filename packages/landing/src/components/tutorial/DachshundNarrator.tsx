import { useEffect, useRef, useState } from 'react';

export type DachshundState = 'idle' | 'talk' | 'happy';

interface DachshundNarratorProps {
  state: DachshundState;
  message: string;
  actionHint?: string;
}

/**
 * Placeholder mascot + speech bubble. All three states currently render the
 * same GIF from the dashboard bundle (/dashboard/mascot-idle.gif); swap in
 * dedicated talk/happy frames once Founder delivers the final art.
 *
 * The message is revealed with a tiny typewriter effect. Users can press the
 * "すぐ表示" button to skip the animation.
 */
export default function DachshundNarrator({ state, message, actionHint }: DachshundNarratorProps) {
  const [shown, setShown] = useState('');
  const [done, setDone] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setShown('');
    setDone(false);
    let i = 0;
    const tick = () => {
      i += 1;
      setShown(message.slice(0, i));
      if (i >= message.length) {
        setDone(true);
        if (timerRef.current !== null) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    };
    timerRef.current = window.setInterval(tick, 24);
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [message]);

  const skip = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setShown(message);
    setDone(true);
  };

  // Placeholder: all three states point to the same asset for now.
  // Dachshund-themed art is pending from Founder; asset is colocated in LP public
  // so dev+prod both serve correctly (LP dev server cannot see dashboard/public).
  const mascotSrc = '/tutorial/dachshund-placeholder.gif';

  return (
    <div
      className="flex items-start gap-4 sm:gap-6"
      data-dachshund-state={state}
      aria-live="polite"
    >
      <img
        src={mascotSrc}
        alt="ダックスフンドのフジ"
        className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 object-contain"
      />
      <div className="relative flex-1 min-w-0">
        {/* speech bubble pointer */}
        <span
          aria-hidden="true"
          className="absolute -left-2 top-5 w-3 h-3 rotate-45 bg-white border-l border-b border-slate-200"
        />
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-sm sm:text-base text-slate-800 leading-relaxed whitespace-pre-wrap">
            {shown}
            {!done && <span className="inline-block w-1.5 h-4 ml-0.5 bg-slate-400 animate-pulse align-middle" />}
          </p>
          {actionHint && done && (
            <p className="mt-2 text-xs text-slate-500">{actionHint}</p>
          )}
          {!done && (
            <button
              type="button"
              onClick={skip}
              className="mt-2 text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2"
            >
              すぐ表示
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
