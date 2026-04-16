import { useEffect, useRef, useState } from 'react';
import TutorialChatUI, { type ChatMessage } from './TutorialChatUI';
import PdfPreview from './PdfPreview';
import TutorialStepProgress, { type TutorialStep } from './TutorialStepProgress';
import {
  matchIntentForKind,
  TUTORIAL_FOOTNOTE,
  PDF_PATHS,
  PDF_SUMMARIES,
  documentFilename,
  documentLabel,
  type DocumentKind,
} from '../../lib/tutorial-scripts';
import { playStepSound } from '../../lib/tutorialSound';
import type { PracticeTaskId } from '../../lib/tutorial-progress';

interface Chapter3ChatPracticeProps {
  onComplete: () => void;
  onMascot: (state: 'idle' | 'talk' | 'happy', message: string, hint?: string) => void;
  initialCompletedTasks?: PracticeTaskId[];
  onTaskComplete?: (task: PracticeTaskId) => void;
}

const TASK_ID: PracticeTaskId = 'purchase_order';
const TASK_KIND: DocumentKind = 'purchase-order';
const SUGGESTIONS = ['発注書作って', '発注書出して', 'サーバー機材の発注書'];
const PLACEHOLDER = '例: 発注書作って';

const GENERATE_STEPS: TutorialStep[] = [
  { label: '指示を解析中...', duration: 400 },
  { label: '書類を生成中...', duration: 600 },
];

type Phase = 'chat' | 'generating' | 'done';

export default function Chapter3ChatPractice({
  onComplete,
  onMascot,
  initialCompletedTasks = [],
  onTaskComplete,
}: Chapter3ChatPracticeProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [phase, setPhase] = useState<Phase>('chat');
  const idCounter = useRef(0);
  const announcedRef = useRef(false);

  // If the single task was already completed in a previous session, skip to completion.
  const alreadyDone = initialCompletedTasks.includes(TASK_ID);

  useEffect(() => {
    if (alreadyDone) {
      onComplete();
      return;
    }
    if (!announcedRef.current) {
      announcedRef.current = true;
      onMascot('talk', '次は…\n発注書を出してみて。', 'チップから選んでOK');
    }
  }, [alreadyDone, onMascot, onComplete]);

  const nextId = () => {
    idCounter.current += 1;
    return `ch3-${idCounter.current}`;
  };

  const handleSend = (text: string) => {
    if (phase !== 'chat') return;
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: text }]);
    setIsTyping(true);

    window.setTimeout(() => {
      const match = matchIntentForKind(text, TASK_KIND);
      if (match) {
        const label = documentLabel(TASK_KIND);
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'assistant',
            content: `${label}のサンプルを用意したよ。下のプレビューを確認してね。`,
            footnote: TUTORIAL_FOOTNOTE,
          },
        ]);
        playStepSound();
        setPhase('generating');
        onMascot('talk', '書類を作っているよ。\nちょっと待ってね。');
        onTaskComplete?.(TASK_ID);
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
        playStepSound();
      }
      setIsTyping(false);
    }, 500);
  };

  const handleStepsComplete = () => {
    setPhase('done');
    onMascot('happy', 'いいね！もう慣れたね。\n\n次はちょっと\n難しいのに\n挑戦しよう。');
  };

  if (alreadyDone) return null;

  return (
    <section aria-labelledby="ch3-title" className="space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">第 3 章 / 4</p>
        <h2 id="ch3-title" className="mt-1 text-2xl font-bold text-slate-900">
          反復で経験値を積む
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          発注書を作ってみましょう。チャットで指示してね。
        </p>
      </header>

      <TutorialChatUI
        messages={messages}
        onSend={handleSend}
        suggestions={SUGGESTIONS}
        isTyping={isTyping}
        placeholder={PLACEHOLDER}
        disabled={phase !== 'chat'}
      />

      {phase === 'generating' && (
        <TutorialStepProgress steps={GENERATE_STEPS} onComplete={handleStepsComplete} />
      )}

      {phase === 'done' && (
        <>
          <PdfPreview
            src={PDF_PATHS[TASK_KIND]}
            filename={documentFilename(TASK_KIND)}
            title={`${documentLabel(TASK_KIND)}（サンプル）`}
            summary={PDF_SUMMARIES[TASK_KIND]}
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onComplete}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              第 3 章を終える
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </>
      )}
    </section>
  );
}
