import { useEffect, useRef, useState } from 'react';
import TutorialChatUI, { type ChatMessage } from './TutorialChatUI';
import TutorialStepProgress, { type TutorialStep } from './TutorialStepProgress';
import { TUTORIAL_FOOTNOTE } from '../../lib/tutorial-scripts';
import { playStepSound, playCompleteSound } from '../../lib/tutorialSound';

interface Chapter6ResearchProps {
  onComplete: () => void;
  onMascot: (state: 'idle' | 'talk' | 'happy', message: string, hint?: string) => void;
}

type Phase = 'chat' | 'generating' | 'done';

// Wide Research emulates SSE iteration — each step represents one research
// round (query → fetch → synthesize).
const STEPS: TutorialStep[] = [
  { label: '検索クエリを組立中... (iter 1/5)', duration: 500 },
  { label: '国内 SaaS 市場のレポートを収集中... (iter 2/5)', duration: 700 },
  { label: '主要ベンダー 5 社の動向を整理中... (iter 3/5)', duration: 800 },
  { label: '日本市場の差別化要因を抽出中... (iter 4/5)', duration: 700 },
  { label: '出典付きレポートに統合中... (iter 5/5)', duration: 600 },
];

const SUGGESTIONS = [
  'SaaS 業界の 2026 年動向',
  '生成AI 国内スタートアップの資金調達',
  'インボイス制度の業界影響',
];

interface ReportSection {
  heading: string;
  body: string;
  sources: string[];
}

const REPORT: { title: string; summary: string; sections: ReportSection[] } = {
  title: '国内 SaaS 業界 2026 年動向レポート',
  summary:
    '国内 SaaS 市場は 2026 年も二桁成長を継続。AI 組込みの速さが競争軸となり、日本語特化・国内データ保管・インボイス対応が中小企業導入の鍵。',
  sections: [
    {
      heading: '1. 市場サイズ',
      body: '2026 年の国内 SaaS 市場は 1.6 兆円規模と推計。バーティカル SaaS（業種特化）の成長率が横断型を上回る傾向。',
      sources: ['矢野経済 国内SaaS市場 2026', '日経XTECH 業種特化SaaS調査'],
    },
    {
      heading: '2. 主要プレイヤー',
      body: 'freee / マネーフォワード / Sansan / ANDPAD / カオナビ。バックオフィス × AI の境界が急速に溶解中。',
      sources: ['各社 IR 2026 Q1', 'ITmedia SaaS カオスマップ'],
    },
    {
      heading: '3. 競争軸の変化',
      body: '単機能 → エージェント化。2024 年までは機能網羅の競争だったが、2026 年は「AI 社員化」の実装速度が評価指標に。',
      sources: ['日経ビジネス 2026-03 特集', '国内 VC SaaS 投資動向レポート'],
    },
    {
      heading: '4. 日本市場の差別化要因',
      body: '日本語 UI / 国内データ保管 / インボイス対応 / 商慣習適合（捺印・月末締めなど）。海外製品の逐次日本対応では追いつきづらい領域。',
      sources: ['経産省 DX 推進指標', 'IPA 日本市場向け SaaS 要件書'],
    },
    {
      heading: '5. 中小企業向けの示唆',
      body: '導入ハードルは価格より「現場が触れるか」。AI 社員のようなメタファー駆動 UI が、50 名規模以下で特に効果を発揮。',
      sources: ['中小企業白書 2026', 'JCCI 中小企業 DX 実態調査'],
    },
  ],
};

