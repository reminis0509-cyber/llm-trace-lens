# LLM Trace Lens - 実装状況レポート

**作成日**: 2026年2月12日
**最終更新**: 2026年2月18日
**バージョン**: 0.5.0
**ステータス**: MVP完成 + SaaS化完了 + エンタープライズ機能追加 + ストレージ最適化 + LLM-as-Judge評価

---

## 1. プロジェクト概要

LLM Trace Lensは、LLMの出力を可観測化するプロキシサーバーです。LLMに構造化レスポンスを強制し、その出力を検証・記録することで、LLMの「嘘」や「自信過剰」を検出します。

### 設計思想
- **今すぐ動く**: 構造化レスポンス強制 + ルールベース検証で即座に価値提供
- **将来も拡張できる**: L3/L4内部トレース用のインターフェースを事前に用意
- **顧客データが資産になる**: 全トレースを保存し、分析可能に

詳細は [DESIGN_PHILOSOPHY.md](./DESIGN_PHILOSOPHY.md) を参照。

---

## 2. 実装済み機能

### 2.1 バックエンドサーバー

| 機能 | 状態 | 説明 |
|------|------|------|
| OpenAI互換API | ✅ | `/v1/chat/completions` エンドポイント |
| 構造化レスポンス強制 | ✅ | answer, confidence, evidence, alternatives |
| JSONパースリトライ | ✅ | フォールバック対応 |
| 検証エンジン | ✅ | ConfidenceValidator + RiskScanner |
| Confidence検証 | ✅ | エビデンス数との整合性チェック |
| PII/機密データ検出 | ✅ | SSN, クレカ, メールアドレス |
| 日本語PII検出 | ✅ | マイナンバー, 銀行口座, 電話番号等 |
| SQLiteストレージ | ✅ | トレース永続化 |
| トレースAPI | ✅ | 一覧/詳細/統計エンドポイント |
| ストリーミング対応 | ✅ | SSEによるリアルタイムレスポンス |
| APIキー認証 | ✅ | オプションのBearer認証 |
| 自動テスト基盤 | ✅ | Vitest + 70テストケース |
| Webhook即時アラート | ✅ | BLOCK/WARN/COSTイベント通知 |
| コストトラッキング | ✅ | モデル別使用量・コスト集計 |
| 予算アラート | ✅ | 月次予算の閾値アラート |
| **マルチテナント** | ✅ | ワークスペース分離・APIキー認証 |
| **カスタム検証ルール** | ✅ | ワークスペース別ブロックパターン |
| **ストレージ選択** | ✅ | KV/PostgreSQL/SQLite切り替え |
| **月次PDFレポート** | ✅ | 自動生成・メール送信 |
| **OAuth/SSO** | ✅ | Google/Microsoft Entra ID対応 |
| **閾値ブラックボックス化** | ✅ | リスクスコアリング・Admin API |
| **フィードバック機能** | ✅ | 誤検知フィードバック・パターン分析 |
| **Slack/Teams連携** | ✅ | Webhook通知・Block Kit/Adaptive Cards |
| **PostgreSQLデフォルト化** | ✅ NEW | 本番推奨ストレージをPostgreSQLに変更 |
| **KV保持ポリシー** | ✅ NEW | 自動削除・使用量監視・警告表示 |

### 2.2 対応LLMプロバイダ

| プロバイダ | 状態 | 対応モデル例 | ストリーミング |
|-----------|------|-------------|--------------|
| OpenAI | ✅ | gpt-4, gpt-4o, gpt-4o-mini, o1 | ✅ |
| Anthropic | ✅ | claude-opus-4, claude-sonnet-4 | ✅ |
| Gemini | ✅ | gemini-1.5-pro, gemini-2.0-flash | ✅ NEW |
| DeepSeek | ✅ | deepseek-chat, deepseek-reasoner | ✅ NEW |

### 2.3 ダッシュボード

| 機能 | 状態 | 説明 |
|------|------|------|
| トレース一覧 | ✅ | フィルタリング（レベル/プロバイダ） |
| トレース詳細 | ✅ | 構造化レスポンス、検証結果表示 |
| 統計パネル | ✅ | サマリーカード、チャート |
| リアルタイム更新 | ✅ | 手動リフレッシュ |
| セットアップウィザード | ✅ | 3ステップの初期設定UI |
| 設定管理 | ✅ | APIキー・検証ルール設定 |
| Webhook設定UI | ✅ | URL・イベント・テスト送信 |
| コスト表示 | ✅ | 月次コスト・予算進捗バー |
| 予算設定UI | ✅ | 月次予算・閾値設定 |
| **カスタムルールUI** | ✅ | パターン追加・テスト機能 |
| **OAuth/SSOログイン** | ✅ | Google/Microsoft認証 |
| **フィードバックボタン** | ✅ NEW | トレース詳細からフィードバック送信 |
| **Analyticsページ** | ✅ | フィードバック統計・パターン分析 |
| **Integrationsページ** | ✅ | Slack/Teams Webhook設定UI |
| **ストレージ使用量表示** | ✅ | KV使用量ゲージ・警告表示 |
| **LLM-as-Judge評価** | ✅ NEW | Faithfulness・Answer Relevance自動評価 |

