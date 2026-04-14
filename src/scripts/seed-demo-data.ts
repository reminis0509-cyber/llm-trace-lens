/**
 * seed-demo-data.ts
 *
 * Inserts 25 realistic demo traces into the traces_v2 SQLite table.
 * Usage: npx tsx src/scripts/seed-demo-data.ts
 *
 * This script uses better-sqlite3 directly and is intended for local
 * development / screenshot purposes only.
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TraceRow {
  id: string;
  timestamp: string;
  provider: string;
  model: string;
  workspace_id: string;
  prompt: string;
  answer: string;
  confidence: number;
  evidence: string;
  alternatives: string;
  validation_confidence_status: string;
  validation_confidence_issues: string;
  validation_risk_status: string;
  validation_risk_issues: string;
  validation_overall: string;
  latency_ms: number;
  internal_trace: string | null;
  created_at: string;
}

type ValidationOverall = 'PASS' | 'WARN' | 'FAIL';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(arr: readonly T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

/** Generate a timestamp within the last 7 days, spread roughly evenly */
function generateTimestamp(index: number, total: number): string {
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const offset = (sevenDays / total) * index + randomInt(0, 3600_000);
  const ts = new Date(now - sevenDays + offset);
  return ts.toISOString();
}

/** Realistic latency: most traces 800-4000ms, some up to 15000ms */
function generateLatency(model: string): number {
  const base: Record<string, [number, number]> = {
    'gpt-4o': [1500, 8000],
    'gpt-4o-mini': [800, 3000],
    'claude-3-5-sonnet': [2000, 10000],
    'claude-3-haiku': [600, 2500],
    'gemini-1.5-pro': [2000, 12000],
    'gemini-1.5-flash': [500, 2000],
  };
  const [lo, hi] = base[model] ?? [1000, 5000];
  return randomInt(lo, hi);
}

// ---------------------------------------------------------------------------
// Demo data definitions
// ---------------------------------------------------------------------------

const PROVIDER_MODEL_MAP: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini'],
  anthropic: ['claude-3-5-sonnet', 'claude-3-haiku'],
  gemini: ['gemini-1.5-pro', 'gemini-1.5-flash'],
};

/**
 * Provider assignment: 12 openai, 8 anthropic, 5 gemini = 25 total.
 * We pre-define the provider sequence to guarantee exact counts.
 */
const PROVIDER_SEQUENCE: string[] = [
  ...Array<string>(12).fill('openai'),
  ...Array<string>(8).fill('anthropic'),
  ...Array<string>(5).fill('gemini'),
];

/**
 * Validation distribution: 70% PASS (18), 20% WARN (5), 10% FAIL (2).
 * Rounded to integers that sum to 25.
 */
const VALIDATION_SEQUENCE: ValidationOverall[] = [
  ...Array<ValidationOverall>(18).fill('PASS'),
  ...Array<ValidationOverall>(5).fill('WARN'),
  ...Array<ValidationOverall>(2).fill('FAIL'),
];

interface DemoScenario {
  prompt: string;
  answer: string;
  evidence: string[];
  alternatives: string[];
  category: string;
}

