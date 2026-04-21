import { useEffect, useRef, useState } from 'react';
import TutorialChatUI, { type ChatMessage } from './TutorialChatUI';
import TutorialStepProgress, { type TutorialStep } from './TutorialStepProgress';
import { TUTORIAL_FOOTNOTE } from '../../lib/tutorial-scripts';
import { playStepSound, playCompleteSound } from '../../lib/tutorialSound';

interface Chapter7ProofreadProps {
  onComplete: () => void;
  onMascot: (state: 'idle' | 'talk' | 'happy', message: string, hint?: string) => void;
}

type Phase = 'chat' | 'generating' | 'done';

const STEPS: TutorialStep[] = [
  { label: '原文を解析中...', duration: 400 },
  { label: '敬語・表現を校正中...', duration: 600 },
  { label: '修正差分を生成中...', duration: 500 },
  { label: 'Gmail 下書きに流し込み中...', duration: 500 },
];

const SUGGESTIONS = [
  'この謝罪メールを敬語で校正して',
  '送付メールの文面、直して欲しい',
  '丁寧なビジネスメールに直して',
];

const ORIGINAL = `お疲れ様です。
先ほどの件ですが、ちょっと確認します。
見積書も間に合うと思いますので、少々お待ちください。
あと振込先ですが、前と同じで大丈夫です。
よろしく。`;

const REVISED = `いつもお世話になっております。
先ほどの件につきまして、至急確認のうえ折り返しご連絡いたします。
お見積書につきましても、ご指定の期日までにお届けできる見込みでございます。
今しばらくお待ちいただけますと幸いです。
なお、お振込先につきましては、前回と同様でお願いいたします。
どうぞよろしくお願い申し上げます。`;

interface DiffChange {
  before: string;
  after: string;
  reason: string;
}

const CHANGES: DiffChange[] = [
  {
    before: 'お疲れ様です。',
    after: 'いつもお世話になっております。',
    reason: '社外宛の冒頭挨拶としては「お世話になっております」が標準。',
  },
  {
    before: 'ちょっと確認します。',
    after: '至急確認のうえ折り返しご連絡いたします。',
    reason: '口語を避け、行動と所要時間を明示。',
  },
  {
    before: '見積書も間に合うと思いますので',
    after: 'お見積書につきましても、ご指定の期日までにお届けできる見込みでございます',
    reason: '敬語形に統一、確度と提出期日を明示。',
  },
  {
    before: 'よろしく。',
    after: 'どうぞよろしくお願い申し上げます。',
    reason: '締め敬語として社外向けの丁寧形に変換。',
  },
];

function GmailIcon() {
  return (
    <svg
      className="w-4 h-4 text-rose-600"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <polyline points="3 7 12 13 21 7" />
    </svg>
  );
}

function DiffTable() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
        <p className="text-sm font-semibold text-slate-800">修正箇所（{CHANGES.length} 件）</p>
      </div>
      <div className="divide-y divide-slate-100">
        {CHANGES.map((c, i) => (
          <div key={i} className="px-4 py-3 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2">
                <p className="text-[10px] font-semibold text-rose-700 mb-0.5">修正前</p>
                <p className="text-sm text-slate-800 whitespace-pre-wrap">{c.before}</p>
              </div>
              <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2">
                <p className="text-[10px] font-semibold text-green-700 mb-0.5">修正後</p>
                <p className="text-sm text-slate-800 whitespace-pre-wrap">{c.after}</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">↳ 理由: {c.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function GmailDraftCard() {
  return (
    <div className="rounded-xl border border-rose-200 bg-white p-5 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <GmailIcon />
        <span className="text-sm font-semibold text-slate-900">Gmail 下書き</span>
        <span className="ml-auto inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
          送信直前
        </span>
      </div>
      <div className="space-y-1 text-sm">
        <p className="text-slate-500">
          <span className="font-semibold text-slate-700">To:</span>{' '}
          <span className="font-mono">tanaka@sample-shoji.co.jp</span>
        </p>
        <p className="text-slate-500">
          <span className="font-semibold text-slate-700">Subject:</span>{' '}
          見積書送付の件につきまして
        </p>
      </div>
      <pre className="font-mono text-[12px] text-slate-800 whitespace-pre-wrap bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5 leading-relaxed">
        {REVISED}
      </pre>
      <button
        type="button"
        disabled
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white opacity-80 cursor-not-allowed"
        title="チュートリアルでは実送信しません"
      >
        Gmail で開く（送信はあなたが判断）
      </button>
    </div>
  );
}

export default function Chapter7Proofread({ onComplete, onMascot }: Chapter7ProofreadProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [phase, setPhase] = useState<Phase>('chat');
  const idCounter = useRef(0);
  const announced = useRef(false);

  useEffect(() => {
    if (!announced.current) {
      announced.current = true;
      onMascot(
        'talk',
        '週末。\n休みの前に\nメールだけ片付けよ。\n\n文面、直してから\nGmail に流すね。',
        '下のチップで指示',
      );
    }
  }, [onMascot]);

  const nextId = () => {
    idCounter.current += 1;
    return `ch7-${idCounter.current}`;
  };

  const handleSend = (text: string) => {
    if (phase !== 'chat') return;
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: text }]);
    setIsTyping(true);

    window.setTimeout(() => {
      playStepSound();
      setPhase('generating');
      onMascot('talk', '敬語を整えて\n下書きに…\n流し込むね。');
      setIsTyping(false);
    }, 500);
  };

  const handleStepsComplete = () => {
    setPhase('done');
    playCompleteSound();
    onMascot(
      'happy',
      '校正して\nGmail の下書きまで\n準備したよ。\n\n送信は\nあなたの判断ね。',
    );
  };

  const showTrace = phase === 'generating' || phase === 'done';

  return (
    <section aria-labelledby="ch7-title" className="space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
          第 7 章 / 8 — 週末
        </p>
        <h2 id="ch7-title" className="mt-1 text-2xl font-bold text-slate-900">
          文書校正 + メール下書き
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          ラフなメール原文を渡すと、敬語を整えて Gmail 下書きまで用意します。送信可否はあなたが判断できます。
        </p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            原文（あなたの下書き）
          </span>
        </div>
        <pre className="font-mono text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
          {ORIGINAL}
        </pre>
      </div>

      <TutorialChatUI
        messages={messages}
        onSend={handleSend}
        suggestions={SUGGESTIONS}
        isTyping={isTyping}
        placeholder="例: この文面を敬語で校正して"
        disabled={phase !== 'chat'}
      />

      {showTrace && (
        <div className="flex gap-2">
          <img
            src="/tutorial/dachshund-idle.gif"
            alt="AI社員"
            className="w-6 h-6 rounded-full flex-shrink-0 mt-1"
          />
          <div className="flex-1">
            <TutorialStepProgress
              steps={STEPS}
              onComplete={handleStepsComplete}
              completed={phase === 'done'}
            />
          </div>
        </div>
      )}

      {phase === 'done' && (
        <>
          <DiffTable />
          <GmailDraftCard />
          <p className="text-[11px] text-slate-400 text-right">{TUTORIAL_FOOTNOTE}</p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onComplete}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              第 7 章を終える
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </>
      )}
    </section>
  );
}
