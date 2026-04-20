import { useEffect, useRef, useState } from 'react';
import TutorialChatUI, { type ChatMessage } from './TutorialChatUI';
import PdfPreview from './PdfPreview';
import TutorialStepProgress, { type TutorialStep } from './TutorialStepProgress';
import {
  extractComplexPrompt,
  getComplexResponse,
  TUTORIAL_FOOTNOTE,
  documentLabel,
  type DocumentKind,
  type ComplexResponse,
} from '../../lib/tutorial-scripts';
import { playStepSound, playCompleteSound } from '../../lib/tutorialSound';

interface Chapter4ChatComplexProps {
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

type Phase = 'chat' | 'generating' | 'done';

function makeSteps(kind: DocumentKind | null): TutorialStep[] {
  const label = kind ? documentLabel(kind) : '書類';
  return [
    { label: '入力を解析中...', duration: 400 },
    { label: '会社名・金額を抽出中...', duration: 500 },
    { label: `${label}を生成中...`, duration: 600 },
    { label: '出力を検証中...', duration: 500 },
  ];
}

function DetectedSummary({ summary }: { summary: string }) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
      <p className="font-semibold mb-0.5">読み取った情報</p>
      <p className="font-mono tabular-nums">{summary}</p>
    </div>
  );
}

export default function Chapter4ChatComplex({ onComplete, onMascot }: Chapter4ChatComplexProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [phase, setPhase] = useState<Phase>('chat');
  const [pdf, setPdf] = useState<PdfState | null>(null);
  const [result, setResult] = useState<ComplexResponse | null>(null);
  const [extractedKind, setExtractedKind] = useState<DocumentKind | null>(null);
  const idCounter = useRef(0);
  const announced = useRef(false);

  useEffect(() => {
    if (!announced.current) {
      announced.current = true;
      onMascot(
        'talk',
        '最後は…\n難しいやつ。\n\nAIのすごさを\n見せるね。',
        '会社名・金額・書類の種類を 1 文で',
      );
    }
  }, [onMascot]);

  const nextId = () => {
    idCounter.current += 1;
    return `ch4-${idCounter.current}`;
  };

  const handleSend = (text: string) => {
    if (pdf || phase !== 'chat') return;
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: text }]);
    setIsTyping(true);

    const extracted = extractComplexPrompt(text);
    const complexResult = getComplexResponse(extracted);

    if (complexResult.pdfPath && complexResult.filename) {
      // Successful extraction — show trace
      window.setTimeout(() => {
        setIsTyping(false);
        setResult(complexResult);
        setExtractedKind(extracted.kind);
        setPhase('generating');
        onMascot('talk', '情報を読み取っているよ...');
      }, 500);
    } else {
      // No match — just show error message
      window.setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'assistant',
            content: complexResult.message,
            footnote: TUTORIAL_FOOTNOTE,
          },
        ]);
        playStepSound();
        setIsTyping(false);
      }, 500);
    }
  };

  const handleStepsComplete = () => {
    if (!result || !result.pdfPath || !result.filename) return;
    setPhase('done');
    setPdf({ src: result.pdfPath, filename: result.filename });
    playCompleteSound();
    if (result.detectedSummary) {
      onMascot(
        'happy',
        '読めた！\n\n金額と会社名を…\nちゃんと読み取って\n作ったよ。',
      );
    } else {
      onMascot('happy', '書類だけ用意したよ。\n金額や会社名を足すと…\nもっと詳しく反映できるよ。');
    }
  };

  const showTrace = (phase === 'generating' || phase === 'done') && result !== null;

  return (
    <section aria-labelledby="ch4-title" className="space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">第 4 章 / 4</p>
        <h2 id="ch4-title" className="mt-1 text-2xl font-bold text-slate-900">
          複雑な指示で AI の可能性を体感
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          「誰に」「いくらで」「何を」を 1 つの文で送ってみてください。会社名と金額を抽出して表示します。
        </p>
      </header>

      <TutorialChatUI
        messages={messages}
        onSend={handleSend}
        suggestions={SUGGESTIONS}
        isTyping={isTyping}
        placeholder="例: A社向けに月次保守料10万円で請求書作って"
        disabled={phase !== 'chat'}
      />

      {showTrace && result && (
        <div className="flex gap-2">
          <img
            src="/tutorial/dachshund-idle.gif"
            alt="AI社員"
            className="w-6 h-6 rounded-full flex-shrink-0 mt-1"
          />
          <div className="flex-1 space-y-3">
            <TutorialStepProgress
              steps={makeSteps(extractedKind)}
              onComplete={handleStepsComplete}
              completed={phase === 'done'}
            />
            {phase === 'done' && (
              <>
                {result.detectedSummary && (
                  <DetectedSummary summary={result.detectedSummary} />
                )}
                <div className="rounded-2xl rounded-bl-md bg-slate-100 text-slate-800 px-4 py-2.5">
                  <p className="text-sm leading-relaxed">{result.message}</p>
                  <p className="mt-1.5 text-xs text-slate-400">{TUTORIAL_FOOTNOTE}</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {pdf && (
        <>
          <PdfPreview src={pdf.src} filename={pdf.filename} title="生成された書類（サンプル）" />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onComplete}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              修了証へ
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </>
      )}
    </section>
  );
}
