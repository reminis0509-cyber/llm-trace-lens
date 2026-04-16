import { useState, useMemo } from 'react';
import { useSeo } from '../hooks/useSeo';
import DachshundNarrator from './tutorial/DachshundNarrator';
import PdfPreview from './tutorial/PdfPreview';
import TutorialStepProgress, { type TutorialStep } from './tutorial/TutorialStepProgress';
import type { DocumentKind } from '../lib/tutorial-scripts';
import { PDF_PATHS, PDF_SUMMARIES, documentLabel, documentFilename } from '../lib/tutorial-scripts';

/* ─── Scenario configs ───────────────────────────────────────────── */

interface ScenarioConfig {
  kind: DocumentKind;
  label: string;
  seoTitle: string;
  seoDescription: string;
  mascotMessage: string;
  mascotHint: string;
  buttonLabel: string;
  formSections: FormSection[];
  lineItems: LineItem[] | null;
  totals: TotalRow[] | null;
}

interface FormSection {
  heading: string;
  fields: FormField[];
}

interface FormField {
  label: string;
  value: string;
  mono?: boolean;
  align?: 'left' | 'right';
}

interface LineItem {
  name: string;
  quantity: string;
  unitPrice: string;
  amount: string;
}

interface TotalRow {
  label: string;
  value: string;
}

