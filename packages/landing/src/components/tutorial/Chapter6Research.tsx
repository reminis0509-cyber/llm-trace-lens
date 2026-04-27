import { useEffect, useRef, useState } from 'react';
import TutorialChatUI, { type ChatMessage } from './TutorialChatUI';
import TutorialStepProgress, { type TutorialStep } from './TutorialStepProgress';
import JtcDocumentViewer, {
  JtcTitle,
  JtcMetaRow,
  JtcClose,
} from './JtcDocumentViewer';
import { TUTORIAL_FOOTNOTE } from '../../lib/tutorial-scripts';
import { playStepSound, playCompleteSound } from '../../lib/tutorialSound';

interface Chapter6ResearchProps {
  onComplete: () => void;
  onMascot: (state: 'idle' | 'talk' | 'happy', message: string, hint?: string) => void;
}

type Phase = 'chat' | 'generating' | 'done';

/* ── 3 research topics — each has its own steps / log / report ────── */

type TopicId = 'invoice' | 'saas' | 'compare';

interface Topic {
  id: TopicId;
  label: string;
  steps: TutorialStep[];
  liveLog: string[];
  report: Report;
  /** JTC document metadata for 紙化 (paper) rendering. */
  paper: PaperMeta;
}

interface ReportSection {
  heading: string;
  body: string;
  sources: string[];
}

interface Report {
  title: string;
  summary: string;
  sections: ReportSection[];
  sourceCount: number;
  iters: number;
}

interface PaperMeta {
  /** JTC-style document title shown on paper (e.g. "業界調査報告書"). */
  docTitle: string;
  /** Document number, e.g. RES-20260422-001. */
  docNumber: string;
  /** Issued-on, 令和 reckoning. */
  issuedOn: string;
  /** Filename hint for PDF save. */
  filename: string;
  /** One-line sub-title under the main title (調査対象). */
  subject: string;
}

/* ── Topic 1: インボイス制度の業界影響 ───────────────────────────── */

const INVOICE_TOPIC: Topic = {
  id: 'invoice',
  label: 'インボイス制度の業界影響',
  steps: [
    { label: '「インボイス制度 影響」の一次情報を収集中... (iter 1/4)', duration: 500 },
    { label: '国税庁告示と主要業界団体の見解を整理中... (iter 2/4)', duration: 700 },
    { label: '中小企業・免税事業者への影響を抽出中... (iter 3/4)', duration: 800 },
    { label: '業界別影響レポートに統合中... (iter 4/4)', duration: 600 },
  ],
  liveLog: [
    '[iter 1] plan: インボイス制度 + 中小企業 + 業界影響',
    '[iter 1] fetch: nta.go.jp/invoice-2023 (OK)',
    '[iter 2] fetch: chusho.meti.go.jp/invoice-impact (OK)',
    '[iter 2] synth: 免税事業者と課税事業者の線引きを整理',
    '[iter 3] fetch: jimin.jp/invoice-freelance (OK)',
    '[iter 3] fetch: nikkei.com/invoice-saas-response (OK)',
    '[iter 4] synth: 4 sections + 8 sources',
  ],
  report: {
    title: 'インボイス制度の業界影響レポート',
    summary:
      '2023 年 10 月施行のインボイス制度は、免税事業者との取引コスト構造を根本から変えた。中小企業は取引先選定の再設計を迫られ、SaaS ベンダは登録番号管理機能の標準搭載が事実上必須となった。',
    sourceCount: 8,
    iters: 4,
    sections: [
      {
        heading: '1. 制度の概要',
        body: '適格請求書（インボイス）の保存が仕入税額控除の要件となり、発行事業者の登録番号の記載が必須となった。免税事業者から課税事業者への転換が急速に進行中。',
        sources: ['国税庁 適格請求書等保存方式の概要', '中小企業庁 インボイスQ&A'],
      },
      {
        heading: '2. 中小企業への影響',
        body: '免税事業者との継続取引で仕入税額控除が制限される経過措置期間中。多くの中小企業が取引先の課税状況を再確認し、発注フローを見直している。',
        sources: ['中小企業白書 2025', '日経 中小企業インボイス実態調査'],
      },
      {
        heading: '3. 免税事業者・フリーランスの選択',
        body: '課税転換による実質減収を避けるため、価格転嫁交渉が広範に発生。フリーランス新法（2024 施行）の保護条項と併せて解釈する必要がある。',
        sources: ['フリーランス新法 告示第1号', '日本フリーランス協会 調査2025'],
      },
      {
        heading: '4. SaaS ベンダ・請求書ツールの対応',
        body: '登録番号の記載・検証機能が標準実装化。freee / マネーフォワードは API 経由で国税庁公表システムと連携し、発行側・受領側の両方を自動チェックする機能を提供。',
        sources: ['freee インボイス対応プレスリリース', 'マネーフォワード 2024 Q2 IR'],
      },
    ],
  },
  paper: {
    docTitle: '業界調査報告書',
    docNumber: 'RES-20260422-001',
    issuedOn: '令和8年4月22日',
    filename: '業界調査報告書_インボイス制度',
    subject: 'インボイス制度の業界影響',
  },
};

