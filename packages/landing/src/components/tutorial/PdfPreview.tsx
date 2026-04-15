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
 * iframe PDF preview with a dedicated download button.
 * On mobile widths (<640px) the iframe is hidden and replaced with an
 * "open in new tab" button because embedded PDFs are unreliable on iOS Safari.
 */
export default function PdfPreview({ src, filename, title = 'PDFプレビュー' }: PdfPreviewProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-slate-200 bg-slate-50">
        <span className="text-sm font-medium text-slate-700">{title}</span>
        <div className="flex items-center gap-2">
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="sm:hidden inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-blue-700"
          >
            <ExternalIcon className="w-4 h-4" />
            PDFを開く
          </a>
          <a
            href={src}
            download={filename}
            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <DownloadIcon className="w-4 h-4" />
            ダウンロード
          </a>
        </div>
      </div>
      <iframe
        src={src}
        title={title}
        className="hidden sm:block w-full aspect-[1/1.414] border-0 bg-slate-100"
      />
      <div className="sm:hidden p-6 text-center text-sm text-slate-600">
        モバイルではPDFを別タブで開いてご確認ください。
      </div>
    </div>
  );
}
