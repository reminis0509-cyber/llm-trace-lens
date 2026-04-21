import { useEffect, useRef, useState } from 'react';
import TutorialChatUI, { type ChatMessage } from './TutorialChatUI';
import TutorialStepProgress, { type TutorialStep } from './TutorialStepProgress';
import { TUTORIAL_FOOTNOTE } from '../../lib/tutorial-scripts';
import { playStepSound, playCompleteSound } from '../../lib/tutorialSound';

interface Chapter4SlideBuilderProps {
  onComplete: () => void;
  onMascot: (state: 'idle' | 'talk' | 'happy', message: string, hint?: string) => void;
}

type Phase = 'chat' | 'generating' | 'done';

const STEPS: TutorialStep[] = [
  { label: 'テーマを解析中...', duration: 400 },
  { label: '構成（アジェンダ）を組立中...', duration: 700 },
  { label: '10 枚分のスライドを生成中...', duration: 800 },
  { label: 'Marp → HTML / PPTX 変換中...', duration: 500 },
];

const SUGGESTIONS = [
  '新サービス紹介のスライド 10 枚',
  '月次報告のスライド 5 枚作って',
  '営業向けにサービス紹介スライドを',
];

interface SlideSummary {
  index: number;
  title: string;
  bullets: string[];
}

const SLIDES: SlideSummary[] = [
  {
    index: 1,
    title: '表紙 — FujiTrace ご提案',
    bullets: ['日本企業のための AI 社員', '株式会社サンプル商事 御中'],
  },
  {
    index: 2,
    title: 'なぜ今 AI 社員か',
    bullets: ['人手不足の常態化', '書類業務の属人化', 'DX が止まる中小企業'],
  },
  {
    index: 3,
    title: '課題 — 事務作業の 3 大ペイン',
    bullets: ['書類ごとの手戻り', '議事録の書き起こし', 'Excel の手動集計'],
  },
  {
    index: 4,
    title: 'FujiTrace の解決策',
    bullets: ['AI 社員が書類・議事録・集計をまとめて担当', 'Gmail / Calendar と自動連携'],
  },
  {
    index: 5,
    title: '主要機能 (1/2)',
    bullets: ['書類作成 5 種', '議事録自動化', 'Wide Research で業界調査'],
  },
  {
    index: 6,
    title: '主要機能 (2/2)',
    bullets: ['スライド生成', 'Excel 分析', 'Gmail 下書き自動生成'],
  },
  {
    index: 7,
    title: '導入事例',
    bullets: ['株式会社A: 月次報告の作成時間を 1/5 に', '株式会社B: 議事録の属人化を解消'],
  },
  {
    index: 8,
    title: '料金プラン',
    bullets: ['Free / Pro ¥3,000 / Max ¥15,000', '利用回数 無制限 / チーム共有対応'],
  },
  {
    index: 9,
    title: '導入までの流れ',
    bullets: ['Day 0: アカウント作成', 'Day 1: チュートリアル', 'Day 7: 定着支援'],
  },
  {
    index: 10,
    title: 'まとめ — AI 社員、雇いませんか',
    bullets: ['月 ¥3,000 で始められる', 'まずは無料で 4 章チュートリアル'],
  },
];

function SlideCard({ slide }: { slide: SlideSummary }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 hover:border-blue-300 transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-[10px] font-bold tabular-nums text-slate-600">
          {slide.index}
        </span>
        <p className="text-sm font-semibold text-slate-900 flex-1 truncate">{slide.title}</p>
      </div>
      <ul className="mt-1.5 space-y-0.5 ml-7">
        {slide.bullets.map((b, i) => (
          <li key={i} className="text-[11px] text-slate-600 flex gap-1.5">
            <span className="text-slate-400">•</span>
            <span className="flex-1">{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export default function Chapter4SlideBuilder({
  onComplete,
  onMascot,
}: Chapter4SlideBuilderProps) {
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
        '水曜日。\n営業資料、\n急ぎで欲しいって…\n言われたでしょ？\n\n1 行で十分だよ。',
        '下のチップで OK',
      );
    }
  }, [onMascot]);

  const nextId = () => {
    idCounter.current += 1;
    return `ch4-${idCounter.current}`;
  };

  const handleSend = (text: string) => {
    if (phase !== 'chat') return;
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: text }]);
    setIsTyping(true);

    window.setTimeout(() => {
      playStepSound();
      setPhase('generating');
      onMascot('talk', '構成を組んで\nスライドに\nしているよ...');
      setIsTyping(false);
    }, 500);
  };

  const handleStepsComplete = () => {
    setPhase('done');
    playCompleteSound();
    onMascot(
      'happy',
      '1 行の指示で\n10 枚のスライドに\nなったね。\n\nPPTX で\n保存もできるよ。',
    );
  };

  const showTrace = phase === 'generating' || phase === 'done';

  return (
    <section aria-labelledby="ch4-title" className="space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
          第 4 章 / 8 — 水曜
        </p>
        <h2 id="ch4-title" className="mt-1 text-2xl font-bold text-slate-900">
          営業資料をスライドに — 1 行から 10 枚
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          「新サービス紹介のスライド 10 枚」と伝えるだけで、AI 社員が構成から作成まで全部やります。
        </p>
      </header>

      <TutorialChatUI
        messages={messages}
        onSend={handleSend}
        suggestions={SUGGESTIONS}
        isTyping={isTyping}
        placeholder="例: 新サービス紹介のスライド 10 枚"
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
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold tracking-wide text-green-700 uppercase">
                  生成されたスライド
                </p>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  新サービス紹介（10 枚構成）
                </h3>
              </div>
              <span className="inline-flex items-center rounded-full border border-green-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold text-green-700">
                Marp + PPTX
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SLIDES.map((s) => (
                <SlideCard key={s.index} slide={s} />
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-green-100">
              <button
                type="button"
                disabled
                className="inline-flex items-center justify-center gap-2 rounded-md bg-white border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 cursor-not-allowed"
                title="チュートリアルでは実ファイル出力を行いません"
              >
                <DownloadIcon />
                PPTX をダウンロード
              </button>
              <button
                type="button"
                disabled
                className="inline-flex items-center justify-center gap-2 rounded-md bg-white border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 cursor-not-allowed"
                title="チュートリアルでは実ファイル出力を行いません"
              >
                HTML プレビューを開く
              </button>
            </div>

            <p className="text-[11px] text-slate-400">{TUTORIAL_FOOTNOTE}</p>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onComplete}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              第 4 章を終える
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </>
      )}
    </section>
  );
}