/* ── Topic 2: SaaS 業界の 2026 年動向 ────────────────────────────── */

const SAAS_TOPIC: Topic = {
  id: 'saas',
  label: 'SaaS 業界の 2026 年動向',
  steps: [
    { label: '国内 SaaS 市場の最新レポートを収集中... (iter 1/5)', duration: 500 },
    { label: '主要ベンダー 5 社の IR を整理中... (iter 2/5)', duration: 700 },
    { label: '競争軸の時系列変化を分析中... (iter 3/5)', duration: 800 },
    { label: '日本市場の差別化要因を抽出中... (iter 4/5)', duration: 700 },
    { label: '出典付きレポートに統合中... (iter 5/5)', duration: 600 },
  ],
  liveLog: [
    '[iter 1] plan: 国内 SaaS 2026 + 中小企業',
    '[iter 1] fetch: yano-research.co.jp/market-saas-2026 (OK)',
    '[iter 2] fetch: xtech.nikkei.com/saas-vertical (OK)',
    '[iter 2] synth: 市場規模 / プレイヤー整理',
    '[iter 3] plan: 競争軸の時系列比較',
    '[iter 3] fetch: business.nikkei.com/ai-agent-2026 (OK)',
    '[iter 4] fetch: meti.go.jp/dx-indicator (OK)',
    '[iter 5] synth: 5 sections + 10 sources',
  ],
  report: {
    title: '国内 SaaS 業界 2026 年動向レポート',
    summary:
      '国内 SaaS 市場は 2026 年も二桁成長を継続。AI 組込みの速さが競争軸となり、日本語特化・国内データ保管・インボイス対応が中小企業導入の鍵。',
    sourceCount: 10,
    iters: 5,
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
        body: '単機能 → エージェント化。2024 年までは機能網羅の競争だったが、2026 年は「おしごと AI化」の実装速度が評価指標に。',
        sources: ['日経ビジネス 2026-03 特集', '国内 VC SaaS 投資動向レポート'],
      },
      {
        heading: '4. 日本市場の差別化要因',
        body: '日本語 UI / 国内データ保管 / インボイス対応 / 商慣習適合（捺印・月末締めなど）。海外製品の逐次日本対応では追いつきづらい領域。',
        sources: ['経産省 DX 推進指標', 'IPA 日本市場向け SaaS 要件書'],
      },
      {
        heading: '5. 中小企業向けの示唆',
        body: '導入ハードルは価格より「現場が触れるか」。おしごと AIのようなメタファー駆動 UI が、50 名規模以下で特に効果を発揮。',
        sources: ['中小企業白書 2026', 'JCCI 中小企業 DX 実態調査'],
      },
    ],
  },
  paper: {
    docTitle: '業界調査報告書',
    docNumber: 'RES-20260422-002',
    issuedOn: '令和8年4月22日',
    filename: '業界調査報告書_国内SaaS2026',
    subject: '国内 SaaS 業界 2026 年動向',
  },
};

/* ── Topic 3: freee vs マネーフォワード 比較 ─────────────────────── */