### 2.4 SaaS / Vercelデプロイ対応

| 機能 | 状態 | 説明 |
|------|------|------|
| Vercel Serverless | ✅ | `api/index.ts` エントリポイント |
| Vercel KV統合 | ✅ | 設定・トレース・コスト永続化 |
| ゼロタッチセットアップ | ✅ | URLアクセス → 設定 → 即利用可能 |
| 設定API | ✅ | `/api/settings` エンドポイント |
| Webhook設定API | ✅ | `/api/webhook/*` エンドポイント |
| 予算設定API | ✅ | `/api/budget/*` エンドポイント |
| **PostgreSQL/Supabase対応** | ✅ NEW | 自己ホスト可能なストレージ |
| **マルチテナントAPI** | ✅ NEW | ワークスペース分離 |

---

## 3. v0.5.0 新機能（2026年2月18日）

### 3.0 LLM-as-Judge評価エンジン（Phase 1 MVP）

LLMの回答品質を別のLLMで自動評価する機能を追加しました。RAG評価で標準的なFaithfulness（忠実性）とAnswer Relevance（回答関連性）の2指標を計算します。

**実装内容:**

1. **評価エンジン**
   - OpenAI API（gpt-4o-mini）を使用した自動評価
   - Faithfulness: 回答が入力コンテキストに基づいているか（0-1スコア）
   - Answer Relevance: 回答が質問に対して適切か（0-1スコア）
   - Fire-and-forget方式でレスポンス遅延なし

2. **ダッシュボード表示**
   - トレース詳細画面に評価スコアを表示
   - プログレスバーとカラーコード（緑: 高、黄: 中、赤: 低）
   - 評価モデル・評価時刻の表示

3. **ストレージ対応**
   - 評価結果をトレースに付加して保存
   - KV/PostgreSQL/SQLite全対応

**新規ファイル:**
- `src/evaluation/types.ts` - 評価結果の型定義
- `src/evaluation/prompts.ts` - LLM-as-Judge用プロンプトテンプレート
- `src/evaluation/index.ts` - 評価エンジン本体
- `src/tests/evaluation/faithfulness.test.ts` - 評価機能テスト
- `packages/dashboard/src/components/EvaluationScores.tsx` - 評価スコア表示コンポーネント

**変更ファイル:**
- `src/config.ts` - ENABLE_EVALUATION, EVALUATION_MODEL追加
- `src/types/index.ts` - Trace型にevaluationフィールド追加
- `src/proxy/handler.ts` - 評価の非同期実行追加
- `src/storage/adapter.ts` - updateTraceEvaluation追加
- `src/kv/client.ts` - updateTraceEvaluation追加
- `packages/dashboard/src/types/index.ts` - EvaluationResult型追加
- `packages/dashboard/src/components/TraceDetail.tsx` - 評価スコア表示追加

**環境変数:**
```bash
# LLM-as-Judge評価（デフォルト: 無効）
ENABLE_EVALUATION=false  # true で有効化
EVALUATION_MODEL=gpt-4o-mini  # 評価に使用するモデル
```

**型定義:**
```typescript
interface EvaluationResult {
  faithfulness: number | null;    // 0-1（コンテキスト忠実性）
  answerRelevance: number | null; // 0-1（質問への関連性）
  evaluatedAt: string;            // ISO 8601形式
  evaluationModel: string;        // 使用した評価モデル
  error?: string;                 // エラー時のメッセージ
}
```

**動作フロー:**
1. プロキシがLLMレスポンスを受信
2. トレースを保存
3. `ENABLE_EVALUATION=true` の場合、バックグラウンドで評価を開始（Fire-and-forget）
4. 評価完了後、ストレージの該当トレースを更新
5. ダッシュボードで評価スコアを表示

**テスト結果:**
```
 ✓ src/tests/evaluation/faithfulness.test.ts (8 tests)

 Test Files  15 passed (15)
      Tests  138 passed (138)
```

---

## 4. v0.4.1 新機能（2026年2月16日）

### 3.0 PostgreSQLデフォルト化 + KV保持ポリシー（Priority S）

本番運用の推奨ストレージをPostgreSQLに変更し、KVストレージには自動削除機能を追加しました。

**変更内容:**

1. **PostgreSQLをデフォルトに**
   - `DATABASE_TYPE`のデフォルト値を`kv`から`postgres`に変更
   - セットアップウィザードでPostgreSQLが「推奨」として表示
   - README/env.exampleにストレージ選択ガイドを追加

2. **KV保持ポリシー機能**
   - `MAX_TRACES`: ワークスペースあたりの最大トレース数（デフォルト: 5000）
   - `MAX_AGE_DAYS`: トレース保存期間（デフォルト: 30日）
   - 保存時に自動でバックグラウンド削除を実行

3. **使用量監視API**
   - `GET /api/storage/usage`: 現在のストレージ使用量を取得
   - `GET /api/storage/info`: ストレージ設定情報を取得

