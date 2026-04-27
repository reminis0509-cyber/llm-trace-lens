import { useEffect, useRef, useState, type ReactNode } from 'react';
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
type SlideIcon =
  | 'building'
  | 'layers'
  | 'check'
  | 'shield'
  | 'coin'
  | 'calendar'
  | 'spark'
  | 'flag';

interface Slide {
  index: number;
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  bullets?: string[];
  footerRight?: string;
  /** Optional accent icon shown near the title. */
  icon?: SlideIcon;
  /** Optional highlight term shown as a gold chip in the corner. */
  highlight?: string;
}

const DECK_TITLE = 'FujiTrace — 日本企業のためのおしごと AIプラットフォーム';

const SLIDES: Slide[] = [
  {
    index: 1,
    layout: 'cover',
    title: DECK_TITLE,
    subtitle: '中小企業のバックオフィスに、24時間働くおしごと AIを。',
    footerRight: '合同会社 Reminis  /  2026',
    highlight: 'Proposal',
  },
  {
    index: 2,
    layout: 'bullets',
    eyebrow: '01  課題',
    title: '机上業務に追われる、日本の中小企業',
    icon: 'building',
    bullets: [
      '見積書・請求書・議事録の作成に月 60 時間以上',
      '属人化した Excel 集計とリサーチ業務',
      '「DX したいが人が足りない」という現場の声',
    ],
    highlight: 'Pain',
  },
  {
    index: 3,
    layout: 'bullets',
    eyebrow: '02  ソリューション',
    title: 'おしごと AIが 3 カテゴリの仕事を代行',
    icon: 'spark',
    bullets: [
      '書類作成: 見積書 / 請求書 / 納品書 / 発注書 / 送付状',
      '分析・調査: Excel 分析 / 議事録 / Wide Research',
      '業務連携: Calendar / Gmail / Slack / freee 他',
    ],
    highlight: 'Solution',
  },
  {
    index: 4,
    layout: 'bullets',
    eyebrow: '03  主要機能 (1/3)',
    title: '書類作成 — 正式体裁で即出力',
    icon: 'check',
    bullets: [
      '5 種類の基本書類を和文ビジネス様式で生成',
      '金額・税率・振込先をAIが自動検証',
      '議事録は印刷を前提とした JTC 体裁',
    ],
    highlight: 'Docs',
  },
  {
    index: 5,
    layout: 'bullets',
    eyebrow: '03  主要機能 (2/3)',
    title: '分析・調査 — 現場の時間を取り戻す',
    icon: 'layers',
    bullets: [
      'Excel を読ませて月次推移を言語化',
      'スライドを 1 行の指示から 10 枚構成で生成',
      'Wide Research で業界動向を出典付きでレポート化',
    ],
    highlight: 'Insight',
  },
  {
    index: 6,
    layout: 'bullets',
    eyebrow: '03  主要機能 (3/3)',
    title: '業務連携 — 9 つのコネクタ',
    icon: 'layers',
    bullets: [
      'Google Calendar / Gmail / Drive',
      'Slack / Microsoft Teams',
      'freee / マネーフォワード / Sansan / Notion',
    ],
    highlight: 'Connect',
  },
  {
    index: 7,
    layout: 'bullets',
    eyebrow: '04  差別化',
    title: '日本企業のための設計',
    icon: 'shield',
    bullets: [
      '国内リージョン保管 — 顧客データは海外に出ない',
      '商慣習適合 — 月末締め / 御中 / 捺印欄',
      '承認後実行 — 自動化しつつも判断は人が握る',
    ],
    highlight: 'Japan',
  },
  {
    index: 8,
    layout: 'bullets',
    eyebrow: '05  料金',
    title: '無料から始められる 5 プラン',
    icon: 'coin',
    bullets: [
      'Free: ¥0 / 月 — 個人の試用',
      'Pro: ¥3,000 / 月 — 中小企業の定番',
      'Max: ¥15,000 / 月 — チーム共有 / 利用回数無制限',
      'Enterprise: 年契約 — 商習慣・監査対応',
    ],
    highlight: 'Pricing',
  },
  {
    index: 9,
    layout: 'bullets',
    eyebrow: '06  導入',
    title: '最短 1 日で使い始められる',
    icon: 'calendar',
    bullets: [
      'Day 0: アカウント作成（無料）',
      'Day 1: 4 章チュートリアル完了',
      'Day 7: 定着支援ミーティング',
      'Day 30: 月次クロージングを おしごと AIに任せる',
    ],
    highlight: 'Onboard',
  },
  {
    index: 10,
    layout: 'cta',
    title: 'おしごと AI、雇いませんか。',
    subtitle: 'まずは無料で、月曜朝のブリーフィングから。',
    footerRight: 'fujitrace.jp',
    icon: 'flag',
    highlight: 'Next Step',
  },
];

