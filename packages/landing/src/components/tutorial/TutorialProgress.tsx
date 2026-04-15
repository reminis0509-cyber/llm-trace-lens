import type { ChapterId, ChapterState } from '../../lib/tutorial-progress';

interface TutorialProgressProps {
  currentChapter: ChapterState;
  completedChapters: ChapterId[];
}

const SEGMENTS: { id: ChapterId; label: string }[] = [
  { id: 1, label: 'ボタン' },
  { id: 2, label: 'チャット入門' },
  { id: 3, label: '練習' },
  { id: 4, label: '応用' },
];

export default function TutorialProgress({
  currentChapter,
  completedChapters,
}: TutorialProgressProps) {
  const isDone = currentChapter === 'done';

  return (
    <nav aria-label="チュートリアル進捗" className="w-full">
      <ol className="flex items-stretch gap-1.5 sm:gap-2">
        {SEGMENTS.map((seg) => {
          const isCompleted = isDone || completedChapters.includes(seg.id);
          const isCurrent = !isDone && currentChapter === seg.id;
          const base =
            'flex-1 rounded-md px-2 py-2 sm:py-2.5 border text-center transition';
          let style: string;
          if (isCompleted) {
            style = 'bg-blue-600 border-blue-600 text-white';
          } else if (isCurrent) {
            style =
              'bg-white border-blue-500 text-blue-700 ring-2 ring-blue-200 animate-pulse';
          } else {
            style = 'bg-slate-100 border-slate-200 text-slate-400';
          }
          return (
            <li
              key={seg.id}
              className={`${base} ${style}`}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-[11px] sm:text-xs font-bold tabular-nums">
                  {seg.id}
                </span>
                <span className="text-[10px] sm:text-xs font-medium truncate">
                  {seg.label}
                </span>
              </div>
            </li>
          );
        })}
        {isDone && (
          <li className="flex-none rounded-md px-3 py-2 sm:py-2.5 border border-amber-400 bg-amber-50 text-amber-800 text-[11px] sm:text-xs font-bold">
            修了
          </li>
        )}
      </ol>
    </nav>
  );
}
