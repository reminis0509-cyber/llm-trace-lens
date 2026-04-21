import { useEffect, useRef, useState } from 'react';
import TutorialChatUI, { type ChatMessage } from './TutorialChatUI';
import TutorialStepProgress, { type TutorialStep } from './TutorialStepProgress';
import JtcDocumentViewer, { JtcTitle, JtcMetaRow, JtcClose } from './JtcDocumentViewer';
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

const RAW_MEMO = `4/22 定例ミーティング
参加: 田中、佐藤、鈴木
・売上は目標達成 前月比15%増
・新規案件 A社のシステム開発 来週提案
・佐藤さんが見積書作成担当
・鈴木さんは競合調査
・次回は来週金曜 同じ時間
・経費精算の締め切り 今月25日 忘れずに`;

function MemoCard() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-2">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
          走り書きメモ
        </span>
        <span className="text-xs text-slate-500">meeting-0422.txt</span>
      </div>
      <pre className="font-mono text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
        {RAW_MEMO}
      </pre>
    </div>
  );
}

/* ── JTC Word-style 議事録 body ─────────────────────────────────── */

interface Participant {
  dept: string;
  name: string;
}

interface Todo {
  owner: string;
  content: string;
  deadline: string;
}

const PARTICIPANTS: Participant[] = [
  { dept: '営業部', name: '田中 太郎' },
  { dept: '開発部', name: '佐藤 花子' },
  { dept: '管理部', name: '鈴木 一郎' },
];

const DECISIONS: string[] = [
  '新規案件（A社のシステム開発）— 来週中に提案する。',
  '次回定例は来週金曜（4月29日）同時刻に開催する。',
];

const TODOS: Todo[] = [
  { owner: '佐藤', content: 'A社向け見積書を作成', deadline: '4月25日' },
  { owner: '鈴木', content: '競合調査を実施', deadline: '4月28日' },
  { owner: '田中', content: '経費精算を提出', deadline: '4月25日' },
];

const PENDING_ITEMS: string[] = [
  'A 社提案内容の最終確認',
  '競合調査結果のレビュー',
];

function MinutesBody() {
  return (
    <>
      <JtcTitle label="会議議事録" />
      <JtcMetaRow docNumber="MIN-20260422-001" issuedOn="令和8年4月22日" />

      <div className="mt-5 space-y-4 text-[13px] leading-relaxed">
        <section>
          <p className="font-semibold text-[14px] mb-1">1. 日時</p>
          <p className="pl-4">2026年4月22日（月） 10:00 〜 10:45</p>
        </section>

        <section>
          <p className="font-semibold text-[14px] mb-1">2. 場所</p>
          <p className="pl-4">本社 会議室A</p>
        </section>

        <section>
          <p className="font-semibold text-[14px] mb-1">3. 参加者</p>
          <ul className="pl-4 space-y-0.5">
            {PARTICIPANTS.map((p) => (
              <li key={p.name} className="grid grid-cols-[80px_1fr] gap-2">
                <span className="text-[#555]">{p.dept}</span>
                <span>{p.name}</span>
              </li>
            ))}
            <li className="text-[12px] text-[#555] mt-1">（敬称略）</li>
          </ul>
        </section>

        <section>
          <p className="font-semibold text-[14px] mb-1">4. 議題</p>
          <ol className="pl-4 space-y-0.5 list-decimal list-inside marker:text-[#555]">
            <li>月次売上報告</li>
            <li>新規案件（A社）について</li>
            <li>次回定例の日程調整</li>
          </ol>
        </section>

        <section>
          <p className="font-semibold text-[14px] mb-1">5. 決定事項</p>
          <ol className="pl-4 space-y-0.5 list-decimal list-inside marker:text-[#555]">
            {DECISIONS.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ol>
        </section>

        <section>
          <p className="font-semibold text-[14px] mb-1">6. 懸案事項 / ToDo</p>
          <div className="pl-4 border border-[#1a1a1a]">
            <div className="grid grid-cols-[80px_1fr_100px] bg-[#f3f4f6] border-b border-[#1a1a1a] text-[11px] text-[#333]">
              <div className="px-2 py-1.5 border-r border-[#333]">担当者</div>
              <div className="px-2 py-1.5 border-r border-[#333]">内容</div>
              <div className="px-2 py-1.5">期限</div>
            </div>
            {TODOS.map((t, i) => (
              <div
                key={i}
                className="grid grid-cols-[80px_1fr_100px] text-[12px] border-b border-[#333] last:border-b-0"
              >
                <div className="px-2 py-1.5 border-r border-[#333]">{t.owner}</div>
                <div className="px-2 py-1.5 border-r border-[#333]">{t.content}</div>
                <div className="px-2 py-1.5 tabular-nums">{t.deadline}</div>
              </div>
            ))}
          </div>
          <ul className="pl-4 mt-2 space-y-0.5 text-[12px] text-[#555]">
            {PENDING_ITEMS.map((p) => (
              <li key={p}>・ {p}</li>
            ))}
          </ul>
        </section>

        <section>
          <p className="font-semibold text-[14px] mb-1">7. 次回開催</p>
          <p className="pl-4">2026年4月29日（金） 10:00 〜</p>
        </section>
      </div>

      <JtcClose />
    </>
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
      'できたよ。\n印刷してそのまま\n社内回覧できる体裁だよ。',
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
          議事録を自動化 — 走り書きを正式書類に
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          昨日の定例の走り書きメモを AI 社員に渡すと、社内回覧に通用する議事録体裁で仕上がります。
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
          <JtcDocumentViewer
            kind="会議議事録"
            filename="議事録_20260422_定例"
            caption="本書類は印刷を前提とした体裁で出力しています。"
          >
            <MinutesBody />
          </JtcDocumentViewer>
          <p className="text-[11px] text-slate-400 text-right">{TUTORIAL_FOOTNOTE}</p>
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
