import { useEffect, useRef, useState } from 'react';
import TutorialChatUI, { type ChatMessage } from './TutorialChatUI';
import TutorialStepProgress, { type TutorialStep } from './TutorialStepProgress';
import { TUTORIAL_FOOTNOTE } from '../../lib/tutorial-scripts';
import { playStepSound } from '../../lib/tutorialSound';

interface Chapter5ExcelAnalyzeProps {
  onComplete: () => void;
  onMascot: (state: 'idle' | 'talk' | 'happy', message: string, hint?: string) => void;
}

type Phase = 'idle' | 'asking' | 'generating' | 'done';

const STEPS: TutorialStep[] = [
  { label: 'sales_2026.xlsx を読込中...', duration: 500 },
  { label: '「月次推移」シートを解析中...', duration: 600 },
  { label: '月次トレンドを集計中...', duration: 700 },
  { label: 'インサイトを要約中...', duration: 500 },
];

const SUGGESTIONS = [
  '月次の売上推移を教えて',
  '前月比で伸びた月はどこ？',
  '注目すべき傾向を教えて',
];

interface SheetRow {
  month: string;
  revenue: number;
  delta: number;
}

const SHEET: SheetRow[] = [
  { month: '2025-11', revenue: 2_800_000, delta: 0 },
  { month: '2025-12', revenue: 3_100_000, delta: 10.7 },
  { month: '2026-01', revenue: 2_950_000, delta: -4.8 },
  { month: '2026-02', revenue: 3_300_000, delta: 11.9 },
  { month: '2026-03', revenue: 3_500_000, delta: 6.1 },
  { month: '2026-04', revenue: 4_050_000, delta: 15.7 },
];

const INSIGHTS: string[] = [
  '月次売上は 6 ヶ月で 2.8M → 4.05M（+44.6%）に成長。',
  '最高の伸びは 2026-04（前月比 +15.7%）、最低は 2026-01（-4.8%）。',
  '年始の反動減を除くと、直近 3 ヶ月は連続で前月比プラス。',
  '季節性: 12 月と 4 月に大きな伸び。キャンペーン設計の再現性あり。',
];

function SheetIcon() {
  return (
    <svg
      className="w-4 h-4 text-emerald-700"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  );
}

function formatYen(v: number): string {
  return `¥${v.toLocaleString('ja-JP')}`;
}

function SheetPreview() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
        <SheetIcon />
        <span className="text-sm font-semibold text-slate-800">sales_2026.xlsx</span>
        <span className="text-xs text-slate-500">— シート「月次推移」</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-slate-500 border-b border-slate-200 bg-slate-50">
              <th className="py-2 px-4">月</th>
              <th className="py-2 px-4 text-right">売上</th>
              <th className="py-2 px-4 text-right">前月比</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {SHEET.map((row) => (
              <tr key={row.month}>
                <td className="py-2 px-4 font-mono tabular-nums text-slate-700">
                  {row.month}
                </td>
                <td className="py-2 px-4 text-right font-mono tabular-nums text-slate-900">
                  {formatYen(row.revenue)}
                </td>
                <td
                  className={`py-2 px-4 text-right font-mono tabular-nums ${
                    row.delta > 0 ? 'text-green-600' : row.delta < 0 ? 'text-rose-600' : 'text-slate-400'
                  }`}
                >
                  {row.delta === 0 ? '—' : `${row.delta > 0 ? '+' : ''}${row.delta.toFixed(1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MiniBarChart() {
  const max = Math.max(...SHEET.map((r) => r.revenue));
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold text-slate-700 mb-3">月次推移（棒グラフ）</p>
      <div className="flex items-end gap-2 h-32">
        {SHEET.map((r) => {
          const pct = (r.revenue / max) * 100;
          return (
            <div key={r.month} className="flex flex-col items-center flex-1 min-w-0">
              <div
                className="w-full rounded-t bg-blue-500/80"
                style={{ height: `${pct}%` }}
                title={`${r.month}: ${formatYen(r.revenue)}`}
              />
              <span className="mt-1 text-[9px] font-mono tabular-nums text-slate-500 truncate">
                {r.month.slice(5)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InsightsCard() {
  return (
    <div className="rounded-xl border border-green-200 bg-green-50/60 p-5 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-full border border-green-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-green-700">
          AI が読み取ったインサイト
        </span>
      </div>
      <ul className="space-y-2">
        {INSIGHTS.map((line, i) => (
          <li key={i} className="flex gap-2 text-sm text-slate-800">
            <span className="text-green-600 font-bold flex-shrink-0">→</span>
            <span className="flex-1 leading-relaxed">{line}</span>
          </li>
        ))}
      </ul>
      <MiniBarChart />
      <p className="text-[11px] text-slate-400">{TUTORIAL_FOOTNOTE}</p>
    </div>
  );
}

export default function Chapter5ExcelAnalyze({
  onComplete,
  onMascot,
}: Chapter5ExcelAnalyzeProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const idCounter = useRef(0);
  const announced = useRef(false);

  useEffect(() => {
    if (!announced.current) {
      announced.current = true;
      onMascot(
        'talk',
        '木曜日。\n売上の Excel が\n上がってきたよ。\n\nボクに渡して\n質問してみて。',
        'まずは「アップロード済み」を確認',
      );
    }
  }, [onMascot]);

  const nextId = () => {
    idCounter.current += 1;
    return `ch5-${idCounter.current}`;
  };

  const handleUploadConfirm = () => {
    if (phase !== 'idle') return;
    setPhase('asking');
    onMascot('talk', 'Excel を読込んだよ。\nなんでも\n聞いてみて。');
  };

  const handleSend = (text: string) => {
    if (phase !== 'asking') return;
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: text }]);
    setIsTyping(true);

    window.setTimeout(() => {
      playStepSound();
      setPhase('generating');
      onMascot('talk', '集計しているよ...');
      setIsTyping(false);
    }, 500);
  };

  const handleStepsComplete = () => {
    setPhase('done');
    onMascot(
      'happy',
      'Excel を見て\n傾向を読み取れた。\n\n毎月の集計…\nもう全部任せよう。',
    );
  };

  const showTrace = phase === 'generating' || phase === 'done';

  return (
    <section aria-labelledby="ch5-title" className="space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
          第 5 章 / 8 — 木曜
        </p>
        <h2 id="ch5-title" className="mt-1 text-2xl font-bold text-slate-900">
          売上データを読ませる — Excel 分析
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Excel ファイルを渡すと、AI 社員がシートを読んで傾向やインサイトを答えます。
        </p>
      </header>

      <SheetPreview />

      {phase === 'idle' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">
              sales_2026.xlsx を AI 社員に渡す
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              実サービスではここで .xlsx をドラッグ＆ドロップできます。
            </p>
          </div>
          <button
            type="button"
            onClick={handleUploadConfirm}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            アップロード済みとして進む
          </button>
        </div>
      )}

      {phase !== 'idle' && (
        <TutorialChatUI
          messages={messages}
          onSend={handleSend}
          suggestions={SUGGESTIONS}
          isTyping={isTyping}
          placeholder="例: 月次の売上推移を教えて"
          disabled={phase !== 'asking'}
        />
      )}

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
          <InsightsCard />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onComplete}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              第 5 章を終える
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </>
      )}
    </section>
  );
}
