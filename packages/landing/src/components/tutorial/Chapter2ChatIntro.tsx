import { useEffect, useRef, useState } from 'react';
import TutorialChatUI, { type ChatMessage } from './TutorialChatUI';
import TutorialStepProgress, { type TutorialStep } from './TutorialStepProgress';
import JtcDocumentViewer, { JtcTitle, JtcMetaRow, JtcClose } from './JtcDocumentViewer';
import {
  matchIntent,
  UNMATCHED_SIMPLE_MESSAGE,
  TUTORIAL_FOOTNOTE,
  documentLabel,
  type DocumentKind,
} from '../../lib/tutorial-scripts';
import { playStepSound } from '../../lib/tutorialSound';

interface Chapter2ChatIntroProps {
  onComplete: () => void;
  onMascot: (state: 'idle' | 'talk' | 'happy', message: string, hint?: string) => void;
}

const SUGGESTIONS = ['見積書作って', '請求書お願い', '発注書を作りたい'];

type Phase = 'chat' | 'generating' | 'done';

function makeSteps(kind: DocumentKind): TutorialStep[] {
  const label = documentLabel(kind);
  return [
    { label: '入力を解析中...', duration: 400 },
    { label: `${label}を生成中...`, duration: 600 },
    { label: '金額・記載事項を検証中...', duration: 500 },
  ];
}

/* ─── Document body — JTC-style per kind ─────────────────────────── */

interface EstimateRow {
  no: string;
  name: string;
  qty: string;
  unit: string;
  amount: string;
}

const ESTIMATE_ROWS: EstimateRow[] = [
  { no: '1', name: '要件ヒアリング・設計', qty: '1式', unit: '250,000', amount: '250,000' },
  { no: '2', name: '開発・実装', qty: '1式', unit: '850,000', amount: '850,000' },
  { no: '3', name: '導入研修（2 回）', qty: '2回', unit: '60,000', amount: '120,000' },
];

