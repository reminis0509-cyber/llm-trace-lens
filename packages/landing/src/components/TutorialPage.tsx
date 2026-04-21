import { useCallback, useEffect, useState } from 'react';
import { useSeo } from '../hooks/useSeo';
import TutorialModeBadge from './tutorial/TutorialModeBadge';
import DachshundNarrator, { type DachshundState } from './tutorial/DachshundNarrator';
import TutorialProgress from './tutorial/TutorialProgress';
import ChapterCompleteSplash from './tutorial/ChapterCompleteSplash';
import Chapter1Button from './tutorial/Chapter1Button';
import Chapter2ChatIntro from './tutorial/Chapter2ChatIntro';
import Chapter3Minutes from './tutorial/Chapter3ChatPractice';
import Chapter4SlideBuilder from './tutorial/Chapter4ChatComplex';
import Chapter5ExcelAnalyze from './tutorial/Chapter5ExcelAnalyze';
import Chapter6Research from './tutorial/Chapter6Research';
import Chapter7Proofread from './tutorial/Chapter7Proofread';
import Chapter8Integration from './tutorial/Chapter8Integration';
import CompletionCertificate from './tutorial/CompletionCertificate';
import {
  buildInitialProgress,
  loadProgress,
  resetProgress,
  saveProgress,
  type ChapterId,
  type TutorialProgress as TProgress,
} from '../lib/tutorial-progress';
import { getChapterMeta } from '../lib/tutorial-chapters';

interface MascotMessage {
  state: DachshundState;
  message: string;
  hint?: string;
}

const INITIAL_MASCOT: MascotMessage = {
  state: 'idle',
  message:
    'やあ。\nボクはフジ。\n日本企業のAI社員だよ。\n\nこれから一週間、\nボクの仕事を見せるね。',
  hint: '下の「今日のブリーフィングを聞く」\nから始めよう。',
};

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

interface ResumePromptProps {
  progress: TProgress;
  onResume: () => void;
  onRestart: () => void;
}