4. **ダッシュボード使用量表示**
   - Statsタブに使用量ゲージを追加（KV使用時のみ表示）
   - 80%で黄色警告、95%で赤色警告を表示
   - PostgreSQL移行の推奨メッセージを表示

**新規/変更ファイル:**
- `src/config.ts` - MAX_TRACES, MAX_AGE_DAYS, databaseType追加
- `src/storage/adapter.ts` - KVStorageAdapterに_enforceStorageLimit, getStats追加
- `src/routes/storage.ts` - 使用量API新規追加
- `packages/dashboard/src/components/StorageUsage.tsx` - 使用量コンポーネント
- `packages/dashboard/src/pages/Setup.tsx` - ストレージ選択UI追加
- `src/tests/storage/limit-enforcement.test.ts` - テスト追加

**環境変数:**
```bash
# ストレージ選択（デフォルト: postgres）
DATABASE_TYPE=postgres  # postgres（推奨）, kv, sqlite

# KV保持ポリシー（KV使用時のみ）
MAX_TRACES=5000         # 最大トレース数
MAX_AGE_DAYS=30         # 保存期間（日数）
```

**API:**
```bash
# 使用量取得
curl http://localhost:3000/api/storage/usage

# レスポンス例（KV）
{
  "currentCount": 2500,
  "maxCount": 5000,
  "maxAgeDays": 30,
  "oldestDate": "2026-01-17T00:00:00.000Z",
  "usagePercent": 50,
  "storageType": "kv"
}

# レスポンス例（PostgreSQL - 無制限）
{
  "currentCount": 0,
  "maxCount": -1,
  "maxAgeDays": -1,
  "oldestDate": null,
  "usagePercent": 0,
  "storageType": "postgres"
}
```

---

## 5. v0.4.0 新機能（2026年2月15日）

### 4.1 閾値のブラックボックス化（Priority S）

クライアントにスコアリング閾値を直接返さず、抽象化されたリスクレベルのみを返すように変更しました。

**実装内容:**
- **RiskScorer クラス**: ワークスペース別のスコアリングウェイトとリスクレベル閾値を管理
- **Admin API**: 管理者のみが閾値を設定できるエンドポイント（Bearer認証）
- **サニタイズ機能**: レスポンスから生の閾値情報を除去

**新規ファイル:**
- `src/validation/scoring.ts` - RiskScorer実装
- `src/routes/admin.ts` - 管理者API
- `migrations/004_add_validation_config.ts` - 設定テーブル
- `src/tests/validation/scoring.test.ts` - テストケース

**Admin API:**
```bash
# 全ワークスペースの閾値取得
curl http://localhost:3000/admin/thresholds \
  -H "Authorization: Bearer $ADMIN_API_KEY"

# ワークスペースの閾値更新
curl -X PUT http://localhost:3000/admin/thresholds/ws_123 \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "configType": "scoring_weights",
    "configData": {
      "confidenceWeight": 0.4,
      "evidenceWeight": 0.3,
      "piiWeight": 0.2,
      "historicalWeight": 0.1
    }
  }'

# 閾値リセット
curl -X POST http://localhost:3000/admin/thresholds/reset/ws_123 \
  -H "Authorization: Bearer $ADMIN_API_KEY"
```

**リスクスコア計算:**
```typescript
// 重み付きスコア計算（0-100）
score = confidenceScore * 0.4 +
        evidenceScore * 0.3 +
        piiScore * 0.2 +
        historicalScore * 0.1

// レベル判定
high:   score >= 70
medium: score >= 40
low:    score < 40
```

### 4.2 フィードバック機能（Priority A）

誤検知（false positive/negative）のフィードバック収集と分析機能を実装しました。

**実装内容:**
- **Feedback API**: トレースへのフィードバック送信・取得
- **FeedbackButton コンポーネント**: ダッシュボードUI
- **Analytics ページ**: フィードバック統計の可視化
- **パターン分析**: 誤検知パターンの特定

**新規ファイル:**
- `src/routes/feedback.ts` - Feedback API
- `migrations/005_add_feedback.ts` - フィードバックテーブル
- `packages/dashboard/src/components/FeedbackButton.tsx`
- `packages/dashboard/src/pages/Analytics.tsx`

**Feedback API:**
```bash
# フィードバック送信
curl -X POST http://localhost:3000/traces/trace_123/feedback \
  -H "x-api-key: ltl_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "feedbackType": "false_positive",
    "reason": "This is a test environment, not real PII"
  }'

# 統計取得
curl http://localhost:3000/feedback/stats \
  -H "x-api-key: ltl_your_key"

# パターン分析
curl "http://localhost:3000/feedback/patterns?type=false_positive" \
  -H "x-api-key: ltl_your_key"
```

**フィードバック種別:**
| 種別 | 説明 |
|------|------|
| `false_positive` | 正常なのにブロックされた |
| `false_negative` | ブロックすべきなのに通過した |
| `correct` | 正しい判定 |

### 4.3 Slack/Teams連携（Priority B）

Slack/Microsoft Teamsへのリアルタイム通知を実装しました。

**実装内容:**
- **Slack Block Kit**: リッチなメッセージフォーマット
- **Teams Adaptive Cards**: インタラクティブなカード表示
- **Integration API**: Webhook接続テスト・サンプル送信
- **Integrations ページ**: ダッシュボードでの設定UI

