import { useEffect, useRef, useState } from 'react';

export type DachshundState = 'idle' | 'talk' | 'happy';

interface DachshundNarratorProps {
  state: DachshundState;
  message: string;
  actionHint?: string;
}

/**
 * Per-character delay table — ドラクエ風の「間」を句読点で演出する。
 * 通常文字は 38ms、句読点・三点リーダー・感嘆符・改行は長めに取る。
 */
function getCharDelay(ch: string): number {
  if (ch === '、') return 200;
  if (ch === '。') return 400;
  if (ch === '…') return 600;
  if (ch === '！' || ch === '？' || ch === '!' || ch === '?') return 300;
  if (ch === '\n') return 250;
  return 38;
}

/**
 * ダックスフンドのフジ + ドラクエ風メッセージウィンドウ。
 * - 文字ごとに動的 delay を適用（句読点で溜め、「…」で長めの間）
 * - 「全部表示 ▶▶」ボタンで即時完了にスキップ
 * - message prop が切り替わると途中でも即クリーンアップして新シーケンスを開始
 */
export default function DachshundNarrator({ state, message, actionHint }: DachshundNarratorProps) {
  const [shown, setShown] = useState('');
  const [done, setDone] = useState(false);
  const timerRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    setShown('');
    setDone(false);

    let i = 0;
    const step = () => {
      if (cancelledRef.current) return;
      if (i >= message.length) {
        setDone(true);
        timerRef.current = null;
        return;
      }
      const ch = message.charAt(i);
      i += 1;
      setShown(message.slice(0, i));
      const delay = getCharDelay(ch);
      timerRef.current = window.setTimeout(step, delay);
    };

    // Kick off the sequence on the next tick so React has time to reset state.
    timerRef.current = window.setTimeout(step, getCharDelay(message.charAt(0) || ''));

    return () => {
      cancelledRef.current = true;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [message]);

  const skip = () => {
    cancelledRef.current = true;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
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
        alt="ダックスフンドのフジ"
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
              aria-label="メッセージを全部表示する"
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
