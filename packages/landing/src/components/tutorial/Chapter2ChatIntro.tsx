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

const SUGGESTIONS = ['見積書作って', '請求書お願い', '発注書を作りたい'];

type Phase = 'chat' | 'generating' | 'done';

function makeSteps(kind: DocumentKind): TutorialStep[] {
  const label = documentLabel(kind);
  return [
    { label: '入力を解析中...', duration: 400 },
    { label: `${label}を生成中...`, duration: 600 },
    { label: '出力を検証中...', duration: 500 },
  ];
}

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
        'ブリーフィング通り、\nまずは見積書の再提出。\n\n「見積書作って」って\n送ってみて！',
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
    if (!revealedKind) return;
    setPhase('done');
    const match = matchIntent(revealedKind);
    const keyword = match ? match.keyword : documentLabel(revealedKind);
    onMascot(
      'happy',
      `やったね！\n\n「${keyword}」って\n言ってくれたから\nボクが作ったよ。`,
    );
  };

  const showTrace = phase === 'generating' || phase === 'done';

  return (
    <section aria-labelledby="ch2-title" className="space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
          第 2 章 / 8 — 月曜午後
        </p>
        <h2 id="ch2-title" className="mt-1 text-2xl font-bold text-slate-900">
          見積書をお願い — チャットで書類作成
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          書類の名前を含めてメッセージを送ると、AI 社員が該当書類を用意します。
        </p>
      </header>

      <TutorialChatUI
        messages={messages}
        onSend={handleSend}
        suggestions={SUGGESTIONS}
        isTyping={isTyping}
        placeholder="例: 見積書作って"
        disabled={revealedKind !== null}
      />

      {showTrace && revealedKind && (
        <div className="flex gap-2">
          <img
            src="/tutorial/dachshund-idle.gif"
            alt="AI社員"
            className="w-6 h-6 rounded-full flex-shrink-0 mt-1"
          />
          <div className="flex-1 space-y-3">
            <TutorialStepProgress
              steps={makeSteps(revealedKind)}
              onComplete={handleStepsComplete}
              completed={phase === 'done'}
            />
            {phase === 'done' && (
              <div className="rounded-2xl rounded-bl-md bg-slate-100 text-slate-800 px-4 py-2.5">
                <p className="text-sm leading-relaxed">
                  {getSimpleResponse({ kind: revealedKind, keyword: documentLabel(revealedKind) })}
                </p>
                <p className="mt-1.5 text-xs text-slate-400">{TUTORIAL_FOOTNOTE}</p>
              </div>
            )}
          </div>
        </div>
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
