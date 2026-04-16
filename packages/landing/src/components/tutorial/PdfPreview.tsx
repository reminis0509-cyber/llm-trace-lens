import { useState } from 'react';

interface PdfPreviewProps {
  src: string;
  filename: string;
  title?: string;
  /** Optional multi-line summary text shown above the download buttons. */
  summary?: string;
}

type Tab = 'preview' | 'download';

const iconSvgProps = {
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
};

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} {...iconSvgProps}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} {...iconSvgProps}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function ExternalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} {...iconSvgProps}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} {...iconSvgProps}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

/**
 * Success card with tabbed PDF preview (iframe) and download actions.
 * Desktop: inline iframe preview tab + download tab.
 * Mobile (< sm): iframe replaced with "PDF を開く" button (iOS Safari compat).
 */
export default function PdfPreview({
  src,
  filename,
  title = '見積書ができました！',
  summary,
}: PdfPreviewProps) {
  const [tab, setTab] = useState<Tab>('preview');

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-colors ${
      tab === t
        ? 'bg-white text-slate-900 border-green-200'
        : 'bg-green-100/60 text-slate-500 border-transparent hover:text-slate-700'
    }`;

  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-6 sm:p-8 shadow-sm">
      {/* Header */}
      <div className="flex flex-col items-center text-center mb-4">
        <CheckCircleIcon className="w-10 h-10 text-green-600" />
        <h3 className="mt-2 text-xl sm:text-2xl font-bold text-slate-900">{title}</h3>
        {summary && (
          <pre className="mt-3 text-left text-sm text-slate-700 font-mono whitespace-pre-wrap bg-white/60 rounded-lg border border-green-100 px-4 py-3 w-full max-w-sm">
            {summary}
          </pre>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 -mb-px" role="tablist" aria-label="PDF 表示切替">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'preview'}
          aria-controls="pdf-panel-preview"
          onClick={() => setTab('preview')}
          className={tabClass('preview')}
        >
          <span className="inline-flex items-center gap-1.5">
            <FileIcon className="w-4 h-4" />
            プレビュー
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'download'}
          aria-controls="pdf-panel-download"
          onClick={() => setTab('download')}
          className={tabClass('download')}
        >
          <span className="inline-flex items-center gap-1.5">
            <DownloadIcon className="w-4 h-4" />
            ダウンロード
          </span>
        </button>
      </div>

      {/* Panels */}
      <div className="rounded-b-xl rounded-tr-xl border border-green-200 bg-white overflow-hidden">
        {tab === 'preview' && (
          <div id="pdf-panel-preview" role="tabpanel">
            {/* Desktop: iframe */}
            <iframe
              src={src}
              title={`${filename} プレビュー`}
              className="hidden sm:block w-full border-0"
              style={{ height: '600px' }}
            />
            {/* Mobile: fallback button (iOS Safari cannot render inline PDF well) */}
            <div className="sm:hidden flex flex-col items-center gap-3 p-6">
              <p className="text-sm text-slate-600 text-center">
                モバイルでは PDF を別タブで開いて確認できます。
              </p>
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700 shadow-sm"
              >
                <ExternalIcon className="w-5 h-5" />
                PDF を開く
              </a>
            </div>
          </div>
        )}

        {tab === 'download' && (
          <div id="pdf-panel-download" role="tabpanel" className="p-6">
            <div className="flex flex-col items-center text-center gap-4">
              <p className="text-sm text-slate-600">
                下のボタンから PDF をダウンロードできます。
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <a
                  href={src}
                  download={filename}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700 shadow-sm"
                >
                  <DownloadIcon className="w-5 h-5" />
                  PDF をダウンロード
                </a>
                <a
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <ExternalIcon className="w-4 h-4" />
                  別タブで開く
                </a>
              </div>
              <p className="text-xs text-slate-500">ファイル名: {filename}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
