import { useEffect, useMemo, useRef, useState } from 'react';
import TutorialChatUI, { type ChatMessage } from './TutorialChatUI';
import PdfPreview from './PdfPreview';
import {
  matchIntentForKind,
  TUTORIAL_FOOTNOTE,
  PDF_PATHS,
  documentFilename,
  documentLabel,
  type DocumentKind,
} from '../../lib/tutorial-scripts';
import type { PracticeTaskId } from '../../lib/tutorial-progress';

interface Chapter3ChatPracticeProps {
  onComplete: () => void;
  onMascot: (state: 'idle' | 'talk' | 'happy', message: string, hint?: string) => void;
  initialCompletedTasks?: PracticeTaskId[];
  onTaskComplete?: (task: PracticeTaskId) => void;
}

interface PracticeTaskDef {
  mascotIntro: string;
  mascotHint?: string;
  suggestions: string[];
  kind: DocumentKind;
  placeholder: string;
}

const PRACTICE_TASKS: Record<PracticeTaskId, PracticeTaskDef> = {
  purchase_order: {
    mascotIntro: '次は…\n発注書を出してみて。',
    mascotHint: 'チップから選んでOK',
    suggestions: ['発注書作って', '発注書出して', 'サーバー機材の発注書'],
    kind: 'purchase-order',
    placeholder: '例: 発注書作って',
  },
  cover_letter: {
    mascotIntro: '今度は…\n送付状はどう？',
    mascotHint: 'チップから選んでOK',
    suggestions: ['送付状作って', '書類の送付状', '送り状お願い'],
    kind: 'cover-letter',
    placeholder: '例: 送付状作って',
  },
  delivery_note: {
    mascotIntro: '納品書も…\nいけるかな？',
    mascotHint: 'チップから選んでOK',
    suggestions: ['納品書作って', '納品書お願い', '納品書出して'],
    kind: 'delivery-note',
    placeholder: '例: 納品書作って',
  },
};

const DEFAULT_ORDER: PracticeTaskId[] = [
  'purchase_order',
  'cover_letter',
  'delivery_note',
];

const SUCCESS_COMMENTS = [
  'いいね！',
  '上手く…\nなってきた！',
  'もう慣れたね。\n\n次はちょっと\n難しいのに\n挑戦しよう。',
];

interface RevealedPdf {
  kind: DocumentKind;
  taskId: PracticeTaskId;
}

export default function Chapter3ChatPractice({
  onComplete,
  onMascot,
  initialCompletedTasks = [],
  onTaskComplete,
}: Chapter3ChatPracticeProps) {
  const queue = useMemo<PracticeTaskId[]>(
    () => DEFAULT_ORDER.filter((t) => !initialCompletedTasks.includes(t)),
    [initialCompletedTasks],
  );

  const [queueIdx, setQueueIdx] = useState(0);
  const [completedCount, setCompletedCount] = useState(initialCompletedTasks.length);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [revealed, setRevealed] = useState<RevealedPdf | null>(null);
  const idCounter = useRef(0);
  const announcedFor = useRef<PracticeTaskId | null>(null);

  const currentTaskId: PracticeTaskId | null = queue[queueIdx] ?? null;
  const currentTask = currentTaskId ? PRACTICE_TASKS[currentTaskId] : null;

  useEffect(() => {
    if (!currentTaskId || !currentTask) {
      // No remaining tasks (all previously completed) — jump straight out.
      onComplete();
      return;
    }
    if (revealed) return;
    if (announcedFor.current === currentTaskId) return;
    announcedFor.current = currentTaskId;
    onMascot('talk', currentTask.mascotIntro, currentTask.mascotHint);
  }, [currentTaskId, currentTask, revealed, onMascot, onComplete]);

  const nextId = () => {
    idCounter.current += 1;
    return `ch3-${idCounter.current}`;
  };

  const handleSend = (text: string) => {
    if (!currentTask || !currentTaskId || revealed) return;
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: text }]);
    setIsTyping(true);

    window.setTimeout(() => {
      const match = matchIntentForKind(text, currentTask.kind);
      if (match) {
        const label = documentLabel(currentTask.kind);
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'assistant',
            content: `${label}のサンプルを用意したよ。下のプレビューを確認してね。`,
            footnote: TUTORIAL_FOOTNOTE,
          },
        ]);
        setRevealed({ kind: currentTask.kind, taskId: currentTaskId });
        const newCompleted = completedCount + 1;
        setCompletedCount(newCompleted);
        const comment =
          SUCCESS_COMMENTS[Math.min(newCompleted - 1, SUCCESS_COMMENTS.length - 1)];
        onMascot('happy', comment);
        onTaskComplete?.(currentTaskId);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'assistant',
            content:
              'そのキーワードは\nチュートリアル外だよ。\n下のチップから\n選んでみて。',
            footnote: TUTORIAL_FOOTNOTE,
          },
        ]);
      }
      setIsTyping(false);
    }, 800);
  };

  const handleNextPractice = () => {
    if (!revealed) return;
    const nextIdx = queueIdx + 1;
    setRevealed(null);
    setMessages([]);
    if (nextIdx >= queue.length) {
      onComplete();
      return;
    }
    setQueueIdx(nextIdx);
  };

  const progressText = `${completedCount} / 3 タスク完了`;
  const isLast = revealed && queueIdx + 1 >= queue.length;

  return (
    <section aria-labelledby="ch3-title" className="space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">第 3 章 / 4</p>
        <h2 id="ch3-title" className="mt-1 text-2xl font-bold text-slate-900">
          反復で経験値を積む
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          3 つの書類を順番に練習します。1 度は偶然、3 度目は実力。
        </p>
        <p className="mt-1 text-xs text-slate-500 tabular-nums">{progressText}</p>
      </header>

      {currentTask && (
        <TutorialChatUI
          messages={messages}
          onSend={handleSend}
          suggestions={currentTask.suggestions}
          isTyping={isTyping}
          placeholder={currentTask.placeholder}
          disabled={revealed !== null}
        />
      )}

      {revealed && (
        <>
          <PdfPreview
            src={PDF_PATHS[revealed.kind]}
            filename={documentFilename(revealed.kind)}
            title={`${documentLabel(revealed.kind)}（サンプル）`}
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleNextPractice}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              {isLast ? '第 3 章を終える' : '次の練習へ'}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </>
      )}
    </section>
  );
}
