import { useState } from 'react';
import TutorialStepProgress, { type TutorialStep } from './TutorialStepProgress';

interface Chapter1ButtonProps {
  onComplete: () => void;
  onMascot: (state: 'idle' | 'talk' | 'happy', message: string, hint?: string) => void;
}

type Phase = 'waiting' | 'working' | 'done';

const STEPS: TutorialStep[] = [
  { label: 'Google Calendar から予定を取得中...', duration: 500 },
  { label: 'Gmail の未読タスクを抽出中...', duration: 700 },
  { label: '朝のブリーフィングを整理中...', duration: 600 },
];

interface BriefingEvent {
  time: string;
  title: string;
  participants: string;
  note?: string;
}

interface BriefingTask {
  priority: 'high' | 'mid' | 'low';
  title: string;
  source: string;
}

// Typical Japanese SME salesperson Monday morning.
// 3 meetings, 3 tasks — visually compact, time-first layout.
const EVENTS: BriefingEvent[] = [
  {
    time: '10:00',
    title: '株式会社サンプル商事 定例',
    participants: '田中部長 / 佐藤様',
    note: '前回: 見積書の再提出依頼あり',
  },
  {
    time: '13:30',
    title: '社内プロダクトレビュー',
    participants: '田中 / 鈴木 / 加藤',
  },
  {
    time: '16:00',
    title: '株式会社ABC 新規問合せ',
    participants: '先方 3 名',
    note: '初回ヒアリング。提案資料は仮でも可',
  },
];

const TASKS: BriefingTask[] = [
  {
    priority: 'high',
    title: '株式会社サンプル商事 御中 見積書を再提出',
    source: 'Gmail 4/18 17:42',
  },
  {
    priority: 'mid',
    title: '株式会社ABC の事前調査',
    source: 'Calendar 備考欄',
  },
  {
    priority: 'low',
    title: '経費精算（締切 4/25）',
    source: 'Gmail リマインダー',
  },
];

const COMPLETED: string[] = [
  '週次レポートを佐藤部長に送信',
  'freee 仕訳 先週分を承認',
];

const PENDING: string[] = ['取引先 山田商店から返信待ち（見積条件の合意）'];

function PriorityBadge({ priority }: { priority: BriefingTask['priority'] }) {
  const styles: Record<BriefingTask['priority'], string> = {
    high: 'bg-rose-50 text-rose-700 border-rose-200',
    mid: 'bg-amber-50 text-amber-700 border-amber-200',
    low: 'bg-slate-50 text-slate-600 border-slate-200',
  };
  const labels: Record<BriefingTask['priority'], string> = {
    high: '最優先',
    mid: '今日中',
    low: '余裕時',
  };
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${styles[priority]}`}
    >
      {labels[priority]}
    </span>
  );
}

function SectionHeading({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-baseline gap-2 mb-2">
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      {typeof count === 'number' && (
        <span className="text-[11px] text-slate-500 tabular-nums">{count} 件</span>
      )}
    </div>
  );
}

export default function Chapter1Button({ onComplete, onMascot }: Chapter1ButtonProps) {
  const [phase, setPhase] = useState<Phase>('waiting');

  const handleStart = () => {
    if (phase !== 'waiting') return;
    setPhase('working');
    onMascot('talk', 'おはよう。\n予定とタスクを…\nまとめてくるね。');
  };

  const handleStepsComplete = () => {
    setPhase('done');
    onMascot(
      'happy',
      '今日はこんな一日。\n見積書の再提出が\n最優先みたいだよ。',
    );
  };

  return (
    <section aria-labelledby="ch1-title" className="space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
          第 1 章 / 8 — 月曜朝
        </p>
        <h2 id="ch1-title" className="mt-1 text-2xl font-bold text-slate-900">
          初出社 — 今日の予定をAI社員に聞く
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          ボタンを押すと、AI 社員が Calendar と Gmail を見てから「今日やるべきこと」を 1 画面にまとめてくれます。
        </p>
      </header>

      {phase === 'waiting' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-5">
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700 space-y-1.5">
            <p>
              <span className="font-semibold text-slate-900">朝のブリーフィング</span>{' '}
              は、Google Calendar の予定と Gmail の未読メールから、
              今日こなすべきタスクを自動で整理する機能です。
            </p>
            <p className="text-xs text-slate-500">
              ※このチュートリアルでは、サンプルデータを使って動作を再現しています。
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleStart}
              aria-label="今日のブリーフィングを聞く"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-8 py-3 text-base font-semibold text-white hover:bg-blue-700 shadow-sm"
            >
              今日のブリーフィングを聞く
            </button>
            <p className="text-xs text-slate-500">所要時間: 約 2 秒</p>
          </div>
        </div>
      )}

      {(phase === 'working' || phase === 'done') && (
        <TutorialStepProgress
          steps={STEPS}
          onComplete={handleStepsComplete}
          completed={phase === 'done'}
        />
      )}

      {phase === 'done' && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            {/* Top bar — date / source badge */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div>
                <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
                  朝のブリーフィング
                </p>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  2026年4月20日（月）
                </h3>
              </div>
              <span className="inline-flex items-center rounded-md bg-slate-50 border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                Calendar + Gmail
              </span>
            </div>

            {/* 1. Today's schedule — time-first layout */}
            <section aria-labelledby="ch1-events" className="mb-5">
              <SectionHeading title="今日の予定" count={EVENTS.length} />
              <ul className="divide-y divide-slate-100 border-y border-slate-100">
                {EVENTS.map((ev) => (
                  <li key={ev.time} className="flex items-start gap-4 py-2.5">
                    <span className="flex-shrink-0 w-14 pt-0.5 text-sm font-mono tabular-nums text-slate-700">
                      {ev.time}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {ev.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {ev.participants}
                        {ev.note ? ` ・ ${ev.note}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* 2. Today's tasks — priority + source */}
            <section aria-labelledby="ch1-tasks" className="mb-5">
              <SectionHeading title="今日のタスク（優先順）" count={TASKS.length} />
              <ul className="divide-y divide-slate-100 border-y border-slate-100">
                {TASKS.map((t) => (
                  <li key={t.title} className="flex items-start gap-3 py-2.5">
                    <PriorityBadge priority={t.priority} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900">{t.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        出所: {t.source}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* 3. Yesterday done — collapsible-feel compact list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <section aria-labelledby="ch1-done">
                <SectionHeading title="昨日完了" count={COMPLETED.length} />
                <ul className="space-y-1">
                  {COMPLETED.map((c) => (
                    <li key={c} className="flex items-start gap-2 text-[13px] text-slate-600">
                      <svg
                        className="w-3.5 h-3.5 text-green-600 flex-shrink-0 mt-0.5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="flex-1">{c}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* 4. Pending — someone else's ball */}
              <section aria-labelledby="ch1-pending">
                <SectionHeading title="保留中（相手待ち）" count={PENDING.length} />
                <ul className="space-y-1">
                  {PENDING.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-[13px] text-slate-600">
                      <span className="text-slate-400 font-bold flex-shrink-0">…</span>
                      <span className="flex-1">{p}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <p className="mt-5 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
              ※このチュートリアルでは関数で動いています
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onComplete}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              第 1 章を終える
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </>
      )}
    </section>
  );
}
