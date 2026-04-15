interface PdfPreviewProps {
  src: string;
  filename: string;
  title?: string;
}

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

/**
 * Success card that surfaces a clear download CTA.
 * No iframe preview — embedded PDF viewers render as a dark UI on Chromium,
 * which Founder mistook for "the PDF did not appear". A generated-PDF
 * confirmation + large download button is the most reliable UX across devices.
 */
export default function PdfPreview({ src, filename, title = '見積書ができました！' }: PdfPreviewProps) {
  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-6 sm:p-8 shadow-sm">
      <div className="flex flex-col items-center text-center">
        <CheckCircleIcon className="w-12 h-12 text-green-600" />
        <h3 className="mt-3 text-xl sm:text-2xl font-bold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">
          下のボタンから PDF をダウンロードできます。
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
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

        <p className="mt-4 text-xs text-slate-500">ファイル名: {filename}</p>
      </div>
    </div>
  );
}
