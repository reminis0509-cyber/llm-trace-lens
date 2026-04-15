import { useEffect, useRef, useState } from 'react';
import TutorialChatUI, { type ChatMessage } from './TutorialChatUI';
import PdfPreview from './PdfPreview';
import {
  matchIntent,
  getSimpleResponse,
  UNMATCHED_SIMPLE_MESSAGE,
  TUTORIAL_FOOTNOTE,
  PDF_PATHS,
  documentLabel,
  documentFilename,
  type DocumentKind,
} from '../../lib/tutorial-scripts';

interface Chapter2ChatIntroProps {
  onComplete: () => void;
  onMascot: (state: 'idle' | 'talk' | 'happy', message: string, hint?: string) => void;
}

const SUGGESTIONS = ['請求書作って', '見積書作って', '納品書お願い'];

export default function Chapter2ChatIntro({ onComplete, onMascot }: Chapter2ChatIntroProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
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
    if (revealedKind) return;
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
        setRevealedKind(match.kind);
        onMascot(
          'happy',
          `やったね！\n\n「${match.keyword}」って\n言ってくれたから\nボクが作ったよ。`,
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
      }
      setIsTyping(false);
    }, 900);
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

      {revealedKind && (
        <>
          <PdfPreview
            src={PDF_PATHS[revealedKind]}
            filename={documentFilename(revealedKind)}
            title={`${documentLabel(revealedKind)}（サンプル）`}
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