**新規ファイル:**
- `src/integrations/slack.ts` - Slack統合
- `src/integrations/teams.ts` - Teams統合
- `src/routes/integrations.ts` - Integration API
- `packages/dashboard/src/pages/Integrations.tsx`

**Integration API:**
```bash
# 接続テスト
curl -X POST http://localhost:3000/integrations/test \
  -H "x-api-key: ltl_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://hooks.slack.com/services/...",
    "platform": "Slack"
  }'

# サンプル通知送信
curl -X POST http://localhost:3000/integrations/send-sample \
  -H "x-api-key: ltl_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://hooks.slack.com/services/...",
    "platform": "Slack",
    "riskLevel": "high"
  }'

# 対応プラットフォーム一覧
curl http://localhost:3000/integrations/supported \
  -H "x-api-key: ltl_your_key"
```

**Slack Block Kit 通知例:**
```
🚨 High Risk Alert
━━━━━━━━━━━━━━━━━━
Risk Score: 85/100
Provider: openai / gpt-4
Explanation: 個人情報を含む。リスクが高いため注意が必要です。
━━━━━━━━━━━━━━━━━━
[View in Dashboard]
```

### 4.4 Gemini/DeepSeek ストリーミング対応（既存）

全4プロバイダでSSEストリーミングをサポートしました。

**新規メソッド:**
- `GeminiEnforcer.enforceStream()` - Gemini APIストリーミング
- `DeepSeekEnforcer.enforceStream()` - DeepSeek APIストリーミング

**ファイル変更:**
- `src/enforcer/gemini.ts` - enforceStream追加
- `src/enforcer/deepseek.ts` - enforceStream追加
- `src/proxy/handler.ts` - 4プロバイダ対応

**テスト:**
```bash
# Geminiストリーミング
curl -N -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"provider":"gemini","model":"gemini-1.5-pro","prompt":"Hello","stream":true}'

# DeepSeekストリーミング
curl -N -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"provider":"deepseek","model":"deepseek-chat","prompt":"Hello","stream":true}'
```

### 4.5 マルチテナント対応（既存）

ワークスペースによるデータ分離を実現しました。

**特徴:**
- ワークスペース単位のトレース分離
- APIキーによるワークスペース認証
- ワークスペース別コスト集計
- ワークスペース別カスタムルール

**新規ファイル:**
- `src/storage/models.ts` - Workspace, ApiKey等のモデル定義
- `src/auth/google.ts` - Google OAuth認証
- `migrations/002_add_workspace.ts` - ワークスペーステーブル追加

**API:**
```bash
# APIキーでワークスペース認証
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "x-api-key: ltl_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"provider":"openai","prompt":"Hello"}'
```

### 4.6 カスタム検証ルール（既存）

ワークスペース毎にカスタムブロックパターンを定義できます。

**特徴:**
- 正規表現パターンによるブロック
- パターンテスト機能
- テキストスキャン機能
- ワークスペース分離

**新規ファイル:**
- `src/routes/custom-rules.ts` - カスタムルールAPI

**API:**
```bash
# パターン追加
curl -X POST http://localhost:3000/custom-rules \
  -H "Content-Type: application/json" \
  -H "x-api-key: ltl_your_key" \
  -d '{"pattern":"confidential|secret"}'

# パターン一覧取得
curl http://localhost:3000/custom-rules \
  -H "x-api-key: ltl_your_key"

# パターンテスト
curl -X POST http://localhost:3000/custom-rules/test \
  -H "Content-Type: application/json" \
  -d '{"pattern":"secret","text":"This is secret data"}'

# テキストスキャン
curl -X POST http://localhost:3000/custom-rules/scan \
  -H "Content-Type: application/json" \
  -H "x-api-key: ltl_your_key" \
  -d '{"text":"This contains confidential information"}'
```

### 4.7 ストレージ選択（既存）

KV以外にPostgreSQLもサポートし、自己ホストを容易にしました。

**対応ストレージ:**
- **KV**: Vercel KV（デフォルト、サーバーレス向け）
- **PostgreSQL**: 自己ホスト、Supabase、Neon対応
- **SQLite**: ローカル開発用

**新規ファイル:**
- `src/storage/adapter.ts` - 統一ストレージアダプター
- `migrations/003_workspace_costs.ts` - コストテーブル追加

**環境変数:**
```bash
# Vercel KV（デフォルト）
DATABASE_TYPE=kv

# PostgreSQL
DATABASE_TYPE=postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DB=llm_trace_lens

# Supabase
DATABASE_TYPE=postgres
POSTGRES_URL=postgresql://postgres:password@db.xxxx.supabase.co:5432/postgres
```

### 4.8 月次PDFレポート（既存）

月次利用レポートをPDFで生成し、メール送信します。

**レポート内容:**
- 総リクエスト数・コスト
- プロバイダ別・モデル別コスト内訳
- 検証サマリー（PASS/WARN/BLOCK）
- 平均レイテンシ
- 予算消化率

