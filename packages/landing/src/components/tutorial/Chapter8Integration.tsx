import { useEffect, useRef, useState, type ReactNode } from 'react';
import TutorialChatUI, { type ChatMessage } from './TutorialChatUI';
import TutorialStepProgress, { type TutorialStep } from './TutorialStepProgress';
import JtcDocumentViewer, { JtcTitle, JtcMetaRow, JtcClose } from './JtcDocumentViewer';
import { TUTORIAL_FOOTNOTE } from '../../lib/tutorial-scripts';
import { playStepSound, playCompleteSound } from '../../lib/tutorialSound';

interface Chapter8IntegrationProps {
  onComplete: () => void;
  onMascot: (state: 'idle' | 'talk' | 'happy', message: string, hint?: string) => void;
}

type Phase = 'chat' | 'generating' | 'done';

const STEPS: TutorialStep[] = [
  { label: 'Step 1 / 7  指示を解析 → 実行計画を立案', duration: 500 },
  { label: 'Step 2 / 7  freee 連携で A 社の過去取引を取得', duration: 700 },
  { label: 'Step 3 / 7  Projects に過去のやり取りを集約', duration: 600 },
  { label: 'Step 4 / 7  Wide Research で市場動向を追加収集', duration: 800 },
  { label: 'Step 5 / 7  提案サマリ（書類）を生成', duration: 700 },
  { label: 'Step 6 / 7  提案スライド 12 枚を生成', duration: 700 },
  { label: 'Step 7 / 7  Gmail 下書き + Calendar に仮予定登録', duration: 500 },
];

const SUGGESTIONS = [
  '来週の A 社提案、過去取引を調べて、サマリと提案スライド 12 枚、メール下書きまで',
  '株式会社ABC 向けの提案一式を用意して（調査 + スライド + メール）',
  '火曜の顧客 MTG 準備を全部お願い（資料・議事録テンプレ・メール）',
];

/* ── Artifact model ──────────────────────────────────────────────── */

type ArtifactKind = 'estimate' | 'minutes' | 'slides' | 'gmail' | 'calendar' | 'slack';

interface Artifact {
  kind: ArtifactKind;
  title: string;
  detail: string;
  source: string;
  /** true = 紙化対象（見積書/議事録/スライド）、false = 画面のみ（Gmail/Calendar/Slack）*/
  paper: boolean;
}

const ARTIFACTS: Artifact[] = [
  {
    kind: 'estimate',
    title: '提案見積書',
    detail: '年間契約 ¥6,600,000（税込）の御見積書を JTC 体裁で生成。',
    source: 'Document',
    paper: true,
  },
  {
    kind: 'minutes',
    title: '過去 MTG 議事録サマリ',
    detail: 'A 社との直近 3 回の議事録を統合した要点サマリ。',
    source: 'Projects / Document',
    paper: true,
  },
  {
    kind: 'slides',
    title: '提案スライド 12 枚',
    detail: '表紙 / 課題 / 解決策 / 事例 / 価格 / 導入スケジュール / まとめ',
    source: 'Slide Builder',
    paper: true,
  },
  {
    kind: 'gmail',
    title: 'Gmail 下書き',
    detail: '「来週火曜 14:00 〜 打合せのお願い」本文 + 資料 3 点を添付予定。',
    source: 'Gmail',
    paper: false,
  },
  {
    kind: 'calendar',
    title: 'Calendar 仮予定',
    detail: '2026-04-28（火）14:00 - 15:00  調整中ステータスで登録。',
    source: 'Google Calendar',
    paper: false,
  },
  {
    kind: 'slack',
    title: 'Slack 社内通知',
    detail: '#sales-abc チャンネルに案件進捗スレッドを自動投稿。',
    source: 'Slack',
    paper: false,
  },
];

/* ── JTC paper bodies for this chapter ───────────────────────────── */

