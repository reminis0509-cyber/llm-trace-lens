import { useEffect, useRef, useState } from 'react';
import TutorialChatUI, { type ChatMessage } from './TutorialChatUI';
import TutorialStepProgress, { type TutorialStep } from './TutorialStepProgress';
import { TUTORIAL_FOOTNOTE } from '../../lib/tutorial-scripts';
import { playStepSound } from '../../lib/tutorialSound';

interface Chapter3MinutesProps {
  onComplete: () => void;
  onMascot: (state: 'idle' | 'talk' | 'happy', message: string, hint?: string) => void;
}

type Phase = 'chat' | 'generating' | 'done';

const STEPS: TutorialStep[] = [
  { label: '音声メモを受信中...', duration: 400 },
  { label: '発言者を識別中...', duration: 600 },
  { label: '決定事項・ToDo を抽出中...', duration: 700 },
  { label: '議事録を整形中...', duration: 500 },
];

const SUGGESTIONS = [
  'メモを渡すから議事録にして',
  '録音から議事録を作って',
  '議事録のテンプレートで整理して',
];

// Sample raw memo text displayed inline so the user feels like they're
// "handing over" unstructured notes.
const RAW_MEMO = `4/20 定例ミーティング
参加: 田中、佐藤、鈴木
・売上は目標達成 前月比15%増
・新規案件 A社のシステム開発 来週提案
・佐藤さんが見積書作成担当
・鈴木さんは競合調査
・次回は来週金曜 同じ時間
・経費精算の締め切り 今月25日 忘れずに`;

interface MinutesSection {
  heading: string;
  items: string[];
}

const MINUTES: { header: string; sections: MinutesSection[] } = {
  header: '2026年4月20日（月）定例ミーティング 議事録',
  sections: [
    {
      heading: '1. 開催情報',
      items: ['日時: 2026年4月20日（月） 10:00 - 10:45', '参加者: 田中、佐藤、鈴木'],
    },
    {
      heading: '2. 報告事項',
      items: ['月次売上: 目標達成（前月比 +15%）'],
    },
    {
      heading: '3. 決定事項',
      items: [
        '新規案件（A社のシステム開発）— 来週中に提案',
        '次回ミーティング: 来週金曜 同時刻',
      ],
    },
    {
      heading: '4. ToDo / 担当',
      items: [
        '佐藤: A社向けの見積書を作成',
        '鈴木: 競合調査を実施',
        '全員: 経費精算の締め切り（4月25日）までに提出',
      ],
    },
    {
      heading: '5. 次回までの論点',
      items: ['A社提案内容の最終確認', '競合調査結果のレビュー'],
    },
    {
      heading: '6. 備考',
      items: ['経費精算の提出漏れがないよう、鈴木さんが前日リマインドを出す'],
    },
  ],
};

function MemoCard() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-2">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
          音声 / 走り書きメモ
        </span>
        <span className="text-xs text-slate-500">meeting-0420.txt</span>
      </div>
      <pre className="font-mono text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
        {RAW_MEMO}
      </pre>
    </div>
  );
}

function MinutesDocument() {
  return (
    <div className="rounded-xl border border-green-200 bg-green-50/60 p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-full border border-green-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-green-700">
          議事録（生成結果）
        </span>
      </div>
      <h3 className="text-base sm:text-lg font-bold text-slate-900">{MINUTES.header}</h3>
      <div className="space-y-3">
        {MINUTES.sections.map((sec) => (
          <div key={sec.heading} className="rounded-lg bg-white border border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900 mb-1.5">{sec.heading}</p>
            <ul className="space-y-1 text-sm text-slate-700">
              {sec.items.map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-slate-400 flex-shrink-0">•</span>
                  <span className="flex-1">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-400">{TUTORIAL_FOOTNOTE}</p>
    </div>
  );
}

export default function Chapter3Minutes({ onComplete, onMascot }: Chapter3MinutesProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [phase, setPhase] = useState<Phase>('chat');
  const idCounter = useRef(0);
  const announcedRef = useRef(false);

  useEffect(() => {
    if (!announcedRef.current) {
      announcedRef.current = true;
      onMascot(
        'talk',
        '火曜日。\n昨日の定例、録音あるでしょ？\n\nそれを渡すだけで…\n議事録にできるんだ。',
        '下のメモをそのまま渡してみて',
      );
    }
  }, [onMascot]);

  const nextId = () => {
    idCounter.current += 1;
    return `ch3-${idCounter.current}`;
  };

  const handleSend = (text: string) => {
    if (phase !== 'chat') return;
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: text }]);
    setIsTyping(true);

    window.setTimeout(() => {
      // Accept any send — Ch3's goal is "hand over raw memo → get structured doc".
      playStepSound();
      setPhase('generating');
      onMascot('talk', '発言者を分けて\n決定事項と ToDo に…\n整理するね。');
      setIsTyping(false);
    }, 500);
  };

  const handleStepsComplete = () => {
    setPhase('done');
    onMascot(
      'happy',
      '録音だけで\n議事録になった。\n\nToDo も…\n自動で拾ったよ。',
    );
  };

  const showTrace = phase === 'generating' || phase === 'done';

  return (
    <section aria-labelledby="ch3-title" className="space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
          第 3 章 / 8 — 火曜
        </p>
        <h2 id="ch3-title" className="mt-1 text-2xl font-bold text-slate-900">
          議事録を自動化 — 音声メモを構造化
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          昨日の定例の走り書きメモを AI 社員に渡すと、決定事項・ToDo・次回予定が分かれて整形されます。
        </p>
      </header>

      <MemoCard />

      <TutorialChatUI
        messages={messages}
        onSend={handleSend}
        suggestions={SUGGESTIONS}
        isTyping={isTyping}
        placeholder="例: このメモを議事録にして"
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
          <MinutesDocument />
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