const SCENARIO_CONFIGS: Record<DocumentKind, ScenarioConfig> = {
  estimate: {
    kind: 'estimate',
    label: '見積書',
    seoTitle: '見積書を無料で作成 | AI事務員 FujiTrace',
    seoDescription:
      '見積書をAIで無料作成。宛先・品目・金額を入力するだけで、プロ品質の見積書PDFを即時生成します。登録不要で今すぐ体験。',
    mascotMessage:
      'やあ、ボクはフジ。\n見積書を作るところを\n見せるね。',
    mascotHint: '下のフォームを確認して、\n「AIで見積書を生成する」を\n押してみてね。',
    buttonLabel: 'AIで見積書を生成する',
    formSections: [
      {
        heading: '取引先情報',
        fields: [
          { label: '宛先', value: '株式会社サンプル商事' },
          { label: '敬称', value: '御中' },
        ],
      },
      {
        heading: '見積内容',
        fields: [
          { label: '件名', value: 'AI事務員導入コンサルティング' },
          { label: '発行日', value: '2026-04-16', mono: true },
          { label: '有効期限', value: '2026-05-16', mono: true },
        ],
      },
      {
        heading: '支払条件',
        fields: [{ label: '支払条件', value: '月末締翌月末払い' }],
      },
    ],
    lineItems: [
      { name: 'AI事務員初期構築', quantity: '1', unitPrice: '\u00A5300,000', amount: '\u00A5300,000' },
    ],
    totals: [
      { label: '小計', value: '\u00A5300,000' },
      { label: '消費税 (10%)', value: '\u00A530,000' },
      { label: '合計', value: '\u00A5330,000' },
    ],
  },
  invoice: {
    kind: 'invoice',
    label: '請求書',
    seoTitle: '請求書を無料で作成 | AI事務員 FujiTrace',
    seoDescription:
      '請求書をAIで無料作成。取引先・品目・金額を入力するだけで、インボイス制度対応の請求書PDFを即時生成します。',
    mascotMessage:
      'やあ、ボクはフジ。\n請求書を作るところを\n見せるね。',
    mascotHint: '下のフォームを確認して、\n「AIで請求書を生成する」を\n押してみてね。',
    buttonLabel: 'AIで請求書を生成する',
    formSections: [
      {
        heading: '取引先情報',
        fields: [
          { label: '宛先', value: '株式会社サンプル商事' },
          { label: '敬称', value: '御中' },
        ],
      },
      {
        heading: '請求内容',
        fields: [
          { label: '請求番号', value: 'INV-2026-001', mono: true },
          { label: '発行日', value: '2026-04-16', mono: true },
          { label: '支払期限', value: '2026-05-31', mono: true },
        ],
      },
      {
        heading: '振込先',
        fields: [
          { label: '振込先銀行', value: 'みずほ銀行 東京営業部' },
          { label: '口座番号', value: '普通 1234567', mono: true },
        ],
      },
    ],
    lineItems: [
      { name: '月次保守サービス (4月分)', quantity: '1', unitPrice: '\u00A5200,000', amount: '\u00A5200,000' },
      { name: 'オプション: データ移行作業', quantity: '1', unitPrice: '\u00A5100,000', amount: '\u00A5100,000' },
    ],
    totals: [
      { label: '小計', value: '\u00A5300,000' },
      { label: '消費税 (10%)', value: '\u00A530,000' },
      { label: '合計', value: '\u00A5330,000' },
    ],
  },
  'purchase-order': {
    kind: 'purchase-order',
    label: '発注書',
    seoTitle: '発注書を無料で作成 | AI事務員 FujiTrace',
    seoDescription:
      '発注書をAIで無料作成。発注先・品目・数量を入力するだけで、業務品質の発注書PDFを即時生成します。登録不要で今すぐ体験。',
    mascotMessage:
      'やあ、ボクはフジ。\n発注書を作るところを\n見せるね。',
    mascotHint: '下のフォームを確認して、\n「AIで発注書を生成する」を\n押してみてね。',
    buttonLabel: 'AIで発注書を生成する',
    formSections: [
      {
        heading: '発注先情報',
        fields: [
          { label: '宛先', value: '株式会社ベンダー様' },
          { label: '敬称', value: '御中' },
        ],
      },
      {
        heading: '発注内容',
        fields: [
          { label: '発注番号', value: 'PO-2026-001', mono: true },
          { label: '発行日', value: '2026-04-16', mono: true },
          { label: '納品希望日', value: '2026-05-15', mono: true },
        ],
      },
    ],
    lineItems: [
      { name: 'サーバー機材一式', quantity: '1', unitPrice: '\u00A5200,000', amount: '\u00A5200,000' },
    ],
    totals: [
      { label: '小計', value: '\u00A5200,000' },
      { label: '消費税 (10%)', value: '\u00A520,000' },
      { label: '合計', value: '\u00A5220,000' },
    ],
  },
  'delivery-note': {
    kind: 'delivery-note',
    label: '納品書',
    seoTitle: '納品書を無料で作成 | AI事務員 FujiTrace',
    seoDescription:
      '納品書をAIで無料作成。納品先・品目・数量を入力するだけで、業務品質の納品書PDFを即時生成します。登録不要で今すぐ体験。',
    mascotMessage:
      'やあ、ボクはフジ。\n納品書を作るところを\n見せるね。',
    mascotHint: '下のフォームを確認して、\n「AIで納品書を生成する」を\n押してみてね。',
    buttonLabel: 'AIで納品書を生成する',
    formSections: [
      {
        heading: '納品先情報',
        fields: [
          { label: '宛先', value: '株式会社サンプル商事' },
          { label: '敬称', value: '御中' },
        ],
      },
      {
        heading: '納品内容',
        fields: [
          { label: '納品番号', value: 'DN-2026-001', mono: true },
          { label: '納品日', value: '2026-04-15', mono: true },
        ],
      },
    ],
    lineItems: [
      { name: 'AI事務員初期構築', quantity: '1', unitPrice: '-', amount: '-' },
    ],
    totals: null,
  },
  'cover-letter': {
    kind: 'cover-letter',
    label: '送付状',
    seoTitle: '送付状を無料で作成 | AI事務員 FujiTrace',
    seoDescription:
      '送付状をAIで無料作成。宛先・同封書類を入力するだけで、ビジネスマナーに沿った送付状PDFを即時生成します。登録不要で今すぐ体験。',
    mascotMessage:
      'やあ、ボクはフジ。\n送付状を作るところを\n見せるね。',
    mascotHint: '下のフォームを確認して、\n「AIで送付状を生成する」を\n押してみてね。',
    buttonLabel: 'AIで送付状を生成する',
    formSections: [
      {
        heading: '宛先情報',
        fields: [
          { label: '宛先', value: '株式会社サンプル商事' },
          { label: '敬称', value: '御中' },
          { label: '担当者', value: '鈴木一郎 様' },
        ],
      },
      {
        heading: '送付内容',
        fields: [
          { label: '送付日', value: '2026-04-16', mono: true },
          { label: '同封書類', value: '見積書 1部' },
          { label: '備考', value: 'ご査収のほどよろしくお願いいたします。' },
        ],
      },
    ],
    lineItems: null,
    totals: null,
  },
};

