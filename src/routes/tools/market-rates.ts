/**
 * Static market rate data for AI見積書チェック.
 * Used by the check prompt to detect under/over-pricing.
 *
 * Source: rough industry averages compiled from public freelance/SaaS pricing
 * surveys (Lancers, CrowdWorks, ITmedia 2024-2025). Values are JPY.
 *
 * NOTE: These are heuristics for warning generation, not authoritative quotes.
 */

export interface MarketRate {
  unit: string;
  min: number;
  max: number;
  description?: string;
}

export const MARKET_RATES: Record<string, MarketRate> = {
  'システム開発': {
    unit: '人日',
    min: 50000,
    max: 150000,
    description: 'Web/業務システム開発の人日単価',
  },
  'Webサイト制作': {
    unit: '式',
    min: 200000,
    max: 2000000,
    description: 'コーポレートサイト一式',
  },
  'デザイン': {
    unit: '件',
    min: 30000,
    max: 200000,
    description: 'ロゴ・バナー・LP デザイン',
  },
  'ライティング': {
    unit: '文字',
    min: 1,
    max: 10,
    description: 'Web 記事ライティング',
  },
  '翻訳': {
    unit: '文字',
    min: 5,
    max: 30,
    description: '英日翻訳の単価（文字単位）',
  },
  '動画編集': {
    unit: '本',
    min: 10000,
    max: 100000,
    description: 'YouTube 等の短尺動画編集',
  },
  '写真撮影': {
    unit: '時間',
    min: 10000,
    max: 50000,
    description: '出張撮影・スタジオ撮影',
  },
  'コンサルティング': {
    unit: '時間',
    min: 15000,
    max: 100000,
    description: '経営・IT コンサル',
  },
  '研修・講師': {
    unit: '時間',
    min: 20000,
    max: 100000,
    description: '企業研修・セミナー講師',
  },
  '士業（税理士・社労士等）': {
    unit: '月',
    min: 20000,
    max: 100000,
    description: '顧問契約の月額相場',
  },
  '広告運用': {
    unit: '月',
    min: 50000,
    max: 500000,
    description: 'リスティング広告等の月額運用代行',
  },
  'SEO対策': {
    unit: '月',
    min: 100000,
    max: 500000,
    description: 'SEO コンサル・施策',
  },
};

/**
 * Format market rates as a string for prompt embedding.
 * If `industry` is provided, only that entry is returned (with fallback to all).
 */
export function formatMarketRatesForPrompt(industry?: string): string {
  if (industry && MARKET_RATES[industry]) {
    const rate = MARKET_RATES[industry];
    return JSON.stringify({ [industry]: rate }, null, 2);
  }
  return JSON.stringify(MARKET_RATES, null, 2);
}
