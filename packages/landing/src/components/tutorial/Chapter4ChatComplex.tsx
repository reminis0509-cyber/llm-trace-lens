import { useEffect, useRef, useState } from 'react';
import TutorialChatUI, { type ChatMessage } from './TutorialChatUI';
import TutorialStepProgress, { type TutorialStep } from './TutorialStepProgress';
import JtcDocumentViewer from './JtcDocumentViewer';
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
  { label: 'PowerPoint 体裁に整形中...', duration: 500 },
];

const SUGGESTIONS = [
  'FujiTrace の営業スライドを作って',
  '中小企業向けのサービス紹介スライド',
  '10 枚で提案資料お願い',
];

/* ───── Slide model — FujiTrace 自身の営業資料 ───────────────────── */

type SlideLayout = 'cover' | 'section' | 'bullets' | 'cta';

interface Slide {
  index: number;
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  bullets?: string[];
  footerRight?: string;
}

const DECK_TITLE = 'FujiTrace — 日本企業のためのAI社員プラットフォーム';

const SLIDES: Slide[] = [
  {
    index: 1,
    layout: 'cover',
    title: DECK_TITLE,
    subtitle: '中小企業のバックオフィスに、24時間働くAI社員を。',
    footerRight: '合同会社 Reminis  /  2026',
  },
  {
    index: 2,
    layout: 'bullets',
    eyebrow: '01  課題',
    title: '机上業務に追われる、日本の中小企業',
    bullets: [
      '見積書・請求書・議事録の作成に月 60 時間以上',
      '属人化した Excel 集計とリサーチ業務',
      '「DX したいが人が足りない」という現場の声',
    ],
  },
  {
    index: 3,
    layout: 'bullets',
    eyebrow: '02  ソリューション',
    title: 'AI社員が 3 カテゴリの仕事を代行',
    bullets: [
      '書類作成: 見積書 / 請求書 / 納品書 / 発注書 / 送付状',
      '分析・調査: Excel 分析 / 議事録 / Wide Research',
      '業務連携: Calendar / Gmail / Slack / freee 他',
    ],
  },
  {
    index: 4,
    layout: 'bullets',
    eyebrow: '03  主要機能 (1/3)',
    title: '書類作成 — 正式体裁で即出力',
    bullets: [
      '5 種類の基本書類を和文ビジネス様式で生成',
      '金額・税率・振込先をAIが自動検証',
      '議事録は印刷を前提とした JTC 体裁',
    ],
  },
  {
    index: 5,
    layout: 'bullets',
    eyebrow: '03  主要機能 (2/3)',
    title: '分析・調査 — 現場の時間を取り戻す',
    bullets: [
      'Excel を読ませて月次推移を言語化',
      'スライドを 1 行の指示から 10 枚構成で生成',
      'Wide Research で業界動向を出典付きでレポート化',
    ],
  },
  {
    index: 6,
    layout: 'bullets',
    eyebrow: '03  主要機能 (3/3)',
    title: '業務連携 — 9 つのコネクタ',
    bullets: [
      'Google Calendar / Gmail / Drive',
      'Slack / Microsoft Teams',
      'freee / マネーフォワード / Sansan / Notion',
    ],
  },
  {
    index: 7,
    layout: 'bullets',
    eyebrow: '04  差別化',
    title: '日本企業のための設計',
    bullets: [
      '国内リージョン保管 — 顧客データは海外に出ない',
      '商慣習適合 — 月末締め / 御中 / 捺印欄',
      '承認後実行 — 自動化しつつも判断は人が握る',
    ],
  },
  {
    index: 8,
    layout: 'bullets',
    eyebrow: '05  料金',
    title: '無料から始められる 5 プラン',
    bullets: [
      'Free: ¥0 / 月 — 個人の試用',
      'Pro: ¥3,000 / 月 — 中小企業の定番',
      'Max: ¥15,000 / 月 — チーム共有 / 利用回数無制限',
      'Enterprise: 年契約 — 商習慣・監査対応',
    ],
  },
  {
    index: 9,
    layout: 'bullets',
    eyebrow: '06  導入',
    title: '最短 1 日で使い始められる',
    bullets: [
      'Day 0: アカウント作成（無料）',
      'Day 1: 4 章チュートリアル完了',
      'Day 7: 定着支援ミーティング',
      'Day 30: 月次クロージングを AI 社員に任せる',
    ],
  },
  {
    index: 10,
    layout: 'cta',
    title: 'AI社員、雇いませんか。',
    subtitle: 'まずは無料で、月曜朝のブリーフィングから。',
    footerRight: 'fujitrace.jp',
  },
];