function EstimateBody() {
  const subtotal = 1_220_000;
  const tax = 122_000;
  const total = subtotal + tax;

  return (
    <>
      <JtcTitle label="御見積書" />
      <JtcMetaRow docNumber="EST-20260422-001" issuedOn="令和8年4月22日" />

      <div className="grid grid-cols-2 gap-6 mt-5 text-[12px]">
        <div>
          <p className="text-[#555] mb-0.5">宛先</p>
          <p className="text-[15px] font-medium">
            株式会社サンプル商事{' '}
            <span className="text-[#666] font-normal">御中</span>
          </p>
          <p className="mt-3 text-[#555] mb-0.5">件名</p>
          <p className="text-[14px]">AI 社員導入コンサルティング</p>
        </div>
        <div className="text-right">
          <p className="text-[#555] mb-0.5">発行者</p>
          <p className="text-[14px]">合同会社 Reminis</p>
          <p className="text-[12px] text-[#555]">担当: 山田太郎</p>
          <p className="mt-3 text-[12px] text-[#555]">お支払条件</p>
          <p className="text-[13px]">月末締翌月末払い</p>
        </div>
      </div>

      {/* Line items */}
      <div className="mt-5 border border-[#1a1a1a]">
        <div className="grid grid-cols-[44px_1fr_64px_100px_100px] bg-[#f3f4f6] border-b border-[#1a1a1a] text-[11px] text-[#333]">
          <div className="px-2 py-1.5 text-center border-r border-[#333]">No</div>
          <div className="px-2 py-1.5 border-r border-[#333]">品名</div>
          <div className="px-2 py-1.5 text-center border-r border-[#333]">数量</div>
          <div className="px-2 py-1.5 text-right border-r border-[#333]">単価</div>
          <div className="px-2 py-1.5 text-right">金額</div>
        </div>
        {ESTIMATE_ROWS.map((row) => (
          <div
            key={row.no}
            className="grid grid-cols-[44px_1fr_64px_100px_100px] text-[12px] border-b border-[#333] last:border-b-0"
          >
            <div className="px-2 py-1.5 text-center border-r border-[#333] font-mono">{row.no}</div>
            <div className="px-2 py-1.5 border-r border-[#333]">{row.name}</div>
            <div className="px-2 py-1.5 text-center border-r border-[#333]">{row.qty}</div>
            <div className="px-2 py-1.5 text-right border-r border-[#333] tabular-nums">
              {row.unit}
            </div>
            <div className="px-2 py-1.5 text-right tabular-nums">{row.amount}</div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="mt-4 ml-auto w-full sm:w-72">
        <div className="flex justify-between text-[12px] text-[#333] py-1">
          <span>小計</span>
          <span className="tabular-nums text-[#1a1a1a]">
            {subtotal.toLocaleString('ja-JP')}円
          </span>
        </div>
        <div className="flex justify-between text-[12px] text-[#333] py-1">
          <span>消費税（10%）</span>
          <span className="tabular-nums text-[#1a1a1a]">{tax.toLocaleString('ja-JP')}円</span>
        </div>
        <div className="flex justify-between items-baseline border-t-2 border-double border-[#1a1a1a] pt-1.5 mt-1">
          <span className="text-[13px] font-medium text-[#1a1a1a]">合計</span>
          <span className="text-[17px] font-semibold tabular-nums text-[#1a1a1a]">
            {total.toLocaleString('ja-JP')}円
          </span>
        </div>
      </div>

      {/* Signature block */}
      <div className="mt-8 pt-4 border-t border-[#ccc] grid grid-cols-2 gap-4 text-[11px] text-[#555]">
        <div>
          <p>本見積の有効期限: 発行日より 30 日間</p>
          <p className="mt-0.5">上記、ご検討のほどよろしくお願い申し上げます。</p>
        </div>
        <div className="text-right">
          <p>合同会社 Reminis</p>
          <p>〒150-0041 東京都渋谷区神南</p>
          <p>TEL: 03-XXXX-XXXX</p>
        </div>
      </div>
      <JtcClose />
    </>
  );
}

/** Simplified JTC bodies for non-estimate docs so Chapter 2 feels consistent. */
function InvoiceBody() {
  return (
    <>
      <JtcTitle label="請求書" />
      <JtcMetaRow docNumber="INV-20260422-001" issuedOn="令和8年4月22日" />
      <div className="mt-5 text-[13px]">
        <p className="text-[#555]">宛先</p>
        <p className="text-[15px] font-medium mt-0.5">
          株式会社サンプル商事 <span className="text-[#666] font-normal">御中</span>
        </p>
        <p className="mt-3 text-[#555]">下記のとおり、ご請求申し上げます。</p>
      </div>
      <div className="mt-4 border border-[#1a1a1a]">
        <div className="grid grid-cols-[1fr_100px_100px] bg-[#f3f4f6] border-b border-[#1a1a1a] text-[11px] text-[#333]">
          <div className="px-2 py-1.5 border-r border-[#333]">品名</div>
          <div className="px-2 py-1.5 text-right border-r border-[#333]">単価</div>
          <div className="px-2 py-1.5 text-right">金額</div>
        </div>
        <div className="grid grid-cols-[1fr_100px_100px] text-[12px] border-b border-[#333]">
          <div className="px-2 py-1.5 border-r border-[#333]">AI 社員運用サポート（4 月分）</div>
          <div className="px-2 py-1.5 text-right border-r border-[#333] tabular-nums">300,000</div>
          <div className="px-2 py-1.5 text-right tabular-nums">300,000</div>
        </div>
      </div>
      <div className="mt-4 ml-auto w-full sm:w-72">
        <div className="flex justify-between text-[12px] text-[#333] py-1">
          <span>小計</span>
          <span className="tabular-nums">300,000円</span>
        </div>
        <div className="flex justify-between text-[12px] text-[#333] py-1">
          <span>消費税（10%）</span>
          <span className="tabular-nums">30,000円</span>
        </div>
        <div className="flex justify-between border-t-2 border-double border-[#1a1a1a] pt-1.5 mt-1">
          <span className="text-[13px] font-medium">合計</span>
          <span className="text-[17px] font-semibold tabular-nums">330,000円</span>
        </div>
      </div>
      <div className="mt-6 pt-3 border-t border-[#ccc] text-[11px] text-[#555] space-y-0.5">
        <p>お支払期限: 令和8年5月31日</p>
        <p>お振込先: みずほ銀行 渋谷支店 普通 1234567 合同会社レミニス</p>
        <p>登録番号: T1234567890123</p>
      </div>
      <JtcClose />
    </>
  );
}

function PurchaseOrderBody() {
  return (
    <>
      <JtcTitle label="発注書" />
      <JtcMetaRow docNumber="PO-20260422-001" issuedOn="令和8年4月22日" />
      <div className="grid grid-cols-2 gap-6 mt-5 text-[13px]">
        <div>
          <p className="text-[#555]">発注先</p>
          <p className="text-[15px] font-medium mt-0.5">
            株式会社ベンダー <span className="text-[#666] font-normal">御中</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[#555]">発注者</p>
          <p className="text-[14px] mt-0.5">合同会社 Reminis</p>
        </div>
      </div>
      <div className="mt-4 border border-[#1a1a1a]">
        <div className="grid grid-cols-[44px_1fr_64px_100px] bg-[#f3f4f6] border-b border-[#1a1a1a] text-[11px] text-[#333]">
          <div className="px-2 py-1.5 text-center border-r border-[#333]">No</div>
          <div className="px-2 py-1.5 border-r border-[#333]">品名</div>
          <div className="px-2 py-1.5 text-center border-r border-[#333]">数量</div>
          <div className="px-2 py-1.5 text-right">金額</div>
        </div>
        <div className="grid grid-cols-[44px_1fr_64px_100px] text-[12px] border-b border-[#333]">
          <div className="px-2 py-1.5 text-center border-r border-[#333] font-mono">1</div>
          <div className="px-2 py-1.5 border-r border-[#333]">サーバー機材一式</div>
          <div className="px-2 py-1.5 text-center border-r border-[#333]">1式</div>
          <div className="px-2 py-1.5 text-right tabular-nums">200,000</div>
        </div>
      </div>
      <div className="mt-4 ml-auto w-full sm:w-72">
        <div className="flex justify-between border-t-2 border-double border-[#1a1a1a] pt-1.5">
          <span className="text-[13px] font-medium">合計（税込）</span>
          <span className="text-[17px] font-semibold tabular-nums">220,000円</span>
        </div>
      </div>
      <div className="mt-6 pt-3 border-t border-[#ccc] text-[11px] text-[#555] space-y-0.5">
        <p>納品希望日: 令和8年5月10日</p>
        <p>支払条件: 納品後 30 日以内</p>
      </div>
      <JtcClose />
    </>
  );
}

function DeliveryNoteBody() {
  return (
    <>
      <JtcTitle label="納品書" />
      <JtcMetaRow docNumber="DN-20260422-001" issuedOn="令和8年4月22日" />
      <div className="mt-5 text-[13px]">
        <p className="text-[#555]">宛先</p>
        <p className="text-[15px] font-medium mt-0.5">
          株式会社サンプル商事 <span className="text-[#666] font-normal">御中</span>
        </p>
        <p className="mt-3 text-[#555]">下記のとおり、納品いたしました。</p>
      </div>
      <div className="mt-4 border border-[#1a1a1a]">
        <div className="grid grid-cols-[1fr_120px] bg-[#f3f4f6] border-b border-[#1a1a1a] text-[11px] text-[#333]">
          <div className="px-2 py-1.5 border-r border-[#333]">品名</div>
          <div className="px-2 py-1.5 text-right">数量</div>
        </div>
        <div className="grid grid-cols-[1fr_120px] text-[12px] border-b border-[#333]">
          <div className="px-2 py-1.5 border-r border-[#333]">AI 社員 初期構築一式</div>
          <div className="px-2 py-1.5 text-right">1 式</div>
        </div>
      </div>
      <div className="mt-6 pt-3 border-t border-[#ccc] text-[11px] text-[#555] space-y-0.5">
        <p>納品日: 令和8年4月22日</p>
        <p>担当: 山田太郎</p>
      </div>
      <JtcClose />
    </>
  );
}

function CoverLetterBody() {
  return (
    <>
      <JtcTitle label="送付状" />
      <JtcMetaRow issuedOn="令和8年4月22日" />
      <div className="mt-5 text-[13px] leading-relaxed">
        <p className="text-[15px] font-medium">
          株式会社サンプル商事 <span className="text-[#666] font-normal">御中</span>
        </p>
        <p className="mt-4">拝啓　時下ますますご清栄のこととお慶び申し上げます。</p>
        <p className="mt-2">
          平素より格別のご高配を賜り、誠にありがとうございます。
          下記の書類をお送りいたしますので、ご査収のほどよろしくお願い申し上げます。
        </p>
      </div>
      <div className="mt-5 border border-[#1a1a1a]">
        <div className="bg-[#f3f4f6] border-b border-[#1a1a1a] px-3 py-1.5 text-[12px] text-[#333]">
          同封書類
        </div>
        <ul className="px-4 py-3 text-[12px] list-decimal list-inside space-y-1 text-[#1a1a1a]">
          <li>御見積書 1 部</li>
          <li>会社案内 1 部</li>
        </ul>
      </div>
      <div className="mt-6 pt-3 border-t border-[#ccc] text-[11px] text-[#555] text-right space-y-0.5">
        <p>合同会社 Reminis</p>
        <p>担当: 山田太郎</p>
      </div>
      <JtcClose label="敬具" />
    </>
  );
}

function DocumentBody({ kind }: { kind: DocumentKind }) {
  switch (kind) {
    case 'estimate':
      return <EstimateBody />;
    case 'invoice':
      return <InvoiceBody />;
    case 'purchase-order':
      return <PurchaseOrderBody />;
    case 'delivery-note':
      return <DeliveryNoteBody />;
    case 'cover-letter':
      return <CoverLetterBody />;
  }
}

const FILENAME_BY_KIND: Record<DocumentKind, string> = {
  estimate: '見積書_サンプル',
  invoice: '請求書_サンプル',
  'purchase-order': '発注書_サンプル',
  'delivery-note': '納品書_サンプル',
  'cover-letter': '送付状_サンプル',
};

export default function Chapter2ChatIntro({ onComplete, onMascot }: Chapter2ChatIntroProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [phase, setPhase] = useState<Phase>('chat');
  const [revealedKind, setRevealedKind] = useState<DocumentKind | null>(null);
  const idCounter = useRef(0);
  const announced = useRef(false);

  useEffect(() => {
    if (!announced.current) {
      announced.current = true;
      onMascot(
        'talk',
        'ブリーフィング通り、\nまずは見積書の再提出。\n\n「見積書作って」って\n送ってみて！',
        '下のチップをタップするだけでOK',
      );
    }
  }, [onMascot]);

  const nextId = () => {
    idCounter.current += 1;
    return `ch2-${idCounter.current}`;
  };

  const handleSend = (text: string) => {
    if (revealedKind || phase !== 'chat') return;
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: text }]);
    setIsTyping(true);
    window.setTimeout(() => {
      const match = matchIntent(text);
      if (match) {
        playStepSound();
        setRevealedKind(match.kind);
        setPhase('generating');
        onMascot('talk', '書類を作っているよ。\nちょっと待ってね。');
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'assistant',
            content: UNMATCHED_SIMPLE_MESSAGE,
            footnote: TUTORIAL_FOOTNOTE,
          },
        ]);
        playStepSound();
      }
      setIsTyping(false);
    }, 500);
  };

  const handleStepsComplete = () => {
    if (!revealedKind) return;
    setPhase('done');
    const label = documentLabel(revealedKind);
    onMascot(
      'happy',
      `できたよ。\n右のプレビューで\n${label}を\n確認してね。`,
    );
  };

  const showTrace = phase === 'generating' || phase === 'done';

  return (
    <section aria-labelledby="ch2-title" className="space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
          第 2 章 / 8 — 月曜午後
        </p>
        <h2 id="ch2-title" className="mt-1 text-2xl font-bold text-slate-900">
          見積書をお願い — チャットで書類作成
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          書類の名前を含めてメッセージを送ると、AI 社員が正式書類の体裁で出力します。
        </p>
      </header>

      <TutorialChatUI
        messages={messages}
        onSend={handleSend}
        suggestions={SUGGESTIONS}
        isTyping={isTyping}
        placeholder="例: 見積書作って"
        disabled={revealedKind !== null}
      />

      {showTrace && revealedKind && (
        <div className="flex gap-2">
          <img
            src="/tutorial/dachshund-idle.gif"
            alt="AI社員"
            className="w-6 h-6 rounded-full flex-shrink-0 mt-1"
          />
          <div className="flex-1 space-y-3">
            <TutorialStepProgress
              steps={makeSteps(revealedKind)}
              onComplete={handleStepsComplete}
              completed={phase === 'done'}
            />
          </div>
        </div>
      )}

      {phase === 'done' && revealedKind && (
        <>
          <JtcDocumentViewer
            kind={documentLabel(revealedKind)}
            filename={FILENAME_BY_KIND[revealedKind]}
            caption="本書類は印刷を前提とした体裁で出力しています。"
          >
            <DocumentBody kind={revealedKind} />
          </JtcDocumentViewer>
          <p className="text-[11px] text-slate-400 text-right">{TUTORIAL_FOOTNOTE}</p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onComplete}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              第 2 章を終える
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </>
      )}
    </section>
  );
}