/* ─── Inline icon set (avoids lucide-react dependency) ──────────── */

interface IconProps {
  className?: string;
}

function SlideIconSvg({ name, className }: { name: SlideIcon; className?: string }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className,
  };
  switch (name) {
    case 'building':
      return (
        <svg {...common}>
          <rect x="4" y="3" width="16" height="18" rx="1" />
          <path d="M8 7h2M8 11h2M8 15h2M14 7h2M14 11h2M14 15h2" />
        </svg>
      );
    case 'layers':
      return (
        <svg {...common}>
          <path d="M12 3 3 8l9 5 9-5-9-5Z" />
          <path d="m3 13 9 5 9-5" />
          <path d="m3 18 9 5 9-5" />
        </svg>
      );
    case 'check':
      return (
        <svg {...common}>
          <path d="M5 12l4 4L19 7" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 3 5 6v6c0 4.5 3 8 7 9 4-1 7-4.5 7-9V6l-7-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case 'coin':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7v10M9 9.5c0-1 1-2 3-2s3 1 3 2-1 1.5-3 2-3 1-3 2 1 2 3 2 3-1 3-2" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="1.5" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      );
    case 'spark':
      return (
        <svg {...common}>
          <path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3" />
        </svg>
      );
    case 'flag':
      return (
        <svg {...common}>
          <path d="M5 3v18" />
          <path d="M5 4h11l-2 4 2 4H5" />
        </svg>
      );
  }
}

function CornerDots({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="currentColor"
      aria-hidden="true"
    >
      {[0, 1, 2, 3, 4].map((row) =>
        [0, 1, 2, 3, 4].map((col) => (
          <circle key={`${row}-${col}`} cx={4 + col * 8} cy={4 + row * 8} r="1" />
        )),
      )}
    </svg>
  );
}

/* ─── Slide visual components ────────────────────────────────────── */

function SlideShell({
  slide,
  children,
}: {
  slide: Slide;
  children: ReactNode;
}) {
  return (
    <div
      className="jtc-slide-v2 relative flex flex-col"
      style={{ color: '#ffffff' }}
    >
      {/* Gold accent line — top-left */}
      <div className="jtc-slide-v2-accent-line" aria-hidden="true" />
      {/* Dot pattern — top-right */}
      <CornerDots className="jtc-slide-v2-dots" />

      {/* Header: eyebrow + index */}
      <div className="flex items-baseline justify-between text-[10px] font-mono tabular-nums" style={{ color: '#d9c79a' }}>
        <span className="uppercase tracking-[0.3em]">
          {slide.eyebrow ?? (slide.layout === 'cover' ? 'Cover' : 'FujiTrace')}
        </span>
        <span style={{ color: '#9fb1c4' }}>
          {String(slide.index).padStart(2, '0')} / 10
        </span>
      </div>

      {children}

      {/* Footer */}
      <div className="mt-auto pt-3 border-t border-[#2b4566] flex items-baseline justify-between text-[9px]" style={{ color: '#9fb1c4' }}>
        <span className="tracking-wider">FujiTrace — おしごと AIプラットフォーム</span>
        <span className="font-mono">{slide.footerRight ?? '合同会社 Reminis'}</span>
      </div>
    </div>
  );
}

