import { useEffect, useRef, useState } from 'react';
import TutorialChatUI, { type ChatMessage } from './TutorialChatUI';
import TutorialStepProgress, { type TutorialStep } from './TutorialStepProgress';
import { TUTORIAL_FOOTNOTE } from '../../lib/tutorial-scripts';
import { playStepSound, playCompleteSound } from '../../lib/tutorialSound';

interface Chapter8IntegrationProps {
  onComplete: () => void;
  onMascot: (state: 'idle' | 'talk' | 'happy', message: string, hint?: string) => void;
}

type Phase = 'chat' | 'generating' | 'done';

// 7 steps, each named after the underlying tool — this is the main visual
// "wow" of the chapter: the user sees one prompt fan out into 7 coordinated
// sub-tasks.
const STEPS: TutorialStep[] = [
  { label: 'Step 1 / 7  指示を解析 → 実行計画を立案', duration: 500 },
  { label: 'Step 2 / 7  freee 連携で A 社の過去取引を取得', duration: 700 },
  { label: 'Step 3 / 7  Projects に過去のやり取りを集約', duration: 600 },
  { label: 'Step 4 / 7  Wide Research で市場動向を追加収集', duration: 800 },
  { label: 'Step 5 / 7  サマリ資料（PDF 下書き）を生成', duration: 700 },
  { label: 'Step 6 / 7  Slide Builder で提案スライド 12 枚', duration: 700 },
  { label: 'Step 7 / 7  Gmail 下書き + Calendar に仮予定登録', duration: 500 },
];

const SUGGESTIONS = [
  '来週の A 社提案、過去取引を調べて、サマリと提案スライド 12 枚、メール下書きまで',
  '株式会社ABC 向けの提案一式を用意して（調査 + スライド + メール）',
  '火曜の顧客 MTG 準備を全部お願い（資料・議事録テンプレ・メール）',
];

interface Artifact {
  icon: string;
  title: string;
  detail: string;
  source: string;
}

const ARTIFACTS: Artifact[] = [
  {
    icon: '取引',
    title: 'A 社 過去取引サマリ',
    detail: '過去 12 ヶ月の受注 8 件・請求額 ¥12,450,000 を時系列に。',
    source: 'freee / Projects',
  },
  {
    icon: '調査',
    title: 'A 社業界レポート',
    detail: '国内 SaaS 業界動向 + A 社の競合 3 社との比較。5 iter / 10 sources。',
    source: 'Wide Research',
  },
  {
    icon: '資料',
    title: '提案サマリ PDF 下書き',
    detail: '1 ページ概要 + 3 ページ詳細。意思決定者向け要約形式。',
    source: 'Document',
  },
  {
    icon: 'Slide',
    title: '提案スライド 12 枚',
    detail: '表紙 / 課題 / 解決策 / 事例 / 価格 / 導入スケジュール / まとめ',
    source: 'Slide Builder',
  },
  {
    icon: 'Mail',
    title: 'Gmail 下書き',
    detail: '「来週火曜 14:00 〜 打合せのお願い」本文 + 資料 3 点を添付予定。',
    source: 'Gmail',
  },
  {
    icon: 'Cal',
    title: 'Calendar 仮予定',
    detail: '2026-04-28（火）14:00 - 15:00 先方と調整中ステータスで登録。',
    source: 'Google Calendar',
  },
];

function ArtifactCard({ a }: { a: Artifact }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-md bg-blue-50 border border-blue-200 text-[10px] font-bold text-blue-700">
          {a.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">{a.title}</p>
          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{a.detail}</p>
          <p className="text-[10px] text-slate-400 mt-1">↳ ソース: {a.source}</p>
        </div>
      </div>
    </div>
  );
}

export default function Chapter8Integration({
  onComplete,
  onMascot,
}: Chapter8IntegrationProps) {
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
        '最後は\n本気の複合タスク。\n\n一言で\n全部やるよ。\n\n見てて。',
        '下のチップで送信',
      );
    }
  }, [onMascot]);

  const nextId = () => {
    idCounter.current += 1;
    return `ch8-${idCounter.current}`;
  };

  const handleSend = (text: string) => {
    if (phase !== 'chat') return;
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: text }]);
    setIsTyping(true);

    window.setTimeout(() => {
      playStepSound();
      setPhase('generating');
      onMascot(
        'talk',
        'Plan → Execute → Review。\n7 ステップを\n自動で走らせる…\n見ててね。',
      );
      setIsTyping(false);
    }, 500);
  };

  const handleStepsComplete = () => {
    setPhase('done');
    playCompleteSound();
    onMascot(
      'happy',
      '全部できた。\n\n資料・調査・スライド・\nメール・予定、\n全部\n一言から。\n\nこれが\nAI 社員の\n真価だよ。',
    );
  };

  const showTrace = phase === 'generating' || phase === 'done';

  return (
    <section aria-labelledby="ch8-title" className="space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
          第 8 章 / 8 — 来週
        </p>
        <h2 id="ch8-title" className="mt-1 text-2xl font-bold text-slate-900">
          複合タスク — AI 社員の真価
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          一言の指示から、調査・要約・スライド・メール・予定登録まで、複数のツールを連携して完走します。
        </p>
      </header>

      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5">
        <p className="text-xs font-semibold text-amber-800 mb-1">この章の凄いところ</p>
        <p className="text-sm text-slate-800 leading-relaxed">
          これまでの 7 章で触った機能（書類 / 議事録 / スライド / Excel / Wide Research / Gmail / Calendar）を、
          AI 社員が自動で順番に呼び出します。あなたは最初の 1 文を書くだけ。
        </p>
      </div>

      <TutorialChatUI
        messages={messages}
        onSend={handleSend}
        suggestions={SUGGESTIONS}
        isTyping={isTyping}
        placeholder="例: 来週の A 社提案、過去取引を調べて一式準備して"
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
          <div className="rounded-xl border border-green-200 bg-green-50/60 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold tracking-wide text-green-700 uppercase">
                  完走しました
                </p>
                <h3 className="mt-1 text-base sm:text-lg font-bold text-slate-900">
                  A 社向け提案一式（{ARTIFACTS.length} 成果物）
                </h3>
              </div>
              <span className="inline-flex items-center rounded-full border border-green-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold text-green-700 flex-shrink-0">
                7 steps · 6 artifacts
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ARTIFACTS.map((a) => (
                <ArtifactCard key={a.title} a={a} />
              ))}
            </div>
            <p className="text-[11px] text-slate-400">{TUTORIAL_FOOTNOTE}</p>
          </div>

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
