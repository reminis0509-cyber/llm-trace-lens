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

interface Step2ChatSimpleProps {
  onComplete: () => void;
  onMascot: (state: 'idle' | 'talk' | 'happy', message: string, hint?: string) => void;
}

const SUGGESTIONS = ['見積書作って', '請求書作って', '納品書お願い'];

export default function Step2ChatSimple({ onComplete, onMascot }: Step2ChatSimpleProps) {
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
        '次はチャット。「見積書作って」って入れてみて！',
        '下のチップをタップするだけでOK',
      );
    }
  }, [onMascot]);

  const nextId = () => {
    idCounter.current += 1;
    return `m${idCounter.current}`;
  };

  const handleSend = (text: string) => {
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
          `「${match.keyword}」って読み取ったよ！プレビューを確認してみてね。`,
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
    <section aria-labelledby="step2-title" className="space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">Step 2 / 3</p>
        <h2 id="step2-title" className="mt-1 text-2xl font-bold text-slate-900">
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
        placeholder="例: 見積書作って"
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
              次のステップへ
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </>
      )}
    </section>
  );
}