function LiveLog({ running }: { running: boolean }) {
  const lines = [
    '[iter 1] plan: 国内 SaaS 2026 + 中小企業',
    '[iter 1] fetch: yano-research.co.jp/market-saas-2026 (OK)',
    '[iter 2] fetch: xtech.nikkei.com/saas-vertical (OK)',
    '[iter 2] synth: 市場規模 / プレイヤー整理',
    '[iter 3] plan: 競争軸の時系列比較',
    '[iter 3] fetch: business.nikkei.com/ai-agent-2026 (OK)',
    '[iter 4] fetch: meti.go.jp/dx-indicator (OK)',
    '[iter 5] synth: 5 sections + 10 sources',
  ];
  return (
    <div className="rounded-lg bg-slate-900 text-emerald-300 font-mono text-[11px] px-4 py-3 max-h-40 overflow-y-auto">
      {lines.map((l, i) => (
        <p key={i} className="leading-relaxed whitespace-pre-wrap">{l}</p>
      ))}
      {running && (
        <p className="leading-relaxed animate-pulse">[iter 5] synth: finalizing...</p>
      )}
    </div>
  );
}

function ReportCard() {
  return (
    <div className="rounded-xl border border-green-200 bg-green-50/60 p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-green-700 uppercase">
            Wide Research レポート
          </p>
          <h3 className="mt-1 text-base sm:text-lg font-bold text-slate-900">{REPORT.title}</h3>
        </div>
        <span className="inline-flex items-center rounded-full border border-green-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold text-green-700 flex-shrink-0">
          5 iter · 10 sources
        </span>
      </div>
      <div className="rounded-lg bg-white border border-green-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900 mb-1">要約</p>
        <p className="text-sm text-slate-700 leading-relaxed">{REPORT.summary}</p>
      </div>
      <div className="space-y-3">
        {REPORT.sections.map((sec) => (
          <div key={sec.heading} className="rounded-lg bg-white border border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900 mb-1.5">{sec.heading}</p>
            <p className="text-sm text-slate-700 leading-relaxed mb-2">{sec.body}</p>
            <p className="text-[11px] text-slate-500">
              出典: {sec.sources.join(' / ')}
            </p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-400">{TUTORIAL_FOOTNOTE}</p>
    </div>
  );
}

export default function Chapter6Research({ onComplete, onMascot }: Chapter6ResearchProps) {
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
        '金曜日。\n来週の提案で\n業界動向を聞かれたら…\n\nボクに任せて。',
        '下のチップで 1 テーマ選ぶだけ',
      );
    }
  }, [onMascot]);

  const nextId = () => {
    idCounter.current += 1;
    return `ch6-${idCounter.current}`;
  };

  const handleSend = (text: string) => {
    if (phase !== 'chat') return;
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: text }]);
    setIsTyping(true);

    window.setTimeout(() => {
      playStepSound();
      setPhase('generating');
      onMascot('talk', '複数のソースを\n読んでいるよ…\n少し時間がかかる。');
      setIsTyping(false);
    }, 500);
  };

  const handleStepsComplete = () => {
    setPhase('done');
    playCompleteSound();
    onMascot(
      'happy',
      '出典付きの\nレポートになった。\n\n来週の提案、\nこのまま使えるよ。',
    );
  };

  const showTrace = phase === 'generating' || phase === 'done';

  return (
    <section aria-labelledby="ch6-title" className="space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
          第 6 章 / 8 — 金曜
        </p>
        <h2 id="ch6-title" className="mt-1 text-2xl font-bold text-slate-900">
          業界リサーチ — Wide Research
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          テーマを投げると、AI 社員が複数ソースを横断して出典付きレポートにまとめます。
        </p>
      </header>

      <TutorialChatUI
        messages={messages}
        onSend={handleSend}
        suggestions={SUGGESTIONS}
        isTyping={isTyping}
        placeholder="例: SaaS 業界の 2026 年動向"
        disabled={phase !== 'chat'}
      />

      {showTrace && (
        <div className="flex gap-2">
          <img
            src="/tutorial/dachshund-idle.gif"
            alt="AI社員"
            className="w-6 h-6 rounded-full flex-shrink-0 mt-1"
          />
          <div className="flex-1 space-y-3">
            <TutorialStepProgress
              steps={STEPS}
              onComplete={handleStepsComplete}
              completed={phase === 'done'}
            />
            <LiveLog running={phase === 'generating'} />
          </div>
        </div>
      )}

      {phase === 'done' && (
        <>
          <ReportCard />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onComplete}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              第 6 章を終える
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </>
      )}
    </section>
  );
}
