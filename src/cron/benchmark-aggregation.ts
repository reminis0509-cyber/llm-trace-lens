/**
 * Benchmark Aggregation Cron Job
 *
 * 全ワークスペースのトレースデータを業種別に集約し、
 * 匿名化した業界ベンチマークを生成する。
 *
 * 実行タイミング: 毎日1回（深夜）
 *
 * Usage:
 *   npx tsx src/cron/benchmark-aggregation.ts
 *   node dist/cron/benchmark-aggregation.js
 */

import 'dotenv/config';
import { listWorkspaces } from '../kv/client.js';
import {
  getWorkspaceIndustry,
  calculateWorkspaceMetrics,
  aggregateIndustryBenchmark,
  cacheIndustryBenchmark,
} from '../benchmark/aggregator.js';
import type { IndustryCategory, WorkspaceMetrics } from '../benchmark/types.js';

/**
 * 全ワークスペースのベンチマークを集約
 */
async function runBenchmarkAggregation(period?: string): Promise<void> {
  const targetPeriod = period || getCurrentPeriod();

  console.log(`[Benchmark] Starting aggregation for ${targetPeriod}...`);

  // 全ワークスペースを取得
  const workspaces = await listWorkspaces();
  console.log(`[Benchmark] Found ${workspaces.length} workspace(s)`);

  // 業種別にメトリクスを集約
  const metricsByIndustry = new Map<IndustryCategory, WorkspaceMetrics[]>();
  let processedCount = 0;
  let skippedCount = 0;

  for (const workspaceId of workspaces) {
    try {
      const industry = await getWorkspaceIndustry(workspaceId);
      if (!industry) {
        skippedCount++;
        continue;
      }

      const metrics = await calculateWorkspaceMetrics(workspaceId, targetPeriod);
      if (!metrics) {
        skippedCount++;
        continue;
      }

      if (!metricsByIndustry.has(industry)) {
        metricsByIndustry.set(industry, []);
      }
      metricsByIndustry.get(industry)!.push(metrics);
      processedCount++;
    } catch (error) {
      console.error(`[Benchmark] Error processing workspace ${workspaceId}:`, error);
      skippedCount++;
    }
  }

  console.log(`[Benchmark] Processed: ${processedCount}, Skipped: ${skippedCount}`);

  // 業種別ベンチマークを生成・保存
  let benchmarkCount = 0;
  for (const [industry, metrics] of metricsByIndustry) {
    const benchmark = aggregateIndustryBenchmark(industry, targetPeriod, metrics);
    if (benchmark) {
      await cacheIndustryBenchmark(benchmark);
      benchmarkCount++;
      console.log(`[Benchmark] Generated benchmark for ${industry} (${metrics.length} participants)`);
    } else {
      console.log(`[Benchmark] Skipped ${industry}: only ${metrics.length} participants (min: 3)`);
    }
  }

  console.log(`[Benchmark] Completed. Generated ${benchmarkCount} industry benchmark(s)`);
}

function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Main entry point for cron job
 */
async function main() {
  console.log('='.repeat(50));
  console.log('FujiTrace - Benchmark Aggregation');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(50));

  try {
    await runBenchmarkAggregation();
    console.log(`\nCompleted at: ${new Date().toISOString()}`);
    console.log('='.repeat(50));
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { runBenchmarkAggregation };
