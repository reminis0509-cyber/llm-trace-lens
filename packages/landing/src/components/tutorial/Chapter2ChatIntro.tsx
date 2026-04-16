import { useEffect, useRef, useState } from 'react';
import TutorialChatUI, { type ChatMessage } from './TutorialChatUI';
import PdfPreview from './PdfPreview';
import TutorialStepProgress, { type TutorialStep } from './TutorialStepProgress';
import {
  matchIntent,
  getSimpleResponse,
  UNMATCHED_SIMPLE_MESSAGE,
  TUTORIAL_FOOTNOTE,
  PDF_PATHS,
  PDF_SUMMARIES,
  documentLabel,
  documentFilename,
  type DocumentKind,
} from '../../lib/tutorial-scripts';
import { playStepSound } from '../../lib/tutorialSound';

interface Chapter2ChatIntroProps {
  onComplete: () => void;
  onMascot: (state: 'idle' | 'talk' | 'happy', message: string, hint?: string) => void;
}

const SUGGESTIONS = ['請求書作って', '見積書作って', '納品書お願い'];

const GENERATE_STEPS: TutorialStep[] = [
  { label: '指示を解析中...', duration: 400 },
  { label: '書類を生成中...', duration: 600 },
];

type Phase = 'chat' | 'generating' | 'done';

export default function Chapter2ChatIntro({ onComplete, onMascot }: Chapter2ChatIntroProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [phase, setPhase] = useState<Phase>('chat');
  const [revealedKind, setRevealedKind] = useState<DocumentKind | null>(null);
  const idCounter = useRef(0);
  const announced = useRef(false);

  useEffect(() => {
    if (!announced.current) {
      announced.current = true;
      onMascot(
        'talk',
        '次はチャット。\n\n「請求書作って」って…\n入れてみて！',
        '下のチップをタップするだけでOK',
      );
    }
  }, [onMascot]);

  const nextId = () => {
    idCounter.current += 1;
    return `ch2-${idCounter.current}`;
  };

  const handleSend = (text: string) => {
    if (revealedKind || phase !== 'chat') return;
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: text }]);
    setIsTyping(true);
    window.setTimeout(() => {
      const match = matchIntent(text);
      if (match) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'assistant',
            content: getSimpleResponse(match),
            footnote: TUTORIAL_FOOTNOTE,
          },
        ]);
        playStepSound();
        setRevealedKind(match.kind);
        setPhase('generating');
        onMascot(
          'talk',
          '書類を作っているよ。\nちょっと待ってね。',
        );
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'assistant',
            content: UNMATCHED_SIMPLE_MESSAGE,
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
    if (revealedKind) {
      const match = matchIntent(revealedKind);
      const keyword = match ? match.keyword : documentLabel(revealedKind);
      onMascot(
        'happy',
        `やったね！\n\n「${keyword}」って\n言ってくれたから\nボクが作ったよ。`,
      );
    }
  };

  return (
    <section aria-labelledby="ch2-title" className="space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">第 2 章 / 4</p>
        <h2 id="ch2-title" className="mt-1 text-2xl font-bold text-slate-900">
          チャットで指示してみる
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          書類の名前を含めて送信すると、ボクが対応する書類を用意するよ。
        </p>
      </header>

      <TutorialChatUI
        messages={messages}
        onSend={handleSend}
        suggestions={SUGGESTIONS}
        isTyping={isTyping}
        placeholder="例: 請求書作って"
        disabled={revealedKind !== null}
      />

      {phase === 'generating' && (
        <TutorialStepProgress steps={GENERATE_STEPS} onComplete={handleStepsComplete} />
      )}

      {phase === 'done' && revealedKind && (
        <>
          <PdfPreview
            src={PDF_PATHS[revealedKind]}
            filename={documentFilename(revealedKind)}
            title={`${documentLabel(revealedKind)}（サンプル）`}
            summary={PDF_SUMMARIES[revealedKind]}
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onComplete}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              第 2 章を終える
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </>
      )}
    </section>
  );
}
