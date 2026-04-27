import { useEffect, useRef, useState } from 'react';
import TutorialChatUI, { type ChatMessage } from './TutorialChatUI';
import TutorialStepProgress, { type TutorialStep } from './TutorialStepProgress';
import JtcDocumentViewer, { JtcTitle, JtcMetaRow, JtcClose } from './JtcDocumentViewer';
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
  { label: '分析報告書を整形中...', duration: 500 },
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

/* ── Preview card (input) ────────────────────────────────────────── */

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
                <td className="py-2 px-4 font-mono tabular-nums text-slate-700">{row.month}</td>
                <td className="py-2 px-4 text-right font-mono tabular-nums text-slate-900">
                  {formatYen(row.revenue)}
                </td>
                <td
                  className={`py-2 px-4 text-right font-mono tabular-nums ${
                    row.delta > 0
                      ? 'text-green-600'
                      : row.delta < 0
                        ? 'text-rose-600'
                        : 'text-slate-400'
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

/* ── JTC 分析報告書 body (output) ────────────────────────────────── */

function BarChart() {
  const max = Math.max(...SHEET.map((r) => r.revenue));
  return (
    <div className="mt-2 border border-[#1a1a1a] bg-white">
      <div className="px-3 py-1.5 border-b border-[#1a1a1a] text-[11px] text-[#333] font-medium">
        グラフ 1  月次売上推移（単位: 円）
      </div>
      <div className="flex items-end gap-2 h-36 px-4 pt-3 pb-2">
        {SHEET.map((r) => {
          const pct = (r.revenue / max) * 100;
          return (
            <div key={r.month} className="flex flex-col items-center flex-1 min-w-0">
              <div className="w-full bg-[#1a1a1a]" style={{ height: `${pct}%` }} />
              <span className="mt-1 text-[9px] font-mono tabular-nums text-[#333]">
                {r.month.slice(5)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RankingTable() {
  const sorted = [...SHEET].sort((a, b) => b.revenue - a.revenue);
  return (
    <div className="mt-2 border border-[#1a1a1a]">
      <div className="grid grid-cols-[50px_1fr_120px] bg-[#f3f4f6] border-b border-[#1a1a1a] text-[11px] text-[#333]">
        <div className="px-2 py-1.5 text-center border-r border-[#333]">順位</div>
        <div className="px-2 py-1.5 border-r border-[#333]">対象月</div>
        <div className="px-2 py-1.5 text-right">売上</div>
      </div>
      {sorted.slice(0, 3).map((r, i) => (
        <div
          key={r.month}
          className="grid grid-cols-[50px_1fr_120px] text-[12px] border-b border-[#333] last:border-b-0"
        >
          <div className="px-2 py-1.5 text-center border-r border-[#333] font-mono">
            {i + 1}
          </div>
          <div className="px-2 py-1.5 border-r border-[#333] font-mono tabular-nums">{r.month}</div>
          <div className="px-2 py-1.5 text-right tabular-nums">{formatYen(r.revenue)}</div>
        </div>
      ))}
    </div>
  );
}

function AnalysisReportBody() {
  return (
    <>
      <JtcTitle label="売上データ分析報告書" tracking="normal" />
      <JtcMetaRow docNumber="REP-20260422-001" issuedOn="令和8年4月22日" />

      <div className="mt-4 text-[12px] text-[#333]">
        <span className="text-[#555]">対象データ: </span>
        <span>sales_2026.xlsx（2025年11月 〜 2026年4月、6 ヶ月分）</span>
      </div>

      <section className="mt-5">
        <p className="font-semibold text-[14px] mb-1.5 border-b border-[#1a1a1a] pb-1">
          1. 分析概要
        </p>
        <p className="pl-3 text-[13px] leading-relaxed">
          2025年11月から2026年4月までの月次売上は、2,800,000 円から 4,050,000 円へと推移した。
          期間全体で +44.6% の成長を記録し、直近 3 ヶ月は連続で前月比プラスとなっている。
        </p>
      </section>

      <section className="mt-5">
        <p className="font-semibold text-[14px] mb-1.5 border-b border-[#1a1a1a] pb-1">
          2. 月次推移
        </p>
        <div className="pl-3">
          <BarChart />
          <div className="mt-3 border border-[#1a1a1a]">
            <div className="grid grid-cols-[110px_1fr_120px] bg-[#f3f4f6] border-b border-[#1a1a1a] text-[11px] text-[#333]">
              <div className="px-2 py-1.5 border-r border-[#333]">対象月</div>
              <div className="px-2 py-1.5 text-right border-r border-[#333]">売上</div>
              <div className="px-2 py-1.5 text-right">前月比</div>
            </div>
            {SHEET.map((r) => (
              <div
                key={r.month}
                className="grid grid-cols-[110px_1fr_120px] text-[12px] border-b border-[#333] last:border-b-0"
              >
                <div className="px-2 py-1.5 border-r border-[#333] font-mono tabular-nums">
                  {r.month}
                </div>
                <div className="px-2 py-1.5 text-right border-r border-[#333] tabular-nums">
                  {formatYen(r.revenue)}
                </div>
                <div className="px-2 py-1.5 text-right tabular-nums">
                  {r.delta === 0
                    ? '—'
                    : `${r.delta > 0 ? '+' : ''}${r.delta.toFixed(1)}%`}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-5">
        <p className="font-semibold text-[14px] mb-1.5 border-b border-[#1a1a1a] pb-1">
          3. 売上上位月ランキング
        </p>
        <div className="pl-3">
          <RankingTable />
        </div>
      </section>

      <section className="mt-5">
        <p className="font-semibold text-[14px] mb-1.5 border-b border-[#1a1a1a] pb-1">
          4. 所見
        </p>
        <ol className="pl-5 space-y-1.5 text-[13px] list-decimal">
          <li>
            最高の伸び率は 2026 年 4 月（前月比 +15.7%）、最低は 2026 年 1 月（-4.8%）。
          </li>
          <li>
            12 月と 4 月に大きな伸びが集中しており、季節性要因が認められる。
          </li>
          <li>
            年始の反動減を除けば、期間を通して増収基調にある。
          </li>
        </ol>
      </section>

      <section className="mt-5">
        <p className="font-semibold text-[14px] mb-1.5 border-b border-[#1a1a1a] pb-1">
          5. 提案アクション
        </p>
        <ol className="pl-5 space-y-1.5 text-[13px] list-decimal">
          <li>
            12 月・4 月の伸びを再現するため、キャンペーン設計の再利用を検討する。
          </li>
          <li>
            1 月の反動減について、要因分析のうえ来期の平準化施策を立案する。
          </li>
          <li>
            直近 3 ヶ月のトレンドを踏まえ、次期計画の上方修正を検討する。
          </li>
        </ol>
      </section>

      <JtcClose />
    </>
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
      '分析報告書に\nまとめたよ。\n\n社内回覧に\nそのまま使える体裁だよ。',
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
          Excel ファイルを渡すと、おしごと AIがシートを読んで「分析報告書」の体裁でまとめます。
        </p>
      </header>

      <SheetPreview />

      {phase === 'idle' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">
              sales_2026.xlsx を おしごと AIに渡す
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
            alt="おしごと AI"
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
            kind="分析報告書"
            filename="売上分析報告書_20260422"
            caption="本書類は印刷を前提とした体裁で出力しています。"
          >
            <AnalysisReportBody />
          </JtcDocumentViewer>
          <p className="text-[11px] text-slate-400 text-right">{TUTORIAL_FOOTNOTE}</p>
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