const ALL_SCENARIOS: DocumentKind[] = [
  'estimate',
  'invoice',
  'purchase-order',
  'delivery-note',
  'cover-letter',
];

const STEPS: TutorialStep[] = [
  { label: '入力データを受信中...', duration: 500 },
  { label: 'AIが書類を生成中...', duration: 800 },
  { label: '出力を検証中...', duration: 500 },
];

/* ─── Sub-components ────────────────────────────────────────────── */

function ReadOnlyField({
  label,
  value,
  mono = false,
  align = 'left',
}: {
  label: string;
  value: string;
  mono?: boolean;
  align?: 'left' | 'right';
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      <div
        className={`w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 ${
          mono ? 'tabular-nums' : ''
        } ${align === 'right' ? 'text-right' : ''}`}
        aria-readonly="true"
      >
        {value}
      </div>
      <span className="mt-1 block text-[11px] text-slate-400">自動入力</span>
    </label>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/* ─── Main component ─────────────────────────────────────────────── */

interface ScenarioTutorialPageProps {
  scenario: DocumentKind;
}

type Phase = 'waiting' | 'working' | 'done';

export default function ScenarioTutorialPage({ scenario }: ScenarioTutorialPageProps) {
  const config = SCENARIO_CONFIGS[scenario];
  const [phase, setPhase] = useState<Phase>('waiting');
  const [mascotState, setMascotState] = useState<'idle' | 'talk' | 'happy'>('idle');
  const [mascotMessage, setMascotMessage] = useState(config.mascotMessage);
  const [mascotHint, setMascotHint] = useState<string | undefined>(config.mascotHint);

  const pdfPath = PDF_PATHS[scenario];
  const pdfSummary = PDF_SUMMARIES[scenario];
  const filename = documentFilename(scenario);

  const breadcrumbJsonLd = useMemo(
    () => [
      {
        id: `scenario-breadcrumb-${scenario}`,
        data: {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'FujiTrace',
              item: 'https://fujitrace.jp/',
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'チュートリアル',
              item: 'https://fujitrace.jp/tutorial',
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: `${config.label}を作成`,
              item: `https://fujitrace.jp/tutorial/${scenario}`,
            },
          ],
        },
      },
    ],
    [scenario, config.label],
  );

  useSeo({
    title: config.seoTitle,
    description: config.seoDescription,
    url: `https://fujitrace.jp/tutorial/${scenario}`,
    jsonLd: breadcrumbJsonLd,
  });

  const handleGenerate = () => {
    if (phase !== 'waiting') return;
    setPhase('working');
    setMascotState('talk');
    setMascotMessage(`${config.label}を作っているよ。\nちょっとだけ…\n待っててね。`);
    setMascotHint(undefined);
  };

  const handleStepsComplete = () => {
    setPhase('done');
    setMascotState('happy');
    setMascotMessage('できた！');
    setMascotHint(undefined);
  };

  const handleClose = () => {
    window.location.href = '/';
  };

  const navigateTo = (path: string) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const otherScenarios = ALL_SCENARIOS.filter((s) => s !== scenario);

  return (
    <div
      role="main"
      aria-label={`${config.label} 作成チュートリアル`}
      className="fixed inset-0 z-50 bg-white overflow-y-auto"
    >
      {/* Close button */}
      <button
        type="button"
        onClick={handleClose}
        aria-label="チュートリアルを閉じる"
        className="fixed top-3 right-3 sm:top-4 sm:right-4 z-[60] inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white/95 backdrop-blur px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900"
      >
        <CloseIcon className="w-4 h-4" />
        <span className="hidden sm:inline">閉じる</span>
      </button>

      {/* Tutorial mode badge */}
      <div className="fixed top-3 left-3 sm:top-4 sm:left-4 z-[60]">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" aria-hidden="true" />
          チュートリアルモード
        </span>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-8">
        {/* Header */}
        <header className="space-y-2 text-center sm:text-left">
          <p className="text-xs font-semibold tracking-wide text-blue-700 uppercase">
            無料で試す
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
            {config.label}の作成
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl mx-auto sm:mx-0">
            サンプルデータがすでに入っています。ボタンを押すとAI事務員が{config.label}PDFを生成します。
          </p>
        </header>

        {/* Mascot */}
        <DachshundNarrator
          state={mascotState}
          message={mascotMessage}
          actionHint={mascotHint}
        />

        {/* Form (hidden after generation completes) */}
        {phase !== 'done' && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-6">
            {config.formSections.map((section) => (
              <section key={section.heading} className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">{section.heading}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {section.fields.map((field) => (
                    <ReadOnlyField
                      key={field.label}
                      label={field.label}
                      value={field.value}
                      mono={field.mono}
                      align={field.align}
                    />
                  ))}
                </div>
              </section>
            ))}

            {/* Line items table */}
            {config.lineItems && config.lineItems.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">明細</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-medium text-slate-500 border-b border-slate-200">
                        <th className="py-2 pr-3">品名</th>
                        <th className="py-2 px-3 text-right w-20">数量</th>
                        <th className="py-2 px-3 text-right w-32">単価</th>
                        <th className="py-2 pl-3 text-right w-32">金額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {config.lineItems.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-100">
                          <td className="py-3 pr-3 text-slate-800">{item.name}</td>
                          <td className="py-3 px-3 text-right tabular-nums text-slate-800">{item.quantity}</td>
                          <td className="py-3 px-3 text-right tabular-nums text-slate-800">{item.unitPrice}</td>
                          <td className="py-3 pl-3 text-right tabular-nums text-slate-800">{item.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-slate-400">自動入力</p>
              </section>
            )}

            {/* Totals */}
            {config.totals && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">合計</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {config.totals.map((row) => (
                    <ReadOnlyField
                      key={row.label}
                      label={row.label}
                      value={row.value}
                      mono
                      align="right"
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Generate button */}
            <div className="pt-4 border-t border-slate-100 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={phase !== 'waiting'}
                aria-label={config.buttonLabel}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-8 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-sm"
              >
                {phase === 'working' ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    作成中...
                  </>
                ) : (
                  config.buttonLabel
                )}
              </button>
              <p className="text-xs text-slate-500">所要時間: 約 2 秒</p>
            </div>
          </div>
        )}

        {/* Step progress */}
        {(phase === 'working' || phase === 'done') && (
          <TutorialStepProgress
            steps={STEPS}
            onComplete={handleStepsComplete}
            completed={phase === 'done'}
          />
        )}

        {/* PDF preview + CTAs */}
        {phase === 'done' && (
          <>
            <PdfPreview
              src={pdfPath}
              filename={filename}
              title={`${config.label}ができました！`}
              summary={pdfSummary}
            />

            {/* CTA: full tutorial */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-6 space-y-4">
              <h3 className="text-lg font-bold text-slate-900">
                全4章のチュートリアルに進む
              </h3>
              <p className="text-sm text-slate-600">
                チャットで指示する方法、反復練習、複雑な指示まで -- 4章を通してAI事務員の使い方を学べます。修了証も発行されます。
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => navigateTo('/tutorial')}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700 shadow-sm"
                >
                  チュートリアルを始める
                  <ArrowRightIcon className="w-4 h-4" />
                </button>
                <a
                  href="/dashboard/"
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  ダッシュボードで使う (無料)
                </a>
              </div>
            </div>

            {/* Cross-links to other scenarios */}
            <nav aria-label="他の書類チュートリアル" className="pt-4">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">
                他の書類も試す
              </h3>
              <div className="flex flex-wrap gap-2">
                {otherScenarios.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => navigateTo(`/tutorial/${s}`)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                  >
                    {documentLabel(s)}
                  </button>
                ))}
              </div>
            </nav>
          </>
        )}

        {/* Footer note */}
        <div className="pt-8 pb-4 text-center text-xs text-slate-400">
          FujiTrace チュートリアル -- スクリプト駆動
        </div>
      </div>
    </div>
  );
}