const COMPARE_TOPIC: Topic = {
  id: 'compare',
  label: '競合ツール比較: freee vs マネーフォワード',
  steps: [
    { label: '両社の公式サイト・IRを収集中... (iter 1/4)', duration: 500 },
    { label: '機能範囲と料金を整理中... (iter 2/4)', duration: 700 },
    { label: '導入企業規模別の強み・弱みを分析中... (iter 3/4)', duration: 800 },
    { label: '比較レポートに統合中... (iter 4/4)', duration: 600 },
  ],
  liveLog: [
    '[iter 1] plan: freee vs マネーフォワード',
    '[iter 1] fetch: freee.co.jp/pricing (OK)',
    '[iter 1] fetch: moneyforward.com/business/pricing (OK)',
    '[iter 2] synth: 機能マトリクス作成',
    '[iter 2] fetch: freee.co.jp/ir/2026Q1 (OK)',
    '[iter 3] fetch: moneyforward.com/ir/2026Q1 (OK)',
    '[iter 4] synth: 4 sections + 9 sources',
  ],
  report: {
    title: 'freee vs マネーフォワード 比較レポート',
    summary:
      '両社とも国内 B2B クラウド会計の首位争いだが、主戦場は異なる。freee は「起業家・一人社長」の簡単さに、マネーフォワードは「経理担当のいる中堅企業」の網羅性に強み。',
    sourceCount: 9,
    iters: 4,
    sections: [
      {
        heading: '1. 機能マトリクス',
        body: '両社とも会計・請求書・給与・経費の 4 主要モジュールを提供。freee は AI 仕訳・確定申告が強く、マネーフォワードはグループ経営管理と連携範囲（ERP 寄り）で優位。',
        sources: ['freee 製品ページ', 'マネーフォワード クラウド製品一覧'],
      },
      {
        heading: '2. 料金体系',
        body: 'freee は月額 ¥2,380 〜（ミニマム）、マネーフォワード は月額 ¥3,980 〜（スモールビジネス）。従業員数・仕訳件数で段階価格。Enterprise は両社とも個別見積。',
        sources: ['freee 料金ページ', 'マネーフォワード 料金ページ'],
      },
      {
        heading: '3. 導入企業規模別の強み',
        body: '〜20 名: freee の方が圧倒的に導入しやすい（UI の直感性）。21〜300 名: マネーフォワードが経理部門の業務負荷を下げやすい。300 名以上: マネーフォワード Enterprise が主戦場。',
        sources: ['日経XTECH 会計SaaSシェア調査', 'BOXIL SaaS 会計ソフト比較'],
      },
      {
        heading: '4. AI・連携の方向性',
        body: 'freee は「AI 経理」を 2025 年から本格展開し、自動仕訳・異常検知を標準化。マネーフォワードは連携数（500+）と API 開放でエコシステム形成を狙う。',
        sources: ['freee 2025 IR', 'マネーフォワード 2025 事業戦略'],
      },
    ],
  },
  paper: {
    docTitle: '競合比較調査報告書',
    docNumber: 'RES-20260422-003',
    issuedOn: '令和8年4月22日',
    filename: '競合比較調査報告書_freee_MF',
    subject: 'freee vs マネーフォワード 比較',
  },
};

const TOPICS: Topic[] = [INVOICE_TOPIC, SAAS_TOPIC, COMPARE_TOPIC];

/* ── Intent matching: choose topic from user input ───────────────── */

function matchTopic(text: string): Topic | null {
  const t = text.toLowerCase();
  if (text.includes('インボイス') || text.includes('免税') || t.includes('invoice')) {
    return INVOICE_TOPIC;
  }
  if (
    text.includes('freee') ||
    text.includes('マネーフォワード') ||
    text.includes('比較') ||
    text.includes('競合')
  ) {
    return COMPARE_TOPIC;
  }
  if (text.includes('SaaS') || text.includes('saas') || text.includes('業界') || text.includes('動向')) {
    return SAAS_TOPIC;
  }
  return null;
}

/* ── Live log component ──────────────────────────────────────────── */

function LiveLog({ lines, running }: { lines: string[]; running: boolean }) {
  return (
    <div className="rounded-lg bg-slate-900 text-emerald-300 font-mono text-[11px] px-4 py-3 max-h-40 overflow-y-auto">
      {lines.map((l, i) => (
        <p key={i} className="leading-relaxed whitespace-pre-wrap">
          {l}
        </p>
      ))}
      {running && (
        <p className="leading-relaxed animate-pulse">[finalize] synthesizing...</p>
      )}
    </div>
  );
}

