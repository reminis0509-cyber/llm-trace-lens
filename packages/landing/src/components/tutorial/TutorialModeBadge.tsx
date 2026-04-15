/**
 * Inline info icon — avoids adding lucide-react as a LP dependency.
 */
function InfoIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

/**
 * Always-visible banner that reminds visitors the tutorial is script-driven,
 * not LLM-driven. Required by the B2 ethics guideline (see docs/戦略_2026.md).
 */
export default function TutorialModeBadge() {
  return (
    <div
      role="note"
      aria-label="チュートリアルモードの説明"
      className="sticky top-0 z-40 w-full border-b border-amber-200 bg-amber-50/95 backdrop-blur"
    >
      <div className="max-w-5xl mx-auto px-4 py-2 flex items-start gap-2 text-sm text-amber-900">
        <InfoIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p className="leading-snug">
          <span className="font-semibold">チュートリアルモード</span>
          {' ── '}
          このページのAI応答はスクリプト（関数）で動いています。実サービスはもっと賢いAIです。
        </p>
      </div>
    </div>
  );
}
