import { useEffect, useRef, useState } from 'react';

export type DachshundState = 'idle' | 'talk' | 'happy';

interface DachshundNarratorProps {
  state: DachshundState;
  message: string;
  actionHint?: string;
}

/**
 * Per-character delay table — DQ-style "spacing" at punctuation marks.
 * Normal chars: 38ms, punctuation / ellipsis / exclamation / newline are longer.
 */
function getCharDelay(ch: string): number {
  if (ch === '\u3001') return 200; // 、
  if (ch === '\u3002') return 400; // 。
  if (ch === '\u2026') return 600; // …
  if (ch === '\uff01' || ch === '\uff1f' || ch === '!' || ch === '?') return 300;
  if (ch === '\n') return 250;
  return 38;
}

/**
 * Dachshund mascot "Fuji" + DQ-style message window.
 * - Applies dynamic per-char delay (longer pauses at punctuation)
 * - "Skip" button to show full message instantly
 * - Cleans up cleanly when message prop changes (Strict Mode safe)
 */
export default function DachshundNarrator({ state, message, actionHint }: DachshundNarratorProps) {
  const [shown, setShown] = useState('');
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Reset state for the new message.
    setShown('');
    setDone(false);

    let cancelled = false;
    let idx = 0;

    function tick() {
      if (cancelled) return;
      if (idx >= message.length) {
        setDone(true);
        timerRef.current = null;
        return;
      }
      const ch = message.charAt(idx);
      idx += 1;
      setShown(message.slice(0, idx));
      timerRef.current = setTimeout(tick, getCharDelay(ch));
    }

    // Start with a short initial delay so React has time to flush the reset.
    timerRef.current = setTimeout(tick, 60);

    return () => {
      cancelled = true;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [message]);

  const skip = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setShown(message);
    setDone(true);
  };

  // Founder-supplied dachshund pixel art (2026-04-15).
  // - idle / talk: standing pose
  // - happy: running/excited pose
  const mascotSrc =
    state === 'happy'
      ? '/tutorial/dachshund-happy.gif'
      : state === 'talk'
        ? '/tutorial/dachshund-talk.gif'
        : '/tutorial/dachshund-idle.gif';

  return (
    <div
      className="flex items-start gap-4 sm:gap-6"
      data-dachshund-state={state}
      aria-live="polite"
    >
      <img
        src={mascotSrc}
        alt="Dachshund mascot Fuji"
        className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 object-contain"
      />
      <div className="relative flex-1 min-w-0">
        {/* speech bubble pointer */}
        <span
          aria-hidden="true"
          className="absolute -left-2 top-5 w-3 h-3 rotate-45 bg-white border-l border-b border-slate-200"
        />
        <div className="relative rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-sm sm:text-base text-slate-800 leading-relaxed whitespace-pre-wrap">
            {shown}
            {!done && <span className="inline-block w-1.5 h-4 ml-0.5 bg-slate-400 animate-pulse align-middle" />}
          </p>
          {actionHint && done && (
            <p className="mt-2 text-xs text-slate-500 whitespace-pre-wrap">{actionHint}</p>
          )}
          {!done && (
            <button
              type="button"
              onClick={skip}
              aria-label="Skip to show full message"
              className="absolute bottom-2 right-3 inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-800"
            >
              全部表示 <span aria-hidden="true">▶▶</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