const SCENARIOS: DemoScenario[] = [
  // --- PII detection scenarios ---
  {
    prompt: '山田太郎さんの電話番号は090-1234-5678です。この情報を要約してください。',
    answer: 'お客様の連絡先情報を受領しました。個人情報保護の観点から、電話番号を含む個人情報はマスキング処理を推奨します。要約: 山田様の連絡先が提供されました。',
    evidence: ['入力テキストに電話番号パターン(090-XXXX-XXXX)を検出', 'PII検出ルール: 日本の携帯電話番号'],
    alternatives: ['個人情報を完全に除去した上で要約を生成する方法もあります'],
    category: 'PII検出',
  },
  {
    prompt: '以下のテキストから個人情報を検出してください: 佐藤花子、東京都渋谷区神宮前1-2-3、メール: hanako@example.com',
    answer: '検出された個人情報: (1) 氏名: 佐藤花子 (2) 住所: 東京都渋谷区神宮前1-2-3 (3) メールアドレス: hanako@example.com。合計3件の個人情報が含まれています。',
    evidence: ['氏名パターン検出(漢字姓名)', '住所パターン検出(都道府県+区市町村)', 'メールアドレスパターン検出'],
    alternatives: ['正規表現ベースの検出に加え、NERモデルによる検出も併用可能です'],
    category: 'PII検出',
  },
  {
    prompt: 'マイナンバー123456789012を含む書類を処理してください。',
    answer: 'マイナンバー(個人番号)が検出されました。マイナンバーは特定個人情報に該当するため、番号法に基づき厳格な取扱いが必要です。当該番号はログに記録せず、マスキング処理を実施しました。',
    evidence: ['12桁数字パターンを検出', 'マイナンバー(個人番号)として分類', '特定個人情報保護ポリシー適用'],
    alternatives: ['マイナンバーの利用目的を確認の上、適切な暗号化処理を適用することを推奨します'],
    category: 'PII検出',
  },

  // --- RAG / knowledge retrieval ---
  {
    prompt: '社内ナレッジベースから、AWSのコスト最適化に関するベストプラクティスを検索してください。',
    answer: 'ナレッジベースから3件の関連ドキュメントを取得しました。主なベストプラクティス: (1) リザーブドインスタンスの活用で最大72%コスト削減 (2) 未使用リソースの自動検出と削除 (3) S3ライフサイクルポリシーの設定によるストレージコスト最適化。',
    evidence: ['検索クエリ: "AWS コスト最適化"', '取得ドキュメント数: 3件', '関連度スコア: 0.92, 0.87, 0.81'],
    alternatives: ['Azure や GCP のコスト最適化情報も合わせて検索可能です'],
    category: 'RAG検索',
  },
  {
    prompt: '過去の障害レポートから、データベース接続タイムアウトの原因と対策を調べてください。',
    answer: '過去6ヶ月間の障害レポート12件を分析しました。主な原因: (1) コネクションプール枯渇(5件) (2) スロークエリによるロック競合(4件) (3) ネットワーク設定の不備(3件)。推奨対策: コネクションプール上限の見直しとクエリタイムアウトの設定を推奨します。',
    evidence: ['障害レポートDB検索: 12件ヒット', 'カテゴリ分類: コネクション関連 42%', '直近の類似障害: 2026-03-15'],
    alternatives: ['APMツールのメトリクスと突合することでより精度の高い分析が可能です'],
    category: 'RAG検索',
  },
  {
    prompt: '製品マニュアルから、APIレートリミットの仕様を検索してください。',
    answer: 'APIレートリミット仕様: Freeプランは100リクエスト/分、Proプランは1,000リクエスト/分、Enterpriseプランは10,000リクエスト/分です。レート超過時は429ステータスコードとRetry-Afterヘッダーが返されます。',
    evidence: ['マニュアルv2.3 セクション4.2「APIリミット」を参照', '最終更新日: 2026-03-01'],
    alternatives: ['カスタムレートリミットの設定方法についてもドキュメントがあります'],
    category: 'RAG検索',
  },

  // --- Code generation ---
  {
    prompt: 'TypeScriptでFastifyのヘルスチェックエンドポイントを作成してください。',
    answer: 'Fastifyのヘルスチェックエンドポイントを作成しました。GET /healthで200ステータスとサーバー状態を返すシンプルなエンドポイントです。データベース接続確認とメモリ使用量のチェックも含めています。',
    evidence: ['Fastify v5 公式ドキュメント準拠', 'TypeScript strict mode対応'],
    alternatives: ['Kubernetesのliveness/readinessプローブに対応した形式も実装可能です'],
    category: 'コード生成',
  },
  {
    prompt: 'PythonでCSVファイルを読み込み、売上データの月次集計を行うスクリプトを生成してください。',
    answer: 'pandasを使用した月次売上集計スクリプトを生成しました。CSVの読み込み、日付型への変換、月別グルーピング、合計・平均・前月比の算出を行います。結果はExcelファイルとして出力されます。',
    evidence: ['pandas 2.x API準拠', 'CSVエンコーディング: UTF-8, Shift-JIS両対応'],
    alternatives: ['polarsライブラリを使用すると大規模データでより高速に処理できます'],
    category: 'コード生成',
  },
  {
    prompt: 'Reactでページネーション付きのデータテーブルコンポーネントを実装してください。',
    answer: 'React 18対応のページネーション付きテーブルコンポーネントを実装しました。TanStack Table v8を使用し、ソート・フィルタ・ページサイズ変更に対応しています。TailwindCSSでスタイリングしています。',
    evidence: ['React 18 hooks API使用', 'TanStack Table v8準拠', 'アクセシビリティ: WAI-ARIA対応'],
    alternatives: ['MUI DataGridやAG Gridなどの既製コンポーネントの利用も検討できます'],
    category: 'コード生成',
  },

  // --- Business document generation ---
  {
    prompt: 'クラウドインフラ構築サービスの見積書テンプレートを作成してください。月額50万円、12ヶ月契約。',
    answer: '見積書テンプレートを作成しました。件名: クラウドインフラ構築・運用サービス、月額費用: 500,000円(税別)、契約期間: 12ヶ月、総額: 6,000,000円(税別)。初期構築費用、月額運用費用、オプション費用の3セクションで構成しています。',
    evidence: ['標準見積書フォーマット適用', '消費税10%別途計算済み'],
    alternatives: ['年間一括払いの場合5%割引を適用した見積もりも作成可能です'],
    category: '業務文書生成',
  },
  {
    prompt: '3月25日のプロジェクト定例会議の議事録を作成してください。参加者: 田中PM、鈴木エンジニア、高橋デザイナー。',
    answer: '議事録を作成しました。日時: 2026年3月25日 14:00-15:00、場所: オンライン(Zoom)。主な議題: (1) スプリント進捗報告 - 予定通り (2) UI改修の優先順位決定 - ダッシュボード刷新を最優先に (3) 次回リリース日程 - 4月1日に確定。アクションアイテム3件を記録しました。',
    evidence: ['会議テンプレートv3適用', '発言者の所属・役職を自動付与'],
    alternatives: ['音声データからの自動文字起こしと連携した議事録生成も可能です'],
    category: '業務文書生成',
  },
  {
    prompt: '新入社員向けのオンボーディングチェックリストを作成してください。IT企業、エンジニア職。',
    answer: '入社初日から1ヶ月目までのオンボーディングチェックリストを作成しました。カテゴリ: (1) 環境構築(開発PC設定、Git/IDE設定) (2) アカウント発行(Slack、Jira、AWS) (3) 技術研修(アーキテクチャ概要、コーディング規約) (4) チーム交流(1on1、ランチ会)。全28項目で構成しています。',
    evidence: ['IT企業エンジニア向けテンプレート適用', '一般的な入社手続き項目を網羅'],
    alternatives: ['部署別のカスタマイズや、管理職向けチェックリストも作成可能です'],
    category: '業務文書生成',
  },

  // --- Customer support bot ---
  {
    prompt: 'お客様からの問い合わせ: 「ログインできません。パスワードを忘れました。」への回答を生成してください。',
    answer: 'パスワードリセットの手順をご案内いたします。(1) ログイン画面の「パスワードをお忘れの方」をクリック (2) 登録メールアドレスを入力 (3) 届いたメールのリンクから新しいパスワードを設定してください。メールが届かない場合は、迷惑メールフォルダをご確認ください。',
    evidence: ['FAQ ID: FAQ-AUTH-001 を参照', 'パスワードリセットフロー v2.1 準拠'],
    alternatives: ['2段階認証を設定されている場合は、別途リカバリーコードでの復旧手順をご案内します'],
    category: 'カスタマーサポート',
  },
  {
    prompt: '「請求額が先月と違うのですが、なぜですか？」というお客様の問い合わせに回答してください。',
    answer: '請求額の変動について確認いたしました。考えられる主な原因: (1) ご利用量の増減(APIコール数やデータ転送量の変動) (2) プラン変更の適用(日割り計算が発生) (3) 割引キャンペーンの適用期間終了。詳細な明細はマイページの「請求履歴」からご確認いただけます。',
    evidence: ['請求FAQ ID: FAQ-BILL-003 参照', '過去3ヶ月の請求パターンを分析'],
    alternatives: ['個別の請求明細を確認するため、お客様IDの提供をお願いする方法もあります'],
    category: 'カスタマーサポート',
  },
  {
    prompt: '「APIのレスポンスが遅いです」というお客様へのトラブルシューティング回答を作成してください。',
    answer: 'APIレスポンスの遅延について、以下の確認をお願いいたします。(1) ステータスページ(status.example.com)で現在の稼働状況をご確認ください (2) リクエストサイズが大きい場合、ページネーションの利用を推奨します (3) 特定のエンドポイントのみ遅い場合は、エンドポイント名をお知らせください。',
    evidence: ['システムステータス: 正常稼働中', 'P95レイテンシ: 現在230ms(通常範囲内)'],
    alternatives: ['ネットワークレイテンシの問題の場合、最寄りのリージョン利用を提案する方法もあります'],
    category: 'カスタマーサポート',
  },

  // --- Agent orchestration ---
  {
    prompt: 'マルチエージェントワークフロー: 市場調査エージェントの結果を基に、競合分析レポートを生成してください。',
    answer: '市場調査エージェントから受信したデータを基に競合分析レポートを生成しました。主要競合3社の比較: 機能カバレッジ、価格帯、ターゲット市場、強み・弱みを4象限マトリクスで整理しています。当社の差別化ポイントとして国内データ保持とPII検出機能を強調しています。',
    evidence: ['市場調査エージェント実行結果(trace-id: agent-mkt-001)', 'データソース: 公開IR情報、プレスリリース'],
    alternatives: ['SNS分析エージェントの結果も統合することで、ユーザー評判の分析を追加できます'],
    category: 'エージェント連携',
  },
  {
    prompt: 'データパイプラインエージェント: S3からデータを取得し、前処理後にBigQueryにロードしてください。',
    answer: 'データパイプラインの実行計画を作成しました。ステップ1: S3バケット(s3://data-lake/raw/)から直近24時間のファイルを取得。ステップ2: NULL値処理、型変換、重複排除の前処理を実施。ステップ3: BigQueryのstaging_datasetにロード。推定処理時間: 約15分。',
    evidence: ['S3オブジェクト数: 1,247件', '合計データサイズ: 2.3GB', 'BigQuery書き込みクォータ: 残り80%'],
    alternatives: ['Apache Airflow DAGとして定義し、スケジュール実行に移行することも可能です'],
    category: 'エージェント連携',
  },
  {
    prompt: 'コードレビューエージェント: プルリクエスト#142のセキュリティチェックを実行してください。',
    answer: 'PR#142のセキュリティレビューを完了しました。検出事項: (1) 重要度高: SQLインジェクションの可能性(src/api/users.ts L45) - パラメータ化クエリへの修正を推奨 (2) 重要度中: 機密情報のログ出力(src/utils/logger.ts L23) - マスキング処理の追加を推奨。それ以外のファイルは問題ありません。',
    evidence: ['静的解析ツール: Semgrep実行結果', '対象ファイル数: 8件', 'ルールセット: OWASP Top 10'],
    alternatives: ['動的解析(DAST)も併用することで、ランタイム脆弱性の検出も可能です'],
    category: 'エージェント連携',
  },

  // --- General Q&A ---
  {
    prompt: 'LLMのハルシネーション対策として有効な手法を教えてください。',
    answer: '主要なハルシネーション対策として以下が有効です。(1) RAG(検索拡張生成)による事実に基づいた回答生成 (2) Chain-of-Thought推論で段階的に論理を検証 (3) 複数モデルの回答を比較するアンサンブル手法 (4) 出力の事実検証を行うファクトチェックパイプラインの導入。',
    evidence: ['学術論文: "Retrieval-Augmented Generation" (Lewis et al., 2020)', '実務レポート: LLM精度向上ガイドライン v3'],
    alternatives: ['ドメイン特化のファインチューニングにより、特定分野での精度を向上させる方法もあります'],
    category: '一般Q&A',
  },
  {
    prompt: 'Kubernetesクラスターのオートスケーリング設定のベストプラクティスを教えてください。',
    answer: 'Kubernetesオートスケーリングの推奨設定: (1) HPAのCPU閾値は70%を推奨(急激なスパイクに対応するマージン) (2) minReplicasは最低2(可用性確保) (3) Cluster AutoscalerとHPAの連携設定 (4) PDB(Pod Disruption Budget)でローリングアップデート時の可用性を担保。',
    evidence: ['Kubernetes公式ドキュメント v1.29', 'CNCF ベストプラクティスガイド'],
    alternatives: ['KEDA(Kubernetes Event-Driven Autoscaler)を使用したイベント駆動スケーリングも検討できます'],
    category: '一般Q&A',
  },
  {
    prompt: 'ISO 27001認証取得に必要な準備作業を一覧にしてください。',
    answer: 'ISO 27001認証取得の主要準備作業: (1) 情報セキュリティ方針の策定 (2) リスクアセスメントの実施と管理策の選定 (3) 適用宣言書(SoA)の作成 (4) ISMS運用手順書の整備 (5) 内部監査の実施 (6) マネジメントレビューの実施。通常6-12ヶ月の準備期間が必要です。',
    evidence: ['ISO/IEC 27001:2022規格要求事項', '認証取得実績のある企業へのヒアリング結果'],
    alternatives: ['SOC 2 Type IIなど他のセキュリティ認証との並行取得も効率的です'],
    category: '一般Q&A',
  },
  {
    prompt: '日本語の自然言語処理で、形態素解析エンジンの選定基準を教えてください。',
    answer: '日本語形態素解析エンジンの選定基準: (1) 解析精度 - MeCab(IPAdic)が汎用テキストで高精度 (2) 処理速度 - Sudachiが大規模テキストで優位 (3) 新語対応 - NEologdやSudachiのシステム辞書が充実 (4) ライセンス - 商用利用可否の確認が必要。用途に応じてSudachiまたはMeCab+NEologdの組み合わせを推奨します。',
    evidence: ['ベンチマーク比較: 日本語NLP評価データセット(2025年版)', 'GitHub Star数およびコミュニティ活発度'],
    alternatives: ['大規模言語モデルによるゼロショット形態素解析も精度が向上しており、選択肢に入ります'],
    category: '一般Q&A',
  },
  {
    prompt: 'GraphQL APIとREST APIの使い分けの判断基準を説明してください。',
    answer: '判断基準として以下を提案します。GraphQL推奨: (1) フロントエンドが複数のリソースを1回のリクエストで取得したい場合 (2) モバイルアプリなど帯域制約がある環境 (3) 型安全なスキーマ駆動開発を重視する場合。REST推奨: (1) シンプルなCRUD操作が中心 (2) HTTPキャッシュを活用したい場合 (3) ファイルアップロードなどストリーミング処理がある場合。',
    evidence: ['APIデザインパターン比較(O\'Reilly, 2024)', 'GitHub API v3/v4の事例分析'],
    alternatives: ['gRPCをマイクロサービス間通信に、GraphQLをBFF層に配置するハイブリッド構成も有効です'],
    category: '一般Q&A',
  },
  {
    prompt: 'SaaSプロダクトのセキュリティチェックシートへの回答を支援してください。SOC2対応状況について。',
    answer: 'SOC 2対応状況のチェックシート回答案を作成しました。(1) アクセス制御: RBAC実装済み、MFA必須化済み (2) データ暗号化: 保存時AES-256、転送時TLS 1.3 (3) 監査ログ: 全API操作を記録、90日間保持 (4) インシデント対応: 24時間以内の初期対応体制を構築済み。各項目にエビデンスのリンクを付与しています。',
    evidence: ['SOC 2 Type II 監査基準(Trust Services Criteria)', '社内セキュリティポリシー v4.2'],
    alternatives: ['ISO 27017(クラウドセキュリティ)の観点からも回答を補強することが可能です'],
    category: '業務文書生成',
  },
  {
    prompt: 'OpenTelemetryを使ったLLMアプリケーションの分散トレーシング導入手順を教えてください。',
    answer: 'LLMアプリケーションへのOpenTelemetry導入手順: (1) SDKのインストール(@opentelemetry/sdk-node) (2) TracerProviderの初期化とエクスポーター設定(OTLP/gRPC推奨) (3) LLM呼び出し箇所へのSpan計装(モデル名、トークン数、レイテンシを属性に記録) (4) コレクターの設定とバックエンドへの転送。LLM固有のセマンティック規約はOpenLLMetryを参考にしてください。',
    evidence: ['OpenTelemetry公式ドキュメント v1.x', 'OpenLLMetry セマンティック規約 draft'],
    alternatives: ['Langfuse や LangSmith などの専用LLMオブザーバビリティツールの利用も選択肢です'],
    category: '一般Q&A',
  },
];