**新規ファイル:**
- `src/report/generator.ts` - PDF生成（pdf-lib使用）
- `src/report/email.ts` - メール送信（nodemailer使用）
- `src/cron/monthly-report.ts` - Cronジョブ

**環境変数:**
```bash
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=your_password
SMTP_FROM=reports@llm-trace-lens.com
```

**手動実行:**
```bash
npx tsx src/cron/monthly-report.ts
```

### 4.9 OAuth/SSO連携（既存）

ダッシュボードへのSSO認証をサポートしました。

**対応プロバイダ:**
- **Google**: Google OAuth 2.0
- **Microsoft**: Microsoft Entra ID (Azure AD)

**新規ファイル:**
- `src/auth/microsoft.ts` - Microsoft認証
- `src/routes/auth.ts` - OAuth認証エンドポイント

**環境変数:**
```bash
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Microsoft Entra ID
AZURE_AD_CLIENT_ID=your_azure_client_id
AZURE_AD_CLIENT_SECRET=your_azure_client_secret
AZURE_AD_TENANT_ID=your_tenant_id
```

**API:**
```bash
# 利用可能プロバイダ取得
curl http://localhost:3000/auth/providers

# Google認証（ID token送信）
curl -X POST http://localhost:3000/auth/google \
  -H "Content-Type: application/json" \
  -d '{"token":"google_id_token_here"}'

# Microsoft認証URL取得
curl http://localhost:3000/auth/microsoft

# セッション確認
curl "http://localhost:3000/auth/session?sessionId=session_xxx"

# ログアウト
curl -X POST http://localhost:3000/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"session_xxx"}'
```

---

## 6. システム構成