function ResumePrompt({ progress, onResume, onRestart }: ResumePromptProps) {
  const chLabel =
    progress.currentChapter === 'done'
      ? '修了証'
      : `第 ${progress.currentChapter} 章`;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="resume-title"
      className="fixed inset-0 z-[70] bg-slate-900/50 flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
        <h2 id="resume-title" className="text-lg font-bold text-slate-900">
          前回の続きから再開しますか？
        </h2>
        <p className="text-sm text-slate-600">
          前回は <span className="font-semibold">{chLabel}</span> まで進んでいました。
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={onResume}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            続きから再開
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            最初からやり直す
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TutorialPage() {
  useSeo({
    title: 'AI 社員 基礎チュートリアル — 一週間の仕事を体験 | FujiTrace',
    description:
      '8 章構成で、AI 社員のブリーフィング / 書類作成 / 議事録 / スライド / Excel 分析 / Wide Research / 校正 / 複合タスクを順に体験。修了証 PNG を発行できます。',
    url: 'https://fujitrace.jp/tutorial',
  });

  const [progress, setProgress] = useState<TProgress | null>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [mascot, setMascot] = useState<MascotMessage>(INITIAL_MASCOT);
  const [splashChapter, setSplashChapter] = useState<ChapterId | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const existing = loadProgress();
    if (
      existing &&
      (existing.currentChapter !== 1 || existing.completedChapters.length > 0)
    ) {
      setProgress(existing);
      setShowResumePrompt(true);
    } else {
      setProgress(existing ?? buildInitialProgress());
    }
    setHydrated(true);
  }, []);

  const updateMascot = useCallback(
    (state: DachshundState, message: string, hint?: string) => {
      setMascot({ state, message, hint });
    },
    [],
  );

  const persist = useCallback((next: TProgress) => {
    saveProgress(next);
    setProgress(next);
  }, []);

  const handleResume = () => {
    setShowResumePrompt(false);
  };

  const handleHardRestart = () => {
    resetProgress();
    const fresh = buildInitialProgress();
    saveProgress(fresh);
    setProgress(fresh);
    setShowResumePrompt(false);
    setSplashChapter(null);
    setMascot(INITIAL_MASCOT);
  };

  const handleChapterComplete = (ch: ChapterId) => {
    if (!progress) return;
    const nextCh = ch === 8 ? 'done' : ((ch + 1) as ChapterId);
    const completed = progress.completedChapters.includes(ch)
      ? progress.completedChapters
      : [...progress.completedChapters, ch];
    const updated: TProgress = {
      ...progress,
      currentChapter: nextCh,
      completedChapters: completed,
      completedAt: ch === 8 ? new Date().toISOString() : progress.completedAt,
    };
    persist(updated);
    setSplashChapter(ch);
  };

  const handleUserNameChange = (userName: string) => {
    if (!progress) return;
    const updated: TProgress = { ...progress, userName };
    persist(updated);
  };

  const handleSplashNext = () => {
    setSplashChapter(null);
  };

  const handleClose = () => {
    window.location.href = '/';
  };

  const renderChapter = () => {
    if (!progress) return null;
    if (splashChapter !== null) {
      return (
        <ChapterCompleteSplash
          chapterNumber={splashChapter}
          chapterTitle={getChapterMeta(splashChapter).title}
          onNext={handleSplashNext}
        />
      );
    }
    const ch = progress.currentChapter;
    if (ch === 1) {
      return (
        <Chapter1Button
          onComplete={() => handleChapterComplete(1)}
          onMascot={updateMascot}
        />
      );
    }
    if (ch === 2) {
      return (
        <Chapter2ChatIntro
          onComplete={() => handleChapterComplete(2)}
          onMascot={updateMascot}
        />
      );
    }
    if (ch === 3) {
      return (
        <Chapter3Minutes
          onComplete={() => handleChapterComplete(3)}
          onMascot={updateMascot}
        />
      );
    }
    if (ch === 4) {
      return (
        <Chapter4SlideBuilder
          onComplete={() => handleChapterComplete(4)}
          onMascot={updateMascot}
        />
      );
    }
    if (ch === 5) {
      return (
        <Chapter5ExcelAnalyze
          onComplete={() => handleChapterComplete(5)}
          onMascot={updateMascot}
        />
      );
    }
    if (ch === 6) {
      return (
        <Chapter6Research
          onComplete={() => handleChapterComplete(6)}
          onMascot={updateMascot}
        />
      );
    }
    if (ch === 7) {
      return (
        <Chapter7Proofread
          onComplete={() => handleChapterComplete(7)}
          onMascot={updateMascot}
        />
      );
    }
    if (ch === 8) {
      return (
        <Chapter8Integration
          onComplete={() => handleChapterComplete(8)}
          onMascot={updateMascot}
        />
      );
    }
    // 'done'
    return (
      <CompletionCertificate
        initialUserName={progress.userName ?? ''}
        onUserNameChange={handleUserNameChange}
        onRestart={handleHardRestart}
      />
    );
  };

  const showMascot = splashChapter === null && progress?.currentChapter !== 'done';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="FujiTrace チュートリアル"
      className="fixed inset-0 z-50 bg-white overflow-y-auto"
    >
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

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-8">
        <header className="space-y-2 text-center sm:text-left">
          <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
            無料チュートリアル — AI 社員の一週間（8 章構成）
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
            AI 社員の一週間
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl mx-auto sm:mx-0">
            月曜朝のブリーフィングから、書類作成・議事録・スライド・Excel 分析・Wide Research・校正・複合タスクまで。
            AI 社員がデスクで働く 1 週間を体験します。
          </p>
        </header>

        {progress && (
          <TutorialProgress
            currentChapter={progress.currentChapter}
            completedChapters={progress.completedChapters}
          />
        )}

        {showMascot && (
          <DachshundNarrator
            state={mascot.state}
            message={mascot.message}
            actionHint={mascot.hint}
          />
        )}

        {hydrated && renderChapter()}

        <div className="pt-8 pb-4 text-center text-xs text-slate-400">
          FujiTrace チュートリアル · スクリプト駆動
        </div>
      </div>

      {showResumePrompt && progress && (
        <ResumePrompt
          progress={progress}
          onResume={handleResume}
          onRestart={handleHardRestart}
        />
      )}
    </div>
  );
}