function ProposalEstimateBody() {
  return (
    <>
      <JtcTitle label="御見積書" />
      <JtcMetaRow docNumber="EST-20260428-ABC" issuedOn="令和8年4月28日" />
      <div className="grid grid-cols-2 gap-6 mt-5 text-[13px]">
        <div>
          <p className="text-[#555]">宛先</p>
          <p className="text-[15px] font-medium mt-0.5">
            株式会社ABC <span className="text-[#666] font-normal">御中</span>
          </p>
          <p className="mt-3 text-[#555]">件名</p>
          <p>AI 社員導入 年間契約</p>
        </div>
        <div className="text-right">
          <p className="text-[#555]">発行者</p>
          <p>合同会社 Reminis</p>
        </div>
      </div>
      <div className="mt-4 border border-[#1a1a1a]">
        <div className="grid grid-cols-[1fr_100px_120px] bg-[#f3f4f6] border-b border-[#1a1a1a] text-[11px] text-[#333]">
          <div className="px-2 py-1.5 border-r border-[#333]">品名</div>
          <div className="px-2 py-1.5 text-right border-r border-[#333]">数量</div>
          <div className="px-2 py-1.5 text-right">金額</div>
        </div>
        <div className="grid grid-cols-[1fr_100px_120px] text-[12px] border-b border-[#333]">
          <div className="px-2 py-1.5 border-r border-[#333]">AI 社員 Pro プラン（12 ヶ月）</div>
          <div className="px-2 py-1.5 text-right border-r border-[#333] tabular-nums">12</div>
          <div className="px-2 py-1.5 text-right tabular-nums">3,600,000</div>
        </div>
        <div className="grid grid-cols-[1fr_100px_120px] text-[12px] border-b border-[#333]">
          <div className="px-2 py-1.5 border-r border-[#333]">導入支援・定着伴走</div>
          <div className="px-2 py-1.5 text-right border-r border-[#333] tabular-nums">1式</div>
          <div className="px-2 py-1.5 text-right tabular-nums">2,400,000</div>
        </div>
      </div>
      <div className="mt-4 ml-auto w-full sm:w-72">
        <div className="flex justify-between border-t-2 border-double border-[#1a1a1a] pt-1.5">
          <span className="text-[13px] font-medium">合計（税込）</span>
          <span className="text-[17px] font-semibold tabular-nums">6,600,000円</span>
        </div>
      </div>
      <JtcClose />
    </>
  );
}