```
┌─────────────────────────────────────────────────────────────────┐
│                      Client Application                         │
│                    (curl, SDK, Browser)                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Vercel Edge / LLM Trace Lens Proxy                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  api/index.ts (Vercel Serverless Function)               │  │
│  └─────────────┬────────────────────────────────────────────┘  │
│                │                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Fastify API Server                                       │  │
│  │  - POST /v1/chat/completions (OpenAI互換 + Streaming)    │  │
│  │  - GET  /v1/traces, /v1/stats                            │  │
│  │  - GET/POST /api/settings                                │  │
│  │  - GET/POST/DELETE /api/webhook/*                        │  │
│  │  - GET/POST /api/budget/*                                │  │
│  │  - GET/POST/DELETE /custom-rules/*                       │  │
│  │  - GET/POST /auth/*                                      │  │
│  │  - GET/PUT/DELETE /admin/thresholds/* [NEW]              │  │
│  │  - GET/POST /traces/:id/feedback/*    [NEW]              │  │
│  │  - GET/POST /integrations/*           [NEW]              │  │
│  └─────────────┬────────────────────────────────────────────┘  │
│                │                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Auth Layer [NEW]                                        │  │
│  │  - APIキー認証 (x-api-key ヘッダー)                      │  │
│  │  - Google OAuth / Microsoft Entra ID                     │  │
│  │  - ワークスペース分離                                    │  │
│  └─────────────┬────────────────────────────────────────────┘  │
│                │                                                 │
│                ▼                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Enforcer Factory                                        │  │
│  │  ┌─────────┬──────────┬────────────┬──────────┐         │  │
│  │  │ OpenAI  │ Anthropic│  Gemini    │ DeepSeek │         │  │
│  │  │ +Stream │ +Stream  │  +Stream   │  +Stream │ [ENH]   │  │
│  │  └─────────┴──────────┴────────────┴──────────┘         │  │
│  └─────────────┬────────────────────────────────────────────┘  │
│                │                                                 │
│                ▼                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Validation Engine                                        │  │
│  │  - ConfidenceValidator (信頼度とエビデンスの整合性)       │  │
│  │  - RiskScanner (PII検出 + 日本語PII)                     │  │
│  │  - CustomPatternScanner                                   │  │
│  │  - RiskScorer (スコアリング・閾値管理) [NEW]             │  │
│  └─────────────┬────────────────────────────────────────────┘  │
│                │                                                 │
│                ▼                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Integrations [NEW]                                       │  │
│  │  - Slack Block Kit (リッチ通知)                          │  │
│  │  - Microsoft Teams Adaptive Cards                        │  │
│  │  - フィードバック収集・分析                              │  │
│  └─────────────┬────────────────────────────────────────────┘  │
│                │                                                 │
│                ▼                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Storage Adapter [NEW]                                   │  │
│  │  ┌────────────────────┬───────────────────────────────┐ │  │
│  │  │  KV Adapter        │  PostgreSQL Adapter           │ │  │
│  │  │  (Vercel KV)       │  (Supabase, Neon, Self-host)  │ │  │
│  │  └────────────────────┴───────────────────────────────┘ │  │
│  │  - ワークスペース分離                                    │  │
│  │  - トレース・コスト・設定保存                           │  │
│  └─────────────┬────────────────────────────────────────────┘  │
│                │                                                 │
│                ▼                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Report Generator [NEW]                                  │  │
│  │  - 月次PDFレポート生成                                   │  │
│  │  - メール送信                                            │  │
│  │  - Cronジョブ対応                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. ディレクトリ構成

```
llm-trace-lens/
├── api/
│   └── index.ts                    # Vercel Serverless エントリ
├── src/
│   ├── index.ts                    # ローカル開発エントリポイント
│   ├── server.ts                   # build/start分離
│   ├── config.ts                   # 環境変数設定
│   ├── types/
│   │   └── index.ts                # 型定義
│   ├── kv/
│   │   └── client.ts               # KVクライアント（マルチテナント対応）[ENHANCED]
│   ├── auth/                       # [NEW]
│   │   ├── google.ts               # Google OAuth認証
│   │   └── microsoft.ts            # Microsoft Entra ID認証
│   ├── cost/
│   │   └── pricing.ts              # モデル別単価表
│   ├── webhook/
│   │   └── sender.ts               # Webhookエンジン
│   ├── report/                     # [NEW]
│   │   ├── generator.ts            # PDF生成
│   │   └── email.ts                # メール送信
│   ├── cron/                       # [NEW]
│   │   └── monthly-report.ts       # 月次レポートCron
│   ├── routes/
│   │   ├── settings.ts             # 設定API
│   │   ├── webhook-settings.ts     # Webhook設定API
│   │   ├── budget-settings.ts      # 予算設定API
│   │   ├── custom-rules.ts         # カスタムルールAPI
│   │   ├── auth.ts                 # 認証API
│   │   ├── admin.ts                # Admin API [NEW]
│   │   ├── feedback.ts             # Feedback API [NEW]
│   │   └── integrations.ts         # Integrations API [NEW]
│   ├── integrations/               # [NEW]
│   │   ├── slack.ts                # Slack Block Kit
│   │   └── teams.ts                # Teams Adaptive Cards
│   ├── enforcer/
│   │   ├── factory.ts              # プロバイダファクトリ
│   │   ├── schema.ts               # 構造化プロンプト定義
│   │   ├── openai.ts               # OpenAI実装（+Stream）
│   │   ├── anthropic.ts            # Anthropic実装（+Stream）
│   │   ├── gemini.ts               # Gemini実装（+Stream）[ENHANCED]
│   │   └── deepseek.ts             # DeepSeek実装（+Stream）[ENHANCED]
│   ├── validation/
│   │   ├── engine.ts               # 検証エンジン
│   │   ├── confidence.ts           # Confidence検証
│   │   ├── risk.ts                 # リスクスキャナ（カスタムパターン対応）
│   │   ├── scoring.ts              # RiskScorer [NEW]
│   │   └── rules/
│   │       ├── confidence.ts       # Confidence検証ルール
│   │       └── risk.ts             # リスクスキャナルール
│   ├── storage/
│   │   ├── adapter.ts              # 統一ストレージアダプター [NEW]
│   │   ├── models.ts               # データモデル [NEW]
│   │   ├── db.ts                   # DB接続
│   │   ├── repository.ts           # リポジトリ
│   │   ├── trace-store.ts          # TraceStore
│   │   ├── sqlite-trace-store.ts   # SQLite実装
│   │   ├── postgres-trace-store.ts # PostgreSQL実装
│   │   └── trace-store-factory.ts  # ファクトリ
│   ├── proxy/
│   │   ├── routes.ts               # ルート定義
│   │   └── handler.ts              # リクエストハンドラ（マルチテナント対応）[ENHANCED]
│   ├── middleware/
│   │   ├── auth.ts                 # 認証ミドルウェア
│   │   └── rate-limit.ts           # レート制限
│   └── tests/
│       ├── enforcer/
│       │   └── streaming.test.ts   # ストリーミングテスト
│       └── validation/
│           ├── confidence.test.ts
│           ├── risk.test.ts
│           ├── japanese-pii.test.ts
│           ├── custom-patterns.test.ts # カスタムパターンテスト
│           └── scoring.test.ts     # スコアリングテスト [NEW]
├── migrations/
│   ├── 001_initial_schema.ts       # 初期スキーマ
│   ├── 002_add_workspace.ts        # ワークスペース追加
│   ├── 003_workspace_costs.ts      # コストテーブル追加
│   ├── 004_add_validation_config.ts # 検証設定追加 [NEW]
│   └── 005_add_feedback.ts         # フィードバック追加 [NEW]
├── packages/
│   └── dashboard/
│       └── src/
│           ├── App.tsx
│           ├── pages/
│           │   ├── Setup.tsx
│           │   ├── Dashboard.tsx
│           │   ├── Settings.tsx
│           │   ├── Analytics.tsx       # [NEW]
│           │   └── Integrations.tsx    # [NEW]
│           ├── api/
│           │   ├── client.ts
│           │   └── settings.ts
│           └── components/
│               ├── TraceList.tsx
│               ├── TraceDetail.tsx
│               ├── StatsPanel.tsx
│               └── FeedbackButton.tsx  # [NEW]
├── vercel.json
├── .env.example                    # 環境変数テンプレート [ENHANCED]
├── DESIGN_PHILOSOPHY.md
├── README.md
└── REPORT.md
```

---

## 8. 検証ルール

### 7.1 ConfidenceValidator

| 条件 | 結果 | 説明 |
|------|------|------|
| confidence >= 90 && evidence < 2 | WARN | 高信頼だがエビデンス不足 |
| confidence < 50 | WARN | 低信頼度 |
| それ以外 | PASS | 正常 |

### 7.2 RiskScanner

**英語PII:**

| 検出パターン | 結果 | 例 |
|-------------|------|-----|
| SSN形式 | BLOCK | 123-45-6789 |
| クレジットカード番号 | BLOCK | 16桁数字、4桁x4形式 |
| OpenAI APIキー | BLOCK | sk-xxx... |
| AWS Access Key | BLOCK | AKIA... |
| メールアドレス | WARN | user@example.com |

**日本語PII:**

| 検出パターン | 結果 | 例 |
|-------------|------|-----|
| マイナンバー（コンテキスト付き） | BLOCK | マイナンバーは 1234-5678-9012 |
| 銀行口座（コンテキスト付き） | BLOCK | 口座番号: 123-4567890 |
| マイナンバー（12桁数字） | WARN | 123456789012 |
| 法人番号（13桁数字） | WARN | 1234567890123 |
| 電話番号（固定電話） | WARN | 03-1234-5678 |
| 携帯電話番号 | WARN | 090-1234-5678 |
| 郵便番号 | WARN | 〒123-4567 |

### 7.3 カスタムパターン

ワークスペース毎に正規表現パターンを定義可能：

```bash
# パターン追加例
curl -X POST http://localhost:3000/custom-rules \
  -H "Content-Type: application/json" \
  -d '{"pattern":"confidential|secret|internal"}'