/* ─── Slide visual components ────────────────────────────────────── */

function SlideHeader({ eyebrow, index }: { eyebrow?: string; index: number }) {
  return (
    <div className="flex items-baseline justify-between text-[10px] text-[#666] font-mono tabular-nums">
      <span className="uppercase tracking-[0.2em]">{eyebrow ?? 'FujiTrace'}</span>
      <span>{String(index).padStart(2, '0')} / 10</span>
    </div>
  );
}

function SlideFooter({ right }: { right?: string }) {
  return (
    <div className="mt-auto pt-3 border-t border-[#1a1a1a] flex items-baseline justify-between text-[9px] text-[#666]">
      <span>FujiTrace — AI 社員プラットフォーム</span>
      <span className="font-mono">{right ?? '合同会社 Reminis'}</span>
    </div>
  );
}

function CoverSlide({ slide }: { slide: Slide }) {
  return (
    <>
      <SlideHeader eyebrow="COVER" index={slide.index} />
      <div className="flex-1 flex flex-col justify-center items-center text-center px-4">
        <div className="w-12 h-1 bg-[#1d3557] mb-5" aria-hidden="true" />
        <h3 className="text-[22px] sm:text-[26px] font-bold leading-snug text-[#1a1a1a] max-w-[80%]">
          {slide.title}
        </h3>
        {slide.subtitle && (
          <p className="mt-3 text-[12px] sm:text-[14px] text-[#444]">{slide.subtitle}</p>
        )}
      </div>
      <SlideFooter right={slide.footerRight} />
    </>
  );
}

function BulletSlide({ slide }: { slide: Slide }) {
  return (
    <>
      <SlideHeader eyebrow={slide.eyebrow} index={slide.index} />
      <div className="mt-3">
        <h3 className="text-[18px] sm:text-[20px] font-semibold text-[#1a1a1a] border-b border-[#1a1a1a] pb-1.5">
          {slide.title}
        </h3>
      </div>
      <ul className="mt-4 space-y-2.5">
        {(slide.bullets ?? []).map((b, i) => (
          <li key={i} className="flex items-baseline gap-2.5 text-[12px] sm:text-[13px]">
            <span
              className="inline-flex flex-shrink-0 items-center justify-center w-4 h-4 text-[10px] font-mono bg-[#1d3557] text-white rounded-sm"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <span className="flex-1 text-[#1a1a1a] leading-snug">{b}</span>
          </li>
        ))}
      </ul>
      <SlideFooter right={slide.footerRight} />
    </>
  );
}

function CtaSlide({ slide }: { slide: Slide }) {
  return (
    <>
      <SlideHeader eyebrow="CTA" index={slide.index} />
      <div className="flex-1 flex flex-col justify-center items-center text-center px-4">
        <h3 className="text-[24px] sm:text-[32px] font-bold text-[#1a1a1a] leading-snug">
          {slide.title}
        </h3>
        {slide.subtitle && (
          <p className="mt-4 text-[13px] sm:text-[15px] text-[#444]">{slide.subtitle}</p>
        )}
        <div className="mt-6 inline-flex items-center gap-2 px-4 py-1.5 border border-[#1a1a1a] text-[12px] tracking-[0.15em]">
          お問い合わせ: fujitrace.jp
        </div>
      </div>
      <SlideFooter right={slide.footerRight} />
    </>
  );
}

function SlideCanvas({ slide }: { slide: Slide }) {
  return (
    <div className="jtc-slide">
      {slide.layout === 'cover' && <CoverSlide slide={slide} />}
      {slide.layout === 'bullets' && <BulletSlide slide={slide} />}
      {slide.layout === 'cta' && <CtaSlide slide={slide} />}
      {slide.layout === 'section' && <BulletSlide slide={slide} />}
    </div>
  );
}

