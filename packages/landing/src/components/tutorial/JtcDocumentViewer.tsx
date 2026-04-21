import { useRef, useState, type ReactNode } from 'react';

/**
 * JtcDocumentViewer — Shared wrapper for "紙化" (paper-like) documents:
 *   見積書 / 議事録 / スライド / Excel 分析報告書
 *
 * Design rules (Founder 2026-04-23 確定):
 *   - Monochrome 基調 (#fff / #1a1a1a / 罫線)
 *   - ゴシック体 (Noto Sans JP), tabular-nums
 *   - AI 感演出禁止 (「AIが分析した」等のメタ文言を出さない)
 *   - プレビュー表示と「PDFとして保存」(window.print()) を標準装備
 *   - 印刷時は外側UI (タブ/ボタン/ヘッダ) を消し、書類のみが印刷される
 *
 * Usage:
 *   <JtcDocumentViewer
 *     title="御見積書"
 *     docNumber="EST-20260422-001"
 *     filename="見積書_サンプル"
 *   >
 *     <EstimateBody />
 *   </JtcDocumentViewer>
 */

interface JtcDocumentViewerProps {
  /** Small label shown in the tab / accessibility region (例: "見積書"). */
  kind: string;
  /** Filename hint shown alongside the download button. */
  filename: string;
  /** Children render the inner document body — the paper itself. */
  children: ReactNode;
  /**
   * Optional caption shown in the outer green/neutral card above the document.
   * e.g. "ご確認ください" or "本書類は印刷を前提とした体裁で出力しています。"
   */
  caption?: string;
}

function PrinterIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

export default function JtcDocumentViewer({
  kind,
  filename,
  children,
  caption,
}: JtcDocumentViewerProps) {
  const [mode, setMode] = useState<'preview' | 'download'>('preview');
  const paperRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    // Mark paper for print, trigger browser print dialog, then unmark.
    // Print CSS in /packages/landing/src/styles/tutorial-print.css hides
    // everything except .jtc-print-target, so the resulting PDF is clean.
    const el = paperRef.current;
    if (!el) return;
    el.classList.add('jtc-print-target');
    // Give the DOM a tick so the class is committed before print() blocks.
    window.setTimeout(() => {
      try {
        window.print();
      } finally {
        el.classList.remove('jtc-print-target');
      }
    }, 40);
  };

  const tabClass = (m: 'preview' | 'download') =>
    `px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-colors ${
      mode === m
        ? 'bg-white text-slate-900 border-slate-300'
        : 'bg-slate-100 text-slate-500 border-transparent hover:text-slate-700'
    }`;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-6 shadow-sm jtc-print-scope">
      {/* Header — kind label + filename + optional caption */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 jtc-ui">
        <div className="flex items-center gap-2">
          <DocumentIcon className="w-4 h-4 text-slate-600" />
          <span className="text-sm font-semibold text-slate-800">{kind}</span>
          <span className="text-xs text-slate-500">— {filename}</span>
        </div>
        {caption && (
          <p className="text-[11px] text-slate-500">{caption}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 -mb-px jtc-ui" role="tablist" aria-label={`${kind}の表示切替`}>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'preview'}
          onClick={() => setMode('preview')}
          className={tabClass('preview')}
        >
          プレビュー
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'download'}
          onClick={() => setMode('download')}
          className={tabClass('download')}
        >
          ダウンロード
        </button>
      </div>

      {/* Panel */}
      <div className="rounded-b-xl rounded-tr-xl border border-slate-300 bg-white overflow-hidden">
        {mode === 'preview' && (
          <div
            role="tabpanel"
            aria-label={`${kind}プレビュー`}
            className="overflow-x-auto"
          >
            <div
              ref={paperRef}
              className="jtc-paper mx-auto my-6 bg-white text-[#1a1a1a] font-sans"
              style={{
                fontFamily:
                  '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", "メイリオ", sans-serif',
              }}
            >
              {children}
            </div>
          </div>
        )}

        {mode === 'download' && (
          <div role="tabpanel" aria-label={`${kind}のダウンロード`} className="p-6 jtc-ui">
            <div className="flex flex-col items-center text-center gap-4">
              <p className="text-sm text-slate-600">
                下のボタンを押すと、ブラウザの印刷ダイアログから
                <br className="hidden sm:block" />
                「PDF として保存」を選べます。
              </p>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-6 py-3 text-base font-semibold text-white hover:bg-slate-800 shadow-sm"
              >
                <PrinterIcon className="w-5 h-5" />
                PDF として保存 / 印刷
              </button>
              <p className="text-xs text-slate-500">推奨ファイル名: {filename}.pdf</p>
              <p className="text-[11px] text-slate-400 mt-2">
                ※このチュートリアルではブラウザの印刷機能を使って PDF 保存します。
                実サービスではサーバー側で PDF を直接生成します。
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───── Shared JTC document primitives (reusable from each chapter) ───── */

interface JtcTitleProps {
  label: string;
  /** Tracking; 2文字なら [0.4em]、長文なら [0.1em] が読みやすい。*/
  tracking?: 'wide' | 'normal';
}

export function JtcTitle({ label, tracking = 'wide' }: JtcTitleProps) {
  const trackingClass =
    tracking === 'wide' ? 'tracking-[0.4em] ml-[0.4em]' : 'tracking-[0.15em] ml-[0.15em]';
  return (
    <div className="text-center pb-3 border-b-2 border-[#1a1a1a]">
      <h2 className={`text-xl sm:text-2xl font-semibold text-[#1a1a1a] ${trackingClass}`}>
        {label}
      </h2>
    </div>
  );
}

interface JtcMetaRowProps {
  docNumber?: string;
  issuedOn?: string;
}

/** Right-aligned "文書番号 / 発行日" pair used below JtcTitle. */
export function JtcMetaRow({ docNumber, issuedOn }: JtcMetaRowProps) {
  if (!docNumber && !issuedOn) return null;
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mt-3 text-[11px] sm:text-xs text-[#333]">
      {docNumber && (
        <div>
          <span className="text-[#555]">文書番号:</span>{' '}
          <span className="font-mono tabular-nums text-[#1a1a1a]">{docNumber}</span>
        </div>
      )}
      {issuedOn && (
        <div>
          <span className="text-[#555]">発行日:</span>{' '}
          <span className="text-[#1a1a1a]">{issuedOn}</span>
        </div>
      )}
    </div>
  );
}

/** Final line "以上" centered right — standard JTC document close. */
export function JtcClose({ label = '以上' }: { label?: string }) {
  return (
    <div className="mt-6 pt-3 text-right text-sm text-[#1a1a1a]">{label}</div>
  );
}