function MeetingSummaryBody() {
  return (
    <>
      <JtcTitle label="過去会議サマリ" tracking="normal" />
      <JtcMetaRow docNumber="SUM-ABC-20260428" issuedOn="令和8年4月28日" />
      <div className="mt-4 text-[13px]">
        <span className="text-[#555]">対象: </span>
        <span>株式会社ABC 様との直近 3 回のミーティング</span>
      </div>

      <section className="mt-5">
        <p className="font-semibold text-[14px] mb-1.5 border-b border-[#1a1a1a] pb-1">
          1. 会議一覧
        </p>
        <div className="pl-3 border border-[#1a1a1a]">
          <div className="grid grid-cols-[120px_1fr_100px] bg-[#f3f4f6] border-b border-[#1a1a1a] text-[11px] text-[#333]">
            <div className="px-2 py-1.5 border-r border-[#333]">日付</div>
            <div className="px-2 py-1.5 border-r border-[#333]">議題</div>
            <div className="px-2 py-1.5">参加者</div>
          </div>
          {[
            { date: '2026-03-15', topic: '初回ヒアリング', p: '3 名' },
            { date: '2026-04-02', topic: '要件整理', p: '4 名' },
            { date: '2026-04-18', topic: '中間レビュー', p: '3 名' },
          ].map((r) => (
            <div
              key={r.date}
              className="grid grid-cols-[120px_1fr_100px] text-[12px] border-b border-[#333] last:border-b-0"
            >
              <div className="px-2 py-1.5 border-r border-[#333] font-mono tabular-nums">
                {r.date}
              </div>
              <div className="px-2 py-1.5 border-r border-[#333]">{r.topic}</div>
              <div className="px-2 py-1.5">{r.p}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5">
        <p className="font-semibold text-[14px] mb-1.5 border-b border-[#1a1a1a] pb-1">
          2. 主要な論点
        </p>
        <ol className="pl-5 space-y-1 text-[13px] list-decimal">
          <li>月次の書類作業の属人化を解消したい。</li>
          <li>現場の業務フローを大きく変えずに導入したい。</li>
          <li>顧客情報を海外サーバに出したくない。</li>
        </ol>
      </section>

      <section className="mt-5">
        <p className="font-semibold text-[14px] mb-1.5 border-b border-[#1a1a1a] pb-1">
          3. 今回の提案ポイント
        </p>
        <ol className="pl-5 space-y-1 text-[13px] list-decimal">
          <li>AI 社員 Pro プランを先方営業部 10 名に配布。</li>
          <li>既存 Excel フローを踏襲したまま AI 検証を後段に追加。</li>
          <li>国内リージョンでのデータ保管を契約書に明記。</li>
        </ol>
      </section>

      <JtcClose />
    </>
  );
}

function ProposalSlideBody() {
  // A single-slide placeholder — in the full flow we'd inline the Ch4 deck,
  // but here we give a concise "slide preview" representative of the 12-pager.
  return (
    <div className="jtc-slide-page">
      <div className="jtc-slide">
        <div className="flex items-baseline justify-between text-[10px] text-[#666] font-mono tabular-nums">
          <span className="uppercase tracking-[0.2em]">COVER</span>
          <span>01 / 12</span>
        </div>
        <div className="flex-1 flex flex-col justify-center items-center text-center px-4">
          <div className="w-12 h-1 bg-[#1d3557] mb-5" aria-hidden="true" />
          <h3 className="text-[22px] sm:text-[26px] font-bold leading-snug text-[#1a1a1a] max-w-[80%]">
            株式会社ABC 様 ご提案書
          </h3>
          <p className="mt-3 text-[13px] text-[#444]">
            AI 社員導入によるバックオフィスの 9 割削減計画
          </p>
        </div>
        <div className="mt-auto pt-3 border-t border-[#1a1a1a] flex items-baseline justify-between text-[9px] text-[#666]">
          <span>FujiTrace — AI 社員プラットフォーム</span>
          <span className="font-mono">合同会社 Reminis / 2026-04-28</span>
        </div>
      </div>
    </div>
  );
}

/* ── Screen-only artifact previews (Gmail / Calendar / Slack) ─────── */

function GmailDraftPreview() {
  return (
    <div className="bg-white p-4 font-sans text-sm">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
        <span className="inline-flex items-center rounded-md bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
          Gmail 下書き
        </span>
        <span className="text-[11px] text-slate-400">送信前</span>
      </div>
      <dl className="mt-3 grid grid-cols-[64px_1fr] gap-y-1 gap-x-2 text-[12px]">
        <dt className="text-slate-500">To</dt>
        <dd className="font-mono">tanaka@abc.co.jp</dd>
        <dt className="text-slate-500">Cc</dt>
        <dd className="font-mono">yamada@reminis.co.jp</dd>
        <dt className="text-slate-500">件名</dt>
        <dd>打合せのお願い（来週火曜 14:00 〜）</dd>
      </dl>
      <pre className="mt-3 font-mono text-[12px] text-slate-800 whitespace-pre-wrap bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5 leading-relaxed">
{`株式会社ABC 田中様

いつもお世話になっております。
合同会社 Reminis の山田でございます。

先日ご相談いただきました件につきまして、
来週火曜（4月28日）14:00 〜 15:00 でお打合せのお時間を
頂戴できないでしょうか。

ご提案資料・御見積書・会議サマリを本メールに添付しております。
ご査収のほどよろしくお願い申し上げます。`}
      </pre>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded bg-slate-100 border border-slate-200 text-slate-700">
          添付 御見積書.pdf
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded bg-slate-100 border border-slate-200 text-slate-700">
          添付 提案スライド.pdf
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded bg-slate-100 border border-slate-200 text-slate-700">
          添付 会議サマリ.pdf
        </span>
      </div>
    </div>
  );
}

function CalendarEventPreview() {
  return (
    <div className="bg-white p-4 font-sans text-sm">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
        <span className="inline-flex items-center rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
          Google Calendar
        </span>
        <span className="text-[11px] text-slate-400">調整中</span>
      </div>
      <div className="mt-3 space-y-2 text-[13px]">
        <p className="font-semibold text-slate-900">株式会社ABC 提案ミーティング</p>
        <dl className="grid grid-cols-[80px_1fr] gap-y-1 gap-x-2 text-[12px]">
          <dt className="text-slate-500">日時</dt>
          <dd>2026年4月28日（火） 14:00 〜 15:00</dd>
          <dt className="text-slate-500">場所</dt>
          <dd>先方会議室 / オンライン（Google Meet）</dd>
          <dt className="text-slate-500">参加者</dt>
          <dd>先方 田中様、山田様 ／ 当社 山田、佐藤</dd>
          <dt className="text-slate-500">添付</dt>
          <dd>御見積書、提案スライド、会議サマリ</dd>
        </dl>
      </div>
    </div>
  );
}

function SlackNotificationPreview() {
  return (
    <div className="bg-white p-4 font-sans text-sm">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
        <span className="inline-flex items-center rounded-md bg-violet-50 border border-violet-200 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
          Slack
        </span>
        <span className="text-[11px] text-slate-400">#sales-abc</span>
      </div>
      <div className="mt-3 space-y-2 text-[13px]">
        <p className="font-semibold">株式会社ABC 案件進捗 — 4/28 MTG 準備完了</p>
        <ul className="pl-4 space-y-0.5 text-[12px] text-slate-700 list-disc">
          <li>御見積書（¥6,600,000 税込・年契約）</li>
          <li>提案スライド 12 枚</li>
          <li>会議サマリ（過去 3 回 MTG）</li>
          <li>Gmail 下書き送信可能</li>
          <li>Calendar に仮予定（調整中）</li>
        </ul>
        <p className="text-[11px] text-slate-500">投稿者: AI 社員（on behalf of 山田）</p>
      </div>
    </div>
  );
}

/* ── Artifact card with expand/modal ─────────────────────────────── */

function ArtifactIcon({ kind }: { kind: ArtifactKind }) {
  const labels: Record<ArtifactKind, string> = {
    estimate: '見積',
    minutes: '議事',
    slides: 'スライド',
    gmail: 'メール',
    calendar: '予定',
    slack: '通知',
  };
  return (
    <div className="flex-shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-md bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-700 tracking-wide">
      {labels[kind]}
    </div>
  );
}

function ArtifactCard({
  a,
  onOpenScreen,
}: {
  a: Artifact;
  onOpenScreen: (a: Artifact) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <ArtifactIcon kind={a.kind} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">{a.title}</p>
          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{a.detail}</p>
          <p className="text-[10px] text-slate-400 mt-1">ソース: {a.source}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
            a.paper
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          {a.paper ? 'PDF 出力' : '画面表示'}
        </span>
        {a.paper ? (
          <a
            href={`#ch8-${a.kind}`}
            className="text-xs text-blue-600 font-medium hover:underline"
          >
            プレビュー →
          </a>
        ) : (
          <button
            type="button"
            onClick={() => onOpenScreen(a)}
            className="text-xs text-blue-600 font-medium hover:underline"
          >
            詳細を見る →
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Screen-only modal ───────────────────────────────────────────── */

function ScreenModal({
  artifact,
  onClose,
}: {
  artifact: Artifact | null;
  onClose: () => void;
}) {
  if (!artifact) return null;

  let body: ReactNode = null;
  if (artifact.kind === 'gmail') body = <GmailDraftPreview />;
  else if (artifact.kind === 'calendar') body = <CalendarEventPreview />;
  else if (artifact.kind === 'slack') body = <SlackNotificationPreview />;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h4 className="text-sm font-semibold text-slate-900">{artifact.title}</h4>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="px-2 py-1 text-xs text-slate-500 hover:text-slate-900"
          >
            閉じる
          </button>
        </div>
        {body}
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
  const [openScreen, setOpenScreen] = useState<Artifact | null>(null);
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
      '全部できた。\n\n紙化すべきものは\nPDF で、\n画面で済むものは\n画面で確認してね。',
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
                  株式会社ABC 向け提案一式（{ARTIFACTS.length} 成果物）
                </h3>
              </div>
              <span className="inline-flex items-center rounded-full border border-green-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold text-green-700 flex-shrink-0">
                7 steps · 6 artifacts
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ARTIFACTS.map((a) => (
                <ArtifactCard key={a.title} a={a} onOpenScreen={setOpenScreen} />
              ))}
            </div>
            <p className="text-[11px] text-slate-400">{TUTORIAL_FOOTNOTE}</p>
          </div>

          {/* Papered artifacts — each with its own JtcDocumentViewer */}
          <div id="ch8-estimate" className="scroll-mt-24">
            <JtcDocumentViewer
              kind="提案見積書"
              filename="ABC様_御見積書_20260428"
              caption="本書類は印刷を前提とした体裁で出力しています。"
            >
              <ProposalEstimateBody />
            </JtcDocumentViewer>
          </div>

          <div id="ch8-minutes" className="scroll-mt-24">
            <JtcDocumentViewer
              kind="会議サマリ"
              filename="ABC様_会議サマリ_20260428"
              caption="本書類は印刷を前提とした体裁で出力しています。"
            >
              <MeetingSummaryBody />
            </JtcDocumentViewer>
          </div>

          <div id="ch8-slides" className="scroll-mt-24">
            <JtcDocumentViewer
              kind="提案スライド"
              filename="ABC様_提案資料_12枚"
              caption="12 枚のうち表紙のみを表示しています。本番では全 12 枚が生成されます。"
            >
              <ProposalSlideBody />
            </JtcDocumentViewer>
          </div>

          <ScreenModal artifact={openScreen} onClose={() => setOpenScreen(null)} />

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
