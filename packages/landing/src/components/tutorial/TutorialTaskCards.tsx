import type { ComponentType } from 'react';

export type TaskId = 'estimate' | 'invoice' | 'delivery-note' | 'purchase-order' | 'cover-letter';

/**
 * Inline icons — avoids adding lucide-react as a LP dependency.
 * Each icon takes a className so callers can tune size / color.
 */
type IconProps = { className?: string };
const baseSvgProps = {
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
};

function FileTextIcon({ className }: IconProps) {
  return (
    <svg className={className} {...baseSvgProps}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
    </svg>
  );
}

function ReceiptIcon({ className }: IconProps) {
  return (
    <svg className={className} {...baseSvgProps}>
      <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2-3 2-3-2z" />
      <line x1="8" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="14" y2="14" />
    </svg>
  );
}

function TruckIcon({ className }: IconProps) {
  return (
    <svg className={className} {...baseSvgProps}>
      <rect x="1" y="6" width="14" height="11" />
      <path d="M15 10h4l3 3v4h-7z" />
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="19" r="2" />
    </svg>
  );
}

function ClipboardIcon({ className }: IconProps) {
  return (
    <svg className={className} {...baseSvgProps}>
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <path d="M9 3h6v4H9z" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  );
}

function MailIcon({ className }: IconProps) {
  return (
    <svg className={className} {...baseSvgProps}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polyline points="2 6 12 13 22 6" />
    </svg>
  );
}

interface TaskDef {
  id: TaskId;
  title: string;
  description: string;
  Icon: ComponentType<IconProps>;
}

const TASKS: TaskDef[] = [
  { id: 'estimate', title: '見積書', description: '金額・品目から見積書を作成', Icon: FileTextIcon },
  { id: 'invoice', title: '請求書', description: '支払期限つきの請求書を作成', Icon: ReceiptIcon },
  { id: 'delivery-note', title: '納品書', description: '納品日を記載した納品書を作成', Icon: TruckIcon },
  { id: 'purchase-order', title: '発注書', description: '仕入先への発注書を作成', Icon: ClipboardIcon },
  { id: 'cover-letter', title: '送付状', description: '書類に添える送付状を作成', Icon: MailIcon },
];

interface TutorialTaskCardsProps {
  activeId: TaskId;
  onSelect: (id: TaskId) => void;
  disabledLabel?: string;
}

/**
 * 5-card task grid mirroring the dashboard's AI clerk hub.
 * Only the card whose id === activeId is clickable; the rest are greyed out
 * with a small badge so visitors see what will open in later steps.
 */
export default function TutorialTaskCards({
  activeId,
  onSelect,
  disabledLabel = '次のステップで使えます',
}: TutorialTaskCardsProps) {
  return (
    <div
      role="list"
      aria-label="おしごと AIのタスク一覧"
      className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5"
    >
      {TASKS.map(({ id, title, description, Icon }) => {
        const active = id === activeId;
        if (active) {
          return (
            <button
              key={id}
              type="button"
              role="listitem"
              onClick={() => onSelect(id)}
              className="text-left rounded-xl border border-blue-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-blue-400 transition focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Icon className="w-6 h-6 text-blue-600 mb-2" />
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">{description}</p>
              <span className="inline-block mt-3 text-xs font-medium text-blue-700">
                クリックして試す
              </span>
            </button>
          );
        }
        return (
          <div
            key={id}
            role="listitem"
            aria-disabled="true"
            className="rounded-xl border border-slate-200 bg-slate-50 p-4 opacity-60 cursor-not-allowed"
          >
            <Icon className="w-6 h-6 text-slate-400 mb-2" />
            <h3 className="text-base font-semibold text-slate-500">{title}</h3>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">{description}</p>
            <span className="inline-block mt-3 text-[11px] text-slate-500 bg-slate-200 rounded px-1.5 py-0.5">
              {disabledLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}
