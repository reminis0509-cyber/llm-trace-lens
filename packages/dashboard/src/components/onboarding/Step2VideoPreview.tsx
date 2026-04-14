/* ------------------------------------------------------------------ */
/*  Step2VideoPreview — 30s "show, don't touch" preview                */
/*                                                                     */
/*  Stage 2 (FujiTrace AI Agent) teaser. The video asset is not yet    */
/*  produced — we render a 16:9 dark-grey placeholder plus the four    */
/*  lines required by docs/教育動画_絵コンテ_自律エージェント.md.     */
/* ------------------------------------------------------------------ */

interface Props {
  onNext: () => void;
}

const STORYBOARD_LINES: string[] = [
  'チャットで「今月分の請求書をまとめて作成して」と指示するだけ',
  'AI事務員が複数のツールを組み合わせて実行',
  '最終確認は必ず人間が行います',
  'この機能は Pro+「AI事務員」でご利用いただけます（Phase A1 公開予定）',
];

export function Step2VideoPreview({ onNext }: Props) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600 leading-relaxed">
        次のステージでは、AI事務員が複数のツールを自律的に組み合わせて動きます。こちらは公開予告です。
      </p>

      {/* 16:9 placeholder */}
      <div
        className="relative w-full rounded-lg overflow-hidden bg-slate-800"
        style={{ aspectRatio: '16 / 9' }}
        role="img"
        aria-label="デモ動画準備中のプレースホルダー"
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-slate-300 text-base font-medium tracking-wide">
              デモ動画準備中
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Phase A1 公開予定（2026-06）
            </div>
          </div>
        </div>
      </div>

      {/* Storyboard summary */}
      <ul className="space-y-2">
        {STORYBOARD_LINES.map((line) => (
          <li key={line} className="flex items-start gap-2 text-sm text-slate-700 leading-relaxed">
            <span
              className="mt-2 w-1 h-1 rounded-full bg-blue-600 flex-shrink-0"
              aria-hidden="true"
            />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onNext}
          className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 transition-colors"
        >
          次へ
        </button>
      </div>
    </div>
  );
}