```

---

## 9. テスト結果

```
 ✓ src/tests/enforcer/streaming.test.ts (5 tests)
 ✓ src/tests/validation/custom-patterns.test.ts (11 tests)
 ✓ src/tests/validation/scoring.test.ts (13 tests)
 ✓ src/tests/validation/confidence.test.ts (5 tests)
 ✓ src/tests/validation/risk.test.ts (6 tests)
 ✓ src/tests/validation/japanese-pii.test.ts (16 tests)
 ✓ src/tests/storage/limit-enforcement.test.ts (6 tests)
 ✓ src/tests/evaluation/faithfulness.test.ts (8 tests) [NEW]

 Test Files  15 passed (15)
      Tests  138 passed (138)
```

---

## 10. 起動方法

### 9.1 環境設定

```bash
# .env.example を .env にコピー
cp .env.example .env

# 必要なAPIキーを設定
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx
GOOGLE_API_KEY=xxx
DEEPSEEK_API_KEY=xxx

# ストレージ設定
DATABASE_TYPE=kv  # または postgres

# OAuth設定（オプション）
GOOGLE_CLIENT_ID=your_client_id
AZURE_AD_CLIENT_ID=your_azure_id
AZURE_AD_CLIENT_SECRET=your_azure_secret
AZURE_AD_TENANT_ID=your_tenant_id

# メール設定（オプション）
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=your_password
```

### 9.2 ローカル起動

```bash
# ターミナル1: バックエンド
cd /path/to/llm-trace-lens
npm run dev
# → http://localhost:3000

# ターミナル2: フロントエンド
cd /path/to/llm-trace-lens/packages/dashboard
npm run dev
# → http://localhost:5173
```

### 9.3 テストリクエスト

```bash
# 基本テスト
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello"}]
  }'

# ストリーミングテスト（Gemini）
curl -N -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "gemini",
    "model": "gemini-1.5-pro",
    "prompt": "Hello",
    "stream": true
  }'

# ワークスペース認証付きリクエスト
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "x-api-key: ltl_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"provider":"openai","prompt":"Hello"}'

# カスタムパターンスキャン
curl -X POST http://localhost:3000/custom-rules/scan \
  -H "Content-Type: application/json" \
  -d '{"text":"This contains confidential information"}'
