/**
 * stream-demo-traces.ts
 *
 * Streams demo traces into the local SQLite DB one at a time,
 * with configurable interval. The dashboard auto-refreshes and
 * shows traces flowing in real-time.
 *
 * Usage: npx tsx src/scripts/stream-demo-traces.ts [interval_seconds]
 * Default interval: 3 seconds
 *
 * Example: npx tsx src/scripts/stream-demo-traces.ts 2
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

const INTERVAL_SEC = parseInt(process.argv[2] ?? '3', 10);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(arr: readonly T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

const PROVIDERS = ['openai', 'openai', 'openai', 'anthropic', 'anthropic', 'gemini'] as const;
const MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini'],
  anthropic: ['claude-3-5-sonnet', 'claude-3-haiku'],
  gemini: ['gemini-1.5-pro', 'gemini-1.5-flash'],
};

const LATENCY_RANGE: Record<string, [number, number]> = {
  'gpt-4o': [1500, 6000],
  'gpt-4o-mini': [800, 2500],
  'claude-3-5-sonnet': [2000, 8000],
  'claude-3-haiku': [600, 2000],
  'gemini-1.5-pro': [2000, 10000],
  'gemini-1.5-flash': [500, 1800],
};

interface Scenario {
  prompt: string;
  answer: string;
  evidence: string[];
  category: string;
}

const SCENARIOS: Scenario[] = [
  { prompt: '山田太郎さんの電話番号は090-1234-5678です。この情報を要約してください。', answer: 'お客様の連絡先情報を受領しました。個人情報保護の観点から、電話番号を含む個人情報はマスキング処理を推奨します。', evidence: ['電話番号パターン(090-XXXX-XXXX)を検出', 'PII検出ルール適用'], category: 'PII検出' },
  { prompt: '社内ナレッジベースから、AWSのコスト最適化に関するベストプラクティスを検索してください。', answer: 'ナレッジベースから3件の関連ドキュメントを取得しました。主なベストプラクティス: リザーブドインスタンスの活用、未使用リソースの自動検出、S3ライフサイクルポリシーの設定。', evidence: ['検索クエリ: "AWS コスト最適化"', '取得ドキュメント数: 3件', '関連度: 0.92'], category: 'RAG検索' },
  { prompt: 'TypeScriptでFastifyのヘルスチェックエンドポイントを作成してください。', answer: 'GET /healthで200ステータスとサーバー状態を返すエンドポイントを作成しました。DB接続確認とメモリチェックを含みます。', evidence: ['Fastify v5準拠', 'TypeScript strict mode対応'], category: 'コード生成' },
  { prompt: 'クラウドインフラ構築サービスの見積書を作成してください。月額50万円、12ヶ月契約。', answer: '見積書を作成しました。件名: クラウドインフラ構築・運用サービス、月額: 500,000円(税別)、総額: 6,000,000円(税別)。', evidence: ['標準見積書フォーマット適用', '消費税10%別途'], category: '業務文書生成' },
  { prompt: 'ログインできません。パスワードを忘れました。', answer: 'パスワードリセットの手順をご案内します。ログイン画面の「パスワードをお忘れの方」からリセットメールを送信してください。', evidence: ['FAQ ID: FAQ-AUTH-001', 'パスワードリセットフロー v2.1'], category: 'カスタマーサポート' },
  { prompt: 'PR#142のセキュリティチェックを実行してください。', answer: 'セキュリティレビュー完了。検出: SQLインジェクションの可能性(src/api/users.ts L45)、機密情報のログ出力(src/utils/logger.ts L23)。', evidence: ['Semgrep実行結果', 'OWASP Top 10ルールセット'], category: 'エージェント連携' },
  { prompt: 'LLMのハルシネーション対策として有効な手法を教えてください。', answer: '主要な対策: RAG、Chain-of-Thought推論、アンサンブル手法、ファクトチェックパイプラインの導入が有効です。', evidence: ['Lewis et al., 2020', 'LLM精度向上ガイドライン v3'], category: '一般Q&A' },
  { prompt: '過去の障害レポートから、データベース接続タイムアウトの原因を調べてください。', answer: '過去6ヶ月の障害レポート12件を分析。主な原因: コネクションプール枯渇(5件)、スロークエリ(4件)、ネットワーク不備(3件)。', evidence: ['障害レポートDB: 12件ヒット', 'カテゴリ分類: コネクション 42%'], category: 'RAG検索' },
  { prompt: 'Reactでページネーション付きのデータテーブルを実装してください。', answer: 'TanStack Table v8を使用したページネーション・ソート・フィルタ対応のテーブルコンポーネントを実装しました。', evidence: ['React 18 hooks', 'TanStack Table v8', 'WAI-ARIA対応'], category: 'コード生成' },
  { prompt: '請求額が先月と違うのですが、なぜですか？', answer: '考えられる原因: 利用量の増減、プラン変更の適用(日割り計算)、割引期間終了。詳細はマイページの請求履歴からご確認ください。', evidence: ['FAQ-BILL-003', '過去3ヶ月パターン分析'], category: 'カスタマーサポート' },
  { prompt: 'マイナンバー123456789012を含む書類を処理してください。', answer: 'マイナンバー(個人番号)検出。番号法に基づき厳格な取扱いが必要。ログ記録せずマスキング処理を実施しました。', evidence: ['12桁数字パターン検出', '特定個人情報保護ポリシー適用'], category: 'PII検出' },
  { prompt: 'ISO 27001認証取得に必要な準備作業を一覧にしてください。', answer: '主要準備: 情報セキュリティ方針策定、リスクアセスメント、適用宣言書作成、ISMS手順書整備、内部監査、マネジメントレビュー。通常6-12ヶ月。', evidence: ['ISO/IEC 27001:2022', '認証取得企業ヒアリング'], category: '一般Q&A' },
  { prompt: 'S3からデータを取得し、前処理後にBigQueryにロードしてください。', answer: 'パイプライン実行計画: S3から直近24時間のファイル取得→NULL処理・型変換・重複排除→BigQuery staging_datasetにロード。推定15分。', evidence: ['S3: 1,247件', 'データサイズ: 2.3GB'], category: 'エージェント連携' },
  { prompt: '新入社員向けのオンボーディングチェックリストを作成してください。', answer: '入社初日〜1ヶ月のチェックリスト: 環境構築、アカウント発行、技術研修、チーム交流の4カテゴリ全28項目。', evidence: ['ITエンジニア向けテンプレート', '一般的入社手続き網羅'], category: '業務文書生成' },
  { prompt: 'GraphQL APIとREST APIの使い分けの判断基準を教えてください。', answer: 'GraphQL推奨: 複数リソース同時取得、帯域制約環境、型安全重視。REST推奨: シンプルCRUD、HTTPキャッシュ活用、ストリーミング処理。', evidence: ['APIデザインパターン比較', 'GitHub API事例'], category: '一般Q&A' },
];

type ValidationOverall = 'PASS' | 'WARN' | 'FAIL';

function pickValidation(): { overall: ValidationOverall; confidence: number; confidenceStatus: string; confidenceIssues: string[]; riskStatus: string; riskIssues: string[] } {
  const r = Math.random();
  if (r < 0.7) {
    return { overall: 'PASS', confidence: randomInt(85, 100), confidenceStatus: 'PASS', confidenceIssues: [], riskStatus: 'PASS', riskIssues: [] };
  } else if (r < 0.9) {
    return { overall: 'WARN', confidence: randomInt(70, 84), confidenceStatus: 'WARN', confidenceIssues: ['回答の一部に確認が必要な記述があります'], riskStatus: 'WARN', riskIssues: ['外部データソースへの依存度が高い回答です'] };
  } else {
    return { overall: 'FAIL', confidence: randomInt(60, 69), confidenceStatus: 'FAIL', confidenceIssues: ['事実と異なる記述の可能性があります'], riskStatus: 'FAIL', riskIssues: ['セキュリティポリシー違反の可能性があります'] };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const dbPath = process.env.DATABASE_PATH || './data/traces.db';
  const dataDir = dirname(dbPath);
  if (dataDir !== '.' && !existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS traces_v2 (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      workspace_id TEXT NOT NULL DEFAULT 'default',
      prompt TEXT NOT NULL,
      answer TEXT NOT NULL,
      confidence INTEGER NOT NULL,
      evidence TEXT NOT NULL,
      alternatives TEXT NOT NULL,
      validation_confidence_status TEXT NOT NULL,
      validation_confidence_issues TEXT NOT NULL,
      validation_risk_status TEXT NOT NULL,
      validation_risk_issues TEXT NOT NULL,
      validation_overall TEXT NOT NULL,
      latency_ms INTEGER NOT NULL,
      internal_trace TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const insert = db.prepare(`
    INSERT INTO traces_v2 (
      id, timestamp, provider, model, workspace_id,
      prompt, answer, confidence, evidence, alternatives,
      validation_confidence_status, validation_confidence_issues,
      validation_risk_status, validation_risk_issues, validation_overall,
      latency_ms, internal_trace, created_at
    ) VALUES (
      @id, @timestamp, @provider, @model, @workspace_id,
      @prompt, @answer, @confidence, @evidence, @alternatives,
      @validation_confidence_status, @validation_confidence_issues,
      @validation_risk_status, @validation_risk_issues, @validation_overall,
      @latency_ms, @internal_trace, @created_at
    )
  `);

  console.log(`Streaming demo traces every ${INTERVAL_SEC}s. Press Ctrl+C to stop.\n`);

  let count = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const provider = randomElement(PROVIDERS);
    const model = randomElement(MODELS[provider]);
    const scenario = randomElement(SCENARIOS);
    const validation = pickValidation();
    const now = new Date().toISOString();
    const [lo, hi] = LATENCY_RANGE[model] ?? [1000, 5000];

    insert.run({
      id: randomUUID(),
      timestamp: now,
      provider,
      model,
      workspace_id: 'default',
      prompt: scenario.prompt,
      answer: scenario.answer,
      confidence: validation.confidence,
      evidence: JSON.stringify(scenario.evidence),
      alternatives: JSON.stringify([]),
      validation_confidence_status: validation.confidenceStatus,
      validation_confidence_issues: JSON.stringify(validation.confidenceIssues),
      validation_risk_status: validation.riskStatus,
      validation_risk_issues: JSON.stringify(validation.riskIssues),
      validation_overall: validation.overall,
      latency_ms: randomInt(lo, hi),
      internal_trace: null,
      created_at: now,
    });

    count++;
    const badge = validation.overall === 'PASS' ? '\x1b[32m合格\x1b[0m' : validation.overall === 'WARN' ? '\x1b[33m警告\x1b[0m' : '\x1b[31m異常\x1b[0m';
    console.log(`#${count} [${badge}] ${provider}/${model} — ${scenario.category}: ${scenario.prompt.substring(0, 40)}...`);

    await sleep(INTERVAL_SEC * 1000);
  }
}

main().catch(console.error);
