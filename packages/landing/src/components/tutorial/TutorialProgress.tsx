import type { ChapterId, ChapterState } from '../../lib/tutorial-progress';
import { CHAPTERS } from '../../lib/tutorial-chapters';

interface TutorialProgressProps {
  currentChapter: ChapterState;
  completedChapters: ChapterId[];
}

export default function TutorialProgress({
  currentChapter,
  completedChapters,
}: TutorialProgressProps) {
  const isDone = currentChapter === 'done';

  return (
    <nav aria-label="チュートリアル進捗" className="w-full">
      <ol className="grid grid-cols-8 gap-1 sm:gap-1.5">
        {CHAPTERS.map((seg) => {
          const isCompleted = isDone || completedChapters.includes(seg.id);
          const isCurrent = !isDone && currentChapter === seg.id;
          const base =
            'rounded-md px-1 py-1.5 sm:py-2 border text-center transition min-w-0';
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
              title={`第 ${seg.id} 章: ${seg.title}`}
            >
              <div className="flex flex-col items-center justify-center gap-0.5 sm:flex-row sm:gap-1">
                <span className="text-[10px] sm:text-xs font-bold tabular-nums">
                  {seg.id}
                </span>
                <span className="text-[9px] sm:text-[10px] font-medium truncate">
                  {seg.shortLabel}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      {isDone && (
        <div className="mt-2 flex justify-center">
          <span className="inline-flex items-center rounded-md px-3 py-1 border border-amber-400 bg-amber-50 text-amber-800 text-[11px] sm:text-xs font-bold">
            修了
          </span>
        </div>
      )}
    </nav>
  );
}