```

---

## 11. 環境変数一覧

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| PORT | サーバーポート | 3000 |
| NODE_ENV | 環境 | development |
| DATABASE_TYPE | ストレージ種別 | postgres |
| MAX_TRACES | KV最大トレース数 | 5000 |
| MAX_AGE_DAYS | KVトレース保持日数 | 30 |
| DATABASE_URL | PostgreSQL接続文字列 | - |
| OPENAI_API_KEY | OpenAI APIキー | - |
| ANTHROPIC_API_KEY | Anthropic APIキー | - |
| GOOGLE_API_KEY | Google APIキー | - |
| DEEPSEEK_API_KEY | DeepSeek APIキー | - |
| ENABLE_AUTH | 認証有効化 | false |
| API_KEYS | 認証用APIキー（カンマ区切り） | - |
| ADMIN_API_KEY | Admin API認証キー | - |
| GOOGLE_CLIENT_ID | Google OAuth Client ID | - |
| GOOGLE_CLIENT_SECRET | Google OAuth Secret | - |
| AZURE_AD_CLIENT_ID | Microsoft Entra Client ID | - |
| AZURE_AD_CLIENT_SECRET | Microsoft Entra Secret | - |
| AZURE_AD_TENANT_ID | Microsoft Entra Tenant ID | common |
| WEBHOOK_ENABLED | Webhook有効化 | false |
| WEBHOOK_URL | WebhookエンドポイントURL | - |
| WEBHOOK_EVENTS | 通知イベント（カンマ区切り） | BLOCK,WARN |
| MONTHLY_BUDGET | 月次予算（USD） | - |
| BUDGET_ALERT_THRESHOLDS | 予算アラート閾値 | 0.8,0.95 |
| SMTP_HOST | SMTPホスト | - |
| SMTP_PORT | SMTPポート | 587 |
| SMTP_USER | SMTPユーザー | - |
| SMTP_PASS | SMTPパスワード | - |
| SMTP_FROM | 送信元アドレス | - |
| KV_REST_API_URL | Vercel KV URL | - |
| KV_REST_API_TOKEN | Vercel KVトークン | - |
| POSTGRES_HOST | PostgreSQLホスト | localhost |
| POSTGRES_PORT | PostgreSQLポート | 5432 |
| POSTGRES_USER | PostgreSQLユーザー | postgres |
| POSTGRES_PASSWORD | PostgreSQLパスワード | - |
| POSTGRES_DB | PostgreSQLデータベース | llm_trace_lens |

---

## 12. 今後の拡張予定

### 完了済み

| Phase | 機能 | 状態 |
|-------|------|------|
| 1 | ストリーミング対応（OpenAI/Anthropic） | ✅ 完了 |
| 1 | DeepSeek対応 | ✅ 完了 |
| 1 | 認証・認可 | ✅ 完了 |
| 1 | 自動テスト | ✅ 完了 |
| 2 | SaaS化（Vercel対応） | ✅ 完了 |
| 2 | セットアップウィザード | ✅ 完了 |
| 3 | Webhook即時アラート | ✅ 完了 |
| 3 | コストトラッキング | ✅ 完了 |
| 3 | 予算アラート | ✅ 完了 |
| 3 | 日本語PII検出 | ✅ 完了 |
| 4 | Gemini/DeepSeekストリーミング | ✅ 完了 |
| 4 | マルチテナント | ✅ 完了 |
| 4 | カスタム検証ルール | ✅ 完了 |
| 4 | PostgreSQL/Supabase対応 | ✅ 完了 |
| 4 | 月次PDFレポート | ✅ 完了 |
| 4 | OAuth/SSO（Google/Microsoft） | ✅ 完了 |
| 4 | 閾値ブラックボックス化 | ✅ 完了 |
| 4 | フィードバック機能 | ✅ 完了 |
| 4 | Slack/Teams連携 | ✅ 完了 |
| 5 | LLM-as-Judge評価 | ✅ 完了 |

### 予定

| Phase | 機能 | 優先度 | 説明 |
|-------|------|--------|------|
| 5 | ダッシュボードリアルタイム更新 | 中 | WebSocket対応 |
| 5 | チーム招待機能 | 中 | ワークスペースへの招待 |
| 5 | ロールベースアクセス制御 | 中 | Admin/Member/Viewer |
| 6 | 内部トレースAPI対応 | - | ベンダー提供の内部状態取得 |
| 6 | アクティベーション可視化 | - | ニューロン活性化表示 |

---

## 13. 既知の制限事項

1. ~~**ストリーミング制限**: Gemini/DeepSeekは非ストリーミングのみ~~ → ✅ v0.4.0で解消
2. ~~**認証**: シンプルなAPIキー認証のみ（OAuth未対応）~~ → ✅ v0.4.0で解消
3. ~~**マルチテナント未対応**~~ → ✅ v0.4.0で解消
4. ~~**トレース保持制限**: KVでは直近1000件/30日間のみ保持~~ → ✅ v0.4.1でカスタマイズ可能（MAX_TRACES/MAX_AGE_DAYS）
5. **コスト精度**: usage情報がない場合は概算値

---

## 14. 主要依存パッケージ

| パッケージ | バージョン | 用途 |
|-----------|-----------|------|
| fastify | ^4.26.0 | Webフレームワーク |
| @fastify/cors | ^9.0.1 | CORS対応 |
| axios | ^1.13.5 | HTTPクライアント |
| openai | ^4.28.0 | OpenAI SDK |
| @anthropic-ai/sdk | ^0.74.0 | Anthropic SDK |
| @google/generative-ai | ^0.24.1 | Google AI SDK |
| @vercel/kv | ^1.0.1 | Vercel KV SDK |
| pg | ^8.18.0 | PostgreSQLドライバ |
| knex | ^3.1.0 | SQLクエリビルダー |
| better-sqlite3 | ^12.6.2 | SQLiteドライバ |
| google-auth-library | latest | Google OAuth |
| @azure/msal-node | latest | Microsoft認証 |
| pdf-lib | latest | PDF生成 |
| nodemailer | latest | メール送信 |
| zod | ^3.22.4 | バリデーション |
| vitest | ^4.0.18 | テストフレームワーク |

---

**レポート作成**: Claude Code (claude-opus-4-5-20251101)
**最終更新**: 2026年2月18日（v0.5.0 LLM-as-Judge評価エンジン追加）
