/**
 * Watch Room — Demo Stream
 *
 * Synthesizes fake trace events at a steady cadence so the Watch Room
 * prototype looks alive even when the workspace has no real traffic.
 *
 * This exists specifically so Founder can film a 30-60s demo video for X
 * (Phase W0 success criterion). Activated via `?demo=1` URL parameter.
 *
 * Phase W0: pseudo-random distribution, weighted toward PASS to look healthy
 * but with occasional WARN/FAIL/BLOCK for visual drama. Phase W1 can swap to
 * a scripted narrative ("error rate rising → fails cluster → recovery").
 */

import { useEffect, useRef, useState } from 'react';
import type { StreamTrace } from '../components/watch/TraceStream';
import type { ValidationLevel } from '../types';

const DEMO_PROMPTS = [
  '顧客メールの要約を作成してください',
  '請求書の内容に誤りがないか確認',
  '契約書ドラフトから主要条項を抽出',
  '問い合わせを適切な部署に振り分け',
  '議事録から決定事項とTODOを整理',
  '英文プレスリリースを日本語に翻訳',
  '経費精算の勘定科目を推定',
  '顧客からのクレーム内容を分類',
  '商品説明文を SEO 最適化して書き直し',
  'PDF レポートから KPI テーブルを抽出',
  '見積書の金額計算が正しいか検算',
  'Slack の議論からアクションアイテム抽出',
  '不動産契約書の特約を日本語で要約',
  'カスタマーサポート回答テンプレ生成',
  '月次レポートのサマリー作成',
];

const DEMO_PROVIDERS = ['openai', 'anthropic', 'gemini'] as const;
const DEMO_MODELS: Record<(typeof DEMO_PROVIDERS)[number], string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1'],
  anthropic: ['claude-sonnet-4-6', 'claude-haiku-4-5', 'claude-opus-4-6'],
  gemini: ['gemini-2.0-flash', 'gemini-2.5-pro'],
};

// Weighted distribution: mostly PASS, occasional drama.
const LEVEL_WEIGHTS: Array<[ValidationLevel, number]> = [
  ['PASS', 70],
  ['WARN', 18],
  ['FAIL', 9],
  ['BLOCK', 3],
];

function pickWeighted(): ValidationLevel {
  const total = LEVEL_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [level, w] of LEVEL_WEIGHTS) {
    r -= w;
    if (r <= 0) return level;
  }
  return 'PASS';
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateDemoTrace(): StreamTrace {
  const provider = pickRandom(DEMO_PROVIDERS);
  const model = pickRandom(DEMO_MODELS[provider]);
  const level = pickWeighted();
  const score =
    level === 'PASS'
      ? 0.85 + Math.random() * 0.15
      : level === 'WARN'
        ? 0.55 + Math.random() * 0.2
        : level === 'FAIL'
          ? 0.2 + Math.random() * 0.25
          : Math.random() * 0.2;
  return {
    id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    provider,
    model,
    preview: pickRandom(DEMO_PROMPTS),
    level,
    score,
    latencyMs: 200 + Math.floor(Math.random() * 1800),
  };
}

interface UseWatchDemoStreamOptions {
  enabled: boolean;
  /** Target traces per minute (default 24 → one every 2.5s on average) */
  tracesPerMinute?: number;
}

/**
 * Returns an ever-growing array of synthesized traces plus the latest trace
 * for sound notification triggering.
 */
export function useWatchDemoStream({
  enabled,
  tracesPerMinute = 24,
}: UseWatchDemoStreamOptions) {
  const [traces, setTraces] = useState<StreamTrace[]>([]);
  const [latest, setLatest] = useState<StreamTrace | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const schedule = () => {
      // Jitter the cadence so it feels alive rather than metronomic.
      const baseMs = (60_000 / tracesPerMinute);
      const jitter = 0.6 + Math.random() * 0.8; // 0.6x - 1.4x
      const delay = baseMs * jitter;
      timerRef.current = window.setTimeout(() => {
        const next = generateDemoTrace();
        setTraces((prev) => {
          // Cap at 200 to keep memory bounded.
          const updated = [...prev, next];
          return updated.length > 200 ? updated.slice(-200) : updated;
        });
        setLatest(next);
        schedule();
      }, delay);
    };

    schedule();
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [enabled, tracesPerMinute]);

  return { traces, latest };
}
