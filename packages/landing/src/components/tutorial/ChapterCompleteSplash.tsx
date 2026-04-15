import { useEffect, useState } from 'react';
import type { ChapterId } from '../../lib/tutorial-progress';
import DachshundNarrator from './DachshundNarrator';

interface ChapterCompleteSplashProps {
  chapterNumber: ChapterId;
  chapterTitle: string;
  onNext: () => void;
  nextLabel?: string;
}

const SPLASH_MESSAGES: Record<ChapterId, string> = {
  1: 'ボタンだけでも…\nここまでできるんだ。',
  2: 'チャットでも\n動かせたね。',
  3: 'もう慣れたね。\n最後は…\n難しいやつ。',
  4: '全部クリア！\n修了証を\n発行しよう。',
};

export default function ChapterCompleteSplash({
  chapterNumber,
  chapterTitle,
  onNext,
  nextLabel,
}: ChapterCompleteSplashProps) {
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowButton(true), 1500);
    return () => window.clearTimeout(timer);
  }, []);

  const label =
    nextLabel ?? (chapterNumber === 4 ? '修了証を発行 →' : '次の章へ →');

  return (
    <section
      aria-labelledby="splash-title"
      className="space-y-6 text-center py-8 sm:py-12"
    >
      <div className="space-y-2">
        <p
          id="splash-title"
          className="text-3xl sm:text-4xl font-bold text-blue-700"
        >
          第 {chapterNumber} 章 クリア！
        </p>
        <p className="text-sm text-slate-500">{chapterTitle}</p>
      </div>

      <div className="max-w-2xl mx-auto">
        <DachshundNarrator
          state="happy"
          message={SPLASH_MESSAGES[chapterNumber]}
        />
      </div>

      <div className="pt-4">
        {showButton ? (
          <button
            type="button"
            onClick={onNext}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700 shadow-sm"
          >
            {label}
          </button>
        ) : (
          <div
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-6 py-3 text-sm font-medium text-slate-500"
            role="status"
            aria-live="polite"
          >
            <span className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            進捗を保存中...
          </div>
        )}
      </div>
    </section>
  );
}