function ReportCard({ report }: { report: Report }) {
  return (
    <div className="rounded-xl border border-green-200 bg-green-50/60 p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-green-700 uppercase">
            Wide Research レポート
          </p>
          <h3 className="mt-1 text-base sm:text-lg font-bold text-slate-900">
            {report.title}
          </h3>
        </div>
        <span className="inline-flex items-center rounded-full border border-green-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold text-green-700 flex-shrink-0">
          {report.iters} iter · {report.sourceCount} sources
        </span>
      </div>
      <div className="rounded-lg bg-white border border-green-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900 mb-1">要約</p>
        <p className="text-sm text-slate-700 leading-relaxed">{report.summary}</p>
      </div>
      <div className="space-y-3">
        {report.sections.map((sec) => (
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

/* ── JTC paper body for research reports ──────────────────────────── */

function ResearchReportPaperBody({ topic }: { topic: Topic }) {
  const { report, paper } = topic;
  return (
    <>
      <JtcTitle label={paper.docTitle} />
      <JtcMetaRow docNumber={paper.docNumber} issuedOn={paper.issuedOn} />

      <div className="mt-4 text-[13px]">
        <span className="text-[#555]">調査対象: </span>
        <span className="font-medium">{paper.subject}</span>
      </div>
      <div className="mt-1 text-[12px] text-[#444]">
        <span className="text-[#555]">情報源数: </span>
        <span className="font-mono tabular-nums">{report.sourceCount}</span>
        <span className="text-[#555]">  /  調査反復回数: </span>
        <span className="font-mono tabular-nums">{report.iters}</span>
      </div>

      {/* 1. 調査概要 */}
      <section className="mt-5">
        <p className="font-semibold text-[14px] mb-1.5 border-b border-[#1a1a1a] pb-1">
          1. 調査概要
        </p>
        <p className="text-[13px] leading-relaxed">{report.summary}</p>
      </section>

      {/* 2..N: report sections */}
      {report.sections.map((sec, i) => (
        <section key={sec.heading} className="mt-5">
          <p className="font-semibold text-[14px] mb-1.5 border-b border-[#1a1a1a] pb-1">
            {i + 2}. {sec.heading.replace(/^\d+\.\s*/, '')}
          </p>
          <p className="text-[13px] leading-relaxed">{sec.body}</p>
          <p className="mt-2 text-[11px] text-[#555]">
            出典: {sec.sources.join(' / ')}
          </p>
        </section>
      ))}

      {/* 所見 */}
      <section className="mt-5">
        <p className="font-semibold text-[14px] mb-1.5 border-b border-[#1a1a1a] pb-1">
          {report.sections.length + 2}. 所見
        </p>
        <p className="text-[13px] leading-relaxed">
          本調査は {report.sourceCount} 件の情報源を {report.iters} 回の反復にわたり横断し、
          重要論点を上記 {report.sections.length} セクションに集約した。
          実務上の判断材料として、社内の提案書・稟議・経営会議資料に添付することを推奨する。
        </p>
      </section>

      {/* 出典一覧 */}
      <section className="mt-5">
        <p className="font-semibold text-[14px] mb-1.5 border-b border-[#1a1a1a] pb-1">
          {report.sections.length + 3}. 出典一覧
        </p>
        <ol className="pl-5 space-y-0.5 text-[12px] list-decimal">
          {report.sections
            .flatMap((sec) => sec.sources)
            .map((src, i) => (
              <li key={`${src}-${i}`}>{src}</li>
            ))}
        </ol>
      </section>

      <JtcClose />
    </>
  );
}

/* ── Component ───────────────────────────────────────────────────── */

export default function Chapter6Research({ onComplete, onMascot }: Chapter6ResearchProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [phase, setPhase] = useState<Phase>('chat');
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const idCounter = useRef(0);
  const announced = useRef(false);

  useEffect(() => {
    if (!announced.current) {
      announced.current = true;
      onMascot(
        'talk',
        '金曜日。\n来週の提案で\n業界動向を聞かれたら…\n\nボクに任せて。',
        '下のチップから 1 つ選んで',
      );
    }
  }, [onMascot]);

  const nextId = () => {
    idCounter.current += 1;
    return `ch6-${idCounter.current}`;
  };

  const handleSend = (text: string) => {
    if (phase !== 'chat') return;
    const topic = matchTopic(text) ?? SAAS_TOPIC;
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: text }]);
    setIsTyping(true);

    window.setTimeout(() => {
      playStepSound();
      setSelectedTopic(topic);
      setPhase('generating');
      onMascot(
        'talk',
        `${topic.label}について\n複数のソースを\n読んでいるよ…`,
      );
      setIsTyping(false);
    }, 500);
  };

  const handleStepsComplete = () => {
    setPhase('done');
    playCompleteSound();
    onMascot(
      'happy',
      '出典付きの\n報告書になった。\n\nPDF で保存して\n上司に配れるよ。',
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
          テーマを投げると、おしごと AIが複数ソースを横断して出典付き報告書にまとめます。
          画面プレビューと、上司配布用の PDF 保存の両方に対応します。
        </p>
      </header>

      <TutorialChatUI
        messages={messages}
        onSend={handleSend}
        suggestions={TOPICS.map((t) => t.label)}
        isTyping={isTyping}
        placeholder="例: SaaS 業界の 2026 年動向"
        disabled={phase !== 'chat'}
      />

      {showTrace && selectedTopic && (
        <div className="flex gap-2">
          <img
            src="/tutorial/dachshund-idle.gif"
            alt="おしごと AI"
            className="w-6 h-6 rounded-full flex-shrink-0 mt-1"
          />
          <div className="flex-1 space-y-3">
            <TutorialStepProgress
              steps={selectedTopic.steps}
              onComplete={handleStepsComplete}
              completed={phase === 'done'}
            />
            <LiveLog lines={selectedTopic.liveLog} running={phase === 'generating'} />
          </div>
        </div>
      )}

      {phase === 'done' && selectedTopic && (
        <>
          {/* Screen structured preview — stays visible. */}
          <ReportCard report={selectedTopic.report} />

          {/* Paper-ified JTC report — preview + PDF save. */}
          <JtcDocumentViewer
            kind="業界調査報告書"
            filename={selectedTopic.paper.filename}
            caption="上司への配布・稟議添付を前提とした JTC 体裁の報告書です。"
          >
            <ResearchReportPaperBody topic={selectedTopic} />
          </JtcDocumentViewer>

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