// ---------------------------------------------------------------------------
// Validation data generators
// ---------------------------------------------------------------------------

function buildValidation(overall: ValidationOverall, scenario: DemoScenario): {
  confidenceStatus: string;
  confidenceIssues: string[];
  riskStatus: string;
  riskIssues: string[];
  confidence: number;
} {
  switch (overall) {
    case 'PASS':
      return {
        confidenceStatus: 'PASS',
        confidenceIssues: [],
        riskStatus: 'PASS',
        riskIssues: [],
        confidence: randomInt(85, 100),
      };
    case 'WARN': {
      const warnIssues = [
        '回答の一部に確認が必要な記述があります',
        '参照元の情報が古い可能性があります',
        '複数の解釈が可能な曖昧な表現が含まれています',
      ];
      const riskIssues = scenario.category === 'PII検出'
        ? ['個人情報を含む入力が検出されました']
        : ['外部データソースへの依存度が高い回答です'];
      return {
        confidenceStatus: 'WARN',
        confidenceIssues: [randomElement(warnIssues)],
        riskStatus: 'WARN',
        riskIssues: [randomElement(riskIssues)],
        confidence: randomInt(70, 84),
      };
    }
    case 'FAIL': {
      return {
        confidenceStatus: 'FAIL',
        confidenceIssues: [
          '回答に事実と異なる記述が含まれている可能性があります',
          'ソースデータとの整合性が確認できません',
        ],
        riskStatus: 'FAIL',
        riskIssues: [
          '機密情報がマスキングされずに出力されています',
          'セキュリティポリシー違反の可能性があります',
        ],
        confidence: randomInt(60, 69),
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const dbPath = process.env.DATABASE_PATH || './data/traces.db';

  // Ensure data directory exists
  const dataDir = dirname(dbPath);
  if (dataDir !== '.' && !existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Ensure table exists (run migration SQL if needed)
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

  // Add workspace_id column if it does not exist (older schema compatibility)
  const columns = db.prepare('PRAGMA table_info(traces_v2)').all() as Array<{ name: string }>;
  const hasWorkspaceId = columns.some((col) => col.name === 'workspace_id');
  if (!hasWorkspaceId) {
    db.exec(`ALTER TABLE traces_v2 ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default'`);
    console.log('Added missing workspace_id column to traces_v2');
  }

  // Clear existing demo data
  const deleteResult = db.prepare(
    `DELETE FROM traces_v2 WHERE workspace_id = ?`
  ).run('default');
  console.log(`Cleared ${deleteResult.changes} existing rows (workspace_id = 'default')`);

  // Shuffle providers and validations for natural distribution
  const providers = [...PROVIDER_SEQUENCE].sort(() => Math.random() - 0.5);
  const validations = [...VALIDATION_SEQUENCE].sort(() => Math.random() - 0.5);

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

  const insertMany = db.transaction((rows: TraceRow[]) => {
    for (const row of rows) {
      insert.run(row);
    }
  });

  const rows: TraceRow[] = [];

  for (let i = 0; i < 25; i++) {
    const provider = providers[i];
    const models = PROVIDER_MODEL_MAP[provider];
    const model = randomElement(models);
    const scenario = SCENARIOS[i];
    const overall = validations[i];
    const validation = buildValidation(overall, scenario);
    const timestamp = generateTimestamp(i, 25);

    rows.push({
      id: randomUUID(),
      timestamp,
      provider,
      model,
      workspace_id: 'default',
      prompt: scenario.prompt,
      answer: scenario.answer,
      confidence: validation.confidence,
      evidence: JSON.stringify(scenario.evidence),
      alternatives: JSON.stringify(scenario.alternatives),
      validation_confidence_status: validation.confidenceStatus,
      validation_confidence_issues: JSON.stringify(validation.confidenceIssues),
      validation_risk_status: validation.riskStatus,
      validation_risk_issues: JSON.stringify(validation.riskIssues),
      validation_overall: overall,
      latency_ms: generateLatency(model),
      internal_trace: null,
      created_at: timestamp,
    });
  }

  insertMany(rows);

  // Print summary
  const stats = db
    .prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN provider = 'openai' THEN 1 ELSE 0 END) as openai,
        SUM(CASE WHEN provider = 'anthropic' THEN 1 ELSE 0 END) as anthropic,
        SUM(CASE WHEN provider = 'gemini' THEN 1 ELSE 0 END) as gemini,
        SUM(CASE WHEN validation_overall = 'PASS' THEN 1 ELSE 0 END) as pass,
        SUM(CASE WHEN validation_overall = 'WARN' THEN 1 ELSE 0 END) as warn,
        SUM(CASE WHEN validation_overall = 'FAIL' THEN 1 ELSE 0 END) as fail,
        MIN(confidence) as min_conf,
        MAX(confidence) as max_conf,
        ROUND(AVG(confidence), 1) as avg_conf,
        MIN(latency_ms) as min_latency,
        MAX(latency_ms) as max_latency,
        ROUND(AVG(latency_ms), 0) as avg_latency
      FROM traces_v2
      WHERE workspace_id = 'default'`
    )
    .get() as Record<string, number>;

  console.log('\n--- Seed Summary ---');
  console.log(`Total traces:   ${stats.total}`);
  console.log(`Providers:      openai=${stats.openai}, anthropic=${stats.anthropic}, gemini=${stats.gemini}`);
  console.log(`Validation:     PASS=${stats.pass}, WARN=${stats.warn}, FAIL=${stats.fail}`);
  console.log(`Confidence:     min=${stats.min_conf}, max=${stats.max_conf}, avg=${stats.avg_conf}`);
  console.log(`Latency (ms):   min=${stats.min_latency}, max=${stats.max_latency}, avg=${stats.avg_latency}`);
  console.log('\nDone. Demo data inserted into traces_v2.');

  db.close();
}

main();