function SlideThumb({
  slide,
  active,
  onClick,
}: {
  slide: Slide;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`スライド ${slide.index} に切替`}
      className={`group text-left transition-colors ${
        active ? 'ring-2 ring-blue-500' : 'hover:ring-1 hover:ring-slate-300'
      } bg-white border border-slate-300 rounded-sm p-1.5 flex flex-col aspect-[16/9]`}
    >
      <span className="text-[7px] text-slate-400 font-mono tabular-nums">
        {slide.index}
      </span>
      <span className="text-[8px] font-semibold text-slate-700 mt-1 line-clamp-2 leading-tight">
        {slide.title}
      </span>
      <span className="mt-auto flex flex-col gap-0.5">
        {slide.bullets?.slice(0, 2).map((_, i) => (
          <span key={i} className="h-[2px] bg-slate-200" style={{ width: `${70 - i * 10}%` }} />
        ))}
      </span>
    </button>
  );
}

/* ─── Carousel + print target ───────────────────────────────────── */

function SlideDeckViewer() {
  const [idx, setIdx] = useState(0);
  const active = SLIDES[idx];

  return (
    <JtcDocumentViewer
      kind="営業スライド"
      filename="FujiTrace_営業資料_10枚"
      caption={`${SLIDES.length} 枚構成 / 16:9 / PowerPoint 体裁`}
    >
      {/* When previewed: main slide + thumbnails.
          When printed: each slide becomes its own page via .jtc-slide-page. */}
      <div className="jtc-deck-preview">
        {/* Main slide — visible in preview, also part of the print flow. */}
        <div className="jtc-slide-page">
          <SlideCanvas slide={active} />
        </div>

        {/* Thumbnails — hidden from print via .jtc-ui */}
        <div className="jtc-ui mt-4 grid grid-cols-5 gap-2">
          {SLIDES.map((s, i) => (
            <SlideThumb
              key={s.index}
              slide={s}
              active={i === idx}
              onClick={() => setIdx(i)}
            />
          ))}
        </div>

        {/* Prev/next controls — hidden from print */}
        <div className="jtc-ui mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIdx((v) => Math.max(0, v - 1))}
            disabled={idx === 0}
            className="px-3 py-1.5 text-xs rounded border border-slate-300 text-slate-700 disabled:opacity-40"
          >
            ← 前へ
          </button>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {idx + 1} / {SLIDES.length}
          </span>
          <button
            type="button"
            onClick={() => setIdx((v) => Math.min(SLIDES.length - 1, v + 1))}
            disabled={idx === SLIDES.length - 1}
            className="px-3 py-1.5 text-xs rounded border border-slate-300 text-slate-700 disabled:opacity-40"
          >
            次へ →
          </button>
        </div>

        {/* Print-only: the remaining slides. Hidden in preview, visible in print. */}
        <div className="jtc-print-only-slides">
          {SLIDES.map((s, i) =>
            i === idx ? null : (
              <div key={s.index} className="jtc-slide-page">
                <SlideCanvas slide={s} />
              </div>
            ),
          )}
        </div>
      </div>
    </JtcDocumentViewer>
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
        '水曜日。\nFujiTrace の営業資料を\n作ってみよう。\n\n実際の提案にも\n使える内容だよ。',
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
      '10 枚できたよ。\n\nプレビューで\n順番に確認して、\n必要ならそのまま\nPDF 保存してね。',
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
          営業資料をスライドに — FujiTrace 提案 10 枚
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          1 行の指示で、FujiTrace を顧客に提案するためのスライド一式を生成します。
          明日の商談でそのまま使える体裁です。
        </p>
      </header>

      <TutorialChatUI
        messages={messages}
        onSend={handleSend}
        suggestions={SUGGESTIONS}
        isTyping={isTyping}
        placeholder="例: FujiTrace の営業スライドを作って"
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
          <SlideDeckViewer />
          <p className="text-[11px] text-slate-400 text-right">{TUTORIAL_FOOTNOTE}</p>
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
