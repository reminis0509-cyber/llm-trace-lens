import { useEffect, useRef, useState } from 'react';
import TutorialChatUI, { type ChatMessage } from './TutorialChatUI';
import PdfPreview from './PdfPreview';
import {
  extractComplexPrompt,
  getComplexResponse,
  TUTORIAL_FOOTNOTE,
} from '../../lib/tutorial-scripts';

interface Step3ChatComplexProps {
  onComplete: () => void;
  onMascot: (state: 'idle' | 'talk' | 'happy', message: string, hint?: string) => void;
}

const SUGGESTIONS = [
  'A社向けに月次保守料10万円で請求書作って',
  'サンプル商事様に¥300,000の見積書',
  'B商事へ発注書、サーバー機材20万円',
];

interface PdfState {
  src: string;
  filename: string;
}

function DetectedSummary({ summary }: { summary: string }) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
      <p className="font-semibold mb-0.5">ボクが読み取った情報</p>
      <p className="font-mono tabular-nums">{summary}</p>
    </div>
  );
}

export default function Step3ChatComplex({ onComplete, onMascot }: Step3ChatComplexProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [pdf, setPdf] = useState<PdfState | null>(null);
  const idCounter = useRef(0);
  const announced = useRef(false);

  useEffect(() => {
    if (!announced.current) {
      announced.current = true;
      onMascot(
        'talk',
        'じゃあ…\n難しいやつ。\n\n「A社向けに月次保守料10万円で\n請求書作って」\nって書いてみて！',
        '複雑な指示もAIは読み取れるんだ',
      );
    }
  }, [onMascot]);

  const nextId = () => {
    idCounter.current += 1;
    return `c${idCounter.current}`;
  };

  const handleSend = (text: string) => {
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: text }]);
    setIsTyping(true);

    const extracted = extractComplexPrompt(text);
    const result = getComplexResponse(extracted);

    // If we detected a summary, show it first as a quick "reading" beat,
    // then follow up with the main response + PDF.
    if (result.detectedSummary) {
      window.setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'assistant',
            content: '指示を読み取ってるよ...',
            extra: <DetectedSummary summary={result.detectedSummary as string} />,
          },
        ]);
      }, 700);

      window.setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'assistant',
            content: result.message,
            footnote: TUTORIAL_FOOTNOTE,
          },
        ]);
        if (result.pdfPath && result.filename) {
          setPdf({ src: result.pdfPath, filename: result.filename });
          onMascot(
            'happy',
            '読めた！\n\n金額と会社名を…\nちゃんと読み取って\n作ったよ。\n\n本物のAI事務員はね…\nもっと複雑な指示も\n聞き分けるんだ。',
          );
        }
        setIsTyping(false);
      }, 1600);
      return;
    }

    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'assistant',
          content: result.message,
          footnote: TUTORIAL_FOOTNOTE,
        },
      ]);
      if (result.pdfPath && result.filename) {
        setPdf({ src: result.pdfPath, filename: result.filename });
        onMascot('happy', '書類だけ用意したよ。金額や会社名を足すと、もっと詳しく反映できるよ。');
      }
      setIsTyping(false);
    }, 900);
  };

  return (
    <section aria-labelledby="step3-title" className="space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">Step 3 / 3</p>
        <h2 id="step3-title" className="mt-1 text-2xl font-bold text-slate-900">
          少し複雑な業務指示
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          「誰に」「いくらで」「何を」を1つの文で送ってみてください。会社名と金額を抽出して表示します。
        </p>
      </header>

      <TutorialChatUI
        messages={messages}
        onSend={handleSend}
        suggestions={SUGGESTIONS}
        isTyping={isTyping}
        placeholder="例: A社向けに月次保守料10万円で請求書作って"
      />

      {pdf && (
        <>
          <PdfPreview src={pdf.src} filename={pdf.filename} title="生成された書類（サンプル）" />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onComplete}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              仕上げへ
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </>
      )}
    </section>
  );
}
