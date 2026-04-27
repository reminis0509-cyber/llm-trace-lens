import Mascot, { type MascotSize } from '../Mascot';

/**
 * MascotQuote — カピぶちょー立ち絵 + フキダシ (顧客代弁者役)
 *
 * 戦略 doc Section 7.3 マスコット配置ルール再定義 (2026-04-28):
 *   ぶちょーは無理に挿入せず、適切なタイミングでお客様の声を代弁する感じが理想。(Founder)
 *
 * 用途:
 *   - 「悩み」セクション末尾: 顧客代弁 (感情ヒット)
 *   - 「解決」セクション末尾: 顧客代弁 (共感+期待感)
 *   - 末尾 CTA: 軽い励まし
 *
 * デザイン: docs/design/notion-DESIGN.md 準拠 (whisper border + ultra-thin shadow)
 *   - フキダシは pure white + 1px solid rgba(0,0,0,0.1)
 *   - 三角形は左 (mascot 側) を指す
 *   - 関西弁口調を維持 (Section 19.5 口調混在禁止ルール)
 */

interface MascotQuoteProps {
  /** 立ち絵サイズ。home Problems/Solution は md、CTA は sm。 */
  size?: MascotSize;
  /** フキダシ本文 (関西弁、Section 19.5 で AI 標準語との混在禁止) */
  quote: string;
  /** 立ち絵を右に置いて吹き出しを左に表示するか。default は false (立ち絵=左, 吹き出し=右)。 */
  reverse?: boolean;
}

export default function MascotQuote({ size = 'md', quote, reverse = false }: MascotQuoteProps) {
  return (
    <div
      className={`flex items-end gap-3 sm:gap-4 ${
        reverse ? 'flex-row-reverse justify-start' : 'justify-start'
      }`}
    >
      <div className="flex-shrink-0">
        <Mascot pose="default" size={size} animation="idle" />
      </div>

      {/* フキダシ */}
      <div className="relative max-w-md mb-6 sm:mb-8">
        <div
          className="bg-white rounded-card px-4 py-3 sm:px-5 sm:py-4 text-sm sm:text-base text-text-primary leading-relaxed"
          style={{
            border: '1px solid rgba(0,0,0,0.1)',
            boxShadow:
              '0 1px 1px rgba(0,0,0,0.04), 0 4px 8px rgba(0,0,0,0.04)',
          }}
        >
          <span className="block">{quote}</span>
        </div>

        {/* 三角形 — 立ち絵側を指す */}
        <span
          aria-hidden="true"
          className={`absolute bottom-3 ${reverse ? 'right-[-7px]' : 'left-[-7px]'}`}
          style={{
            width: 0,
            height: 0,
            borderTop: '7px solid transparent',
            borderBottom: '7px solid transparent',
            ...(reverse
              ? { borderLeft: '7px solid rgba(0,0,0,0.1)' }
              : { borderRight: '7px solid rgba(0,0,0,0.1)' }),
          }}
        />
        <span
          aria-hidden="true"
          className={`absolute bottom-3 ${reverse ? 'right-[-6px]' : 'left-[-6px]'}`}
          style={{
            width: 0,
            height: 0,
            borderTop: '7px solid transparent',
            borderBottom: '7px solid transparent',
            ...(reverse
              ? { borderLeft: '7px solid #ffffff' }
              : { borderRight: '7px solid #ffffff' }),
          }}
        />
      </div>
    </div>
  );
}
