/**
 * Shared "deep content" section for /tools/* pages.
 *
 * Why this exists:
 *   Google does not rank pages with only forms and minimal copy. We need
 *   1000+ chars of unique explanation per route to be ranked competitively
 *   for keywords like "請求書 無料 作成". This component renders:
 *     1. 概要 (overview, ~200-300 chars)
 *     2. 必須項目の書き方 (writing essentials, ~300-500 chars)
 *     3. 業種別の注意点 / よくあるミス (industry-specific, ~200-300 chars)
 *     4. FAQ (FAQPage schema 5+ entries, mirrored to JSON-LD)
 *     5. 関連ツールへの内部リンク (internal links boost crawl + topical authority)
 *
 * 戦略 doc Section 5.6 / 18.2.N (Founder 承認 2026-04-29)
 *
 * Per-route content lives in `seo-content.ts` so the prerender script can
 * render the same content into static HTML for crawlers.
 */
import type { ToolFaqEntry } from '../../../data/seo-tools';

export interface RelatedTool {
  href: string;
  name: string;
  description: string;
}

export interface SeoContentSection {
  heading: string;
  /**
   * Body paragraphs. Each entry is rendered as a <p>. Use multiple entries
   * for paragraph breaks. Plain strings only — no HTML allowed.
   */
  body: string[];
}

export interface SeoContentData {
  /** Anchor id for in-page navigation, e.g. "seikyusho-guide". */
  anchorId: string;
  /** Top-level h2 heading for the explanation block. */
  guideHeading: string;
  /** 1-3 explanation sections. Total body across all sections SHOULD ≥ 800 chars. */
  sections: SeoContentSection[];
  /** FAQ entries — same as seo-tools.ts data, but injected here for layout. */
  faq: ToolFaqEntry[];
  /** 4 related /tools/* routes for internal linking (excludes self). */
  relatedTools: RelatedTool[];
}

interface SeoContentProps {
  data: SeoContentData;
}

export default function SeoContent({ data }: SeoContentProps) {
  return (
    <section
      id={data.anchorId}
      className="py-12 sm:py-16 px-4 sm:px-6 bg-slate-50 border-t border-slate-200"
      aria-label="ツールの使い方と書類の解説"
    >
      <div className="max-w-3xl mx-auto">
        {/* ===== Guide ===== */}
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6">
          {data.guideHeading}
        </h2>
        <div className="space-y-8">
          {data.sections.map((section) => (
            <div key={section.heading}>
              <h3 className="text-lg sm:text-xl font-semibold text-slate-900 mb-3">
                {section.heading}
              </h3>
              <div className="space-y-3 text-sm sm:text-base text-slate-700 leading-relaxed">
                {section.body.map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ===== FAQ ===== */}
        <div className="mt-12 sm:mt-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6">
            よくあるご質問
          </h2>
          <dl className="space-y-4">
            {data.faq.map((entry) => (
              <details
                key={entry.question}
                className="group bg-white rounded-lg border border-slate-200 p-4 sm:p-5 open:shadow-sm"
              >
                <summary className="cursor-pointer list-none flex items-start justify-between gap-3">
                  <dt className="text-sm sm:text-base font-semibold text-slate-900 leading-snug">
                    Q. {entry.question}
                  </dt>
                  <span
                    className="flex-shrink-0 mt-0.5 text-slate-400 group-open:rotate-180 transition-transform"
                    aria-hidden="true"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </span>
                </summary>
                <dd className="mt-3 text-sm sm:text-base text-slate-700 leading-relaxed">
                  A. {entry.answer}
                </dd>
              </details>
            ))}
          </dl>
        </div>

        {/* ===== Related tools (internal links) ===== */}
        {data.relatedTools.length > 0 && (
          <div className="mt-12 sm:mt-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6">
              関連する無料ツール
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {data.relatedTools.map((tool) => (
                <a
                  key={tool.href}
                  href={tool.href}
                  className="block bg-white rounded-lg border border-slate-200 p-4 sm:p-5 hover:border-blue-400 hover:shadow-sm transition-all"
                >
                  <p className="text-base font-semibold text-slate-900 mb-1">
                    {tool.name}
                  </p>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {tool.description}
                  </p>
                </a>
              ))}
            </div>
            <p className="mt-6 text-center text-sm">
              <a
                href="/tools"
                className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                すべての無料ツールを見る →
              </a>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
