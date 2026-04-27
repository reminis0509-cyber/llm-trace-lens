/**
 * Shared metadata for the 8-chapter "おしごと AIの一週間" tutorial.
 * Keeping this table in one place prevents drift between the chapter
 * component, the progress bar, the splash, and the certificate.
 */

import type { ChapterId } from './tutorial-progress';

export interface ChapterMeta {
  id: ChapterId;
  /** Short label used in the progress bar (5 chars target for mobile). */
  shortLabel: string;
  /** Day-of-week prefix shown above chapter title ("月曜朝" 等). */
  dayLabel: string;
  /** Chapter full title. */
  title: string;
  /** One-line tagline shown under the title — the "why" of the chapter. */
  tagline: string;
  /** Feature category surfaced in the progress bar tooltip. */
  feature: string;
}

export const CHAPTERS: readonly ChapterMeta[] = [
  {
    id: 1,
    shortLabel: '月朝',
    dayLabel: '月曜朝',
    title: '初出社 — 今日の予定をおしごと AIに聞く',
    tagline: 'ボタン一つで、今日の予定と優先タスクが画面に並ぶ。',
    feature: '朝のブリーフィング',
  },
  {
    id: 2,
    shortLabel: '月昼',
    dayLabel: '月曜午後',
    title: '見積書をお願い — チャットで書類作成',
    tagline: '話しかけるだけで、PDF 見積書が完成する。',
    feature: '書類作成',
  },
  {
    id: 3,
    shortLabel: '火',
    dayLabel: '火曜',
    title: '議事録を自動化 — 音声メモを構造化',
    tagline: '走り書きのメモを投げると、決定事項と TODO に分かれて返ってくる。',
    feature: '議事録自動化',
  },
  {
    id: 4,
    shortLabel: '水',
    dayLabel: '水曜',
    title: '営業資料をスライドに — 1行から 10 枚',
    tagline: '「新サービス紹介を 10 枚」で、構成済みスライドが生成される。',
    feature: 'スライド生成',
  },
  {
    id: 5,
    shortLabel: '木',
    dayLabel: '木曜',
    title: '売上データを読ませる — Excel 分析',
    tagline: 'Excel を渡して質問すると、傾向とインサイトで答える。',
    feature: 'Excel 分析',
  },
  {
    id: 6,
    shortLabel: '金',
    dayLabel: '金曜',
    title: '業界リサーチ — Wide Research',
    tagline: '「SaaS 業界の動向」で、出典付きレポートが組み上がる。',
    feature: 'Wide Research',
  },
  {
    id: 7,
    shortLabel: '週末',
    dayLabel: '週末',
    title: '文書校正 + メール下書き',
    tagline: '敬語を直して、そのまま Gmail の下書きに流し込む。',
    feature: '校正 / Gmail 連携',
  },
  {
    id: 8,
    shortLabel: '来週',
    dayLabel: '来週',
    title: '複合タスク — おしごと AIの真価',
    tagline: '一言で、調査・要約・スライド下書きまで連携して走らせる。',
    feature: '複合タスク',
  },
];

export function getChapterMeta(id: ChapterId): ChapterMeta {
  const meta = CHAPTERS.find((c) => c.id === id);
  if (!meta) {
    // Exhaustive: this should never happen because ChapterId is a union of 1-8.
    throw new Error(`Unknown chapter id: ${String(id)}`);
  }
  return meta;
}