function HighlightChip({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 border border-[#c9a96e] text-[9px] font-mono uppercase tracking-[0.25em]"
      style={{ color: '#c9a96e' }}
    >
      {label}
    </span>
  );
}

function CoverSlide({ slide }: { slide: Slide }) {
  return (
    <SlideShell slide={slide}>
      <div className="flex-1 flex flex-col justify-center items-center text-center px-4">
        {slide.highlight && <HighlightChip label={slide.highlight} />}
        <div className="w-14 h-[2px] bg-[#c9a96e] mt-5 mb-5" aria-hidden="true" />
        <h3
          className="text-[22px] sm:text-[28px] font-bold leading-snug max-w-[86%]"
          style={{ color: '#ffffff' }}
        >
          {slide.title}
        </h3>
        {slide.subtitle && (
          <p
            className="mt-4 text-[12px] sm:text-[14px] max-w-[70%] leading-relaxed"
            style={{ color: '#c6d3e4' }}
          >
            {slide.subtitle}
          </p>
        )}
      </div>
    </SlideShell>
  );
}

function BulletSlide({ slide }: { slide: Slide }) {
  return (
    <SlideShell slide={slide}>
      <div className="mt-3 flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          {slide.icon && (
            <span
              className="inline-flex items-center justify-center w-8 h-8 rounded-sm border border-[#c9a96e]"
              style={{ color: '#c9a96e' }}
            >
              <SlideIconSvg name={slide.icon} className="w-4 h-4" />
            </span>
          )}
          <h3
            className="text-[17px] sm:text-[21px] font-semibold leading-tight"
            style={{ color: '#ffffff' }}
          >
            {slide.title}
          </h3>
        </div>
        {slide.highlight && <HighlightChip label={slide.highlight} />}
      </div>
      <div className="w-10 h-[2px] bg-[#c9a96e] mt-2" aria-hidden="true" />
      <ul className="mt-4 space-y-2.5">
        {(slide.bullets ?? []).map((b, i) => (
          <li
            key={i}
            className="flex items-baseline gap-2.5 text-[12px] sm:text-[13px]"
          >
            <span
              className="inline-flex flex-shrink-0 items-center justify-center w-5 h-5 text-[10px] font-mono rounded-sm font-semibold"
              style={{ backgroundColor: '#c9a96e', color: '#0f2847' }}
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <span className="flex-1 leading-relaxed" style={{ color: '#e9eef5' }}>{b}</span>
          </li>
        ))}
      </ul>
    </SlideShell>
  );
}

function CtaSlide({ slide }: { slide: Slide }) {
  return (
    <SlideShell slide={slide}>
      <div className="flex-1 flex flex-col justify-center items-center text-center px-4">
        {slide.highlight && <HighlightChip label={slide.highlight} />}
        <div className="w-14 h-[2px] bg-[#c9a96e] mt-5 mb-5" aria-hidden="true" />
        <h3
          className="text-[26px] sm:text-[34px] font-bold leading-snug"
          style={{ color: '#ffffff' }}
        >
          {slide.title}
        </h3>
        {slide.subtitle && (
          <p
            className="mt-4 text-[13px] sm:text-[15px]"
            style={{ color: '#c6d3e4' }}
          >
            {slide.subtitle}
          </p>
        )}
        <div
          className="mt-6 inline-flex items-center gap-2 px-5 py-2 border border-[#c9a96e] text-[12px] tracking-[0.2em]"
          style={{ color: '#c9a96e' }}
        >
          お問い合わせ: fujitrace.jp
        </div>
      </div>
    </SlideShell>
  );
}

function SlideCanvas({ slide }: { slide: Slide }) {
  if (slide.layout === 'cover') return <CoverSlide slide={slide} />;
  if (slide.layout === 'cta') return <CtaSlide slide={slide} />;
  return <BulletSlide slide={slide} />;
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
      className={`group text-left transition-all ${
        active
          ? 'ring-2 ring-[#c9a96e] shadow-md'
          : 'hover:ring-1 hover:ring-[#c9a96e]/60'
      } bg-gradient-to-br from-[#0f2847] to-[#1e3a5f] border border-[#2b4566] rounded-sm p-1.5 flex flex-col aspect-[16/9]`}
      style={{ color: '#ffffff' }}
    >
      <span className="text-[7px] font-mono tabular-nums tracking-wider" style={{ color: '#c9a96e' }}>
        {String(slide.index).padStart(2, '0')}
      </span>
      <span className="text-[8px] font-semibold mt-1 line-clamp-2 leading-tight" style={{ color: '#ffffff' }}>
        {slide.title}
      </span>
      <span className="mt-auto flex flex-col gap-0.5">
        {slide.bullets?.slice(0, 2).map((_, i) => (
          <span
            key={i}
            className="h-[2px] bg-[#c9a96e]/60"
            style={{ width: `${70 - i * 10}%` }}
          />
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
